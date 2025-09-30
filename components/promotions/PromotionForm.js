// components/promotions/PromotionForm.js
import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { Home, Archive, Image as ImageIcon } from 'lucide-react';
import moment from 'moment';
import { checkFileSize } from '../../utilities/common';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));
const Spinner = dynamic(() => import('../ui/spinner'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));

export default function PromotionForm({ mode, promotionId, onCancel, onSuccess }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    
    // Validation state
    const [fieldErrors, setFieldErrors] = useState({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [validationAttempted, setValidationAttempted] = useState(false);

    const [promotion, setPromotion] = useState({
        title: '',
        description: '',
        availability: '',
        terms: '',
        start_date: '',
        end_date: '',
        image_filename: '',
        status: 'draft',
        order: 0
    });

    const isAddMode = mode === 'add';
    const isEditMode = mode === 'edit';
    const isViewMode = mode === 'view';

    // Validation function
    const validateAllFields = useCallback(() => {
        const errors = {};

        // Title validation
        if (!promotion.title || promotion.title.trim() === '') {
            errors.title = 'Title is required';
        }

        // Date validation
        if (promotion.start_date && promotion.end_date) {
            const startDate = new Date(promotion.start_date);
            const endDate = new Date(promotion.end_date);
            
            if (endDate < startDate) {
                errors.end_date = 'End date must be after start date';
            }
        }

        return { errors, isValid: Object.keys(errors).length === 0 };
    }, [promotion]);

    // Check form validity
    useEffect(() => {
        const { errors, isValid } = validateAllFields();
        setFieldErrors(errors);
        setIsFormValid(isValid);
    }, [validateAllFields]);

    // Load promotion data
    useEffect(() => {
        if ((isEditMode || isViewMode) && promotionId) {
            loadPromotion();
        } else if (isAddMode) {
            setSelectedFile(null);
        }
    }, [promotionId, mode]);

    const loadPromotion = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/promotions/${promotionId}`);
            if (!response.ok) {
                throw new Error('Failed to load promotion');
            }
            const result = await response.json();
            const promotionData = result.data || result;
            
            setPromotion({
                ...promotionData,
                start_date: promotionData.start_date ? new Date(promotionData.start_date).toISOString().split('T')[0] : '',
                end_date: promotionData.end_date ? new Date(promotionData.end_date).toISOString().split('T')[0] : ''
            });
        } catch (error) {
            console.error('Error loading promotion:', error);
            toast.error('Failed to load promotion');
        }
        setIsLoading(false);
    };

    const handleInputChange = (field, value) => {
        setPromotion(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Check file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
            toast.error('File size must be less than 10MB');
            return;
        }

        // Check file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only JPG, PNG, and GIF images are allowed');
            return;
        }

        setSelectedFile(file);
        setImageLoadError(false);
    };

    const uploadImageFile = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileType', 'promotions/');
            formData.append('metadata', JSON.stringify({
                promotionId: promotionId,
                uploadedBy: 'promotion-form'
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

    const handleSave = async (statusToSave) => {
        setValidationAttempted(true);

        // Validate for publishing
        if (statusToSave === 'published') {
            const { errors, isValid } = validateAllFields();
            if (!isValid) {
                toast.error('Please fix all validation errors before publishing');
                return;
            }
        }

        // Set appropriate loading state
        if (statusToSave === 'draft') {
            setIsSavingDraft(true);
        } else if (statusToSave === 'published') {
            setIsPublishing(true);
        } else if (statusToSave === 'archived') {
            setIsArchiving(true);
        }

        try {
            let imageFilename = promotion.image_filename;

            // Upload image if new file selected
            if (selectedFile) {
                try {
                    imageFilename = await uploadImageFile(selectedFile);
                    toast.success('Image uploaded successfully');
                } catch (error) {
                    toast.error('Failed to upload image: ' + error.message);
                    if (statusToSave === 'draft') {
                        setIsSavingDraft(false);
                    } else if (statusToSave === 'published') {
                        setIsPublishing(false);
                    } else {
                        setIsArchiving(false);
                    }
                    return;
                }
            }

            const promotionData = {
                ...promotion,
                image_filename: imageFilename,
                status: statusToSave
            };

            const url = isAddMode 
                ? '/api/promotions' 
                : `/api/promotions/${promotionId}`;
            
            const method = isAddMode ? 'POST' : 'PUT';

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(promotionData)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Failed to save promotion');
            }

            // Update local state
            setPromotion(prev => ({
                ...prev,
                image_filename: imageFilename,
                status: statusToSave
            }));
            setSelectedFile(null);

            const statusText = statusToSave === 'draft' ? 'saved as draft' : 
                             statusToSave === 'published' ? 'published' : 'archived';
            toast.success(`Promotion ${statusText} successfully`);
            
            if (onSuccess) {
                onSuccess();
            }
        } catch (error) {
            console.error('Error saving promotion:', error);
            toast.error(error.message || 'Failed to save promotion');
        } finally {
            setIsSavingDraft(false);
            setIsPublishing(false);
            setIsArchiving(false);
        }
    };

    const handleArchive = () => {
        setShowArchiveDialog(true);
    };

    const confirmArchive = async () => {
        setShowArchiveDialog(false);
        await handleSave('archived');
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            draft: { type: 'default', label: 'Draft' },
            published: { type: 'success', label: 'Published' },
            archived: { type: 'default', label: 'Archived' }
        };
        const config = statusConfig[status] || statusConfig.draft;
        return <StatusBadge type={config.type} label={config.label} size="small" />;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner />
            </div>
        );
    }

    // View Mode
    if (isViewMode) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Home className="w-4 h-4" />
                            <button 
                                onClick={() => router.push('/promotions')}
                                className="hover:text-blue-600 transition-colors"
                            >
                                PROMOTIONS
                            </button>
                            <span>/</span>
                            <span className="font-medium">VIEW PROMOTION</span>
                        </div>
                        <div className="flex items-center space-x-3">
                            <Button
                                type="button"
                                color="outline"
                                size="medium"
                                label="Back to List"
                                onClick={onCancel}
                            />
                            <Button
                                type="button"
                                color="primary"
                                size="medium"
                                label="Edit Promotion"
                                onClick={() => router.push(`/promotions?mode=edit&id=${promotionId}`)}
                            />
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column - Main Content */}
                            <div className="lg:col-span-2">
                                {/* Promotion Title */}
                                <h1 className="text-4xl font-bold text-gray-900 mb-6">
                                    {promotion.title || 'Promotion Title'}
                                </h1>

                                {/* Hero Image */}
                                <div className="mb-6">
                                    {promotion.imageUrl && !imageLoadError ? (
                                        <div className="w-full h-80 overflow-hidden rounded-lg">
                                            <img
                                                src={promotion.imageUrl}
                                                alt={promotion.title}
                                                className="w-full h-full object-cover"
                                                onError={() => setImageLoadError(true)}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-80 bg-gray-200 rounded-lg flex items-center justify-center">
                                            <div className="text-center text-gray-500">
                                                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <ImageIcon className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <div className="text-lg">No image available</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Description Section */}
                                {promotion.description && (
                                    <div className="mb-8">
                                        <h2 className="text-xl font-semibold text-gray-900 mb-3">
                                            Description
                                        </h2>
                                        <div className="prose max-w-none">
                                            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                                {promotion.description}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Terms & Conditions Section */}
                                {promotion.terms && (
                                    <div className="mb-8">
                                        <h2 className="text-xl font-semibold text-gray-900 mb-3">
                                            Terms & Conditions
                                        </h2>
                                        <div className="text-gray-700 leading-relaxed">
                                            {promotion.terms}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right Column - Sidebar Info */}
                            <div className="lg:col-span-1">
                                <div className="bg-white rounded-lg shadow-sm p-6 space-y-6 sticky top-6">
                                    {/* Status */}
                                    <div className="w-32">
                                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                                            Status
                                        </h3>
                                        {getStatusBadge(promotion.status)}
                                    </div>

                                    {/* Availability */}
                                    {promotion.availability && (
                                        <div className="pt-6 border-t border-gray-200">
                                            <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-2">
                                                Availability
                                            </h3>
                                            <p className="text-gray-900 font-medium">
                                                {promotion.availability}
                                            </p>
                                        </div>
                                    )}

                                    {/* Date Range */}
                                    <div className="pt-6 border-t border-gray-200">
                                        <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide mb-3">
                                            Promotion Period
                                        </h3>
                                        <div className="space-y-3">
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">Start Date</div>
                                                <div className="text-gray-900 font-medium">
                                                    {promotion.start_date ? moment(promotion.start_date).format('DD MMM YYYY') : 'Not set'}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-500 mb-1">End Date</div>
                                                <div className="text-gray-900 font-medium">
                                                    {promotion.end_date ? moment(promotion.end_date).format('DD MMM YYYY') : 'Not set'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Image Filename (for reference) */}
                                    {promotion.image_filename && (
                                        <div className="pt-6 border-t border-gray-200">
                                            <h3 className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                                                Image File
                                            </h3>
                                            <p className="text-xs text-gray-600 break-all">
                                                {promotion.image_filename}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Edit/Add Mode - Form with Two Column Layout
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Home className="w-4 h-4" />
                        <button 
                            onClick={() => router.push('/promotions')}
                            className="hover:text-blue-600 transition-colors"
                        >
                            PROMOTIONS
                        </button>
                        <span>/</span>
                        <span className="font-medium">
                            {isAddMode && 'ADD PROMOTION'}
                            {isEditMode && 'EDIT PROMOTION'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Archive button - only in edit mode if not already archived */}
                        {isEditMode && promotion.status !== 'archived' && (
                            <Button
                                type="button"
                                color="outline"
                                size="medium"
                                label={isArchiving ? 'Archiving...' : 'Archive'}
                                onClick={handleArchive}
                                disabled={isArchiving || isSavingDraft || isPublishing}
                                icon={<Archive className="w-4 h-4" />}
                            />
                        )}
                        <Button
                            type="button"
                            color="outline"
                            size="medium"
                            label="Cancel"
                            onClick={onCancel}
                            disabled={isSavingDraft || isPublishing || isArchiving}
                        />
                        <Button
                            type="button"
                            color="outline"
                            size="medium"
                            label={isSavingDraft ? 'Saving...' : 'Save as Draft'}
                            onClick={() => handleSave('draft')}
                            disabled={isSavingDraft || isPublishing || isArchiving}
                        />
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label={isPublishing ? 'Publishing...' : 'Publish'}
                            onClick={() => handleSave('published')}
                            disabled={!isFormValid || isSavingDraft || isPublishing || isArchiving}
                        />
                    </div>
                </div>
            </div>

            {/* Form Content - Two Column Layout */}
            <div className="max-w-7xl mx-auto py-8 px-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column - Form Fields (2/3 width) */}
                    <div className="lg:col-span-2">
                        <div className="bg-white rounded-lg shadow-sm p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-6">
                                {isAddMode ? 'Create New Promotion' : 'Edit Promotion'}
                            </h2>

                            <div className="space-y-6">
                                {/* Title */}
                                <TextField
                                    label="Title"
                                    placeholder="Enter promotion title"
                                    value={promotion.title}
                                    onChange={(value) => handleInputChange('title', value)}
                                    error={validationAttempted && fieldErrors.title}
                                    required
                                />

                                {/* Description */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Description
                                    </label>
                                    <textarea
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        rows="4"
                                        placeholder="Enter promotion description"
                                        value={promotion.description}
                                        onChange={(e) => handleInputChange('description', e.target.value)}
                                    />
                                </div>

                                {/* Date Range */}
                                <div className="grid grid-cols-2 gap-4">
                                    <DateComponent
                                        label="Start Date"
                                        value={promotion.start_date}
                                        onChange={(date) => handleInputChange('start_date', date)}
                                    />
                                    <DateComponent
                                        label="End Date"
                                        value={promotion.end_date}
                                        onChange={(date) => handleInputChange('end_date', date)}
                                        error={validationAttempted && fieldErrors.end_date}
                                    />
                                </div>

                                {/* Availability Display Text */}
                                <TextField
                                    label="Availability Display Text"
                                    placeholder="e.g., Available all year or 01 Apr, 2025 - 30 Apr, 2025"
                                    value={promotion.availability}
                                    onChange={(value) => handleInputChange('availability', value)}
                                    helpText="This text will be displayed to guests (e.g., 'Available all year')"
                                />

                                {/* Terms */}
                                <TextField
                                    label="Terms & Conditions"
                                    placeholder="e.g., Book 3+ nights stay"
                                    value={promotion.terms}
                                    onChange={(value) => handleInputChange('terms', value)}
                                />

                                {/* Status Badge - only show in edit mode */}
                                {isEditMode && (
                                    <div className="pt-4 border-t border-gray-200">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Current Status
                                        </label>
                                        {getStatusBadge(promotion.status)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Image Upload (1/3 width) */}
                    <div className="lg:col-span-1">
                        <div className="bg-white rounded-lg shadow-sm p-6 sticky top-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">
                                Promotion Image
                            </h3>

                            {/* Image Upload Area */}
                            <div className="mb-4">
                                <label className="cursor-pointer block">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-blue-500 transition-colors text-center">
                                        {!selectedFile && !promotion.image_filename && (
                                            <>
                                                <div className="w-16 h-16 mx-auto mb-2 bg-gray-100 rounded-full flex items-center justify-center">
                                                    <ImageIcon className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <span className="text-blue-600 hover:text-blue-700">
                                                        Click to upload photos
                                                    </span>
                                                    <br />
                                                    (JPG, PNG, GIF)
                                                </div>
                                            </>
                                        )}

                                        {selectedFile && (
                                            <div className="space-y-2">
                                                {selectedFile.type.startsWith('image/') && (
                                                    <div className="mb-4">
                                                        <img
                                                            src={URL.createObjectURL(selectedFile)}
                                                            alt="Preview"
                                                            className="w-full h-32 object-cover rounded-lg"
                                                        />
                                                    </div>
                                                )}
                                                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                                    Image will be uploaded when you save the promotion
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    Selected: <span className="font-medium text-blue-600">{selectedFile.name}</span>
                                                </div>
                                                <span className="text-blue-600 hover:text-blue-700 text-sm">
                                                    Change image
                                                </span>
                                            </div>
                                        )}

                                        {!selectedFile && promotion.image_filename && (
                                            <div className="space-y-2">
                                                {promotion.imageUrl && !imageLoadError ? (
                                                    <div className="mb-4">
                                                        <img
                                                            src={promotion.imageUrl}
                                                            alt="Current promotion image"
                                                            className="w-full h-32 object-cover rounded-lg"
                                                            onError={() => setImageLoadError(true)}
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="w-full h-32 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                                                        <ImageIcon className="w-8 h-8 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="text-sm text-gray-600">
                                                    Current image: <span className="font-medium text-green-600">{promotion.image_filename}</span>
                                                </div>
                                                <span className="text-blue-600 hover:text-blue-700 text-sm">
                                                    Change image
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </label>
                                
                                <div className="mt-2 text-xs text-gray-500 text-center">
                                    You can upload photos up to <strong>10MB</strong>
                                </div>
                            </div>

                            {/* Upload Instructions */}
                            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-2">
                                    <strong>Image Guidelines:</strong>
                                </p>
                                <ul className="text-xs text-gray-600 space-y-1">
                                    <li>• Recommended: 800x600px</li>
                                    <li>• Max size: 10MB</li>
                                    <li>• Format: JPG, PNG, or GIF</li>
                                    <li>• High quality images work best</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Archive Confirmation Dialog */}
            {showArchiveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Archive Promotion
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Are you sure you want to archive this promotion? It will no longer be visible to guests.
                        </p>
                        <div className="flex gap-3 justify-end">
                            <Button
                                type="button"
                                color="outline"
                                size="medium"
                                label="Cancel"
                                onClick={() => setShowArchiveDialog(false)}
                            />
                            <Button
                                type="button"
                                color="primary"
                                size="medium"
                                label="Archive"
                                onClick={confirmArchive}
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}