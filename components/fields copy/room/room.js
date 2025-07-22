import { useEffect, useState } from "react";
import Radio from "../radioButton";
import Image from "next/image";
import ordinal from "ordinal";
import { useSelector } from "react-redux";

const RoomField = (props) => {
    const [roomTypes, setRoomTypes] = useState(props.roomTypes);
    const isNdisFunded = useSelector(state => state.bookingRequestForm.isNdisFunded);
    
    // Add validation state
    const [error, setError] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    // Validation function
    const validateRoom = (selectedValue = props.value) => {
        if (props.required) {
            // Check if a room is selected for this additional room
            const hasValidSelection = selectedValue && selectedValue.name && selectedValue.name.trim() !== '';
            
            if (!hasValidSelection) {
                setError(true);
                setErrorMsg('Please select a room.');
                return false;
            } else {
                setError(false);
                setErrorMsg('');
                return true;
            }
        }
        setError(false);
        setErrorMsg('');
        return true;
    };

    // Call parent onChange with value and error
    const notifyParent = (value, newOptions, hasError = false) => {
        if (props.onChange) {
            const errorMessage = hasError ? errorMsg : null;
            // Check if parent expects error handling (similar to other field components)
            if (props.onChange.length > 2) {
                props.onChange(value, newOptions, errorMessage);
            } else {
                // Original behavior for compatibility
                props.onChange(value, newOptions);
            }
        }
    };

    useEffect(() => {
        if (props.hasOwnProperty('roomTypes')) {
            const updatedData = props.roomTypes.filter(room => room.type === 'studio').map((room) => {
                if (props.value) {
                    return { ...room, value: props.value.name === room.name };
                } else {
                    return { ...room, value: false };
                }
            });
            setRoomTypes(updatedData);
        }
    }, [props.roomTypes]);

    // Validate when props change
    useEffect(() => {
        if (props.required) {
            validateRoom();
        }
    }, [props.required, props.value]);

    // Handle external error prop
    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMsg(props.error);
        }
    }, [props.error]);

    const handleChange = (label) => {
        const newOptions = roomTypes && roomTypes.map((option) => {
            if (option.name === label) {
                return { ...option, value: true };
            } else {
                return { ...option, value: false };
            }
        });
        
        setRoomTypes(newOptions);
        
        if (props.hasOwnProperty('onChange')) {
            // Create the new value object
            const newValue = { name: label };
            
            // Validate the new selection
            const isValid = validateRoom(newValue);
            
            // Notify parent with validation result
            notifyParent(label, newOptions, !isValid);
        }
    };

    // Use external error if provided, otherwise use internal error state
    const displayError = props.error || error;
    const displayErrorMsg = props.error || errorMsg;

    return (
        <div className="mb-2">
            <div className="flex space-x-1 items-center">
                <p className="font-bold text-lg my-4">{ordinal(props.index + 2)} Room</p>
                {props.required && <span className="text-xs text-red-500 ml-1 font-bold">*</span>}
                <p className="px-2 py-1 border-black rounded-md hover:text-red-500 cursor-pointer" title="Remove this room" onClick={() => props.removeRoom()}>
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                </p>
            </div>
            {props.label && <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">{props.label}</label>}
            
            <div className="flex flex-col">
                {roomTypes && roomTypes.map((option, index) => {
                    let priceLabel = option.price_per_night ? `Included in your package price` : '';
                    if (index > 1) {
                        priceLabel = `Your package Price + Out of pocket fee of $${option.price_per_night}/night`;

                        if (option.peak_rate && option.peak_rate > 0) {
                            priceLabel = `${priceLabel} ($${option.peak_rate}/night Peak Period)`;
                        }
                    }

                    if (isNdisFunded) {
                        priceLabel = `Out of pocket fee of $${option.price_per_night}/night (May be covered by some funders)`;
                    }
                    return (
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
            </div>
            
            {/* Display error message */}
            {displayError && <p className="mt-1.5 text-red-500 text-xs">{displayErrorMsg}</p>}
            
            {props.additionalRoomsLength == props.index + 1 && <div className="bg-sky-800 px-4 py-2 text-white rounded-md w-fit cursor-pointer" onClick={() => props.addRoom()}>Add a {ordinal(props.index + 3)} room</div>}
        </div>
    )
}

export default RoomField;