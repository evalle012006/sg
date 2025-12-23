import React from 'react';
import { Download, X, FileText, Image, File } from 'lucide-react';

/**
 * Helper function to get file type from filename
 */
const getFileType = (filename) => {
    if (!filename) return 'other';
    const extension = filename.split('.').pop().toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) {
        return 'image';
    }
    if (extension === 'pdf') {
        return 'pdf';
    }
    return 'other';
};

/**
 * Helper function to get file icon based on filename
 */
const getFileIcon = (filename) => {
    const fileType = getFileType(filename);
    
    switch (fileType) {
        case 'image':
            return <Image className="w-16 h-16 text-blue-500" />;
        case 'pdf':
            return <FileText className="w-16 h-16 text-red-500" />;
        default:
            return <File className="w-16 h-16 text-gray-500" />;
    }
};

/**
 * DocumentViewerModal - A reusable modal for viewing documents
 * 
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Function to call when closing the modal
 * @param {object} document - Document object with name and download_link properties
 */
const DocumentViewerModal = ({ isOpen, onClose, document }) => {
    if (!isOpen || !document) return null;

    const fileType = getFileType(document.name);

    const handleBackdropClick = (e) => {
        if (e.target === e.currentTarget) {
            onClose();
        }
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
            onClick={handleBackdropClick}
        >
            <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-4 border-b">
                    <h3 className="text-lg font-medium truncate mr-4">{document.name}</h3>
                    <div className="flex items-center space-x-2">
                        {document.download_link && (
                            <a
                                href={document.download_link}
                                download
                                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
                            >
                                <Download className="w-4 h-4 mr-1" />
                                Download
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                            title="Close"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Modal Content */}
                <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
                    {fileType === 'image' && (
                        <img
                            src={document.download_link}
                            alt={document.name}
                            className="max-w-full h-auto mx-auto"
                            style={{ maxHeight: 'calc(90vh - 150px)' }}
                        />
                    )}
                    
                    {fileType === 'pdf' && (
                        <iframe
                            src={document.download_link}
                            className="w-full border-0"
                            style={{ height: 'calc(90vh - 150px)' }}
                            title={document.name}
                        />
                    )}
                    
                    {fileType !== 'image' && fileType !== 'pdf' && (
                        <div className="text-center py-8">
                            <div className="mb-4 flex justify-center">
                                {getFileIcon(document.name)}
                            </div>
                            <p className="text-gray-600 mb-4">
                                Preview not available for this file type.
                            </p>
                            {document.download_link && (
                                <a
                                    href={document.download_link}
                                    download
                                    className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                >
                                    <Download size={16} className="mr-2" />
                                    Download File
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DocumentViewerModal;