import { useEffect, useState } from "react";
import _ from "lodash";
import RadioField from "./radioField";
import CheckBoxField from "./checkboxField";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import CheckBox from "./checkbox";
import { BOOKING_TYPES } from "../constants";
import HorizontalCardSelection from "../ui-v2/HorizontalCardSelection";

const EquipmentField = (props) => {
    const bookingType = useSelector(state => state.bookingRequestForm.bookingType);
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

    const router = useRouter();
    const { uuid, prevBookingId } = router.query;

    useEffect(() => {
        if (uuid) {
            // Load both datasets before initializing
            Promise.all([
                fetchEquipments(),
                fetchCurrentBookingEquipments(uuid)
            ]).then(() => {
                setDataLoaded(true);
            });
        }
    }, [uuid]);

    useEffect(() => {
        if (props.equipmentChanges) {
            setEquipmentChanges(props.equipmentChanges);
        }
    }, [props.equipmentChanges]);

    useEffect(() => {
        // Only initialize when both datasets are loaded
        if (equipments.length > 0 && dataLoaded) {
            // Group equipment by category and determine category types dynamically
            const grouped = _.groupBy(equipments.filter(eq => !eq.hidden), 'EquipmentCategory.name');
            
            // Sort equipment within each category by order field
            Object.keys(grouped).forEach(categoryName => {
                grouped[categoryName] = grouped[categoryName].sort((a, b) => {
                    const orderA = a.order || 0;
                    const orderB = b.order || 0;
                    return orderA - orderB;
                });
            });
            
            setGroupedEquipments(grouped);
            
            // Determine category types based on equipment data
            const types = determineCategoryTypes(grouped);
            setCategoryTypes(types);
            
            // Initialize category selections based on current booking
            initializeCategorySelections(grouped, types);
        }
    }, [equipments, currentBookingEquipments, dataLoaded]);

    useEffect(() => {
        // Validate all selections and notify parent component
        if (Object.keys(groupedEquipments).length > 0) {
            validateSelections();
        }
    }, [categorySelections, acknowledgementChecked, groupedEquipments, showTiltQuestion]);

    const fetchEquipments = async () => {
        try {
            const res = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: true }));
            if (!res.ok) throw new Error('Failed to fetch equipments');
            const data = await res.json();
            setEquipments(data);
            console.log('Fetched equipments:', data);
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
            console.log('Fetched current booking equipments:', data);
            setCurrentBookingEquipments(data);
            return data;
        } catch (error) {
            console.error('Error fetching current booking equipments:', error);
            return [];
        }
    };

    const determineCategoryTypes = (grouped) => {
        const types = {};
        
        Object.entries(grouped).forEach(([categoryName, categoryEquipments]) => {
            // Filter out null/invalid categories
            if (!categoryName || categoryName === 'null') return;
            
            // Determine category type based on equipment data
            const hasGroupType = categoryEquipments.some(eq => eq.type === 'group');
            const equipmentCount = categoryEquipments.length;
            
            // Force specific categories to be single_select (radio buttons)
            if (categoryName === 'mattress_options' || categoryName === 'sling' || categoryName === 'shower_commodes') {
                types[categoryName] = 'single_select';
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
        
        console.log('Determined category types:', types);
        return types;
    };

    const initializeCategorySelections = (grouped, types) => {
        const selections = {};
        
        console.log('Initializing selections with:', { grouped, currentBookingEquipments, types });

        Object.entries(grouped).forEach(([categoryName, categoryEquipments]) => {
            if (!categoryName || categoryName === 'null') return;
            
            const categoryType = types[categoryName];

            if (categoryType === 'binary') {
                // Binary categories: Check if any equipment in this category exists in current booking
                const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                    ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                );
                selections[categoryName] = hasEquipmentInCategory ? 'yes' : 'no';
                console.log(`Binary category ${categoryName}:`, { hasEquipmentInCategory, selection: selections[categoryName] });
                
            } else if (categoryType === 'confirmation_multi') {
                // Confirmation categories: Set both confirmation and actual selections
                const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                    ce.EquipmentCategory && ce.EquipmentCategory.name === categoryName
                );
                selections[`confirm_${categoryName}`] = hasEquipmentInCategory ? 'yes' : 'no';
                
                // Multi-select: get all selected equipment IDs
                selections[categoryName] = categoryEquipments
                    .filter(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name))
                    .map(equipment => equipment.id);
                    
                console.log(`Confirmation multi category ${categoryName}:`, { 
                    hasEquipmentInCategory, 
                    confirmSelection: selections[`confirm_${categoryName}`],
                    actualSelection: selections[categoryName]
                });
                
            } else if (categoryType === 'multi_select') {
                // Multi-select categories: get all selected equipment IDs
                selections[categoryName] = categoryEquipments
                    .filter(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name))
                    .map(equipment => equipment.id);
                console.log(`Multi-select category ${categoryName}:`, { selection: selections[categoryName] });
                
            } else if (categoryType === 'single_select') {
                // Single-select categories: get the first selected equipment ID
                const selectedEquipment = categoryEquipments
                    .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
                selections[categoryName] = selectedEquipment ? selectedEquipment.id : null;
                console.log(`Single-select category ${categoryName}:`, { selectedEquipment, selection: selections[categoryName] });
            }
        });

        // Handle special ceiling hoist sling logic (if it exists)
        if (grouped['ceiling_hoist'] && grouped['sling'] && selections['ceiling_hoist'] === 'yes') {
            // Sling is now single-select, so get the first selected sling
            const selectedSling = grouped['sling']
                .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
            selections['sling'] = selectedSling ? selectedSling.id : null;
        } else if (grouped['sling']) {
            selections['sling'] = null;
        }

        // Handle tilt question logic (if shower_commodes exists)
        if (selections['shower_commodes']) {
            // Since shower_commodes is now single-select, get the selected commode
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
        if (bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST) {
            const hasAcknowledgement = currentBookingEquipments.some(ce => 
                ce.type === 'acknowledgement' && ce.hidden
            );
            setAcknowledgementChecked(hasAcknowledgement);
        }

        console.log('Final selections:', selections);
        setCategorySelections(selections);
    };

    const validateSelections = () => {
        const categories = Object.keys(groupedEquipments);
        let allValid = true;
        const errors = {};

        categories.forEach(categoryName => {
            if (!categoryName || categoryName === 'null') return;
            
            const categoryType = categoryTypes[categoryName];
            const isRequired = isRequiredCategory(categoryName, categoryType);
            
            if (isRequired) {
                if (categoryType === 'binary') {
                    if (!categorySelections[categoryName]) {
                        errors[categoryName] = `Please select an option for ${getBinaryQuestionLabel(categoryName)}`;
                        allValid = false;
                    }
                } else if (categoryType === 'confirmation_multi') {
                    const confirmationKey = `confirm_${categoryName}`;
                    const confirmSelection = categorySelections[confirmationKey];
                    
                    if (!confirmSelection) {
                        errors[confirmationKey] = `Please select an option for ${getConfirmationQuestionLabel(categoryName)}`;
                        allValid = false;
                    }
                    
                    if (confirmSelection === 'yes' && (!categorySelections[categoryName] || 
                        (Array.isArray(categorySelections[categoryName]) && categorySelections[categoryName].length === 0))) {
                        errors[categoryName] = `Please select at least one option from ${formatCategoryName(categoryName)}`;
                        allValid = false;
                    }
                } else if (categoryType === 'single_select') {
                    if (!categorySelections[categoryName]) {
                        const fieldName = categoryName === 'mattress_options' ? 'Mattress Options' :
                                        categoryName === 'shower_commodes' ? 'Shower Commodes' :
                                        categoryName === 'sling' ? 'Sling' :
                                        formatCategoryName(categoryName);
                        errors[categoryName] = `Please select a ${fieldName}`;
                        allValid = false;
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

        // Only show errors for fields that have been touched (for UI)
        const touchedErrors = {};
        Object.keys(errors).forEach(key => {
            if (categoryTouched[key]) {
                touchedErrors[key] = errors[key];
            }
        });
        
        setCategoryErrors(touchedErrors);
        
        // Always notify parent about overall validity (regardless of touch state)
        if (props.hasOwnProperty('onChange')) {
            if (allValid) {
                props.onChange(true, equipmentChanges);
            } else {
                props.onChange(false);
            }
        }
    };

    const isRequiredCategory = (categoryName, categoryType) => {
        // Define which categories are required
        const alwaysRequired = ['mattress_options', 'shower_commodes'];
        const requiredMultiSelect = ['adaptive_bathroom_options'];
        const conditionallyRequired = {
            'sling': () => categorySelections['ceiling_hoist'] === 'yes'
        };
        const optionalCategories = ['transfer_aids', 'miscellaneous'];
        
        if (alwaysRequired.includes(categoryName)) return true;
        if (conditionallyRequired[categoryName]) return conditionallyRequired[categoryName]();
        if (optionalCategories.includes(categoryName)) return false;
        if (requiredMultiSelect.includes(categoryName)) return true;
        
        // Binary and single_select categories are required by default
        return categoryType === 'binary' || categoryType === 'single_select';
    };

    const handleCategoryChange = (categoryName, value, isConfirmation = false) => {
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
            return newErrors;
        });
        
        setCategorySelections(prev => {
            const newSelections = { ...prev, [key]: value };
            
            // Handle special logic for ceiling hoist
            if (categoryName === 'ceiling_hoist' && value === 'no') {
                newSelections['sling'] = null; // Single value for single-select
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors['sling'];
                    return newErrors;
                });
            }
            
            // Handle confirmation "No" selections
            if (isConfirmation && value === 'no') {
                newSelections[categoryName] = categoryType === 'confirmation_multi' ? [] : null;
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors[categoryName];
                    return newErrors;
                });
            }

            // Check if High Back Tilt commode is selected (if this category exists)
            if (categoryName === 'shower_commodes' && !isConfirmation) {
                // Since shower_commodes is now single-select, get the selected equipment
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

        // Handle equipment changes
        if (categoryName === 'ceiling_hoist' && value === 'no') {
            handleMultipleEquipmentChanges([
                { category: 'ceiling_hoist', value: 'no' },
                { category: 'sling', value: null } // Single value for single-select
            ]);
        } else if (isConfirmation && value === 'no') {
            const nestedValue = categoryType === 'confirmation_multi' ? [] : null;
            updateEquipmentChanges(categoryName, nestedValue, false);
        } else {
            updateEquipmentChanges(categoryName, value, isConfirmation);
        }
    };

    const handleRadioFieldChange = (categoryName, label, updatedOptions, isConfirmation = false) => {
        const selectedOption = updatedOptions.find(opt => opt.value === true);
        if (selectedOption) {
            handleCategoryChange(categoryName, selectedOption.label.toLowerCase(), isConfirmation);
        }
    };

    const updateEquipmentChanges = (categoryName, value, isConfirmation = false) => {
        if (!isConfirmation) {
            const categoryEquipments = groupedEquipments[categoryName] || [];
            const categoryType = categoryTypes[categoryName];
            let selectedEquipments = [];
            const previousSelectedEquipments = currentBookingEquipments.filter(equipment => 
                equipment?.EquipmentCategory?.name === categoryName && !equipment?.hidden
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
            } else if (categoryType === 'multi_select' || categoryType === 'confirmation_multi') {
                if (Array.isArray(value)) {
                    selectedEquipments = categoryEquipments
                        .filter(eq => value.includes(eq.id))
                        .map(eq => ({ 
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
            } else if (categoryType === 'single_select') {
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
                return [...filtered, change].filter(c => c.equipments.length > 0);
            });
        }
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

    const handleTiltConfirmation = (value) => {
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
    };

    const getValidationStyling = (categoryName, isConfirmation = false) => {
        const key = isConfirmation ? `confirm_${categoryName}` : categoryName;
        const hasError = categoryErrors[key];
        const isTouched = categoryTouched[key];
        const hasSelection = categorySelections[key];
        const categoryType = categoryTypes[categoryName];
        
        const isRequired = isRequiredCategory(categoryName, categoryType) ||
                          (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes') ||
                          (isConfirmation && categoryType === 'confirmation_multi') ||
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

    const ValidationMessage = ({ categoryName, isConfirmation = false }) => {
        const { shouldShowError, errorMessage } = getValidationStyling(categoryName, isConfirmation);
        
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

    const renderCategorySection = (categoryName, equipments) => {
        const categoryType = categoryTypes[categoryName];
        const categoryDisplayName = formatCategoryName(categoryName);
        const selection = categorySelections[categoryName];
        const confirmationKey = `confirm_${categoryName}`;
        const confirmSelection = categorySelections[confirmationKey];

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

        // Handle confirmation categories
        if (categoryType === 'confirmation_multi') {
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

    const renderEquipmentSelection = (categoryName, equipments) => {
        const hasImages = equipments.some(eq => eq.image_url);
        const selection = categorySelections[categoryName];
        const categoryType = categoryTypes[categoryName];
        const isMultiSelect = categoryType === 'multi_select' || categoryType === 'confirmation_multi';
        const categoryDisplayName = formatCategoryName(categoryName);
        
        const isRequired = isRequiredCategory(categoryName, categoryType) || 
                          (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes');

        if (hasImages) {
            // Equipment is already sorted by order from the grouped data
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
                        onChange={(value) => handleCategoryChange(categoryName, value)}
                        multi={isMultiSelect}
                        required={isRequired}
                        size="medium"
                    />
                </div>
            );
        } else {
            // Use existing radio/checkbox fields for equipment without images
            // Equipment is already sorted by order from the grouped data
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
    };

    const formatCategoryName = (categoryName) => {
        return categoryName
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    };

    const getBinaryQuestionLabel = (categoryName) => {
        // Generate question labels dynamically or use default patterns
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
            'shower_commodes': 'Would you like to use one of our self-propelled or attendant-propelled Shower Commodes?',
            'adaptive_bathroom_options': 'Would you like to use any of our adaptive bathroom options?'
        };
        return specialLabels[categoryName] || `Would you like to use ${formatCategoryName(categoryName)}?`;
    };

    // NEW FUNCTION: Build ordered list of sections to render including conditional ones
    const buildOrderedSections = () => {
        const sections = [];
        
        // Get sorted main categories (excluding sling as it's handled conditionally)
        const mainCategories = Object.entries(groupedEquipments)
            .filter(([categoryName, equipments]) => 
                categoryName && categoryName !== 'null' && 
                equipments.length > 0 && 
                categoryName !== 'sling' // Sling is handled conditionally
            )
            .sort(([categoryNameA, equipmentsA], [categoryNameB, equipmentsB]) => {
                // Sort categories by their order field
                const orderA = equipmentsA[0]?.EquipmentCategory?.order || 0;
                const orderB = equipmentsB[0]?.EquipmentCategory?.order || 0;
                return orderA - orderB;
            });

        mainCategories.forEach(([categoryName, equipments]) => {
            // Add the main category
            sections.push({
                type: 'category',
                categoryName,
                equipments
            });

            // Check for conditional categories that should appear after this one
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
                {/* Render sections in order, including conditional ones inline */}
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
};

export default EquipmentField;