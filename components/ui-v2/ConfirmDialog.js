import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

const Button = dynamic(() => import('./Button'));

/**
 * ConfirmDialog Component
 * A reusable confirmation dialog for confirming actions
 * 
 * @param {boolean} isOpen - Controls dialog visibility
 * @param {function} onClose - Called when dialog is closed
 * @param {function} onConfirm - Called when user confirms
 * @param {string} title - Dialog title
 * @param {string} message - Confirmation message
 * @param {string} confirmText - Confirm button text (default: "Confirm")
 * @param {string} cancelText - Cancel button text (default: "Cancel")
 * @param {string} type - Dialog type: 'danger', 'success', 'warning', 'info' (default: 'info')
 * @param {boolean} isLoading - Show loading state on confirm button
 */
const ConfirmDialog = ({
    isOpen,
    onClose,
    onConfirm,
    title = 'Confirm Action',
    message,
    confirmText = 'Confirm',
    cancelText = 'Cancel',
    type = 'info',
    isLoading = false
}) => {
    if (!isOpen) return null;

    const getIcon = () => {
        switch (type) {
            case 'danger':
                return <AlertTriangle className="w-6 h-6 text-red-600" />;
            case 'success':
                return <CheckCircle className="w-6 h-6 text-green-600" />;
            case 'warning':
                return <AlertTriangle className="w-6 h-6 text-yellow-600" />;
            case 'info':
            default:
                return <Info className="w-6 h-6 text-blue-600" />;
        }
    };

    const getConfirmButtonColor = () => {
        switch (type) {
            case 'danger':
                return 'error';
            case 'success':
                return 'success';
            case 'warning':
                return 'warning';
            case 'info':
            default:
                return 'primary';
        }
    };

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-lg w-full max-w-md shadow-xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div className="flex items-center space-x-3">
                        {getIcon()}
                        <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                        disabled={isLoading}
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-gray-700 leading-relaxed">{message}</p>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end space-x-3 p-4 bg-gray-50 rounded-b-lg">
                    <Button
                        type="button"
                        color="secondary"
                        size="medium"
                        label={cancelText}
                        onClick={onClose}
                        disabled={isLoading}
                    />
                    <Button
                        type="button"
                        color={getConfirmButtonColor()}
                        size="medium"
                        label={isLoading ? 'Processing...' : confirmText}
                        onClick={onConfirm}
                        disabled={isLoading}
                    />
                </div>
            </div>
        </div>
    );
};

export default ConfirmDialog;