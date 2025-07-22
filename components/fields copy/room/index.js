import { useCallback, useEffect, useState } from "react";
import Radio from "../radioButton";
import Image from "next/image";
import Room from "./room";
import { useDispatch } from "react-redux";
import { bookingRequestFormActions } from "../../../store/bookingRequestFormSlice";
import { useSelector } from "react-redux";

const RoomsField = (props) => {
    const dispatch = useDispatch();
    const isNdisFunded = useSelector(state => state.bookingRequestForm.isNdisFunded);
    const [roomtTypesList, setRoomTypesList] = useState([]);
    const [roomTypes, setRoomTypes] = useState([]);
    const [studioRooms, setStudioRooms] = useState([]);
    const [upgrade, setUpgrade] = useState(false);
    const [selectedRooms, setSelectedRooms] = useState(() => {
        if (!props.value) return [];
        try {
            return typeof props.value === "string" ? JSON.parse(props.value) : props.value;
        } catch (e) {
            console.error('Error parsing selectedRooms:', e);
            return [];
        }
    });
    const [additionalRooms, setAdditionalRooms] = useState([]);
    
    // Add validation state
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [additionalRoomErrors, setAdditionalRoomErrors] = useState({});

    // Validation function
    const validateRooms = (rooms = selectedRooms) => {
        let hasError = false;
        
        if (props.required) {
            // Check if no rooms are selected or if the first room is empty
            const hasValidSelection = rooms && rooms.length > 0 && rooms[0] && rooms[0].name;
            
            if (!hasValidSelection) {
                setError(true);
                setErrorMsg('Please select at least one room.');
                hasError = true;
            } else {
                setError(false);
                setErrorMsg('');
            }
        } else {
            setError(false);
            setErrorMsg('');
        }

        // Check if there are any additional room errors (don't validate content here, just check if errors exist)
        const hasAdditionalErrors = Object.keys(additionalRoomErrors).length > 0;
        if (hasAdditionalErrors) {
            hasError = true;
        }
        
        return !hasError;
    };

    // Call parent onChange with value and error (similar to phone/email fields)
    const notifyParent = (value, hasError = false) => {
        if (props.onChange) {
            // Only pass main room error, not additional room errors (they show on individual rooms)
            const errorMessage = hasError ? errorMsg : null;
            // If the parent expects error as second parameter (like phone/email fields)
            if (props.onChange.length > 1) {
                props.onChange(value, errorMessage);
            } else {
                // Original behavior for compatibility
                props.onChange(value);
            }
        }
    };

    useEffect(() => {
        if (selectedRooms?.length > 1) {
            const tempRooms = structuredClone(selectedRooms);
            tempRooms.shift();
            const additionalRooms = tempRooms.map((room, idx) => ({
                ...room,
                order: room.order || idx + 2
            }));
            setAdditionalRooms(additionalRooms);
        }
    }, [selectedRooms]);

    useEffect(() => {
        let tempStudioRooms = [];

        if (roomTypes.length > 0) {
            for (const index in roomTypes) {
                tempStudioRooms.push(roomTypes[index]);
            };
    
            tempStudioRooms.sort((a, b) => { return a.id - b.id });
        }

        setStudioRooms(tempStudioRooms);
    }, [roomTypes]);

    useEffect(() => {
        fetchRoomTypes();
    }, []);

    // Validate when props change
    useEffect(() => {
        if (props.required) {
            validateRooms();
        }
    }, [props.required, selectedRooms, additionalRooms]);

    // Handle external error prop
    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMsg(props.error);
        }
    }, [props.error]);

    const fetchRoomTypes = useCallback(async () => await fetch("/api/manage-room")
        .then((res) => res.json())
        .then((data) => {
            const updatedRooms = data.map((room) => {
                return { ...room.data, imageUrl: room.image_url, value: false } 
            }).filter(room => room != null);
            updatedRooms.sort((a, b) => { return a.id - b.id });
            setRoomTypesList(updatedRooms);
            
            const updatedData = data
                .map((room) => ({
                    ...room.data,
                    imageUrl: room.image_url,
                    value: selectedRooms?.length > 0 
                        ? selectedRooms[0]?.name === room.data.name
                        : false
                }))
                .filter(room => {
                    if (isNdisFunded) {
                        return room.type === 'studio' || room.type === 'ocean_view';
                    }
                    return true;
                });

            consolidateSelectedRooms(selectedRooms, updatedData);
            setRoomTypes(updatedData);
    }), [selectedRooms]);

    const handleChange = (label) => {
        const newOptions = roomTypes && roomTypes.map((option) => {
            if (option.name === label) {
                if (option.type == 'studio') {
                    setUpgrade(false);
                }
                return { ...option, value: true };
            } else {
                return { ...option, value: false };
            }
        });

        setRoomTypes(newOptions);
        if (props.hasOwnProperty('onChange')) {
            let tempRooms = [{ name: label, order: 1 }];
            if (additionalRooms.length > 0) {
                tempRooms.push(...additionalRooms);
            } 

            tempRooms = tempRooms.filter(room => room != null && room.name != null ).map((room, index) => {
                return { name: room.name, order: room?.order ? room.order : index + 1 };
            });
            
            consolidateSelectedRooms(tempRooms);
            
            // Validate the new selection
            const isValid = validateRooms(tempRooms);
            setSelectedRooms(tempRooms);
            
            // Notify parent with validation result
            notifyParent(JSON.stringify(tempRooms), !isValid);
        }
    };

    const openUpgradeList = (label) => {
        if (label) {
            const newOptions = roomTypes && roomTypes.map((option) => {
                return { ...option, value: false };
            });
    
            let tempRooms;
            if (additionalRooms.length > 0) {
                tempRooms = [{ name: label, order: 1 }, ...additionalRooms].filter(room => room != null && room.name != null );
            } else {
                tempRooms = [{ name: label, order: 1 }];
            }
            
            // Validate the new selection
            const isValid = validateRooms(tempRooms);
            setSelectedRooms(tempRooms);
            
            // Notify parent with validation result
            notifyParent(JSON.stringify(tempRooms), !isValid);
        }

        setUpgrade(true);

        setStudioRooms(studioRooms.map((option) => {
            if (option.type == 'upgrade') {
                return { ...option, value: true };
            } else {
                return { ...option, value: false };
            }
        }));
    };

    const removeAdditionalRoom = (index) => {
        let tempAdditionalRooms = [...additionalRooms];
        tempAdditionalRooms.splice(index, 1);
        setAdditionalRooms(tempAdditionalRooms);
        
        // Clear any errors for removed room
        const newErrors = { ...additionalRoomErrors };
        delete newErrors[index];
        // Re-index remaining errors
        const reindexedErrors = {};
        Object.keys(newErrors).forEach(key => {
            const keyInt = parseInt(key);
            if (keyInt > index) {
                reindexedErrors[keyInt - 1] = newErrors[key];
            } else {
                reindexedErrors[key] = newErrors[key];
            }
        });
        setAdditionalRoomErrors(reindexedErrors);
    };

    const addRoom = () => {
        setAdditionalRooms([...additionalRooms, { name: '', order: additionalRooms.length + 2 }])
    };

    const handleAdditionalRoomChange = (value, index, error) => {
        let tempAdditionalRooms = [...additionalRooms];
        tempAdditionalRooms[index] = { 
            name: value,
            order: tempAdditionalRooms[index]?.order || index + 2
        };
        setAdditionalRooms(tempAdditionalRooms);
        
        // Handle error for this specific additional room
        const newErrors = { ...additionalRoomErrors };
        if (error) {
            newErrors[index] = error;
        } else {
            delete newErrors[index];
        }
        setAdditionalRoomErrors(newErrors);
        
        // Don't trigger parent onChange if there are errors in additional rooms
        const hasAdditionalErrors = error || Object.keys(newErrors).length > 0;
        if (!hasAdditionalErrors) {
            // Only update parent if no errors
            setTimeout(() => {
                if (props.hasOwnProperty('onChange') && roomTypes.length > 0) {
                    let tempRooms = roomTypes.filter((option) => option.value);
                    if (tempAdditionalRooms.length > 0) {
                        tempRooms.push(...tempAdditionalRooms);
                    }
                    tempRooms = tempRooms.map((room, index) => {
                        if (room) {
                            return { name: room.name, order: index + 1 }
                        }
                    });
                    consolidateSelectedRooms(tempRooms);
                    const isValid = validateRooms(tempRooms);
                    setSelectedRooms(tempRooms);
                    notifyParent(JSON.stringify(tempRooms), !isValid);
                }
            }, 0);
        }
    };

    useEffect(() => {
        // Only trigger onChange if there are no errors in additional rooms
        const hasAdditionalErrors = Object.keys(additionalRoomErrors).length > 0;
        
        if (props.hasOwnProperty('onChange') && roomTypes.length > 0 && !hasAdditionalErrors) {
            let tempRooms = roomTypes.filter((option) => option.value);

            if (additionalRooms.length > 0) {
                tempRooms.push(...additionalRooms);
            }

            tempRooms = tempRooms.map((room, index) => {
                if (room) {
                    return { name: room.name, order: index + 1 }
                }
            });

            consolidateSelectedRooms(tempRooms);
            
            // Validate the selection
            const isValid = validateRooms(tempRooms);
            setSelectedRooms(tempRooms);
            
            // Notify parent with validation result (only if no additional room errors)
            notifyParent(JSON.stringify(tempRooms), !isValid);
        }
    }, [additionalRooms, additionalRoomErrors]);

    const consolidateSelectedRooms = (rooms, roomTypeArr = []) => {
        const roomTypesArr = roomTypeArr.length > 0 ? roomTypeArr : roomTypes;
        const selectedRoomData = [];
        rooms.filter(room => room && room.name).map((room, index) => {
            const roomType = roomTypesArr.find(r => r.name === room.name);
            if (roomType) {
                selectedRoomData.push({
                    room: roomType.name,
                    type: index === 0 ? roomType.type : 'upgrade',
                    price: roomType.price_per_night,
                    peak_rate: roomType.peak_rate
                });
            }
        });
        dispatch(bookingRequestFormActions.setRooms(selectedRoomData));
    };

    // Use external error if provided, otherwise use internal error state
    const displayError = props.error || error;
    const displayErrorMsg = props.error || errorMsg;

    return (
        <div className="mb-2">
            {/* initial ui to allow selection of the default room included with the booking - part 1
                    an upgrade option is also available for the user to upgrade the included room to a better one. */}
            <div className="mb-2">
                {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
                {props.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                <div className="flex flex-col">
                    {studioRooms && studioRooms.map((option, index) => {
                        let priceLabel = option.price_per_night ? `Included in your package price` : '';
                        if (index > 1) {
                            priceLabel = `Your package Price + Out of pocket fee of $${option.price_per_night}/night`;

                            if (option.peak_rate && option.peak_rate > 0) {
                                priceLabel = `${priceLabel} ($${option.peak_rate}/night Peak Period)`;
                            }
                        }
                        return (
                            option.type == 'upgrade' ?
                                <div key={index} onClick={() => openUpgradeList()} className={`ml-4 flex flex-col md:flex-row lg:flex-row xl:flex-row items-center p-1 py-6 hover:cursor-pointer ${index % 2 == 0 ? "bg-white" : "bg-gray-50"}`}>
                                    <Radio label={option.name} value={option.value} checked={option.value}
                                        onChange={() => { }} disabled={props.disabled}
                                        builder={props.builder ? props.builder : false} index={index}
                                        updateOptionLabel={props.updateOptionLabel} handleRemoveOption={props.handleRemoveOption} />
                                </div> :
                                <div key={index} onClick={() => handleChange(option.name)} className={`ml-4 flex flex-col md:flex-row lg:flex-row xl:flex-row space-x-4 items-start p-1 py-6 hover:bg-gray-100 hover:cursor-pointer ${index % 2 == 0 ? "bg-white" : "bg-gray-50"}`}>
                                    <Radio label={option.name} hideLabel={false} value={option.value} checked={option.value}
                                        onChange={handleChange} disabled={props.disabled} boldLabel={true}
                                        builder={false} index={index}
                                        updateOptionLabel={props.updateOptionLabel} handleRemoveOption={props.handleRemoveOption} />
                                    <div className="w-full grid grid-cols-12 gap-4">
                                        <h3 className="hidden md:block lg:block xl:block col-span-12 font-bold md:text-lg">{option.name}</h3>
                                        <div className="col-span-3">
                                            <Image src={`${option.imageUrl ? option.imageUrl : '/rooms-placeholder.png'}`} width={150} height={150} alt={option.name} className="w-full h-auto" />
                                        </div>
                                        <div className="col-span-9">
                                            <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">Bedrooms</p>
                                                    <p className="mt-1 text-base">{option.bedrooms}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">Bathrooms</p>
                                                    <p className="mt-1 text-base">{option.bathrooms}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">Ergonomic King Beds</p>
                                                    <p className="mt-1 text-base">{option.ergonomic_king_beds}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">King Single Beds</p>
                                                    <p className="mt-1 text-base">{option.king_single_beds}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">Max Guests</p>
                                                    <p className="mt-1 text-base">{option.max_guests}</p>
                                                </div>
                                                <div className="text-left">
                                                    <p className="text-sm text-slate-400">Queen Sofa Beds</p>
                                                    <p className="mt-1 text-base">{option.queen_sofa_beds}</p>
                                                </div>
                                            </div>
                                            <div className="mt-6">
                                                <p className="text-sm text-slate-400">Price</p>
                                                <p className="mt-1 text-base">{priceLabel}</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                        )
                    })
                    }
                    {upgrade && roomTypes && roomTypes.map((option, index) => {
                        let priceLabel = option.price_per_night ? `Included in your package price` : '';
                        if (index > 1) {
                            priceLabel = `Your package Price + Out of pocket fee of $${option.price_per_night}/night`;

                            if (option.peak_rate && option.peak_rate > 0) {
                                priceLabel = `${priceLabel} ($${option.peak_rate}/night Peak Period)`;
                            }
                        }
                        return (
                            option.type != 'studio' && <div key={index} onClick={() => handleChange(option.name)} className={`ml-4 flex flex-col md:flex-row lg:flex-row xl:flex-row space-x-4 items-start p-1 py-6 hover:bg-gray-100 hover:cursor-pointer ${index % 2 == 0 ? "bg-white" : "bg-gray-50"}`}>
                                <Radio label={option.name} hideLabel={false} value={option.value} checked={option.value}
                                    onChange={handleChange} disabled={props.disabled} boldLabel={true}
                                    builder={false} index={index}
                                    updateOptionLabel={props.updateOptionLabel} handleRemoveOption={props.handleRemoveOption} />
                                <div className="w-full grid grid-cols-12 gap-4">
                                    <h3 className="hidden md:block lg:block xl:block col-span-12 font-bold md:text-lg">{option.name}</h3>
                                    <div className="col-span-3">
                                        <Image src={`${option.imageUrl ? option.imageUrl : '/rooms-placeholder.png'}`} width={150} height={150} alt={option.name} className="w-full h-auto" />
                                    </div>
                                    <div className="col-span-9">
                                        <div className="grid grid-cols-3 gap-x-8 gap-y-6">
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">Bedrooms</p>
                                                <p className="mt-1 text-base">{option.bedrooms}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">Bathrooms</p>
                                                <p className="mt-1 text-base">{option.bathrooms}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">Ergonomic King Beds</p>
                                                <p className="mt-1 text-base">{option.ergonomic_king_beds}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">King Single Beds</p>
                                                <p className="mt-1 text-base">{option.king_single_beds}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">Max Guests</p>
                                                <p className="mt-1 text-base">{option.max_guests}</p>
                                            </div>
                                            <div className="text-left">
                                                <p className="text-sm text-slate-400">Queen Sofa Beds</p>
                                                <p className="mt-1 text-base">{option.queen_sofa_beds}</p>
                                            </div>
                                        </div>
                                        <div className="mt-6">
                                            <p className="text-sm text-slate-400">Price</p>
                                            <p className="mt-1 text-base">{priceLabel}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>)
                    })
                    }
                </div>
                {/* Display error message */}
                {displayError && <p className="mt-1.5 text-red-500 text-xs">{displayErrorMsg}</p>}
            </div>

            {/*
                ui that allows user to select 1 of 6 rooms as a 2nd, 3rd or nth room for the booking. - part 2    
            */}
            {(additionalRooms.length <= 0 && !props?.disabled) && <div className="bg-sky-800 px-4 py-2 text-white rounded-md w-fit cursor-pointer" onClick={() => addRoom()}>+ Add another room</div>}
            <div>
                {additionalRooms.map((room, index) => {
                    return <Room key={index}
                        index={index}
                        value={room}
                        additionalRoomsLength={additionalRooms.length}
                        roomTypes={roomtTypesList}
                        required={true} // Always require selection for additional rooms that are added
                        error={additionalRoomErrors[index]}
                        addRoom={() => addRoom()}
                        removeRoom={() => removeAdditionalRoom(index)}
                        onChange={(value, options, error) => handleAdditionalRoomChange(value, index, error)}
                    />
                })}
            </div>
        </div>
    )
}

export default RoomsField;