import Image from 'next/image';
import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import moment from "moment";
import { guestActions } from "../../store/guestSlice";
import Select from "./../ui/select"
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';
import { Can } from '../../services/acl/can';
import { useDebouncedCallback } from 'use-debounce';
import { globalActions } from '../../store/globalSlice';
import DateField from '../fields/date';
const CalendarComponent = dynamic(() => import('../ui/calendar'));

const AssetAvailability = ({ setShowModal }) => {
    const dispatch = useDispatch();
    const guestList = useSelector(state => state.guest.list);
    const asset = useSelector(state => state.assets.data);
    const [bookingEquipments, setBookingEquipments] = useState([]);
    const [displayDate, setDisplayDate] = useState(moment().format("MMMM YYYY"));
    const [selectedMonth, setSelectedMonth] = useState(moment().month());
    const [selectedYear, setSelectedYear] = useState(moment().year());
    const [dateRange, setDateRange] = useState({ from: null, to: null });

    const prevMonth = () => {
        let prevMonth = selectedMonth - 1;
        let prevYear = selectedYear;
        if (prevMonth < 0) {
            prevMonth = 11;
            prevYear = prevYear - 1;
            setSelectedMonth(prevMonth);
            setSelectedYear(prevYear);
        }

        setSelectedMonth(prevMonth);
        setDisplayDate(moment([prevYear, prevMonth]).format("MMMM YYYY"));
    }

    const nextMonth = () => {
        let nextMonth = selectedMonth + 1;
        let nextYear = selectedYear;
        if (nextMonth > 11) {
            nextMonth = 0;
            nextYear = nextYear + 1;
            setSelectedMonth(nextMonth);
            setSelectedYear(nextYear);
        }

        setSelectedMonth(nextMonth);
        setDisplayDate(moment([nextYear, nextMonth]).format("MMMM YYYY"));
    }

    const handleImageError = (e) => {
        e.target.onError = null;
        e.target.src = "/no-image-placeholder.png";
    }

    const handleSaveBookEquipment = async (selected) => {
        // check if bookingId already link to this asset and the date should be now or future
        // set date range here
        if (selected) {
            const exist = bookingEquipments.find(b => b.bookingId === selected.bookingId);
            if (exist) {
                toast.error("This guest has already booked this asset on the same booking.");
            } else {
                const from = moment(selected.arrivalDate).format('DD/MM/YYYY');
                const to = moment(selected.departureDate).format('DD/MM/YYYY');
                setDateRange({ from: from, to: to });
                const data = {
                    booking_id: selected.bookingId,
                    equipment_id: asset.id,
                    created_at: new Date(),
                    updatedAt: new Date()
                }

                const response = await fetch("/api/equipments/book-equipment", {
                    method: 'POST',
                    body: JSON.stringify(data),
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok) {
                    fetchData();
                    setDateRange({ from: null, to: null });
                    toast.success("Guest successfully booked this asset.");
                }
            }
        }
    }

    const fetchData = async () => {
        const response = await fetch("/api/equipments/get-asset-data?assetId=" + asset.id)

        if (response.ok) {
            const dataResponse = await response.json();
            const data = [];
            dataResponse.data.map(a => {
                a?.Bookings.map(booking => {
                    const guestName = booking.Guest?.first_name + ' ' + booking.Guest?.last_name;
                    data.push({
                        from: moment(booking.BookingEquipment.start_date).format('DD/MM/YYYY'),
                        departure: moment(booking.BookingEquipment.end_date).format('DD/MM/YYYY'),
                        guest: guestName,
                        bookingId: booking.id,
                        ...booking.BookingEquipment,
                    });
                });
            });
            setBookingEquipments(data);
        }
    }

    const fetchGuest = async () => {
        const response = await fetch("/api/equipments/get-booking-guest");

        if (response.ok) {
            const dataResponse = await response.json();

            const data = [];
            dataResponse.data.map(bg => {
                data.push({ value: bg.Guest.uuid, label: `${bg.Guest.first_name} ${bg.Guest.last_name}`, bookingId: bg.id, arrivalDate: bg.preferred_arrival_date, departureDate: bg.preferred_departure_date });
            });

            dispatch(guestActions.setList(data));
        }
    }

    useEffect(() => {
        let mounted = true;

        if (asset) {
            mounted && fetchData();
            mounted && fetchGuest();
        }

        return (() => {
            mounted = false;
        });
    }, [asset]);


    const debounceUpdateBookingEquipmentDates = useDebouncedCallback((range, equipment) => {
        dispatch(globalActions.setLoading(true));

        // check range to not be more than a year or less than a year in the past from now
        const start_date = range.split(' - ')[0];
        const end_date = range.split(' - ')[1];

        if (moment(start_date).isBefore(moment().subtract(1, 'year')) || moment(end_date).isAfter(moment().add(1, 'year'))) {
            toast.error("Date range should not be more than a year in the past or future");
            dispatch(globalActions.setLoading(false));
            return;
        }

        // check if start is before end
        if (moment(start_date).isAfter(moment(end_date))) {
            toast.error("Start date should not be after end date.");
            dispatch(globalActions.setLoading(false));
            return;
        }

        updatebookingEquipmentDates(range, equipment)
        dispatch(globalActions.setLoading(false));
    }, 3000);

    const updatebookingEquipmentDates = async (range, equipment) => {
        const start_date = range.split(' - ')[0];
        const end_date = range.split(' - ')[1];

        // Validate that both dates exist and are not empty
        if (!start_date || !end_date || start_date.trim() === '' || end_date.trim() === '') {
            toast.error("Both start and end dates are required.");
            dispatch(globalActions.setLoading(false));
            return;
        }

        // Create moment objects and validate them
        const startMoment = moment(start_date);
        const endMoment = moment(end_date);

        // Check if dates are valid
        if (!startMoment.isValid()) {
            toast.error("Start date is invalid. Please enter a valid date.");
            dispatch(globalActions.setLoading(false));
            return;
        }

        if (!endMoment.isValid()) {
            toast.error("End date is invalid. Please enter a valid date.");
            dispatch(globalActions.setLoading(false));
            return;
        }

        // Check if dates haven't changed (existing logic)
        if (startMoment.isSame(moment(equipment.start_date).format('YYYY-MM-DD')) &&
            endMoment.isSame(moment(equipment.end_date).format('YYYY-MM-DD'))) {
            dispatch(globalActions.setLoading(false));
            return;
        }

        try {
            const response = await fetch(`/api/equipments/update-date-range`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    booking_id: equipment.booking_id,
                    equipment_id: equipment.equipment_id,
                    start_date: startMoment.format('YYYY-MM-DD'), // Use formatted valid date
                    end_date: endMoment.format('YYYY-MM-DD'),     // Use formatted valid date
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchData();
                toast("Equipment dates updated successfully.", { type: 'success' });
            } else {
                toast.error(data.message || "Failed to update equipment dates.");
            }
        } catch (error) {
            console.error('Error updating booking equipment dates:', error);
            toast.error("An error occurred while updating the dates.");
        } finally {
            dispatch(globalActions.setLoading(false));
        }
    }

    return (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowModal(false)}>
            <div className="flex items-center justify-center">
                <div className="bg-white rounded-xl shadow-lg p-4 mt-4 max-w-[70%] max-h-[90%]" onClick={(e) => e.stopPropagation()}>
                    <div className="pt-4 px-4 pb-1">
                        {asset && (
                            <div className="text-center">
                                <div className='flex flex-col'>
                                    <div className='flex justify-between items-center font-bold'>
                                        <h1 className="page-title">Assets Availability</h1>
                                        <div className='flex'>
                                            <span className='text-xl text-sargood-blue my-auto'>{asset.name}</span>
                                            <div className="rounded-full w-32 h-32 relative group">
                                                <Image className="rounded-full" alt="Equipment Photo" src={asset.url ? asset.url : ''} onError={handleImageError} layout="fill" objectFit="cover" />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex flex-row justify-center my-auto">
                                        <span onClick={prevMonth} className="cursor-pointer">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="black" strokeWidth="2" />
                                                <path d="M13.5 8L9.5 12L13.5 16" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                        <span className="px-4 my-auto w-fit">{displayDate} </span>
                                        <span onClick={nextMonth} className="cursor-pointer">
                                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                                <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="black" strokeWidth="2" />
                                                <path d="M10.5 8L14.5 12L10.5 16" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </span>
                                    </div>
                                    <hr className='my-4' />
                                    <div className='flex flex-row justify-between p-2 font-sans'>
                                        <div className='w-[60%] max-h-[450px] overflow-y-scroll shadow-sm p-1'>
                                            <table className='table-fixed w-11/12'>
                                                <thead className=''>
                                                    <tr>
                                                        <th className='py-8 text-left bg-slate-400 font-bold rounded-tl-2xl text-neutral-700'><span className='ml-2'>Asset Booking Dates</span></th>
                                                        <th className='py-8 text-left bg-slate-400 font-bold rounded-tr-2xl text-neutral-700'>Guest</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {bookingEquipments.map((be, index) =>
                                                        <tr key={index} className='even:bg-gray-100'>
                                                            <td className='py-4'>
                                                                <DateField type="date-range"
                                                                    value={be.start_date ? `${moment(be.start_date).format("YYYY-MM-DD")} - ${moment(be.end_date).format("YYYY-MM-DD")}` : ''}
                                                                    onChange={(e) => debounceUpdateBookingEquipmentDates(e, be)}
                                                                />
                                                            </td>
                                                            <td className='text-left py-4'><span className='ml-1'>{be.guest}</span></td>
                                                        </tr>)}
                                                </tbody>
                                            </table>
                                            <Can I="Create/Edit" a="Equipment">
                                                <div className='w-96'>
                                                    <Select options={guestList} placeholder="Add New Guest"
                                                        onChange={handleSaveBookEquipment}
                                                        styles={{
                                                            control: (base, state) => ({
                                                                ...base,
                                                                border: 0,
                                                                borderBottom: '1px solid #d5d5d5',
                                                                borderRadius: 0,
                                                                boxShadow: 'none'
                                                            })
                                                        }} />
                                                </div>
                                            </Can>

                                        </div>
                                        <div className='w-[30%]'>
                                            <CalendarComponent title="Availability" showExtraDays={false} selectedMonth={selectedMonth} selectedYear={selectedYear} data={bookingEquipments} />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                        <div className="flex justify-end space-x-4 mt-8">
                            <button className="font-semibold bg-zinc-100 rounded py-2 px-4" onClick={() => setShowModal(false)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default AssetAvailability;