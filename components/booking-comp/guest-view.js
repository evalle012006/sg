import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import moment from "moment";
import { useRouter } from "next/router";
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import ActionDropDown from "./action-dropdown";
import Modal from "../ui/modal";
const Layout = dynamic(() => import('../layout'));
const Spinner = dynamic(() => import('../ui/spinner'));
const Button = dynamic(() => import('../ui/button'));
const BookingStatus = dynamic(() => import('../booking-comp/booking-status'));

export default function GuestBookings() {
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
                    updatedBookingList = updatedBookingList.sort((a, b) => { return b.id - a.id });
                    setLatestBooking(updatedBookingList[0]);

                    // picking the latest booking that is complete
                    const filteredBookingsList = updatedBookingList.filter(booking => booking.complete);

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

    return (
        <Layout title={"My Bookings"}>
            {loading ? (
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            ) : (
                <div className="p-6 md:p-16">
                    <div className="grid grid-cols-6 gap-2 w-full">
                        <div className="flex col-span-6 justify-end pt-6 pb-2">
                            <button className="w-full md:w-fit px-10 py-2 mr-6 bg-emerald-500 text-white rounded-md font-bold" onClick={handleCheckPrevBookingStatus}>New Booking</button>
                        </div>
                    </div>

                    <div className="mb-16">
                        <h4 className="text-xl font-bold text-sky-800">Upcoming Bookings</h4>
                        {upcomingBookings.length > 0 ? upcomingBookings.map((booking, index) => {
                            let bookingTitle = getBookingTitle(booking);
                            const bookingStatus = JSON.parse(booking.status);
                            const bookingComplete = booking.complete ? booking.complete : false;
                            let noRoomSelected = false;
                            if (!bookingTitle || bookingTitle === 'null') {
                                bookingTitle = 'No room selected';
                                noRoomSelected = true;
                            }
                            const editBooking = async (bookingId, bookingUUID, bookingType) => {
                                const brf = await createBookingRequestForm(bookingId);

                                if (brf.ok) {
                                    setTimeout(() => {
                                        if (bookingComplete == false && latestBooking.uuid && bookingType === 'Returning Guest' && prevBookingUuid) {
                                            window.open(`/booking-request-form?uuid=${bookingUUID}&prevBookingId=${prevBookingUuid}`, '_self');
                                        } else {
                                            window.open(`/booking-request-form?uuid=${bookingUUID}`, '_self');
                                        }
                                    }, 800);
                                }

                            }
                            let checkinDate = '-';
                            let checkoutDate = '-';

                            if (booking.check_in_date) {
                                checkinDate = moment(booking.check_in_date).format('DD/MM/YYYY');
                            } else if (booking.preferred_arrival_date) {
                                checkinDate = moment(booking.preferred_arrival_date).format('DD/MM/YYYY');
                            }

                            if (booking.check_out_date) {
                                checkoutDate = moment(booking.check_out_date).format('DD/MM/YYYY');
                            } else if (booking.preferred_departure_date) {
                                checkoutDate = moment(booking.preferred_departure_date).format('DD/MM/YYYY');
                            }

                            let roomSelected;
                            if (booking.Rooms.length > 0) {
                                roomSelected = booking.Rooms[0];
                            }

                            return (<div key={index} className="grid grid-cols-12 max-w-5xl divide-y-2 my-6 divide-gray-200">
                                <div className={`col-span-12 md:col-span-3 ${!noRoomSelected && 'mt-4'}`}>
                                    {noRoomSelected ? (
                                        <div className="border border-zinc-300 flex justify-center py-[6.3rem] text-2xl font-bold">
                                            No Room Selected
                                        </div>
                                    ) :
                                        <Image className="rounded-lg" src={`${roomSelected.RoomType?.image_filename ? roomSelected.RoomType.img_url : '/rooms-placeholder.png'}`} alt="" width={600} height={520} />
                                    }
                                </div>
                                <div className="col-span-12 md:col-span-9 md:ml-4 pt-5">
                                    <div>
                                        <div className={`w-full md:flex ${bookingStatus.name == 'booking_confirmed' && 'items-center'}`}>
                                            <div className="flex flex-col md:flex-row text-center items-center justify-center md:justify-between w-full">
                                                <div className="w-full flex flex-row text-center items-center align-middle md:items-start md:text-left">
                                                    <h3 className={`w-full items-center capitalize text-2xl font-bold ${noRoomSelected ? 'text-gray-400 italic' : 'text-sky-800'}`}>{bookingTitle}</h3>
                                                </div>
                                                <div className="w-full flex flex-col mt-2 md:mt-0 md:flex-row justify-between items-center">
                                                    {booking.complete ? <BookingStatus status={bookingStatus} guestView={true} /> : <div></div>}
                                                    <div className="flex gap-2 items-center ml-4 w-full md:w-fit">
                                                        <div className={`w-full md:w-fit mt-2 md:mt-0 ${(bookingStatus.name == 'booking_cancelled' || bookingStatus.name == 'guest_cancelled') ? 'hidden' : ''}`}>
                                                            <Button buttonClass={"w-full md:w-fit my-auto px-4 bg-yellow-400 hover:bg-sky-900 hover:text-white leading-4"} label={`${booking.complete ? 'Request to Amend' : 'Complete Booking'}`} onClick={() => editBooking(booking.id, booking.uuid, booking.type)} />
                                                        </div>
                                                        {!bookingStatus.name.includes('cancelled') && (
                                                            <ActionDropDown options={[
                                                                {
                                                                    label: "View Booking",
                                                                    action: () => {
                                                                        viewBooking(booking.uuid)
                                                                    },
                                                                    hidden: false,
                                                                    icon: () => <svg className="mr-1 w-6 h-6" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" strokeWidth="3" stroke="#000000" fill="none">
                                                                        <path d="M53.79,33.1a.51.51,0,0,0,0-.4C52.83,30.89,45.29,17.17,32,16.84S11,30.61,9.92,32.65a.48.48,0,0,0,0,.48C11.1,35.06,19.35,48.05,29.68,49,41.07,50,50.31,42,53.79,33.1Z"/><circle cx="31.7" cy="32.76" r="6.91"/>
                                                                    </svg>
                                                                },
                                                                {
                                                                    label: "Download Summary of Stay",
                                                                    action: () => {
                                                                      handleDownloadPDF(booking.uuid);
                                                                    },
                                                                    hidden: bookingStatus.name != 'booking_confirmed' ? true : false,
                                                                    icon: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                                    </svg>
                                                    
                                                                },
                                                                {
                                                                    label: "Cancel Booking",
                                                                    action: () => {
                                                                        handleCancelBooking(booking.uuid);
                                                                    },
                                                                    hidden: false,
                                                                    icon: () => <svg className="mr-2 w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                                        <circle cx="12" cy="12" r="9" stroke="#222222" />
                                                                        <path d="M18 18L6 6" stroke="#222222" />
                                                                    </svg>
                                                                }
                                                            ]} />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap space-y-4 justify-between">
                                            <p className="mt-4">Booking ID: {booking.reference_id}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:grid md:grid-cols-4 gap-4 justify-between">
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" width={24} height={24} />
                                            </div>
                                            <p>Enquiry Date</p>
                                            <p className="font-bold">{moment(booking.createdAt).format('DD/MM/YYYY')}</p>
                                        </div>
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" width={24} height={24} />
                                            </div>
                                            <p>Check-in</p>
                                            <p className="font-bold">{checkinDate}</p>
                                        </div>
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" width={24} height={24} />
                                            </div>
                                            <p>Check-out</p>
                                            <p className="font-bold">{checkoutDate}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>)
                        }) :
                            <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 mb-10 text-sm border w-fit my-8" role="alert">
                                <p>No upcoming bookings</p>
                            </div>}
                    </div>

                    <div className="my-16">
                        <h4 className="text-xl font-bold text-sky-800">Past Bookings</h4>
                        {pastBookings.length > 0 ? pastBookings.map((booking, index) => {
                            let bookingTitle = getBookingTitle(booking);
                            const bookingComplete = booking.complete ? booking.complete : false;
                            let noRoomSelected = false;
                            if (!bookingTitle || bookingTitle === 'null') {
                                bookingTitle = 'No room selected';
                                noRoomSelected = true;
                            }

                            let roomSelected;
                            if (booking.Rooms.length > 0) {
                                roomSelected = booking.Rooms[0];
                            }

                            return (<div key={index} className="grid grid-cols-12 max-w-5xl divide-y-2 my-6 divide-gray-200">
                                <div className={`col-span-12 md:col-span-3 ${!noRoomSelected && 'mt-4'}`}>
                                    {noRoomSelected ? (
                                        <div className="border border-zinc-300 flex justify-center py-[6.3rem] text-2xl font-bold rounded-lg">
                                            No Room Selected
                                        </div>
                                    ) :
                                        <Image className="rounded-lg" src={`${roomSelected.RoomType?.image_filename ? roomSelected.RoomType.img_url : '/rooms-placeholder.png'}`} alt="" width={600} height={520} />
                                    }
                                </div>
                                <div className="col-span-12 md:col-span-9 md:ml-4 pt-5 flex flex-col justify-end">
                                    <div>
                                        <div className="w-full md:flex">
                                            <div className="flex flex-col md:flex-row text-center items-center justify-center md:justify-between w-full">
                                                <div className="w-full flex flex-row text-center items-center align-middle md:items-start md:text-left">
                                                    <h3 className={`w-full items-center capitalize text-2xl font-bold ${noRoomSelected ? 'text-gray-400 italic' : 'text-sky-800'}`}>{bookingTitle}</h3>
                                                </div>
                                                <div className="w-full flex flex-col mt-2 md:mt-0 md:flex-row justify-between items-center md:items-start">
                                                    {(JSON.parse(booking.status)?.name == 'booking_cancelled' || JSON.parse(booking.status)?.name == 'booking_confirmed') ?
                                                        <BookingStatus status={JSON.parse(booking.status)} guestView={true} /> : <div></div>}
                                                    <div className="mt-2 md:mt-0 ">
                                                        <Button buttonClass={"my-auto px-4 bg-zinc-200 hover:bg-zinc-500 hover:text-white"} label={'View Booking'} onClick={() => viewBooking(booking.uuid)} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap space-y-4 justify-between">
                                            <p className="mt-4">Booking ID: {booking.reference_id}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col md:grid md:grid-cols-4 gap-4 justify-between">
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" alt="" width={24} height={24} />
                                            </div>
                                            <p>Enquiry Date</p>
                                            <p className="font-bold">{moment(booking.createdAt).format('DD/MM/YYYY')}</p>
                                        </div>
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" alt="" width={24} height={24} />
                                            </div>
                                            <p>Check-in</p>
                                            <p className="font-bold">{booking.check_in_date ? moment(booking.check_in_date).format('DD/MM/YYYY') : '-'}</p>
                                        </div>
                                        <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg md:w-full">
                                            <div>
                                                <Image className="" src="/icons/check-green.png" alt="" width={24} height={24} />
                                            </div>
                                            <p>Check-out</p>
                                            <p className="font-bold">{booking.check_out_date ? moment(booking.check_out_date).format('DD/MM/YYYY') : '-'}</p>
                                        </div>
                                        {/* <div className="p-4 mt-4 flex flex-col justify-between bg-stone-100 rounded-lg w-full">
                                        <div>
                                            <Image className="" src="/icons/check-green.png" width={24} height={24} />
                                        </div>
                                        <p className="my-2">Paid</p>
                                        <p className="font-bold">$15000<span className="text-xs">.00</span></p>
                                    </div> */}
                                    </div>
                                </div>
                            </div>)
                        }) :
                            <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 mb-10 text-sm border w-fit my-8" role="alert">
                                <p>No past bookings</p>
                            </div>}
                    </div>
                    {showWarningNewBooking && <Modal title="Warning!"
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
                    />}
                </div>
            )}
        </Layout>
    );
}