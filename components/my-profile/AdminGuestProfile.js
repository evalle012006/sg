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
const Modal = dynamic(() => import('../ui/modal'));

export default function AdminGuestProfile() {
    const dispatch = useDispatch();
    const currentUser = useSelector((state) => state.user.user);
    const user = useSelector((state) => state.guest.data);
    const ability = useContext(AbilityContext);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [guestId, setGuestId] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [profileImageUrl, setProfileImageUrl] = useState('');
    
    // Guest flags state
    const [settingsFlagsList, setSettingsFlagsList] = useState([]);
    const [guestFlags, setGuestFlags] = useState([]);
    const [selectedFlags, setSelectedFlags] = useState([]);
    const [localFlags, setLocalFlags] = useState([]); // Local state for pending flag changes
    const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

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

    const handleEmailGuestLink = async () => {
        if (!guestInfo.email) {
            toast.error('Guest email is required to send the link.');
            return;
        }

        toast.info('Your email is being sent in the background. Feel free to navigate away or continue with other tasks.');
        try {
            const response = await fetch(`/api/guests/${user.uuid}/email-profile-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    adminEmail: currentUser.type === 'user' ? currentUser.email : null, 
                    origin: currentUser.type,
                    guestEmail: guestInfo.email,
                    guestName: `${guestInfo.first_name} ${guestInfo.last_name}`,
                    guestData: guestInfo,
                    healthData: healthInfo
                }),
            });

            if (!response.ok) throw new Error('Failed to send email');
            toast.success('Profile link sent to guest email successfully!');
        } catch (error) {
            console.error('Error sending email:', error);
            toast.error('Failed to send email. Please try again.');
        }
    };
    
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
    
    // Health information state
    const [healthInfo, setHealthInfo] = useState({
        identify_aboriginal_torres: null,
        language: '',
        require_interpreter: null,
        cultural_beliefs: '',
        emergency_name: '',
        emergency_mobile_number: '',
        emergency_email: '',
        emergency_relationship: '',
        specialist_name: '',
        specialist_mobile_number: '',
        specialist_practice_name: '',
        sci_year: '',
        sci_injury_type: '',
        sci_level_asia: '',
        sci_intial_spinal_rehab: '',
        sci_type: '',
        sci_type_level: [], // Changed to array
        sci_other_details: '',
        sci_inpatient: null,
    });

    // Dropdown Options
    const genderOptions = [
        { value: "Male", label: "Male" },
        { value: "Female", label: "Female" },
        { value: "Other", label: "Other" }
    ];

    const countryOptions = [
        { value: "Australia", label: "Australia" },
        { value: "United States", label: "United States" },
        { value: "United Kingdom", label: "United Kingdom" },
        { value: "Canada", label: "Canada" },
        { value: "New Zealand", label: "New Zealand" }
    ];

    const sciTypeOptions = [
        { value: "cervical", label: "(C) Cervical" },
        { value: "thoracic", label: "(T) Thoracic" },
        { value: "lumbar", label: "(L) Lumbar" },
        { value: "sacral", label: "(S) Sacral" },
        { value: "spina_bifida", label: "Spina Bifida" },
        { value: "cauda_equina", label: "Cauda Equina" },
        { value: "other", label: "Other" }
    ];

    const cervicalOptions = ['C1', 'C2', 'C3', 'C4', 'C5', 'C6', 'C7', 'C8'];
    const thoracicOptions = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const lumbarOptions = ['L1', 'L2', 'L3', 'L4', 'L5'];
    const sacralOptions = ['S1', 'S2', 'S3', 'S4', 'S5'];

    const yearOptions = Array.from({ length: 50 }, (_, i) => {
        const year = new Date().getFullYear() - i;
        return { value: year.toString(), label: year.toString() };
    });

    // Helper Methods
    const getLevelOptions = (injuryType) => {
        switch(injuryType) {
            case 'cervical': return cervicalOptions;
            case 'thoracic': return thoracicOptions;
            case 'lumbar': return lumbarOptions;
            case 'sacral': return sacralOptions;
            default: return [];
        }
    };

    const getLevelSectionTitle = (injuryType) => {
        switch(injuryType) {
            case 'cervical': return '(C) Cervical Level (Select all that apply)';
            case 'thoracic': return '(T) Thoracic Level (Select all that apply)';
            case 'lumbar': return '(L) Lumbar Level (Select all that apply)';
            case 'sacral': return '(S) Sacral Level (Select all that apply)';
            default: return 'Level (Select all that apply)';
        }
    };

    // Helper function to check if a level is selected
    const isLevelSelected = (level) => {
        if (!healthInfo.sci_type_level) return false;
        
        if (Array.isArray(healthInfo.sci_type_level)) {
            return healthInfo.sci_type_level.includes(level);
        } else if (typeof healthInfo.sci_type_level === 'string') {
            // Handle legacy comma-separated string format
            return healthInfo.sci_type_level.split(',').includes(level);
        }
        
        return false;
    };

    // Event Handlers
    const handleGuestInfoChange = (field, value) => {
        setGuestInfo(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleHealthInfoChange = (field, value) => {
        console.log(`Updating health info: ${field} = ${value}`);
        setHealthInfo(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSciInjuryTypeChange = (value) => {
        const selectedType = value?.value || '';
        handleHealthInfoChange('sci_injury_type', selectedType);
        // Clear previous level selections when injury type changes
        handleHealthInfoChange('sci_type_level', []);
        // Clear other details if not "other"
        if (selectedType !== 'other') {
            handleHealthInfoChange('sci_other_details', '');
        }
    };

    // Updated to handle arrays instead of comma-separated strings
    const handleSciLevelChange = (isChecked, value) => {
        // Convert current levels to array, handling both string and array formats
        let currentLevels = [];
        if (healthInfo.sci_type_level) {
            if (Array.isArray(healthInfo.sci_type_level)) {
                currentLevels = [...healthInfo.sci_type_level];
            } else if (typeof healthInfo.sci_type_level === 'string') {
                // Handle legacy comma-separated string format
                currentLevels = healthInfo.sci_type_level.split(',').filter(level => level.trim());
            }
        }

        if (isChecked) {
            // Add the level if not already present
            if (!currentLevels.includes(value)) {
                handleHealthInfoChange('sci_type_level', [...currentLevels, value]);
            }
        } else {
            // Remove the level
            handleHealthInfoChange('sci_type_level', currentLevels.filter(l => l !== value));
        }
    };

    const handleLanguageQuestionChange = (value) => {
        if (value === "yes") {
            if (!healthInfo.language || healthInfo.language === 'rather_not_say') {
                handleHealthInfoChange('language', ' ');
            }
        } else if (value === "no") {
            handleHealthInfoChange('language', '');
            handleHealthInfoChange('require_interpreter', false);
        } else if (value === "rather_not_say") {
            handleHealthInfoChange('language', 'rather_not_say');
            handleHealthInfoChange('require_interpreter', false);
        }
    };

    const handleCulturalBeliefsChange = (value) => {
        if (value === "yes") {
            if (!healthInfo.cultural_beliefs || healthInfo.cultural_beliefs === '') {
                handleHealthInfoChange('cultural_beliefs', ' ');
            }
        } else if (value === "no") {
            handleHealthInfoChange('cultural_beliefs', '');
        }
    };

    // Guest Flags Functions
    const updateGuestFlags = () => {
        setGuestFlags(settingsFlagsList.map(flag => ({
            label: _.startCase(flag),  // For display: "Complex Care"
            value: flag,               // For storage: "complex-care"
            checked: localFlags.includes(flag) // Check against local flags
        })));
    };

    const handleFlagCheckboxChange = (isChecked, flagValue) => {
        let updatedFlags;
        
        if (isChecked) {
            updatedFlags = [...localFlags, flagValue];
        } else {
            updatedFlags = localFlags.filter(flag => flag !== flagValue);
        }

        // Check if banned flag is being added
        if (isChecked && flagValue === 'banned') {
            setLocalFlags(updatedFlags);
            setShowDeactivateDialog(true);
        } else {
            setLocalFlags(updatedFlags);
            setSelectedFlags(updatedFlags.map(flag => _.startCase(flag)));
        }
    };

    const handleUpdateGuestFlags = async (selectedFlags, withBanned) => {
        try {
            // selectedFlags is already in the correct format for the API
            const response = await fetch(`/api/guests/${user.uuid}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ ...user, flags: selectedFlags }),
            });

            if (response.ok) {
                // Update local selectedFlags state for display
                setSelectedFlags(selectedFlags.map(flag => _.startCase(flag)));
                
                setTimeout(() => {
                    toast("Guest flags updated successfully", { type: "success" });
                }, 1000);
            } else {
                toast.error("Failed to update guest flags");
            }
        } catch (error) {
            console.error('Error updating flags:', error);
            toast.error("Failed to update guest flags");
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);

        try {
            // Validate required fields before submission (client-side check)
            const requiredGuestFields = ['first_name', 'last_name', 'email'];
            const missingFields = requiredGuestFields.filter(field => !guestInfo[field]?.trim());
            
            if (missingFields.length > 0) {
                toast.error(`Please fill in required fields: ${missingFields.join(', ')}`);
                setSaving(false);
                return;
            }

            const mappedGuestInfo = {
                guest_id: user?.id || user?.uuid,
                first_name: guestInfo.first_name,
                last_name: guestInfo.last_name,
                email: guestInfo.email,
                phone_number: guestInfo.phone_number,
                dob: guestInfo.dob,
                gender: guestInfo.gender,
                flags: localFlags,
                address_street1: guestInfo.street_address_line_1,
                address_street2: guestInfo.street_address_line_2,
                address_city: guestInfo.city,
                address_state_province: guestInfo.state,
                address_postal: guestInfo.post_code,
                address_country: guestInfo.country
            };

            // Determine the correct API endpoint based on user type
            const apiEndpoint = '/api/my-profile/save-update';

            const requestBody = { ...mappedGuestInfo, ...healthInfo }

            // Single API call to save/update guest, health information, and flags
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            const result = await response.json();

            if (response.ok) {
                toast.success(result.message || 'Profile updated successfully');
                
                // Update local state with returned data
                if (result.data) {
                    // Update guest info state with proper field mapping
                    setGuestInfo({
                        first_name: result.data.first_name || '',
                        last_name: result.data.last_name || '',
                        email: result.data.email || '',
                        phone_number: result.data.phone_number || '',
                        dob: result.data.dob || '',
                        gender: result.data.gender || '',
                        // FIXED: Map returned address fields back to UI field names
                        street_address_line_1: result.data.address_street1 || '',
                        street_address_line_2: result.data.address_street2 || '',
                        city: result.data.address_city || '',
                        state: result.data.address_state_province || '',
                        post_code: result.data.address_postal || '',
                        country: result.data.address_country || ''
                    });
                    
                    // Update health info state - ensure sci_type_level is an array
                    if (result.data.HealthInfo) {
                        const healthInfoData = { ...result.data.HealthInfo };
                        if (healthInfoData.sci_type_level && typeof healthInfoData.sci_type_level === 'string') {
                            // Convert legacy comma-separated string to array
                            healthInfoData.sci_type_level = healthInfoData.sci_type_level.split(',').filter(level => level.trim());
                        }
                        setHealthInfo(healthInfoData);
                    }

                    // Update flags state
                    if (result.data.flags) {
                        setLocalFlags(result.data.flags);
                        setSelectedFlags(result.data.flags.map(flag => _.startCase(flag)));
                    }
                }
                
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                toast.error(result.message || 'Failed to save profile information');
            }
        } catch (error) {
            console.error('Error saving profile:', error);
            toast.error(error.message || 'Failed to save profile information');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        window.location.reload();
    };

    const loadProfileInfo = async () => {
        try {
            // Use the appropriate user ID based on user type
            const targetUserId = user?.id || user?.uuid || 1;
            setGuestId(targetUserId);
            
            const apiEndpoint =`/api/my-profile/${targetUserId}`;
            
            const response = await fetch(apiEndpoint);
            
            if (response.ok) {
                const data = await response.json();
                console.log('Profile data:', data);
                
                // Use profileUrl instead of profile_filename
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
                        // Convert legacy comma-separated string to array
                        healthInfoData.sci_type_level = healthInfoData.sci_type_level.split(',').filter(level => level.trim());
                    }
                    setHealthInfo(healthInfoData);
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

    // Fetch settings flags list
    useEffect(() => {
        const fetchSettingsFlagsList = async () => {
            const response = await fetch('/api/settings/guest_flag');
            const data = await response.json();
            setSettingsFlagsList(data.map(flag => flag.value));
        }
        fetchSettingsFlagsList();
    }, []);

    // Update guest flags when settingsFlagsList or localFlags changes
    useEffect(() => {
        if (settingsFlagsList.length > 0) {
            updateGuestFlags();
        }
    }, [settingsFlagsList, localFlags]);

    // Initialize local flags when user data loads
    useEffect(() => {
        if (user?.flags) {
            setLocalFlags(user.flags);
            setSelectedFlags(user.flags.map(flag => _.startCase(flag)));
        }
    }, [user?.flags]);

    // Helper functions for conditional rendering
    const getLanguageSelectedValue = () => {
        return healthInfo.language && healthInfo.language !== '' && healthInfo.language !== 'rather_not_say' 
            ? "yes" 
            : healthInfo.language === 'rather_not_say' 
                ? "rather_not_say" 
                : "no";
    };

    const getAboriginalSelectedValue = () => {
        return healthInfo.identify_aboriginal_torres === true 
            ? "true" 
            : healthInfo.identify_aboriginal_torres === false 
                ? "false" 
                : "null";
    };

    const getInpatientSelectedValue = () => {
        return healthInfo.sci_inpatient === true 
            ? "true" 
            : healthInfo.sci_inpatient === false 
                ? "false" 
                : "null";
    };

    const shouldShowLanguageFields = () => {
        return healthInfo.language && healthInfo.language !== '' && healthInfo.language !== 'rather_not_say';
    };

    const shouldShowCulturalBeliefsField = () => {
        return healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '';
    };

    const shouldShowLevelCheckboxes = () => {
        return ['cervical', 'thoracic', 'lumbar', 'sacral'].includes(healthInfo.sci_injury_type);
    };

    const shouldShowOtherDetailsField = () => {
        return healthInfo.sci_injury_type === 'other';
    };

    const checkFileSize = (fileSize, maxSize) => {
        if (fileSize > maxSize) {
            const maxSizeMB = maxSize / (1024 * 1024);
            return `File size exceeds ${maxSizeMB}MB limit`;
        }
        return null;
    };

    const updateProfilePhoto = async (e) => {
        dispatch(globalActions.setLoading(true));
        setImageUploading(true);
        const file = e.target.files[0];
        
        if (!file) {
            setImageUploading(false);
            dispatch(globalActions.setLoading(false));
            return;
        }

        const formData = new FormData();

        const fileSizeMsg = checkFileSize(file.size, 5120000); // 5MB limit
        if (fileSizeMsg) {
            toast.error(fileSizeMsg);
            e.target.value = null;
            setImageUploading(false);
            dispatch(globalActions.setLoading(false));
        } else {
            try {
                formData.append("fileType", "profile-photo");
                formData.append("userType", "guest");
                formData.append("file", file);

                const response = await fetch("/api/storage/profile-photo?" + new URLSearchParams({ 
                    email: guestInfo.email, 
                    userType: "guest" 
                }), {
                    method: "POST",
                    body: formData,
                });

                if (response.ok) {
                    const data = await response.json();
                    console.log('Upload response:', data);
                    
                    // Reload profile info to get updated data with new signed URL
                    setTimeout(async () => {
                        try {
                            await loadProfileInfo();
                            toast.success('Profile picture updated successfully');
                        } catch (error) {
                            console.error('Error reloading profile:', error);
                            toast.error('Profile picture uploaded but failed to refresh');
                        } finally {
                            setImageUploading(false);
                            dispatch(globalActions.setLoading(false));
                        }
                    }, 1000);
                } else {
                    const errorData = await response.json();
                    toast.error(errorData.message || 'Failed to upload profile picture');
                    setImageUploading(false);
                    dispatch(globalActions.setLoading(false));
                }
            } catch (error) {
                console.error('Error uploading profile picture:', error);
                toast.error('Failed to upload profile picture');
                setImageUploading(false);
                dispatch(globalActions.setLoading(false));
            }
        }

        // Clear the input value to allow re-uploading the same file
        e.target.value = null;
    };

    // Don't render if we don't have user data
    if (!user) {
        return (
            <div className='flex items-center justify-center min-h-screen'>
                <Spinner />
            </div>
        );
    }

    return (
        <>
            {loading ? (
                <div className='flex items-center justify-center min-h-screen'>
                    <Spinner />
                </div>
            ) : (
                <div className="w-full">
                    {/* Header Section */}
                    <div className="mb-4 sm:mb-6 pb-4 border-b border-gray-200">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                            <h1 className="text-lg sm:text-xl font-bold text-gray-800 uppercase">
                                {guestInfo.first_name && guestInfo.last_name 
                                    ? `${guestInfo.first_name} ${guestInfo.last_name}` 
                                    : 'Guest Profile'}
                            </h1>
                            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                                <button 
                                    onClick={handleDownloadGuestPDF}
                                    disabled={!user || !guestInfo.first_name}
                                    className="px-3 sm:px-4 py-2 bg-gray-500 text-white text-xs sm:text-sm rounded hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                >
                                    DOWNLOAD AS PDF
                                </button>
                                <button 
                                    onClick={handleEmailGuestLink}
                                    disabled={!user || !guestInfo.email}
                                    className="px-3 sm:px-4 py-2 bg-blue-600 text-white text-xs sm:text-sm rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                >
                                    SEND EMAIL LINK
                                </button>
                                <Can I="Create/Edit" a="Guest">
                                    <button 
                                        onClick={handleSubmit}
                                        disabled={saving}
                                        className="px-3 sm:px-4 py-2 bg-yellow-500 text-white text-xs sm:text-sm rounded hover:bg-yellow-600 disabled:opacity-50 w-full sm:w-auto"
                                    >
                                        {saving ? 'UPDATING...' : 'UPDATE'}
                                    </button>
                                </Can>
                            </div>
                        </div>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-5 gap-6 sm:gap-8">
                        {/* Left Column - Profile Image and Flags */}
                        <div className="xl:col-span-1 space-y-4">
                            <ProfileImage 
                                profileImageUrl={profileImageUrl}
                                imageUploading={imageUploading}
                                onImageUpload={updateProfilePhoto}
                                disabled={!ability.can('Create/Edit', "Guest")}
                            />
                            
                            {/* Add Flag Section */}
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
                                            let bgColor = 'bg-gray-500'; // default
                                            
                                            if (flag === 'Complex Care') {
                                                bgColor = 'bg-amber-500';
                                            } else if (flag === 'Banned') {
                                                bgColor = 'bg-red-500';
                                            } else if (flag === 'Outstanding Invoices') {
                                                bgColor = 'bg-fuchsia-500';
                                            } else if (flag === 'Specific Room Requirements') {
                                                bgColor = 'bg-sky-500';
                                            } else if (flag === 'Account Credit') {
                                                bgColor = 'bg-green-500';
                                            } else if (flag === 'Deceased') {
                                                bgColor = 'bg-slate-700';
                                            } else if (flag === 'Not Eligible') {
                                                bgColor = 'bg-gray-500';
                                            }
                                            
                                            return (
                                                <p key={index} className={`${bgColor} w-fit px-2 p-1 text-xs text-white rounded-full`}>
                                                    {_.startCase(flag)}
                                                </p>
                                            );
                                        })}
                                    </div>
                                </Can>
                            </div>
                        </div>
                        
                        {/* Right Column - All Form Fields */}
                        <div className="xl:col-span-4 space-y-6">
                            {/* Basic Information Fields */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                <TextField
                                    label="First Name"
                                    value={guestInfo.first_name}
                                    onChange={(value) => handleGuestInfoChange('first_name', value)}
                                    placeholder="Maya"
                                    size="medium"
                                    disabled={!ability.can('Create/Edit', "Guest")}
                                />
                                <TextField
                                    label="Last Name"
                                    value={guestInfo.last_name}
                                    onChange={(value) => handleGuestInfoChange('last_name', value)}
                                    placeholder="Sinclair"
                                    size="medium"
                                    disabled={!ability.can('Create/Edit', "Guest")}
                                />
                                <div className="sm:col-span-2 lg:col-span-1">
                                    <TextField
                                        label="Email"
                                        type="email"
                                        value={guestInfo.email}
                                        onChange={(value) => handleGuestInfoChange('email', value)}
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                        placeholder="example@gmail.com"
                                        size="medium"
                                    />
                                </div>
                                <TextField
                                    label="Mobile No."
                                    type="phone"
                                    value={guestInfo.phone_number}
                                    onChange={(value) => handleGuestInfoChange('phone_number', value)}
                                    placeholder="+61 123 456 789"
                                    size="medium"
                                    disabled={!ability.can('Create/Edit', "Guest")}
                                />
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700">Gender</label>
                                    <Select
                                        placeholder="Female"
                                        options={genderOptions}
                                        value={genderOptions.find(opt => opt.value === guestInfo.gender) || null}
                                        onClick={(value) => handleGuestInfoChange('gender', value?.value || '')}
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                </div>
                                <DatePicker
                                    label="Date of Birth (Person with SCI)"
                                    value={guestInfo.dob}
                                    onChange={(value) => handleGuestInfoChange('dob', value)}
                                    size="medium"
                                    placeholder="4 / 11 / 1994"
                                    disabled={!ability.can('Create/Edit', "Guest")}
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
                                            disabled={!ability.can('Create/Edit', "Guest")}
                                        />
                                    </div>
                                    <div className="sm:col-span-2 lg:col-span-1">
                                        <TextField
                                            label="Street Address Line 2 (Optional)"
                                            value={guestInfo.street_address_line_2}
                                            onChange={(value) => handleGuestInfoChange('street_address_line_2', value)}
                                            placeholder="Street Address Line 2"
                                            size="medium"
                                            disabled={!ability.can('Create/Edit', "Guest")}
                                        />
                                    </div>
                                    <TextField
                                        label="City"
                                        value={guestInfo.city}
                                        onChange={(value) => handleGuestInfoChange('city', value)}
                                        placeholder="Glen Iris"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="State / Province"
                                        value={guestInfo.state}
                                        onChange={(value) => handleGuestInfoChange('state', value)}
                                        placeholder="VIC"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="Post Code"
                                        value={guestInfo.post_code}
                                        onChange={(value) => handleGuestInfoChange('post_code', value)}
                                        placeholder="3146"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <div>
                                        <label className="block text-sm font-medium mb-2 text-gray-700">Country</label>
                                        <Select
                                            placeholder="Australia"
                                            options={countryOptions}
                                            value={countryOptions.find(opt => opt.value === guestInfo.country) || null}
                                            onClick={(value) => handleGuestInfoChange('country', value?.value || '')}
                                            size="medium"
                                            disabled={!ability.can('Create/Edit', "Guest")}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Aboriginal/Torres Strait Islander Section */}
                            <div className="border-t border-gray-200 pt-6">
                                {/* <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">IDENTIFIED AS ABORIGINAL OR TORRES STRAIT ISLANDER</h2> */}
                                <div className="space-y-6">
                                    <div>
                                        <p className="text-sm font-medium mb-3 text-gray-700">Do you identify as Aboriginal or Torres Strait Islander? (Person with SCI)</p>
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                            <RadioButton
                                                label="Yes"
                                                value="true"
                                                selectedValue={getAboriginalSelectedValue()}
                                                onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === "true")}
                                                name="identify_aboriginal_torres"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="No"
                                                value="false"
                                                selectedValue={getAboriginalSelectedValue()}
                                                onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === "true" ? true : false)}
                                                name="identify_aboriginal_torres"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="Rather not to say"
                                                value="null"
                                                selectedValue={getAboriginalSelectedValue()}
                                                onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', null)}
                                                name="identify_aboriginal_torres"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <p className="text-sm font-medium mb-3 text-gray-700">Do you speak a language other than English at home? (Person with SCI)</p>
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                            <RadioButton
                                                label="Yes"
                                                value="yes"
                                                selectedValue={getLanguageSelectedValue()}
                                                onClick={(value) => handleLanguageQuestionChange(value)}
                                                name="language_question"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="No"
                                                value="no"
                                                selectedValue={getLanguageSelectedValue()}
                                                onClick={(value) => handleLanguageQuestionChange(value)}
                                                name="language_question"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="Rather not to say"
                                                value="rather_not_say"
                                                selectedValue={getLanguageSelectedValue()}
                                                onClick={(value) => handleLanguageQuestionChange(value)}
                                                name="language_question"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                        
                                        {shouldShowLanguageFields() && (
                                            <div className="mt-6">
                                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                                    <TextField
                                                        label="Language spoken at home"
                                                        value={healthInfo.language === ' ' ? '' : healthInfo.language}
                                                        onChange={(value) => handleHealthInfoChange('language', value)}
                                                        placeholder="Enter the language spoken at home"
                                                        size="medium"
                                                        disabled={!ability.can('Create/Edit', "Guest")}
                                                    />
                                                    
                                                    <div>
                                                        <p className="text-sm font-medium mb-3 text-gray-700">Do you require an interpreter?</p>
                                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-8">
                                                            <RadioButton
                                                                label="Yes"
                                                                value="true"
                                                                selectedValue={healthInfo.require_interpreter === true ? "true" : "false"}
                                                                onClick={(value) => handleHealthInfoChange('require_interpreter', value === "true")}
                                                                name="require_interpreter"
                                                                size="medium"
                                                                disabled={!ability.can('Create/Edit', "Guest")}
                                                            />
                                                            <RadioButton
                                                                label="No"
                                                                value="false"
                                                                selectedValue={healthInfo.require_interpreter === true ? "true" : "false"}
                                                                onClick={(value) => handleHealthInfoChange('require_interpreter', value === "true")}
                                                                name="require_interpreter"
                                                                size="medium"
                                                                disabled={!ability.can('Create/Edit', "Guest")}
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <p className="text-sm font-medium mb-3 text-gray-700">Do you have any cultural beliefs or values that you would like our staff to be aware of?</p>
                                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                            <RadioButton
                                                label="Yes"
                                                value="yes"
                                                selectedValue={healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '' ? "yes" : "no"}
                                                onClick={(value) => handleCulturalBeliefsChange(value)}
                                                name="cultural_beliefs_question"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="No"
                                                value="no"  
                                                selectedValue={healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '' ? "yes" : "no"}
                                                onClick={(value) => handleCulturalBeliefsChange(value)}
                                                name="cultural_beliefs_question"
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                        
                                        {shouldShowCulturalBeliefsField() && (
                                            <TextField
                                                label="Please give details on cultural beliefs or values you would like our staff to be aware of"
                                                value={healthInfo.cultural_beliefs === ' ' ? '' : healthInfo.cultural_beliefs}
                                                onChange={(value) => handleHealthInfoChange('cultural_beliefs', value)}
                                                placeholder="Please describe your cultural beliefs or values..."
                                                size="medium"
                                                multiline={true}
                                                rows={3}
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Emergency Contact Section */}
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">EMERGENCY CONTACT INFORMATION</h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <TextField
                                        label="Name"
                                        value={healthInfo.emergency_name}
                                        onChange={(value) => handleHealthInfoChange('emergency_name', value)}
                                        placeholder="Name"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="Mobile No."
                                        type="phone"
                                        value={healthInfo.emergency_mobile_number}
                                        onChange={(value) => handleHealthInfoChange('emergency_mobile_number', value)}
                                        placeholder="Mobile No."
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="Email"
                                        type="email"
                                        value={healthInfo.emergency_email}
                                        onChange={(value) => handleHealthInfoChange('emergency_email', value)}
                                        placeholder="Email"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="Relationship with you"
                                        value={healthInfo.emergency_relationship}
                                        onChange={(value) => handleHealthInfoChange('emergency_relationship', value)}
                                        placeholder="Relationship"
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
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
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <TextField
                                        label="Mobile No."
                                        type="phone"
                                        value={healthInfo.specialist_mobile_number}
                                        onChange={(value) => handleHealthInfoChange('specialist_mobile_number', value)}
                                        placeholder="GP or Specialist Mobile No."
                                        size="medium"
                                        disabled={!ability.can('Create/Edit', "Guest")}
                                    />
                                    <div className="sm:col-span-2 lg:col-span-1">
                                        <TextField
                                            label="Practice Name"
                                            value={healthInfo.specialist_practice_name}
                                            onChange={(value) => handleHealthInfoChange('specialist_practice_name', value)}
                                            placeholder="GP or Specialist Practice Name"
                                            size="medium"
                                            disabled={!ability.can('Create/Edit', "Guest")}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* SCI Information Section */}
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-base sm:text-lg font-semibold mb-4 text-gray-700 uppercase">SCI INFORMATION</h2>
                                <div className="space-y-6">
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">What year did you begin living with your Spinal Cord Injury?</label>
                                            <Select
                                                placeholder="2022"
                                                options={yearOptions}
                                                value={yearOptions.find(opt => opt.value === healthInfo.sci_year) || null}
                                                onClick={(value) => handleHealthInfoChange('sci_year', value?.value || '')}
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Level/Type of Spinal Cord Injury</label>
                                            <Select
                                                placeholder="(C) Cervical"
                                                options={sciTypeOptions}
                                                value={sciTypeOptions.find(opt => opt.value === healthInfo.sci_injury_type) || null}
                                                onClick={handleSciInjuryTypeChange}
                                                size="medium"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* Level Selection for specific injury types */}
                                        {shouldShowLevelCheckboxes() && (
                                            <div>
                                                <label className="block text-sm font-medium mb-3 text-gray-700">
                                                    {getLevelSectionTitle(healthInfo.sci_injury_type)}
                                                </label>
                                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                                    {getLevelOptions(healthInfo.sci_injury_type).map(level => (
                                                        <Checkbox
                                                            key={level}
                                                            label={level}
                                                            value={level}
                                                            checked={isLevelSelected(level)} // Use the new helper function
                                                            onClick={handleSciLevelChange}
                                                            size="small"
                                                            name={`sci_level_${level}`}
                                                            mode="button"
                                                            disabled={!ability.can('Create/Edit', "Guest")}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div>
                                        <label className="block text-sm font-medium mb-3 text-gray-700">
                                            Level of Function or A.S.I.A. Scale Score (Movement/Sensation)
                                        </label>
                                        <div className="space-y-3">
                                            <RadioButton
                                                label="A - Complete, no motor or sensory function below the level of injury"
                                                value="A"
                                                selectedValue={healthInfo.sci_type || ''}
                                                onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                                name="asia_scale"
                                                size="small"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="B - Some sensation, no motor function below the level of injury"
                                                value="B"
                                                selectedValue={healthInfo.sci_type || ''}
                                                onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                                name="asia_scale"
                                                size="small"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="C - Less than 50% motor function below level of injury but cannot move against gravity"
                                                value="C"
                                                selectedValue={healthInfo.sci_type || ''}
                                                onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                                name="asia_scale"
                                                size="small"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="D - More than 50% motor function below level of injury and can move against gravity"
                                                value="D"
                                                selectedValue={healthInfo.sci_type || ''}
                                                onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                                name="asia_scale"
                                                size="small"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                            <RadioButton
                                                label="E - All muscle, motor and sensory functions have returned"
                                                value="E"
                                                selectedValue={healthInfo.sci_type || ''}
                                                onClick={(value) => handleHealthInfoChange('sci_type', value)}
                                                name="asia_scale"
                                                size="small"
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* Additional text field for "Other" option */}
                                    {shouldShowOtherDetailsField() && (
                                        <div>
                                            <TextField
                                                label="Provide more detail"
                                                value={healthInfo.sci_other_details}
                                                onChange={(value) => handleHealthInfoChange('sci_other_details', value)}
                                                placeholder="Please provide more details about your spinal cord injury"
                                                size="medium"
                                                multiline={true}
                                                rows={3}
                                                disabled={!ability.can('Create/Edit', "Guest")}
                                            />
                                        </div>
                                    )}
                                    
                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        <TextField
                                            label="Where did you complete your initial spinal cord injury rehab?"
                                            value={healthInfo.sci_intial_spinal_rehab}
                                            onChange={(value) => handleHealthInfoChange('sci_intial_spinal_rehab', value)}
                                            placeholder="Grace McKellar Centre, Geelong"
                                            size="medium"
                                            disabled={!ability.can('Create/Edit', "Guest")}
                                        />
                                        
                                        <div>
                                            <p className="text-sm font-medium mb-3 text-gray-700">Are you currently an inpatient?</p>
                                            <div className="flex flex-col sm:flex-row gap-3 sm:gap-6">
                                                <RadioButton
                                                    label="Yes"
                                                    value="true"
                                                    selectedValue={getInpatientSelectedValue()}
                                                    onClick={(value) => handleHealthInfoChange('sci_inpatient', value === "true")}
                                                    name="sci_inpatient"
                                                    size="medium"
                                                    disabled={!ability.can('Create/Edit', "Guest")}
                                                />
                                                <RadioButton
                                                    label="No"
                                                    value="false"
                                                    selectedValue={getInpatientSelectedValue()}
                                                    onClick={(value) => handleHealthInfoChange('sci_inpatient', value === "true" ? true : false)}
                                                    name="sci_inpatient"
                                                    size="medium"
                                                    disabled={!ability.can('Create/Edit', "Guest")}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </form>
                    
                    {/* Read-only notification for users without edit permissions */}
                    <Can not I="Create/Edit" a="Guest">
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex">
                                <div className="flex-shrink-0">
                                    <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div className="ml-3">
                                    <p className="text-sm text-blue-700">
                                        You are viewing this profile in read-only mode. You do not have permission to edit guest information.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </Can>
                    
                    {/* Banned Confirmation Modal */}
                    {(showDeactivateDialog && selectedFlags) && (
                        <Modal 
                            title={`Banned selected guest?`}
                            description={`Are you sure you want to add the banned flag to this guest? This will be saved when you click the UPDATE button.`}
                            confirmLabel='Proceed'
                            onClose={() => {
                                setShowDeactivateDialog(false);
                                // Remove banned flag from local flags when closing modal
                                const flagsWithoutBanned = localFlags.filter(flag => flag !== 'banned');
                                setLocalFlags(flagsWithoutBanned);
                                setSelectedFlags(flagsWithoutBanned.map(flag => _.startCase(flag)));
                            }}
                            onConfirm={(e) => {
                                e.preventDefault();
                                // Just close the modal - the banned flag is already in localFlags
                                // It will be saved when the user clicks UPDATE
                                setShowDeactivateDialog(false);
                                setSelectedFlags(localFlags.map(flag => _.startCase(flag)));
                            }} 
                        />
                    )}
                </div>
            )}
        </>
    );
}