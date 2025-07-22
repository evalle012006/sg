import _ from "lodash";
import Box from "./box"
import Image from "next/image";
import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import moment from "moment";
import { useDebouncedCallback } from "use-debounce";
import { globalActions } from "../../store/globalSlice"
import { Can } from "../../services/acl/can";
import DateField from "../fields/date";

function AssetsAndEquipment(props) {
    const { equipmentsData, bookingId } = props;
    const [equipments, setEquipments] = useState(equipmentsData);
    const [editMode, setEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [newEquipments, setNewEquipments] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const dispatch = useDispatch();

    useEffect(() => {
        setEquipments(equipmentsData);
    }, [equipmentsData]);

    useEffect(() => {
        if (equipments.length > 0)
            fetchEquipmentsAvailability(equipments);
    }, []);

    const fetchEquipmentsAvailability = async (equipments) => {
        const response = await fetch(`/api/equipments/availability`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                equipments: equipments,
                bookingId: bookingId
            })
        });

        const data = await response.json();

        setEquipments(data);
    }

    const removeEquipment = async (equipment) => {
        const response = await fetch(`/api/equipments/book-equipment`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking_id: bookingId,
                equipment_id: equipment.id
            })
        });


        if (response.ok) {
            toast("Equipment removed successfully.", { type: 'success' });
            const newEquipments = equipments.filter(e => e.id != equipment.id);
            setEquipments(newEquipments);
        }

    }

    const fetchNewEquipments = async () => {
        const response = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: false }), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        setSearchResults(data);
        setNewEquipments(data);
    }

    const searchNewEquipments = async () => {
        if (searchQuery.length == 0) {
            setSearchResults(newEquipments);
        } else {
            const filteredResults = searchResults.filter(result => result.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                result.EquipmentCategory.name.toLowerCase().includes(searchQuery.toLowerCase()));
            setSearchResults(filteredResults);
        }

    }

    useEffect(() => {
        searchNewEquipments();
    }, [searchQuery]);

    const addEquipmentToBooking = async (equipment) => {
        setSearchQuery('');
        const response = await fetch(`/api/equipments/book-equipment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                booking_id: bookingId,
                equipment_id: equipment.id
            })
        });

        const data = await response.json();
        if (data.success) {
            fetchEquipmentsAvailability([...equipments, equipment]);
        }
        toast("Equipment added successfully.", { type: 'success' });
    }

    const debounceUpdateBookingEquipmentDates = useDebouncedCallback((range, equipment) => {
        dispatch(globalActions.setLoading(true));

        // Basic range validation first
        if (!range || typeof range !== 'string' || !range.includes(' - ')) {
            toast.error("Invalid date range format");
            dispatch(globalActions.setLoading(false));
            return;
        }

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

        // Check if start is before end
        if (startMoment.isAfter(endMoment)) {
            toast.error("Start date should not be after end date.");
            dispatch(globalActions.setLoading(false));
            return;
        }

        updatebookingEquipmentDates(range, equipment);
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
                    booking_id: bookingId,
                    equipment_id: equipment.id,
                    start_date: startMoment.format('YYYY-MM-DD'), // Use formatted valid date
                    end_date: endMoment.format('YYYY-MM-DD'),     // Use formatted valid date
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchEquipmentsAvailability(equipments);
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

    return <>
        <div className="flex justify-between">
            <h1 className="text-2xl text-sargood-blue font-bold mb-5">Assets & Equipment</h1>
            <Can I="Create/Edit" a="Booking">
                <div onClick={() => setEditMode(!editMode)} className="cursor-pointer">
                    {editMode ? <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                        : <Image
                            alt=""
                            src={"/icons/edit.png"}
                            width={30}
                            height={30}
                        />}
                </div>
            </Can>
        </div>
        {editMode ? <div>
            <table className="w-full">
                <thead>
                    <tr className="bg-slate-400">
                        <th className="text-left p-8 px-6 rounded-tl-lg">Asset, Serial Number</th>
                        <th className="text-left p-8 px-6">Date Range</th>
                        <th className="text-left p-8 px-6 w-24"></th>
                        <th className="text-left p-8 px-6 rounded-tr-lg"></th>
                    </tr>
                </thead>
                <tbody>
                    {equipments.map((equipment, index) => {
                        return <tr key={index} className={index % 2 ? 'bg-zinc-100' : ''}>
                            <td className="p-4 px-6">{`${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`}</td>
                            <td className="p-4 px-6">
                                <DateField type="date-range"
                                    value={equipment.start_date ? moment(equipment.start_date).format('YYYY-MM-DD') + ' - ' + moment(equipment.end_date).format('YYYY-MM-DD') : null}
                                    onChange={(range) => debounceUpdateBookingEquipmentDates(range, equipment)} />
                            </td>
                            <td className={`p-4 px-6 font-bold ${equipment.available ? 'text-green-500' : 'text-red-500'}`}>{equipment.available ? <Image
                                alt=""
                                src={"/icons/check-green.png"}
                                width={20}
                                height={20}
                            /> : <Image
                                alt=""
                                src={"/icons/cancel-red.png"}
                                width={20}
                                height={20}
                            />}</td>
                            <td className="p-4 px-6">
                                <div title={`Remove ${equipment.name}`}>
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        fill="none"
                                        viewBox="0 0 24 24"
                                        strokeWidth="1.5"
                                        stroke="currentColor"
                                        className="w-5 h-5 cursor-pointer"
                                        onClick={() => removeEquipment(equipment)}
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                        />
                                    </svg>
                                </div>
                            </td>
                        </tr>
                    })}
                    <tr>
                        <td className="relative">
                            <input className="p-4 px-6 focus:outline-none" placeholder="Add Asset"
                                value={searchQuery}
                                onFocus={(e) => {
                                    e.target.placeholder = "Type to search"
                                    if (newEquipments.length == 0) {
                                        fetchNewEquipments();
                                    }
                                    setShowSearch(true)
                                }}
                                onChange={(e) => {
                                    setSearchQuery(e.target.value);
                                }} />
                            {showSearch && <div className="absolute z-50 bg-white rounded w-full shadow-lg border border-slate-200 max-h-48 overflow-y-scroll">
                                {searchResults.map((result, index) => {

                                    return (<p key={index} onClick={() => addEquipmentToBooking(result)} className="hover:bg-slate-100 p-2 px-4 cursor-pointer text-lg">{result.name} - {result.serial_number}</p>)
                                })}
                            </div>}
                            {showSearch && <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)}></div>}
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
            :
            <Box>
                {equipments.length > 0 ? equipments.map((equipment, index) => {
                    return <div key={index} className="flex space-x-2 py-2">
                        {equipment.available ? <div>
                            <Image
                                alt=""
                                src={"/icons/check-green.png"}
                                width={20}
                                height={20}
                            />
                        </div> :
                            <div>
                                <Image
                                    alt=""
                                    src={"/icons/cancel-red.png"}
                                    width={20}
                                    height={20}
                                />
                            </div>}
                        <div>
                            <p>{equipment.name + ', Serial Number ' + equipment.serial_number}</p>
                            {equipment.start_date && <p className="text-sm bg-slate-200 rounded-full w-fit p-2 py-1">{moment(equipment.start_date).format('DD / MM / YYYY')} - {moment(equipment.end_date).format('DD / MM / YYYY')}</p>}
                        </div>
                    </div>
                }) : <p>No equipment added.</p>}
            </Box>}
    </>
}

export default AssetsAndEquipment;