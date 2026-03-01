import _ from "lodash";
import Box from "./box"
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useDispatch } from "react-redux";
import { toast } from "react-toastify";
import moment from "moment";
import { useDebouncedCallback } from "use-debounce";
import { globalActions } from "../../store/globalSlice"
import { Can } from "../../services/acl/can";
import DateField from "../fields/date";
import dynamic from 'next/dynamic';

// Import the Button component
const Button = dynamic(() => import('../ui-v2/Button'));

function AssetsAndEquipment(props) {
    const { equipmentsData, bookingId } = props;
    const [equipments, setEquipments] = useState(equipmentsData);
    const [editMode, setEditMode] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [newEquipments, setNewEquipments] = useState([]);
    const [searchResults, setSearchResults] = useState([]);
    const [loadingEquipments, setLoadingEquipments] = useState(false);
    const [commodeNeedsTilt, setCommodeNeedsTilt] = useState(false);
    const dispatch = useDispatch();

    // Helper function to check if equipment is a High Back Tilt commode
    const isHighBackTiltCommode = (equipment) => {
        return equipment.name && equipment.name.toLowerCase().includes('commode') && 
               equipment.name.toLowerCase().includes('high back tilt');
    };

    // Check for commode tilt confirmation on mount and when equipmentsData changes
    useEffect(() => {
        const hasTilt = equipmentsData.some(eq => 
            eq.name && eq.name.toLowerCase().includes('confirm need to tilt commode')
        );
        setCommodeNeedsTilt(hasTilt);
        setEquipments(equipmentsData);
    }, [equipmentsData]);

    useEffect(() => {
        if (equipments.length > 0)
            fetchEquipmentsAvailability(equipments);
    }, []);

    // Use useMemo to filter out hidden equipment - this ensures stable reference
    const displayEquipments = useMemo(() => {
        return equipments.filter(eq => 
            !(eq.name && eq.name.toLowerCase().includes('confirm need to tilt commode'))
        );
    }, [equipments]);

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
            
            // ⭐ AUDIT LOG: Equipment Removed
            try {
                await fetch(`/api/bookings/${bookingId}/equipment-audit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'removed',
                        equipment_id: equipment.id,
                        equipment_name: equipment.name,
                        serial_number: equipment.serial_number,
                        category: equipment.EquipmentCategory?.name
                    })
                });
            } catch (auditError) {
                console.error('Failed to log equipment removal:', auditError);
            }
        }
    }

    const fetchNewEquipments = async () => {
        setLoadingEquipments(true);
        try {
            const response = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: false }), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            setNewEquipments(data);
            // FIX: Set initial search results after fetch completes
            // This will be filtered by the useEffect below if there's a searchQuery
            setSearchResults(data);
        } catch (error) {
            console.error('Error fetching equipment:', error);
            toast.error('Failed to load equipment');
        } finally {
            setLoadingEquipments(false);
        }
    }

    const searchNewEquipments = () => {
        if (searchQuery.length == 0) {
            setSearchResults(newEquipments);
        } else {
            // FIX: Filter from newEquipments (the full list) instead of searchResults
            const filteredResults = newEquipments.filter(result => {
                const nameMatch = result.name?.toLowerCase().includes(searchQuery.toLowerCase());
                const categoryMatch = result.EquipmentCategory?.name?.toLowerCase().includes(searchQuery.toLowerCase());
                return nameMatch || categoryMatch;
            });
            console.log('🔍 Search query:', searchQuery);
            console.log('📦 Filtered results count:', filteredResults.length);
            console.log('👁️ Show search state:', showSearch);
            setSearchResults(filteredResults);
        }
    }

    // Re-run search when searchQuery changes
    useEffect(() => {
        searchNewEquipments();
    }, [searchQuery]);

    // FIX: Re-run search when newEquipments is populated (after fetch completes)
    // This handles the race condition where user types before fetch completes
    useEffect(() => {
        if (newEquipments.length > 0 && searchQuery.length > 0) {
            searchNewEquipments();
        }
    }, [newEquipments]);

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
            
            // ⭐ AUDIT LOG: Equipment Added
            try {
                await fetch(`/api/bookings/${bookingId}/equipment-audit`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'added',
                        equipment_id: equipment.id,
                        equipment_name: equipment.name,
                        serial_number: equipment.serial_number,
                        category: equipment.EquipmentCategory?.name
                    })
                });
            } catch (auditError) {
                console.error('Failed to log equipment addition:', auditError);
            }
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
                    start_date: startMoment.format('YYYY-MM-DD'),
                    end_date: endMoment.format('YYYY-MM-DD'),
                })
            });

            const data = await response.json();
            if (data.success) {
                fetchEquipmentsAvailability(equipments);
                toast("Equipment dates updated successfully.", { type: 'success' });
                
                // ⭐ AUDIT LOG: Equipment Dates Changed
                try {
                    await fetch(`/api/bookings/${bookingId}/equipment-audit`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            action: 'dates_changed',
                            equipment_id: equipment.id,
                            equipment_name: equipment.name,
                            old_start_date: moment(equipment.start_date).format('YYYY-MM-DD'),
                            old_end_date: moment(equipment.end_date).format('YYYY-MM-DD'),
                            new_start_date: startMoment.format('YYYY-MM-DD'),
                            new_end_date: endMoment.format('YYYY-MM-DD')
                        })
                    });
                } catch (auditError) {
                    console.error('Failed to log equipment date change:', auditError);
                }
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
        <>
            <div className="flex justify-end items-center mb-6">
                <Can I="Create/Edit" a="Booking">
                    <Button
                        color={editMode ? "secondary" : "primary"}
                        size="medium"
                        label={editMode ? "SAVE CHANGES" : "MANAGE EQUIPMENT"}
                        onClick={() => setEditMode(!editMode)}
                        className="min-w-[160px] transition-all duration-200"
                    />
                </Can>
            </div>

            {/* Equipment Content */}
            {editMode ? (
                <div className="bg-white border border-gray-200 rounded-lg" style={{ overflow: 'visible' }}>
                    {/* Edit Mode Alert */}
                    <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
                        <div className="flex items-center space-x-2">
                            <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></div>
                            <span className="text-sm font-medium text-blue-800">
                                Edit Mode Active - Make your changes and click &quot;Save Changes&quot; when done
                            </span>
                        </div>
                    </div>

                    <div style={{ overflow: 'visible' }}>
                        <table className="w-full">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                    <th className="text-left p-4 px-6 font-semibold text-gray-700">Asset, Serial Number</th>
                                    <th className="text-left p-4 px-6 font-semibold text-gray-700">Date Range</th>
                                    <th className="text-left p-4 px-6 w-24 font-semibold text-gray-700">Status</th>
                                    <th className="text-left p-4 px-6 w-20 font-semibold text-gray-700">Action</th>
                                </tr>
                            </thead>
                            <tbody style={{ overflow: 'visible' }}>
                            {displayEquipments.map((equipment, index) => {
                                const showTiltNote = isHighBackTiltCommode(equipment) && commodeNeedsTilt;
                                
                                return (
                                    <tr key={index} className={`border-b border-gray-100 hover:bg-gray-50 ${index % 2 ? 'bg-gray-25' : 'bg-white'}`}>
                                        <td className="p-4 px-6">
                                            <div className="font-medium text-gray-900">
                                                {`${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`}
                                            </div>
                                            {showTiltNote && (
                                                <div className="mt-2 inline-flex items-center px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200">
                                                    <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-sm font-medium text-blue-800">
                                                        Needs to tilt over toilet
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 px-6">
                                            <DateField 
                                                type="date-range"
                                                value={equipment.start_date ? moment(equipment.start_date).format('YYYY-MM-DD') + ' - ' + moment(equipment.end_date).format('YYYY-MM-DD') : null}
                                                onChange={(range) => debounceUpdateBookingEquipmentDates(range, equipment)} 
                                            />
                                        </td>
                                        <td className="p-4 px-6">
                                            {equipment.available ? (
                                                <div className="flex items-center space-x-2">
                                                    <Image
                                                        alt="Available"
                                                        src={"/icons/check-green.png"}
                                                        width={20}
                                                        height={20}
                                                    />
                                                    <span className="text-sm text-green-600 font-medium">Available</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center space-x-2">
                                                    <Image
                                                        alt="Unavailable"
                                                        src={"/icons/cancel-red.png"}
                                                        width={20}
                                                        height={20}
                                                    />
                                                    <span className="text-sm text-red-600 font-medium">Unavailable</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 px-6">
                                            <button
                                                title={`Remove ${equipment.name}`}
                                                className="p-2 rounded-md text-red-600 hover:bg-red-50 hover:text-red-800 transition-colors duration-150"
                                                onClick={() => removeEquipment(equipment)}
                                            >
                                                <svg
                                                    xmlns="http://www.w3.org/2000/svg"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    strokeWidth="1.5"
                                                    stroke="currentColor"
                                                    className="w-5 h-5"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
                                                    />
                                                </svg>
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                            <tr className="border-b border-gray-100">
                                <td className="relative p-0" style={{ overflow: 'visible' }}>
                                    {/* Backdrop overlay - render FIRST so dropdown appears above it */}
                                    {showSearch && (
                                        <div 
                                            className="fixed inset-0 z-40" 
                                            onClick={() => {
                                                setShowSearch(false);
                                                setSearchQuery('');
                                            }}
                                        />
                                    )}
                                    
                                    <input 
                                        className="w-full p-4 px-6 focus:outline-none focus:bg-blue-50 border-2 border-transparent focus:border-blue-200 rounded-md" 
                                        placeholder="Add Equipment - Start typing to search..."
                                        value={searchQuery}
                                        onFocus={(e) => {
                                            e.target.placeholder = "Type equipment name or category to search"
                                            if (newEquipments.length == 0) {
                                                fetchNewEquipments();
                                            }
                                            setShowSearch(true)
                                        }}
                                        onChange={(e) => {
                                            setSearchQuery(e.target.value);
                                        }} 
                                    />
                                    
                                    {/* Dropdown - render AFTER overlay so it appears on top */}
                                    {showSearch && (
                                        <div className="absolute left-0 right-0 z-50 bg-white rounded-lg shadow-lg border border-gray-200 max-h-64 overflow-y-auto mt-1">
                                            {loadingEquipments ? (
                                                <div className="p-4 text-center text-gray-500">
                                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
                                                    Loading equipment...
                                                </div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map((result, index) => (
                                                    <div 
                                                        key={index} 
                                                        onClick={() => {
                                                            addEquipmentToBooking(result);
                                                            setShowSearch(false);
                                                        }} 
                                                        className="hover:bg-blue-50 p-3 px-4 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
                                                    >
                                                        <div className="font-medium text-gray-900">{result.name}</div>
                                                        <div className="text-sm text-gray-600">Serial: {result.serial_number}</div>
                                                        <div className="text-xs text-gray-500 mt-1">Category: {result.EquipmentCategory?.name}</div>
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-gray-500">
                                                    {searchQuery ? 'No equipment found matching your search' : 'No equipment available'}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </td>
                                <td colSpan="3" className="p-4 px-6 text-sm text-gray-500">
                                    Search for equipment to add to this booking
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    </div>
                </div>
            ) : (
                // View Mode
                <Box>
                    {displayEquipments.length > 0 ? (
                        <div className="space-y-3">
                            {displayEquipments.map((equipment, index) => {
                                const showTiltNote = isHighBackTiltCommode(equipment) && commodeNeedsTilt;
                                
                                return (
                                    <div key={index} className="flex items-start space-x-3 py-3 border-b border-gray-100 last:border-b-0">
                                        <div className="flex-shrink-0 mt-0.5">
                                            {equipment.available ? (
                                                <Image
                                                    alt="Available"
                                                    src={"/icons/check-green.png"}
                                                    width={20}
                                                    height={20}
                                                />
                                            ) : (
                                                <Image
                                                    alt="Unavailable"
                                                    src={"/icons/cancel-red.png"}
                                                    width={20}
                                                    height={20}
                                                />
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-900">
                                                {equipment.name}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                Serial Number: {equipment.serial_number || 'N/A'}
                                            </p>
                                            {equipment.start_date && (
                                                <div className="mt-2">
                                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                                        {moment(equipment.start_date).format('DD/MM/YYYY')} - {moment(equipment.end_date).format('DD/MM/YYYY')}
                                                    </span>
                                                </div>
                                            )}
                                            {showTiltNote && (
                                                <div className="mt-2 inline-flex items-center px-3 py-1.5 rounded-md bg-blue-50 border border-blue-200">
                                                    <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                    </svg>
                                                    <span className="text-sm font-medium text-blue-800">
                                                        Needs to tilt over toilet
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <div className="text-gray-400 mb-3">
                                <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                                </svg>
                            </div>
                            <p className="text-gray-500 text-lg font-medium">No equipment assigned</p>
                            <p className="text-gray-400 text-sm mt-1">Click &quot;Manage Equipment&quot; to add equipment to this booking</p>
                        </div>
                    )}
                </Box>
            )}
        </>
    )
}

export default AssetsAndEquipment;