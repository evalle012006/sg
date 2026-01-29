/* eslint-disable react/no-unknown-property */
import React from 'react';
import { X, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import dynamic from 'next/dynamic';

const Button = dynamic(() => import('./Button'));

/**
 * ConfirmDialog Component - UPDATED STYLING
 * Fixed: Softer red color and removed text indentation
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
                return <AlertTriangle className="w-6 h-6 text-red-600 flex-shrink-0" />;
            case 'success':
                return <CheckCircle className="w-6 h-6 text-green-600 flex-shrink-0" />;
            case 'warning':
                return <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0" />;
            case 'info':
            default:
                return <Info className="w-6 h-6 text-blue-600 flex-shrink-0" />;
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

    // Format message to preserve line breaks
    const formattedMessage = message?.split('\n').map((line, index) => (
        <React.Fragment key={index}>
            {line}
            {index < message.split('\n').length - 1 && <br />}
        </React.Fragment>
    ));

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4"
            onClick={handleBackdropClick}
        >
            {/* Modal Container - Responsive max-width and max-height */}
            <div className="bg-white rounded-lg w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl animate-slideIn">
                {/* Header - Responsive padding */}
                <div className="flex items-start justify-between p-4 sm:p-5 border-b sticky top-0 bg-white z-10">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                        {getIcon()}
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 break-words">
                            {title}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0 ml-2"
                        disabled={isLoading}
                        aria-label="Close dialog"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content - NO INDENTATION, preserves line breaks */}
                <div className="p-4 sm:p-6">
                    <div 
                        className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-wrap break-words"
                        style={{ textIndent: 0 }}
                    >
                        {formattedMessage}
                    </div>
                </div>

                {/* Footer - Stack buttons on mobile, side-by-side on desktop */}
                <div className="sticky bottom-0 bg-gray-50 rounded-b-lg p-4 border-t">
                    <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-3">
                        {/* Cancel Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border-2 border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <span className="whitespace-normal break-words text-center block">
                                {cancelText}
                            </span>
                        </button>

                        {/* Confirm Button - SOFTER RED COLOR */}
                        <button
                            type="button"
                            onClick={onConfirm}
                            disabled={isLoading}
                            className={`w-full sm:w-auto px-4 py-2.5 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                                type === 'danger'
                                    ? 'bg-red-400 text-white hover:bg-red-500 focus:ring-red-300'  // Softer red
                                    : type === 'success'
                                    ? 'bg-green-500 text-white hover:bg-green-600 focus:ring-green-400'
                                    : type === 'warning'
                                    ? 'bg-yellow-500 text-white hover:bg-yellow-600 focus:ring-yellow-400'
                                    : 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500'
                            }`}
                        >
                            <span className="whitespace-normal break-words text-center block">
                                {isLoading ? 'Processing...' : confirmText}
                            </span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Add animation styles */}
            <style jsx>{`
                @keyframes slideIn {
                    from {
                        transform: translateY(-20px);
                        opacity: 0;
                    }
                    to {
                        transform: translateY(0);
                        opacity: 1;
                    }
                }

                .animate-slideIn {
                    animation: slideIn 0.2s ease-out;
                }
            `}</style>
        </div>
    );
};

export default ConfirmDialog;