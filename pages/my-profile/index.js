import React, { useEffect, useState } from "react";
import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import ProfileImage from "../../components/my-profile/ProfileImage";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/router";

const Layout = dynamic(() => import('../../components/layout'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const RadioButton = dynamic(() => import('../../components/ui-v2/RadioButton'));
const Checkbox = dynamic(() => import('../../components/ui-v2/CheckboxButton'));
const DatePicker = dynamic(() => import('../../components/ui-v2/DateField'));
const TextField = dynamic(() => import('../../components/ui-v2/TextField'));
const Select = dynamic(() => import('../../components/ui-v2/Select'));
const SelectComponent = dynamic(() => import('../../components/ui/select'));

export default function GuestProfilePage() {
    const dispatch = useDispatch();
    const router = useRouter();
    const user = useSelector((state) => state.user.user);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [guestId, setGuestId] = useState(null);
    const [imageUploading, setImageUploading] = useState(false);
    const [profileImageUrl, setProfileImageUrl] = useState('');
    
    // Package options state
    const [packageOptions, setPackageOptions] = useState([]);
    const [loadingPackages, setLoadingPackages] = useState(false);

    const handleBack = () => {
       if (window.history.length > 1) {
           router.back();
       } else {
           router.push('/bookings');
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
        identify_aboriginal_torres: false, // Default to false instead of null
        language: '', // Default to empty string (represents "No") instead of null
        require_interpreter: false,
        cultural_beliefs: '', // Default to empty string (represents "No") instead of null
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
        sci_type_level: '',
        sci_other_details: '',
        sci_inpatient: false, // Default to false instead of null
    });

    // Funding information state - UPDATED to use package_id
    const [fundingInfo, setFundingInfo] = useState({
        approval_number: '',
        nights_approved: '',
        package_id: null, // Changed from package_approved to package_id
        package_approved: '', // Keep for display purposes
        approval_from: '',
        approval_to: ''
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

    const detailedAsiaOptions = [
        { value: "A", label: "A - Complete, no motor or sensory function below the level of injury" },
        { value: "B", label: "B - Some sensation, no motor function below the level of injury" },
        { value: "C", label: "C - Less than 50% motor function below level of injury but cannot move against gravity" },
        { value: "D", label: "D - More than 50% motor function below level of injury and can move against gravity" },
        { value: "E", label: "E - All muscle, motor and sensory functions have returned" }
    ];

    const yearOptions = Array.from({ length: 50 }, (_, i) => {
        const year = new Date().getFullYear() - i;
        return { value: year.toString(), label: year.toString() };
    });

    // UPDATED: Load package options from API - same as FundingForm
    const loadPackageOptions = async () => {
        setLoadingPackages(true);
        try {
            // Fetch non-NDIS packages from the API
            const response = await fetch('/api/packages/?funder=Non-NDIS&limit=100');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            // Transform API response to dropdown format
            const packageList = [];
            const responseData = result.packages || result;
            
            if (Array.isArray(responseData)) {
                responseData.forEach(pkg => {
                    // Only include Non-NDIS packages
                    if (pkg.funder === 'Non-NDIS') {
                        const label = pkg.name + (pkg.package_code ? ` (${pkg.package_code})` : '');
                        packageList.push({
                            label: label,
                            value: pkg.id, // Use package ID as value instead of label
                            packageData: pkg // Store full package data for reference
                        });
                    }
                });
            }
            
            // Sort alphabetically by label
            packageList.sort((a, b) => a.label.localeCompare(b.label));

            setPackageOptions(packageList);

        } catch (error) {
            console.error('Error loading package options:', error);
            toast.error('Failed to load package options. Using default options.');
        } finally {
            setLoadingPackages(false);
        }
    };

    // ADDED: Find the selected package label based on package_id
    const getSelectedPackageLabel = () => {
        if (fundingInfo.package_id && packageOptions.length > 0) {
            const selectedOption = packageOptions.find(option => option.value === fundingInfo.package_id);
            return selectedOption ? selectedOption.label : '';
        }
        return '';
    };

    // UPDATED: Handle package selection
    const handlePackageChange = (selected) => {
        if (selected && selected.value) {
            setFundingInfo(prev => ({ 
                ...prev, 
                package_id: selected.value,
                package_approved: selected.label // Update display name for compatibility
            }));
        } else {
            // Handle clearing the selection
            setFundingInfo(prev => ({ 
                ...prev, 
                package_id: null,
                package_approved: ''
            }));
        }
    };

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

    // UPDATED: Funding info change handler
    const handleFundingInfoChange = (field, value) => {
        setFundingInfo(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSciInjuryTypeChange = (value) => {
        const selectedType = value?.value || '';
        handleHealthInfoChange('sci_injury_type', selectedType);
        // Clear previous level selections when injury type changes
        handleHealthInfoChange('sci_type_level', '');
        // Clear other details if not "other"
        if (selectedType !== 'other') {
            handleHealthInfoChange('sci_other_details', '');
        }
    };

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

            // Map UI field names to API expected field names
            const mappedGuestInfo = {
                first_name: guestInfo.first_name,
                last_name: guestInfo.last_name,
                email: guestInfo.email,
                phone_number: guestInfo.phone_number,
                dob: guestInfo.dob,
                gender: guestInfo.gender,
                // Map address fields to API expected names
                address_street1: guestInfo.street_address_line_1,
                address_street2: guestInfo.street_address_line_2,
                address_city: guestInfo.city,
                address_state_province: guestInfo.state,
                address_postal: guestInfo.post_code,
                address_country: guestInfo.country
            };

            // ADDED: Clean health info to ensure no null values
            const cleanedHealthInfo = validateAndCleanHealthInfo(healthInfo);

            // Single API call to save/update guest, health, and funding information
            const response = await fetch('/api/my-profile/save-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    guest_id: guestId,
                    // Guest information with mapped field names
                    ...mappedGuestInfo,
                    // UPDATED: Use cleaned health information
                    ...cleanedHealthInfo,
                    // Funding information with package_id
                    approval_number: fundingInfo.approval_number,
                    nights_approved: fundingInfo.nights_approved,
                    package_id: fundingInfo.package_id,
                    approval_from: fundingInfo.approval_from,
                    approval_to: fundingInfo.approval_to
                }),
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
                        // Map returned address fields back to UI field names
                        street_address_line_1: result.data.address_street1 || '',
                        street_address_line_2: result.data.address_street2 || '',
                        city: result.data.address_city || '',
                        state: result.data.address_state_province || '',
                        post_code: result.data.address_postal || '',
                        country: result.data.address_country || ''
                    });
                    
                    // Update health info state with cleaned data
                    if (result.data.HealthInfo) {
                        const cleanedReturnedHealthInfo = validateAndCleanHealthInfo(result.data.HealthInfo);
                        setHealthInfo(cleanedReturnedHealthInfo);
                    }

                    // Update funding info state with package_id support
                    if (result.data.funding) {
                        setFundingInfo({
                            approval_number: result.data.funding.approval_number || '',
                            nights_approved: result.data.funding.nights_approved || '',
                            package_id: result.data.funding.package_id || null,
                            package_approved: result.data.funding.package_approved || '',
                            approval_from: result.data.funding.approval_from || '',
                            approval_to: result.data.funding.approval_to || ''
                        });
                    }
                }
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
        window.open('/bookings', '_self');
    };

    const loadProfileInfo = async () => {
        try {
            const currentGuestId = user?.id || 1;
            setGuestId(currentGuestId);
            
            const response = await fetch(`/api/my-profile/${currentGuestId}`);
            
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
                    // FIXED: Convert null values to appropriate defaults
                    const healthInfoData = { ...data.HealthInfo };
                    
                    // Ensure sci_type_level is an array
                    if (healthInfoData.sci_type_level && typeof healthInfoData.sci_type_level === 'string') {
                        healthInfoData.sci_type_level = healthInfoData.sci_type_level.split(',').filter(level => level.trim());
                    }
                    
                    // ADDED: Convert null values to appropriate defaults for yes/no questions
                    if (healthInfoData.identify_aboriginal_torres === null || healthInfoData.identify_aboriginal_torres === undefined) {
                        healthInfoData.identify_aboriginal_torres = false;
                    }
                    
                    if (healthInfoData.language === null || healthInfoData.language === undefined) {
                        healthInfoData.language = ''; // Empty string represents "No"
                    }
                    
                    if (healthInfoData.cultural_beliefs === null || healthInfoData.cultural_beliefs === undefined) {
                        healthInfoData.cultural_beliefs = ''; // Empty string represents "No"
                    }
                    
                    if (healthInfoData.sci_inpatient === null || healthInfoData.sci_inpatient === undefined) {
                        healthInfoData.sci_inpatient = false;
                    }
                    
                    if (healthInfoData.require_interpreter === null || healthInfoData.require_interpreter === undefined) {
                        healthInfoData.require_interpreter = false;
                    }
                    
                    setHealthInfo(healthInfoData);
                }

                // Load funding information with package_id support
                if (data.funding) {
                    setFundingInfo({
                        approval_number: data.funding.approval_number || '',
                        nights_approved: data.funding.nights_approved || '',
                        package_id: data.funding.package_id || null,
                        package_approved: data.funding.package_approved || '',
                        approval_from: data.funding.approval_from || '',
                        approval_to: data.funding.approval_to || ''
                    });
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
            cleanedData.language = ''; // Empty string represents "No"
        }
        
        if (cleanedData.cultural_beliefs === null || cleanedData.cultural_beliefs === undefined) {
            cleanedData.cultural_beliefs = ''; // Empty string represents "No"
        }
        
        // Clean up other optional fields
        const optionalStringFields = [
            'specialist_name', 'specialist_mobile_number', 'specialist_practice_name',
            'sci_other_details', 'sci_level_asia'
        ];
        
        optionalStringFields.forEach(field => {
            if (cleanedData[field] === null || cleanedData[field] === undefined) {
                cleanedData[field] = '';
            }
        });
        
        return cleanedData;
    };

    // ADDED: Sync package_approved display name when package options are loaded
    useEffect(() => {
        if (fundingInfo.package_id && packageOptions.length > 0) {
            const selectedOption = packageOptions.find(option => option.value === fundingInfo.package_id);
            if (selectedOption) {
                // Only update if the display name is different to avoid infinite loops
                const expectedLabel = selectedOption.label;
                if (fundingInfo.package_approved !== expectedLabel) {
                    setFundingInfo(prev => ({
                        ...prev,
                        package_approved: expectedLabel
                    }));
                }
            }
        }
    }, [fundingInfo.package_id, packageOptions]);

    // Load Profile Data and Package Options
    useEffect(() => {
        loadProfileInfo();
        loadPackageOptions();
    }, [user]);

    // Helper functions for conditional rendering
    const getLanguageSelectedValue = () => {
        // If language is null/undefined, default to "no"
        if (healthInfo.language === null || healthInfo.language === undefined) {
            return "no";
        }
        return healthInfo.language && healthInfo.language !== '' && healthInfo.language !== 'rather_not_say' 
            ? "yes" 
            : healthInfo.language === 'rather_not_say' 
                ? "rather_not_say" 
                : "no";
    };

    const getAboriginalSelectedValue = () => {
        // Handle null/undefined values
        if (healthInfo.identify_aboriginal_torres === null || healthInfo.identify_aboriginal_torres === undefined) {
            return "false"; // Default to "No"
        }
        return healthInfo.identify_aboriginal_torres === true 
            ? "true" 
            : "false";
    };

    const getInpatientSelectedValue = () => {
        // Handle null/undefined values
        if (healthInfo.sci_inpatient === null || healthInfo.sci_inpatient === undefined) {
            return "false"; // Default to "No"
        }
        return healthInfo.sci_inpatient === true 
            ? "true" 
            : "false";
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
                            // await loadProfileInfo();
                            toast.success('Profile picture updated successfully');
                            setTimeout(() => {
                                window.location.reload();
                            }, 1000);
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

    return (
        <Layout hideSidebar={true} singleScroll={true}>
            {loading ? (
                <div className='flex items-center justify-center min-h-screen'>
                    <Spinner />
                </div>
            ) : (
                <div className="bg-gray-50 min-h-screen">
                    <div className="max-w-6xl mx-auto px-6 py-8">
                        {/* Main Profile Container */}
                        <div 
                            className="bg-white rounded-lg shadow-sm p-8"
                            style={{
                                background: '#FFFFFF',
                                border: '1px solid #E6E6E6',
                                boxShadow: '0px 3px 12px 0px #0000001A'
                            }}
                        >
                            {/* Header Section with Back Button and Title */}
                            <div className="mb-8 pb-6 border-b border-gray-200">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={handleBack}
                                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors group"
                                        type="button"
                                    >
                                        <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                                        <span className="text-sm font-medium">Back</span>
                                    </button>
                                    <h1 className="text-2xl font-bold text-gray-800">MY PROFILE</h1>
                                </div>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-8">
                                {/* Personal Information Section with Profile Image */}
                                <div>
                                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                                        <ProfileImage 
                                            profileImageUrl={profileImageUrl}
                                            imageUploading={imageUploading}
                                            onImageUpload={updateProfilePhoto}
                                            origin="guest"
                                        />
                                        
                                        {/* First Row Fields */}
                                        <TextField
                                            label="First Name"
                                            value={guestInfo.first_name}
                                            onChange={(value) => handleGuestInfoChange('first_name', value)}
                                            placeholder="Jack"
                                            size="medium"
                                        />
                                        <TextField
                                            label="Last Name"
                                            value={guestInfo.last_name}
                                            onChange={(value) => handleGuestInfoChange('last_name', value)}
                                            placeholder="William"
                                            size="medium"
                                        />
                                        <TextField
                                            label="Email"
                                            type="email"
                                            value={guestInfo.email}
                                            disabled={true}
                                            placeholder="william@gmail.com"
                                            size="medium"
                                        />
                                        
                                        {/* Second Row Fields - Profile image will automatically span here */}
                                        <TextField
                                            label="Mobile No."
                                            type="phone"
                                            value={guestInfo.phone_number}
                                            onChange={(value) => handleGuestInfoChange('phone_number', value)}
                                            placeholder="+61 123 456 789"
                                            size="medium"
                                        />
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Gender</label>
                                            <Select
                                                placeholder="Male"
                                                options={genderOptions}
                                                value={genderOptions.find(opt => opt.value === guestInfo.gender) || null}
                                                onClick={(value) => handleGuestInfoChange('gender', value?.value || '')}
                                                size="medium"
                                            />
                                        </div>
                                        <DatePicker
                                            label="Date of Birth (Person with SCI)"
                                            value={guestInfo.dob}
                                            onChange={(value) => handleGuestInfoChange('dob', value)}
                                            size="medium"
                                            placeholder="4 / 11 / 1998"
                                        />
                                    </div>
                                </div>

                                {/* Address Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <h2 className="text-lg font-semibold mb-6 text-gray-700 uppercase">Address</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <TextField
                                            label="Street Address Line 1"
                                            value={guestInfo.street_address_line_1}
                                            onChange={(value) => handleGuestInfoChange('street_address_line_1', value)}
                                            placeholder="Street Address Line 1"
                                            size="medium"
                                        />
                                        <TextField
                                            label="Street Address Line 2 (Optional)"
                                            value={guestInfo.street_address_line_2}
                                            onChange={(value) => handleGuestInfoChange('street_address_line_2', value)}
                                            placeholder="Street Address Line 2"
                                            size="medium"
                                        />
                                        <TextField
                                            label="City"
                                            value={guestInfo.city}
                                            onChange={(value) => handleGuestInfoChange('city', value)}
                                            placeholder="City"
                                            size="medium"
                                        />
                                        <TextField
                                            label="State / Province"
                                            value={guestInfo.state}
                                            onChange={(value) => handleGuestInfoChange('state', value)}
                                            placeholder="State / Province"
                                            size="medium"
                                        />
                                        <TextField
                                            label="Post Code"
                                            value={guestInfo.post_code}
                                            onChange={(value) => handleGuestInfoChange('post_code', value)}
                                            placeholder="Post Code"
                                            size="medium"
                                        />
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">Country</label>
                                            <Select
                                                placeholder="Country"
                                                options={countryOptions}
                                                value={countryOptions.find(opt => opt.value === guestInfo.country) || null}
                                                onClick={(value) => handleGuestInfoChange('country', value?.value || '')}
                                                size="medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Aboriginal/Torres Strait Islander Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <div className="space-y-6">
                                        <div>
                                            <p className="text-sm font-medium mb-3 text-gray-700">Do you identify as Aboriginal or Torres Strait Islander? (Person with SCI)</p>
                                            <div className="flex gap-8">
                                                <RadioButton
                                                    label="Yes"
                                                    value="true"
                                                    selectedValue={getAboriginalSelectedValue()}
                                                    onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === "true")}
                                                    name="identify_aboriginal_torres"
                                                    size="medium"
                                                />
                                                <RadioButton
                                                    label="No"
                                                    value="false"
                                                    selectedValue={getAboriginalSelectedValue()}
                                                    onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', value === "true" ? true : false)}
                                                    name="identify_aboriginal_torres"
                                                    size="medium"
                                                />
                                                <RadioButton
                                                    label="Rather not to say"
                                                    value="null"
                                                    selectedValue={getAboriginalSelectedValue()}
                                                    onClick={(value) => handleHealthInfoChange('identify_aboriginal_torres', null)}
                                                    name="identify_aboriginal_torres"
                                                    size="medium"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <p className="text-sm font-medium mb-3 text-gray-700">Do you speak a language other than English at home? (Person with SCI)</p>
                                            <div className="flex gap-8">
                                                <RadioButton
                                                    label="Yes"
                                                    value="yes"
                                                    selectedValue={getLanguageSelectedValue()}
                                                    onClick={(value) => handleLanguageQuestionChange(value)}
                                                    name="language_question"
                                                    size="medium"
                                                />
                                                <RadioButton
                                                    label="No"
                                                    value="no"
                                                    selectedValue={getLanguageSelectedValue()}
                                                    onClick={(value) => handleLanguageQuestionChange(value)}
                                                    name="language_question"
                                                    size="medium"
                                                />
                                                <RadioButton
                                                    label="Rather not to say"
                                                    value="rather_not_say"
                                                    selectedValue={getLanguageSelectedValue()}
                                                    onClick={(value) => handleLanguageQuestionChange(value)}
                                                    name="language_question"
                                                    size="medium"
                                                />
                                            </div>
                                            
                                            {shouldShowLanguageFields() && (
                                                <div className="mt-6">
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                        <TextField
                                                            label="Language spoken at home"
                                                            value={healthInfo.language === ' ' ? '' : healthInfo.language}
                                                            onChange={(value) => handleHealthInfoChange('language', value)}
                                                            placeholder="Enter the language spoken at home"
                                                            size="medium"
                                                        />
                                                        
                                                        <div>
                                                            <p className="text-sm font-medium mb-3 text-gray-700">Do you require an interpreter?</p>
                                                            <div className="flex gap-8">
                                                                <RadioButton
                                                                    label="Yes"
                                                                    value="true"
                                                                    selectedValue={healthInfo.require_interpreter === true ? "true" : "false"}
                                                                    onClick={(value) => handleHealthInfoChange('require_interpreter', value === "true")}
                                                                    name="require_interpreter"
                                                                    size="medium"
                                                                />
                                                                <RadioButton
                                                                    label="No"
                                                                    value="false"
                                                                    selectedValue={healthInfo.require_interpreter === true ? "true" : "false"}
                                                                    onClick={(value) => handleHealthInfoChange('require_interpreter', value === "true")}
                                                                    name="require_interpreter"
                                                                    size="medium"
                                                                />
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div>
                                            <p className="text-sm font-medium mb-3 text-gray-700">Do you have any cultural beliefs or values that you would like our staff to be aware of?</p>
                                            <div className="flex gap-8 mb-4">
                                                <RadioButton
                                                    label="Yes"
                                                    value="yes"
                                                    selectedValue={healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '' ? "yes" : "no"}
                                                    onClick={(value) => handleCulturalBeliefsChange(value)}
                                                    name="cultural_beliefs_question"
                                                    size="medium"
                                                />
                                                <RadioButton
                                                    label="No"
                                                    value="no"  
                                                    selectedValue={healthInfo.cultural_beliefs && healthInfo.cultural_beliefs !== '' ? "yes" : "no"}
                                                    onClick={(value) => handleCulturalBeliefsChange(value)}
                                                    name="cultural_beliefs_question"
                                                    size="medium"
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
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Emergency Contact Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <h2 className="text-lg font-semibold mb-6 text-gray-700 uppercase">Emergency Contact Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <TextField
                                            label="Name"
                                            value={healthInfo.emergency_name}
                                            onChange={(value) => handleHealthInfoChange('emergency_name', value)}
                                            placeholder="Name"
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
                                        <div className="md:col-span-3">
                                            <TextField
                                                label="Relationship with you"
                                                value={healthInfo.emergency_relationship}
                                                onChange={(value) => handleHealthInfoChange('emergency_relationship', value)}
                                                placeholder="Relationship"
                                                size="medium"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* GP/Specialist Information Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <h2 className="text-lg font-semibold mb-6 text-gray-700 uppercase">GP or Specialist Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                                            placeholder="GP or Specialist Mobile No."
                                            size="medium"
                                        />
                                        <TextField
                                            label="Practice Name"
                                            value={healthInfo.specialist_practice_name}
                                            onChange={(value) => handleHealthInfoChange('specialist_practice_name', value)}
                                            placeholder="GP or Specialist Practice Name"
                                            size="medium"
                                        />
                                    </div>
                                </div>

                                {/* SCI Information Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <h2 className="text-lg font-semibold mb-6 text-gray-700 uppercase">SCI Information</h2>
                                    <div className="space-y-6">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-700">What year did you begin living with your Spinal Cord Injury?</label>
                                                <Select
                                                    placeholder="2022"
                                                    options={yearOptions}
                                                    value={yearOptions.find(opt => opt.value === healthInfo.sci_year) || null}
                                                    onClick={(value) => handleHealthInfoChange('sci_year', value?.value || '')}
                                                    size="medium"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-700">Level/Type of Spinal Cord Injury</label>
                                                <Select
                                                    placeholder="Select injury type"
                                                    options={sciTypeOptions}
                                                    value={sciTypeOptions.find(opt => opt.value === healthInfo.sci_injury_type) || null}
                                                    onClick={handleSciInjuryTypeChange}
                                                    size="medium"
                                                />
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Dynamic Level Selection for Cervical, Thoracic, Lumbar, Sacral */}
                                            {shouldShowLevelCheckboxes() && (
                                                <div>
                                                    <label className="block text-sm font-medium mb-3 text-gray-700">
                                                        {getLevelSectionTitle(healthInfo.sci_injury_type)}
                                                    </label>
                                                    <div className="flex flex-wrap gap-2 max-w-md">
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
                                                            />
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            

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
                                                />
                                            </div>
                                        )}
                                        
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <TextField
                                                label="Where did you complete your initial spinal cord injury rehab?"
                                                value={healthInfo.sci_intial_spinal_rehab}
                                                onChange={(value) => handleHealthInfoChange('sci_intial_spinal_rehab', value)}
                                                placeholder="Grace McKellar Centre, Geelong"
                                                size="medium"
                                            />
                                            
                                            <div>
                                                <p className="text-sm font-medium mb-3 text-gray-700">Are you currently an inpatient?</p>
                                                <div className="flex gap-8">
                                                    <RadioButton
                                                        label="Yes"
                                                        value="true"
                                                        selectedValue={getInpatientSelectedValue()}
                                                        onClick={(value) => handleHealthInfoChange('sci_inpatient', value === "true")}
                                                        name="sci_inpatient"
                                                        size="medium"
                                                    />
                                                    <RadioButton
                                                        label="No"
                                                        value="false"
                                                        selectedValue={getInpatientSelectedValue()}
                                                        onClick={(value) => handleHealthInfoChange('sci_inpatient', value === "true" ? true : false)}
                                                        name="sci_inpatient"
                                                        size="medium"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* UPDATED: Funding Information Section */}
                                <div className="border-t border-gray-200 pt-8">
                                    <h2 className="text-lg font-semibold mb-6 text-gray-700 uppercase">Funding Information</h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <TextField
                                            label="Approval number"
                                            value={fundingInfo.approval_number}
                                            onChange={(value) => handleFundingInfoChange('approval_number', value)}
                                            placeholder="Enter approval number"
                                            size="medium"
                                        />

                                        <TextField
                                            label="Number of nights approved"
                                            type="number"
                                            value={fundingInfo.nights_approved}
                                            onChange={(value) => handleFundingInfoChange('nights_approved', value)}
                                            placeholder="Enter number of nights"
                                            min="0"
                                            size="medium"
                                        />

                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-700">
                                                Package Approved
                                                {loadingPackages && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                                            </label>
                                            <SelectComponent
                                                options={packageOptions}
                                                value={getSelectedPackageLabel()}
                                                onChange={handlePackageChange}
                                                placeholder={loadingPackages ? "Loading packages..." : "Select package type"}
                                                disabled={loadingPackages}
                                                isClearable={true}
                                            />
                                        </div>

                                        <div></div>

                                        <DatePicker
                                            label="Approval From"
                                            value={fundingInfo.approval_from}
                                            onChange={(value) => handleFundingInfoChange('approval_from', value)}
                                            size="medium"
                                        />

                                        <DatePicker
                                            label="Approval To"
                                            value={fundingInfo.approval_to}
                                            onChange={(value) => handleFundingInfoChange('approval_to', value)}
                                            size="medium"
                                        />
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="flex justify-end gap-4 pt-8 border-t border-gray-200">
                                    <Button
                                        label="CANCEL"
                                        onClick={handleCancel}
                                        color="outline"
                                        size="medium"
                                        disabled={saving}
                                    />
                                    <Button
                                        label={saving ? "UPDATING..." : "UPDATE"}
                                        onClick={handleSubmit}
                                        color="secondary"
                                        size="medium"
                                        submit={true}
                                        disabled={saving}
                                    />
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </Layout>
    );
}