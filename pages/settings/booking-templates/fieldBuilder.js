import React, { useEffect, useState } from "react";
import { GetField } from "../../../components/fields"
import { useDebouncedCallback } from 'use-debounce';
import { useDispatch, useSelector } from "react-redux";
import { fetchTemplate, templateActions } from "./../../../store/templateSlice";

export default function FieldBuilder(props) {
    const [question, setQuestion] = useState(props.question || undefined);
    const [newOption, setNewOption] = useState({ label: "", value: "" });
    const [optionSyncStatus, setOptionSyncStatus] = useState(true);
    const dispatch = useDispatch();
    const template_uuid = useSelector(state => state.builder.template.uuid);
    const nonRequiredFields = ['url', 'rich-text'];

    const labelSelector = [
        { label: "", value: "" },
        { label: "Health", value: "health" },
        { label: "Room", value: "room" },
        { label: "Equipment", value: "equipment" }
    ];

    const fieldWithSelectOptions = [
        'select',
        'multi-select',
        'checkbox',
        'checkbox-button',
        'radio',
        'health-info',
        'radio-ndis',
        'card-selection',
        'card-selection-multi',
        'horizontal-card',
        'horizontal-card-multi'
    ];

    // Field types that need enhanced options (with description and imageUrl)
    const cardSelectionFields = [
        'card-selection',
        'card-selection-multi',
        'horizontal-card',
        'horizontal-card-multi'
    ];

    // Package selection fields
    const packageSelectionFields = [
        'package-selection',
        'package-selection-multi'
    ];

    // Available option types for card selection
    const optionTypes = [
        { label: "Funder", value: "funder" },
        { label: "Course", value: "course" }
    ];

    // Available funder types for package selection - REMOVED FROM BUILDER
    const funderTypes = [
        { label: "NDIS", value: "NDIS" },
        { label: "Non-NDIS", value: "Non-NDIS" }
    ];

    // Available NDIS package types (only for NDIS funder) - REMOVED FROM BUILDER
    const ndisPackageTypes = [
        { label: "STA (Short Term Accommodation)", value: "sta" },
        { label: "Holiday", value: "holiday" }
    ];

    useEffect(() => {
        if (!question) {
            return;
        }

        setQuestion(props.question);

        if (props.question && props.question.options == null) {
            setQuestion({ ...props.question, options: [] });
        }

        // Initialize option_type if not set for card selection fields
        if (cardSelectionFields.includes(props.question?.type) && !props.question?.option_type) {
            const questionWithOptionType = { ...props.question, option_type: 'funder' };
            setQuestion(questionWithOptionType);
            
            // Auto-save the option_type to database
            setTimeout(() => {
                handleQuestionChanges(questionWithOptionType);
            }, 100);
        }

        // Initialize funder and ndis_package_type if not set for package selection fields
        if (packageSelectionFields.includes(props.question?.type)) {
            let updatedQuestion = { ...props.question };
            let needsUpdate = false;
            
            // Parse existing details or create new object
            let details = typeof updatedQuestion.details === 'string' 
                ? JSON.parse(updatedQuestion.details) 
                : (updatedQuestion.details || {});

            if (!details.funder) {
                details.funder = 'NDIS';
                needsUpdate = true;
            }

            if (!details.ndis_package_type && details.funder === 'NDIS') {
                details.ndis_package_type = 'sta';
                needsUpdate = true;
            }

            if (needsUpdate) {
                updatedQuestion.details = details;
                setQuestion(updatedQuestion);
                
                // Auto-save the defaults to database
                setTimeout(() => {
                    handleQuestionChanges(updatedQuestion);
                }, 100);
            }
        }
    }, [props]);

    const debounceHandleQuestionChanges = useDebouncedCallback((questionToSave) => handleQuestionChanges(questionToSave), 2000);

    const handleQuestionChanges = async (questionToSave = question) => {
        const response = await fetch('/api/booking-templates/questions/' + questionToSave.id, {
            method: 'POST',
            body: JSON.stringify({ ...questionToSave }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const updateRequiredStatus = async (label, checkedStatus) => {
        setQuestion({ ...question, required: checkedStatus });
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify({ ...question, required: checkedStatus }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const updateLabel = async (selected) => {
        setQuestion({ ...question, label: selected.value });
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify({ ...question, label: selected.value }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    // Update option type for card selection fields
    const updateOptionType = async (selected) => {
        const newOptionType = selected.value;
        const updatedQuestion = { ...question, option_type: newOptionType };
        
        // Clear options when switching option types (let CardSelection handle course auto-population)
        updatedQuestion.options = [];
        
        setQuestion(updatedQuestion);
        
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify(updatedQuestion),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const updateNdisOnlyStatus = async (label, checkedStatus) => {
        setQuestion({ ...question, ndis_only: checkedStatus });
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify({ ...question, ndis_only: checkedStatus }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const updateOptionLabel = async (e, selected, type) => {
        e.stopPropagation();
        let updatedOptions = [];
        
        if (type === 'card-selection') {
            // Handle card selection field updates
            updatedOptions = question.options.map((option, index) => {
                let opt = { ...option };

                if (index === selected.index) {
                    if (selected.field === 'label') {
                        opt.label = selected.label;
                    } else if (selected.field === 'description') {
                        opt.description = selected.label; // selected.label contains the new value
                    } else if (selected.field === 'value') {
                        opt.value = selected.label; // selected.label contains the new value
                    }
                }
                return opt;
            });
        } else {
            // Handle regular options updates (radio, checkbox, etc.)
            updatedOptions = question.options.map((option, index) => {
                let opt = { ...option };

                if (index === selected.index) {
                    if (selected.field === 'label' || !selected.field) {
                        // If field is 'label' or undefined, update the label
                        opt.label = selected.label;
                        // For consistency, also update the value to match the label
                        opt.value = selected.label;
                    } else if (selected.field === 'value') {
                        // If explicitly updating value
                        opt.value = selected.label;
                    }
                }
                return opt;
            });
        }

        setOptionSyncStatus(false);
        setQuestion({ ...question, options: updatedOptions });
    }

    const updateUrlField = async (field, value) => {
        let details = typeof question.details === 'string' ? JSON.parse(question.details) : (question.details || {});
        details[field] = value;
        
        const updatedQuestion = { ...question, details: details };
        setQuestion(updatedQuestion);
        
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify(updatedQuestion),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const updateRichTextField = async (field, value) => {
        let details = typeof question.details === 'string' ? JSON.parse(question.details) : (question.details || {});
        details[field] = value;
        
        const updatedQuestion = { ...question, details: details };
        setQuestion(updatedQuestion);
        
        const response = await fetch('/api/booking-templates/questions/' + question.id, {
            method: 'POST',
            body: JSON.stringify(updatedQuestion),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.status == 200) {
            dispatch(fetchTemplate(template_uuid))
        }
    }

    const handleRemoveOption = async (e, selected, fieldType) => {
        e.stopPropagation();
        
        // Handle both old format (direct index) and new format (object with index)
        const indexToRemove = typeof selected === 'object' && selected.hasOwnProperty('index') 
            ? selected.index 
            : selected;
        
        const updatedOptions = question.options.filter((option, index) => index !== indexToRemove);
        const updatedQuestion = { ...question, options: updatedOptions };
        
        // Update local state
        setQuestion(updatedQuestion);
        
        // Set sync status to true to prevent useEffect from triggering another save
        setOptionSyncStatus(true);

        // Immediately update the backend
        try {
            const response = await fetch('/api/booking-templates/questions/' + question.id, {
                method: 'POST',
                body: JSON.stringify(updatedQuestion),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                // Update Redux state to reflect the changes
                dispatch(fetchTemplate(template_uuid));
                console.log('Option removed and synced to backend successfully');
            } else {
                console.error('Failed to sync option removal to backend');
                // Reset sync status on error so useEffect can handle retry if needed
                setOptionSyncStatus(false);
            }
        } catch (error) {
            console.error('Error syncing option removal to backend:', error);
            // Reset sync status on error so useEffect can handle retry if needed
            setOptionSyncStatus(false);
        }
    }

    const addOption = async () => {
        const currentOptions = typeof question.options === 'string' ? 
            JSON.parse(question.options) : question.options;
        
        // Create appropriate option structure based on field type
        let newOptionToAdd;
        
        if (cardSelectionFields.includes(question.type)) {
            // Enhanced option structure for card selection fields
            newOptionToAdd = {
                label: newOption.label,
                value: newOption.value || newOption.label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
                description: "",
                imageUrl: null,
                imageFilename: null
            };
        } else {
            // Regular option structure for radio, checkbox, etc. with value set to false
            newOptionToAdd = {
                label: newOption.label,
                value: false // Set to false for radio buttons, checkboxes, etc.
            };
        }

        // Create the updated question object
        const updatedQuestion = { 
            ...question, 
            options: [...currentOptions, newOptionToAdd] 
        };

        // Update local state
        setQuestion(updatedQuestion);
        setNewOption({ label: "", value: "" });

        // Set optionSyncStatus to true to prevent the useEffect from triggering another save
        setOptionSyncStatus(true);

        // Immediately update the backend
        try {
            const response = await fetch('/api/booking-templates/questions/' + question.id, {
                method: 'POST',
                body: JSON.stringify(updatedQuestion),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.status === 200) {
                // Update Redux state to reflect the changes
                dispatch(fetchTemplate(template_uuid));
                console.log('Option added and synced to backend successfully');
            } else {
                console.error('Failed to sync option to backend');
                // Reset sync status on error so useEffect can handle retry if needed
                setOptionSyncStatus(false);
            }
        } catch (error) {
            console.error('Error syncing option to backend:', error);
            // Reset sync status on error so useEffect can handle retry if needed
            setOptionSyncStatus(false);
        }
    }

    useEffect(() => {
        if (!optionSyncStatus) {
            syncOptions();
            console.log('options updated')
        }
    }, [question.options]);

    // Dynamic file upload based on option_type
    const uploadImageFile = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            // Use dynamic file path based on option_type
            const fileType = `${question.option_type || 'funder'}/`;
            formData.append('fileType', fileType);
            formData.append('metadata', JSON.stringify({
                courseId: question.id,
                uploadedBy: 'booking-request-form',
                optionType: question.option_type
            }));

            const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                return file.name;
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    };

    const handleImageUpload = async (index, file) => {
        try {
            const currentOption = question.options[index];
            
            // Show loading state - create temporary preview
            const previewUrl = URL.createObjectURL(file);
            
            // Update options with loading preview
            let tempUpdatedOptions = question.options.map((option, optionIndex) => {
                if (optionIndex === index) {
                    return { ...option, imageUrl: previewUrl, uploading: true };
                }
                return option;
            });
            
            setOptionSyncStatus(false);
            setQuestion({ ...question, options: tempUpdatedOptions });

            // If there's an existing image, delete it from storage first
            if (currentOption.imageFilename) {
                try {
                    const fileType = question.option_type || 'funder';
                    await fetch(`/api/storage/upload?filename=${currentOption.imageFilename}&filepath=${fileType}/`, {
                        method: 'DELETE'
                    });
                } catch (error) {
                    console.warn('Failed to delete old image from storage:', error);
                    // Continue with upload even if deletion fails
                }
            }

            // Upload new file to server
            const filename = await uploadImageFile(file);
            
            // Update options with filename only (imageUrl will be generated by API)
            const finalUpdatedOptions = question.options.map((option, optionIndex) => {
                if (optionIndex === index) {
                    // Clean up old preview URL if it exists
                    if (option.imageUrl && option.imageUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(option.imageUrl);
                    }
                    return { 
                        ...option, 
                        imageFilename: filename, // Store filename for database
                        imageUrl: previewUrl, // Keep preview for immediate display in builder
                        uploading: false 
                    };
                }
                return option;
            });

            setOptionSyncStatus(false);
            setQuestion({ ...question, options: finalUpdatedOptions });
            
        } catch (error) {
            console.error('Image upload failed:', error);
            
            // Remove loading state and show error
            const errorUpdatedOptions = question.options.map((option, optionIndex) => {
                if (optionIndex === index) {
                    // Clean up preview URL on error
                    if (option.imageUrl && option.imageUrl.startsWith('blob:')) {
                        URL.revokeObjectURL(option.imageUrl);
                    }
                    // Keep existing imageFilename if there was one, don't clear it on upload error
                    return { 
                        ...option, 
                        imageUrl: currentOption.imageUrl || null, // Restore previous imageUrl if it existed
                        uploading: false, 
                        uploadError: true 
                    };
                }
                return option;
            });

            setOptionSyncStatus(false);
            setQuestion({ ...question, options: errorUpdatedOptions });
            
            // You might want to show a toast notification here
            alert('Failed to upload image. Please try again.');
        }
    };

    const syncOptions = async () => await fetch('/api/booking-templates/questions/' + question.id, {
        method: 'POST',
        body: JSON.stringify(question),
        headers: {
            'Content-Type': 'application/json'
        }
    }).then((response) => {
        if (response.status == 200) {
            dispatch(templateActions.updateQuestion(question))
        }
        setOptionSyncStatus(true)
    });

    const RenderQuestion = ({ question }) => {
        switch (question.type) {
            case 'url':
                return <GetField type={"url"} builderMode={true} label={typeof question.details === 'string' ? JSON.parse(question.details).label : question.details.label} url={typeof question.details === 'string' ? JSON.parse(question.details).url : question.details.url} onChange={updateUrlField} className="w-full" />;
            case 'rich-text':
                return <GetField type={"rich-text"} builderMode={true} description={typeof question.details === 'string' ? JSON.parse(question.details).description : question.details.description || null} onChange={updateRichTextField} className="w-full" />;
            case 'package-selection':
            case 'package-selection-multi':
                // MODIFIED: In builderMode, show ALL packages without any filters
                return <GetField 
                    type={question.type} 
                    className="w-full" 
                    builderMode={true}
                    // Remove funder and ndis_package_type params in builderMode to show all packages
                />;
            case 'card-selection':
            case 'card-selection-multi':
            case 'horizontal-card':
            case 'horizontal-card-multi':
                return <GetField 
                    type={question.type} 
                    options={question.options} 
                    option_type={question.option_type}
                    className="w-full" 
                    builder={true} 
                    builderMode={true}
                    updateOptionLabel={updateOptionLabel} 
                    handleRemoveOption={handleRemoveOption}
                    onImageUpload={handleImageUpload}
                />;
            default:
                return <GetField type={question.type} options={question.options} className="w-full" builder={true} updateOptionLabel={updateOptionLabel} handleRemoveOption={handleRemoveOption} />;
        }
    };

    const isCardSelectionField = cardSelectionFields.includes(question.type);
    const isPackageSelectionField = packageSelectionFields.includes(question.type);

    return (<>
        <div className="info-item">
            {/* TODO - IMPROVE THE TYPE SELECTION FEATURE */}
            {/* <GetField type='select' value={labelSelector.find(o => o.value === question.label)} width='100%' label="Type" options={labelSelector} onChange={updateLabel} /> */}
            <textarea className="auto-save-input font-bold p-1 bg-transparent border-stone-50"
                placeholder="Type your question here"
                value={question.question}
                data-tip="edit field label"
                data-effect="solid"
                style={{ width: '90%' }}
                disabled={question.is_locked}
                onChange={(e) => {
                    const updatedQuestion = { ...question, question: e.target.value };
                    setQuestion(updatedQuestion);
                    debounceHandleQuestionChanges(updatedQuestion);
                }}
            />
            
            {/* Option Type Selector for Card Selection Fields */}
            {isCardSelectionField && (
                <div className="mb-4">
                    <GetField 
                        type='select' 
                        value={optionTypes.find(o => o.value === (question.option_type || 'funder'))} 
                        width='100%' 
                        label="Option Type" 
                        options={optionTypes} 
                        onChange={updateOptionType} 
                    />
                </div>
            )}

            {/* REMOVED: Package Selection Field Controls section - No longer shown in builder mode */}
            
            <RenderQuestion question={question} />
            
            {/* Required checkbox */}
            {!nonRequiredFields.includes(question.type) && 
                <GetField 
                    className="text-right" 
                    type="simple-checkbox" 
                    label="required" 
                    value={question.required} 
                    checked={question.required} 
                    onChange={updateRequiredStatus} 
                />
            }

            {/* NDIS Only checkbox */}
            <GetField 
                className="text-right" 
                type="simple-checkbox" 
                label="NDIS Only Question" 
                value={question.ndis_only} 
                checked={question.ndis_only} 
                onChange={updateNdisOnlyStatus} 
            />
            
            {fieldWithSelectOptions.includes(question.type) && (
                <div className="flex flex-col mt-2">
                    {isCardSelectionField ? (
                        // Simplified form for card selection fields (removed value input)
                        <div className="space-y-2">
                            <div className="text-sm font-medium text-gray-700 mb-2">
                                Add New {question.option_type === 'course' ? 'Course' : 'Funder'} Option:
                            </div>
                            
                            <input 
                                className="p-1 px-2 block w-full text-base font-normal text-gray-700 bg-white bg-clip-padding border-b border-gray-400
                                    shadow-sm transition ease-in-out focus:text-gray-700 focus:bg-white focus:outline-none disabled:opacity-80 
                                    focus:border-slate-400" 
                                placeholder={`Option label (e.g., '${question.option_type === 'course' ? 'Advanced Cooking' : 'NDIS'}')`}
                                value={newOption.label} 
                                onChange={(e) => setNewOption({ ...newOption, label: e.target.value })} 
                            />
                            
                            <button 
                                className="bg-sargood-blue text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                onClick={addOption}
                                disabled={!newOption.label.trim()}
                            >
                                Add Option
                            </button>
                        </div>
                    ) : (
                        // Regular form for other field types
                        <div className="flex gap-2">
                            <input 
                                className="p-1 px-2 block text-base font-normal text-gray-700 bg-white bg-clip-padding border-b border-gray-400 
                                    shadow-sm transition ease-in-out focus:text-gray-700 focus:bg-white focus:outline-none disabled:opacity-80 
                                    focus:border-slate-400" 
                                placeholder="Option label" 
                                value={newOption.label} 
                                onChange={(e) => setNewOption({ ...newOption, label: e.target.value })} 
                            />
                            <button 
                                className="bg-sargood-blue text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                                onClick={addOption}
                            >
                                Add
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    </>);
}