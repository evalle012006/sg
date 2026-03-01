import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { useRouter } from "next/router";
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import Modal from "../ui/modal";
import StatusBadge from "../ui-v2/StatusBadge";
import { BOOKING_TYPES } from "../constants";
import { getFunder, isBookingInPast, isCheckInDatePassed } from "../../utilities/common";

const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../ui/spinner'));
const Button = dynamic(() => import('../ui-v2/Button'));
const TabButton = dynamic(() => import('../ui-v2/TabButton'));
const ThumbnailCard = dynamic(() => import('../ui-v2/ThumbnailCard'));
const CalendarView = dynamic(() => import('../ui-v2/CalendarView'), {
    loading: () => <div className="flex justify-center items-center py-12"><span>Loading calendar...</span></div>
});
const GuestProfileTab = dynamic(() => import('../my-profile/GuestProfileTab'));
const HealthInformation = dynamic(() => import('../guests/HealthInformation'));
const FundingApprovalsReadOnly = dynamic(() => import('../my-profile/FundingApprovalsReadOnly'));
const CourseEOIModal = dynamic(() => import('../courses/CourseEOIModal'));
const ConfirmDialog = dynamic(() => import('../ui-v2/ConfirmDialog'));

export default function GuestBookingsV2() {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const user = useSelector(state => state.user.user);
    const router = useRouter();
    const [pastBookings, setPastBookings] = useState([]);
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [cancelledBookings, setCancelledBookings] = useState([]);
    const [latestBooking, setLatestBooking] = useState();
    const [prevBookingUuid, setPrevBookingUuid] = useState();
    const [showWarningNewBooking, setShowWarningNewBooking] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [activeActivityTab, setActiveActivityTab] = useState(0);

    const [courseOffers, setCourseOffers] = useState([]);
    const [courseOffersLoading, setCourseOffersLoading] = useState(false);
    const [showAllCourseOffers, setShowAllCourseOffers] = useState(false);

    const [courseBookingContext, setCourseBookingContext] = useState(null);
    const [promotions, setPromotions] = useState([]);
    const [loadingPromotions, setLoadingPromotions] = useState(true);

    const [healthInfo, setHealthInfo] = useState([]);
    const [healthInfoLastUpdated, setHealthInfoLastUpdated] = useState(null);
    const [ndis, setNdis] = useState(null);
    const [icare, setIcare] = useState(null);

    // All courses state (for calendar view)
    const [allCourses, setAllCourses] = useState([]);
    const [allCoursesLoading, setAllCoursesLoading] = useState(false);

    // EOI Modal state
    const [showEOIModal, setShowEOIModal] = useState(false);
    const [selectedCourseForEOI, setSelectedCourseForEOI] = useState(null);

    const [showCourseDetailsModal, setShowCourseDetailsModal] = useState(false);
    const [selectedCourseForDetails, setSelectedCourseForDetails] = useState(null);

    const [showCancelConfirmation, setShowCancelConfirmation] = useState(false);
    const [bookingToCancel, setBookingToCancel] = useState(null);

    const handleViewCourseDetails = (course, offer) => {
        setSelectedCourseForDetails({ course, offer });
        setShowCourseDetailsModal(true);
    };

    const handleCloseCourseDetailsModal = () => {
        setShowCourseDetailsModal(false);
        setSelectedCourseForDetails(null);
    };

    const tabs = [
        { label: "UPCOMING BOOKINGS" },
        { label: "PAST BOOKINGS" },
        { label: "CANCELLED BOOKINGS" },
        { label: "COURSE CALENDAR" },
        { label: "MY PROFILE" },
        { label: "MY HEALTH" },
        { label: "MY FUNDING" }
    ];

    const loadHealthInfo = async () => {
        if (!user?.uuid) return;
        
        try {
            const response = await fetch(`/api/bookings/history/health-info`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ uuid: user.uuid }),
            });

            const data = await response.json();

            // Handle no previous booking case
            if (data?.message === "No previous booking found") {
                setHealthInfo([]);
                setNdis(null);
                setIcare(null);
                setHealthInfoLastUpdated(null);
                return;
            }

            if (data) {
                // Initialize health info array with all conditions set to false
                const initialHealthInfo = [
                    { diagnose: "Admission to hospital in the last 3 months", answer: false },
                    { diagnose: "Current Pressure Injuries", answer: false },
                    { diagnose: "Current open wounds, cuts, abrasions or stitches", answer: false },
                    { diagnose: "Autonomic Dysreflexia", answer: false },
                    { diagnose: "Head/Brain injury or memory loss", answer: false },
                    { diagnose: "Moderate to severe spasm/spasticity", answer: false },
                    { diagnose: "Osteoperosis/Osteopenia", answer: false },
                    { diagnose: "Low bone density", answer: false },
                    { diagnose: "Fracture/s in the last 12 months", answer: false },
                    { diagnose: "Low blood pressure", answer: false },
                    { diagnose: "Respiratory complications", answer: false },
                    { diagnose: "Medications recently changed", answer: false },
                    { diagnose: "Diabetes", answer: false },
                    { diagnose: "Been advised by your doctor not to participate in particular activities", answer: false },
                    { diagnose: "I currently require subcutaneous injections", answer: false }
                ];

                // Set health information
                if (data.info && data.info.length > 0) {
                    setHealthInfoLastUpdated(data.lastUpdated);
                    
                    // Update answers based on returned data
                    const updatedHealthInfo = initialHealthInfo.map(item => ({
                        ...item,
                        answer: data.info.includes(item.diagnose)
                    }));
                    
                    setHealthInfo(updatedHealthInfo);
                } else {
                    // No health conditions reported, set all to false
                    setHealthInfo(initialHealthInfo);
                    setHealthInfoLastUpdated(data.lastUpdated);
                }

                // Set participant numbers from API response
                setNdis(data.ndis_participant_number || null);
                setIcare(data.icare_participant_number || null);
            }
        } catch (error) {
            console.error('Error loading health info:', error);
            setHealthInfo([]);
            setNdis(null);
            setIcare(null);
            setHealthInfoLastUpdated(null);
        }
    };

    useEffect(() => {
        // Load health info when switching to health or funding tabs
        if ((activeTab === 5 || activeTab === 6) && user?.uuid) {
            loadHealthInfo();
        }
    }, [activeTab, user?.uuid]);

    const createBookingRequestForm = async (bookingId) => {
        return await fetch(`/api/booking-request-form/check-booking-section`, {
            method: 'POST',
            body: JSON.stringify({ bookingId }),
            headers: {
                'Content-Type': 'application/json'
            }
        });
    }

    const handleCompletePrevBooking = async () => {
        const brf = await createBookingRequestForm(latestBooking.id);

        // Safely get the incomplete booking
        const incompleteBookings = upcomingBookings.filter(booking => !booking.complete && !booking.status.includes('cancelled'));
        const incompletePreviousBookingUuid = incompleteBookings.length > 0 ? incompleteBookings[0].uuid : null;

        if (brf.ok) {
            setTimeout(() => {
                if (incompletePreviousBookingUuid && prevBookingUuid) {
                    window.open(`/booking-request-form?uuid=${incompletePreviousBookingUuid}&prevBookingId=${prevBookingUuid}`, '_self');
                } else {
                    console.log('missing incompletePrevBookingUuid and prevBookingUuid');
                    // window.open(`/booking-request-form?uuid=${incompletePreviousBookingUuid}`, '_self');
                }
            }, 800);
        }
    }

    const handleCheckPrevBookingStatus = async (courseContext = null) => {
        setLoading(true);
        
        if (courseContext) {
            setCourseBookingContext(courseContext);
            console.log('🎓 Course booking context set:', courseContext);
        }
        
        const data = { guestId: user.id };

        const response = await fetch("/api/bookings/book-now/check-previous-booking", {
            method: "POST",
            body: JSON.stringify(data)
        });

        if (response.ok) {
            setLoading(false);
            const data = await response.json();
            if (data && data.hasIncomplete) {
                setShowWarningNewBooking(true);
            } else {
                setShowWarningNewBooking(false);
                handleBookNow(courseContext);
            }
        }
    };

    const handleBookNow = async (courseContext = null) => {
        setLoading(true);
        const data = { guestId: user.id };

        const response = await fetch("/api/bookings/book-now/create", {
            method: "POST",
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const newBooking = await response.json();
            if (newBooking) {
                fetchBookings();
                const brf = await createBookingRequestForm(newBooking.id);

                if (brf.ok) {
                    setLoading(false);
                    setTimeout(() => {
                        let finalUrl;
                        const currentCourseContext = courseContext || courseBookingContext;
                        console.log('🎓 Course booking context:', currentCourseContext);
                        
                        if (currentCourseContext && currentCourseContext?.courseName) {
                            const baseUrl = `/booking-request-form?uuid=${newBooking.uuid}`;
                            const courseParam = `&courseOfferId=${currentCourseContext.courseOfferId}`;
                            const prevBookingParam = (bookings.length > 0 && newBooking.prevBookingId) 
                                ? `&prevBookingId=${newBooking.prevBookingId}` : '';
                            
                            finalUrl = baseUrl + courseParam + prevBookingParam;
                            setCourseBookingContext(null);
                        } else {
                            if (bookings.length > 0 && newBooking.prevBookingId) {
                                finalUrl = `/booking-request-form?uuid=${newBooking.uuid}&prevBookingId=${newBooking.prevBookingId}`;
                            } else {
                                finalUrl = `/booking-request-form?uuid=${newBooking.uuid}`;
                            }
                        }
                        
                        window.open(finalUrl, '_self');
                    }, 500);
                }
            }
        } else {
            setLoading(false);
            const currentCourseContext = courseContext || courseBookingContext;
            const errorMessage = currentCourseContext 
                ? `Something went wrong. Unable to create booking for the course "${currentCourseContext.courseName}" at the moment.`
                : "Something went wrong. Unable to create booking at the moment.";
            
            toast.error(errorMessage);
            setCourseBookingContext(null);
        }
    };

    const handleCourseBookNow = (courseOfferId, courseName) => {
        console.log('🎓 Course "Book Now" clicked:', { courseOfferId, courseName });
        
        const courseContext = {
            courseOfferId: courseOfferId,
            courseName: courseName,
            timestamp: Date.now()
        };
        
        handleCheckPrevBookingStatus(courseContext);
    };

    const handleCancelBooking = async (bookingUuid) => {
        if (bookingUuid) {
            try {
                const response = await fetch(`/api/bookings/${bookingUuid}/update-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        status: { 
                            "name": "guest_cancelled", 
                            "label": "Cancellation Requested", 
                            "color": "orange" 
                        }
                    })
                });

                if (!response.ok) {
                    let errorMessage = 'Failed to cancel booking';
                    try {
                        const errorData = await response.json();
                        if (errorData.message) {
                            errorMessage = errorData.message;
                        } else if (errorData.error) {
                            errorMessage = errorData.error;
                        }
                    } catch (parseError) {
                        console.error('Error parsing error response:', parseError);
                    }
                    
                    toast.error(errorMessage);
                    return;
                }

                fetchBookings();
                toast.success('Booking cancellation has been requested.');
            } catch (err) {
                console.error('Network error cancelling booking:', err);
                toast.error('Network error occurred. Please check your connection and try again.');
            }
        }
    };

    const handleCancelClick = (booking) => {
        setBookingToCancel(booking);
        setShowCancelConfirmation(true);
    };

    const confirmCancellation = () => {
        if (bookingToCancel) {
            handleCancelBooking(bookingToCancel.uuid);
        }
        setShowCancelConfirmation(false);
        setBookingToCancel(null);
    };

    const handleDownloadPDF = async (booking) => {
        toast.info('Generating PDF. Please wait...');
        try {
            const isOldTemplate = booking.templateId <= 33;
            const apiEndpoint = isOldTemplate
                ? `/api/bookings/${booking.uuid}/download-summary-pdf-v1`
                : `/api/bookings/${booking.uuid}/download-summary-pdf-v2`;
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ origin: user.type }),
            });
        
            if (!response.ok) throw new Error('Failed to generate PDF');
        
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `summary-of-stay-${booking.uuid}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
          console.error('Error downloading PDF:', error);
          toast.error('Failed to download summary of stay. Please try again.');
        }
    }

    const fetchBookings = async () => {
        try {
            const res = await fetch("/api/guests/" + user.uuid);
            const data = await res.json();
            const bookingList = data.Bookings;
            
            if (bookingList) {
                setBookings(bookingList);
                
                const sortedBookings = [...bookingList].sort((a, b) => b.id - a.id);
                setLatestBooking(sortedBookings[0]);

                const filteredBookingsList = sortedBookings.filter(booking => booking.complete);

                if (filteredBookingsList.length) {
                    setPrevBookingUuid(filteredBookingsList[0].uuid);
                }
                
                dispatch(globalActions.setLoading(false));
                setLoading(false);
            } else {
                setBookings([]);
                setLoading(false);
            }
        } catch (error) {
            toast.error("Something went wrong. Unable to fetch bookings at the moment.")
            setLoading(false);
            console.log(error)
        }
    };

    const loadCourseOffers = async () => {
        if (!user?.id) return;
        
        setCourseOffersLoading(true);
        try {
            const params = new URLSearchParams({
                guest_id: user.id.toString(),
                status: 'offered',
                include_invalid: 'false',
                include_booked: 'true',
                limit: '20'
            });
            
            const response = await fetch(`/api/courses/offers?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to load course offers: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                const allOffers = result.data || [];
                setCourseOffers(allOffers);
                
                const linkedOffers = allOffers.filter(offer => offer.booking_id !== null);
                const availableOffers = allOffers.filter(offer => offer.booking_id === null);
                
                console.log(`🎓 Course offers loaded: ${allOffers.length} total (${availableOffers.length} available, ${linkedOffers.length} already booked)`);
                
            } else {
                throw new Error(result.message || 'Failed to load course offers');
            }
        } catch (error) {
            console.error('❌ Error loading course offers:', error);
            setCourseOffers([]);
        } finally {
            setCourseOffersLoading(false);
        }
    };

    // Load ALL active courses (for calendar view - shows courses not offered to guest)
    const loadAllCourses = async () => {
        setAllCoursesLoading(true);
        try {
            const params = new URLSearchParams({
                status: 'active',
                limit: '100'
            });
            
            const response = await fetch(`/api/courses?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to load all courses: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                const courses = result.data || result.courses || [];
                setAllCourses(courses);
                console.log(`📚 All courses loaded: ${courses.length} total`);
            } else {
                throw new Error(result.message || 'Failed to load courses');
            }
        } catch (error) {
            console.error('❌ Error loading all courses:', error);
            setAllCourses([]);
        } finally {
            setAllCoursesLoading(false);
        }
    };

    // Handle Register Interest click from calendar
    const handleRegisterInterest = (course) => {
        setSelectedCourseForEOI(course);
        setShowEOIModal(true);
    };

    // Handle EOI modal close
    const handleCloseEOIModal = () => {
        setShowEOIModal(false);
        setSelectedCourseForEOI(null);
    };

    useEffect(() => {
        if (bookings) {
            // Filter out cancelled bookings for past and upcoming
            const nonCancelledBookings = bookings.filter(booking => {
                const status = JSON.parse(booking.status);
                return status.name !== 'booking_cancelled' && status.name !== 'guest_cancelled';
            });

            // Past bookings (excluding cancelled) - use check-out date
            // A booking is "past" when the guest has already checked out
            const past = nonCancelledBookings.filter(booking => {
                // Use check_out_date if available, otherwise use preferred_departure_date
                const checkoutDate = booking.check_out_date || booking.preferred_departure_date;
                
                if (checkoutDate && moment(checkoutDate).isBefore(moment(), 'day')) {
                    return true;
                }
                return false;
            });

            // Upcoming bookings (excluding cancelled) - use check-in date
            // A booking is "upcoming" if the check-in date is today or in the future
            const upcoming = nonCancelledBookings.filter(booking => {
                // Use check_in_date if available, otherwise use preferred_arrival_date
                const checkinDate = booking.check_in_date || booking.preferred_arrival_date;
                
                if (checkinDate && moment(checkinDate).isSameOrAfter(moment(), 'day')) {
                    return true;
                }
                // Include bookings with no date set
                if (!checkinDate && !booking.check_out_date && !booking.preferred_departure_date) {
                    return true;
                }
                return false;
            });

            // Sort upcoming bookings by status priority
            const sortedUpcoming = [...upcoming].sort((a, b) => {
                const statusA = JSON.parse(a.status);
                const statusB = JSON.parse(b.status);
                
                // For non-cancelled, sort by priority
                const getPriority = (status) => {
                    if (status.name === 'booking_confirmed') return 1;
                    if (status.name === 'amendment_requested' || status.name === 'booking_amended') return 2;
                    return 3; // incomplete/pending
                };
                
                return getPriority(statusA) - getPriority(statusB);
            });

            // NEW: Filter cancelled bookings
            const cancelled = bookings.filter(booking => {
                const status = JSON.parse(booking.status);
                return status.name === 'booking_cancelled' || status.name === 'guest_cancelled';
            });

            // Sort cancelled bookings by most recent first
            const sortedCancelled = [...cancelled].sort((a, b) => {
                const dateA = a.check_in_date || a.preferred_arrival_date || a.createdAt;
                const dateB = b.check_in_date || b.preferred_arrival_date || b.createdAt;
                return moment(dateB).valueOf() - moment(dateA).valueOf();
            });

            setPastBookings(past);
            setUpcomingBookings(sortedUpcoming);
            setCancelledBookings(sortedCancelled); // NEW
        }
    }, [bookings]);

    useEffect(() => {
        if (user) {
            fetchBookings();
            loadCourseOffers();
            loadAllCourses();
        }

        if (user == null) {
            router.push('/auth/login')
        }
    }, [router, user]);

    useEffect(() => {
        loadPromotions();
    }, []);

    const loadPromotions = async () => {
        setLoadingPromotions(true);
        try {
            const response = await fetch('/api/promotions?status=published');
            if (response.ok) {
                const result = await response.json();
                const today = new Date();
                const filteredPromotions = (result.promotions || []).filter(promo => {
                    if (!promo.start_date && !promo.end_date) return true;
                    
                    const startDate = promo.start_date ? new Date(promo.start_date) : null;
                    const endDate = promo.end_date ? new Date(promo.end_date) : null;
                    
                    if (startDate && endDate) {
                        return today >= startDate && today <= endDate;
                    } else if (startDate) {
                        return today >= startDate;
                    } else if (endDate) {
                        return today <= endDate;
                    }
                    return true;
                });
                setPromotions(filteredPromotions);
            }
        } catch (error) {
            console.error('Error loading promotions:', error);
        }
        setLoadingPromotions(false);
    };

    const getBookingTitle = (booking) => {
        if (!booking.Rooms.length) return;
        const room = booking.Rooms[0];
        const roomType = room.RoomType;
        return `${roomType && roomType.name}`;
    }

    const viewBooking = async (bookingUUID) => {
        window.open(`/bookings/${bookingUUID}`, '_self');
    }

    const editBooking = async (booking) => {
        // Check if check-in date has passed or is today
        if (isCheckInDatePassed(booking)) {
            toast.error('This booking cannot be amended as the check-in date has passed or is today.');
            return;
        }
        
        if (booking.complete === true && booking.Sections.length > 0) {
            window.open(`/booking-request-form?uuid=${booking.uuid}`, '_self');
        } else {
            const brf = await createBookingRequestForm(booking.id);
            if (brf.ok) {
                setTimeout(() => {
                    if (booking.id && booking.uuid && booking.type === BOOKING_TYPES.RETURNING_GUEST && prevBookingUuid) {
                        window.open(`/booking-request-form?uuid=${booking.uuid}&prevBookingId=${prevBookingUuid}`, '_self');
                    } else {
                        window.open(`/booking-request-form?uuid=${booking.uuid}`, '_self');
                    }
                }, 800);
            }
        }
    }

    const getCalendarCourses = () => {
        return courseOffers.map(offer => ({
            ...offer.course,
            booking_id: offer.booking_id,
            offer_status: offer.status,
            isLinkedToBooking: offer.isLinkedToBooking,
            canBookNow: offer.canBookNow
        }));
    };

    const renderBookingCards = (bookingsToRender) => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookingsToRender.length > 0 ? (
                    bookingsToRender.map((booking, index) => {
                        let bookingTitle = getBookingTitle(booking) || "No Room Selected";
                        const funder = getFunder(booking.Sections);
                        const bookingStatus = JSON.parse(booking.status);
                        let imageUrl = null;
                        
                        if (booking.Rooms.length > 0 && booking.Rooms[0].RoomType?.imageUrl) {
                            imageUrl = booking.Rooms[0].RoomType.imageUrl;
                        }
                        
                        let checkinDate = '-';
                        let checkoutDate = '-';

                        if (booking.check_in_date) {
                            checkinDate = moment(booking.check_in_date).format('D MMM, YYYY');
                        } else if (booking.preferred_arrival_date) {
                            checkinDate = moment(booking.preferred_arrival_date).format('D MMM, YYYY');
                        }

                        if (booking.check_out_date) {
                            checkoutDate = moment(booking.check_out_date).format('D MMM, YYYY');
                        } else if (booking.preferred_departure_date) {
                            checkoutDate = moment(booking.preferred_departure_date).format('D MMM, YYYY');
                        }

                        const bookingDate = moment(booking.createdAt).format('D MMM, YYYY');
                        
                        const isCancelled = bookingStatus.name === 'booking_cancelled' || bookingStatus.name === 'guest_cancelled';
                        const bookingInPast = isBookingInPast(booking);
                        const checkInPassed = isCheckInDatePassed(booking);
                        const editButtonLabel = booking.complete ? "REQUEST TO AMEND" : "EDIT BOOKING";

                        
                        const customButtons = [];
                        
                        // Past bookings tab - only view details and download
                        if (activeTab === 1) {
                            customButtons.push(
                                <button 
                                    key="view-details"
                                    className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                    onClick={() => viewBooking(booking.uuid)}
                                    aria-label="View Details"
                                    title="View Details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            );
                            
                            if (booking.complete === true) {
                                customButtons.push(
                                    <button 
                                        key="download-pdf"
                                        className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                        onClick={() => handleDownloadPDF(booking)}
                                        aria-label="Download PDF"
                                        title="Download PDF"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                );
                            }
                        }

                        // Cancelled bookings tab - only view details
                        if (activeTab === 2) {
                            customButtons.push(
                                <button 
                                    key="view-details"
                                    className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                    onClick={() => viewBooking(booking.uuid)}
                                    aria-label="View Details"
                                    title="View Details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            );
                        }
                        
                        // Upcoming bookings tab - download PDF and cancel button
                        if (activeTab === 0 && !isCancelled && booking.complete === true) {
                            customButtons.push(
                                <button 
                                    key="download-pdf"
                                    className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                    onClick={() => handleDownloadPDF(booking)}
                                    aria-label="Download PDF"
                                    title="Download PDF"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            );
                            
                            // ✅ Only show cancel button if booking is not in the past
                            if (!bookingInPast) {
                                customButtons.push(
                                    <button 
                                        key="cancel-booking"
                                        className="inline-flex items-center justify-center p-2 border border-red-600 text-red-600 rounded hover:bg-red-50 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCancelClick(booking);
                                        }}
                                        aria-label="Request Cancellation"
                                        title="Request Cancellation"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                );
                            }
                        }
                        
                        return (
                            <ThumbnailCard
                                key={index}
                                type="booking"
                                bookingId={booking.reference_id}
                                bookingDate={bookingDate}
                                title={bookingTitle}
                                funder={funder} 
                                checkInDate={checkinDate}
                                checkOutDate={checkoutDate}
                                status={bookingStatus.label}
                                statusColor={!bookingStatus?.label?.includes('Pending') ? `bg-${bookingStatus.color}-400` : null}
                                image={imageUrl}
                                buttonText={editButtonLabel}
                                hideEditButton={isCancelled || activeTab === 1 || checkInPassed} // Changed from bookingInPast
                                disabledButtonTooltip={checkInPassed ? "This booking cannot be amended as the check-in date has passed" : undefined}
                                customButtons={customButtons.length > 0 ? customButtons : undefined}
                                onButtonClick={() => editBooking(booking)}
                                viewDetails={() => viewBooking(booking.uuid)}
                            />
                        );
                    })
                ) : (
                    <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 mb-10 text-sm border w-fit my-8" role="alert">
                        <p>No {activeTab === 0 ? 'upcoming' : activeTab === 1 ? 'past' : 'cancelled'} bookings</p>
                    </div>
                )}
            </div>
        );
    };

    const renderCalendarView = () => {
        if (courseOffersLoading || allCoursesLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Spinner />
                </div>
            );
        }

        const calendarCourses = getCalendarCourses();

        return (
            <div className="px-2 sm:px-4">
                <CalendarView 
                    courses={calendarCourses} 
                    allCourses={allCourses}
                    onBookNow={(course) => {
                        // Find the offer for this course
                        const offer = courseOffers.find(o => o.course?.id === course.id);
                        if (offer) {
                            handleCourseBookNow(offer.id, course.title);
                        }
                    }}
                    onRegisterInterest={handleRegisterInterest}
                />
            </div>
        );
    };

    const renderOfferCards = () => {
        if (courseOffersLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Spinner />
                </div>
            );
        }

        if (courseOffers.length === 0) {
            return (
                <div className="text-center py-12">
                    <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 text-sm border w-fit mx-auto">
                        <p>No course offers available at the moment</p>
                    </div>
                </div>
            );
        }

        const offersToShow = showAllCourseOffers ? courseOffers : courseOffers.slice(0, 3);
        const hasMoreOffers = courseOffers.length > 3;

        return (
            <div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {offersToShow.map((offer, index) => {
                        const course = offer.course;
                        if (!course) return null;

                        const courseDates = course.start_date && course.end_date ? 
                            `${moment(course.start_date).format('DD MMM, YYYY')} - ${moment(course.end_date).format('DD MMM, YYYY')}` : 
                            'Dates TBD';
                        
                        const minStayDates = course.min_start_date && course.min_end_date ?
                            `${moment(course.min_start_date).format('DD MMM, YYYY')} - ${moment(course.min_end_date).format('DD MMM, YYYY')}` :
                            courseDates;

                        const isLinkedToBooking = offer.booking_id !== null;
                        const linkedBooking = offer.booking;

                        return (
                            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                                <div className="relative">
                                    <div className="absolute top-3 left-3 z-10">
                                        {isLinkedToBooking ? (
                                            <StatusBadge 
                                                type="success" 
                                                label="Already Booked"
                                                size="small"
                                            />
                                        ) : (
                                            <StatusBadge 
                                                type="offer" 
                                                label="Special Offer"
                                                size="small"
                                            />
                                        )}
                                    </div>
                                    
                                    <img 
                                        src={course.imageUrl || "/course-placeholder.jpg"} 
                                        alt={course.title}
                                        className="w-full h-48 object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500 hidden">
                                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                                
                                <div className="p-4">
                                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{course.title}</h3>
                                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description || 'Experience this exciting course designed for all skill levels.'}</p>
                                    
                                    <div className="space-y-1 mb-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Course dates:</span>
                                            <span className="text-gray-900">{courseDates}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-500">Min stay dates:</span>
                                            <span className="text-gray-900">{minStayDates}</span>
                                        </div>
                                        {course.duration_hours && (
                                            <div className="flex justify-between text-sm">
                                                <span className="text-gray-500">Duration:</span>
                                                <span className="text-gray-900">{course.duration_hours} hours</span>
                                            </div>
                                        )}
                                        
                                        {isLinkedToBooking && (
                                            <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                                <span className="text-gray-500">Booking ID:</span>
                                                <span className="text-blue-600 font-medium">
                                                    {linkedBooking?.reference_id || offer.booking_id}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    <div className="flex gap-2">
                                        <span 
                                            className="flex-1 text-sm cursor-pointer hover:text-blue-800 transition-colors underline py-2"
                                            style={{ color: '#00467F' }}
                                            onClick={() => handleViewCourseDetails(course, offer)}
                                        >
                                            View Details
                                        </span>
                                        <div className="flex-1">
                                            {isLinkedToBooking ? (
                                                <Button 
                                                    size="small"
                                                    color="secondary"
                                                    label="VIEW BOOKING"
                                                    fullWidth={true}
                                                    onClick={() => {
                                                        const bookingToView = linkedBooking?.uuid || linkedBooking?.reference_id;
                                                        if (bookingToView) {
                                                            window.open(`/bookings/${bookingToView}`, '_self');
                                                        } else {
                                                            toast.info('Booking details not available');
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                <Button 
                                                    size="small"
                                                    color="primary"
                                                    label="BOOK NOW"
                                                    fullWidth={true}
                                                    onClick={() => handleCourseBookNow(offer.id, course.title)}
                                                />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {hasMoreOffers && !showAllCourseOffers && (
                    <div className="text-center">
                        <button
                            onClick={() => setShowAllCourseOffers(true)}
                            className="inline-flex items-center px-6 py-3 border-2 border-[#1B457B] text-[#1B457B] rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
                        >
                            VIEW ALL UPCOMING COURSES
                            <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}

                {hasMoreOffers && showAllCourseOffers && (
                    <div className="text-center">
                        <button
                            onClick={() => setShowAllCourseOffers(false)}
                            className="inline-flex items-center px-6 py-3 border-2 border-gray-400 text-gray-600 bg-white rounded-lg hover:bg-gray-50 transition-colors font-medium text-sm"
                        >
                            SHOW LESS
                            <svg className="ml-2 w-4 h-4 transform rotate-180" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderPromotionCards = () => {
        if (loadingPromotions) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Spinner />
                </div>
            );
        }

        if (!promotions || promotions.length === 0) {
            return (
                <div className="text-center py-12">
                    <p className="text-gray-600">No promotions available at this time.</p>
                </div>
            );
        }

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.map((promotion, index) => (
                    <div key={promotion.id || index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                        <div className="relative">
                            <div className="absolute top-3 left-3 z-10">
                                <StatusBadge 
                                    type="offer" 
                                    label="Special Offer"
                                    size="small"
                                />
                            </div>
                            {promotion.imageUrl ? (
                                <img 
                                    src={promotion.imageUrl} 
                                    alt={promotion.title}
                                    className="w-full h-48 object-cover"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'flex'
                                    }}
                                />
                            ) : null}
                            <div className={`w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500 ${promotion.imageUrl ? 'hidden' : ''}`}>
                                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="p-4">
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">{promotion.title}</h3>
                            <p className="text-gray-600 text-sm mb-3">{promotion.description}</p>
                            
                            <div className="space-y-1 mb-4">
                                {promotion.availability && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Availability:</span>
                                        <span className="text-gray-900">{promotion.availability}</span>
                                    </div>
                                )}
                                {promotion.terms && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Terms:</span>
                                        <span className="text-gray-900">{promotion.terms}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    useEffect(() => {
        return () => {
            setCourseBookingContext(null);
        };
    }, []);

    return (
        <Layout title={"My Bookings"} hideSidebar={true}>
            {loading ? (
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            ) : (
                <div>
                    <div className="w-full bg-[#F7F7F7] border-b border-gray-200">
                        <div className="container mx-auto px-4 sm:px-6">
                            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between pt-2 pb-4 gap-3">
                                {/* Tabs - Allow horizontal scroll on mobile, flex-grow on desktop */}
                                <div className="flex-1 overflow-x-auto">
                                    <div className="min-w-max">
                                        <TabButton 
                                            tabs={tabs} 
                                            activeTab={activeTab} 
                                            onChange={setActiveTab} 
                                            type="outline"
                                            borderRadius="4px"
                                        />
                                    </div>
                                </div>
                                
                                {/* Button - Full width on mobile, auto width on desktop */}
                                <div className="flex-shrink-0">
                                    <Button 
                                        size="small" 
                                        color="primary" 
                                        label="+ NEW BOOKING" 
                                        onClick={handleCheckPrevBookingStatus}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="max-w-7xl mx-auto">
                            {activeTab === 0 && renderBookingCards(upcomingBookings)}
                            {activeTab === 1 && renderBookingCards(pastBookings)}
                            {activeTab === 2 && (
                                <div>
                                    {cancelledBookings.length > 0 ? (
                                        renderBookingCards(cancelledBookings)
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-16 px-4">
                                            <div className="mb-4">
                                                <svg 
                                                    className="w-16 h-16 text-gray-300" 
                                                    fill="none" 
                                                    stroke="currentColor" 
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path 
                                                        strokeLinecap="round" 
                                                        strokeLinejoin="round" 
                                                        strokeWidth={1.5}
                                                        d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                                                    />
                                                </svg>
                                            </div>
                                            <h3 className="text-lg font-semibold text-gray-800 mb-2">NO CANCELLED BOOKINGS</h3>
                                            <p className="text-gray-500 text-center">
                                                You don&apos;t have any cancelled bookings at the moment.
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}
                            {activeTab === 3 && renderCalendarView()}

                            {/* Profile Tab */}
                            {activeTab === 4 && (
                                <div className="max-w-7xl mx-auto">
                                    <GuestProfileTab isGuestUser={true} />
                                </div>
                            )}

                            {/* Health Information Tab */}
                            {activeTab === 5 && (
                                <div className="max-w-7xl mx-auto">
                                    <HealthInformation 
                                        healthInfo={healthInfo}
                                        healthInfoLastUpdated={healthInfoLastUpdated}
                                        ndis={ndis}
                                        icare={icare}
                                    />
                                </div>
                            )}

                            {/* Funding Approvals Tab */}
                            {activeTab === 6 && (
                                <div className="max-w-7xl mx-auto">
                                    <FundingApprovalsReadOnly uuid={user?.uuid} />
                                </div>
                            )}
                        </div>
                    </div>

                    {activeTab < 4 && (
                        <div style={{ background: '#EBECF0' }} className="py-8 sm:py-12">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="text-center mb-6 sm:mb-8">
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">MY COURSE OFFERS</h2>
                                    <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                                        Try something new or revisit an old favourite. All course content is designed to be enjoyable, educational and easy to follow regardless of experience.
                                    </p>
                                </div>
                                {renderOfferCards()}
                            </div>
                        </div>
                    )}

                    {activeTab < 4 && (
                        <div className="py-8 sm:py-12">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="text-center mb-6 sm:mb-8">
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">PROMOTIONS AND SPECIAL OFFERS</h2>
                                </div>
                                {renderPromotionCards()}
                            </div>
                        </div>
                    )}

                    {showWarningNewBooking && 
                        <Modal 
                            title="Warning!"
                            titleColor="text-yellow-500"
                            description="You have an incomplete booking. Would you like to complete before making a new booking?"
                            modalHide={() => {
                                setShowWarningNewBooking(false);
                                setCourseBookingContext(null);
                            }}
                            onClose={() => {
                                console.log('Modal closed');
                                setShowWarningNewBooking(false);
                                handleCompletePrevBooking();
                            }}
                            cancelLabel="Complete Booking"
                            cancelColor="text-sargood-blue"
                            onConfirm={(e) => {
                                handleBookNow(courseBookingContext);
                                setShowWarningNewBooking(false);
                            }}
                            confirmLabel="New Booking"
                            confirmColor="text-emerald-500"
                        />
                    }

                    {/* Course EOI Modal */}
                    <CourseEOIModal
                        isOpen={showEOIModal}
                        onClose={handleCloseEOIModal}
                        selectedCourse={selectedCourseForEOI}
                        allCourses={allCourses}
                        guestData={user}
                    />

                    {/* Cancel Booking Confirmation Dialog */}
                        <ConfirmDialog
                            isOpen={showCancelConfirmation}
                            onClose={() => {
                                setShowCancelConfirmation(false);
                                setBookingToCancel(null);
                            }}
                            onConfirm={confirmCancellation}
                            title="Confirm Cancellation"
                            message={`Are you sure you want to request cancellation for booking ${bookingToCancel?.reference_id}?

Cancellation Policy: If less than seven (7) clear days' notice is given to cancel a reservation, 100% of the total fee must be paid (to a maximum of 7 nights). There is no charge if more notice of cancellation is given.

By clicking confirm, you agree to the cancellation policy.`}
                            type="danger"
                            confirmText="Yes, request cancellation. I agree to the cancellation policy"
                            cancelText="No, Keep Booking"
                            isLoading={false}
                        />

                    {showCourseDetailsModal && selectedCourseForDetails && (
                        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
                            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                {/* Header */}
                                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                                    <h2 className="text-xl font-semibold text-gray-900">Course Details</h2>
                                    <button
                                        onClick={handleCloseCourseDetailsModal}
                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                                
                                {/* Course Image */}
                                <div className="relative">
                                    {selectedCourseForDetails.offer?.booking_id && (
                                        <div className="absolute top-3 left-3 z-10">
                                            <StatusBadge 
                                                type="success" 
                                                label="Already Booked"
                                                size="small"
                                            />
                                        </div>
                                    )}
                                    <img 
                                        src={selectedCourseForDetails.course?.imageUrl || "/course-placeholder.jpg"} 
                                        alt={selectedCourseForDetails.course?.title}
                                        className="w-full h-56 object-cover"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                            e.target.nextSibling.style.display = 'flex';
                                        }}
                                    />
                                    <div className="w-full h-56 bg-gray-200 flex items-center justify-center text-gray-500 hidden">
                                        <svg className="w-16 h-16" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                                
                                {/* Course Content */}
                                <div className="p-6">
                                    <h3 className="text-2xl font-bold text-gray-900 mb-3">
                                        {selectedCourseForDetails.course?.title}
                                    </h3>
                                    
                                    <p className="text-gray-600 mb-6">
                                        {selectedCourseForDetails.course?.description || 'Experience this exciting course designed for all skill levels.'}
                                    </p>
                                    
                                    {/* Course Details Grid */}
                                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                        <h4 className="font-semibold text-gray-900 mb-3">Course Information</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-sm text-gray-500">Course Dates</span>
                                                <p className="font-medium text-gray-900">
                                                    {selectedCourseForDetails.course?.start_date && selectedCourseForDetails.course?.end_date 
                                                        ? `${moment(selectedCourseForDetails.course.start_date).format('DD MMM, YYYY')} - ${moment(selectedCourseForDetails.course.end_date).format('DD MMM, YYYY')}`
                                                        : 'Dates TBD'}
                                                </p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-500">Minimum Stay Dates</span>
                                                <p className="font-medium text-gray-900">
                                                    {selectedCourseForDetails.course?.min_start_date && selectedCourseForDetails.course?.min_end_date 
                                                        ? `${moment(selectedCourseForDetails.course.min_start_date).format('DD MMM, YYYY')} - ${moment(selectedCourseForDetails.course.min_end_date).format('DD MMM, YYYY')}`
                                                        : selectedCourseForDetails.course?.start_date && selectedCourseForDetails.course?.end_date 
                                                            ? `${moment(selectedCourseForDetails.course.start_date).format('DD MMM, YYYY')} - ${moment(selectedCourseForDetails.course.end_date).format('DD MMM, YYYY')}`
                                                            : 'Dates TBD'}
                                                </p>
                                            </div>
                                            {selectedCourseForDetails.course?.duration_hours && (
                                                <div>
                                                    <span className="text-sm text-gray-500">Duration</span>
                                                    <p className="font-medium text-gray-900">
                                                        {selectedCourseForDetails.course.duration_hours} hours
                                                    </p>
                                                </div>
                                            )}
                                            {selectedCourseForDetails.course?.max_participants && (
                                                <div>
                                                    <span className="text-sm text-gray-500">Max Participants</span>
                                                    <p className="font-medium text-gray-900">
                                                        {selectedCourseForDetails.course.max_participants}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {/* Linked Booking Info */}
                                    {selectedCourseForDetails.offer?.booking_id && selectedCourseForDetails.offer?.booking && (
                                        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                                            <h4 className="font-semibold text-green-800 mb-2">Linked Booking</h4>
                                            <p className="text-sm text-green-700">
                                                This course is linked to booking: <span className="font-medium">{selectedCourseForDetails.offer.booking.reference_id}</span>
                                            </p>
                                        </div>
                                    )}
                                    
                                    {/* Additional Notes */}
                                    {selectedCourseForDetails.offer?.notes && (
                                        <div className="mb-6">
                                            <h4 className="font-semibold text-gray-900 mb-2">Additional Notes</h4>
                                            <p className="text-gray-600">{selectedCourseForDetails.offer.notes}</p>
                                        </div>
                                    )}
                                </div>
                                
                                {/* Footer Actions */}
                                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-3">
                                    <Button 
                                        size="medium"
                                        color="outline"
                                        label="CLOSE"
                                        onClick={handleCloseCourseDetailsModal}
                                    />
                                    {selectedCourseForDetails.offer?.booking_id ? (
                                        <Button 
                                            size="medium"
                                            color="secondary"
                                            label="VIEW BOOKING"
                                            onClick={() => {
                                                const bookingToView = selectedCourseForDetails.offer.booking?.uuid || selectedCourseForDetails.offer.booking?.reference_id;
                                                if (bookingToView) {
                                                    window.open(`/bookings/${bookingToView}`, '_self');
                                                } else {
                                                    toast.info('Booking details not available');
                                                }
                                                handleCloseCourseDetailsModal();
                                            }}
                                        />
                                    ) : (
                                        <Button 
                                            size="medium"
                                            color="primary"
                                            label="BOOK NOW"
                                            onClick={() => {
                                                handleCourseBookNow(selectedCourseForDetails.offer.id, selectedCourseForDetails.course.title);
                                                handleCloseCourseDetailsModal();
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </Layout>
    );
}