import { useEffect, useState, useCallback, useRef, memo } from "react";
import _ from "lodash";
import RadioField from "./radioField";
import CheckBoxField from "./checkboxField";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import CheckBox from "./checkbox";
import { BOOKING_TYPES } from "../constants";
import HorizontalCardSelection from "../ui-v2/HorizontalCardSelection";

const EquipmentField = memo((props) => {
    const bookingType = useSelector(state => state.bookingRequestForm.bookingType);
    
    // State management
    const [equipmentChanges, setEquipmentChanges] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [currentBookingEquipments, setCurrentBookingEquipments] = useState([]);
    const [categorySelections, setCategorySelections] = useState({});
    const [groupedEquipments, setGroupedEquipments] = useState({});
    const [categoryTypes, setCategoryTypes] = useState({});
    const [showTiltQuestion, setShowTiltQuestion] = useState(false);
    const [acknowledgementChecked, setAcknowledgementChecked] = useState(false);
    const [categoryErrors, setCategoryErrors] = useState({});
    const [categoryTouched, setCategoryTouched] = useState({});
    const [dataLoaded, setDataLoaded] = useState(false);
    
    // State for special equipment metadata
    const [equipmentMetaData, setEquipmentMetaData] = useState({});

    // Optimization refs
    const updateTimeoutRef = useRef({});
    const mountedRef = useRef(true);
    const lastValidationRef = useRef(null);

    const router = useRouter();
    const { uuid, prevBookingId } = router.query;

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            Object.values(updateTimeoutRef.current).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
        };
    }, []);

    // Memoized props effect sync
    useEffect(() => {
        if (props.equipmentChanges && JSON.stringify(props.equipmentChanges) !== JSON.stringify(equipmentChanges)) {
            setEquipmentChanges(props.equipmentChanges);
        }
    }, [props.equipmentChanges]);

    // Load data on mount
    useEffect(() => {
        if (uuid) {
            Promise.all([
                fetchEquipments(),
                fetchCurrentBookingEquipments(uuid)
            ]).then(() => {
                setDataLoaded(true);
            });
        }
    }, [uuid]);

    const debouncedValidation = useCallback(() => {
        if (updateTimeoutRef.current.validation) {
            clearTimeout(updateTimeoutRef.current.validation);
        }

        updateTimeoutRef.current.validation = setTimeout(() => {
            if (!mountedRef.current) return;
            
            const validationResult = validateSelections();
            const validationKey = JSON.stringify({
                selections: categorySelections,
                acknowledgement: acknowledgementChecked,
                showTilt: showTiltQuestion,
                metaData: equipmentMetaData
            });

            if (lastValidationRef.current !== validationKey) {
                lastValidationRef.current = validationKey;
                
                if (props.hasOwnProperty('onChange')) {
                    props.onChange(validationResult.allValid, equipmentChanges);
                }
            }
        }, 150);
    }, [categorySelections, acknowledgementChecked, showTiltQuestion, equipmentChanges, equipmentMetaData, props]);

    // Initialize when data is loaded
    useEffect(() => {
        if (equipments.length > 0 && dataLoaded) {
            const grouped = _.groupBy(equipments.filter(eq => !eq.hidden), 'EquipmentCategory.name');
            
            Object.keys(grouped).forEach(categoryName => {
                grouped[categoryName] = grouped[categoryName].sort((a, b) => {
                    const orderA = a.order || 0;
                    const orderB = b.order || 0;
                    return orderA - orderB;
                });
            });
            
            setGroupedEquipments(grouped);
            const types = determineCategoryTypes(grouped);
            setCategoryTypes(types);
            initializeCategorySelections(grouped, types);
        }
    }, [equipments, currentBookingEquipments, dataLoaded]);

    // Debounced validation trigger
    useEffect(() => {
        if (Object.keys(groupedEquipments).length > 0) {
            debouncedValidation();
        }
    }, [categorySelections, acknowledgementChecked, groupedEquipments, showTiltQuestion, equipmentMetaData, debouncedValidation]);

    const fetchEquipments = async () => {
        try {
            const res = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: true }));
            if (!res.ok) throw new Error('Failed to fetch equipments');
            const data = await res.json();
            setEquipments(data);
            return data;
        } catch (error) {
            console.error('Error fetching equipments:', error);
            return [];
        }
    };
    
    const fetchCurrentBookingEquipments = async (bookingId) => {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/equipments`);
            if (!res.ok) throw new Error('Failed to fetch booking equipments');
            const data = await res.json();
            console.log('📋 Fetched current booking equipments:', data);
            setCurrentBookingEquipments(data);
            return data;
        } catch (error) {
            console.error('Error fetching current booking equipments:', error);
            return [];
        }
    };

    // Check if a category has special handling
    const hasSpecialHandling = (categoryName) => {
        const specialCategories = ['cot']; // Add more special categories here
        return specialCategories.includes(categoryName);
    };

    const determineCategoryTypes = (grouped) => {
        const types = {};
        
        Object.entries(grouped).forEach(([categoryName, categoryEquipments]) => {
            if (!categoryName || categoryName === 'null') return;
            
            // Check for special handling first
            if (hasSpecialHandling(categoryName)) {
                types[categoryName] = 'special';
                return;
            }
            
            const hasGroupType = categoryEquipments.some(eq => eq.type === 'group');
            const equipmentCount = categoryEquipments.length;
            
            // Force specific categories to be single_select (radio buttons)
            if (categoryName === 'mattress_options' || categoryName === 'sling') {
                types[categoryName] = 'single_select';
                return;
            }
            
            // Special handling for shower_commodes - use confirmation with single select
            if (categoryName === 'shower_commodes') {
                types[categoryName] = 'confirmation_single';
                return;
            }
            
            // Binary categories: single equipment item that represents a yes/no choice
            if (equipmentCount === 1 && !hasGroupType) {
                types[categoryName] = 'binary';
            }
            // Multi-select categories: multiple items or items with type 'group'
            else if (hasGroupType || equipmentCount > 1) {
                // Check if this category needs confirmation (based on category name patterns)
                const needsConfirmation = categoryName.includes('adaptive_bathroom');
                
                if (needsConfirmation) {
                    types[categoryName] = 'confirmation_multi';
                } else {
                    types[categoryName] = 'multi_select';
                }
            }
            // Single-select categories: multiple items, choose one
            else if (equipmentCount > 1) {
                types[categoryName] = 'single_select';
            }
            // Default to single select for edge cases
            else {
                types[categoryName] = 'single_select';
            }
            
            // Force transfer_aids to be multi_select (no confirmation question)
            if (categoryName === 'transfer_aids') {
                types[categoryName] = 'multi_select';
            }
        });
        
        return types;
    };

    const initializeCategorySelections = (grouped, types) => {
        const selections = {};
        const metaData = {};

        Object.entries(grouped).forEach(([categoryName, categoryEquipments]) => {
            if (!categoryName || categoryName === 'null') return;
            
            const categoryType = types[categoryName];

            // Handle special categories
            if (categoryType === 'special') {
                if (categoryName === 'cot') {
                    const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                        ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                    );
                    
                    if (hasEquipmentInCategory) {
                        selections[categoryName] = 'yes';
                        // Try to get quantity from existing booking equipment meta_data
                        const existingCotBooking = currentBookingEquipments.find(ce => 
                            ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                        );
                        console.log(`🛏️ Existing cot booking data:`, existingCotBooking);
                        
                        // ✅ FIXED: Check BookingEquipment.meta_data instead of direct meta_data
                        if (existingCotBooking && 
                            existingCotBooking.BookingEquipment && 
                            existingCotBooking.BookingEquipment.meta_data && 
                            existingCotBooking.BookingEquipment.meta_data.quantity) {
                            console.log(`📊 Loading saved cot quantity: ${existingCotBooking.BookingEquipment.meta_data.quantity}`);
                            metaData[categoryName] = { quantity: existingCotBooking.BookingEquipment.meta_data.quantity };
                        } else {
                            console.log(`📊 No saved quantity found, using default: 1`);
                            metaData[categoryName] = { quantity: 1 };
                        }
                    } else if (currentBookingEquipments.length > 0) {
                        selections[categoryName] = 'no';
                        metaData[categoryName] = { quantity: 1 };
                    } else {
                        selections[categoryName] = null;
                        metaData[categoryName] = { quantity: 1 };
                    }
                }
                return;
            }

            if (categoryType === 'binary') {
                const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                    ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                );
                
                if (hasEquipmentInCategory) {
                    selections[categoryName] = 'yes';
                } else if (currentBookingEquipments.length > 0) {
                    selections[categoryName] = 'no';
                } else {
                    selections[categoryName] = null;
                }
                
            } else if (categoryType === 'confirmation_multi' || categoryType === 'confirmation_single') {
                const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                    ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                );
                
                if (hasEquipmentInCategory) {
                    selections[`confirm_${categoryName}`] = 'yes';
                } else if (currentBookingEquipments.length > 0) {
                    selections[`confirm_${categoryName}`] = 'no';
                } else {
                    selections[`confirm_${categoryName}`] = null;
                }
                
                if (currentBookingEquipments.length > 0) {
                    if (categoryType === 'confirmation_single') {
                        const selectedEquipment = categoryEquipments
                            .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
                        selections[categoryName] = selectedEquipment ? selectedEquipment.id : null;
                    } else {
                        selections[categoryName] = categoryEquipments
                            .filter(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name))
                            .map(equipment => equipment.id);
                    }
                } else {
                    selections[categoryName] = categoryType === 'confirmation_single' ? null : [];
                }
            } else if (categoryType === 'multi_select') {
                if (currentBookingEquipments.length > 0) {
                    selections[categoryName] = categoryEquipments
                        .filter(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name))
                        .map(equipment => equipment.id);
                } else {
                    selections[categoryName] = [];
                }
            } else if (categoryType === 'single_select') {
                if (currentBookingEquipments.length > 0) {
                    const selectedEquipment = categoryEquipments
                        .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
                    selections[categoryName] = selectedEquipment ? selectedEquipment.id : null;
                } else {
                    selections[categoryName] = null;
                }
            }
        });

        // Handle special ceiling hoist sling logic
        if (currentBookingEquipments.length > 0 && grouped['ceiling_hoist'] && grouped['sling'] && selections['ceiling_hoist'] === 'yes') {
            const selectedSling = grouped['sling']
                .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
            selections['sling'] = selectedSling ? selectedSling.id : null;
        } else if (grouped['sling']) {
            selections['sling'] = null;
        }

        // Handle tilt question logic
        if (currentBookingEquipments.length > 0 && selections['shower_commodes']) {
            const selectedCommode = grouped['shower_commodes']?.find(eq => eq.id === selections['shower_commodes']);
            const hasHighBackTilt = selectedCommode?.name === 'Commode: High Back Tilt';
            setShowTiltQuestion(hasHighBackTilt);
            
            if (hasHighBackTilt) {
                const hasTiltOverToilet = currentBookingEquipments.some(ce => 
                    ce.EquipmentCategory && ce.EquipmentCategory.name === 'shower_commodes' && ce.hidden
                );
                selections['need_tilt_over_toilet'] = hasTiltOverToilet ? 'yes' : 'no';
            }
        }

        // Handle acknowledgement
        if (currentBookingEquipments.length > 0 && bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST) {
            const hasAcknowledgement = currentBookingEquipments.some(ce => 
                ce.type === 'acknowledgement' && ce.hidden
            );
            setAcknowledgementChecked(hasAcknowledgement);
        }

        setCategorySelections(selections);
        setEquipmentMetaData(metaData);
    };

    const validateSelections = () => {
        const categories = Object.keys(groupedEquipments);
        let allValid = true;
        const errors = {};

        categories.forEach(categoryName => {
            if (!categoryName || categoryName === 'null') return;
            
            const categoryType = categoryTypes[categoryName];
            const isRequired = isRequiredCategory(categoryName, categoryType);
            
            const hasUserSelection = categorySelections[categoryName] !== null && 
                                    categorySelections[categoryName] !== undefined &&
                                    categorySelections[categoryName] !== '';
            
            const shouldValidate = isRequired || hasUserSelection;
            
            if (shouldValidate) {
                if (categoryType === 'special') {
                    // Handle special category validation
                    if (categoryName === 'cot') {
                        if (!categorySelections[categoryName]) {
                            if (isRequired) {
                                errors[categoryName] = 'Please select an option for cot requirement';
                                allValid = false;
                            }
                        } else if (categorySelections[categoryName] === 'yes') {
                            const quantity = equipmentMetaData[categoryName]?.quantity;
                            if (!quantity || quantity < 1) {
                                errors[`${categoryName}_quantity`] = 'Please specify how many cots you need (minimum 1)';
                                allValid = false;
                            }
                        }
                    }
                } else if (categoryType === 'binary') {
                    if (!categorySelections[categoryName]) {
                        if (isRequired) {
                            errors[categoryName] = `Please select an option for ${getBinaryQuestionLabel(categoryName)}`;
                            allValid = false;
                        }
                    }
                } else if (categoryType === 'confirmation_multi' || categoryType === 'confirmation_single') {
                    const confirmationKey = `confirm_${categoryName}`;
                    const confirmSelection = categorySelections[confirmationKey];
                    
                    if (!confirmSelection) {
                        if (isRequired) {
                            errors[confirmationKey] = `Please select an option for ${getConfirmationQuestionLabel(categoryName)}`;
                            allValid = false;
                        }
                    }
                    
                    if (confirmSelection === 'yes') {
                        if (categoryType === 'confirmation_single') {
                            if (!categorySelections[categoryName]) {
                                errors[categoryName] = `Please select an option from ${formatCategoryName(categoryName)}`;
                                allValid = false;
                            }
                        } else {
                            if (!categorySelections[categoryName] || 
                                (Array.isArray(categorySelections[categoryName]) && categorySelections[categoryName].length === 0)) {
                                errors[categoryName] = `Please select at least one option from ${formatCategoryName(categoryName)}`;
                                allValid = false;
                            }
                        }
                    }
                } else if (categoryType === 'single_select') {
                    if (!categorySelections[categoryName]) {
                        if (isRequired) {
                            const fieldName = categoryName === 'mattress_options' ? 'Mattress Options' :
                                            categoryName === 'sling' ? 'Sling' :
                                            formatCategoryName(categoryName);
                            errors[categoryName] = `Please select a ${fieldName}`;
                            allValid = false;
                        }
                    }
                }
            }
            
            // Special validation for sling when ceiling hoist is yes
            if (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes' && !categorySelections['sling']) {
                errors['sling'] = 'Please select a sling option when using ceiling hoist';
                allValid = false;
            }
        });

        // Special validation for tilt question
        if (showTiltQuestion && !categorySelections['need_tilt_over_toilet']) {
            errors['need_tilt_over_toilet'] = 'Please select an option for tilt commode question';
            allValid = false;
        }

        // Check acknowledgement for non-first-time guests
        if (bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST && !acknowledgementChecked) {
            errors['acknowledgement'] = 'Please acknowledge that the information is true and updated';
            allValid = false;
        }

        // Only show errors for fields that have been touched
        const touchedErrors = {};
        Object.keys(errors).forEach(key => {
            if (categoryTouched[key]) {
                touchedErrors[key] = errors[key];
            }
        });
        
        setCategoryErrors(touchedErrors);
        
        return { allValid, errors };
    };

    const isRequiredCategory = (categoryName, categoryType) => {
        const alwaysRequired = ['mattress_options', 'shower_commodes'];
        const requiredMultiSelect = ['adaptive_bathroom_options'];
        const conditionallyRequired = {
            'sling': () => categorySelections['ceiling_hoist'] === 'yes'
        };
        const optionalCategories = ['transfer_aids', 'miscellaneous', 'cot']; // cot is optional
        
        if (alwaysRequired.includes(categoryName)) return true;
        if (conditionallyRequired[categoryName]) return conditionallyRequired[categoryName]();
        if (optionalCategories.includes(categoryName)) return false;
        if (requiredMultiSelect.includes(categoryName)) return true;
        
        return categoryType === 'binary' || categoryType === 'single_select';
    };

    const handleCategoryChange = useCallback((categoryName, value, isConfirmation = false) => {
        const key = isConfirmation ? `confirm_${categoryName}` : categoryName;
        const categoryType = categoryTypes[categoryName];
        
        // Mark as touched
        setCategoryTouched(prev => ({
            ...prev,
            [key]: true
        }));

        // Clear errors for this category
        setCategoryErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[key];
            if (isConfirmation) {
                delete newErrors[categoryName];
            }
            delete newErrors[`${categoryName}_quantity`];
            return newErrors;
        });
        
        setCategorySelections(prev => {
            const newSelections = { ...prev, [key]: value };
            
            // Handle special logic for ceiling hoist
            if (categoryName === 'ceiling_hoist' && value === 'no') {
                newSelections['sling'] = null;
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors['sling'];
                    return newErrors;
                });
            }
            
            // Handle confirmation "No" selections
            if (isConfirmation && value === 'no') {
                newSelections[categoryName] = (categoryType === 'confirmation_multi') ? [] : null;
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors[categoryName];
                    return newErrors;
                });
            }

            // Handle special categories
            if (categoryType === 'special' && categoryName === 'cot' && value === 'no') {
                setEquipmentMetaData(prev => ({
                    ...prev,
                    [categoryName]: { quantity: 1 }
                }));
            }

            // Check if High Back Tilt commode is selected
            if (categoryName === 'shower_commodes' && !isConfirmation) {
                const selectedEquipment = groupedEquipments[categoryName]?.find(eq => eq.id === value);
                const hasHighBackTilt = selectedEquipment?.name === 'Commode: High Back Tilt';
                setShowTiltQuestion(hasHighBackTilt);
                
                if (!hasHighBackTilt) {
                    setCategoryErrors(prevErrors => {
                        const newErrors = { ...prevErrors };
                        delete newErrors['need_tilt_over_toilet'];
                        return newErrors;
                    });
                }
            }

            return newSelections;
        });

        // Call updateEquipmentChanges immediately
        if (categoryName === 'ceiling_hoist' && value === 'no') {
            handleMultipleEquipmentChanges([
                { category: 'ceiling_hoist', value: 'no' },
                { category: 'sling', value: null }
            ]);
        } else if (isConfirmation && value === 'no') {
            const nestedValue = (categoryType === 'confirmation_multi') ? [] : null;
            updateEquipmentChanges(categoryName, nestedValue, false);
        } else {
            // For special categories, use the updated metadata
            if (categoryType === 'special') {
                updateEquipmentChangesWithMetaData(categoryName, value, isConfirmation, null);
            } else {
                updateEquipmentChanges(categoryName, value, isConfirmation);
            }
        }
    }, [categoryTypes, groupedEquipments]);

    // Handle quantity changes for special equipment
    const handleQuantityChange = useCallback((categoryName, quantity) => {
        const parsedQuantity = parseInt(quantity) || 1;
        
        setCategoryTouched(prev => ({
            ...prev,
            [`${categoryName}_quantity`]: true
        }));

        setCategoryErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`${categoryName}_quantity`];
            return newErrors;
        });

        setEquipmentMetaData(prev => ({
            ...prev,
            [categoryName]: { 
                ...prev[categoryName],
                quantity: parsedQuantity 
            }
        }));

        // Update equipment changes if category is already selected as "yes"
        if (categorySelections[categoryName] === 'yes') {
            updateEquipmentChangesWithMetaData(categoryName, 'yes', false, { quantity: parsedQuantity });
        }
    }, [categorySelections]);

    // Optimized radio field change handler
    const handleRadioFieldChange = useCallback((categoryName, label, updatedOptions, isConfirmation = false) => {
        const selectedOption = updatedOptions.find(opt => opt.value === true);
        if (selectedOption) {
            handleCategoryChange(categoryName, selectedOption.label.toLowerCase(), isConfirmation);
        }
    }, [handleCategoryChange]);

    // Function to handle equipment changes with explicit metadata
    const updateEquipmentChangesWithMetaData = (categoryName, value, isConfirmation = false, metaDataOverride = null) => {
        if (isConfirmation) return;
        
        const categoryEquipments = groupedEquipments[categoryName] || [];
        const categoryType = categoryTypes[categoryName];
        let selectedEquipments = [];
        const previousSelectedEquipments = currentBookingEquipments.filter(equipment => 
            equipment?.EquipmentCategory?.name === categoryName && !equipment?.hidden
        );

        if (categoryType === 'special') {
            // Handle special categories
            if (categoryName === 'cot') {
                const equipment = categoryEquipments[0];
                if (equipment && value === 'yes') {
                    const quantity = metaDataOverride?.quantity || equipmentMetaData[categoryName]?.quantity || 1;
                    selectedEquipments = [{ 
                        ...equipment, 
                        label: equipment.name,
                        value: true,
                        meta_data: { quantity }
                    }];
                } else if (equipment) {
                    selectedEquipments = [{ 
                        ...equipment, 
                        label: equipment.name,
                        value: false
                    }];
                }
            }
        } else if (categoryType === 'binary') {
            const equipment = categoryEquipments[0];
            if (equipment) {
                selectedEquipments = [{ 
                    ...equipment, 
                    label: equipment.name,
                    value: value === 'yes' 
                }];
            }
        } else if (categoryType === 'multi_select' || categoryType === 'confirmation_multi') {
            if (Array.isArray(value)) {
                const selectedItems = categoryEquipments.filter(eq => value.includes(eq.id));
                selectedEquipments = selectedItems.map(eq => ({ 
                    ...eq, 
                    label: eq.name,
                    value: true,
                    type: 'group' 
                }));
                
                const prevEquipments = previousSelectedEquipments
                    .filter(eq => !value.includes(eq.id))
                    .map(eq => ({ 
                        ...eq, 
                        label: eq.name,
                        value: false,
                        type: 'group' 
                    }));
                
                selectedEquipments = [...selectedEquipments, ...prevEquipments];
            }
        } else if (categoryType === 'single_select' || categoryType === 'confirmation_single') {
            if (value) {
                const selectedEquipment = categoryEquipments.find(eq => eq.id === value);
                if (selectedEquipment) {
                    selectedEquipments = [{ 
                        ...selectedEquipment, 
                        label: selectedEquipment.name,
                        value: true 
                    }];
                }
            }
        }

        // Handle special shower commodes logic
        if (categoryName === 'shower_commodes' && selectedEquipments.length > 0) {
            const hasHighBackTilt = selectedEquipments.some(eq => eq.name === 'Commode: High Back Tilt');
            if (!hasHighBackTilt) {
                const confirmTiltEq = equipments.find(equipment => 
                    equipment.EquipmentCategory.name === 'shower_commodes' && equipment.hidden
                );
                if (confirmTiltEq) {
                    selectedEquipments.push({ 
                        ...confirmTiltEq, 
                        value: false 
                    });
                }
            }
        }

        const change = {
            category: categoryName,
            equipments: selectedEquipments,
            isDirty: true
        };

        setEquipmentChanges(prev => {
            const filtered = prev.filter(c => c.category !== categoryName);
            const newChanges = [...filtered, change];
            
            if (props.hasOwnProperty('onChange')) {
                const validationResult = validateSelections();
                props.onChange(validationResult.allValid, newChanges);
            }
            
            return newChanges;
        });
    };

    const updateEquipmentChanges = (categoryName, value, isConfirmation = false) => {
        updateEquipmentChangesWithMetaData(categoryName, value, isConfirmation, null);
    };

    const handleMultipleEquipmentChanges = (changes) => {
        const equipmentChangesToAdd = [];
        
        changes.forEach(({ category, value }) => {
            const categoryEquipments = groupedEquipments[category] || [];
            const categoryType = categoryTypes[category];
            let selectedEquipments = [];
            const previousSelectedEquipments = currentBookingEquipments.filter(equipment => 
                equipment?.EquipmentCategory?.name === category && !equipment?.hidden
            );

            if (categoryType === 'binary') {
                const equipment = categoryEquipments[0];
                if (equipment) {
                    selectedEquipments = [{ 
                        ...equipment, 
                        label: equipment.name,
                        value: value === 'yes' 
                    }];
                }
            } else if (category === 'sling' && value === null) {
                const prevSlingEquipments = previousSelectedEquipments.map(eq => ({ 
                    ...eq, 
                    label: eq.name,
                    value: false 
                }));
                selectedEquipments = prevSlingEquipments;
            }

            if (selectedEquipments.length > 0) {
                equipmentChangesToAdd.push({
                    category,
                    equipments: selectedEquipments,
                    isDirty: true
                });
            }
        });

        setEquipmentChanges(prev => {
            let filtered = prev;
            changes.forEach(({ category }) => {
                filtered = filtered.filter(c => c.category !== category);
            });
            return [...filtered, ...equipmentChangesToAdd].filter(c => c.equipments.length > 0);
        });
    };

    const handleTiltConfirmation = useCallback((value) => {
        const confirmTiltEquipment = equipments.find(equipment => 
            equipment.EquipmentCategory.name === 'shower_commodes' && equipment.hidden
        );
        
        if (confirmTiltEquipment) {
            const change = {
                category: 'shower_commodes',
                equipments: [{ 
                    ...confirmTiltEquipment, 
                    value: value === 'yes' 
                }],
                isDirty: true
            };

            setEquipmentChanges(prev => {
                const filtered = prev.filter(c => {
                    if (c.category !== 'shower_commodes') return true;
                    
                    const changeHasHiddenEquipment = change.equipments.some(e => e.hidden);
                    const existingHasHiddenEquipment = c.equipments.some(e => e.hidden);
                    
                    return changeHasHiddenEquipment !== existingHasHiddenEquipment;
                });
                return [...filtered, change];
            });
        }
    }, [equipments]);

    const getValidationStyling = (categoryName, isConfirmation = false) => {
        const key = isConfirmation ? `confirm_${categoryName}` : categoryName;
        const hasError = categoryErrors[key] || categoryErrors[`${categoryName}_quantity`];
        const isTouched = categoryTouched[key] || categoryTouched[`${categoryName}_quantity`];
        const hasSelection = categorySelections[key];
        const categoryType = categoryTypes[categoryName];
        
        const isRequired = isRequiredCategory(categoryName, categoryType) ||
                          (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes') ||
                          (isConfirmation && (categoryType === 'confirmation_multi' || categoryType === 'confirmation_single')) ||
                          (categoryName === 'need_tilt_over_toilet' && showTiltQuestion);
        
        let isValid = false;
        if (hasSelection) {
            if (Array.isArray(hasSelection)) {
                isValid = hasSelection.length > 0;
            } else {
                isValid = hasSelection !== '' && hasSelection !== null;
            }
        }

        const shouldShowError = hasError && isTouched && isRequired;
        const shouldShowValid = !shouldShowError && isValid && isTouched && isRequired;

        return {
            shouldShowError,
            shouldShowValid,
            errorMessage: hasError,
            isRequired
        };
    };

    const getContainerClasses = (categoryName, isConfirmation = false) => {
        const { shouldShowError, shouldShowValid } = getValidationStyling(categoryName, isConfirmation);
        
        if (shouldShowError) {
            return 'border-2 border-red-400 bg-red-50 rounded-xl p-4 transition-all duration-200';
        }
        if (shouldShowValid) {
            return 'border-2 border-green-400 bg-green-50 rounded-xl p-4 transition-all duration-200';
        }
        return 'border-2 border-gray-200 bg-white rounded-xl p-4 transition-all duration-200';
    };

    const ValidationMessage = ({ categoryName, isConfirmation = false, isQuantity = false }) => {
        const errorKey = isQuantity ? `${categoryName}_quantity` : (isConfirmation ? `confirm_${categoryName}` : categoryName);
        const shouldShowError = categoryErrors[errorKey] && categoryTouched[errorKey];
        const errorMessage = categoryErrors[errorKey];
        
        if (shouldShowError) {
            return (
                <div className="mt-1.5 flex items-center">
                    <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
                </div>
            );
        }
        
        return null;
    };

    // Render special categories (like cot with quantity)
    const renderSpecialCategory = (categoryName, equipments) => {
        if (categoryName === 'cot') {
            const selection = categorySelections[categoryName];
            const quantity = equipmentMetaData[categoryName]?.quantity || 1;
            const { isRequired } = getValidationStyling(categoryName);
            
            return (
                <div key={categoryName} className="py-4">
                    <div className={getContainerClasses(categoryName)}>
                        <RadioField
                            disabled={props?.disabled}
                            options={[
                                { label: 'Yes', value: selection === 'yes' },
                                { label: 'No', value: selection === 'no' }
                            ]}
                            label="Do you need a cot, if so how many?"
                            required={isRequired}
                            error={getValidationStyling(categoryName).shouldShowError}
                            onChange={(label, updatedOptions) => {
                                handleRadioFieldChange(categoryName, label, updatedOptions);
                            }}
                        />
                        
                        {selection === 'yes' && (
                            <div className="mt-4">
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Number of cots needed:
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={quantity}
                                    disabled={props?.disabled}
                                    onChange={(e) => handleQuantityChange(categoryName, e.target.value)}
                                    className="block w-32 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                />
                            </div>
                        )}
                    </div>
                    {isRequired && <ValidationMessage categoryName={categoryName} />}
                    <ValidationMessage categoryName={categoryName} isQuantity={true} />
                </div>
            );
        }
        
        return null;
    };

    // Memoized equipment selection renderer
    const renderEquipmentSelection = useCallback((categoryName, equipments) => {
        const hasImages = equipments.some(eq => eq.image_url);
        const selection = categorySelections[categoryName];
        const categoryType = categoryTypes[categoryName];
        const isMultiSelect = categoryType === 'multi_select' || categoryType === 'confirmation_multi';
        const categoryDisplayName = formatCategoryName(categoryName);
        
        const isRequired = isRequiredCategory(categoryName, categoryType) || 
                        (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes');

        if (hasImages) {
            const cards = equipments.map(eq => ({
                value: eq.id,
                label: eq.name,
                description: eq.serial_number || 'No serial number',
                imageUrl: eq.image_url
            }));

            return (
                <div>
                    <div className="mb-4">
                        <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                            {categoryDisplayName}
                            {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    </div>
                    <HorizontalCardSelection
                        items={cards}
                        value={selection}
                        onChange={(value) => {
                            handleCategoryChange(categoryName, value);
                        }}
                        multi={isMultiSelect}
                        required={isRequired}
                        size="medium"
                    />
                </div>
            );
        } else {
            const options = equipments.map(eq => ({
                ...eq,
                label: eq.name,
                value: isMultiSelect ? 
                    (Array.isArray(selection) ? selection.includes(eq.id) : false) :
                    selection === eq.id
            }));

            if (isMultiSelect) {
                return (
                    <CheckBoxField
                        options={options}
                        label={categoryDisplayName}
                        required={isRequired}
                        disabled={props?.disabled}
                        onChange={(label, updatedOptions) => {
                            const selectedIds = updatedOptions.filter(opt => opt.value).map(opt => opt.id);
                            handleCategoryChange(categoryName, selectedIds);
                        }}
                    />
                );
            } else {
                return (
                    <RadioField
                        options={options}
                        label={categoryDisplayName}
                        required={isRequired}
                        disabled={props?.disabled}
                        onChange={(label, updatedOptions) => {
                            const selectedOption = updatedOptions.find(opt => opt.value);
                            handleCategoryChange(categoryName, selectedOption?.id || null);
                        }}
                    />
                );
            }
        }
    }, [categorySelections, categoryTypes, handleCategoryChange, props?.disabled]);

    const formatCategoryName = (categoryName) => {
        return categoryName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getBinaryQuestionLabel = (categoryName) => {
        const specialLabels = {
            'ceiling_hoist': 'Will you be using our ceiling hoist?',
            'slide_transfer_boards': 'Would you like to use a slide transfer board?',
            'wheelchair_chargers': 'Do you require a wheelchair charger for this stay?',
            'remote_room_openers': 'Do you need to be set up with a remote door opener (activated by a jelly bean switch) to access your room?',
            'bed_controllers': 'Do you need to be set up with an accessible bed controller (activated by a jelly bean switch) to operate your adjustable bed?'
        };
        return specialLabels[categoryName] || `Would you like to use ${formatCategoryName(categoryName)}?`;
    };

    const getConfirmationQuestionLabel = (categoryName) => {
        const specialLabels = {
            'shower_commodes': 'Would you like to book a shower commode?',
            'adaptive_bathroom_options': 'Would you like to use any of our adaptive bathroom options?'
        };
        return specialLabels[categoryName] || `Would you like to use ${formatCategoryName(categoryName)}?`;
    };

    const renderCategorySection = (categoryName, equipments) => {
        const categoryType = categoryTypes[categoryName];
        const selection = categorySelections[categoryName];
        const confirmationKey = `confirm_${categoryName}`;
        const confirmSelection = categorySelections[confirmationKey];

        // Handle special categories
        if (categoryType === 'special') {
            return renderSpecialCategory(categoryName, equipments);
        }

        // Handle binary categories (yes/no questions)
        if (categoryType === 'binary') {
            const { shouldShowError, isRequired } = getValidationStyling(categoryName);
            
            return (
                <div key={categoryName} className="py-4">
                    <div className={getContainerClasses(categoryName)}>
                        <RadioField
                            disabled={props?.disabled}
                            options={[
                                { label: 'Yes', value: selection === 'yes' },
                                { label: 'No', value: selection === 'no' }
                            ]}
                            label={getBinaryQuestionLabel(categoryName)}
                            required={isRequired}
                            error={shouldShowError}
                            onChange={(label, updatedOptions) => {
                                handleRadioFieldChange(categoryName, label, updatedOptions);
                            }}
                        />
                    </div>
                    {isRequired && <ValidationMessage categoryName={categoryName} />}
                </div>
            );
        }

        // Handle confirmation categories (both multi and single)
        if (categoryType === 'confirmation_multi' || categoryType === 'confirmation_single') {
            const { shouldShowError: confirmError, isRequired: confirmRequired } = getValidationStyling(categoryName, true);
            
            return (
                <div key={categoryName}>
                    <div className="py-4">
                        <div className={getContainerClasses(categoryName, true)}>
                            <RadioField
                                disabled={props?.disabled}
                                options={[
                                    { label: 'Yes', value: confirmSelection === 'yes' },
                                    { label: 'No', value: confirmSelection === 'no' }
                                ]}
                                label={getConfirmationQuestionLabel(categoryName)}
                                required={confirmRequired}
                                error={confirmError}
                                onChange={(label, updatedOptions) => {
                                    handleRadioFieldChange(categoryName, label, updatedOptions, true);
                                }}
                            />
                        </div>
                        {confirmRequired && <ValidationMessage categoryName={categoryName} isConfirmation={true} />}
                    </div>
                    
                    {confirmSelection === 'yes' && (
                        <div className="py-4">
                            <div className={getContainerClasses(categoryName)}>
                                {renderEquipmentSelection(categoryName, equipments)}
                            </div>
                            <ValidationMessage categoryName={categoryName} />
                        </div>
                    )}
                </div>
            );
        }

        // Handle direct equipment selection categories
        const { isRequired } = getValidationStyling(categoryName);
        
        return (
            <div key={categoryName} className="py-4">
                <div className={getContainerClasses(categoryName)}>
                    {renderEquipmentSelection(categoryName, equipments)}
                </div>
                {isRequired && <ValidationMessage categoryName={categoryName} />}
            </div>
        );
    };

    // Build ordered list of sections to render including conditional ones
    const buildOrderedSections = () => {
        const sections = [];
        
        const mainCategories = Object.entries(groupedEquipments)
            .filter(([categoryName, equipments]) => 
                categoryName && categoryName !== 'null' && 
                equipments.length > 0 && 
                categoryName !== 'sling'
            )
            .sort(([categoryNameA, equipmentsA], [categoryNameB, equipmentsB]) => {
                const orderA = equipmentsA[0]?.EquipmentCategory?.order || 0;
                const orderB = equipmentsB[0]?.EquipmentCategory?.order || 0;
                return orderA - orderB;
            });

        mainCategories.forEach(([categoryName, equipments]) => {
            sections.push({
                type: 'category',
                categoryName,
                equipments
            });

            if (categoryName === 'ceiling_hoist' && categorySelections['ceiling_hoist'] === 'yes' && groupedEquipments['sling']) {
                sections.push({
                    type: 'conditional_category',
                    categoryName: 'sling',
                    equipments: groupedEquipments['sling']
                });
            }

            if (categoryName === 'shower_commodes' && showTiltQuestion) {
                sections.push({
                    type: 'tilt_question'
                });
            }
        });

        return sections;
    };

    const renderTiltQuestion = () => {
        return (
            <div className="py-4">
                <div className={getContainerClasses('need_tilt_over_toilet')}>
                    <RadioField
                        disabled={props?.disabled}
                        options={[
                            { label: 'Yes', value: categorySelections['need_tilt_over_toilet'] === 'yes' },
                            { label: 'No', value: categorySelections['need_tilt_over_toilet'] === 'no' }
                        ]}
                        label="Do you need to tilt your commode over the toilet?"
                        required={true}
                        error={getValidationStyling('need_tilt_over_toilet').shouldShowError}
                        onChange={(label, updatedOptions) => {
                            setCategoryTouched(prev => ({ ...prev, 'need_tilt_over_toilet': true }));
                            const selectedOption = updatedOptions.find(opt => opt.value === true);
                            if (selectedOption) {
                                const newValue = selectedOption.label.toLowerCase();
                                setCategorySelections(prev => ({
                                    ...prev,
                                    'need_tilt_over_toilet': newValue
                                }));
                                setCategoryErrors(prev => {
                                    const newErrors = { ...prev };
                                    delete newErrors['need_tilt_over_toilet'];
                                    return newErrors;
                                });
                                handleTiltConfirmation(newValue);
                            }
                        }}
                    />
                </div>
                <ValidationMessage categoryName="need_tilt_over_toilet" />
            </div>
        );
    };

    if (!uuid) {
        return <p>loading...</p>;
    }

    if (!dataLoaded) {
        return <p>loading equipment data...</p>;
    }

    return (
        <div className={`mb-2 overflow-hidden ${props.className || ''}`}>
            {props.label && (
                <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>
            )}
            
            <div className="py-4">
                {buildOrderedSections().map((section, index) => {
                    if (section.type === 'category' || section.type === 'conditional_category') {
                        return renderCategorySection(section.categoryName, section.equipments);
                    } else if (section.type === 'tilt_question') {
                        return <div key="tilt_question">{renderTiltQuestion()}</div>;
                    }
                    return null;
                })}
            </div>

            {/* Acknowledgement checkbox for non-first-time guests */}
            {bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST && (
                <div className="py-4">
                    <div className={`flex ${categoryErrors['acknowledgement'] ? 'border-2 border-red-400 bg-red-50 rounded-xl p-4' : ''}`}>
                        <span className="text-xs text-red-500 ml-1 font-bold">*</span>
                        <CheckBox
                            bold={true}
                            label={'I verify all the information above is true and updated.'}
                            value={acknowledgementChecked}
                            checked={acknowledgementChecked}
                            required={true}
                            onChange={(label, value) => {
                                setAcknowledgementChecked(value);
                                if (value) {
                                    setCategoryErrors(prev => {
                                        const newErrors = { ...prev };
                                        delete newErrors['acknowledgement'];
                                        return newErrors;
                                    });
                                }
                                // Handle acknowledgement equipment change
                                const acknowledgementEq = equipments.find(equipment => 
                                    equipment.type === 'acknowledgement' && equipment.hidden
                                );
                                if (acknowledgementEq) {
                                    const change = {
                                        category: 'acknowledgement',
                                        equipments: [{ 
                                            ...acknowledgementEq, 
                                            label: acknowledgementEq.name,
                                            value: value 
                                        }],
                                        isDirty: true
                                    };
                                    setEquipmentChanges(prev => {
                                        const filtered = prev.filter(c => c.category !== 'acknowledgement');
                                        return [...filtered, change];
                                    });
                                }
                            }}
                        />
                    </div>
                    {categoryErrors['acknowledgement'] && (
                        <div className="mt-1.5 flex items-center">
                            <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-red-600 text-sm font-medium">{categoryErrors['acknowledgement']}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
});

EquipmentField.displayName = 'EquipmentField';

export default EquipmentField;