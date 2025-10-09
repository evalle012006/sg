import React, { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const TextField = dynamic(() => import('../ui-v2/TextField'));
const Button = dynamic(() => import('../ui-v2/Button'));

export function NotificationLibraryUpdateForm({ selectedData, closeModal, saveData }) {
    const [formState, setFormState] = useState(selectedData);
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        setFormState(selectedData);
    }, [selectedData]);

    const validateForm = () => {
        const errors = {};

        if (!formState.notification_to || !formState.notification_to.trim()) {
            errors.notification_to = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.notification_to)) {
            errors.notification_to = 'Please enter a valid email address';
        }

        setFieldErrors(errors);
        return Object.keys(errors).length === 0;
    };

    const handleSave = () => {
        if (validateForm()) {
            saveData(formState);
        }
    };

    const handleChange = (value) => {
        setFormState({ ...formState, notification_to: value });
        // Clear error when user starts typing
        if (fieldErrors.notification_to) {
            setFieldErrors({ ...fieldErrors, notification_to: '' });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={closeModal}>
            <div 
                className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Edit Notification
                    </h2>
                    <button
                        onClick={closeModal}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-6">
                    <div className="space-y-4">
                        {/* Notification Title (Read-only) */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Title
                            </label>
                            <div className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700">
                                {formState.name}
                            </div>
                        </div>

                        {/* Email Field */}
                        <div>
                            <TextField
                                label="Recipient Email"
                                value={formState.notification_to || ''}
                                onChange={handleChange}
                                placeholder="Enter email address"
                                error={fieldErrors.notification_to}
                            />
                        </div>

                        {/* Error Summary */}
                        {Object.keys(fieldErrors).length > 0 && (
                            <div className="bg-red-50 border-l-4 border-red-400 p-4">
                                <div className="flex">
                                    <div className="ml-3">
                                        <h3 className="text-sm font-medium text-red-800">
                                            Please fix the following errors:
                                        </h3>
                                        <div className="mt-2 text-sm text-red-700">
                                            <ul className="list-disc pl-5 space-y-1">
                                                {Object.entries(fieldErrors).map(([field, error]) => (
                                                    <li key={field}>{error}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="flex justify-end items-center space-x-3 p-6 border-t border-gray-200 bg-gray-50">
                    <Button
                        type="button"
                        variant="secondary"
                        size="medium"
                        label="Cancel"
                        onClick={closeModal}
                    />
                    <Button
                        type="button"
                        color="primary"
                        size="medium"
                        label="Update"
                        onClick={handleSave}
                    />
                </div>
            </div>
        </div>
    );
}