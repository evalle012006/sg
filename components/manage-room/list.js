import React, { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { roomTypeActions } from '../../store/roomTypeSlice';
import { handleResponse } from '../../utilities/api/responseHandler';

import dynamic from 'next/dynamic';
import { checkFileSize } from '../../utilities/common';
const RoomTypePhoto = dynamic(() => import('./room-photo'));
const Modal = dynamic(() => import('../ui/modal'));

const RoomField = ({ detail, index, room, onValueChange, disabled = false }) => {
    const [fieldValue, setFieldValue] = useState(detail.value);

    useEffect(() => {
        setFieldValue(detail.value);
    }, [detail.value]);

    const handleChange = (value) => {
        setFieldValue(value);
        onValueChange(value, detail.field, index);
    };

    if (detail.field === 'ocean_view') {
        return (
            <div className='flex flex-row justify-center text-center'>
                <div className='flex flex-row mr-2'>
                    <input 
                        type="radio" 
                        name={`ocean_view-${index}`} 
                        value={1} 
                        id={`ocean_view_yes-${index}`} 
                        checked={parseInt(fieldValue) === 1}
                        onChange={(e) => handleChange(e.target.value)} 
                    />
                    <label className='ml-1' htmlFor={`ocean_view_yes-${index}`}>Yes</label>
                </div>
                <div className='flex flex-row'>
                    <input 
                        type="radio" 
                        name={`ocean_view-${index}`} 
                        value={0} 
                        id={`ocean_view_no-${index}`} 
                        checked={parseInt(fieldValue) === 0}
                        onChange={(e) => handleChange(e.target.value)} 
                    />
                    <label className='ml-1' htmlFor={`ocean_view_no-${index}`}>No</label>
                </div>
            </div>
        );
    } else if (detail.field === 'price_per_night' || detail.field === 'peak_rate') {
        return (
            <div className='flex flex-row justify-center'>
                <input 
                    className='w-2/3 border-b border-zinc-300 text-center outline-none' 
                    min={0} 
                    type="number" 
                    value={fieldValue}
                    onChange={(e) => handleChange(e.target.value)} 
                    disabled={disabled && detail.field === 'peak_rate'}
                />
            </div>
        );
    } else {
        return (
            <div className='flex flex-row justify-center'>
                <input 
                    className='w-1/3 border-b border-zinc-300 text-center outline-none' 
                    min={0} 
                    type="number" 
                    value={fieldValue}
                    onChange={(e) => handleChange(e.target.value)} 
                />
            </div>
        );
    }
};

const RoomTypeList = ({ refreshData }) => {
    const dispatch = useDispatch();
    const roomTypeData = useSelector(state => state.roomType.list);
    const [roomList, setRoomList] = useState([]);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState();
    const [modifiedRoomIds, setModifiedRoomIds] = useState(new Set());
    const [pendingChanges, setPendingChanges] = useState({});

    useEffect(() => {
        setRoomList(roomTypeData);
    }, [roomTypeData]);

    const handleAddNew = () => {
        const newRoom = {
            type: "",
            name: "New Room",
            ergonomic_king_beds: 0,
            king_single_beds: 0,
            queen_sofa_beds: 0,
            bedrooms: 0,
            bathrooms: 0,
            ocean_view: 0,
            max_guests: 0,
            price_per_night: 0,
            flag: "new",
            uploading: false,
            peak_rate: 0,
        };

        setRoomList(prev => [newRoom, ...prev]);
    };

    const handleSaveNewRoom = async (room) => {
        const response = await fetch('/api/manage-room/add-update', {
            method: 'POST',
            body: JSON.stringify(room),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const roomResp = await handleResponse(response);

        if (roomResp.success) {
            toast.success("Successfully added new room.");
            refreshData();
        }
    };

    const handleSaveChanges = async (room) => {
        if (modifiedRoomIds.has(room.id)) {
            const updatedRoom = {
                ...room,
                ...pendingChanges[room.id],
                peak_rate: pendingChanges[room.id].peak_rate ? pendingChanges[room.id].peak_rate : 0,
            };

            const response = await fetch('/api/manage-room/add-update', {
                method: 'POST',
                body: JSON.stringify(updatedRoom),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                toast.success("Successfully saved changes.");
                
                // Update roomList with the saved changes
                setRoomList(prev => prev.map(r => 
                    r.id === room.id ? updatedRoom : r
                ));

                // Remove the saved room from tracking states
                setModifiedRoomIds(prev => {
                    const newSet = new Set(prev);
                    newSet.delete(room.id);
                    return newSet;
                });

                setPendingChanges(prev => {
                    const newChanges = { ...prev };
                    delete newChanges[room.id];
                    return newChanges;
                });
            }
        }
    };

    const updateRoomImage = async (e, room, index) => {
        if (room.hasOwnProperty('id')) {
            const file = e.target.files[0];
            const formData = new FormData();

            const fileSizeMsg = checkFileSize(file.size, 5120000);
            if (fileSizeMsg) {
                toast.error(fileSizeMsg);
            } else {
                formData.append("fileType", "room-type-photo");
                formData.append("file", file);

                const response = await fetch("/api/storage/room-type-photo?id=" + room.id, {
                    method: "POST",
                    body: formData,
                });
                const data = await response.json();

                if(response.status === 413){
                    toast.error("File size is too large. Please upload a file with a maximum size of 5MB.");
                } else {
                    const updatedRoom = { ...room, image_url: data.imageUrl };
                    setRoomList(prev => prev.map((r, idx) => 
                        idx === index ? updatedRoom : r
                    ));
                }
            }
        } else {
            toast.warning('Save this room first before adding an image.');
        }
        e.target.value = null;
    };

    const updateValue = (value, field, index) => {
        const room = roomList[index];
        
        if (!room) return;

        if (field !== "name" && field !== "ocean_view" && value < 0) {
            toast.error("Invalid value, not allowed negative value.");
            return;
        }

        const updatedRoom = { ...room };
        updatedRoom[field] = value ? value : 0;

        if (field === "name" && room.flag === "new") {
            updatedRoom.type = value.replace(" ", "_").toLowerCase();
        }

        setRoomList(prev => prev.map((r, idx) => 
            idx === index ? updatedRoom : r
        ));

        // If it's an existing room, track the changes
        if (room.id) {
            setPendingChanges(prev => ({
                ...prev,
                [room.id]: {
                    ...(prev[room.id] || {}),
                    [field]: value
                }
            }));
            setModifiedRoomIds(prev => new Set(prev).add(room.id));
        }
    };

    const handleBeforeDelete = (e, selected) => {
        e.stopPropagation();
        setSelectedRoom(selected);
        setShowWarningModal(true);
    };

    const handleDelete = async (e, selected, mode) => {
        e.stopPropagation();

        if (selected) {
            if (mode === "new") {
                setRoomList(prev => prev.filter(r => r.name !== selected.name));
            } else {
                const response = await fetch('/api/manage-room/delete/', { 
                    method: 'DELETE', 
                    body: JSON.stringify(selected) 
                });
                if (response.ok) {
                    setShowWarningModal(false);
                    toast.success('Selected room was successfully deleted.');
                    setRoomList(prev => prev.filter(r => r.id !== selected.id));
                    dispatch(roomTypeActions.setList(roomList.filter(r => r.id !== selected.id)));
                }
            }
        }
    };

    return (
        <div className='h-full'>
            <div className='flex flex-col w-full overflow-hidden'>
                <div className='flex flex-row justify-end'>
                    <button className='border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' onClick={handleAddNew}>+ Add New</button>
                </div>
                <div className='flex flex-col justify-start'>
                    {roomList.map((room, index) => {
                        const roomDetails = [
                            { header: "Ergonomic King Single Beds", value: room.ergonomic_king_beds, field: "ergonomic_king_beds" },
                            { header: "King Single Beds", value: room.king_single_beds, field: "king_single_beds" },
                            { header: "Queen Sofa Beds", value: room.queen_sofa_beds, field: "queen_sofa_beds" },
                            { header: "Bedrooms", value: room.bedrooms, field: "bedrooms" },
                            { header: "Bathrooms", value: room.bathrooms, field: "bathrooms" },
                            { header: "Ocean View", value: room.ocean_view ? room.ocean_view : 0, field: "ocean_view" },
                            { header: "Max Guests", value: room.max_guests, field: "max_guests" },
                            { header: "Price per Night (AUD)", value: room.price_per_night, field: "price_per_night" },
                            { header: "Peak Rate (AUD)", value: room.peak_rate, field: "peak_rate" },
                        ];

                        return (
                            <div key={index} className={`flex flex-col p-4 my-6 border border-zinc-400 rounded group ${room.flag === "new" && 'border-2 border-sargood-blue'}`}>
                                <div className='flex flex-row justify-end' style={{ "marginTop": "-1rem" }}>
                                    {room.flag === "new" ? (
                                        <React.Fragment>
                                            <button className='mr-2 border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' onClick={() => handleSaveNewRoom(room)}>Save</button>
                                            <button className='border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' onClick={(e) => handleDelete(e, room, "new")}>Remove</button>
                                        </React.Fragment>
                                    ) : (
                                        <React.Fragment>
                                            {modifiedRoomIds.has(room.id) && (
                                                <button 
                                                    className='mr-2 border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white'
                                                    onClick={() => handleSaveChanges(room)}
                                                >
                                                    Save Changes
                                                </button>
                                            )}
                                            <button 
                                                className='border border-gray-400 p-2 rounded text-sm mt-2 hover:bg-sargood-blue hover:text-white' 
                                                onClick={(e) => handleBeforeDelete(e, room)}
                                            >
                                                Delete
                                            </button>
                                        </React.Fragment>
                                    )}
                                </div>
                                <div className='flex flex-row justify-start'>
                                    <RoomTypePhoto index={index} room={room} updateRoomImage={updateRoomImage} />
                                    <div className='flex flex-col ml-8'>
                                        <div className='text-xl font-bold mb-4'>
                                            <input 
                                                type="text" 
                                                value={room.name} 
                                                className="w-1/2 border-b border-zinc-300 outline-none"
                                                onChange={(e) => updateValue(e.target.value, "name", index)} 
                                            />
                                        </div>
                                        <div className='flex flex-row text-base'>
                                            {roomDetails.map((detail, idx) => (
                                                <div key={idx} className="grid grid-rows-3 gap-2">
                                                    <span className='row-span-2 text-center'>
                                                        {detail.header}
                                                    </span>
                                                    <RoomField 
                                                        detail={detail} 
                                                        index={index}
                                                        room={room}
                                                        onValueChange={updateValue}
                                                        disabled={room.type === 'studio'}
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {showWarningModal && (
                    <Modal 
                        title="Delete selected room?"
                        description="Selected room will be permanently removed."
                        onClose={() => {
                            setSelectedRoom(null);
                            setShowWarningModal(false);
                        }}
                        onConfirm={(e) => {
                            handleDelete(e, selectedRoom, 'existing');
                            setShowWarningModal(false);
                        }} 
                    />
                )}
            </div>
        </div>
    );
};

export default RoomTypeList;