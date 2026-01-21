import React, { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { 
    Home, 
    X, 
    Search, 
    Users, 
    Calendar, 
    Clock, 
    Info,
    CheckCircle,
    User,
    BookOpen,
    UserCheck,
    ChevronLeft,
    ChevronRight,
    AlertTriangle
} from 'lucide-react';
import moment from 'moment';
import TimingTextInput from '../ui-v2/TimingTextInput';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));
const Spinner = dynamic(() => import('../ui/spinner'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const HorizontalCardSelection = dynamic(() => import('../ui-v2/HorizontalCardSelection'));

// Performance constants
const GUESTS_PER_PAGE = 20;
const MAX_GUEST_SELECTION = 500;
const SEARCH_DEBOUNCE_MS = 300;

export default function CourseOfferForm({ mode, offerId, preSelectedCourseId, onCancel, onSuccess }) {
    const router = useRouter();
    const user = useSelector(state => state.user.user); // Add current user from Redux
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Form data (status is read-only, managed by automated triggers)
    const [offer, setOffer] = useState({
        course_id: '',
        guest_id: '', // Keep for edit/view modes
        guest_ids: [], // New for add mode - multiple guests
        notes: '',
        offered_at: '',
        offered_by: '',
        offeredByUser: null, // Store the user object
        status: 'offered', // Read-only, managed by triggers
        timing_text: '',
        isValid: false,
        bookingWindowOpen: false,
        courseStarted: false
    });

    // Data for dropdowns
    const [courses, setCourses] = useState([]);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [selectedGuest, setSelectedGuest] = useState(null); // For edit/view modes
    const [selectedGuests, setSelectedGuests] = useState([]); // For add mode
    
    // Paginated guest loading
    const [guests, setGuests] = useState([]);
    const [guestsLoading, setGuestsLoading] = useState(false);
    const [guestsPagination, setGuestsPagination] = useState({
        page: 1,
        totalPages: 1,
        total: 0,
        hasMore: false
    });
    
    // UI state
    const [guestSearchTerm, setGuestSearchTerm] = useState('');
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');
    
    // Validation
    const [fieldErrors, setFieldErrors] = useState({});
    const [validationAttempted, setValidationAttempted] = useState(false);

    const isViewMode = mode === 'view';
    const isEditMode = mode === 'edit';
    const isAddMode = mode === 'add';

    // Required fields - same for all modes (status removed)
    const requiredFields = isAddMode ? ['course_id', 'guest_ids'] : ['course_id', 'guest_id'];

    const calculateTimingText = useCallback((course) => {
        if (!course || !course.min_end_date) return '';
        
        const now = moment();
        const bookingDeadline = moment(course.min_end_date);
        const courseStart = moment(course.start_date);
        const courseEnd = moment(course.end_date);

        // Course has ended
        if (courseEnd.isValid() && now.isAfter(courseEnd)) {
            return 'Course ended';
        }
        
        // Course in progress
        if (courseStart.isValid() && now.isAfter(courseStart) && now.isBefore(courseEnd)) {
            return 'Course in progress';
        }
        
        // Booking closed
        if (now.isAfter(bookingDeadline)) {
            return 'Booking closed';
        }
        
        // Days to book
        const daysLeft = bookingDeadline.diff(now, 'days');
        if (daysLeft === 0) {
            return 'Last day to book!';
        } else if (daysLeft === 1) {
            return '1 day to book';
        } else {
            return `${daysLeft} days to book`;
        }
    }, []);

    useEffect(() => {
        if (selectedCourse) {
            // Calculate timing text from course dates
            const calculatedTiming = calculateTimingText(selectedCourse);
            
            // Only auto-update if timing_text is empty (new offer or course changed)
            // This allows manual edits to persist
            if (!offer.timing_text || isAddMode) {
                setOffer(prev => ({
                    ...prev,
                    timing_text: calculatedTiming
                }));
            }
        }
    }, [selectedCourse, calculateTimingText, isAddMode]);

    // Initialize offered_by with current user ID when component mounts
    useEffect(() => {
        if (user && isAddMode && !offer.offered_by) {
            setOffer(prev => ({
                ...prev,
                offered_by: user.id, // Store user ID, not name
                offeredByUser: user // Keep user object for display
            }));
        }
    }, [user, isAddMode, offer.offered_by]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(guestSearchTerm);
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
    }, [guestSearchTerm]);

    // Reset pagination when search changes
    useEffect(() => {
        setGuestsPagination(prev => ({ ...prev, page: 1 }));
        if (isAddMode) {
            loadGuests(1, debouncedSearchTerm, true); // Reset guests list
        }
    }, [debouncedSearchTerm, isAddMode]);

    useEffect(() => {
        loadCourses();
        
        if ((isEditMode || isViewMode) && offerId) {
            loadOffer();
        } else if (isAddMode) {
            loadGuests(1, '', true); // Initial load for add mode
            if (preSelectedCourseId) {
                setOffer(prev => ({ ...prev, course_id: preSelectedCourseId }));
            }
        }
    }, [offerId, mode, preSelectedCourseId]);

    // Update selected course when courses are loaded and we have a pre-selected or current course ID
    useEffect(() => {
        if (courses.length > 0) {
            const courseId = offer.course_id || preSelectedCourseId;
            if (courseId) {
                const course = courses.find(c => c.id.toString() === courseId.toString());
                if (course) {
                    setSelectedCourse(course);
                    setOffer(prev => ({ ...prev, course_id: courseId }));
                }
            }
        }
    }, [courses, offer.course_id, preSelectedCourseId]);

    const loadCourses = async () => {
        try {
            const response = await fetch('/api/courses/');
            if (response.ok) {
                const result = await response.json();
                const coursesData = result.courses || result || [];
                setCourses(coursesData);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
            toast.error('Failed to load courses');
        }
    };

    const loadGuests = async (page = 1, search = '', reset = false) => {
        setGuestsLoading(true);
        try {
            const params = new URLSearchParams({
                limit: GUESTS_PER_PAGE.toString(),
                offset: ((page - 1) * GUESTS_PER_PAGE).toString(),
                active: 'true' // Changed from active_only to active
            });

            if (search.trim()) {
                params.append('search', search.trim());
            }

            // Try multiple endpoint variations to ensure compatibility
            let response;
            let result;
            
            // First try the newer endpoint with proper search support
            try {
                response = await fetch(`/api/guests/search?${params}`);
                if (response.ok) {
                    result = await response.json();
                }
            } catch (error) {
                console.warn('Primary guest endpoint failed, trying alternative...');
            }

            // If that fails, try the listv2 endpoint
            if (!response || !response.ok) {
                try {
                    response = await fetch(`/api/guests/listv2?${params}`);
                    if (response.ok) {
                        result = await response.json();
                    }
                } catch (error) {
                    console.warn('Secondary guest endpoint failed, trying basic endpoint...');
                }
            }

            // Final fallback to basic endpoint with manual search filtering
            if (!response || !response.ok) {
                const basicParams = new URLSearchParams({
                    limit: GUESTS_PER_PAGE.toString(),
                    offset: ((page - 1) * GUESTS_PER_PAGE).toString()
                });
                
                response = await fetch(`/api/guests/search?${basicParams}`);
                result = await response.json();
                
                // Manual search filtering if backend doesn't support it
                if (search.trim() && result) {
                    const searchLower = search.toLowerCase();
                    const guestsData = result.data || result.users || result || [];
                    const filteredGuests = guestsData.filter(guest => 
                        (guest.first_name?.toLowerCase().includes(searchLower)) ||
                        (guest.last_name?.toLowerCase().includes(searchLower)) ||
                        (guest.email?.toLowerCase().includes(searchLower))
                    );
                    result = { ...result, data: filteredGuests, users: filteredGuests };
                }
            }

            if (result) {
                // Handle different response formats
                const guestsData = result.data || result.users || result || [];
                
                setGuests(prev => reset ? guestsData : [...prev, ...guestsData]);
                
                if (result.pagination) {
                    setGuestsPagination({
                        page,
                        totalPages: result.pagination.totalPages || Math.ceil((result.pagination.total || guestsData.length) / GUESTS_PER_PAGE),
                        total: result.pagination.total || guestsData.length,
                        hasMore: result.pagination.hasMore || (page * GUESTS_PER_PAGE < (result.pagination.total || guestsData.length))
                    });
                } else {
                    // Fallback pagination calculation
                    const total = result.total || guestsData.length;
                    setGuestsPagination({
                        page,
                        totalPages: Math.ceil(total / GUESTS_PER_PAGE),
                        total,
                        hasMore: page * GUESTS_PER_PAGE < total
                    });
                }
            } else {
                throw new Error('No valid response from guest endpoints');
            }
        } catch (error) {
            console.error('Error loading guests:', error);
            toast.error('Failed to load guests');
            setGuests([]);
            setGuestsPagination({ page: 1, totalPages: 1, total: 0, hasMore: false });
        }
        setGuestsLoading(false);
    };

    const loadMoreGuests = () => {
        if (guestsPagination.hasMore && !guestsLoading) {
            loadGuests(guestsPagination.page + 1, debouncedSearchTerm, false);
        }
    };

    const loadOffer = async () => {
        setIsLoading(true);
        try {
            const response = await fetch(`/api/courses/offers/${offerId}`);
            if (!response.ok) {
                throw new Error('Failed to load offer');
            }
            const result = await response.json();
            const offerData = result.data || result;
            
            setOffer({
                ...offerData,
                course_id: offerData.course_id || '',
                guest_id: offerData.guest_id || '',
                guest_ids: [], // Not used in edit/view modes
                notes: offerData.notes || '',
                offered_at: offerData.offered_at || '',
                offered_by: offerData.offered_by || '',
                offeredByUser: offerData.offeredBy || null, // Store the user object
                status: offerData.status || 'offered', // Default to 'offered' if not present
                timing_text: offerData.timing_text || '',
                isValid: offerData.isValid || false,
                bookingWindowOpen: offerData.bookingWindowOpen || false,
                courseStarted: offerData.courseStarted || false
            });

            // Set selected course and guest
            if (offerData.course) {
                setSelectedCourse(offerData.course);
            }
            if (offerData.guest) {
                setSelectedGuest(offerData.guest);
            }
        } catch (error) {
            console.error('Error loading offer:', error);
            toast.error('Failed to load offer data');
        }
        setIsLoading(false);
    };

    const validateForm = useCallback(() => {
        const errors = {};

        // Validate required fields (status validation removed)
        if (isAddMode) {
            if (!offer.course_id || offer.course_id.toString().trim() === '') {
                errors.course_id = 'This field is required';
            }
            if (!offer.guest_ids || offer.guest_ids.length === 0) {
                errors.guest_ids = 'Please select at least one guest';
            }
            if (offer.guest_ids && offer.guest_ids.length > MAX_GUEST_SELECTION) {
                errors.guest_ids = `Cannot select more than ${MAX_GUEST_SELECTION} guests`;
            }
        } else {
            // Edit/View mode validation
            requiredFields.forEach(field => {
                if (!offer[field] || offer[field].toString().trim() === '') {
                    errors[field] = 'This field is required';
                }
            });
        }

        return { errors, isValid: Object.keys(errors).length === 0 };
    }, [offer, isAddMode]);

    useEffect(() => {
        const { errors } = validateForm();
        setFieldErrors(errors);
    }, [validateForm]);

    const handleInputChange = (field) => (value) => {
        setOffer(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleCourseSelect = (courseId) => {
        const course = courses.find(c => c.id.toString() === courseId.toString());
        if (course) {
            setSelectedCourse(course);
            setOffer(prev => ({
                ...prev,
                course_id: course.id
            }));
        }
    };

    // Single guest selection for edit/view modes
    const handleGuestSelect = (guest) => {
        setSelectedGuest(guest);
        setOffer(prev => ({
            ...prev,
            guest_id: guest.id
        }));
        setGuestSearchTerm('');
    };

    // Multiple guest selection for add mode
    const handleMultipleGuestSelect = (guest) => {
        if (selectedGuests.length >= MAX_GUEST_SELECTION) {
            toast.warning(`Cannot select more than ${MAX_GUEST_SELECTION} guests`);
            return;
        }

        const isAlreadySelected = selectedGuests.some(g => g.id === guest.id);
        
        if (isAlreadySelected) {
            // Remove guest
            const updatedGuests = selectedGuests.filter(g => g.id !== guest.id);
            setSelectedGuests(updatedGuests);
            setOffer(prev => ({
                ...prev,
                guest_ids: updatedGuests.map(g => g.id)
            }));
        } else {
            // Add guest
            const updatedGuests = [...selectedGuests, guest];
            setSelectedGuests(updatedGuests);
            setOffer(prev => ({
                ...prev,
                guest_ids: updatedGuests.map(g => g.id)
            }));
        }
    };

    const removeSelectedGuest = (guestToRemove) => {
        const updatedGuests = selectedGuests.filter(g => g.id !== guestToRemove.id);
        setSelectedGuests(updatedGuests);
        setOffer(prev => ({
            ...prev,
            guest_ids: updatedGuests.map(g => g.id)
        }));
    };

    const clearAllSelectedGuests = () => {
        setSelectedGuests([]);
        setOffer(prev => ({
            ...prev,
            guest_ids: []
        }));
    };

    const handleSave = async () => {
        setValidationAttempted(true);

        const { errors, isValid } = validateForm();
        if (!isValid) {
            toast.error('Please fix all validation errors');
            setFieldErrors(errors);
            return;
        }

        setIsSaving(true);
        try {
            if (isAddMode) {
                const payload = {
                    course_id: offer.course_id,
                    guest_ids: offer.guest_ids,
                    notes: offer.notes || null,
                    offered_by: getOfferedByUserId(),
                    timing_text: offer.timing_text || null
                };

                const response = await fetch('/api/courses/offers', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to create offers');
                }

                const successCount = result.data?.created_count || offer.guest_ids.length;
                toast.success(result.message || `Successfully created ${successCount} course offer(s)`);

                if (onSuccess) {
                    onSuccess({
                        action: 'add',
                        count: successCount
                    });
                }
            } else {
                // Edit mode
                const method = isEditMode ? 'PUT' : 'POST';
                const url = isEditMode ? `/api/courses/offers/${offerId}` : '/api/courses/offers';
                
                const payload = {
                    course_id: offer.course_id,
                    guest_id: offer.guest_id,
                    notes: offer.notes || null,
                    offered_by: getOfferedByUserId(),
                    timing_text: offer.timing_text || null  // ← ADD THIS
                };

                if (isEditMode) {
                    payload.id = offerId;
                }

                const response = await fetch(url, {
                    method,
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Failed to save offer');
                }

                toast.success(result.message || `Offer ${isEditMode ? 'updated' : 'created'} successfully`);
                
                if (onSuccess) {
                    onSuccess({
                        action: isEditMode ? 'edit' : 'add',
                        id: result.data?.id || offerId
                    });
                }
            }
        } catch (error) {
            console.error('Error saving offer:', error);
            toast.error(error.message || 'Failed to save offer');
        } finally {
            setIsSaving(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'Not specified';
        return moment(dateString).format('DD/MM/YYYY');
    };

    const formatDateTime = (dateString) => {
        if (!dateString) return 'Not specified';
        return moment(dateString).format('DD/MM/YYYY HH:mm');
    };

    const getBookingStatus = () => {
        if (!selectedCourse) return null;
        
        const now = moment();
        const deadline = moment(selectedCourse.min_end_date);
        const courseStart = moment(selectedCourse.start_date);
        const daysLeft = deadline.diff(now, 'days');
        
        if (courseStart.isBefore(now)) {
            return { text: 'Course has started', urgent: true, color: 'text-red-600' };
        } else if (daysLeft < 0) {
            return { text: 'Booking window has closed', urgent: true, color: 'text-red-600' };
        } else if (daysLeft === 0) {
            return { text: 'Last day for booking!', urgent: true, color: 'text-orange-600' };
        } else if (daysLeft <= 3) {
            return { text: `${daysLeft} days left to book`, urgent: true, color: 'text-orange-600' };
        } else {
            return { text: `${daysLeft} days until booking deadline`, urgent: false, color: 'text-green-600' };
        }
    };

    const getOfferStatus = () => {
        if (!isEditMode && !isViewMode) return null;
        
        const statusConfig = {
            offered: { type: 'warning', label: 'Offered' },
            accepted: { type: 'success', label: 'Accepted' },
            completed: { type: 'success', label: 'Completed' }
        };

        return statusConfig[offer.status] || { type: 'warning', label: 'Offered' };
    };

    // Prepare course cards for HorizontalCardSelection
    const getCourseCards = () => {
        return courses
            .filter(course => course.status === 'active')
            .map(course => {
                const now = moment();
                const deadline = moment(course.min_end_date);
                const courseStart = moment(course.start_date);
                const daysLeft = deadline.diff(now, 'days');
                
                let statusText = 'Open for booking';
                let statusColor = 'text-green-600';
                
                if (courseStart.isBefore(now)) {
                    statusText = 'Course started';
                    statusColor = 'text-red-600';
                } else if (daysLeft < 0) {
                    statusText = 'Booking closed';
                    statusColor = 'text-red-600';
                } else if (daysLeft <= 3) {
                    statusText = `${daysLeft} days left to book`;
                    statusColor = 'text-orange-600';
                }

                return {
                    value: course.id.toString(),
                    label: course.title,
                    description: `${formatDate(course.start_date)} - ${formatDate(course.end_date)} | Booking deadline: ${formatDate(course.min_end_date)} | ${statusText}`,
                    imageUrl: course.imageUrl
                };
            });
    };

    // Filter out already selected guests from display
    const availableGuests = useMemo(() => {
        if (!isAddMode) return guests;
        const selectedIds = selectedGuests.map(g => g.id);
        return guests.filter(guest => !selectedIds.includes(guest.id));
    }, [guests, selectedGuests, isAddMode]);

    // Get the display name for offered by (for UI display)
    const getOfferedByDisplayName = () => {
        if (offer.offeredByUser) {
            return `${offer.offeredByUser.first_name} ${offer.offeredByUser.last_name}`;
        }
        // Fallback - if we only have the ID, show that
        return offer.offered_by || '';
    };

    // Get the user ID for offered by (for saving to database)
    const getOfferedByUserId = () => {
        if (offer.offeredByUser && offer.offeredByUser.id) {
            return offer.offeredByUser.id;
        }
        // If offer.offered_by is already a number (user ID), return it
        if (typeof offer.offered_by === 'number') {
            return offer.offered_by;
        }
        // If it's a string that looks like a number, parse it
        if (typeof offer.offered_by === 'string' && !isNaN(offer.offered_by)) {
            return parseInt(offer.offered_by);
        }
        // Fallback to current user ID if available
        if (user && user.id) {
            return user.id;
        }
        return null;
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Spinner />
            </div>
        );
    }

    // View Mode (keeping original view mode code)
    if (isViewMode) {
        const bookingStatus = getBookingStatus();
        const offerStatus = getOfferStatus();

        return (
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white border-b px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 text-sm text-gray-600">
                            <Home className="w-4 h-4" />
                            <button 
                                onClick={() => router.push('/courses?selectedTab=offers')}
                                className="hover:text-blue-600 transition-colors font-medium"
                            >
                                COURSE OFFERS
                            </button>
                            <span>/</span>
                            <span className="font-medium text-gray-900 uppercase">
                                OFFER DETAILS
                            </span>
                        </div>
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label="EDIT OFFER"
                            onClick={() => {
                                if (onSuccess) {
                                    onSuccess({ action: 'edit', id: offerId });
                                }
                            }}
                            className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
                        />
                    </div>
                </div>

                {/* Main Content - keeping the same view mode layout */}
                <div className="p-6">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left Column - Course Information */}
                            <div className="space-y-6">
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-blue-100 rounded-lg">
                                            <BookOpen className="w-6 h-6 text-blue-600" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-gray-900">Course Information</h2>
                                    </div>
                                    
                                    {selectedCourse ? (
                                        <div className="space-y-4">
                                            <div>
                                                <h3 className="text-lg font-medium text-gray-900 mb-2">
                                                    {selectedCourse.title}
                                                </h3>
                                                <p className="text-gray-600">
                                                    {selectedCourse.description || 'No description available'}
                                                </p>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
                                                <div>
                                                    <span className="text-sm font-medium text-gray-500">Course Dates</span>
                                                    <p className="text-gray-900">
                                                        {formatDate(selectedCourse.start_date)} - {formatDate(selectedCourse.end_date)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-gray-500">Duration</span>
                                                    <p className="text-gray-900">
                                                        {selectedCourse.duration_hours || 'TBD'}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-gray-500">Booking Deadline</span>
                                                    <p className="text-gray-900">
                                                        {formatDate(selectedCourse.min_end_date)}
                                                    </p>
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-gray-500">Status</span>
                                                    <p className="text-gray-900">
                                                        <StatusBadge 
                                                            type={selectedCourse.status === 'active' ? 'success' : 'neutral'} 
                                                            label={selectedCourse.status?.toUpperCase()} 
                                                        />
                                                    </p>
                                                </div>
                                            </div>

                                            {bookingStatus && (
                                                <div className={`flex items-center space-x-2 pt-4 border-t border-gray-200 ${bookingStatus.color}`}>
                                                    <Info className="w-4 h-4" />
                                                    <span className="text-sm font-medium">{bookingStatus.text}</span>
                                                    {bookingStatus.urgent && (
                                                        <span className="px-2 py-1 bg-orange-100 text-orange-800 text-xs rounded-full font-medium">
                                                            Urgent
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">No course information available</p>
                                    )}
                                </div>
                            </div>

                            {/* Right Column - Guest & Offer Information */}
                            <div className="space-y-6">
                                {/* Guest Information */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center space-x-3 mb-4">
                                        <div className="p-2 bg-green-100 rounded-lg">
                                            <User className="w-6 h-6 text-green-600" />
                                        </div>
                                        <h2 className="text-xl font-semibold text-gray-900">Guest Information</h2>
                                    </div>
                                    
                                    {selectedGuest ? (
                                        <div className="space-y-3">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500">Name</span>
                                                <p className="text-lg font-medium text-gray-900">
                                                    {selectedGuest.first_name} {selectedGuest.last_name}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500">Email</span>
                                                <p className="text-gray-900">{selectedGuest.email}</p>
                                            </div>
                                            {selectedGuest.phone_number && (
                                                <div>
                                                    <span className="text-sm font-medium text-gray-500">Phone</span>
                                                    <p className="text-gray-900">{selectedGuest.phone_number}</p>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <p className="text-gray-500">No guest information available</p>
                                    )}
                                </div>

                                {/* Offer Details */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Offer Details</h2>
                                    
                                    <div className="space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-sm font-medium text-gray-500">Offered At</span>
                                                <p className="text-gray-900">{formatDateTime(offer.offered_at)}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm font-medium text-gray-500">Current Status</span>
                                                <div className="mt-1">
                                                    {offerStatus && (
                                                        <StatusBadge 
                                                            type={offerStatus.type} 
                                                            label={offerStatus.label} 
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <span className="text-sm font-medium text-gray-500">Offered By</span>
                                            <p className="text-gray-900">{getOfferedByDisplayName()}</p>
                                        </div>
                                        
                                        <div>
                                            <span className="text-sm font-medium text-gray-500">Notes</span>
                                            <p className="text-gray-900 whitespace-pre-wrap">
                                                {offer.notes || 'No notes provided'}
                                            </p>
                                        </div>

                                        {/* Status Information */}
                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-4">
                                            <div className="flex items-start space-x-2">
                                                <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                                                <div className="text-sm text-blue-700">
                                                    <p className="font-medium mb-1">Status Information:</p>
                                                    <p className="text-xs">Status updates are managed automatically by system triggers based on guest responses and course completion.</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Edit/Add Mode with status as read-only
    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Home className="w-4 h-4" />
                        <button 
                            onClick={() => router.push('/courses?selectedTab=offers')}
                            className="hover:text-blue-600 transition-colors font-medium"
                        >
                            COURSE OFFERS
                        </button>
                        <span>/</span>
                        <span className="font-medium">
                            {isAddMode && 'ADD OFFERS'}
                            {isEditMode && 'EDIT OFFER'}
                        </span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <Button
                            type="button"
                            color="outline"
                            size="medium"
                            label="CANCEL"
                            onClick={onCancel}
                            disabled={isSaving}
                        />
                        <Button
                            type="button"
                            color="primary"
                            size="medium"
                            label={
                                isSaving ? 'SAVING...' : 
                                isAddMode ? `CREATE OFFERS ${selectedGuests.length > 0 ? `(${selectedGuests.length})` : ''}` : 
                                'SAVE OFFER'
                            }
                            onClick={handleSave}
                            disabled={isSaving || (isAddMode && selectedGuests.length === 0)}
                        />
                    </div>
                </div>
            </div>

            {/* Performance Warning */}
            {isAddMode && selectedGuests.length > 100 && (
                <div className="bg-orange-50 border-l-4 border-orange-400 p-4 mx-6 mt-4">
                    <div className="flex">
                        <AlertTriangle className="w-5 h-5 text-orange-400 mt-0.5 mr-3" />
                        <div>
                            <h3 className="text-sm font-medium text-orange-800">
                                Large Bulk Operation
                            </h3>
                            <p className="text-sm text-orange-700 mt-1">
                                You have selected {selectedGuests.length} guests. Creating offers for many guests may take longer than usual.
                            </p>
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
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        {/* Left Column - Course Selection */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Course</h3>
                                
                                {/* Course selection is enabled for both add and edit modes */}
                                <div>
                                    <HorizontalCardSelection 
                                        items={getCourseCards()} 
                                        value={offer.course_id ? offer.course_id.toString() : null} 
                                        onChange={handleCourseSelect}
                                        multi={false}
                                        required={true}
                                    />
                                    {validationAttempted && fieldErrors.course_id && (
                                        <p className="text-red-600 text-sm mt-2">{fieldErrors.course_id}</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column - Guest Selection & Details */}
                        <div className="space-y-6">
                            {/* Guest Selection */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold text-gray-900">
                                        {isAddMode ? 'Select Guests' : 'Select Guest'}
                                    </h3>
                                    {isAddMode && (
                                        <div className="flex items-center space-x-3">
                                            {selectedGuests.length > 0 && (
                                                <span className="text-sm text-blue-600 font-medium">
                                                    {selectedGuests.length} / {MAX_GUEST_SELECTION} selected
                                                </span>
                                            )}
                                            {selectedGuests.length > 0 && (
                                                <Button
                                                    type="button"
                                                    color="outline"
                                                    size="small"
                                                    label="Clear All"
                                                    onClick={clearAllSelectedGuests}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {isEditMode && selectedGuest ? (
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-sm text-gray-600 mb-2">Selected Guest:</p>
                                        <p className="font-medium text-gray-900">
                                            {selectedGuest.first_name} {selectedGuest.last_name}
                                        </p>
                                        <p className="text-sm text-gray-600">{selectedGuest.email}</p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative mb-4">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search guests by name or email..."
                                                value={guestSearchTerm}
                                                onChange={(e) => setGuestSearchTerm(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            />
                                            {guestSearchTerm && (
                                                <button
                                                    onClick={() => setGuestSearchTerm('')}
                                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>

                                        {/* Selected Guests Display for Add Mode */}
                                        {isAddMode && selectedGuests.length > 0 && (
                                            <div className="mb-4">
                                                <p className="text-sm font-medium text-gray-700 mb-2">Selected Guests:</p>
                                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                                    {selectedGuests.map(guest => (
                                                        <div key={guest.id} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
                                                            <div className="flex items-center space-x-2">
                                                                <UserCheck className="w-4 h-4 text-blue-600" />
                                                                <div>
                                                                    <p className="font-medium text-blue-900">
                                                                        {guest.first_name} {guest.last_name}
                                                                    </p>
                                                                    <p className="text-sm text-blue-700">{guest.email}</p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={() => removeSelectedGuest(guest)}
                                                                className="text-red-600 hover:text-red-800 transition-colors"
                                                            >
                                                                <X className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Guest List with Pagination */}
                                        <div className="border border-gray-200 rounded-lg">
                                            <div className="max-h-80 overflow-y-auto">
                                                {availableGuests.length === 0 && !guestsLoading ? (
                                                    <div className="text-center py-8 text-gray-500">
                                                        {guestSearchTerm ? 'No guests found matching your search' : 'No guests available'}
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-gray-200">
                                                        {availableGuests.map(guest => {
                                                            const isSelected = isAddMode ? 
                                                                selectedGuests.some(g => g.id === guest.id) :
                                                                selectedGuest?.id === guest.id;
                                                            
                                                            return (
                                                                <div
                                                                    key={guest.id}
                                                                    className={`p-4 cursor-pointer transition-colors ${
                                                                        isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : 'hover:bg-gray-50'
                                                                    }`}
                                                                    onClick={() => isAddMode ? handleMultipleGuestSelect(guest) : handleGuestSelect(guest)}
                                                                >
                                                                    <div className="flex items-center justify-between">
                                                                        <div>
                                                                            <div className="font-medium text-gray-900">
                                                                                {guest.first_name} {guest.last_name}
                                                                            </div>
                                                                            <div className="text-sm text-gray-600">
                                                                                {guest.email}
                                                                            </div>
                                                                            {guest.phone_number && (
                                                                                <div className="text-sm text-gray-500">
                                                                                    {guest.phone_number}
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                        {isSelected && (
                                                                            <CheckCircle className="w-5 h-5 text-blue-600" />
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                        
                                                        {/* Load More Button */}
                                                        {guestsPagination.hasMore && (
                                                            <div className="p-4 border-t border-gray-200">
                                                                <Button
                                                                    type="button"
                                                                    color="outline"
                                                                    size="small"
                                                                    label={guestsLoading ? 'Loading...' : 'Load More Guests'}
                                                                    onClick={loadMoreGuests}
                                                                    disabled={guestsLoading}
                                                                    className="w-full"
                                                                />
                                                            </div>
                                                        )}
                                                        
                                                        {guestsLoading && (
                                                            <div className="p-4 text-center">
                                                                <Spinner />
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Pagination Info */}
                                        <div className="text-sm text-gray-500 mt-2 text-center">
                                            Showing {availableGuests.length} of {guestsPagination.total} guests
                                            {guestSearchTerm && ` matching "${guestSearchTerm}"`}
                                        </div>

                                        {validationAttempted && fieldErrors.guest_ids && (
                                            <p className="text-red-600 text-sm mt-1">{fieldErrors.guest_ids}</p>
                                        )}
                                        {validationAttempted && fieldErrors.guest_id && (
                                            <p className="text-red-600 text-sm mt-1">{fieldErrors.guest_id}</p>
                                        )}
                                    </>
                                )}
                            </div>

                            {/* Offer Details */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-4">Offer Details</h3>
                                
                                <div className="space-y-4">
                                    {/* Notes field */}
                                    <div>
                                        <TextField
                                            label="Notes (Optional)"
                                            value={offer.notes}
                                            onChange={handleInputChange('notes')}
                                            placeholder={isAddMode ? "Add notes that will apply to all offers..." : "Add any additional notes about this course offer..."}
                                            multiline
                                            rows={4}
                                            size="large"
                                        />
                                        <p className="text-gray-500 text-sm mt-1">
                                            {isAddMode ? 
                                                'These notes will be added to all offers created and are for internal tracking' :
                                                'These notes are for internal tracking and will be visible to administrators'
                                            }
                                        </p>
                                    </div>

                                    {/* Timing Text Field */}
                                    <div>
                                        <TimingTextInput
                                            label="Timing Display Text"
                                            value={offer.timing_text}
                                            onChange={handleInputChange('timing_text')}
                                            disabled={isViewMode}
                                            helpText="This text is displayed in the Course Offers timing column. Components are combined into a single display string."
                                        />
                                    </div>

                                    {/* Status display in edit/view mode (read-only) */}
                                    {(isEditMode || isViewMode) && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Current Status
                                            </label>
                                            <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                                <div className="flex items-center space-x-2">
                                                    {getOfferStatus() && (
                                                        <StatusBadge 
                                                            type={getOfferStatus().type} 
                                                            label={getOfferStatus().label} 
                                                        />
                                                    )}
                                                    <span className="text-sm text-gray-600">
                                                        Status is managed automatically by system triggers
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Offered By field - read-only display with hidden ID storage */}
                                    <div>
                                        <TextField
                                            label="Offered By"
                                            value={getOfferedByDisplayName()}
                                            onChange={undefined}
                                            placeholder=""
                                            size="large"
                                            disabled={true}
                                            readOnly={true}
                                        />
                                        {isEditMode ? (
                                            <p className="text-gray-500 text-sm mt-1">
                                                This field cannot be changed. Contact an administrator if you need to update the offering user.
                                            </p>
                                        ) : (
                                            <p className="text-gray-500 text-sm mt-1">
                                                Automatically set to your account ({user?.first_name} {user?.last_name}, ID: {user?.id}).
                                            </p>
                                        )}
                                    </div>
                                </div>

                                {/* Info Section */}
                                {selectedCourse && (
                                    <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <div className="flex items-start space-x-2">
                                            <Info className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <h4 className="text-sm font-medium text-blue-800">
                                                    {isAddMode ? 'Automated Status Management' : 'Status Information'}
                                                </h4>
                                                <p className="text-sm text-blue-700 mt-1">
                                                    {isAddMode ? (
                                                        <>New course offers will be created with &quot;Offered&quot; status. Status changes to &quot;Accepted&quot; and &quot;Completed&quot; are handled automatically by system triggers based on guest responses and course completion.</>
                                                    ) : (
                                                        <>Course offer statuses are managed automatically by system triggers. Status changes occur based on guest responses and course timing. Manual status updates are not available to ensure data consistency.</>
                                                    )}
                                                </p>
                                                <div className="mt-2 text-xs text-blue-600">
                                                    <p><strong>Workflow:</strong> Offered → Accepted (by guest) → Completed (after course ends)</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}