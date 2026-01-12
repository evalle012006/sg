import { useEffect, useState, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { flushSync } from 'react-dom';
import _ from "lodash";
import RadioField from "./radioField";
import CheckBoxField from "./checkboxField";
import { useRouter } from "next/router";
import { useSelector } from "react-redux";
import CheckBox from "./checkbox";
import { BOOKING_TYPES } from "../constants";
import HorizontalCardSelection from "../ui-v2/HorizontalCardSelection";
import ImageModal from "../ui-v2/ImageModal";
import { getDefaultImage } from "../../lib/defaultImages";

const EquipmentField = forwardRef((props, ref) => {
    const { forceShowErrors = false } = props;
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

    // User interaction and selection protection states
    const [lastUserInteractionTime, setLastUserInteractionTime] = useState(0);
    const [protectedSelections, setProtectedSelections] = useState(new Set());
    const [propsLastSynced, setPropsLastSynced] = useState(null);

    // State to track if validation has been force-triggered via ref
    const [validationForced, setValidationForced] = useState(false);

    // Optimization refs
    const updateTimeoutRef = useRef({});
    const mountedRef = useRef(true);
    const lastValidationRef = useRef(null);
    const prefilledNotifiedRef = useRef(false);
    const userModificationsRef = useRef(new Set());
    const lastValidSelectionRef = useRef({});
    const userInteractionTimeoutRef = useRef(null);
    const initializationCompleteRef = useRef(false);

    const router = useRouter();
    const { uuid, prevBookingId } = router.query;

    const [imageModalOpen, setImageModalOpen] = useState(false);
    const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            mountedRef.current = false;
            Object.values(updateTimeoutRef.current).forEach(timeout => {
                if (timeout) clearTimeout(timeout);
            });
            if (userInteractionTimeoutRef.current) {
                clearTimeout(userInteractionTimeoutRef.current);
            }
        };
    }, []);

    // Helper functions that need to be defined before useImperativeHandle
    const getEquipmentKey = (equipmentName) => {
        if (equipmentName === 'High Chair') return 'high_chair';
        if (equipmentName === 'Portable Cot') return 'cot';
        return null;
    };

    const getQuestionKey = (equipmentName) => {
        if (equipmentName === 'High Chair') return 'do-you-need-a-high-chair-if-so-how-many';
        if (equipmentName === 'Portable Cot') return 'do-you-need-a-cot-if-so-how-many';
        return null;
    };

    const isRequiredCategory = (categoryName, categoryType) => {
        const alwaysRequired = ['mattress_options', 'shower_commodes'];
        const requiredMultiSelect = [];
        const conditionallyRequired = {
            'sling': () => categorySelections['ceiling_hoist'] === 'yes'
        };
        const optionalCategories = ['transfer_aids', 'miscellaneous', 'infant_care', 'adaptive_bathroom_options'];
        
        if (alwaysRequired.includes(categoryName)) return true;
        if (conditionallyRequired[categoryName]) return conditionallyRequired[categoryName]();
        if (optionalCategories.includes(categoryName)) return false;
        if (requiredMultiSelect.includes(categoryName)) return true;
        
        return categoryType === 'binary' || categoryType === 'single_select';
    };

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
            'shower_commodes': 'Would you like to book a shower commode?'
        };
        return specialLabels[categoryName] || `Would you like to use ${formatCategoryName(categoryName)}?`;
    };

    // Validation function that accepts touched state as parameter
    const runValidationWithTouched = useCallback((touchedState) => {
        const categories = Object.keys(groupedEquipments);
        let allValid = true;
        const errors = {};

        console.log('📋 Running equipment validation with touched state');

        categories.forEach(categoryName => {
            if (!categoryName || categoryName === 'null') return;
            
            const categoryType = categoryTypes[categoryName];
            const isRequired = isRequiredCategory(categoryName, categoryType);
            const hasUserInteraction = touchedState[categoryName] || touchedState[`confirm_${categoryName}`];
            
            if (!hasUserInteraction && !isRequired) {
                return;
            }
            
            if (categoryType === 'special') {
                // Handle special category validation
                if (categoryName === 'infant_care') {
                    // infant_care is optional, no validation needed
                }
            } else if (categoryType === 'binary') {
                if (!categorySelections[categoryName] && isRequired && hasUserInteraction) {
                    errors[categoryName] = `Please select an option for ${getBinaryQuestionLabel(categoryName)}`;
                    allValid = false;
                }
            } else if (categoryType === 'confirmation_multi' || categoryType === 'confirmation_single') {
                const confirmationKey = `confirm_${categoryName}`;
                const confirmSelection = categorySelections[confirmationKey];
                const confirmInteracted = touchedState[confirmationKey];
                
                if (!confirmSelection && confirmInteracted && isRequired) {
                    errors[confirmationKey] = `Please select an option for ${getConfirmationQuestionLabel(categoryName)}`;
                    allValid = false;
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
                if (!categorySelections[categoryName] && isRequired && hasUserInteraction) {
                    const fieldName = categoryName === 'mattress_options' ? 'Mattress Options' :
                                    categoryName === 'sling' ? 'Sling' :
                                    formatCategoryName(categoryName);
                    errors[categoryName] = `Please select a ${fieldName}`;
                    allValid = false;
                }
            } else if (categoryType === 'multi_select') {
                if (isRequired && hasUserInteraction && 
                    (!categorySelections[categoryName] || 
                    (Array.isArray(categorySelections[categoryName]) && categorySelections[categoryName].length === 0))) {
                    errors[categoryName] = `Please select at least one option from ${formatCategoryName(categoryName)}`;
                    allValid = false;
                }
            }
        });
        
        // Sling validation when ceiling hoist is yes
        if (categorySelections['ceiling_hoist'] === 'yes' && !categorySelections['sling'] && touchedState['sling']) {
            errors['sling'] = 'Please select a sling option when using ceiling hoist';
            allValid = false;
        }

        // Tilt question validation
        if (showTiltQuestion && touchedState['need_tilt_over_toilet'] && !categorySelections['need_tilt_over_toilet']) {
            errors['need_tilt_over_toilet'] = 'Please select an option for tilt commode question';
            allValid = false;
        }

        // Acknowledgement for returning guests
        if (bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST && !acknowledgementChecked && touchedState['acknowledgement']) {
            errors['acknowledgement'] = 'Please acknowledge that the information is true and updated';
            allValid = false;
        }

        console.log('📋 Validation result:', allValid ? '✅ Valid' : '❌ Invalid', 'Errors:', Object.keys(errors));
        
        return { allValid, errors };
    }, [groupedEquipments, categoryTypes, categorySelections, acknowledgementChecked, showTiltQuestion, bookingType]);

    // CRITICAL: Expose validate method via ref for parent components
    useImperativeHandle(ref, () => ({
        validate: () => {
            console.log('🔧 EquipmentField.validate() called via ref');
            
            // Build touched updates for all required fields
            const touchedUpdates = {};
            
            Object.keys(groupedEquipments).forEach(categoryName => {
                if (!categoryName || categoryName === 'null') return;
                
                const categoryType = categoryTypes[categoryName];
                const isRequired = isRequiredCategory(categoryName, categoryType);
                
                if (isRequired) {
                    touchedUpdates[categoryName] = true;
                    touchedUpdates[`confirm_${categoryName}`] = true;
                }
                
                if (categoryType === 'special' && categoryName === 'infant_care') {
                    const categoryEquipments = groupedEquipments[categoryName] || [];
                    categoryEquipments.forEach(equipment => {
                        const equipmentKey = getEquipmentKey(equipment.name);
                        if (equipmentKey) {
                            touchedUpdates[`${equipmentKey}_quantity`] = true;
                        }
                    });
                }
            });
            
            if (bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST) {
                touchedUpdates['acknowledgement'] = true;
            }
            
            if (showTiltQuestion) {
                touchedUpdates['need_tilt_over_toilet'] = true;
            }
            
            if (categorySelections['ceiling_hoist'] === 'yes') {
                touchedUpdates['sling'] = true;
            }

            console.log('🔧 Marking as touched:', Object.keys(touchedUpdates));

            // Run validation with the new touched state
            const mergedTouched = { ...categoryTouched, ...touchedUpdates };
            const result = runValidationWithTouched(mergedTouched);
            
            // CRITICAL: Use flushSync to force synchronous state updates
            // This ensures the UI updates BEFORE we return the validation result
            flushSync(() => {
                setCategoryTouched(mergedTouched);
                setCategoryErrors(result.errors);
                setValidationForced(true);
            });
            
            // Notify parent
            if (props.hasOwnProperty('onChange')) {
                props.onChange(result.allValid, equipmentChanges);
            }
            
            return result;
        }
    }));

    // Original validateSelections for normal use (called during user interactions)
    const validateSelections = useCallback(() => {
        return runValidationWithTouched(categoryTouched);
    }, [runValidationWithTouched, categoryTouched]);

    // Controlled props sync that doesn't override user selections
    useEffect(() => {
        const timeSinceLastInteraction = Date.now() - lastUserInteractionTime;
        const propsString = JSON.stringify(props.equipmentChanges);
        
        if (props.equipmentChanges && 
            propsString !== JSON.stringify(equipmentChanges) && 
            propsString !== propsLastSynced &&
            timeSinceLastInteraction > 2000) {
            
            setEquipmentChanges(props.equipmentChanges);
            setPropsLastSynced(propsString);
        }
    }, [props.equipmentChanges, lastUserInteractionTime, equipmentChanges]);

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

    // Function to mark user interaction
    const markUserInteraction = useCallback(() => {
        setLastUserInteractionTime(Date.now());
        
        if (userInteractionTimeoutRef.current) {
            clearTimeout(userInteractionTimeoutRef.current);
        }
        
        userInteractionTimeoutRef.current = setTimeout(() => {
            console.log('✅ User interaction period ended, allowing automatic updates');
        }, 2000);
    }, []);

    // Function to protect a user selection from being overridden
    const protectUserSelection = useCallback((categoryName, value) => {
        setProtectedSelections(prev => new Set([...prev, categoryName]));
        lastValidSelectionRef.current[categoryName] = value;
        
        setTimeout(() => {
            setProtectedSelections(prev => {
                const newSet = new Set(prev);
                newSet.delete(categoryName);
                return newSet;
            });
        }, 5000);
    }, []);

    // Debounced validation
    const debouncedValidation = useCallback(() => {
        if (updateTimeoutRef.current.validation) {
            clearTimeout(updateTimeoutRef.current.validation);
        }

        updateTimeoutRef.current.validation = setTimeout(() => {
            if (!mountedRef.current) return;
            
            const timeSinceLastInteraction = Date.now() - lastUserInteractionTime;
            if (timeSinceLastInteraction < 1000) {
                return;
            }
            
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
        }, 300);
    }, [categorySelections, acknowledgementChecked, showTiltQuestion, equipmentChanges, equipmentMetaData, props, lastUserInteractionTime, validateSelections]);

    // Initialize category selections
    useEffect(() => {
        if (equipments.length > 0 && dataLoaded && !initializationCompleteRef.current) {
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
            
            initializationCompleteRef.current = true;
        }
    }, [equipments, currentBookingEquipments, dataLoaded, props.infantCareQuantities]);

    // Controlled useEffect that doesn't interfere with user selections
    useEffect(() => {
        if (Object.keys(groupedEquipments).length > 0 && Object.keys(categorySelections).length > 0) {
            const timeSinceLastInteraction = Date.now() - lastUserInteractionTime;
            if (timeSinceLastInteraction > 500) {
                debouncedValidation();
            }
        }
    }, [groupedEquipments, showTiltQuestion, equipmentMetaData, debouncedValidation]);

    useEffect(() => {
        if (!prefilledNotifiedRef.current && 
            Object.keys(groupedEquipments).length > 0 && 
            groupedEquipments['infant_care']) {
            
            const hasAnyUserModifications = groupedEquipments['infant_care'].some(equipment => {
                const equipmentKey = getEquipmentKey(equipment.name);
                return equipmentKey && userModificationsRef.current.has(equipmentKey);
            });
            
            if (hasAnyUserModifications) {
                prefilledNotifiedRef.current = true;
                return;
            }
            
            const hasInfantCareData = groupedEquipments['infant_care'].some(equipment => {
                const equipmentKey = getEquipmentKey(equipment.name);
                return equipmentKey && props.infantCareQuantities?.[getQuestionKey(equipment.name)] !== undefined;
            });

            if (hasInfantCareData) {
                prefilledNotifiedRef.current = true;
                
                const equipmentChangesToAdd = [];
                
                groupedEquipments['infant_care'].forEach(equipment => {
                    const equipmentKey = getEquipmentKey(equipment.name);
                    if (equipmentKey) {
                        const questionKey = getQuestionKey(equipment.name);
                        const formQuantity = getQuantityFromInfantCareData(questionKey);
                        
                        if (formQuantity > 0) {
                            equipmentChangesToAdd.push({
                                ...equipment,
                                label: equipment.name,
                                value: true,
                                meta_data: { 
                                    quantity: formQuantity,
                                    source: 'prefilled',
                                    lastModified: Date.now()
                                }
                            });
                        }
                    }
                });
                
                if (equipmentChangesToAdd.length > 0) {
                    const infantCareChange = {
                        category: 'infant_care',
                        equipments: equipmentChangesToAdd,
                        isDirty: true,
                        lastUpdated: Date.now()
                    };
                    
                    setEquipmentChanges(prev => {
                        const filtered = prev.filter(c => c.category !== 'infant_care');
                        const newChanges = [...filtered, infantCareChange];
                        
                        setTimeout(() => {
                            if (mountedRef.current && props.hasOwnProperty('onChange')) {
                                const validationResult = validateSelections();
                                props.onChange(validationResult.allValid, newChanges);
                            }
                        }, 100);
                        
                        return newChanges;
                    });
                } else {
                    setTimeout(() => {
                        if (mountedRef.current && props.hasOwnProperty('onChange')) {
                            const validationResult = validateSelections();
                            props.onChange(validationResult.allValid, equipmentChanges);
                        }
                    }, 100);
                }
            }
        }
    }, [groupedEquipments, props.infantCareQuantities, validateSelections, equipmentChanges, props]);

    useEffect(() => {
        if (userModificationsRef.current.size > 0) {
            setEquipmentMetaData(prev => {
                const updated = { ...prev };
                userModificationsRef.current.forEach(equipmentKey => {
                    if (updated[equipmentKey] && !updated[equipmentKey].userModified) {
                        updated[equipmentKey] = {
                            ...updated[equipmentKey],
                            userModified: true,
                            source: 'user_input'
                        };
                    }
                });
                return updated;
            });
        }
    }, [groupedEquipments]);

    useEffect(() => {
        const currentSelectionsString = JSON.stringify(categorySelections);
        const lastSelectionsString = JSON.stringify(lastValidSelectionRef.current);
        
        if (currentSelectionsString !== lastSelectionsString && Object.keys(categorySelections).length > 0) {
            protectedSelections.forEach(protectedCategory => {
                const currentValue = categorySelections[protectedCategory];
                const lastValue = lastValidSelectionRef.current[protectedCategory];
                
                if (currentValue !== lastValue && lastValue !== undefined) {
                    setCategorySelections(prev => ({
                        ...prev,
                        [protectedCategory]: lastValue
                    }));
                }
            });
        }
    }, [categorySelections, protectedSelections]);

    const fetchEquipments = async () => {
        try {
            const res = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: true }));
            if (!res.ok) throw new Error('Failed to fetch equipments');
            const data = await res.json();
            const activeEquipments = data.filter(equipment => 
                // Keep active equipment OR hidden acknowledgement equipment
                (equipment.status === 'Active' || equipment.status === 'active') ||
                (equipment.type === 'acknowledgement' && equipment.hidden)
            );
            setEquipments(activeEquipments);
            return activeEquipments;
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
            setCurrentBookingEquipments(data);
            return data;
        } catch (error) {
            console.error('Error fetching current booking equipments:', error);
            return [];
        }
    };

    const getQuantityFromInfantCareData = (questionKey) => {
        if (!props.infantCareQuantities || typeof props.infantCareQuantities !== 'object') return 0;
        const quantity = props.infantCareQuantities[questionKey];
        return parseInt(quantity) || 0;
    };

    const hasSpecialHandling = (categoryName) => {
        const specialCategories = ['infant_care'];
        return specialCategories.includes(categoryName);
    };

    const determineCategoryTypes = (grouped) => {
        const types = {};
        
        Object.entries(grouped).forEach(([categoryName, categoryEquipments]) => {
            if (!categoryName || categoryName === 'null') return;
            
            if (hasSpecialHandling(categoryName)) {
                types[categoryName] = 'special';
                return;
            }
            
            const hasGroupType = categoryEquipments.some(eq => eq.type === 'group');
            const equipmentCount = categoryEquipments.length;
            
            if (categoryName === 'mattress_options' || categoryName === 'sling') {
                types[categoryName] = 'single_select';
                return;
            }
            
            if (categoryName === 'shower_commodes') {
                types[categoryName] = 'confirmation_single';
                return;
            }
            
            if (categoryName === 'adaptive_bathroom_options') {
                types[categoryName] = 'multi_select';
                return;
            }
            
            if (equipmentCount === 1 && !hasGroupType) {
                types[categoryName] = 'binary';
            } else if (hasGroupType || equipmentCount > 1) {
                const needsConfirmation = false;
                
                if (needsConfirmation) {
                    types[categoryName] = 'confirmation_multi';
                } else {
                    types[categoryName] = 'multi_select';
                }
            } else if (equipmentCount > 1) {
                types[categoryName] = 'single_select';
            } else {
                types[categoryName] = 'single_select';
            }
            
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

            if (categoryType === 'special') {
                if (categoryName === 'infant_care') {
                    categoryEquipments.forEach(equipment => {
                        const equipmentKey = getEquipmentKey(equipment.name);
                        
                        if (equipmentKey) {
                            const isUserModified = userModificationsRef.current.has(equipmentKey);
                            
                            if (isUserModified) {
                                const existing = equipmentMetaData[equipmentKey];
                                if (existing) {
                                    metaData[equipmentKey] = existing;
                                }
                                return;
                            }
                            
                            const hasEquipmentInCategory = currentBookingEquipments.some(ce => 
                                ce.id === equipment.id
                            );
                            
                            if (hasEquipmentInCategory) {
                                const existingBooking = currentBookingEquipments.find(ce => 
                                    ce.id === equipment.id
                                );
                                
                                if (existingBooking?.BookingEquipment?.meta_data?.quantity) {
                                    metaData[equipmentKey] = { 
                                        quantity: existingBooking.BookingEquipment.meta_data.quantity,
                                        source: 'saved'
                                    };
                                } else {
                                    metaData[equipmentKey] = { quantity: 0, source: 'default' };
                                }
                            } else {
                                const questionKey = getQuestionKey(equipment.name);
                                const formQuantity = getQuantityFromInfantCareData(questionKey);
                                
                                metaData[equipmentKey] = { 
                                    quantity: formQuantity,
                                    source: 'prefilled'
                                };
                            }
                        }
                    });
                    
                    setTimeout(() => {
                        if (mountedRef.current && Object.keys(metaData).length > 0) {
                            createInitialInfantCareEquipmentChanges(categoryEquipments, metaData);
                        }
                    }, 50);
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

        if (currentBookingEquipments.length > 0 && grouped['ceiling_hoist'] && grouped['sling'] && selections['ceiling_hoist'] === 'yes') {
            const selectedSling = grouped['sling']
                .find(equipment => currentBookingEquipments.some(ce => ce.name === equipment.name));
            selections['sling'] = selectedSling ? selectedSling.id : null;
        } else if (grouped['sling']) {
            selections['sling'] = null;
        }

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

        if (currentBookingEquipments.length > 0 && bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST) {
            const hasAcknowledgement = currentBookingEquipments.some(ce => 
                ce.type === 'acknowledgement' && ce.hidden
            );
            setAcknowledgementChecked(hasAcknowledgement);
        }

        setCategorySelections(selections);
        setEquipmentMetaData(prev => {
            const updated = { ...prev };
            Object.entries(metaData).forEach(([key, value]) => {
                if (!userModificationsRef.current.has(key)) {
                    updated[key] = value;
                }
            });
            return updated;
        });
    };

    // handleCategoryChange with validationForced clearing
    const handleCategoryChange = useCallback((categoryName, value, isConfirmation = false) => {
        const key = isConfirmation ? `confirm_${categoryName}` : categoryName;
        const categoryType = categoryTypes[categoryName];
        
        // Clear forced validation state when user starts interacting
        if (validationForced) {
            setValidationForced(false);
        }
        
        markUserInteraction();
        protectUserSelection(categoryName, value);
        
        setCategoryTouched(prev => ({
            ...prev,
            [key]: true
        }));

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
            
            if (categoryName === 'ceiling_hoist' && value === 'no') {
                newSelections['sling'] = null;
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors['sling'];
                    return newErrors;
                });
            }
            
            if (isConfirmation && value === 'no') {
                newSelections[categoryName] = (categoryType === 'confirmation_multi') ? [] : null;
                setCategoryErrors(prevErrors => {
                    const newErrors = { ...prevErrors };
                    delete newErrors[categoryName];
                    return newErrors;
                });
            }

            if (categoryType === 'special' && categoryName === 'infant_care') {
                const equipmentKey = key;
                if (value === 'no') {
                    setEquipmentMetaData(prev => ({
                        ...prev,
                        [equipmentKey]: { quantity: 1 }
                    }));
                }
            }

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

        setTimeout(() => {
            if (categoryName === 'ceiling_hoist' && value === 'no') {
                handleMultipleEquipmentChanges([
                    { category: 'ceiling_hoist', value: 'no' },
                    { category: 'sling', value: null }
                ]);
            } else if (isConfirmation && value === 'no') {
                const nestedValue = (categoryType === 'confirmation_multi') ? [] : null;
                updateEquipmentChanges(categoryName, nestedValue, false);
            } else {
                if (categoryType === 'special') {
                    updateEquipmentChangesWithMetaData(categoryName, value, isConfirmation, null);
                } else {
                    updateEquipmentChanges(categoryName, value, isConfirmation);
                }
            }
        }, 100);

    }, [categoryTypes, groupedEquipments, markUserInteraction, protectUserSelection, validationForced]);

    const handleDirectQuantityChange = useCallback((equipmentKey, equipmentName, value) => {
        const parsedQuantity = parseInt(value) || 0;
        
        markUserInteraction();
        
        userModificationsRef.current.add(equipmentKey);
        
        // Clear forced validation when user interacts
        if (validationForced) {
            setValidationForced(false);
        }
        
        setCategoryTouched(prev => ({
            ...prev,
            [`${equipmentKey}_quantity`]: true
        }));

        setCategoryErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[`${equipmentKey}_quantity`];
            return newErrors;
        });

        setEquipmentMetaData(prev => ({
            ...prev,
            [equipmentKey]: { 
                quantity: parsedQuantity,
                userModified: true,
                lastModified: Date.now(),
                source: 'user_input'
            }
        }));

        const equipment = groupedEquipments['infant_care']?.find(eq => eq.name === equipmentName);
        if (equipment && props.hasOwnProperty('onChange')) {
            const equipmentChange = {
                category: 'infant_care',
                equipments: [{
                    ...equipment,
                    label: equipment.name,
                    value: parsedQuantity > 0,
                    meta_data: { 
                        quantity: parsedQuantity,
                        userModified: true,
                        lastModified: Date.now()
                    }
                }],
                isDirty: true,
                lastUpdated: Date.now()
            };

            setEquipmentChanges(prev => {
                const existingIndex = prev.findIndex(c => c.category === 'infant_care');
                let newChanges;
                
                if (existingIndex !== -1) {
                    const existing = prev[existingIndex];
                    const updatedEquipments = existing.equipments.filter(eq => eq.id !== equipment.id);
                    updatedEquipments.push(equipmentChange.equipments[0]);
                    
                    newChanges = [...prev];
                    newChanges[existingIndex] = {
                        ...existing,
                        equipments: updatedEquipments,
                        isDirty: true
                    };
                } else {
                    newChanges = [...prev, equipmentChange];
                }

                setTimeout(() => {
                    if (mountedRef.current && props.hasOwnProperty('onChange')) {
                        const validationResult = validateSelections();
                        props.onChange(validationResult.allValid, newChanges);
                    }
                }, 0);
                
                return newChanges;
            });
        }
    }, [groupedEquipments, validateSelections, props, markUserInteraction, validationForced]);

    const handleRadioFieldChange = useCallback((categoryName, label, updatedOptions, isConfirmation = false) => {
        const selectedOption = updatedOptions.find(opt => opt.value === true);
        if (selectedOption) {
            handleCategoryChange(categoryName, selectedOption.label.toLowerCase(), isConfirmation);
        }
    }, [handleCategoryChange]);

    const updateInfantCareEquipmentChangesWithQuantity = (equipmentName, hasQuantity, quantity, isUserModified = false) => {
        const equipment = groupedEquipments['infant_care']?.find(eq => eq.name === equipmentName);
        if (!equipment) return;

        setEquipmentChanges(prev => {
            const existingInfantCareChangeIndex = prev.findIndex(c => c.category === 'infant_care');
            
            if (existingInfantCareChangeIndex !== -1) {
                const existingChange = prev[existingInfantCareChangeIndex];
                const updatedEquipments = existingChange.equipments.filter(eq => eq.id !== equipment.id);
                
                updatedEquipments.push({
                    ...equipment,
                    label: equipment.name,
                    value: hasQuantity,
                    meta_data: { 
                        quantity,
                        userModified: isUserModified,
                        lastModified: Date.now()
                    }
                });
                
                const updatedChanges = [...prev];
                updatedChanges[existingInfantCareChangeIndex] = {
                    ...existingChange,
                    equipments: updatedEquipments,
                    isDirty: true,
                    lastUpdated: Date.now()
                };
                
                return updatedChanges;
            } else {
                const newChange = {
                    category: 'infant_care',
                    equipments: [{
                        ...equipment,
                        label: equipment.name,
                        value: hasQuantity,
                        meta_data: { 
                            quantity,
                            userModified: isUserModified,
                            lastModified: Date.now()
                        }
                    }],
                    isDirty: true,
                    lastUpdated: Date.now()
                };
                
                return [...prev, newChange];
            }
        });
    };

    const updateEquipmentChangesWithMetaData = (categoryName, value, isConfirmation = false, metaDataOverride = null) => {
        if (isConfirmation) return;
        
        const categoryEquipments = groupedEquipments[categoryName] || [];
        const categoryType = categoryTypes[categoryName];
        let selectedEquipments = [];
        const previousSelectedEquipments = currentBookingEquipments.filter(equipment => 
            equipment?.EquipmentCategory?.name === categoryName && !equipment?.hidden
        );

        if (categoryType === 'special') {
            if (categoryName === 'infant_care') {
                return;
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

    const updateEquipmentChanges = useCallback((categoryName, value, isConfirmation = false) => {
        if (protectedSelections.has(categoryName) && !isConfirmation) {
            return;
        }
        
        updateEquipmentChangesWithMetaData(categoryName, value, isConfirmation, null);
    }, [protectedSelections, updateEquipmentChangesWithMetaData]);

    const createInitialInfantCareEquipmentChanges = useCallback((categoryEquipments, metaData) => {
        const equipmentChangesToAdd = [];
        
        categoryEquipments.forEach(equipment => {
            const equipmentKey = getEquipmentKey(equipment.name);
            if (equipmentKey && metaData[equipmentKey]) {
                const quantity = metaData[equipmentKey].quantity || 0;
                
                if (quantity > 0) {
                    equipmentChangesToAdd.push({
                        ...equipment,
                        label: equipment.name,
                        value: true,
                        meta_data: { 
                            quantity,
                            source: metaData[equipmentKey].source || 'prefilled',
                            lastModified: Date.now()
                        }
                    });
                }
            }
        });
        
        if (equipmentChangesToAdd.length > 0) {
            const infantCareChange = {
                category: 'infant_care',
                equipments: equipmentChangesToAdd,
                isDirty: true,
                lastUpdated: Date.now()
            };
            
            setEquipmentChanges(prev => {
                const filtered = prev.filter(c => c.category !== 'infant_care');
                return [...filtered, infantCareChange];
            });
        }
    }, []);

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

    // getValidationStyling checks validationForced
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

        // Show error if: has error AND (is touched OR forceShowErrors OR validation was forced via ref)
        const shouldShowError = hasError && (isTouched || forceShowErrors || validationForced);
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

    // ValidationMessage checks validationForced
    const ValidationMessage = ({ categoryName, isConfirmation = false, isQuantity = false }) => {
        const errorKey = isQuantity ? `${categoryName}_quantity` : (isConfirmation ? `confirm_${categoryName}` : categoryName);
        const isTouched = categoryTouched[errorKey];
        const shouldShowError = categoryErrors[errorKey] && (isTouched || forceShowErrors || validationForced);
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

    const renderInfantCareCategory = (categoryName, equipments) => {
        return (
            <div key={categoryName} className="py-4">
                <div className="space-y-4">
                    {equipments.map((equipment) => {
                        const equipmentKey = getEquipmentKey(equipment.name);
                        if (!equipmentKey) return null;

                        const metaData = equipmentMetaData[equipmentKey] || {};
                        const quantity = metaData.quantity || 0;
                        
                        const isUserModified = userModificationsRef.current.has(equipmentKey) || metaData.userModified === true;
                        
                        const { isRequired } = getValidationStyling(equipmentKey);
                        
                        const hasCustomImage = Boolean(equipment.image_url);
                        const imageUrl = equipment.image_url || getDefaultImage('equipment');
                        
                        return (
                            <div key={equipment.id}>
                                <div className={getContainerClasses(equipmentKey)}>
                                    <div className="flex items-start space-x-4">
                                        <div className="flex-shrink-0 relative group">
                                            <img
                                                src={imageUrl}
                                                alt={equipment.name}
                                                className={`w-20 h-20 object-cover rounded-lg border border-gray-200 ${
                                                    !hasCustomImage ? 'opacity-60' : ''
                                                }`}
                                                onError={(e) => {
                                                    if (e.target.src !== getDefaultImage('equipment')) {
                                                        e.target.src = getDefaultImage('equipment');
                                                        e.target.classList.add('opacity-60');
                                                    }
                                                }}
                                            />
                                            {hasCustomImage && (
                                                <button
                                                    type="button"
                                                    onClick={(e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        setSelectedImage({ url: equipment.image_url, alt: equipment.name });
                                                        setImageModalOpen(true);
                                                    }}
                                                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 rounded-lg transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                                                    title="Click to enlarge"
                                                >
                                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                                                    </svg>
                                                </button>
                                            )}
                                        </div>
                                        
                                        <div className="flex-grow">
                                            <div className="flex items-center justify-between mb-2">
                                                <div>
                                                    <h3 className="font-medium text-gray-900">
                                                        {equipment.name}
                                                        {isRequired && <span className="text-red-500 ml-1">*</span>}
                                                    </h3>
                                                    {equipment.serial_number && (
                                                        <p className="text-sm text-gray-500">
                                                            {equipment.serial_number}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center space-x-3">
                                                <label className="text-sm font-medium text-gray-700">
                                                    Quantity needed:
                                                </label>
                                                <div className="flex items-center space-x-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newQuantity = Math.max(0, quantity - 1);
                                                            handleDirectQuantityChange(equipmentKey, equipment.name, newQuantity.toString());
                                                        }}
                                                        disabled={props?.disabled || quantity <= 0}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                                                        </svg>
                                                    </button>
                                                    
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        max="2"
                                                        value={quantity}
                                                        disabled={props?.disabled}
                                                        onChange={(e) => handleDirectQuantityChange(equipmentKey, equipment.name, e.target.value)}
                                                        className="w-16 text-center px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                                                    />
                                                    
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            const newQuantity = Math.min(2, quantity + 1);
                                                            handleDirectQuantityChange(equipmentKey, equipment.name, newQuantity.toString());
                                                        }}
                                                        disabled={props?.disabled || quantity >= 2}
                                                        className="w-8 h-8 flex items-center justify-center rounded-full border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    >
                                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            {quantity > 0 && (
                                                <div className="mt-2 text-sm text-green-600 font-medium">
                                                    ✓ {quantity} {equipment.name.toLowerCase()}{quantity > 1 ? 's' : ''} selected
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <ValidationMessage categoryName={equipmentKey} isQuantity={true} />
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderSpecialCategory = (categoryName, equipments) => {
        if (categoryName === 'infant_care') {
            return renderInfantCareCategory(categoryName, equipments);
        }
        
        return null;
    };

    const renderEquipmentSelection = useCallback((categoryName, equipments) => {
        const hasImages = equipments.some(eq => eq.image_url);
        const selection = categorySelections[categoryName];
        const categoryType = categoryTypes[categoryName];
        const isMultiSelect = categoryType === 'multi_select' || categoryType === 'confirmation_multi';
        const categoryDisplayName = formatCategoryName(categoryName);
        
        const isRequired = isRequiredCategory(categoryName, categoryType) || 
                        (categoryName === 'sling' && categorySelections['ceiling_hoist'] === 'yes');

        const useCardSelection = hasImages || categoryName === 'mattress_options';

        if (useCardSelection) {
            const cards = equipments.map(eq => ({
                value: eq.id,
                label: eq.name,
                description: eq.serial_number || eq.description || '',
                imageUrl: eq.image_url || getDefaultImage('equipment')
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

    const renderCategorySection = (categoryName, equipments) => {
        const categoryType = categoryTypes[categoryName];
        const selection = categorySelections[categoryName];
        const confirmationKey = `confirm_${categoryName}`;
        const confirmSelection = categorySelections[confirmationKey];

        if (categoryType === 'special') {
            return renderSpecialCategory(categoryName, equipments);
        }

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
                            // Clear forced validation when user interacts
                            if (validationForced) {
                                setValidationForced(false);
                            }
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

            {bookingType !== BOOKING_TYPES.FIRST_TIME_GUEST && (
                <div className="py-4">
                    <div className={`flex ${categoryErrors['acknowledgement'] && (categoryTouched['acknowledgement'] || forceShowErrors || validationForced) ? 'border-2 border-red-400 bg-red-50 rounded-xl p-4' : ''}`}>
                        <span className="text-xs text-red-500 ml-1 font-bold">*</span>
                        <CheckBox
                            bold={true}
                            label={'I verify all the information above is true and updated.'}
                            value={acknowledgementChecked}
                            checked={acknowledgementChecked}
                            required={true}
                            onChange={(label, value) => {
                                // Clear forced validation when user interacts
                                if (validationForced) {
                                    setValidationForced(false);
                                }
                                setAcknowledgementChecked(value);
                                setCategoryTouched(prev => ({ ...prev, 'acknowledgement': true }));
                                if (value) {
                                    setCategoryErrors(prev => {
                                        const newErrors = { ...prev };
                                        delete newErrors['acknowledgement'];
                                        return newErrors;
                                    });
                                }
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
                                        const newChanges = [...filtered, change];
                                        
                                        // FIX: Notify parent component of the change (this was missing!)
                                        setTimeout(() => {
                                            if (mountedRef.current && props.hasOwnProperty('onChange')) {
                                                const validationResult = validateSelections();
                                                props.onChange(validationResult.allValid, newChanges);
                                            }
                                        }, 0);
                                        
                                        return newChanges;
                                    });
                                }
                            }}
                        />
                    </div>
                    {categoryErrors['acknowledgement'] && (categoryTouched['acknowledgement'] || forceShowErrors || validationForced) && (
                        <div className="mt-1.5 flex items-center">
                            <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                            </svg>
                            <p className="text-red-600 text-sm font-medium">{categoryErrors['acknowledgement']}</p>
                        </div>
                    )}
                </div>
            )}
            
            <ImageModal
                isOpen={imageModalOpen}
                onClose={() => setImageModalOpen(false)}
                imageUrl={selectedImage.url}
                altText={selectedImage.alt}
            />
        </div>
    );
});

EquipmentField.displayName = 'EquipmentField';

export default EquipmentField;