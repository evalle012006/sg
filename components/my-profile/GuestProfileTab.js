import React, { useEffect, useState, useContext } from "react";
import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import ProfileImage from "./ProfileImage";
import _ from 'lodash';
import { AbilityContext, Can } from "../../services/acl/can";

const Spinner = dynamic(() => import('../ui/spinner'));
const RadioButton = dynamic(() => import('../ui-v2/RadioButton'));
const Checkbox = dynamic(() => import('../ui-v2/CheckboxButton'));
const DatePicker = dynamic(() => import('../ui-v2/DateField'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));

// Helper function to validate and clean health info data
const validateAndCleanHealthInfo = (healthData) => {
    const cleanedData = { ...healthData };
    
    // Ensure boolean fields are not null
    if (cleanedData.identify_aboriginal_torres === null || cleanedData.identify_aboriginal_torres === undefined) {
        cleanedData.identify_aboriginal_torres = false;
    }
    
    if (cleanedData.sci_inpatient === null || cleanedData.sci_inpatient === undefined) {
        cleanedData.sci_inpatient = false;
    }
    
    if (cleanedData.require_interpreter === null || cleanedData.require_interpreter === undefined) {
        cleanedData.require_interpreter = false;
    }
    
    // Ensure string fields for yes/no questions are not null
    if (cleanedData.language === null || cleanedData.language === undefined) {
        cleanedData.language = '';
    }
    
    if (cleanedData.cultural_beliefs === null || cleanedData.cultural_beliefs === undefined) {
        cleanedData.cultural_beliefs = '';
    }
    
    // Clean up other optional fields
    const optionalStringFields = [
        'emergency_name',
        'emergency_mobile_number',
        'emergency_email',
        'emergency_relationship',
        'specialist_name', 
        'specialist_mobile_number', 
        'specialist_practice_name',
        'sci_year',
        'sci_level_asia',
        'sci_intial_spinal_rehab',
        'sci_type',
        'sci_injury_type',
        'sci_other_details'
    ];
    
    optionalStringFields.forEach(field => {
        if (cleanedData[field] === null || cleanedData[field] === undefined) {
            cleanedData[field] = '';
        }
    });
    
    // Ensure sci_type_level is an array
    if (!cleanedData.sci_type_level) {
        cleanedData.sci_type_level = [];
    }
    
    return cleanedData;
};

export default function GuestProfileTab({ isGuestUser = false }) {
    const dispatch = useDispatch();
    const currentUser = useSelector((state) => state.user.user);
    const user = useSelector((state) => state.guest.data) || currentUser;
    const ability = useContext(AbilityContext);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [guestId, setGuestId] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [profileImageUrl, setProfileImageUrl] = useState('');
    
    // Guest flags state - hidden for guests
    const [settingsFlagsList, setSettingsFlagsList] = useState([]);
    const [guestFlags, setGuestFlags] = useState([]);
    const [selectedFlags, setSelectedFlags] = useState([]);
    const [localFlags, setLocalFlags] = useState([]);

    const genderOptions = [
        { label: 'Male', value: 'male' },
        { label: 'Female', value: 'female' },
        { label: 'Other', value: 'other' },
        { label: 'Prefer not to say', value: 'prefer not to say' }
    ];
    
    // Guest basic information state
    const [guestInfo, setGuestInfo] = useState({
        first_name: '',
        last_name: '',
        email: '',
        phone_number: '',
        dob: '',
        gender: '',
        street_address_line_1: '',
        street_address_line_2: '',
        city: '',
        state: '',
        post_code: '',
        country: ''
    });
    
    // Health information state - matching AdminGuestProfile structure
    const [healthInfo, setHealthInfo] = useState({
        identify_aboriginal_torres: false,
        language: '',
        require_interpreter: false,
        cultural_beliefs: '',
        emergency_name: '',
        emergency_mobile_number: '',
        emergency_email: '',
        emergency_relationship: '',
        specialist_name: '',
        specialist_mobile_number: '',
        specialist_practice_name: '',
        sci_year: '',
        sci_level_asia: '',
        sci_intial_spinal_rehab: '',
        sci_type: '',
        sci_type_level: [],
        sci_inpatient: false,
        sci_injury_type: '',
        sci_other_details: ''
    });

    // Download PDF handler
    const handleDownloadGuestPDF = async () => {
        toast.info('Generating PDF. Please wait...');
        try {
            const response = await fetch(`/api/guests/${user.uuid}/download-profile-pdf`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    origin: currentUser.type,
                    guestData: guestInfo,
                    healthData: healthInfo,
                    profileImageUrl: profileImageUrl
                }),
            });

            if (!response.ok) throw new Error('Failed to generate PDF');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `guest-profile-${user.first_name}-${user.last_name}-${user.uuid}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
            
            toast.success('Profile PDF downloaded successfully!');
        } catch (error) {
            console.error('Error downloading PDF:', error);
            toast.error('Failed to download guest profile. Please try again.');
        }
    };

    const handleCancel = () => {
        window.location.reload();
    };

    const loadProfileInfo = async () => {
        try {
            const targetUserId = user?.id || user?.uuid;
            if (!targetUserId) {
                setLoading(false);
                return;
            }
            
            setGuestId(targetUserId);
            
            const apiEndpoint = `/api/my-profile/${targetUserId}`;
            const response = await fetch(apiEndpoint);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Profile data:', data);
                
                setProfileImageUrl(data.profileUrl || '');
                
                setGuestInfo({
                    first_name: data.first_name || '',
                    last_name: data.last_name || '',
                    email: data.email || '',
                    phone_number: data.phone_number || '',
                    dob: data.dob || '',
                    gender: data.gender || '',
                    street_address_line_1: data.address_street1 || '',
                    street_address_line_2: data.address_street2 || '',
                    city: data.address_city || '',
                    state: data.address_state_province || '',
                    post_code: data.address_postal || '',
                    country: data.address_country || ''
                });
                
                if (data.HealthInfo) {
                    // Ensure sci_type_level is an array
                    const healthInfoData = { ...data.HealthInfo };
                    if (healthInfoData.sci_type_level && typeof healthInfoData.sci_type_level === 'string') {
                        try {
                            // Try to parse as JSON first (handles escaped quotes)
                            const parsed = JSON.parse(healthInfoData.sci_type_level);
                            healthInfoData.sci_type_level = Array.isArray(parsed) ? parsed : [parsed];
                        } catch {
                            // Fallback: clean quotes manually and split
                            let cleanedValue = healthInfoData.sci_type_level
                                .replace(/^["']|["']$/g, '')  // Remove surrounding quotes
                                .trim();
                            healthInfoData.sci_type_level = cleanedValue
                                .split(',')
                                .map(v => v.trim().replace(/^["']|["']$/g, ''))
                                .filter(v => v);
                        }
                    }
                    
                    // Use the validation helper to clean all null values
                    const cleanedHealthInfo = validateAndCleanHealthInfo(healthInfoData);
                    setHealthInfo(cleanedHealthInfo);
                }
            } else if (response.status === 404) {
                toast.error('Profile not found');
            } else {
                toast.error('Failed to load profile information');
            }
        } catch (error) {
            console.error('Error loading profile info:', error);
            toast.error('Failed to load profile information');
        } finally {
            setLoading(false);
        }
    };

    // Load Profile Data
    useEffect(() => {
        if (user) {
            loadProfileInfo();
        }
    }, [user]);

    // Fetch settings flags list - only for admins
    useEffect(() => {
        if (!isGuestUser) {
            const fetchSettingsFlagsList = async () => {
                const response = await fetch('/api/settings/guest_flag');
                const data = await response.json();
                setSettingsFlagsList(data.map(flag => flag.value));
            };
            fetchSettingsFlagsList();
        }
    }, [isGuestUser]);

    // Update guest flags
    const updateGuestFlags = () => {
        const guestFlagOptions = settingsFlagsList.map(flag => ({
            label: _.startCase(flag),
            value: flag
        }));
        setGuestFlags(guestFlagOptions);
    };

    useEffect(() => {
        if (settingsFlagsList.length > 0 && !isGuestUser) {
            updateGuestFlags();
        }
    }, [settingsFlagsList, localFlags, isGuestUser]);

    useEffect(() => {
        if (user?.flags) {
            setLocalFlags(user.flags);
            setSelectedFlags(user.flags.map(flag => _.startCase(flag)));
        }
    }, [user?.flags]);

    const handleGuestInfoChange = (field, value) => {
        setGuestInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleHealthInfoChange = (field, value) => {
        console.log(`Updating health info: ${field} = ${value}`);
        setHealthInfo(prev => ({ ...prev, [field]: value }));
    };

    const handleFlagCheckboxChange = (event) => {
        const { value, checked } = event.target;
        setLocalFlags(prev => {
            if (checked) {
                return [...prev, value];
            } else {
                return prev.filter(flag => flag !== value);
            }
        });
    };

    const updateProfilePhoto = async (imageUrl) => {
        setProfileImageUrl(imageUrl);
        
        try {
            const response = await fetch('/api/my-profile/update-photo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    guest_id: guestId,
                    profile_filename: imageUrl.split('/').pop()
                })
            });
            
            if (response.ok) {
                toast.success('Profile photo updated!');
            }
        } catch (error) {
            console.error('Error updating profile photo:', error);
        }
    };

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        
        setSaving(true);
        dispatch(globalActions.setLoading(true));
        
        try {
            // Clean health info before submission
            const cleanedHealthInfo = validateAndCleanHealthInfo(healthInfo);
            
            const payload = {
                guest_id: guestId,
                ...guestInfo,
                // Only include flags for non-guest users
                ...(isGuestUser ? {} : { flags: localFlags }),
                health_info: cleanedHealthInfo
            };
            
            const response = await fetch('/api/my-profile/save-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                toast.success('Profile updated successfully!');
            } else {
                const error = await response.json();
                toast.error(error.message || 'Failed to update profile');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error('Failed to update profile');
        } finally {
            setSaving(false);
            dispatch(globalActions.setLoading(false));
        }
    };

    const getLanguageSelectedValue = () => {
        if (healthInfo.language === null || healthInfo.language === undefined) {
            return "no";
        }
        return healthInfo.language && healthInfo.language !== '' && healthInfo.language !== 'rather_not_say' 
            ? "yes" 
            : healthInfo.language === 'rather_not_say' 
                ? "rather_not_say" 
                : "no";
    };

    const getCulturalBeliefsSelectedValue = () => {
        if (healthInfo.cultural_beliefs === null || healthInfo.cultural_beliefs === undefined) {
            return "no";
        }
        return healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '' && healthInfo.cultural_beliefs !== 'no'
            ? "yes"
            : "no";
    };

    // Add this helper function (around line 300, near the other helper functions)
    const getSciTypeLevelDisplayValue = () => {
        if (!healthInfo.sci_type_level) return '';
        if (Array.isArray(healthInfo.sci_type_level)) {
            return healthInfo.sci_type_level.join(', ');
        }
        return healthInfo.sci_type_level;
    };

    const handleSciTypeLevelChange = (value) => {
        // Convert comma-separated string back to array
        const levels = value.split(',').map(v => v.trim()).filter(v => v);
        handleHealthInfoChange('sci_type_level', levels);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="main-content">
            <div className="bg-white rounded-lg p-4 sm:p-6 shadow-sm">
                {/* Header - matches AdminGuestProfile layout */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 sm:mb-8 space-y-4 sm:space-y-0">
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-800">
                        {guestInfo.first_name && guestInfo.last_name 
                            ? `${guestInfo.first_name} ${guestInfo.last_name}` 
                            : 'My Profile'}
                    </h1>
                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                        {/* Download PDF - available for guests */}
                        <button 
                            onClick={handleDownloadGuestPDF}
                            disabled={!user || !guestInfo.first_name}
                            className="px-3 sm:px-4 py-2 bg-gray-500 text-white text-xs sm:text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                        >
                            DOWNLOAD AS PDF
                        </button>
                        {/* Update button - available for guests */}
                        <button 
                            onClick={handleSubmit}
                            disabled={saving}
                            className="px-3 sm:px-4 py-2 bg-yellow-500 text-white text-xs sm:text-sm rounded hover:bg-yellow-600 disabled:opacity-50 w-full sm:w-auto"
                        >
                            {saving ? 'UPDATING...' : 'UPDATE'}
                        </button>
                    </div>
                </div>
                
                {/* Form - matches AdminGuestProfile 5-column grid layout */}
                <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-5 gap-6 sm:gap-8">
                    {/* Left Column - Profile Image (Flags hidden for guests) */}
                    <div className="xl:col-span-1 space-y-4">
                        {/* Profile Image - guests can upload */}
                        <ProfileImage 
                            profileImageUrl={profileImageUrl}
                            imageUploading={imageUploading}
                            onImageUpload={updateProfilePhoto}
                            disabled={false}
                            origin={isGuestUser ? "guest" : "admin"}
                        />
                        
                        {/* Flags Section - HIDDEN for guests */}
                        {!isGuestUser && (
                            <div className="mt-4">
                                <Can I="Create/Edit" a="Guest">
                                    <div>
                                        <label className="font-semibold form-label block mb-1.5 text-slate-700">Flags</label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-2">
                                            {guestFlags.map(flag => (
                                                <Checkbox
                                                    key={flag.value}
                                                    label={flag.label}
                                                    value={flag.value}
                                                    checked={localFlags.includes(flag.value)}
                                                    onClick={handleFlagCheckboxChange}
                                                    size="small"
                                                    name={`flag_${flag.value}`}
                                                    mode="checkbox"
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </Can>
                                <Can not I="Create/Edit" a="Guest">
                                    <div className="flex flex-wrap gap-1">
                                        {selectedFlags.map((flag, index) => {
                                            let bgColor = 'bg-gray-500';
                                            
                                            if (flag === 'Complex Care') bgColor = 'bg-amber-500';
                                            else if (flag === 'Banned') bgColor = 'bg-red-500';
                                            else if (flag === 'Outstanding Invoices') bgColor = 'bg-fuchsia-500';
                                            else if (flag === 'Specific Room Requirements') bgColor = 'bg-sky-500';
                                            else if (flag === 'Account Credit') bgColor = 'bg-green-500';
                                            else if (flag === 'Deceased') bgColor = 'bg-slate-700';
                                            else if (flag === 'Not Eligible') bgColor = 'bg-gray-500';
                                            
                                            return (
                                                <p key={index} className={`${bgColor} w-fit px-2 p-1 text-xs text-white rounded-full`}>
                                                    {_.startCase(flag)}
                                                </p>
                                            );
                                        })}
                                    </div>
                                </Can>
                            </div>
                        )}
                    </div>
                    
                    {/* Right Column - All Form Fields (4 columns) */}
                    <div className="xl:col-span-4 space-y-6">
                        {/* Basic Information Fields */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            <TextField
                                label="First Name"
                                value={guestInfo.first_name}
                                onChange={(value) => handleGuestInfoChange('first_name', value)}
                                placeholder="Maya"
                                size="medium"
                            />
                            <TextField
                                label="Last Name"
                                value={guestInfo.last_name}
                                onChange={(value) => handleGuestInfoChange('last_name', value)}
                                placeholder="Sinclair"
                                size="medium"
                            />
                            <div>
                                {/* Email - ALWAYS DISABLED for guests */}
                                <TextField
                                    label="Email"
                                    type="email"
                                    value={guestInfo.email}
                                    onChange={(value) => handleGuestInfoChange('email', value)}
                                    disabled={isGuestUser}
                                    placeholder="example@gmail.com"
                                    size="medium"
                                />
                            </div>
                            <TextField
                                label="Mobile No."
                                type="phone"
                                value={guestInfo.phone_number}
                                onChange={(value) => handleGuestInfoChange('phone_number', value)}
                                placeholder="0412 345 678"
                                size="medium"
                            />
                            <div>
                                <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">Gender</label>
                                <Select
                                    label="Gender"
                                    placeholder="Gender"
                                    value={genderOptions.find(opt => opt.value === guestInfo.gender?.toLowerCase()) || null}
                                    size="large"
                                    onChange={(value) => handleGuestInfoChange('gender', value)}
                                    options={genderOptions}
                                />
                            </div>
                            <DatePicker
                                label="Date of Birth"
                                value={guestInfo.dob}
                                onChange={(value) => handleGuestInfoChange('dob', value)}
                            />
                        </div>

                        {/* Address Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">Address</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <TextField
                                        label="Street Address Line 1"
                                        value={guestInfo.street_address_line_1}
                                        onChange={(value) => handleGuestInfoChange('street_address_line_1', value)}
                                        placeholder="1a Cruise Street"
                                        size="medium"
                                    />
                                </div>
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <TextField
                                        label="Street Address Line 2 (Optional)"
                                        value={guestInfo.street_address_line_2}
                                        onChange={(value) => handleGuestInfoChange('street_address_line_2', value)}
                                        placeholder="Unit 2"
                                        size="medium"
                                    />
                                </div>
                                <TextField
                                    label="City/Suburb"
                                    value={guestInfo.city}
                                    onChange={(value) => handleGuestInfoChange('city', value)}
                                    placeholder="Sydney"
                                    size="medium"
                                />
                                <TextField
                                    label="State"
                                    value={guestInfo.state}
                                    onChange={(value) => handleGuestInfoChange('state', value)}
                                    placeholder="NSW"
                                    size="medium"
                                />
                                <TextField
                                    label="Post Code"
                                    value={guestInfo.post_code}
                                    onChange={(value) => handleGuestInfoChange('post_code', value)}
                                    placeholder="2000"
                                    size="medium"
                                />
                                <TextField
                                    label="Country"
                                    value={guestInfo.country}
                                    onChange={(value) => handleGuestInfoChange('country', value)}
                                    placeholder="Australia"
                                    size="medium"
                                />
                            </div>
                        </div>

                        {/* Cultural Background Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">Cultural Background</h2>
                            <div className="space-y-4">
                                <div>
                                    <label className="font-semibold form-label block mb-1.5 text-slate-700">
                                        Do you identify as Aboriginal or Torres Strait Islander?
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <RadioButton
                                            label="Yes"
                                            value={true}
                                            selectedValue={healthInfo.identify_aboriginal_torres}
                                            onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === 'true')}
                                            name="aboriginal_torres"
                                            size="small"
                                        />
                                        <RadioButton
                                            label="No"
                                            value={false}
                                            selectedValue={healthInfo.identify_aboriginal_torres}
                                            onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === 'true')}
                                            name="aboriginal_torres"
                                            size="small"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="font-semibold form-label block mb-1.5 text-slate-700">
                                        Do you speak a language other than English at home?
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <RadioButton
                                            label="Yes"
                                            value="yes"
                                            selectedValue={getLanguageSelectedValue()}
                                            onClick={() => handleHealthInfoChange('language', '')}
                                            name="language_other"
                                            size="small"
                                        />
                                        <RadioButton
                                            label="No"
                                            value="no"
                                            selectedValue={getLanguageSelectedValue()}
                                            onClick={() => handleHealthInfoChange('language', '')}
                                            name="language_other"
                                            size="small"
                                        />
                                        <RadioButton
                                            label="Rather not say"
                                            value="rather_not_say"
                                            selectedValue={getLanguageSelectedValue()}
                                            onClick={() => handleHealthInfoChange('language', 'rather_not_say')}
                                            name="language_other"
                                            size="small"
                                        />
                                    </div>
                                    {getLanguageSelectedValue() === 'yes' && (
                                        <TextField
                                            label="What language do you speak?"
                                            value={healthInfo.language}
                                            onChange={(value) => handleHealthInfoChange('language', value)}
                                            placeholder="Enter language"
                                            size="medium"
                                        />
                                    )}
                                </div>

                                <div>
                                    <label className="font-semibold form-label block mb-1.5 text-slate-700">
                                        Do you require an interpreter?
                                    </label>
                                    <div className="flex flex-wrap gap-2">
                                        <RadioButton
                                            label="Yes"
                                            value={true}
                                            selectedValue={healthInfo.require_interpreter}
                                            onClick={(value) => handleHealthInfoChange('require_interpreter', value === 'true')}
                                            name="interpreter"
                                            size="small"
                                        />
                                        <RadioButton
                                            label="No"
                                            value={false}
                                            selectedValue={healthInfo.require_interpreter}
                                            onClick={(value) => handleHealthInfoChange('require_interpreter', value === 'true')}
                                            name="interpreter"
                                            size="small"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="font-semibold form-label block mb-1.5 text-slate-700">
                                        Are there any cultural or religious beliefs that we should be aware of?
                                    </label>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <RadioButton
                                            label="Yes"
                                            value="yes"
                                            selectedValue={getCulturalBeliefsSelectedValue()}
                                            onClick={() => handleHealthInfoChange('cultural_beliefs', '')}
                                            name="cultural_beliefs"
                                            size="small"
                                        />
                                        <RadioButton
                                            label="No"
                                            value="no"
                                            selectedValue={getCulturalBeliefsSelectedValue()}
                                            onClick={() => handleHealthInfoChange('cultural_beliefs', 'no')}
                                            name="cultural_beliefs"
                                            size="small"
                                        />
                                    </div>
                                    {getCulturalBeliefsSelectedValue() === 'yes' && (
                                        <TextField
                                            label="Please specify"
                                            value={healthInfo.cultural_beliefs}
                                            onChange={(value) => handleHealthInfoChange('cultural_beliefs', value)}
                                            placeholder="Enter cultural or religious beliefs"
                                            size="medium"
                                        />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Emergency Contact Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">Emergency Contact</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <TextField
                                    label="Name"
                                    value={healthInfo.emergency_name}
                                    onChange={(value) => handleHealthInfoChange('emergency_name', value)}
                                    placeholder="Emergency Contact Name"
                                    size="medium"
                                />
                                <TextField
                                    label="Mobile No."
                                    type="phone"
                                    value={healthInfo.emergency_mobile_number}
                                    onChange={(value) => handleHealthInfoChange('emergency_mobile_number', value)}
                                    placeholder="Mobile No."
                                    size="medium"
                                />
                                <TextField
                                    label="Email"
                                    type="email"
                                    value={healthInfo.emergency_email}
                                    onChange={(value) => handleHealthInfoChange('emergency_email', value)}
                                    placeholder="Email"
                                    size="medium"
                                />
                                <TextField
                                    label="Relationship with you"
                                    value={healthInfo.emergency_relationship}
                                    onChange={(value) => handleHealthInfoChange('emergency_relationship', value)}
                                    placeholder="Relationship"
                                    size="medium"
                                />
                            </div>
                        </div>

                        {/* GP/Specialist Information Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">GP OR SPECIALIST INFORMATION</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <TextField
                                    label="Name"
                                    value={healthInfo.specialist_name}
                                    onChange={(value) => handleHealthInfoChange('specialist_name', value)}
                                    placeholder="GP or Specialist Name"
                                    size="medium"
                                />
                                <TextField
                                    label="Mobile No."
                                    type="phone"
                                    value={healthInfo.specialist_mobile_number}
                                    onChange={(value) => handleHealthInfoChange('specialist_mobile_number', value)}
                                    placeholder="Mobile No."
                                    size="medium"
                                />
                                <TextField
                                    label="Practice Name"
                                    value={healthInfo.specialist_practice_name}
                                    onChange={(value) => handleHealthInfoChange('specialist_practice_name', value)}
                                    placeholder="Practice Name"
                                    size="medium"
                                />
                            </div>
                        </div>

                        {/* Spinal Cord Injury Section */}
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">Spinal Cord Injury Information</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
                                <TextField
                                    label="Year of Spinal Cord Injury"
                                    value={healthInfo.sci_year}
                                    onChange={(value) => handleHealthInfoChange('sci_year', value)}
                                    placeholder="e.g., 2020"
                                    size="medium"
                                />
                                <TextField
                                    label="Level of Injury (ASIA)"
                                    value={getSciTypeLevelDisplayValue()}
                                    onChange={handleSciTypeLevelChange}
                                    placeholder="e.g., C5, T12"
                                    size="medium"
                                />
                                <TextField
                                    label="Initial Spinal Rehab Location"
                                    value={healthInfo.sci_intial_spinal_rehab}
                                    onChange={(value) => handleHealthInfoChange('sci_intial_spinal_rehab', value)}
                                    placeholder="e.g., Royal Rehab"
                                    size="medium"
                                />
                            </div>

                            <div className="mb-4">
                                <label className="font-semibold form-label block mb-1.5 text-slate-700">
                                    ASIA Scale Score (Movement/Sensation)
                                </label>
                                <div className="space-y-3">
                                    <RadioButton
                                        label="A - Complete, no motor or sensory function below the level of injury"
                                        value="A"
                                        selectedValue={healthInfo.sci_type || ''}
                                        onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                        name="asia_scale"
                                        size="small"
                                    />
                                    <RadioButton
                                        label="B - Some sensation, no motor function below the level of injury"
                                        value="B"
                                        selectedValue={healthInfo.sci_type || ''}
                                        onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                        name="asia_scale"
                                        size="small"
                                    />
                                    <RadioButton
                                        label="C - Less than 50% motor function below level of injury but cannot move against gravity"
                                        value="C"
                                        selectedValue={healthInfo.sci_type || ''}
                                        onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                        name="asia_scale"
                                        size="small"
                                    />
                                    <RadioButton
                                        label="D - More than 50% motor function below level of injury and can move against gravity"
                                        value="D"
                                        selectedValue={healthInfo.sci_type || ''}
                                        onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                        name="asia_scale"
                                        size="small"
                                    />
                                    <RadioButton
                                        label="E - All muscle, motor and sensory functions have returned"
                                        value="E"
                                        selectedValue={healthInfo.sci_type || ''}
                                        onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                        name="asia_scale"
                                        size="small"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}