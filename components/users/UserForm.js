import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { User, Mail, Phone, Lock, Shield } from 'lucide-react';

const Button = dynamic(() => import('../ui-v2/Button'));
const Spinner = dynamic(() => import('../ui/spinner'));

export default function UserForm({ 
    mode = 'add', // 'add', 'edit', or 'view'
    userId = null,
    onCancel,
    onSuccess 
}) {
    const isEditMode = mode === 'edit' && userId;
    const isViewMode = mode === 'view';
    const isReadOnly = isViewMode;

    const [formData, setFormData] = useState({
        first_name: '',
        last_name: '',
        email: '',
        password: '',
        confirm_password: '',
        phone_number: '',
        role: ''
    });

    const [roles, setRoles] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [validationAttempted, setValidationAttempted] = useState(false);

    // Load user data if in edit/view mode
    useEffect(() => {
        if (isEditMode || isViewMode) {
            loadUserData();
        }
        loadRoles();
    }, [userId, mode]);

    const loadUserData = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/users/${userId}`);
            if (response.ok) {
                const data = await response.json();
                setFormData({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    email: data.email || '',
                    password: '',
                    confirm_password: '',
                    phone_number: data.phone_number || '',
                    role: data.Roles && data.Roles.length > 0 ? data.Roles[0].name : ''
                });
            } else {
                toast.error('Failed to load user data');
                if (onCancel) onCancel();
            }
        } catch (error) {
            console.error('Error loading user:', error);
            toast.error('Failed to load user data');
            if (onCancel) onCancel();
        }
        setIsLoading(false);
    };

    const loadRoles = async () => {
        try {
            const response = await fetch('/api/acl/roles-and-permissions');
            const data = await response.json();
            if (response.ok) {
                setRoles(data.roles || []);
            }
        } catch (error) {
            console.error('Error loading roles:', error);
        }
    };

    // Validation
    const validateForm = () => {
        const errors = {};

        if (!formData.first_name.trim()) {
            errors.first_name = 'First name is required';
        }

        if (!formData.last_name.trim()) {
            errors.last_name = 'Last name is required';
        }

        if (!formData.email.trim()) {
            errors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'Invalid email format';
        }

        if (!isEditMode) {
            // Password required only for new users
            if (!formData.password) {
                errors.password = 'Password is required';
            } else if (formData.password.length < 6) {
                errors.password = 'Password must be at least 6 characters';
            }

            if (!formData.confirm_password) {
                errors.confirm_password = 'Please confirm password';
            } else if (formData.password !== formData.confirm_password) {
                errors.confirm_password = 'Passwords do not match';
            }
        } else if (formData.password || formData.confirm_password) {
            // If changing password in edit mode
            if (formData.password.length < 6) {
                errors.password = 'Password must be at least 6 characters';
            }
            if (formData.password !== formData.confirm_password) {
                errors.confirm_password = 'Passwords do not match';
            }
        }

        if (!formData.role) {
            errors.role = 'Role is required';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));

        // Clear field error when user starts typing
        if (fieldErrors[field]) {
            setFieldErrors(prev => ({
                ...prev,
                [field]: ''
            }));
        }
    };

    const handleSubmit = async () => {
        setValidationAttempted(true);

        if (!validateForm()) {
            toast.error('Please fill in all required fields correctly');
            return;
        }

        setIsSubmitting(true);

        try {
            const url = isEditMode ? `/api/users/${userId}` : '/api/users/create';
            const method = isEditMode ? 'POST' : 'POST';

            const submitData = { ...formData };
            
            // Don't send empty password fields in edit mode
            if (isEditMode && !formData.password) {
                delete submitData.password;
                delete submitData.confirm_password;
            }

            const response = await fetch(url, {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(submitData)
            });

            const data = await response.json();

            if (response.ok) {
                toast.success(isEditMode ? 'User updated successfully' : 'User created successfully');
                if (onSuccess) {
                    onSuccess({ action: isEditMode ? 'edit' : 'add', id: data.user?.uuid || userId });
                }
            } else {
                toast.error(data.message || 'Failed to save user');
            }
        } catch (error) {
            console.error('Error saving user:', error);
            toast.error('Failed to save user');
        }

        setIsSubmitting(false);
    };

    const handleDelete = async () => {
        if (!window.confirm('Are you sure you want to delete this user?')) {
            return;
        }

        setIsSubmitting(true);

        try {
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                toast.success('User deleted successfully');
                if (onSuccess) {
                    onSuccess({ action: 'delete' });
                }
            } else {
                const data = await response.json();
                toast.error(data.message || 'Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            toast.error('Failed to delete user');
        }

        setIsSubmitting(false);
    };

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isViewMode ? 'View User' : isEditMode ? 'Edit User' : 'Add New User'}
                        </h1>
                        <p className="text-sm text-gray-600 mt-1">
                            {isViewMode 
                                ? 'User details' 
                                : isEditMode 
                                    ? 'Update user information and role' 
                                    : 'Create a new system user'}
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <Button
                            color="tertiary"
                            size="medium"
                            label="CANCEL"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        />
                        {isViewMode ? (
                            <Button
                                type="button"
                                color="primary"
                                size="medium"
                                label="EDIT USER"
                                onClick={() => {
                                    if (onSuccess) {
                                        onSuccess({ action: 'edit', id: userId });
                                    }
                                }}
                            />
                        ) : (
                            <Button
                                color="primary"
                                size="medium"
                                label={isEditMode ? 'UPDATE USER' : 'CREATE USER'}
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            />
                        )}
                    </div>
                </div>

                {/* Form Content */}
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Information Section */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <User className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900">Personal Information</h2>
                                </div>

                                <div className="space-y-4">
                                    {/* First Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            First Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.first_name}
                                            onChange={(e) => handleInputChange('first_name', e.target.value)}
                                            disabled={isReadOnly}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                            } ${
                                                validationAttempted && fieldErrors.first_name ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter first name"
                                        />
                                        {validationAttempted && fieldErrors.first_name && (
                                            <p className="mt-1 text-sm text-red-500">{fieldErrors.first_name}</p>
                                        )}
                                    </div>

                                    {/* Last Name */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Last Name <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.last_name}
                                            onChange={(e) => handleInputChange('last_name', e.target.value)}
                                            disabled={isReadOnly}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                            } ${
                                                validationAttempted && fieldErrors.last_name ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter last name"
                                        />
                                        {validationAttempted && fieldErrors.last_name && (
                                            <p className="mt-1 text-sm text-red-500">{fieldErrors.last_name}</p>
                                        )}
                                    </div>

                                    {/* Phone Number */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Phone Number
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Phone className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <input
                                                type="tel"
                                                value={formData.phone_number}
                                                onChange={(e) => handleInputChange('phone_number', e.target.value)}
                                                disabled={isReadOnly}
                                                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                    isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                                } border-gray-300`}
                                                placeholder="Enter phone number"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Account Information Section */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center space-x-3 mb-4">
                                    <div className="p-2 bg-blue-100 rounded-lg">
                                        <Mail className="w-6 h-6 text-blue-600" />
                                    </div>
                                    <h2 className="text-xl font-semibold text-gray-900">Account Information</h2>
                                </div>

                                <div className="space-y-4">
                                    {/* Email */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Email <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.email}
                                            onChange={(e) => handleInputChange('email', e.target.value)}
                                            disabled={isReadOnly}
                                            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                            } ${
                                                validationAttempted && fieldErrors.email ? 'border-red-500' : 'border-gray-300'
                                            }`}
                                            placeholder="Enter email address"
                                        />
                                        {validationAttempted && fieldErrors.email && (
                                            <p className="mt-1 text-sm text-red-500">{fieldErrors.email}</p>
                                        )}
                                    </div>

                                    {/* Role */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Role <span className="text-red-500">*</span>
                                        </label>
                                        <div className="relative">
                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                <Shield className="h-5 w-5 text-gray-400" />
                                            </div>
                                            <select
                                                value={formData.role}
                                                onChange={(e) => handleInputChange('role', e.target.value)}
                                                disabled={isReadOnly}
                                                className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                    isReadOnly ? 'bg-gray-50 cursor-not-allowed' : ''
                                                } ${
                                                    validationAttempted && fieldErrors.role ? 'border-red-500' : 'border-gray-300'
                                                }`}
                                            >
                                                <option value="">Select a role</option>
                                                {roles.map((role) => (
                                                    <option key={role.id} value={role.name}>
                                                        {role.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {validationAttempted && fieldErrors.role && (
                                            <p className="mt-1 text-sm text-red-500">{fieldErrors.role}</p>
                                        )}
                                    </div>

                                    {/* Password Fields - Show only in add mode or when changing password in edit mode */}
                                    {!isViewMode && (
                                        <>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Password {!isEditMode && <span className="text-red-500">*</span>}
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Lock className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="password"
                                                        value={formData.password}
                                                        onChange={(e) => handleInputChange('password', e.target.value)}
                                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                            validationAttempted && fieldErrors.password ? 'border-red-500' : 'border-gray-300'
                                                        }`}
                                                        placeholder={isEditMode ? "Leave blank to keep current password" : "Enter password"}
                                                    />
                                                </div>
                                                {validationAttempted && fieldErrors.password && (
                                                    <p className="mt-1 text-sm text-red-500">{fieldErrors.password}</p>
                                                )}
                                                {isEditMode && (
                                                    <p className="mt-1 text-xs text-gray-500">
                                                        Leave blank to keep current password
                                                    </p>
                                                )}
                                            </div>

                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    Confirm Password {!isEditMode && <span className="text-red-500">*</span>}
                                                </label>
                                                <div className="relative">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <Lock className="h-5 w-5 text-gray-400" />
                                                    </div>
                                                    <input
                                                        type="password"
                                                        value={formData.confirm_password}
                                                        onChange={(e) => handleInputChange('confirm_password', e.target.value)}
                                                        className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                                            validationAttempted && fieldErrors.confirm_password ? 'border-red-500' : 'border-gray-300'
                                                        }`}
                                                        placeholder="Confirm password"
                                                    />
                                                </div>
                                                {validationAttempted && fieldErrors.confirm_password && (
                                                    <p className="mt-1 text-sm text-red-500">{fieldErrors.confirm_password}</p>
                                                )}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Delete Button - Only show in edit mode */}
                    {isEditMode && !isViewMode && (
                        <div className="mt-6 pt-6 border-t border-gray-200">
                            <Button
                                color="danger"
                                size="medium"
                                label="DELETE USER"
                                onClick={handleDelete}
                                disabled={isSubmitting}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}