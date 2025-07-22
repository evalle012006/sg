import React, { useEffect, useRef, useState } from "react";
import { checkFileSize, formatBytes } from "../../utilities/common";
import { toast } from 'react-toastify';

const FileUploadField = (props) => {
    const [fileName, setFileName] = useState();
    const [url, setUrl] = useState(props.url);
    const [file, setFile] = useState();
    const [error, setError] = useState(false);
    const [status, setStatus] = useState('idle');
    const [percentage, setPercentage] = useState(0);
    const [isRenaming, setIsRenaming] = useState(false);
    const [newFileName, setNewFileName] = useState('');
    
    // Validation states
    const [dirty, setDirty] = useState(false);
    const [validationError, setValidationError] = useState(false);
    const [validationMessage, setValidationMessage] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    
    const fileInputRef = useRef(null);
    const renameInputRef = useRef(null);
    const uploadControllerRef = useRef(null);
    const progressIntervalRef = useRef(null);

    // Extract validation props
    const {
        required = false,
        label,
        error: propsError,
        validateOnMount = true,
        ...restProps
    } = props;

    // Validation function
    const validateFile = (currentFileName, shouldSetDirty = false) => {
        // Check for external error first
        if (propsError) {
            setValidationError(true);
            setValidationMessage(propsError);
            if (shouldSetDirty) setDirty(true);
            return;
        }
        
        // Required field validation - only show error if field is dirty or has initial value
        if (required && (!currentFileName || currentFileName.trim() === '')) {
            // Only set validation error if the field is already dirty or we're explicitly making it dirty
            const willBeDirty = dirty || shouldSetDirty;
            if (willBeDirty) {
                setValidationError(true);
                const fieldName = label || 'File';
                setValidationMessage(`${fieldName} is required`);
            } else {
                setValidationError(false);
                setValidationMessage('');
            }
            setIsValid(false);
            if (shouldSetDirty) setDirty(true);
            return;
        }

        // Clear validation errors if file is present
        setValidationError(false);
        setValidationMessage('');
        setIsValid(!!currentFileName);
        if (shouldSetDirty) setDirty(true);
    };

    // Initial setup effect
    useEffect(() => {
        const initialFileName = props.value || '';
        
        if (initialFileName) {
            setFileName(initialFileName);
            setStatus('success');
            if (validateOnMount) {
                setDirty(true);
                validateFile(initialFileName);
            }
        } else {
            // Don't mark as dirty if there's no initial value
            // Just validate without setting dirty state
            validateFile('');
        }
        
        setIsInitialized(true);
    }, []); // Only run on mount

    // Sync with external value changes
    useEffect(() => {
        if (isInitialized && props.value !== undefined && props.value !== fileName) {
            const newFileName = props.value || '';
            setFileName(newFileName);
            if (newFileName) {
                setStatus('success');
            } else {
                setStatus('idle');
            }
            if (validateOnMount) {
                setDirty(true);
            }
            validateFile(newFileName, validateOnMount);
        }
    }, [props.value, isInitialized]);

    // Validation effect - runs when dependencies change
    useEffect(() => {
        if (isInitialized) {
            // Don't force dirty state when validation runs due to prop changes
            validateFile(fileName || '');
        }
    }, [propsError, required, isInitialized]);

    const handleFileSelection = async (selectedFile) => {
        if (!selectedFile) {
            setError(true);
            return;
        }

        const fileSizeMsg = checkFileSize(selectedFile.size, 51200000);
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
            fileInputRef.current.value = null;
            return;
        }

        setFile(selectedFile);
        setDirty(true);
        await handleUpload(selectedFile);
    };

    const handleUpload = async (selectedFile) => {
        if (uploadControllerRef.current) {
            uploadControllerRef.current.abort();
        }
        
        if (progressIntervalRef.current) {
            clearInterval(progressIntervalRef.current);
        }

        uploadControllerRef.current = new AbortController();
        const timeOutId = setTimeout(() => uploadControllerRef.current.abort(), 300000);

        setStatus('in-progress');

        progressIntervalRef.current = setInterval(() => {
            setPercentage(prevPercentage => {
                if (prevPercentage >= 90) {
                    clearInterval(progressIntervalRef.current);
                    return prevPercentage;
                }
                return prevPercentage + 2;
            });
        }, 500);

        const formData = new FormData();
        formData.append("file", selectedFile);
        formData.append("fileType", props.fileType);
        formData.append("metadata", JSON.stringify(props.metadata));

        setPercentage(10);

        try {
            const response = await fetch("/api/storage/upload", {
                method: 'POST',
                body: formData,
                signal: uploadControllerRef.current.signal
            });

            const data = await response.json();

            if (response.ok) {
                clearInterval(progressIntervalRef.current);
                setPercentage(99);
                const uploadedFileName = selectedFile.name;
                setFileName(uploadedFileName);
                props.onChange(uploadedFileName);
                validateFile(uploadedFileName, true);
                toast(data.message, { type: 'success' });
                setStatus('success');

                const fileUrlResponse = await fetch(
                    `/api/storage/upload?filename=${uploadedFileName}&filepath=${props.fileType}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                const urlData = await fileUrlResponse.json();

                if (urlData.ok) {
                    setUrl(urlData.fileUrl);
                }
            } else {
                handleUploadError();
                toast(data.message, { type: 'error' });
            }
        } catch (err) {
            handleUploadError();
            
            if (!window.navigator.onLine) {
                toast('No internet connection. Please check your network connection.', { type: 'error' });
            } else {
                toast('The upload failed. Please try again.', { type: 'error' });
            }
        } finally {
            clearTimeout(timeOutId);
        }
    };

    const handleUploadError = () => {
        clearInterval(progressIntervalRef.current);
        setStatus('idle');
        setPercentage(0);
        fileInputRef.current.value = null;
        setDirty(true);
        validateFile('', true);
    };

    const handleFileDelete = async (e, fName) => {
        e.stopPropagation();
        e.preventDefault();

        if (fName) {
            const response = await fetch(
                "/api/storage/upload?" + new URLSearchParams({ filename: fName, filepath: props.fileType }), 
                { method: 'DELETE' }
            );
            
            if (response.ok || response.status === 404) {
                setFile(null);
                props.onChange('');
                setFileName('');
                setUrl('');
                setStatus('idle');
                setPercentage(0);
                setDirty(true);
                validateFile('', true);
                toast.success('File successfully deleted');
                fileInputRef.current.value = null;
            }
        }
    };

    const handleRename = async (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (!newFileName.trim()) {
            toast.error('Please enter a valid filename');
            return;
        }

        // Add file extension if it's not included
        const oldExtension = fileName.split('.').pop();
        const newName = newFileName.includes('.') ? newFileName : `${newFileName}.${oldExtension}`;

        try {
            const response = await fetch('/api/storage/rename', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    oldFilename: fileName,
                    newFilename: newName,
                    filepath: props.fileType
                })
            });

            const data = await response.json();

            if (response.ok) {
                setFileName(newName);
                props.onChange(newName);
                validateFile(newName, true);
                setIsRenaming(false);
                toast.success('File renamed successfully');

                // Update URL with new filename
                const urlResponse = await fetch(
                    `/api/storage/upload?filename=${newName}&filepath=${props.fileType}`,
                    {
                        method: "GET",
                        headers: {
                            "Content-Type": "application/json",
                        },
                    }
                );
                const urlData = await urlResponse.json();
                if (urlData.ok) {
                    setUrl(urlData.fileUrl);
                }
            } else {
                toast.error(data.message || 'Failed to rename file');
            }
        } catch (error) {
            toast.error('Failed to rename file');
        }
    };

    const startRenaming = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const nameWithoutExtension = fileName.split('.')[0];
        setNewFileName(nameWithoutExtension);
        setIsRenaming(true);
        setTimeout(() => {
            renameInputRef.current?.focus();
            renameInputRef.current?.select();
        }, 100);
    };

    const handleDownloadFile = (e) => {
        e.stopPropagation();
        e.preventDefault();

        let link = document.createElement("a");
        link.download = fileName;
        link.href = url;
        link.target = "_blank";
        link.click();
    };

    useEffect(() => {
        const getFileUrl = async (fileName) => {
            const response = await fetch('/api/storage/upload?' + new URLSearchParams({ 
                filename: fileName, 
                filepath: props.fileType 
            }));
            const data = await response.json();

            if (response.ok) {
                setUrl(data.fileUrl);
            }
        };

        if (props.value) {
            setFileName(props.value);
            setStatus('success');
            getFileUrl(props.value);
        }

        return () => {
            if (uploadControllerRef.current) {
                uploadControllerRef.current.abort();
            }
            if (progressIntervalRef.current) {
                clearInterval(progressIntervalRef.current);
            }
            setFile(null);
        };
    }, [props.value, props.fileType]);

    // Determine if we should show validation error
    const shouldShowValidationError = propsError || (validationError && dirty);
    const shouldShowValid = !shouldShowValidationError && isValid && dirty;

    // Get border classes based on validation state
    const getBorderClasses = () => {
        if (shouldShowValidationError) {
            return 'border-2 border-red-500 bg-red-50';
        }
        if (shouldShowValid) {
            return 'border-2 border-green-500 bg-green-50';
        }
        return 'border-gray-300';
    };

    return (
        <div className={`mb-2 ${props.className || ''}`}>
            {label && (
                <label className={`font-semibold form-label inline-block mb-1.5 ${shouldShowValidationError ? 'text-red-700' : 'text-slate-700'}`}>
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </label>
            )}
            
            <div 
                className={`flex justify-between items-center text-gray-500 xl:w-96 w-full px-4 py-6 text-base font-normal
                            bg-clip-padding bg-white border border-solid rounded-lg m-0 ${getBorderClasses()}`}
                onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleFileSelection(e.dataTransfer.files[0]);
                    e.target.classList.remove('border-gray-800');
                }}
                onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.target.classList.add('border-gray-800');
                }}
                onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    e.target.classList.remove('border-gray-800');
                }}
                onClick={() => {
                    fileInputRef.current.click();
                }}
            >
                <input 
                    type="file" 
                    disabled={props?.disabled} 
                    ref={fileInputRef} 
                    className="focus:outline-none text-gray-900 placeholder:text-gray-500" 
                    onChange={(e) => handleFileSelection(e.target.files[0])} 
                    hidden 
                />
                {status == 'idle' && <div className="flex flex-col items-center text-center w-full">
                    <svg className="mb-3" width="46" height="46" viewBox="0 0 46 46" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect x="3" y="3" width="40" height="40" rx="20" fill="#F2F4F7" />
                        <g clipPath="url(#clip0_10053_13253)">
                            <path d="M26.3335 26.3333L23.0002 23M23.0002 23L19.6669 26.3333M23.0002 23V30.5M29.9919 28.325C30.8047 27.8819 31.4467 27.1807 31.8168 26.3322C32.1868 25.4836 32.2637 24.536 32.0354 23.6389C31.807 22.7418 31.2865 21.9463 30.5558 21.3779C29.8251 20.8095 28.9259 20.5006 28.0002 20.5H26.9502C26.698 19.5244 26.2278 18.6186 25.5752 17.8508C24.9225 17.083 24.1042 16.4732 23.182 16.0672C22.2597 15.6611 21.2573 15.4695 20.2503 15.5066C19.2433 15.5437 18.2578 15.8086 17.3679 16.2814C16.4779 16.7542 15.7068 17.4226 15.1124 18.2363C14.518 19.0501 14.1158 19.9879 13.936 20.9795C13.7563 21.971 13.8036 22.9904 14.0746 23.9611C14.3455 24.9317 14.8329 25.8282 15.5002 26.5833" stroke="#475467" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                        </g>
                        <rect x="3" y="3" width="40" height="40" rx="20" stroke="#F9FAFB" strokeWidth="6" />
                        <defs>
                            <clipPath id="clip0_10053_13253">
                                <rect width="20" height="20" fill="white" transform="translate(13 13)" />
                            </clipPath>
                        </defs>
                    </svg>
                    <p className="m-1 text-sm"><button className="text-sky-800 font-semibold">Click to upload</button> or drag and drop</p>
                    <p className="text-xs">PDF, DOC/DOCX, PNG or JPG</p>
                </div>}
                {status == 'in-progress' && <div className="text-center w-full">
                    <div className="flex items-start">
                        <div className="grow flex items-start w-full">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="32" height="32" rx="16" fill="#F4EBFF" />
                                <path d="M18.6665 11.3333H13.9998C13.6462 11.3333 13.3071 11.4738 13.057 11.7239C12.807 11.9739 12.6665 12.313 12.6665 12.6667V23.3333C12.6665 23.687 12.807 24.0261 13.057 24.2761C13.3071 24.5262 13.6462 24.6667 13.9998 24.6667H21.9998C22.3535 24.6667 22.6926 24.5262 22.9426 24.2761C23.1927 24.0261 23.3332 23.687 23.3332 23.3333V16M18.6665 11.3333L23.3332 16M18.6665 11.3333V16H23.3332" stroke="#00467F" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="2" y="2" width="32" height="32" rx="16" stroke="#F9F5FF" strokeWidth="4" />
                            </svg>
                            <div className="text-left ml-3 w-full">
                                <p className="m-1 text-sm font-semibold text-slate-700">{file && file.name}</p>
                                <p className="m-1 text-sm">{formatBytes(file && file.size)}</p>

                                <div className="flex items-baseline">
                                    <div className="flex-grow relative">
                                        <div className="w-full bg-gray-200 rounded-full h-2.5"></div>
                                        {percentage && <div className="absolute top-0 left-0 bg-sky-800 rounded-full h-2.5" style={{ width: `${percentage}%` }}></div>}
                                    </div>
                                    <p className="flex-none text-sm ml-2">{percentage}%</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex-none">
                            <svg className="w-3.5 h-4" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.5 5.00001H3.16667M3.16667 5.00001H16.5M3.16667 5.00001V16.6667C3.16667 17.1087 3.34226 17.5326 3.65482 17.8452C3.96738 18.1577 4.39131 18.3333 4.83333 18.3333H13.1667C13.6087 18.3333 14.0326 18.1577 14.3452 17.8452C14.6577 17.5326 14.8333 17.1087 14.8333 16.6667V5.00001H3.16667ZM5.66667 5.00001V3.33334C5.66667 2.89131 5.84226 2.46739 6.15482 2.15483C6.46738 1.84227 6.89131 1.66667 7.33333 1.66667H10.6667C11.1087 1.66667 11.5326 1.84227 11.8452 2.15483C12.1577 2.46739 12.3333 2.89131 12.3333 3.33334V5.00001M7.33333 9.16667V14.1667M10.6667 9.16667V14.1667" stroke="#667085" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>}

                {status == 'success' && <div className="text-center w-full">
                    <div className="flex items-start">
                        <div className="grow flex items-start w-full">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="2" width="32" height="32" rx="16" fill="#F4EBFF" />
                                <path d="M18.6665 11.3333H13.9998C13.6462 11.3333 13.3071 11.4738 13.057 11.7239C12.807 11.9739 12.6665 12.313 12.6665 12.6667V23.3333C12.6665 23.687 12.807 24.0261 13.057 24.2761C13.3071 24.5262 13.6462 24.6667 13.9998 24.6667H21.9998C22.3535 24.6667 22.6926 24.5262 22.9426 24.2761C23.1927 24.0261 23.3332 23.687 23.3332 23.3333V16M18.6665 11.3333L23.3332 16M18.6665 11.3333V16H23.3332" stroke="#00467F" strokeWidth="1.33333" strokeLinecap="round" strokeLinejoin="round" />
                                <rect x="2" y="2" width="32" height="32" rx="16" stroke="#F9F5FF" strokeWidth="4" />
                            </svg>
                            <div className="text-left ml-3 w-full">
                                {file ? (
                                    <React.Fragment>
                                        <p className="m-1 text-sm font-semibold text-slate-700">{file && file.name}</p>
                                        <p className="m-1 text-sm">{formatBytes(file && file.size)} - Upload successful.</p>
                                    </React.Fragment>
                                ) : (
                                    <React.Fragment>
                                        {isRenaming ? (
                                            <form onSubmit={handleRename} onClick={e => e.stopPropagation()}>
                                                <input
                                                    ref={renameInputRef}
                                                    type="text"
                                                    value={newFileName}
                                                    onChange={(e) => setNewFileName(e.target.value)}
                                                    className="m-1 text-sm font-semibold text-slate-700 border rounded px-2 py-1 w-48"
                                                    onBlur={() => setIsRenaming(false)}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Escape') {
                                                            setIsRenaming(false);
                                                        }
                                                    }}
                                                />
                                            </form>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <p className="m-1 text-sm font-semibold text-slate-700 underline cursor-pointer" 
                                                onClick={handleDownloadFile}>
                                                    {fileName}
                                                </p>
                                                <button 
                                                    onClick={startRenaming}
                                                    className="p-1 hover:bg-gray-100 rounded"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                        <path d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" 
                                                            stroke="currentColor" 
                                                            strokeWidth="2" 
                                                            strokeLinecap="round" 
                                                            strokeLinejoin="round"
                                                        />
                                                    </svg>
                                                </button>
                                            </div>
                                        )}
                                    </React.Fragment>
                                )}
                            </div>
                        </div>
                        <div className="flex-none cursor-pointer" onClick={(e) => handleFileDelete(e, fileName)}>
                            <svg className="w-3.5 h-4" viewBox="0 0 18 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M1.5 5.00001H3.16667M3.16667 5.00001H16.5M3.16667 5.00001V16.6667C3.16667 17.1087 3.34226 17.5326 3.65482 17.8452C3.96738 18.1577 4.39131 18.3333 4.83333 18.3333H13.1667C13.6087 18.3333 14.0326 18.1577 14.3452 17.8452C14.6577 17.5326 14.8333 17.1087 14.8333 16.6667V5.00001H3.16667ZM5.66667 5.00001V3.33334C5.66667 2.89131 5.84226 2.46739 6.15482 2.15483C6.46738 1.84227 6.89131 1.66667 7.33333 1.66667H10.6667C11.1087 1.66667 11.5326 1.84227 11.8452 2.15483C12.1577 2.46739 12.3333 2.89131 12.3333 3.33334V5.00001M7.33333 9.16667V14.1667M10.6667 9.16667V14.1667" stroke="#667085" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </div>
                    </div>
                </div>}
            </div>

            {shouldShowValidationError && (
                <div className="mt-1.5 flex items-center">
                    <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    <p className="text-red-600 text-sm font-medium">{validationMessage}</p>
                </div>
            )}
        </div>
    );
}

export default FileUploadField;