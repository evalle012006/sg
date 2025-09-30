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

const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../ui/spinner'));
const Button = dynamic(() => import('../ui-v2/Button'));
const TabButton = dynamic(() => import('../ui-v2/TabButton'));
const ThumbnailCard = dynamic(() => import('../ui-v2/ThumbnailCard'));
const CalendarView = dynamic(() => import('../ui-v2/CalendarView'), {
    loading: () => <div className="flex justify-center items-center py-12"><span>Loading calendar...</span></div>
});

export default function GuestBookingsV2() {
    const dispatch = useDispatch();
    const [loading, setLoading] = useState(true);
    const [bookings, setBookings] = useState([]);
    const user = useSelector(state => state.user.user);
    const router = useRouter();
    const [pastBookings, setPastBookings] = useState([]);
    const [upcomingBookings, setUpcomingBookings] = useState([]);
    const [latestBooking, setLatestBooking] = useState();
    const [prevBookingUuid, setPrevBookingUuid] = useState();
    const [showWarningNewBooking, setShowWarningNewBooking] = useState(false);
    const [activeTab, setActiveTab] = useState(0);
    const [activeActivityTab, setActiveActivityTab] = useState(0);

    // Add course offers state
    const [courseOffers, setCourseOffers] = useState([]);
    const [courseOffersLoading, setCourseOffersLoading] = useState(false);
    const [showAllCourseOffers, setShowAllCourseOffers] = useState(false);

    const [courseBookingContext, setCourseBookingContext] = useState(null);
    const [promotions, setPromotions] = useState([]);
    const [loadingPromotions, setLoadingPromotions] = useState(true);

    // Updated tabs to include Course Calendar
    const tabs = [
        { label: "UPCOMING BOOKINGS" },
        { label: "PAST BOOKINGS" },
        { label: "COURSE CALENDAR" }
    ];

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
        const incompletePreviousBookingUuid = upcomingBookings.filter(booking => !booking.complete && !booking.status.includes('cancelled'))[0].uuid;

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
    };

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
                        // Use the parameter instead of state
                        const currentCourseContext = courseContext || courseBookingContext;
                        console.log('🎓 Course booking context:', currentCourseContext);
                        
                        if (currentCourseContext && currentCourseContext?.courseName) {
                            // Course booking flow
                            const baseUrl = `/booking-request-form?uuid=${newBooking.uuid}`;
                            const courseParam = `&courseOfferId=${currentCourseContext.courseOfferId}`;
                            const prevBookingParam = (bookings.length > 0 && newBooking.prevBookingId) 
                                ? `&prevBookingId=${newBooking.prevBookingId}` : '';
                            
                            finalUrl = baseUrl + courseParam + prevBookingParam;
                            
                            // toast.success(`🎓 Booking created for "${currentCourseContext.courseName}"! Your course is pre-selected. Please complete your booking by selecting your stay dates.`, {
                            //     autoClose: 5000
                            // });
                            
                            setCourseBookingContext(null);
                        } else {
                            // Regular booking flow
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

    const handleCancelBooking = async (booking) => {
        if (booking) {
            await fetch(`/api/bookings/${booking}/update-status`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    status: { "name": "guest_cancelled", "label": "Cancellation Requested", "color": "orange" }
                })
            }).then(() => {
                fetchBookings();
                toast.success('Booking Cancellation has been requested.');
            }).catch(err => console.log(err))
        }
    }

    const handleDownloadPDF = async (bookingId) => {
        toast.info('Generating PDF. Please wait...');
        try {
          const response = await fetch(`/api/bookings/${bookingId}/download-summary-pdf-v2`, {
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
          a.download = `summary-of-stay-${bookingId}.pdf`;
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
                // Room images are now included directly in the API response
                setBookings(bookingList);
                
                const sortedBookings = [...bookingList].sort((a, b) => b.id - a.id);
                setLatestBooking(sortedBookings[0]);

                // picking the latest booking that is complete
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
                status: 'offered', // Show offered courses
                include_invalid: 'false', // Only show valid offers
                include_booked: 'true', // IMPORTANT: Include courses already linked to bookings
                limit: '20'
            });
            
            const response = await fetch(`/api/courses/offers?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to load course offers: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                // Show ALL course offers - don't filter by booking_id
                // The UI will handle displaying them differently based on booking status
                const allOffers = result.data || [];
                setCourseOffers(allOffers);
                
                // Log for debugging
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

    useEffect(() => {
        if (bookings) {
            const past = bookings.filter(booking => {
                if (booking.check_in_date && moment(booking.check_in_date).isBefore(moment())) {
                    return booking;
                }
            });
            const upcoming = bookings.filter(booking => {
                if (booking.check_in_date && moment(booking.check_in_date).isAfter(moment())) {
                    return booking;
                }

                if (booking.check_in_date == null) {
                    return booking;
                }
            });

            setPastBookings(past);
            setUpcomingBookings(upcoming);
        }
    }, [bookings]);

    useEffect(() => {
        if (user) {
            fetchBookings();
            loadCourseOffers(); // Load course offers when user is available
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
                // Filter by date range - only show current promotions
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

    // Transform course offers data for calendar view
    const getCalendarCourses = () => {
        return courseOffers.map(offer => ({
            ...offer.course,
            // Add additional properties for calendar display
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
                        const bookingStatus = JSON.parse(booking.status);
                        let imageUrl = null;
                        
                        // Get image URL from the API response - room images are now included directly
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
                        
                        // Create custom buttons array for past bookings
                        const customButtons = [];
                        
                        // Add buttons for past bookings (simplified with just icons in outline style)
                        if (activeTab === 1) {
                            // View Details Button - Eye icon
                            customButtons.push(
                                <button 
                                    key="view-details"
                                    className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                    onClick={() => viewBooking(booking.uuid)}
                                    aria-label="View Details"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path d="M12 15a3 3 0 100-6 3 3 0 000 6z" />
                                        <path fillRule="evenodd" d="M1.323 11.447C2.811 6.976 7.028 3.75 12.001 3.75c4.97 0 9.185 3.223 10.675 7.69.12.362.12.752 0 1.113-1.487 4.471-5.705 7.697-10.677 7.697-4.97 0-9.186-3.223-10.675-7.69a1.762 1.762 0 010-1.113zM17.25 12a5.25 5.25 0 11-10.5 0 5.25 5.25 0 0110.5 0z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            );
                            
                            if (booking.complete === true) {
                                // Download PDF Button - Download icon
                                customButtons.push(
                                    <button 
                                        key="download-pdf"
                                        className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                        onClick={() => handleDownloadPDF(booking.uuid)}
                                        aria-label="Download PDF"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
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
                                checkInDate={checkinDate}
                                checkOutDate={checkoutDate}
                                status={bookingStatus.label}
                                statusColor={!bookingStatus?.label?.includes('Pending') ? `bg-${bookingStatus.color}-400` : null}
                                image={imageUrl}
                                buttonText="EDIT BOOKING"
                                hideEditButton={bookingStatus.name.includes('cancelled') || activeTab === 1}
                                customButtons={customButtons.length > 0 ? customButtons : undefined}
                                onButtonClick={() => editBooking(booking)}
                                viewDetails={() => viewBooking(booking.uuid)}
                            />
                        );
                    })
                ) : (
                    <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 mb-10 text-sm border w-fit my-8" role="alert">
                        <p>No {activeTab === 0 ? 'upcoming' : 'past'} bookings</p>
                    </div>
                )}
            </div>
        );
    };

    const renderCalendarView = () => {
        if (courseOffersLoading) {
            return (
                <div className="flex justify-center items-center py-12">
                    <Spinner />
                </div>
            );
        }

        const calendarCourses = getCalendarCourses();

        return (
            <div className="px-2 sm:px-4">
                <CalendarView courses={calendarCourses} />
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

        // Determine which offers to show
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

                        // Check if this offer is linked to a booking
                        const isLinkedToBooking = offer.booking_id !== null;
                        const linkedBooking = offer.booking; // This should come from the API response

                        return (
                            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                                {/* Conditional Badge based on booking status */}
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
                                    {/* Placeholder for missing images */}
                                    <div className="w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500 hidden">
                                        <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                        </svg>
                                    </div>
                                </div>
                                
                                {/* Card Content */}
                                <div className="p-4">
                                    <h3 className="font-semibold text-lg text-gray-900 mb-2">{course.title}</h3>
                                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{course.description || 'Experience this exciting course designed for all skill levels.'}</p>
                                    
                                    {/* Date Information */}
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
                                        
                                        {/* Show booking information if linked */}
                                        {isLinkedToBooking && (
                                            <div className="flex justify-between text-sm border-t pt-2 mt-2">
                                                <span className="text-gray-500">Booking ID:</span>
                                                <span className="text-blue-600 font-medium">
                                                    {linkedBooking?.reference_id || offer.booking_id}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Conditional Action Buttons */}
                                    <div className="flex gap-2">
                                        <span 
                                            className="flex-1 text-sm cursor-pointer hover:text-blue-800 transition-colors underline py-2"
                                            style={{ color: '#00467F' }}
                                            onClick={() => console.log(`View details for course offer: ${offer.id}`)}
                                        >
                                            View Details
                                        </span>
                                        <div className="flex-1">
                                            {isLinkedToBooking ? (
                                                // Show "View Booking" button if already linked
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
                                                // Show "Book Now" button if available
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

                {/* View All Button */}
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

                {/* Show Less Button - when all are displayed */}
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
                        {/* Special Offer Badge */}
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
                            {/* Placeholder for missing images */}
                            <div className={`w-full h-48 bg-gray-200 flex items-center justify-center text-gray-500 ${promotion.imageUrl ? 'hidden' : ''}`}>
                                <svg className="w-12 h-12" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                </svg>
                            </div>
                        </div>
                        
                        {/* Card Content */}
                        <div className="p-4">
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">{promotion.title}</h3>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{promotion.description}</p>
                            
                            {/* Promotion Information */}
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
                            <div className="grid grid-cols-1 md:grid-cols-12 pt-2">
                            {/* Left column taking 6 of 12 columns - tabs aligned to the left */}
                                <div className="md:col-span-6 flex justify-center md:justify-start items-center mb-4 md:mb-0">
                                    <TabButton 
                                        tabs={tabs} 
                                        activeTab={activeTab} 
                                        onChange={setActiveTab} 
                                        type="outline"
                                        borderRadius="4px"
                                    />
                                </div>
                                
                                {/* Right column taking 6 of 12 columns - button pushed to the far right */}
                                {/* Show ADD BOOKING button for all tabs */}
                                <div className="md:col-span-6 flex justify-center md:justify-end items-center">
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

                    {/* Main content centered */}
                    <div className="px-4 sm:px-6 py-4 sm:py-6">
                        <div className="max-w-7xl mx-auto">
                            {/* Conditional Content based on active tab */}
                            {activeTab === 0 && renderBookingCards(upcomingBookings)}
                            {activeTab === 1 && renderBookingCards(pastBookings)}
                            {activeTab === 2 && renderCalendarView()}
                        </div>
                    </div>

                    {/* Course Offers Section with background - only show when not on calendar tab */}
                    {activeTab !== 2 && (
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

                    {/* Promotions and Special Offers Section - only show when not on calendar tab */}
                    {activeTab !== 2 && (
                        <div className="py-8 sm:py-12">
                            <div className="max-w-7xl mx-auto px-4 sm:px-6">
                                <div className="text-center mb-6 sm:mb-8">
                                    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">PROMOTIONS AND SPECIAL OFFERS</h2>
                                    <p className="text-sm text-gray-600 max-w-2xl mx-auto">
                                        Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum
                                    </p>
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
                </div>
            )}
        </Layout>
    );
}