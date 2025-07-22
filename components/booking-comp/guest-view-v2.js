import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { useRouter } from "next/router";
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import Modal from "../ui/modal";
import StatusBadge from "../ui-v2/StatusBadge";

const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../ui/spinner'));
const Button = dynamic(() => import('../ui-v2/Button'));
const TabButton = dynamic(() => import('../ui-v2/TabButton'));
const ThumbnailCard = dynamic(() => import('../ui-v2/ThumbnailCard'));

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

    const tabs = [
        { label: "UPCOMING BOOKINGS" },
        { label: "PAST BOOKINGS" }
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
                }
            }, 800);
        }
    }

    const handleCheckPrevBookingStatus = async () => {
        setLoading(true);
        const data = {
            guestId: user.id
        };

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
                handleBookNow();
            }
        }
    }

    const handleBookNow = async () => {
        setLoading(true);
        const data = {
            guestId: user.id
        };

        const response = await fetch("/api/bookings/book-now/create", {
            method: "POST",
            body: JSON.stringify(data)
        });

        if (response.ok) {
            const newBooking = await response.json();
            if (newBooking) {
                fetchBookings(); // to refresh the list
                const brf = await createBookingRequestForm(newBooking.id);

                if (brf.ok) {
                    setLoading(false);
                    setTimeout(() => {
                        if (bookings.length > 0 && newBooking.prevBookingId) {
                            window.open(`/booking-request-form?uuid=${newBooking.uuid}&prevBookingId=${newBooking.prevBookingId}`, '_self');
                        } else {
                            window.open(`/booking-request-form?uuid=${newBooking.uuid}`, '_self');
                        }
                    }, 500);
                }
            }
        } else {
            setLoading(false);
            toast.error("Something went wrong. Unable to create booking at the moment.")
        }
    }

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
            const updatedBookingList = [];
            const promise = await new Promise(async (resolve, reject) => {
                if (bookingList) {
                    const response = await Promise.all(bookingList.map(async (b) => {
                        let booking = { ...b };
                        if (booking.Rooms.length > 0) {
                            let roomType = booking.Rooms[0]?.RoomType;
                            roomType.img_url = await getRoomImageUrl(roomType);
                            booking.Rooms[0].RoomType = roomType;
                        }
                        updatedBookingList.push(booking);
                    }));

                    resolve(response);
                } else {
                    reject(null);
                }
            });

            if (promise) {
                setTimeout(() => {
                    setBookings(updatedBookingList);
                    const sortedBookings = [...updatedBookingList].sort((a, b) => b.id - a.id);
                    setLatestBooking(sortedBookings[0]);

                    // picking the latest booking that is complete
                    const filteredBookingsList = sortedBookings.filter(booking => booking.complete);

                    if (filteredBookingsList.length) {
                        setPrevBookingUuid(filteredBookingsList[0].uuid);
                    }
                    dispatch(globalActions.setLoading(false));
                    setLoading(false);
                }, 300);
            }
        } catch (error) {
            toast.error("Something went wrong. Unable to fetch bookings at the moment.")
            setLoading(false);
            console.log(error)
        }
    };

    // Add function to load course offers
    const loadCourseOffers = async () => {
        if (!user?.id) return;
        
        setCourseOffersLoading(true);
        try {
            const params = new URLSearchParams({
                guest_id: user.id.toString(),
                status: 'offered', // Only show offered courses in the course offers section
                include_invalid: 'false', // Only show valid offers
                limit: '20'
            });
            
            const response = await fetch(`/api/courses/offers?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to load course offers: ${response.status}`);
            }
            
            const result = await response.json();
            if (result.success) {
                setCourseOffers(result.data || []);
            } else {
                throw new Error(result.message || 'Failed to load course offers');
            }
        } catch (error) {
            console.error('Error loading course offers:', error);
            // Don't show error toast for course offers as it's not critical to the booking functionality
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

    const getBookingTitle = (booking) => {
        if (!booking.Rooms.length) return;
        const room = booking.Rooms[0];
        const roomType = room.RoomType;
        return `${roomType && roomType.name}`;
    }

    const getRoomImageUrl = async (roomType) => {
        const res = await fetch("/api/manage-room/" + roomType.id);
        const data = await res.json();

        return data.url;
    }

    const viewBooking = async (bookingUUID) => {
        window.open(`/bookings/${bookingUUID}`, '_self');
    }

    const editBooking = async (bookingId, bookingUUID, bookingType) => {
        const brf = await createBookingRequestForm(bookingId);

        if (brf.ok) {
            setTimeout(() => {
                if (bookingId && bookingUUID && bookingType === 'Returning Guest' && prevBookingUuid) {
                    window.open(`/booking-request-form?uuid=${bookingUUID}&prevBookingId=${prevBookingUuid}`, '_self');
                } else {
                    window.open(`/booking-request-form?uuid=${bookingUUID}`, '_self');
                }
            }, 800);
        }
    }

    const renderBookingCards = (bookingsToRender) => {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bookingsToRender.length > 0 ? (
                    bookingsToRender.map((booking, index) => {
                        let bookingTitle = getBookingTitle(booking) || "No Room Selected";
                        const bookingStatus = JSON.parse(booking.status);
                        let imageUrl = null;
                        
                        if (booking.Rooms.length > 0 && booking.Rooms[0].RoomType?.img_url) {
                            imageUrl = booking.Rooms[0].RoomType.img_url;
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
                            
                            // Download PDF Button - Download icon
                            customButtons.push(
                                <button 
                                    key="download-pdf"
                                    className="inline-flex items-center justify-center p-2 border border-blue-700 text-blue-700 rounded hover:bg-blue-50 transition-colors"
                                    onClick={() => handleDownloadPDF(booking.id)}
                                    aria-label="Download PDF"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                        <path fillRule="evenodd" d="M12 2.25a.75.75 0 01.75.75v11.69l3.22-3.22a.75.75 0 111.06 1.06l-4.5 4.5a.75.75 0 01-1.06 0l-4.5-4.5a.75.75 0 111.06-1.06l3.22 3.22V3a.75.75 0 01.75-.75zm-9 13.5a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                                    </svg>
                                </button>
                            );
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
                                onButtonClick={() => editBooking(booking.id, booking.uuid, booking.type)}
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

                        return (
                            <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                                {/* Special Offer Badge */}
                                <div className="relative">
                                    <div className="absolute top-3 left-3 z-10">
                                        <StatusBadge 
                                            type="offer" 
                                            label="Special Offer"
                                            size="small"
                                        />
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
                                    </div>
                                    
                                    {/* Action Buttons */}
                                    <div className="flex gap-2">
                                        <span 
                                            className="flex-1 text-sm cursor-pointer hover:text-blue-800 transition-colors underline py-2"
                                            style={{ color: '#00467F' }}
                                            onClick={() => console.log(`View details for course offer: ${offer.id}`)}
                                        >
                                            View Details
                                        </span>
                                        <div className="flex-1">
                                            <Button 
                                                size="small"
                                                color="primary"
                                                label="BOOK NOW"
                                                fullWidth={true}
                                                onClick={() => console.log(`Book course offer: ${offer.id}`)}
                                            />
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
                            className="inline-flex items-center px-6 py-3 border-2 border-[#1B457B] text-[#1B457B]  rounded-lg hover:bg-blue-100 transition-colors font-medium text-sm"
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
        // Sample promotion data matching the screenshot
        const promotions = [
            {
                title: "Complimentary Gym Session",
                description: "Enjoy a complimentary gym session with our adaptive fitness equipment and personal trainer support.",
                availability: "Available all year",
                terms: "Book 3+ nights stay",
                id: "gym-promo",
                image: "/images/gym-session.jpg"
            },
            {
                title: "Confidence Sculpting", 
                description: "Build confidence through our specialized sculpting and pottery classes designed for all skill levels.",
                availability: "Available all year",
                terms: "Book 2+ nights stay",
                id: "sculpting-promo",
                image: "/images/confidence-sculpting.jpg"
            },
            {
                title: "Receive $100 meal voucher",
                description: "Enjoy dining at our restaurant with a complimentary $100 meal voucher for extended stays.",
                availability: "01 Apr, 2025 - 30 Apr, 2025",
                terms: "Book 5+ nights stay",
                id: "meal-voucher",
                image: "/images/meal-voucher.jpg"
            }
        ];

        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {promotions.map((promotion, index) => (
                    <div key={index} className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200">
                        {/* Special Offer Badge */}
                        <div className="relative">
                            <div className="absolute top-3 left-3 z-10">
                                <StatusBadge 
                                    type="offer" 
                                    label="Special Offer"
                                    size="small"
                                />
                            </div>
                            <img 
                                src={promotion.image} 
                                alt={promotion.title}
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
                            <h3 className="font-semibold text-lg text-gray-900 mb-2">{promotion.title}</h3>
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{promotion.description}</p>
                            
                            {/* Promotion Information */}
                            <div className="space-y-1 mb-4">
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Availability:</span>
                                    <span className="text-gray-900">{promotion.availability}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">Terms:</span>
                                    <span className="text-gray-900">{promotion.terms}</span>
                                </div>
                            </div>
                            
                            {/* Action Buttons */}
                            <div className="flex gap-2">
                                <span 
                                    className="flex-1 text-sm cursor-pointer hover:text-blue-800 transition-colors underline py-2"
                                    style={{ color: '#00467F' }}
                                    onClick={() => console.log(`View details for: ${promotion.id}`)}
                                >
                                    View Details
                                </span>
                                <div className="flex-1">
                                    <Button 
                                        size="small"
                                        color="primary"
                                        label="BOOK NOW"
                                        fullWidth={true}
                                        onClick={() => console.log(`Book promotion: ${promotion.id}`)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <Layout title={"My Bookings"} hideSidebar={true}>
            {loading ? (
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            ) : (
                <div>
                    <div className="w-full bg-[#F7F7F7] border-b border-gray-200">
                        <div className="container mx-auto px-6">
                            <div className="grid grid-cols-1 md:grid-cols-12 pt-2">
                            {/* Left column taking 6 of 12 columns - tabs aligned to the left */}
                                <div className="md:col-span-6 flex justify-start items-center mb-4 md:mb-0">
                                    <TabButton 
                                        tabs={tabs} 
                                        activeTab={activeTab} 
                                        onChange={setActiveTab} 
                                        type="outline"
                                        borderRadius="4px"
                                    />
                                </div>
                                
                                {/* Right column taking 6 of 12 columns - button pushed to the far right */}
                                <div className="md:col-span-6 flex justify-center md:justify-end items-center">
                                    <Button 
                                        size="small" 
                                        color="primary" 
                                        label="+ ADD BOOKING" 
                                        onClick={handleCheckPrevBookingStatus}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main content centered */}
                    <div className="px-6 py-6">
                        <div className="max-w-6xl mx-auto">
                            {/* Booking Cards */}
                            {activeTab === 0 ? renderBookingCards(upcomingBookings) : renderBookingCards(pastBookings)}
                        </div>
                    </div>

                    {/* Course Offers Section with background */}
                    <div style={{ background: '#EBECF0' }} className="py-12">
                        <div className="max-w-6xl mx-auto px-6">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">MY COURSE OFFERS</h2>
                                <p className="text-gray-600 text-sm max-w-2xl mx-auto">
                                    Try something new or revisit an old favourite. All course content is designed to be enjoyable, educational and easy to follow regardless of experience.
                                </p>
                            </div>
                            {renderOfferCards()}
                        </div>
                    </div>

                    {/* Promotions and Special Offers Section */}
                    <div className="py-12">
                        <div className="max-w-6xl mx-auto px-6">
                            <div className="text-center mb-8">
                                <h2 className="text-2xl font-bold text-gray-800 mb-2">PROMOTIONS AND SPECIAL OFFERS</h2>
                                <p className="text-gray-600 text-sm max-w-2xl mx-auto">
                                    Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum Lorem ipsum
                                </p>
                            </div>
                            {renderPromotionCards()}
                        </div>
                    </div>

                    {showWarningNewBooking && 
                        <Modal 
                            title="Warning!"
                            titleColor="text-yellow-500"
                            description="You have an incomplete booking. Would you like to complete before making a new booking?"
                            modalHide={() => setShowWarningNewBooking(false)}
                            onClose={() => {
                                setShowWarningNewBooking(false);
                                handleCompletePrevBooking();
                            }}
                            cancelLabel="Complete Booking"
                            cancelColor="text-sargood-blue"
                            onConfirm={(e) => {
                                handleBookNow();
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