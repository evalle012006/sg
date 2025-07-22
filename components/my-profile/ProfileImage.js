import React from 'react';
import Image from 'next/image';

const ProfileImage = ({ 
    profileImageUrl, 
    imageUploading, 
    onImageUpload, 
    className = "flex justify-center items-center md:row-span-2" 
}) => {
    return (
        <div className={className}>
            <div className="relative">
                <div className="w-48 h-48 rounded-full flex items-center justify-center overflow-hidden">
                    {profileImageUrl ? (
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
                            onError={(e) => {
                                e.target.style.display = 'none';
                                e.target.nextSibling.style.display = 'flex';
                            }}
                        />
                    ) : null}
                    
                    <div 
                        className={`absolute inset-0 flex items-center justify-center text-gray-500 bg-gray-200 rounded-full ${profileImageUrl ? 'hidden' : 'flex'}`}
                    >
                        <svg width="60" height="60" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                        </svg>
                    </div>
                </div>
                
                {/* Camera Icon Upload Button - Outlined style with rounded corners */}
                <button 
                    type="button"
                    className="absolute -bottom-1 -right-1 w-10 h-10 flex items-center justify-center shadow-lg hover:opacity-80 transition-opacity disabled:opacity-50"
                    style={{
                        background: '#00467F',
                        borderRadius: '12px'
                    }}
                    onClick={() => document.getElementById('profile-upload').click()}
                    disabled={imageUploading}
                >
                    {imageUploading ? (
                        // Increased spinner size from w-4 h-4 to w-5 h-5
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                        // Outlined camera icon to match design
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/>
                            <circle cx="12" cy="13" r="3"/>
                        </svg>
                    )}
                </button>
                
                {/* Hidden File Input */}
                <input
                    type="file"
                    id="profile-upload"
                    accept="image/*"
                    className="hidden"
                    onChange={onImageUpload}
                    disabled={imageUploading}
                />
            </div>
        </div>
    );
};

export default ProfileImage;