import React, { useState, useEffect, useRef, useCallback } from 'react';
import Image from 'next/image';
import Webcam from 'react-webcam';

const ProfileImage = ({ 
    profileImageUrl, 
    imageUploading, 
    onImageUpload, 
    disabled = false,
    origin = "admin",
    className = "flex justify-center items-center md:row-span-2" 
}) => {
    const [imageError, setImageError] = useState(false);
    const [imageLoaded, setImageLoaded] = useState(false);
    const [showCamera, setShowCamera] = useState(false);
    const [cameraError, setCameraError] = useState(null);
    const [cameraReady, setCameraReady] = useState(false);
    const webcamRef = useRef(null);

    // Reset error state when URL changes
    useEffect(() => {
        setImageError(false);
        setImageLoaded(false);
    }, [profileImageUrl]);

    const handleImageError = () => {
        console.error('Failed to load profile image:', profileImageUrl);
        setImageError(true);
        setImageLoaded(false);
    };

    const handleImageLoad = () => {
        setImageLoaded(true);
        setImageError(false);
    };

    const handleCameraUserMedia = useCallback(() => {
        setCameraReady(true);
        setCameraError(null);
    }, []);

    const handleCameraUserMediaError = useCallback((error) => {
        console.error('Camera access error:', error);
        setCameraError('Camera access denied or not available');
        setCameraReady(false);
    }, []);

    const openCamera = () => {
        setShowCamera(true);
        setCameraError(null);
        setCameraReady(false);
    };

    const closeCamera = () => {
        setShowCamera(false);
        setCameraReady(false);
    };

    const capturePhoto = useCallback(() => {
        if (webcamRef.current && cameraReady) {
            // Capture image as base64
            const imageSrc = webcamRef.current.getScreenshot();
            
            if (imageSrc) {
                // Convert base64 to blob
                fetch(imageSrc)
                    .then(res => res.blob())
                    .then(blob => {
                        // Create a File object from the blob
                        const file = new File([blob], 'camera-capture.jpg', { type: 'image/jpeg' });
                        
                        // Create a synthetic event to pass to the upload handler
                        const syntheticEvent = {
                            target: {
                                files: [file],
                                value: null
                            }
                        };
                        
                        // Close camera and trigger upload
                        closeCamera();
                        onImageUpload(syntheticEvent);
                    })
                    .catch(error => {
                        console.error('Error processing captured image:', error);
                        setCameraError('Failed to process captured image');
                    });
            }
        }
    }, [webcamRef, cameraReady, onImageUpload]);

    const showFallback = !profileImageUrl || imageError || (!imageLoaded && !imageUploading);

    // Camera constraints for better mobile experience
    const videoConstraints = {
        width: 400,
        height: 400,
        facingMode: "user", // Front-facing camera for selfies
    };

    if (showCamera) {
        return (
            <div className={className}>
                <div className="relative w-full max-w-md mx-auto">
                    {/* Camera Interface */}
                    <div className="relative bg-black rounded-lg overflow-hidden">
                        <Webcam
                            audio={false}
                            ref={webcamRef}
                            screenshotFormat="image/jpeg"
                            videoConstraints={videoConstraints}
                            onUserMedia={handleCameraUserMedia}
                            onUserMediaError={handleCameraUserMediaError}
                            className="w-full h-auto"
                            mirrored={true} // Mirror for better user experience
                        />
                        
                        {/* Camera overlay circle guide */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="w-64 h-64 border-4 border-white border-opacity-50 rounded-full"></div>
                        </div>
                        
                        {/* Camera not ready overlay */}
                        {!cameraReady && !cameraError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75">
                                <div className="text-white text-center">
                                    <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    <p>Initializing camera...</p>
                                </div>
                            </div>
                        )}
                        
                        {/* Error overlay */}
                        {cameraError && (
                            <div className="absolute inset-0 flex items-center justify-center bg-red-900 bg-opacity-75">
                                <div className="text-white text-center p-4">
                                    <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <p className="text-sm">{cameraError}</p>
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Camera Controls */}
                    <div className="flex justify-center items-center mt-4 space-x-4">
                        {/* Cancel Button */}
                        <button
                            type="button"
                            onClick={closeCamera}
                            className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                        >
                            Cancel
                        </button>
                        
                        {/* Capture Button */}
                        <button
                            type="button"
                            onClick={capturePhoto}
                            disabled={!cameraReady}
                            className="w-16 h-16 bg-white border-4 border-blue-500 rounded-full hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            <div className="w-12 h-12 bg-blue-500 rounded-full"></div>
                        </button>
                        
                        {/* Switch Camera Button (for devices with multiple cameras) */}
                        <button
                            type="button"
                            onClick={() => {
                                // Toggle between front and back camera
                                const currentConstraints = webcamRef.current?.stream?.getVideoTracks()[0]?.getConstraints();
                                const newFacingMode = currentConstraints?.facingMode === 'user' ? 'environment' : 'user';
                                
                                // This would require re-initializing the webcam with new constraints
                                // For now, just show it's available
                            }}
                            disabled={!cameraReady}
                            className="p-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
                            title="Switch Camera"
                        >
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m0-4l4-4" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={className}>
            <div className="relative">
                <div className="w-48 h-48 rounded-full flex items-center justify-center overflow-hidden bg-gray-200">
                    {/* Profile Image */}
                    {profileImageUrl && !imageError && (
                        <Image 
                            src={profileImageUrl} 
                            alt="Profile" 
                            width={192}
                            height={192}
                            className="rounded-full"
                            style={{ 
                                width: '100%', 
                                height: '100%',
                                objectFit: 'cover',
                                objectPosition: 'center top',
                                transform: 'scale(0.99)'
                            }}
                            onError={handleImageError}
                            onLoad={handleImageLoad}
                            priority={true}
                            unoptimized={true}
                        />
                    )}
                    
                    {/* Fallback Icon */}
                    {showFallback && (
                        <div className="absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-200 rounded-full">
                            <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                            </svg>
                        </div>
                    )}

                    {/* Loading state */}
                    {imageUploading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-full">
                            <div className="w-8 h-8 border-4 border-white border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    )}
                </div>
                
                {/* Upload Options */}
                {!disabled && (
                    <div className="absolute -bottom-1 -right-1 flex space-x-1">
                        {/* File Upload Button */}
                        <button 
                            type="button"
                            className="w-10 h-10 flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                            style={{
                                background: '#00467F',
                                borderRadius: '12px'
                            }}
                            onClick={() => document.getElementById('profile-upload').click()}
                            disabled={imageUploading}
                            title="Upload from device"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7,10 12,15 17,10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                        </button>
                        
                        {/* Camera Button */}
                        {origin == "guest" && (
                            <button 
                                type="button"
                                className="w-10 h-10 flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                                style={{
                                    background: '#28a745',
                                    borderRadius: '12px'
                                }}
                                onClick={openCamera}
                                disabled={imageUploading}
                                title="Take photo"
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                                    <circle cx="12" cy="13" r="3"/>
                                </svg>
                            </button>
                        )}
                    </div>
                )}
                
                {/* Hidden File Input */}
                <input
                    type="file"
                    id="profile-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                    disabled={imageUploading || disabled}
                />
            </div>
        </div>
    );
};

export default ProfileImage;