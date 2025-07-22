import React, { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { Home, Plus, X, Calendar, Clock, DollarSign, Users, Archive } from 'lucide-react';
import moment from 'moment';
import { getCourseCostSummary } from '../../utilities/courses';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));
const Spinner = dynamic(() => import('../ui/spinner'));

export default function CourseForm({ mode, courseId, onCancel, onSuccess }) {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [isSavingDraft, setIsSavingDraft] = useState(false);
    const [isPublishing, setIsPublishing] = useState(false);
    const [isArchiving, setIsArchiving] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [imageLoadError, setImageLoadError] = useState(false);
    const [showArchiveDialog, setShowArchiveDialog] = useState(false);
    
    // Validation state management
    const [fieldErrors, setFieldErrors] = useState({});
    const [isFormValid, setIsFormValid] = useState(false);
    const [validationAttempted, setValidationAttempted] = useState(false);
    
    // Course rates and cost calculation state
    const [courseRates, setCourseRates] = useState([]);
    const [costSummary, setCostSummary] = useState({
        holidayCosts: { totalCost: 0, costDetails: [] },
        staCosts: { totalCost: 0, costDetails: [] },
        isCalculated: false
    });
    const [isRecalculating, setIsRecalculating] = useState(false);
    const [datesChangedSinceCalculation, setDatesChangedSinceCalculation] = useState(false);
    
    const [course, setCourse] = useState({
        title: '',
        description: '',
        start_date: '',
        end_date: '',
        min_start_date: '',
        min_end_date: '',
        duration_hours: '6:00',
        image_filename: '',
        imageUrl: '',
        status: 'pending',
        holiday_price: null,
        sta_price: null,
        price_calculated_at: null
    });

    const isViewMode = mode === 'view';
    const isEditMode = mode === 'edit';
    const isAddMode = mode === 'add';

    // Required fields definition (removed NDIS pricing)
    const requiredFields = [
        'title',
        'start_date', 
        'end_date',
        'min_start_date',
        'min_end_date'
    ];

    // Course hours options for Select component
    const courseHoursOptions = [
        { value: '1:00', label: '1:00' },
        { value: '2:00', label: '2:00' },
        { value: '3:00', label: '3:00' },
        { value: '4:00', label: '4:00' },
        { value: '5:00', label: '5:00' },
        { value: '6:00', label: '6:00' },
        { value: '7:00', label: '7:00' },
        { value: '8:00', label: '8:00' },
        { value: '9:00', label: '9:00' },
        { value: '10:00', label: '10:00' },
        { value: '11:00', label: '11:00' },
        { value: '12:00', label: '12:00' },
        { value: '16:00', label: '16:00' },
        { value: '20:00', label: '20:00' },
        { value: '24:00', label: '24:00' }
    ];

    // Track when course dates change to require recalculation
    useEffect(() => {
        // Don't set flag on initial load or when loading existing course data
        if (course.start_date && course.end_date && costSummary.isCalculated) {
            setDatesChangedSinceCalculation(true);
        }
    }, [course.start_date, course.end_date]);

    // Load course rates
    useEffect(() => {
        loadCourseRates();
    }, []);

    // Update cost summary when course data loads (for stored prices)
    useEffect(() => {
        if (course.holiday_price !== null && course.sta_price !== null) {
            setCostSummary({
                holidayCosts: { 
                    totalCost: parseFloat(course.holiday_price || 0),
                    costDetails: [] // Details not available from stored data
                },
                staCosts: { 
                    totalCost: parseFloat(course.sta_price || 0),
                    costDetails: [] // Details not available from stored data
                },
                isCalculated: true,
                calculatedAt: course.price_calculated_at
            });
        } else {
            setCostSummary({
                holidayCosts: { totalCost: 0, costDetails: [] },
                staCosts: { totalCost: 0, costDetails: [] },
                isCalculated: false
            });
        }
    }, [course.holiday_price, course.sta_price, course.price_calculated_at]);

    // Load course rates function
    const loadCourseRates = async () => {
        try {
            const response = await fetch('/api/courses/rates');
            if (response.ok) {
                const result = await response.json();
                setCourseRates(result.data || []);
            }
        } catch (error) {
            console.error('Error loading course rates:', error);
        }
    };

    // Calculate course costs function (manual trigger)
    const calculateCourseCosts = async () => {
        if (!course.start_date || !course.end_date) {
            toast.error('Please set course start and end dates first');
            return;
        }

        setIsRecalculating(true);
        try {
            const summary = await getCourseCostSummary(course, courseRates);
            setCostSummary(summary);
            
            // Update course state with calculated prices (but don't save yet)
            setCourse(prev => ({
                ...prev,
                holiday_price: summary.holidayCosts.totalCost,
                sta_price: summary.staCosts.totalCost
            }));
            
            // Clear the flag since we just recalculated
            setDatesChangedSinceCalculation(false);
            
            toast.success('Prices recalculated successfully. Save the course to store the new prices.');
        } catch (error) {
            console.error('Error calculating course costs:', error);
            toast.error('Failed to calculate course costs: ' + error.message);
            setCostSummary({
                holidayCosts: { totalCost: 0, costDetails: [] },
                staCosts: { totalCost: 0, costDetails: [] },
                isCalculated: false,
                error: error.message
            });
        }
        setIsRecalculating(false);
    };

    // Helper function to check if a date range contains any Sundays
    const dateRangeContainsSunday = (startDate, endDate) => {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Iterate through each day in the range
        const currentDate = new Date(start);
        while (currentDate <= end) {
            if (currentDate.getDay() === 0) { // Sunday is 0
                return true;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        return false;
    };

    // Comprehensive validation function (removed NDIS pricing validation)
    const validateAllFields = useCallback(() => {
        const errors = {};

        // Validate required fields
        requiredFields.forEach(field => {
            const value = course[field];
            if (!value || value.toString().trim() === '') {
                errors[field] = 'This field is required';
            }
        });

        // Validate dates
        const validateDate = (dateString, fieldName) => {
            if (dateString && isNaN(new Date(dateString).getTime())) {
                errors[fieldName] = 'Please enter a valid date';
            }
        };

        validateDate(course.start_date, 'start_date');
        validateDate(course.end_date, 'end_date');
        validateDate(course.min_start_date, 'min_start_date');
        validateDate(course.min_end_date, 'min_end_date');

        // Cross-field date validation
        if (course.start_date && course.end_date) {
            const startDate = new Date(course.start_date + 'T00:00:00');
            const endDate = new Date(course.end_date + 'T00:00:00');
            
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(0, 0, 0, 0);
            
            if (!isNaN(startDate.getTime()) && !isNaN(endDate.getTime())) {
                if (startDate > endDate) {
                    errors.end_date = 'End date must be after or same as start date';
                } else {
                    // Check if course date range contains any Sundays
                    if (dateRangeContainsSunday(startDate, endDate)) {
                        errors.start_date = 'Course date range cannot include any Sundays';
                        errors.end_date = 'Course date range cannot include any Sundays';
                    }
                }
            }
        }

        if (course.min_start_date && course.min_end_date) {
            const minStartDate = new Date(course.min_start_date + 'T00:00:00');
            const minEndDate = new Date(course.min_end_date + 'T00:00:00');
            
            minStartDate.setHours(0, 0, 0, 0);
            minEndDate.setHours(0, 0, 0, 0);
            
            if (!isNaN(minStartDate.getTime()) && !isNaN(minEndDate.getTime()) && minStartDate > minEndDate) {
                errors.min_end_date = 'Minimum end date must be after or same as minimum start date';
            }
        }

        // Minimum booking dates must span course dates validation
        if (course.start_date && course.end_date && course.min_start_date && course.min_end_date) {
            const startDate = new Date(course.start_date + 'T00:00:00');
            const endDate = new Date(course.end_date + 'T00:00:00');
            const minStartDate = new Date(course.min_start_date + 'T00:00:00');
            const minEndDate = new Date(course.min_end_date + 'T00:00:00');

            [startDate, endDate, minStartDate, minEndDate].forEach(date => {
                date.setHours(0, 0, 0, 0);
            });

            const allDatesValid = [startDate, endDate, minStartDate, minEndDate].every(date => !isNaN(date.getTime()));

            if (allDatesValid) {
                // Minimum booking start date must be before or on course start date
                if (minStartDate > startDate) {
                    errors.min_start_date = 'Minimum start date must be before or on the course start date';
                }
                
                // Minimum booking end date must be after or on course end date
                if (minEndDate < endDate) {
                    errors.min_end_date = 'Minimum end date must be after or on the course end date (guests must stay at least as long as the course duration)';
                }
            }
        }

        return { errors, isValid: Object.keys(errors).length === 0 };
    }, [course]);

    // Check form validity whenever course data changes
    useEffect(() => {
        const { errors, isValid } = validateAllFields();
        
        setFieldErrors(prevErrors => {
            const errorKeys = Object.keys(errors);
            const prevErrorKeys = Object.keys(prevErrors);
            
            if (errorKeys.length !== prevErrorKeys.length ||
                errorKeys.some(key => errors[key] !== prevErrors[key]) ||
                prevErrorKeys.some(key => !errors.hasOwnProperty(key))) {
                return errors;
            }
            return prevErrors;
        });
        
        setIsFormValid(isValid);
    }, [validateAllFields]);

    // Load course data for edit/view mode
    useEffect(() => {
        if ((isEditMode || isViewMode) && courseId) {
            loadCourse();
        } else if (isAddMode) {
            setSelectedFile(null);
        }
    }, [courseId, mode]);

    const loadCourse = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/courses/${courseId}`);
            if (!response.ok) {
                throw new Error('Failed to load course');
            }
            const result = await response.json();
            const courseData = result.data || result;
            
            setCourse({
                ...courseData,
                title: courseData.title || '',
                start_date: courseData.start_date ? new Date(courseData.start_date).toISOString().split('T')[0] : '',
                end_date: courseData.end_date ? new Date(courseData.end_date).toISOString().split('T')[0] : '',
                min_start_date: courseData.min_start_date ? new Date(courseData.min_start_date).toISOString().split('T')[0] : '',
                min_end_date: courseData.min_end_date ? new Date(courseData.min_end_date).toISOString().split('T')[0] : '',
                duration_hours: courseData.duration_hours,
                image_filename: courseData.image_filename || '',
                imageUrl: courseData.imageUrl || '',
                status: courseData.status || 'pending',
                holiday_price: courseData.holiday_price,
                sta_price: courseData.sta_price,
                price_calculated_at: courseData.price_calculated_at
            });
        } catch (error) {
            console.error('Error loading course:', error);
            toast.error('Failed to load course data');
        }
        setIsLoading(false);
    };

    const handleInputChange = (field) => (value) => {
        setCourse(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSelectChange = (field) => (selectedOption) => {
        const value = selectedOption.value;
        setCourse(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async (isDraft = false) => {
        // Run validation for both draft and publish
        setValidationAttempted(true);
        
        const { isValid } = validateAllFields();
        if (!isValid) {
            const action = isDraft ? 'saving as draft' : 'publishing';
            toast.error(`Please fix all validation errors before ${action}`);
            
            // Scroll to first error
            const firstErrorField = Object.keys(fieldErrors)[0];
            if (firstErrorField) {
                const element = document.querySelector(`[name="${firstErrorField}"]`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.focus();
                }
            }
            return;
        }

        // Check if dates have changed since last calculation and require recalculation
        if (datesChangedSinceCalculation && course.start_date && course.end_date) {
            toast.error('Course dates have changed since last price calculation. Please click "Recalculate" to update pricing before saving.');
            return;
        }

        // Additional check for minimum required fields (title is essential)
        if (!course.title || course.title.trim() === '') {
            toast.error('Please provide at least a course title to save');
            return;
        }

        if (isDraft) {
            setIsSavingDraft(true);
        } else {
            setIsPublishing(true);
        }
        try {
            let imageFilename = course.image_filename;

            if (selectedFile) {
                try {
                    imageFilename = await uploadImageFile(selectedFile);
                    toast.success('Image uploaded successfully');
                } catch (error) {
                    toast.error('Failed to upload image: ' + error.message);
                    if (isDraft) {
                        setIsSavingDraft(false);
                    } else {
                        setIsPublishing(false);
                    }
                    return;
                }
            }

            const method = isEditMode ? 'PUT' : 'POST';
            
            const payload = {
                ...course,
                duration_hours: course.duration_hours,
                image_filename: imageFilename,
                status: isDraft ? 'pending' : 'active'
            };

            if (isEditMode) {
                payload.id = courseId;
            }

            const response = await fetch('/api/courses/save', {
                method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to save course');
            }

            setCourse(prev => ({
                ...prev,
                image_filename: imageFilename,
                status: isDraft ? 'pending' : 'active'
            }));
            setSelectedFile(null);

            toast.success(result.message || `Course ${isDraft ? 'saved as draft' : 'published'} successfully`);
            
            if (onSuccess) {
                onSuccess({
                    action: isEditMode ? 'edit' : 'add',
                    id: result.data?.id || courseId
                });
            }
        } catch (error) {
            console.error('Error saving course:', error);
            toast.error(error.message || 'Failed to save course');
        } finally {
            if (isDraft) {
                setIsSavingDraft(false);
            } else {
                setIsPublishing(false);
            }
        }
    };

    const handleArchive = async () => {
        setIsArchiving(true);
        try {
            const payload = {
                ...course,
                id: courseId,
                status: 'archived'
            };

            const response = await fetch('/api/courses/save', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to archive course');
            }

            setCourse(prev => ({
                ...prev,
                status: 'archived'
            }));

            toast.success('Course has been archived successfully');
            
            if (onSuccess) {
                onSuccess({
                    action: 'archive',
                    id: courseId
                });
            }
        } catch (error) {
            console.error('Error archiving course:', error);
            toast.error(error.message || 'Failed to archive course');
        } finally {
            setIsArchiving(false);
            setShowArchiveDialog(false);
        }
    };

    const getImageUrl = async (filename) => {
        if (!filename) return null;
        
        try {
            const response = await fetch(`/api/storage/upload?filename=${filename}&filepath=courses/`);
            const result = await response.json();
            
            if (response.ok) {
                return result.fileUrl;
            }
        } catch (error) {
            console.error('Error getting image URL:', error);
        }
        return null;
    };

    const uploadImageFile = async (file) => {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('fileType', 'courses/');
            formData.append('metadata', JSON.stringify({
                courseId: courseId,
                uploadedBy: 'course-form'
            }));

            const response = await fetch('/api/storage/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                return file.name;
            } else {
                throw new Error(result.message || 'Upload failed');
            }
        } catch (error) {
            console.error('Upload error:', error);
            throw error;
        }
    };

    const handleImageSelection = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 2 * 1024 * 1024) {
            toast.error('File size must be less than 2MB');
            return;
        }

        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
        if (!allowedTypes.includes(file.type)) {
            toast.error('Only JPG, JPEG, and PNG files are allowed');
            return;
        }

        setSelectedFile(file);
        setImageLoadError(false);
        toast.success('Image selected. It will be uploaded when you save the course.');
    };

    const handleImageRemove = () => {
        setSelectedFile(null);
        setCourse(prev => ({
            ...prev,
            image_filename: '',
            imageUrl: ''
        }));
        setImageLoadError(false);
    };

    const handleImageError = () => {
        setImageLoadError(true);
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        return new Date(dateString).toLocaleDateString('en-AU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    };

    const formatPrice = (price) => {
        if (!price) return 'Not specified';
        return `$${parseFloat(price).toFixed(2)}`;
    };

    const getStatusBadge = (status) => {
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            active: 'bg-green-100 text-green-800 border-green-200',
            inactive: 'bg-red-100 text-red-800 border-red-200',
            archived: 'bg-gray-100 text-gray-800 border-gray-200'
        };
        
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[status] || statusColors.pending}`}>
                {status?.toUpperCase() || 'PENDING'}
            </span>
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner />
            </div>
        );
    }

    // View Mode - Course Preview
    if (isViewMode) {
        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Home className="w-4 h-4" />
                            <button 
                                onClick={() => router.push('/courses')}
                                className="hover:text-blue-600 transition-colors font-medium"
                            >
                                COURSES
                            </button>
                            <span>/</span>
                            <span className="font-medium text-gray-900 uppercase">
                                {course.title || 'COURSE DETAILS'}
                            </span>
                        </div>
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label="EDIT COURSE"
                            onClick={() => {
                                if (onSuccess) {
                                    onSuccess({ action: 'edit', id: courseId });
                                }
                            }}
                            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                        />
                    </div>
                </div>

                {/* Main Content */}
                <div className="p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column - Main Content */}
                            <div className="lg:col-span-2">
                                {/* Course Title */}
                                <h1 className="text-4xl font-bold text-gray-900 mb-6">
                                    {course.title || 'Course Title'}
                                </h1>

                                {/* Hero Image */}
                                <div className="mb-6">
                                    {course.imageUrl && !imageLoadError ? (
                                        <div className="w-full h-80 overflow-hidden rounded-lg">
                                            <img
                                                src={course.imageUrl}
                                                alt={course.title}
                                                className="w-full h-full object-cover"
                                                onError={handleImageError}
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-80 bg-gray-200 rounded-lg flex items-center justify-center">
                                            <div className="text-center text-gray-500">
                                                <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                                                    <Plus className="w-8 h-8 text-gray-400" />
                                                </div>
                                                <div className="text-lg">No image available</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Course Description */}
                                <div className="prose max-w-none">
                                    <div className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                                        {course.description || 'No description provided for this course.'}
                                    </div>
                                </div>
                            </div>

                            {/* Right Column - Course Details Sidebar */}
                            <div className="lg:col-span-1">
                                <div className="rounded-lg border border-gray-200 overflow-hidden" style={{ background: '#F1F3F6' }}>
                                    {/* Date Section */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Date</h3>
                                        <div className="text-gray-700">
                                            {course.start_date && course.end_date ? (
                                                `${formatDate(course.start_date)} - ${formatDate(course.end_date)}`
                                            ) : (
                                                'Dates to be confirmed'
                                            )}
                                        </div>
                                    </div>

                                    {/* Hours Section */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Hours</h3>
                                        <div className="text-gray-700">
                                            {course.duration_hours ? (
                                                course.duration_hours === '1:00' ? '60 mins' :
                                                course.duration_hours === '2:00' ? '120 mins' :
                                                course.duration_hours === '3:00' ? '180 mins' :
                                                course.duration_hours === '4:00' ? '240 mins' :
                                                course.duration_hours === '5:00' ? '300 mins' :
                                                course.duration_hours === '6:00' ? '360 mins' :
                                                course.duration_hours === '7:00' ? '420 mins' :
                                                course.duration_hours === '8:00' ? '480 mins' :
                                                `${course.duration_hours} hours`
                                            ) : (
                                                'Duration to be confirmed'
                                            )}
                                        </div>
                                    </div>

                                    {/* Calculated Pricing Section */}
                                    <div className="p-6 border-b border-gray-200">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Pricing</h3>
                                        {costSummary.isCalculated ? (
                                            <div className="space-y-4">
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-600">Holiday Package Price:</span>
                                                        <span className="font-medium text-gray-900">
                                                            ${costSummary.holidayCosts.totalCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-2">
                                                        <span className="text-gray-600">STA Service Price:</span>
                                                        <span className="font-medium text-gray-900">
                                                            ${costSummary.staCosts.totalCost.toFixed(2)}
                                                        </span>
                                                    </div>
                                                </div>
                                                {costSummary.calculatedAt && (
                                                    <div className="text-xs text-gray-500 mt-2">
                                                        Calculated on {moment(costSummary.calculatedAt).format('DD/MM/YYYY HH:mm')}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-gray-500">
                                                {course.start_date && course.end_date ? (
                                                    <p>Pricing not calculated yet</p>
                                                ) : (
                                                    <p>Set course dates to enable pricing calculation</p>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Minimum Dates of Stay Section */}
                                    <div className="p-6">
                                        <h3 className="text-lg font-semibold text-gray-900 mb-3">Minimum Dates of Stay</h3>
                                        <div className="text-gray-700">
                                            {course.min_start_date && course.min_end_date ? (
                                                `${formatDate(course.min_start_date)} - ${formatDate(course.min_end_date)}`
                                            ) : (
                                                'Minimum dates to be confirmed'
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Course Status */}
                                {course.status && (
                                    <div className="mt-4 rounded-lg border border-gray-200 p-4" style={{ background: '#F1F3F6' }}>
                                        <h3 className="text-sm font-medium text-gray-900 mb-2">Course Status</h3>
                                        {getStatusBadge(course.status)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Edit/Add Mode - Form
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Home className="w-4 h-4" />
                        <button 
                            onClick={() => router.push('/courses')}
                            className="hover:text-blue-600 transition-colors"
                        >
                            COURSES
                        </button>
                        <span>/</span>
                        <span className="font-medium">
                            {isAddMode && 'ADD COURSE'}
                            {isEditMode && 'EDIT COURSE'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        {/* Archive button - only show in edit mode and if course is not already archived */}
                        {isEditMode && course.status !== 'archived' && (
                            <Button
                                type="button"
                                color="outline"
                                size="medium"
                                label={isArchiving ? 'ARCHIVING...' : 'ARCHIVE COURSE'}
                                onClick={() => setShowArchiveDialog(true)}
                                disabled={isSavingDraft || isPublishing || isArchiving}
                                className="border-red-300 text-red-600 hover:bg-red-50"
                                icon={<Archive className="w-4 h-4" />}
                            />
                        )}
                        <Button
                            type="button"
                            color="outline"
                            size="medium"
                            label="CANCEL"
                            onClick={onCancel}
                            disabled={isSavingDraft || isPublishing || isArchiving}
                        />
                        <Button
                            type="button"
                            color="secondary"
                            size="medium"
                            label={isSavingDraft ? 'SAVING...' : 'SAVE AS DRAFT'}
                            onClick={() => handleSave(true)}
                            disabled={isSavingDraft || isPublishing || isArchiving || (!isFormValid && validationAttempted) || datesChangedSinceCalculation}
                        />
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label={isPublishing ? 'PUBLISHING...' : 'PUBLISH'}
                            onClick={() => handleSave(false)}
                            disabled={isSavingDraft || isPublishing || isArchiving || (!isFormValid && validationAttempted) || datesChangedSinceCalculation}
                        />
                    </div>
                </div>
            </div>

            {/* Archive Confirmation Dialog */}
            {showArchiveDialog && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                        <div className="flex items-center mb-4">
                            <div className="flex-shrink-0">
                                <Archive className="w-6 h-6 text-red-600" />
                            </div>
                            <h3 className="ml-3 text-lg font-semibold text-gray-900">
                                Archive Course
                            </h3>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-600 mb-4">
                                Are you sure you want to archive &quot;<strong>{course.title}</strong>&quot;?
                            </p>
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                                <div className="flex">
                                    <div className="flex-shrink-0">
                                        <X className="w-5 h-5 text-yellow-400" />
                                    </div>
                                    <div className="ml-3">
                                        <p className="text-sm text-yellow-800">
                                            <strong>Warning:</strong> Once archived, this course will no longer be visible to users and cannot accept new bookings. This action can be undone by editing the course status.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <Button
                                color="outline"
                                size="medium"
                                label="Cancel"
                                onClick={() => setShowArchiveDialog(false)}
                                disabled={isArchiving}
                            />
                            <Button
                                color="secondary"
                                size="medium"
                                label={isArchiving ? 'Archiving...' : 'Archive Course'}
                                onClick={handleArchive}
                                disabled={isArchiving}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Validation Summary */}
            {validationAttempted && Object.keys(fieldErrors).length > 0 && (
                <div className="bg-red-50 border-l-4 border-red-400 p-4 mx-6 mt-4">
                    <div className="flex">
                        <div className="ml-3">
                            <h3 className="text-sm font-medium text-red-800">
                                Please fix the following errors:
                            </h3>
                            <div className="mt-2 text-sm text-red-700">
                                <ul className="list-disc pl-5 space-y-1">
                                    {Object.entries(fieldErrors).map(([field, error]) => (
                                        <li key={field}>
                                            <strong>{field.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}:</strong> {error}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Form Content */}
            <div className="p-6">
                <div className="max-w-7xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column - Form Fields */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Course Name */}
                            <div>
                                <TextField
                                    label="Course Name"
                                    value={course.title}
                                    onChange={handleInputChange('title')}
                                    required
                                    placeholder="Course Name"
                                    size="large"
                                    error={validationAttempted ? fieldErrors.title : ''}
                                />
                            </div>

                            {/* Course Status - Read Only (Edit Mode Only) */}
                            {isEditMode && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Course Status
                                    </label>
                                    <div className="flex items-center p-3 bg-gray-50 border border-gray-300 rounded-lg">
                                        {getStatusBadge(course.status)}
                                        <span className="ml-3 text-sm text-gray-600">
                                            Current status of this course
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Calculated Pricing Display */}
                            <div>
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wide">
                                        CALCULATED PRICING
                                    </h3>
                                    {course.start_date && course.end_date && (
                                        <Button
                                            type="button"
                                            color={datesChangedSinceCalculation ? "primary" : "outline"}
                                            size="small"
                                            label={isRecalculating ? 'CALCULATING...' : 'RECALCULATE'}
                                            onClick={calculateCourseCosts}
                                            disabled={isRecalculating || !courseRates.length}
                                            className={`text-xs ${datesChangedSinceCalculation ? 'bg-orange-500 hover:bg-orange-600 text-white animate-pulse' : ''}`}
                                        />
                                    )}
                                </div>
                                {datesChangedSinceCalculation && (
                                    <div className="mb-4 text-sm text-orange-600 bg-orange-50 p-3 rounded-lg border border-orange-200">
                                        <strong>⚠️ Recalculation Required:</strong> Course dates have changed since last price calculation. Click &quot;Recalculate&quot; to update pricing before saving.
                                    </div>
                                )}
                                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                                    {costSummary.isCalculated ? (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">Holiday Package</h4>
                                                <div className="text-2xl font-bold text-green-600 mb-2">
                                                    ${costSummary.holidayCosts.totalCost.toFixed(2)}
                                                </div>
                                            </div>
                                            <div>
                                                <h4 className="font-medium text-gray-900 mb-2">STA Service</h4>
                                                <div className="text-2xl font-bold text-blue-600 mb-2">
                                                    ${costSummary.staCosts.totalCost.toFixed(2)}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 text-gray-500">
                                            {course.start_date && course.end_date ? (
                                                <div>
                                                    <p>Pricing not calculated yet</p>
                                                    <p className="text-sm mt-1">Click &quot;Recalculate&quot; to generate current pricing</p>
                                                </div>
                                            ) : (
                                                <p>Set course start and end dates to enable pricing calculation</p>
                                            )}
                                        </div>
                                    )}
                                    
                                    <div className="mt-3 text-xs text-gray-500 text-center">
                                        {costSummary.calculatedAt ? (
                                            <>Calculated on {moment(costSummary.calculatedAt).format('DD/MM/YYYY HH:mm')}</>
                                        ) : (
                                            <>Pricing will be calculated and saved automatically when course is saved</>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Course Date(s) and Hours Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                                    COURSE DATE(S) AND HOURS
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
                                    <div className="lg:col-span-1">
                                        <label className="block font-semibold text-gray-700 mb-2">
                                            Course Hours
                                        </label>
                                        <div className="h-[50px]">
                                            <Select
                                                label="Select"
                                                options={courseHoursOptions}
                                                value={courseHoursOptions.find(option => option.value === course.duration_hours)}
                                                onClick={handleSelectChange('duration_hours')}
                                                size="large"
                                                className="h-full"
                                            />
                                        </div>
                                        <div className="h-5 mt-1.5">
                                            {/* Empty space for consistent alignment */}
                                        </div>
                                    </div>
                                    <div className="lg:col-span-1">
                                        <DateComponent
                                            label="Start Date"
                                            value={course.start_date}
                                            onChange={handleInputChange('start_date')}
                                            required
                                            allowPrevDate={false}
                                            blockSundays={true}
                                            size="large"
                                            error={validationAttempted ? fieldErrors.start_date : ''}
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <DateComponent
                                            label="End Date"
                                            value={course.end_date}
                                            onChange={handleInputChange('end_date')}
                                            required
                                            allowPrevDate={false}
                                            blockSundays={true}
                                            size="large"
                                            error={validationAttempted ? fieldErrors.end_date : ''}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-600">
                                    <strong>Note:</strong> Course dates cannot include any Sundays in the date range. Individual Sundays and the entire date range are blocked.
                                </div>
                            </div>

                            {/* Minimum Booking Dates Section */}
                            <div>
                                <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                                    MINIMUM BOOKING DATES (BEFORE COURSE STARTS)
                                </h3>
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                    <div className="lg:col-span-1">
                                        <DateComponent
                                            label="From Date"
                                            value={course.min_start_date}
                                            onChange={handleInputChange('min_start_date')}
                                            required
                                            allowPrevDate={false}
                                            blockSundays={false}
                                            size="large"
                                            error={validationAttempted ? fieldErrors.min_start_date : ''}
                                        />
                                    </div>
                                    <div className="lg:col-span-1">
                                        <DateComponent
                                            label="To Date"
                                            value={course.min_end_date}
                                            onChange={handleInputChange('min_end_date')}
                                            required
                                            allowPrevDate={false}
                                            blockSundays={false}
                                            size="large"
                                            error={validationAttempted ? fieldErrors.min_end_date : ''}
                                        />
                                    </div>
                                </div>
                                <div className="mt-2 text-xs text-gray-600">
                                    <strong>Note:</strong> Minimum booking dates must span at least as long as the course duration. Guests must stay until the course ends or longer.
                                </div>
                            </div>

                            {/* Description */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Description
                                </label>
                                <textarea
                                    name="description"
                                    value={course.description}
                                    onChange={(e) => handleInputChange('description')(e.target.value)}
                                    rows={8}
                                    className="w-full px-3 py-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Write description"
                                />
                            </div>
                        </div>

                        {/* Right Column - Course Image */}
                        <div className="lg:col-span-1">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-4">
                                    Course Image
                                </label>
                                
                                <label className="cursor-pointer block">
                                    <input
                                        type="file"
                                        accept=".jpg,.jpeg,.png"
                                        onChange={handleImageSelection}
                                        className="hidden"
                                    />
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                                        {!selectedFile && !course.image_filename && (
                                            <>
                                                <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                                                    <Plus className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="text-sm text-gray-600">
                                                    <span className="text-blue-600 hover:text-blue-700">
                                                        Click to upload photos
                                                    </span>
                                                    <br />
                                                    (JPG, PNG, JPEG)
                                                </div>
                                            </>
                                        )}

                                        {selectedFile && (
                                            <div className="space-y-2">
                                                {selectedFile.type.startsWith('image/') && (
                                                    <div className="mb-4">
                                                        <img
                                                            src={URL.createObjectURL(selectedFile)}
                                                            alt="Preview"
                                                            className="w-full h-32 object-cover rounded-lg"
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="text-sm text-gray-600">
                                                        Selected: <span className="font-medium text-blue-600">{selectedFile.name}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleImageRemove();
                                                        }}
                                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                        title="Remove selected image"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                                                    Image will be uploaded when you save the course
                                                </div>
                                                <span className="text-blue-600 hover:text-blue-700 text-sm">
                                                    Change image
                                                </span>
                                            </div>
                                        )}

                                        {!selectedFile && course.image_filename && (
                                            <div className="space-y-2">
                                                {course.imageUrl && !imageLoadError && (
                                                    <div className="mb-4">
                                                        <img
                                                            src={course.imageUrl}
                                                            alt="Current course image"
                                                            className="w-full h-32 object-cover rounded-lg"
                                                            onError={handleImageError}
                                                        />
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-center space-x-2">
                                                    <div className="text-sm text-gray-600">
                                                        Current image: <span className="font-medium text-green-600">{course.image_filename}</span>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={(e) => {
                                                            e.preventDefault();
                                                            e.stopPropagation();
                                                            handleImageRemove();
                                                        }}
                                                        className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                                                        title="Remove current image"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <span className="text-blue-600 hover:text-blue-700 text-sm">
                                                    Change image
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </label>
                                
                                <div className="mt-2 text-xs text-gray-500 text-center">
                                    You can upload photos up to <strong>2MB</strong>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}