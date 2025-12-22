import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { Home, Bed, Bath, Users, DollarSign, Waves } from 'lucide-react';
import { checkFileSize } from '../../utilities/common';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));
const Spinner = dynamic(() => import('../ui/spinner'));

// Room type options based on existing data
const ROOM_TYPE_OPTIONS = [
    { value: 'studio', label: 'Studio' },
    { value: 'ocean_view', label: 'Ocean View' },
    { value: 'suite', label: 'Suite' },
    { value: 'ocean_view_suite', label: 'Ocean View Suite' }
];

// SVG placeholder for rooms (bed icon with background)
const ROOM_PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#E8F4F8"/>
  <g transform="translate(60, 45)">
    <rect x="0" y="35" width="80" height="25" rx="3" fill="#94A3B8"/>
    <rect x="5" y="20" width="25" height="18" rx="4" fill="#CBD5E1"/>
    <rect x="50" y="20" width="25" height="18" rx="4" fill="#CBD5E1"/>
    <rect x="0" y="55" width="8" height="10" rx="1" fill="#64748B"/>
    <rect x="72" y="55" width="8" height="10" rx="1" fill="#64748B"/>
  </g>
</svg>
`)}`;

export default function RoomForm({ mode, roomId, onCancel, onSuccess }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    
    // Validation state
    const [fieldErrors, setFieldErrors] = useState({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [validationAttempted, setValidationAttempted] = useState(false);

    const [room, setRoom] = useState({
        name: '',
        type: '',
        ergonomic_king_beds: 0,
        king_single_beds: 0,
        queen_sofa_beds: 0,
        bedrooms: 0,
        bathrooms: 0,
        ocean_view: false,
        max_guests: 0,
        price_per_night: 0,
        peak_rate: 0,
        hsp_pricing: 0,
        image_filename: '',
        image_url: ''
    });

    const isAddMode = mode === 'add';
    const isEditMode = mode === 'edit';
    const isViewMode = mode === 'view';

    // Required fields
    const requiredFields = ['name', 'type'];

    // Validation function
    const validateAllFields = useCallback(() => {
        const errors = {};

        // Name validation
        if (!room.name || room.name.trim() === '') {
            errors.name = 'Room name is required';
        }

        // Type validation
        if (!room.type || room.type.trim() === '') {
            errors.type = 'Room type is required';
        }

        // Numeric field validations
        const numericFields = [
            'ergonomic_king_beds', 'king_single_beds', 'queen_sofa_beds',
            'bedrooms', 'bathrooms', 'max_guests',
            'price_per_night', 'peak_rate', 'hsp_pricing'
        ];

        numericFields.forEach(field => {
            const value = room[field];
            if (value !== '' && value !== null && value !== undefined) {
                if (isNaN(parseFloat(value)) || parseFloat(value) < 0) {
                    errors[field] = 'Must be a non-negative number';
                }
            }
        });

        return { errors, isValid: Object.keys(errors).length === 0 };
    }, [room]);

    // Check form validity whenever room data changes
    useEffect(() => {
        const { errors, isValid } = validateAllFields();
        setFieldErrors(errors);
        setIsFormValid(isValid);
    }, [validateAllFields]);

    // Load room data for edit/view mode
    useEffect(() => {
        if ((isEditMode || isViewMode) && roomId) {
            loadRoom();
        }
    }, [roomId, mode]);

    const loadRoom = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/manage-room/${roomId}`);
            if (!response.ok) {
                throw new Error('Failed to load room');
            }
            const data = await response.json();
            
            setRoom({
                id: data.id,
                name: data.name || '',
                type: data.type || '',
                ergonomic_king_beds: data.ergonomic_king_beds || 0,
                king_single_beds: data.king_single_beds || 0,
                queen_sofa_beds: data.queen_sofa_beds || 0,
                bedrooms: data.bedrooms || 0,
                bathrooms: data.bathrooms || 0,
                ocean_view: data.ocean_view || false,
                max_guests: data.max_guests || 0,
                price_per_night: data.price_per_night || 0,
                peak_rate: data.peak_rate || 0,
                hsp_pricing: data.hsp_pricing || 0,
                image_filename: data.image_filename || '',
                image_url: data.image_url || ''
            });
            
            if (data.image_url) {
                setImagePreview(data.image_url);
            }
        } catch (error) {
            console.error('Error loading room:', error);
            toast.error('Failed to load room data');
        }
        setIsLoading(false);
    };

    // Handle field changes
    const handleFieldChange = (field, value) => {
        setRoom(prev => ({ ...prev, [field]: value }));
    };

    // Handle numeric field changes
    const handleNumericChange = (field, value) => {
        const numValue = value === '' ? 0 : parseFloat(value);
        handleFieldChange(field, isNaN(numValue) ? 0 : numValue);
    };

    // Handle image selection
    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const fileSizeMsg = checkFileSize(file.size, 5120000);
            if (fileSizeMsg) {
                toast.error(fileSizeMsg);
                return;
            }
            
            setSelectedFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
        e.target.value = null;
    };

    // Upload image
    const uploadImage = async (roomId) => {
        if (!selectedFile) return null;
        
        const formData = new FormData();
        formData.append("fileType", "room-type-photo");
        formData.append("file", selectedFile);

        const response = await fetch(`/api/storage/room-type-photo?id=${roomId}`, {
            method: "POST",
            body: formData,
        });
        
        if (response.status === 413) {
            toast.error("File size is too large. Please upload a file with a maximum size of 5MB.");
            return null;
        }
        
        const data = await response.json();
        return data.imageUrl;
    };

    // Save room
    const handleSave = async () => {
        setValidationAttempted(true);
        
        const { errors, isValid } = validateAllFields();
        if (!isValid) {
            setFieldErrors(errors);
            toast.error('Please fill in all required fields correctly');
            return;
        }

        setIsSaving(true);
        try {
            const roomData = {
                ...room,
                ergonomic_king_beds: parseInt(room.ergonomic_king_beds) || 0,
                king_single_beds: parseInt(room.king_single_beds) || 0,
                queen_sofa_beds: parseInt(room.queen_sofa_beds) || 0,
                bedrooms: parseInt(room.bedrooms) || 0,
                bathrooms: parseInt(room.bathrooms) || 0,
                ocean_view: room.ocean_view ? 1 : 0,
                max_guests: parseInt(room.max_guests) || 0,
                price_per_night: parseFloat(room.price_per_night) || 0,
                peak_rate: parseFloat(room.peak_rate) || 0,
                hsp_pricing: parseFloat(room.hsp_pricing) || 0,
            };

            const response = await fetch('/api/manage-room/add-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(roomData)
            });

            if (!response.ok) {
                throw new Error('Failed to save room');
            }

            const result = await response.json();
            const savedRoomId = result.id || room.id;

            // Upload image if selected
            if (selectedFile && savedRoomId) {
                await uploadImage(savedRoomId);
            }

            toast.success(isAddMode ? 'Room created successfully!' : 'Room updated successfully!');
            onSuccess && onSuccess();
        } catch (error) {
            console.error('Error saving room:', error);
            toast.error('Failed to save room');
        }
        setIsSaving(false);
    };

    // Get field error
    const getFieldError = (fieldName) => {
        return validationAttempted ? fieldErrors[fieldName] : '';
    };

    // Format currency for display
    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === 0) return '$0.00';
        return `$${parseFloat(value).toFixed(2)}`;
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
                                onClick={() => router.push('/settings/manage-room')}
                                className="hover:text-blue-600 transition-colors font-medium"
                            >
                                ROOM SETUP
                            </button>
                            <span>/</span>
                            <span className="font-medium text-gray-900 uppercase">
                                {room.name || 'ROOM DETAILS'}
                            </span>
                        </div>
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label="EDIT ROOM"
                            onClick={() => {
                                router.push(`/settings/manage-room?mode=edit&id=${roomId}`, undefined, { shallow: true });
                            }}
                        />
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                        <div className="p-6">
                            <div className="flex flex-col md:flex-row gap-8">
                                {/* Room Image */}
                                <div className="md:w-1/3">
                                    <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 mb-4">
                                        <img 
                                            src={room.image_url || ROOM_PLACEHOLDER_SVG} 
                                            alt={room.name || 'Room'}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                e.target.onerror = null;
                                                e.target.src = ROOM_PLACEHOLDER_SVG;
                                            }}
                                        />
                                    </div>
                                </div>

                                {/* Room Details */}
                                <div className="md:w-2/3">
                                    <h1 className="text-2xl font-bold text-gray-900 mb-2">{room.name}</h1>
                                    <p className="text-sm text-gray-500 mb-6">Type: {ROOM_TYPE_OPTIONS.find(opt => opt.value === room.type)?.label || room.type || '-'}</p>

                                    {/* Room Features Grid */}
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                        <div className="p-4 rounded-lg" style={{ background: '#F1F3F6' }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Bed className="w-4 h-4 text-gray-500" />
                                                <span className="text-xs text-gray-500">Bedrooms</span>
                                            </div>
                                            <span className="text-lg font-semibold">{room.bedrooms}</span>
                                        </div>
                                        <div className="p-4 rounded-lg" style={{ background: '#F1F3F6' }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Bath className="w-4 h-4 text-gray-500" />
                                                <span className="text-xs text-gray-500">Bathrooms</span>
                                            </div>
                                            <span className="text-lg font-semibold">{room.bathrooms}</span>
                                        </div>
                                        <div className="p-4 rounded-lg" style={{ background: '#F1F3F6' }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Users className="w-4 h-4 text-gray-500" />
                                                <span className="text-xs text-gray-500">Max Guests</span>
                                            </div>
                                            <span className="text-lg font-semibold">{room.max_guests}</span>
                                        </div>
                                        <div className="p-4 rounded-lg" style={{ background: '#F1F3F6' }}>
                                            <div className="flex items-center gap-2 mb-1">
                                                <Waves className="w-4 h-4 text-gray-500" />
                                                <span className="text-xs text-gray-500">Ocean View</span>
                                            </div>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                                room.ocean_view ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {room.ocean_view ? 'Yes' : 'No'}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Bed Configuration */}
                                    <div className="rounded-lg border border-gray-200 p-4 mb-6">
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Bed Configuration</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <span className="text-xs text-gray-500">Ergonomic King Single</span>
                                                <p className="text-lg font-semibold">{room.ergonomic_king_beds}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">King Single</span>
                                                <p className="text-lg font-semibold">{room.king_single_beds}</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Queen Sofa</span>
                                                <p className="text-lg font-semibold">{room.queen_sofa_beds}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Pricing */}
                                    <div className="rounded-lg border border-gray-200 p-4">
                                        <h3 className="text-sm font-medium text-gray-900 mb-3">Pricing (AUD)</h3>
                                        <div className="grid grid-cols-3 gap-4">
                                            <div>
                                                <span className="text-xs text-gray-500">Standard Rate</span>
                                                <p className="text-lg font-semibold text-green-600">{formatCurrency(room.price_per_night)}/night</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">Peak Rate</span>
                                                <p className="text-lg font-semibold text-orange-600">{formatCurrency(room.peak_rate)}/night</p>
                                            </div>
                                            <div>
                                                <span className="text-xs text-gray-500">HSP Rate</span>
                                                <p className="text-lg font-semibold text-blue-600">{formatCurrency(room.hsp_pricing)}/night</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Add/Edit Mode - Form
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Home className="w-4 h-4" />
                        <button 
                            onClick={() => router.push('/settings/manage-room')}
                            className="hover:text-blue-600 transition-colors"
                        >
                            ROOM SETUP
                        </button>
                        <span>/</span>
                        <span className="font-medium">
                            {isAddMode && 'ADD ROOM'}
                            {isEditMode && 'EDIT ROOM'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button
                            type="button"
                            color="outline"
                            size="medium"
                            label="CANCEL"
                            onClick={onCancel}
                        />
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label={isSaving ? 'SAVING...' : 'SAVE ROOM'}
                            onClick={handleSave}
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </div>

            {/* Form Content */}
            <div className="p-6">
                <div className="bg-white rounded-lg shadow-sm">
                    <div className="p-6">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Image Upload Section */}
                            <div className="md:w-1/3">
                                <h3 className="text-sm font-medium text-gray-900 mb-3">Room Image</h3>
                                <div className="aspect-video rounded-lg overflow-hidden bg-gray-100 mb-4 relative group cursor-pointer">
                                    <img 
                                        src={imagePreview || ROOM_PLACEHOLDER_SVG} 
                                        alt={room.name || 'Room preview'}
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                            e.target.onerror = null;
                                            e.target.src = ROOM_PLACEHOLDER_SVG;
                                        }}
                                    />
                                    <label className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                        <span className="text-white text-sm font-medium">
                                            {imagePreview ? 'Change Photo' : 'Upload Photo'}
                                        </span>
                                        <input 
                                            type="file" 
                                            className="hidden" 
                                            accept="image/*"
                                            onChange={handleImageChange}
                                        />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">Max file size: 5MB. Supported formats: JPG, PNG, GIF</p>
                            </div>

                            {/* Form Fields */}
                            <div className="md:w-2/3">
                                {/* Basic Info */}
                                <h3 className="text-sm font-medium text-gray-900 mb-4">Basic Information</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <TextField
                                        label="Room Name"
                                        required={true}
                                        value={room.name}
                                        onChange={(val) => handleFieldChange('name', val)}
                                        error={getFieldError('name')}
                                        placeholder="e.g., Standard Studio Room"
                                    />
                                    <div className="flex flex-col">
                                        <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                                            Room Type
                                            <span className="text-red-500 ml-1">*</span>
                                        </label>
                                        <Select
                                            label={room.type ? ROOM_TYPE_OPTIONS.find(opt => opt.value === room.type)?.label : 'Select room type'}
                                            options={ROOM_TYPE_OPTIONS}
                                            value={room.type ? ROOM_TYPE_OPTIONS.find(opt => opt.value === room.type) : null}
                                            onClick={(selected) => handleFieldChange('type', selected?.value || '')}
                                            size="medium"
                                        />
                                        {getFieldError('type') && (
                                            <p className="mt-1.5 text-red-500 text-xs">{getFieldError('type')}</p>
                                        )}
                                    </div>
                                </div>

                                {/* Room Configuration */}
                                <h3 className="text-sm font-medium text-gray-900 mb-4">Room Configuration</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                    <TextField
                                        label="Bedrooms"
                                        type="number"
                                        value={room.bedrooms}
                                        onChange={(val) => handleNumericChange('bedrooms', val)}
                                        error={getFieldError('bedrooms')}
                                    />
                                    <TextField
                                        label="Bathrooms"
                                        type="number"
                                        value={room.bathrooms}
                                        onChange={(val) => handleNumericChange('bathrooms', val)}
                                        error={getFieldError('bathrooms')}
                                    />
                                    <TextField
                                        label="Max Guests"
                                        type="number"
                                        value={room.max_guests}
                                        onChange={(val) => handleNumericChange('max_guests', val)}
                                        error={getFieldError('max_guests')}
                                    />
                                    <div className="flex flex-col">
                                        <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                                            Ocean View
                                        </label>
                                        <div className="flex items-center h-12 space-x-4">
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="ocean_view"
                                                    checked={room.ocean_view === true || room.ocean_view === 1}
                                                    onChange={() => handleFieldChange('ocean_view', true)}
                                                    className="mr-2"
                                                />
                                                <span>Yes</span>
                                            </label>
                                            <label className="flex items-center cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="ocean_view"
                                                    checked={room.ocean_view === false || room.ocean_view === 0}
                                                    onChange={() => handleFieldChange('ocean_view', false)}
                                                    className="mr-2"
                                                />
                                                <span>No</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                {/* Bed Configuration */}
                                <h3 className="text-sm font-medium text-gray-900 mb-4">Bed Configuration</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <TextField
                                        label="Ergonomic King Single Beds"
                                        type="number"
                                        value={room.ergonomic_king_beds}
                                        onChange={(val) => handleNumericChange('ergonomic_king_beds', val)}
                                        error={getFieldError('ergonomic_king_beds')}
                                    />
                                    <TextField
                                        label="King Single Beds"
                                        type="number"
                                        value={room.king_single_beds}
                                        onChange={(val) => handleNumericChange('king_single_beds', val)}
                                        error={getFieldError('king_single_beds')}
                                    />
                                    <TextField
                                        label="Queen Sofa Beds"
                                        type="number"
                                        value={room.queen_sofa_beds}
                                        onChange={(val) => handleNumericChange('queen_sofa_beds', val)}
                                        error={getFieldError('queen_sofa_beds')}
                                    />
                                </div>

                                {/* Pricing */}
                                <h3 className="text-sm font-medium text-gray-900 mb-4">Pricing (AUD per night)</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <TextField
                                        label="Standard Rate"
                                        type="number"
                                        value={room.price_per_night}
                                        onChange={(val) => handleNumericChange('price_per_night', val)}
                                        error={getFieldError('price_per_night')}
                                        placeholder="0.00"
                                    />
                                    <TextField
                                        label="Peak Rate"
                                        type="number"
                                        value={room.peak_rate}
                                        onChange={(val) => handleNumericChange('peak_rate', val)}
                                        error={getFieldError('peak_rate')}
                                        placeholder="0.00"
                                    />
                                    <TextField
                                        label="HSP Rate"
                                        type="number"
                                        value={room.hsp_pricing}
                                        onChange={(val) => handleNumericChange('hsp_pricing', val)}
                                        error={getFieldError('hsp_pricing')}
                                        placeholder="0.00"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    HSP Rate: Hospital Substitution Program pricing for eligible participants
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}