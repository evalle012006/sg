import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { Home, Plus, Trash2 } from 'lucide-react';

const Button = dynamic(() => import('../../components/ui-v2/Button'));
const Select = dynamic(() => import('../../components/ui-v2/Select'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const DescriptionEditor = dynamic(() => import('../../components/ui-v2/DescriptionEditor'), { ssr: false });
import { DescriptionPreview } from '../../components/ui-v2/FormattedDescription';

export default function PackageForm({ 
    mode = 'add', // 'add', 'edit', or 'view'
    packageId = null,
    onCancel,
    onSuccess 
}) {
    const isEditMode = mode === 'edit' && packageId;
    const isViewMode = mode === 'view';
    const isReadOnly = isViewMode;

    const [formData, setFormData] = useState({
        name: '',
        package_code: '',
        funder: '',
        price: '',
        ndis_package_type: '',
        description: '',
        ndis_line_items: []
    });

    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    
    // Validation state management
    const [fieldErrors, setFieldErrors] = useState({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [validationAttempted, setValidationAttempted] = useState(false);

    // Required fields definition - dynamic based on funder type
    const getRequiredFields = () => {
        const baseFields = ['name', 'package_code', 'funder'];
        
        if (formData.funder === 'NDIS') {
            return [...baseFields, 'ndis_package_type'];
        } else if (formData.funder === 'Non-NDIS') {
            return [...baseFields, 'price'];
        }
        
        return baseFields;
    };

    // Funder options
    const funderOptions = [
        { value: 'NDIS', label: 'NDIS' },
        { value: 'Non-NDIS', label: 'Non-NDIS' }
    ];

    // NDIS Package Type options
    const ndisPackageTypeOptions = [
        { value: 'sta', label: 'STA' },
        { value: 'holiday', label: 'Holiday' },
        { value: 'holiday-plus', label: 'Holiday Plus' }
    ];

    // Rate Category options
    const rateCategoryOptions = [
        { value: 'day', label: 'Day' },
        { value: 'hour', label: 'Hour' },
        { value: 'night', label: 'Night' }
    ];

    // Line Item Type options
    const lineItemTypeOptions = [
        { value: '', label: 'None' },
        { value: 'room', label: 'Room' },
        { value: 'group_activities', label: 'Group Activities' },
        { value: 'sleep_over', label: 'Sleep Over' },
        { value: 'care', label: 'Care' },
        { value: 'course', label: 'Course' },
    ];

    // Care Time options
    const careTimeOptions = [
        { value: '', label: 'None' },
        { value: 'morning', label: 'Morning' },
        { value: 'afternoon', label: 'Afternoon' },
        { value: 'evening', label: 'Evening' }
    ];

    // Add new NDIS line item
    const addNdisLineItem = () => {
        if (isReadOnly) return;
        
        setFormData(prev => ({
            ...prev,
            ndis_line_items: [
            ...prev.ndis_line_items,
            { 
                sta_package: '', 
                line_item: '', 
                price_per_night: '',
                rate_type: '',
                rate_category: 'day',
                line_item_type: '',
                care_time: ''
            }
            ]
        }));
    };

    // Remove NDIS line item
    const removeNdisLineItem = (index) => {
        if (isReadOnly) return;
        
        setFormData(prev => ({
            ...prev,
            ndis_line_items: prev.ndis_line_items.filter((_, i) => i !== index)
        }));
    };

    // Update NDIS line item
    const updateNdisLineItem = (index, field, value) => {
        if (isReadOnly) return;
        
        setFormData(prev => ({
            ...prev,
            ndis_line_items: prev.ndis_line_items.map((item, i) => {
                if (i === index) {
                    const updatedItem = { ...item, [field]: value };
                    
                    // If line_item_type changes away from 'care', clear care_time
                    if (field === 'line_item_type' && value !== 'care') {
                        updatedItem.care_time = '';
                    }
                    
                    return updatedItem;
                }
                return item;
            })
        }));
    };

    // Rate Type options
    const rateTypeOptions = [
        { value: '', label: 'All Days' },
        { value: 'weekday', label: 'Weekday' },
        { value: 'saturday', label: 'Saturday' },
        { value: 'sunday', label: 'Sunday' },
        { value: 'public_holiday', label: 'Holiday' }
    ];

    // Get selected option helpers
    const getSelectedRateTypeOption = (rateType) => {
        return rateTypeOptions.find(option => option.value === (rateType || '')) || rateTypeOptions[0];
    };

    const getSelectedRateCategoryOption = (rateCategory) => {
        return rateCategoryOptions.find(option => option.value === (rateCategory || 'day')) || rateCategoryOptions[0];
    };

    const getSelectedLineItemTypeOption = (lineItemType) => {
        return lineItemTypeOptions.find(option => option.value === (lineItemType || '')) || lineItemTypeOptions[0];
    };

    const getSelectedCareTimeOption = (careTime) => {
        return careTimeOptions.find(option => option.value === (careTime || '')) || careTimeOptions[0];
    };

    // Handle dropdown changes
    const handleRateTypeChange = (index, selectedOption) => {
        if (isReadOnly) return;
        updateNdisLineItem(index, 'rate_type', selectedOption ? selectedOption.value : '');
    };

    const handleRateCategoryChange = (index, selectedOption) => {
        if (isReadOnly) return;
        updateNdisLineItem(index, 'rate_category', selectedOption ? selectedOption.value : 'day');
    };

    const handleLineItemTypeChange = (index, selectedOption) => {
        if (isReadOnly) return;
        updateNdisLineItem(index, 'line_item_type', selectedOption ? selectedOption.value : '');
    };

    const handleCareTimeChange = (index, selectedOption) => {
        if (isReadOnly) return;
        updateNdisLineItem(index, 'care_time', selectedOption ? selectedOption.value : '');
    };

    // Comprehensive validation function
    const validateAllFields = useCallback(() => {
        const errors = {};
        const requiredFields = getRequiredFields();

        // Validate required fields
        requiredFields.forEach(field => {
            const value = formData[field];
            if (!value || value.toString().trim() === '') {
                errors[field] = 'This field is required';
            }
        });

        // Validate specific field formats
        if (formData.name && formData.name.trim().length < 2) {
            errors.name = 'Package name must be at least 2 characters long';
        }

        if (formData.package_code && formData.package_code.trim().length < 2) {
            errors.package_code = 'Package code must be at least 2 characters long';
        }

        // Validate Non-NDIS price
        if (formData.funder === 'Non-NDIS' && formData.price) {
            const priceValue = parseFloat(formData.price);
            if (isNaN(priceValue) || priceValue < 0) {
                errors.price = 'Please enter a valid positive number';
            }
        }

        // Validate NDIS line items
        if (formData.funder === 'NDIS') {
            if (formData.ndis_line_items.length === 0) {
                errors.ndis_line_items = 'At least one NDIS line item is required';
            } else {
                formData.ndis_line_items.forEach((item, index) => {
                    if (!item.sta_package || !item.sta_package.trim()) {
                        errors[`ndis_line_item_${index}_sta_package`] = `STA Package is required for item ${index + 1}`;
                    }
                    if (!item.line_item || !item.line_item.trim()) {
                        errors[`ndis_line_item_${index}_line_item`] = `Line Item is required for item ${index + 1}`;
                    }
                    if (!item.price_per_night || item.price_per_night === '' || item.price_per_night === null || item.price_per_night === undefined) {
                        errors[`ndis_line_item_${index}_price_per_night`] = `Price per night is required for item ${index + 1}`;
                    } else {
                        const price = parseFloat(item.price_per_night);
                        if (isNaN(price) || price < 0) {
                            errors[`ndis_line_item_${index}_price_per_night`] = `Valid price per night is required for item ${index + 1}`;
                        }
                    }
                });
            }
        }

        // Validate funder selection
        if (formData.funder && !funderOptions.some(option => option.value === formData.funder)) {
            errors.funder = 'Please select a valid funder option';
        }

        // Validate NDIS package type
        if (formData.funder === 'NDIS' && formData.ndis_package_type && 
            !ndisPackageTypeOptions.some(option => option.value === formData.ndis_package_type)) {
            errors.ndis_package_type = 'Please select a valid NDIS package type';
        }

        return { errors, isValid: Object.keys(errors).length === 0 };
    }, [formData]);

    // Check form validity whenever form data changes
    useEffect(() => {
        const { errors, isValid } = validateAllFields();
        
        setFieldErrors(prevErrors => {
            const errorKeys = Object.keys(errors);
            const prevErrorKeys = Object.keys(prevErrors);
            
            if (errorKeys.length !== prevErrorKeys.length ||
                errorKeys.some(key => errors[key] !== prevErrors[key]) ||
                prevErrorKeys.some(key => !errors.hasOwnProperty(key))) {
                return errors;
            }
            return prevErrors;
        });
        
        setIsFormValid(isValid);
    }, [validateAllFields]);

    // Load package data if editing or viewing
    useEffect(() => {
        if ((isEditMode || isViewMode) && packageId) {
            loadPackage();
        } else {
            // Reset form for add mode
            setFormData({ 
                name: '', 
                package_code: '',
                funder: '', 
                price: '', 
                ndis_package_type: '',
                description: '',
                ndis_line_items: []
            });
            setFieldErrors({});
            setValidationAttempted(false);
        }
    }, [mode, packageId, isEditMode, isViewMode]);

    // Reset form when funder changes
    useEffect(() => {
        if (formData.funder === 'NDIS') {
            setFormData(prev => ({
                ...prev,
                price: '',
                ndis_line_items: prev.ndis_line_items.length === 0 ? [{ 
                    sta_package: '', 
                    line_item: '', 
                    price_per_night: '',
                    rate_type: '',
                    rate_category: 'day',
                    line_item_type: '',
                    care_time: ''
                }] : prev.ndis_line_items.map(item => ({
                    ...item,
                    rate_type: item.rate_type || '',
                    rate_category: item.rate_category || 'day',
                    line_item_type: item.line_item_type || '',
                    care_time: item.care_time || ''
                }))
            }));
        } else if (formData.funder === 'Non-NDIS') {
            setFormData(prev => ({
                ...prev,
                ndis_package_type: '',
                ndis_line_items: []
            }));
        }
    }, [formData.funder]);

    const loadPackage = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/packages/${packageId}`);
            if (!response.ok) {
                throw new Error('Failed to load package');
            }
            const result = await response.json();
            const packageData = result.package;
            
            // Ensure ndis_line_items have the new fields with defaults
            const updatedLineItems = (packageData.ndis_line_items || []).map(item => ({
                sta_package: item.sta_package || '',
                line_item: item.line_item || '',
                price_per_night: item.price_per_night || '',
                rate_type: item.rate_type || '',
                rate_category: item.rate_category || 'day',
                line_item_type: item.line_item_type || '',
                care_time: item.care_time || ''
            }));
            
            setFormData({
                name: packageData.name || '',
                package_code: packageData.package_code || '',
                funder: packageData.funder || '',
                price: packageData.price || '',
                ndis_package_type: packageData.ndis_package_type || '',
                description: packageData.description || '',
                ndis_line_items: updatedLineItems
            });
            
            setFieldErrors({});
            setValidationAttempted(false);
        } catch (error) {
            console.error('Error loading package:', error);
            toast.error('Failed to load package data');
        }
        setIsLoading(false);
    };

    const handleInputChange = (e) => {
        if (isReadOnly) return;
        
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleFunderChange = (selectedOption) => {
        if (isReadOnly) return;
        
        setFormData(prev => ({
            ...prev,
            funder: selectedOption ? selectedOption.value : ''
        }));
    };

    const handleNdisPackageTypeChange = (selectedOption) => {
        if (isReadOnly) return;
        
        setFormData(prev => ({
            ...prev,
            ndis_package_type: selectedOption ? selectedOption.value : ''
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (isReadOnly) return;

        setValidationAttempted(true);

        const { errors, isValid } = validateAllFields();
        if (!isValid) {
            toast.error('Please fix all validation errors before submitting');
            const firstErrorField = Object.keys(errors)[0];
            if (firstErrorField) {
                const element = document.querySelector(`[name="${firstErrorField}"]`) || 
                               document.querySelector(`#${firstErrorField}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.focus();
                }
            }
            return;
        }

        setIsSubmitting(true);

        try {
            const submitData = {
                name: formData.name.trim(),
                package_code: formData.package_code.trim(),
                funder: formData.funder.trim(),
                ndis_package_type: formData.funder === 'NDIS' ? formData.ndis_package_type : null,
                description: formData.description || null,
                price: formData.funder === 'Non-NDIS' ? (parseFloat(formData.price) || 0) : null,
                ndis_line_items: formData.funder === 'NDIS' ? formData.ndis_line_items.map(item => ({
                    sta_package: item.sta_package.trim(),
                    line_item: item.line_item.trim(),
                    price_per_night: parseFloat(item.price_per_night) || 0,
                    rate_type: item.rate_type || '',
                    rate_category: item.rate_category || 'day',
                    line_item_type: item.line_item_type || '',
                    care_time: item.care_time || ''
                })) : []
            };

            const url = isEditMode ? `/api/packages/${packageId}` : '/api/packages/';
            const method = isEditMode ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(submitData)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to save package');
            }

            const result = await response.json();
            toast.success(result.message || `Package ${isEditMode ? 'updated' : 'created'} successfully`);
            
            if (onSuccess) {
                setTimeout(() => {
                    onSuccess(result.package);
                }, 1000);
            }

        } catch (error) {
            console.error('Error saving package:', error);
            toast.error(error.message || 'Failed to save package');
        }

        setIsSubmitting(false);
    };

    const handleCancel = () => {
        if (onCancel) {
            onCancel();
        }
    };

    const getSelectedFunderOption = () => {
        return funderOptions.find(option => option.value === formData.funder) || null;
    };

    const getSelectedNdisPackageTypeOption = () => {
        return ndisPackageTypeOptions.find(option => option.value === formData.ndis_package_type) || null;
    };

    const getFormTitle = () => {
        switch (mode) {
            case 'edit':
                return 'EDIT PACKAGE';
            case 'view':
                return 'VIEW PACKAGE';
            default:
                return 'ADD PACKAGE';
        }
    };

    if (isLoading) {
        return (
            <div className='h-64 flex items-center justify-center'>
                <Spinner />
            </div>
        );
    }

    return (
        <>
            {/* Header - Clickable Breadcrumb */}
            <div className="flex items-center mb-6">
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <Home className="w-4 h-4" />
                    <button 
                        onClick={handleCancel}
                        className="hover:text-blue-600 transition-colors"
                    >
                        PACKAGES
                    </button>
                    <span>/</span>
                    <span className="font-medium">
                        {getFormTitle()}
                    </span>
                </div>
            </div>

            {/* Action Buttons */}
            {!isViewMode && (
                <div className="flex justify-end items-center space-x-3 mb-6">
                    <Button
                        color="outline"
                        size="medium"
                        label="CANCEL"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                    />
                    <Button
                        color="primary"
                        size="medium"
                        label={isSubmitting ? "SAVING..." : (isEditMode ? "UPDATE" : "SAVE")}
                        onClick={handleSubmit}
                        disabled={isSubmitting || (!isFormValid && validationAttempted)}
                        className="font-semibold"
                    />
                </div>
            )}

            {/* View Mode Buttons */}
            {isViewMode && (
                <div className="flex justify-end items-center space-x-3 mb-6">
                    <Button
                        color="outline"
                        size="medium"
                        label="BACK"
                        onClick={handleCancel}
                    />
                    <Button
                        color="primary"
                        size="medium"
                        label="EDIT"
                        onClick={() => {
                            if (onSuccess) {
                                onSuccess({ action: 'edit', id: packageId });
                            }
                        }}
                        className="font-semibold"
                    />
                </div>
            )}

            {/* Validation Summary */}
            {validationAttempted && Object.keys(fieldErrors).length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">
                                Please fix the following errors:
                            </h3>
                            <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                    {Object.entries(fieldErrors).map(([field, error]) => (
                                        <li key={field}>
                                            <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="max-w-5xl">
                    {/* Package Name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Package Name *
                        </label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="Package Name"
                            disabled={isReadOnly}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                (validationAttempted && fieldErrors.name) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                            }`}
                            required={!isReadOnly}
                        />
                        {validationAttempted && fieldErrors.name && (
                            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.name}</p>
                        )}
                    </div>

                    {/* Package Code */}
                    <div className="mb-6">
                        <label htmlFor="package_code" className="block text-sm font-medium text-gray-700 mb-2">
                            Package Code *
                        </label>
                        <input
                            type="text"
                            id="package_code"
                            name="package_code"
                            value={formData.package_code}
                            onChange={handleInputChange}
                            placeholder="Package Code"
                            disabled={isReadOnly}
                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                (validationAttempted && fieldErrors.package_code) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                            }`}
                            required={!isReadOnly}
                        />
                        {validationAttempted && fieldErrors.package_code && (
                            <p className="mt-1.5 text-sm text-red-600">{fieldErrors.package_code}</p>
                        )}
                    </div>

                    {/* Description with Editor */}
                    <div className="mb-6">
                        {isReadOnly ? (
                            <>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Package Description
                                </label>
                                <DescriptionPreview 
                                    text={formData.description}
                                    title="Description"
                                />
                            </>
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Editor */}
                                <div>
                                    <DescriptionEditor
                                        id="description"
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Enter a detailed description of this package.&#10;&#10;Tips:&#10;- Use '-' at the start of a line for bullet points&#10;- Use '1.', '2.' etc. for numbered lists&#10;- Lines ending with ':' will be styled as headers"
                                        maxLength={2000}
                                        disabled={isReadOnly}
                                        rows={10}
                                        label="Package Description"
                                        required={false}
                                    />
                                </div>
                                
                                {/* Live Preview */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Preview
                                    </label>
                                    <div className="border border-gray-200 rounded-md h-[calc(100%-28px)] min-h-[280px] overflow-auto">
                                        <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                                            <span className="text-xs text-gray-500">This is how the description will appear</span>
                                        </div>
                                        <div className="p-4">
                                            {formData.description ? (
                                                <DescriptionPreview 
                                                    text={formData.description}
                                                    title=""
                                                    className="border-0 p-0"
                                                />
                                            ) : (
                                                <p className="text-gray-400 text-sm text-center py-8">
                                                    Start typing to see the preview...
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Funder - Dropdown Select */}
                    <div className="mb-6">
                        <label htmlFor="funder" className="block text-sm font-medium text-gray-700 mb-2">
                            Funder *
                        </label>
                        {isReadOnly ? (
                            <input
                                type="text"
                                value={formData.funder}
                                disabled
                                className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                            />
                        ) : (
                            <>
                                <Select
                                    label="Select Funder"
                                    options={funderOptions}
                                    value={getSelectedFunderOption()}
                                    onClick={handleFunderChange}
                                    size="medium"
                                    className={`w-full ${
                                        (validationAttempted && fieldErrors.funder) ? 'border-red-300' : ''
                                    }`}
                                    required
                                />
                                {validationAttempted && fieldErrors.funder && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.funder}</p>
                                )}
                            </>
                        )}
                    </div>

                    {/* NDIS Package Type - Only for NDIS funder */}
                    {formData.funder === 'NDIS' && (
                        <div className="mb-6">
                            <label htmlFor="ndis_package_type" className="block text-sm font-medium text-gray-700 mb-2">
                                NDIS Package Type *
                            </label>
                            {isReadOnly ? (
                                <input
                                    type="text"
                                    value={formData.ndis_package_type}
                                    disabled
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-gray-500 cursor-not-allowed"
                                />
                            ) : (
                                <>
                                    <Select
                                        label="Select NDIS Package Type"
                                        options={ndisPackageTypeOptions}
                                        value={getSelectedNdisPackageTypeOption()}
                                        onClick={handleNdisPackageTypeChange}
                                        size="medium"
                                        className={`w-full ${
                                            (validationAttempted && fieldErrors.ndis_package_type) ? 'border-red-300' : ''
                                        }`}
                                        required
                                    />
                                    {validationAttempted && fieldErrors.ndis_package_type && (
                                        <p className="mt-1.5 text-sm text-red-600">{fieldErrors.ndis_package_type}</p>
                                    )}
                                </>
                            )}
                        </div>
                    )}

                    {/* NDIS Line Items - Only for NDIS funder */}
                    {formData.funder === 'NDIS' && (
                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-medium text-gray-900">
                                    PACKAGE PRICING
                                </h3>
                                {!isReadOnly && (
                                    <Button
                                        color="outline"
                                        size="small"
                                        label="+ Add Item"
                                        onClick={addNdisLineItem}
                                        icon={<Plus className="w-4 h-4" />}
                                    />
                                )}
                            </div>

                            {/* NDIS Line Items Table */}
                            <div className="border border-gray-300 rounded-lg overflow-visible">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-300">
                                    <div className="grid gap-4" style={{ gridTemplateColumns: '2fr 2fr 80px 80px 80px 80px 80px 60px' }}>
                                        <div className="font-medium text-gray-700">STA Package</div>
                                        <div className="font-medium text-gray-700">Line Item</div>
                                        <div className="font-medium text-gray-700">Price</div>
                                        <div className="font-medium text-gray-700">Rate Type</div>
                                        <div className="font-medium text-gray-700">Rate Category</div>
                                        <div className="font-medium text-gray-700">Item Type</div>
                                        <div className="font-medium text-gray-700">Care Time</div>
                                        <div className="font-medium text-gray-700 text-center">Action</div>
                                    </div>
                                </div>

                                {formData.ndis_line_items.length === 0 ? (
                                    <div className="px-4 py-8 text-center text-gray-500">
                                        No line items added yet. Click &quot;Add Item&quot; to get started.
                                    </div>
                                ) : (
                                    <div className="divide-y divide-gray-200">
                                        {formData.ndis_line_items.map((item, index) => (
                                            <div key={index} className="px-4 py-3">
                                                <div className="grid gap-4 items-start" style={{ gridTemplateColumns: '2fr 2fr 80px 80px 80px 80px 80px 60px' }}>
                                                    {/* STA Package */}
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={item.sta_package}
                                                            onChange={(e) => updateNdisLineItem(index, 'sta_package', e.target.value)}
                                                            placeholder="STA Package Name"
                                                            disabled={isReadOnly}
                                                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                                isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                                                (validationAttempted && fieldErrors[`ndis_line_item_${index}_sta_package`]) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                                            }`}
                                                        />
                                                        {validationAttempted && fieldErrors[`ndis_line_item_${index}_sta_package`] && (
                                                            <p className="mt-1 text-sm text-red-600">{fieldErrors[`ndis_line_item_${index}_sta_package`]}</p>
                                                        )}
                                                    </div>

                                                    {/* Line Item */}
                                                    <div>
                                                        <input
                                                            type="text"
                                                            value={item.line_item}
                                                            onChange={(e) => updateNdisLineItem(index, 'line_item', e.target.value)}
                                                            placeholder="Line Item Code"
                                                            disabled={isReadOnly}
                                                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                                isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                                                (validationAttempted && fieldErrors[`ndis_line_item_${index}_line_item`]) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                                            }`}
                                                        />
                                                        {validationAttempted && fieldErrors[`ndis_line_item_${index}_line_item`] && (
                                                            <p className="mt-1 text-sm text-red-600">{fieldErrors[`ndis_line_item_${index}_line_item`]}</p>
                                                        )}
                                                    </div>

                                                    {/* Price per Night */}
                                                    <div>
                                                        <input
                                                            type="number"
                                                            value={item.price_per_night}
                                                            onChange={(e) => updateNdisLineItem(index, 'price_per_night', e.target.value)}
                                                            placeholder="0.00"
                                                            step="0.01"
                                                            min="0"
                                                            disabled={isReadOnly}
                                                            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                                isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                                                (validationAttempted && fieldErrors[`ndis_line_item_${index}_price_per_night`]) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                                            }`}
                                                        />
                                                        {validationAttempted && fieldErrors[`ndis_line_item_${index}_price_per_night`] && (
                                                            <p className="mt-1 text-sm text-red-600">{fieldErrors[`ndis_line_item_${index}_price_per_night`]}</p>
                                                        )}
                                                    </div>

                                                    {/* Rate Type */}
                                                    <div>
                                                        <Select
                                                            label="Rate Type"
                                                            options={rateTypeOptions}
                                                            value={getSelectedRateTypeOption(item.rate_type)}
                                                            onClick={(selectedOption) => handleRateTypeChange(index, selectedOption)}
                                                            size="small"
                                                            className="w-full"
                                                            disabled={isReadOnly}
                                                            required
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                            menuPosition="fixed"
                                                            menuPlacement="auto"
                                                            styles={{
                                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                                menu: (base) => ({ ...base, zIndex: 9999 })
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Rate Category */}
                                                    <div>
                                                        <Select
                                                            label="Rate Category"
                                                            options={rateCategoryOptions}
                                                            value={getSelectedRateCategoryOption(item.rate_category)}
                                                            onClick={(selectedOption) => handleRateCategoryChange(index, selectedOption)}
                                                            size="small"
                                                            className="w-full"
                                                            disabled={isReadOnly}
                                                            required
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                            menuPosition="fixed"
                                                            menuPlacement="auto"
                                                            styles={{
                                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                                menu: (base) => ({ ...base, zIndex: 9999 })
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Line Item Type */}
                                                    <div>
                                                        <Select
                                                            label="Item Type"
                                                            options={lineItemTypeOptions}
                                                            value={getSelectedLineItemTypeOption(item.line_item_type)}
                                                            onClick={(selectedOption) => handleLineItemTypeChange(index, selectedOption)}
                                                            size="small"
                                                            className="w-full"
                                                            disabled={isReadOnly}
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                            menuPosition="fixed"
                                                            menuPlacement="auto"
                                                            styles={{
                                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                                menu: (base) => ({ ...base, zIndex: 9999 })
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Care Time - Only show if line_item_type is 'care' */}
                                                    <div>
                                                        <Select
                                                            label="Care Time"
                                                            options={careTimeOptions}
                                                            value={getSelectedCareTimeOption(item.care_time)}
                                                            onClick={(selectedOption) => handleCareTimeChange(index, selectedOption)}
                                                            size="small"
                                                            className="w-full"
                                                            disabled={isReadOnly || item.line_item_type !== 'care'}
                                                            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
                                                            menuPosition="fixed"
                                                            menuPlacement="auto"
                                                            styles={{
                                                                menuPortal: (base) => ({ ...base, zIndex: 9999 }),
                                                                menu: (base) => ({ ...base, zIndex: 9999 })
                                                            }}
                                                        />
                                                    </div>

                                                    {/* Action */}
                                                    <div className="flex justify-center">
                                                        {!isReadOnly && (
                                                            <button
                                                                type="button"
                                                                onClick={() => removeNdisLineItem(index)}
                                                                className="p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                                                                title="Remove Item"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {validationAttempted && fieldErrors.ndis_line_items && (
                                <p className="mt-1.5 text-sm text-red-600">{fieldErrors.ndis_line_items}</p>
                            )}
                        </div>
                    )}

                    {/* Regular Pricing - Only for Non-NDIS funder */}
                    {formData.funder === 'Non-NDIS' && (
                        <div className="mb-6">
                            <h3 className="text-lg font-medium text-gray-900 mb-4">
                                PRICING
                            </h3>
                            
                            <div className="max-w-md">
                                <label htmlFor="price" className="block text-sm font-medium text-gray-700 mb-2">
                                    Package Price (AUD) *
                                </label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    value={formData.price}
                                    onChange={handleInputChange}
                                    placeholder="00.00"
                                    step="0.01"
                                    min="0"
                                    required
                                    disabled={isReadOnly}
                                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        isReadOnly ? 'bg-gray-50 text-gray-500 cursor-not-allowed border-gray-300' : 
                                        (validationAttempted && fieldErrors.price) ? 'border-red-300 focus:ring-red-500' : 'border-gray-300'
                                    }`}
                                />
                                {validationAttempted && fieldErrors.price && (
                                    <p className="mt-1.5 text-sm text-red-600">{fieldErrors.price}</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </form>
        </>
    );
}