import { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { bookingRequestFormActions } from "../../store/bookingRequestFormSlice";
import ordinal from "ordinal";
import HorizontalCardSelection from "../ui-v2/HorizontalCardSelection";

// Custom hooks for logic separation
const useRoomValidation = (selectedRooms, required) => {
  const [error, setError] = useState('');

  const validateRooms = useCallback((rooms = selectedRooms) => {
    if (!required) {
      setError('');
      return true;
    }

    const hasValidSelection = rooms?.length > 0 && rooms[0]?.name;
    if (!hasValidSelection) {
      setError('Please select at least one room.');
      return false;
    }

    setError('');
    return true;
  }, [selectedRooms, required]);

  return { error, validateRooms };
};

const useRoomData = (isNdisFunded) => {
  const [roomTypes, setRoomTypes] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRoomTypes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/manage-room");
      const data = await response.json();
      // console.log(data, 'Fetched Room Types Data');
      const processedRooms = data
        .map(room => ({
          ...room.data,
          imageUrl: room.image_url,
          value: false
        }))
        .filter(room => room != null)
        .filter(room => {
          if (isNdisFunded) {
            return room.type === 'studio' || room.type === 'ocean_view';
          }
          return true;
        })
        .sort((a, b) => a.id - b.id);
        // console.log(processedRooms, 'Processed Rooms Data');
      setRoomTypes(processedRooms);
    } catch (error) {
      console.error('Error fetching room types:', error);
    } finally {
      setLoading(false);
    }
  }, [isNdisFunded]);

  useEffect(() => {
    fetchRoomTypes();
  }, [fetchRoomTypes]);

  return { roomTypes, setRoomTypes, loading };
};

const RoomsField = (props) => {
  const dispatch = useDispatch();
  const isNdisFunded = useSelector(state => state.bookingRequestForm.isNdisFunded);

  // console.log(isNdisFunded, 'isNdisFunded in RoomsField');
  
  // Initialize selected rooms
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
  const [showUpgrades, setShowUpgrades] = useState(false);
  const [additionalRoomErrors, setAdditionalRoomErrors] = useState({});

  // Custom hooks
  const { roomTypes, setRoomTypes, loading } = useRoomData(isNdisFunded);
  const { error, validateRooms } = useRoomValidation(selectedRooms, props.required);

  // Extract additional rooms from selected rooms
  useEffect(() => {
    if (selectedRooms?.length > 1) {
      const [, ...additional] = selectedRooms;
      setAdditionalRooms(additional.map((room, idx) => ({
        ...room,
        order: room.order || idx + 2
      })));
    } else {
      setAdditionalRooms([]);
    }
  }, [selectedRooms]);

  // Notify parent of changes with proper validation
  const notifyParent = useCallback((rooms, hasError = false) => {
    if (props.onChange) {
      const value = JSON.stringify(rooms);
      const errorMessage = hasError ? error : null;
      
      if (props.onChange.length > 1) {
        props.onChange(value, errorMessage);
      } else {
        props.onChange(value);
      }
    }
  }, [props.onChange, error]);

  // Get validation styling for room selection containers (similar to QuestionPage)
  const getRoomContainerClasses = (hasError = false, hasSelection = false) => {
    if (hasError) {
      return 'border-2 border-red-200 rounded-xl p-4 bg-red-50';
    }
    if (hasSelection && props.required) {
      return 'border-2 border-green-200 rounded-xl p-4 bg-green-50';
    }
    return 'border-2 border-gray-200 rounded-xl p-4 bg-white';
  };

  // Enhanced validation with better error messages
  const validateRoomsEnhanced = useCallback((rooms = selectedRooms) => {
    if (!props.required) {
      return { isValid: true, errorMessage: '' };
    }

    const hasValidSelection = rooms?.length > 0 && rooms[0]?.name;
    if (!hasValidSelection) {
      const fieldName = props.label || 'Room selection';
      return { isValid: false, errorMessage: `${fieldName} is required` };
    }

    return { isValid: true, errorMessage: '' };
  }, [selectedRooms, props.required, props.label]);

  // Override the validation function
  const customValidateRooms = useCallback((rooms = selectedRooms) => {
    const { isValid, errorMessage } = validateRoomsEnhanced(rooms);
    if (!isValid) {
      // Update error state through the hook
      validateRooms(rooms);
      return false;
    }
    // Clear error state
    validateRooms(rooms);
    return true;
  }, [selectedRooms, validateRoomsEnhanced, validateRooms]);

  // Update Redux store with selected rooms
  const updateReduxStore = useCallback((rooms) => {
    const selectedRoomData = rooms
      .filter(room => room?.name)
      .map((room, index) => {
        const roomType = roomTypes.find(r => r.name === room.name);
        return roomType ? {
          room: roomType.name,
          type: index === 0 ? roomType.type : 'upgrade',
          price: roomType.price_per_night,
          peak_rate: roomType.peak_rate
        } : null;
      })
      .filter(Boolean);

    dispatch(bookingRequestFormActions.setRooms(selectedRoomData));
  }, [roomTypes, dispatch]);

  // Transform room data for HorizontalCardSelection
  const transformRoomData = useCallback((rooms, isAdditional = false) => {
    return rooms.map((room, index) => {
      // Apply the correct pricing logic - first room is always included
      let priceLabel = 'Included in your package price';
      
      // Only show out-of-pocket fee for additional rooms or upgrades
      if (isAdditional || room.type !== 'studio') {
        if (isNdisFunded) {
          priceLabel = `Out of pocket fee of ${room.price_per_night}/night (May be covered by some funders)`;
        } else {
          priceLabel = `Your package Price + Out of pocket fee of ${room.price_per_night}/night`;
          
          if (room.peak_rate && room.peak_rate > 0) {
            priceLabel = `${priceLabel} (${room.peak_rate}/night Peak Period)`;
          }
        }
      }

      return {
        value: room.name,
        label: room.name,
        description: (
          <div className="w-full grid grid-cols-12 gap-3">
            <div className="col-span-12">
              <div className="grid grid-cols-3 gap-x-4 gap-y-3">
                {/* Bedrooms - First */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                    </svg>
                    <p className="text-sm text-slate-400">Bedrooms</p>
                  </div>
                  <p className="mt-1 text-base">{room.bedrooms}</p>
                </div>
                
                {/* Bathrooms - Second, under bedrooms */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2.69L6.12 9.19C5.4 10.03 5 11.1 5 12.25C5 15.45 7.55 18 10.75 18S16.5 15.45 16.5 12.25C16.5 11.1 16.1 10.03 15.38 9.19L12 2.69Z" />
                    </svg>
                    <p className="text-sm text-slate-400">Bathrooms</p>
                  </div>
                  <p className="mt-1 text-base">{room.bathrooms}</p>
                </div>

                {/* Max Guests - Third position */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <p className="text-sm text-slate-400">Max Guests</p>
                  </div>
                  <p className="mt-1 text-base">{room.max_guests}</p>
                </div>

                {/* Bed types grouped together - Second row */}
                {/* Ergonomic King Beds */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <p className="text-sm text-slate-400">Ergonomic King Beds</p>
                  </div>
                  <p className="mt-1 text-base">{room.ergonomic_king_beds}</p>
                </div>
                
                {/* King Single Beds */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <p className="text-sm text-slate-400">King Single Beds</p>
                  </div>
                  <p className="mt-1 text-base">{room.king_single_beds}</p>
                </div>
                
                {/* Queen Sofa Beds */}
                <div className="text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
                    </svg>
                    <p className="text-sm text-slate-400">Queen Sofa Beds</p>
                  </div>
                  <p className="mt-1 text-base">{room.queen_sofa_beds}</p>
                </div>
              </div>
              
              {/* Price section */}
              <div className="mt-4">
                <div className="flex items-center gap-2 mb-1">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-slate-400">Price</p>
                </div>
                <p className="mt-1 text-base">{priceLabel}</p>
              </div>
            </div>
          </div>
        ),
        imageUrl: room.imageUrl || '/rooms-placeholder.png'
      };
    });
  }, [isNdisFunded]);

  // Handle main room selection
  const handleMainRoomChange = useCallback((selectedRoomName) => {
    const newRooms = [
      { name: selectedRoomName, order: 1 },
      ...additionalRooms
    ];

    setSelectedRooms(newRooms);
    updateReduxStore(newRooms);
    
    const isValid = customValidateRooms(newRooms);
    notifyParent(newRooms, !isValid);
    
    // Hide upgrades if studio is selected (only relevant for NDIS users)
    if (isNdisFunded && roomTypes.find(r => r.name === selectedRoomName)?.type === 'studio') {
      setShowUpgrades(false);
    }
  }, [additionalRooms, roomTypes, customValidateRooms, notifyParent, updateReduxStore, isNdisFunded]);

  // Handle additional room changes
  const handleAdditionalRoomChange = useCallback((roomName, roomIndex) => {
    const newAdditionalRooms = [...additionalRooms];
    newAdditionalRooms[roomIndex] = {
      name: roomName,
      order: roomIndex + 2
    };
    setAdditionalRooms(newAdditionalRooms);

    // Validate selection
    const hasValidSelection = roomName && roomName.trim() !== '';
    const errorMsg = !hasValidSelection ? 'Please select a room.' : null;

    // Handle errors
    const newErrors = { ...additionalRoomErrors };
    if (errorMsg) {
      newErrors[roomIndex] = errorMsg;
    } else {
      delete newErrors[roomIndex];
    }
    setAdditionalRoomErrors(newErrors);

    // Update if no errors
    if (!errorMsg && Object.keys(newErrors).length === 0) {
      const newRooms = [selectedRooms[0], ...newAdditionalRooms].filter(Boolean);
      setSelectedRooms(newRooms);
      updateReduxStore(newRooms);
      
      const isValid = customValidateRooms(newRooms);
      notifyParent(newRooms, !isValid);
    }
  }, [additionalRooms, additionalRoomErrors, selectedRooms, customValidateRooms, notifyParent, updateReduxStore]);

  // Add additional room
  const addAdditionalRoom = useCallback(() => {
    setAdditionalRooms(prev => [...prev, { name: '', order: prev.length + 2 }]);
  }, []);

  // Remove additional room
  const removeAdditionalRoom = useCallback((index) => {
    const newAdditionalRooms = additionalRooms.filter((_, i) => i !== index);
    setAdditionalRooms(newAdditionalRooms);
    
    const newRooms = selectedRooms[0] ? [selectedRooms[0], ...newAdditionalRooms] : [];
    setSelectedRooms(newRooms);
    updateReduxStore(newRooms);
    
    // Clear errors for removed room and reindex
    const newErrors = {};
    Object.entries(additionalRoomErrors).forEach(([key, value]) => {
      const keyInt = parseInt(key);
      if (keyInt < index) {
        newErrors[key] = value;
      } else if (keyInt > index) {
        newErrors[keyInt - 1] = value;
      }
    });
    setAdditionalRoomErrors(newErrors);
    
    const isValid = customValidateRooms(newRooms);
    notifyParent(newRooms, !isValid);
  }, [additionalRooms, selectedRooms, additionalRoomErrors, customValidateRooms, notifyParent, updateReduxStore]);

  // Handle main room click (for NDIS users with upgrade logic)
  const handleMainRoomClick = useCallback((roomName) => {
    const roomType = roomTypes.find(r => r.name === roomName)?.type;
    if (roomType === 'upgrade') {
      setShowUpgrades(true);
    } else {
      handleMainRoomChange(roomName);
    }
  }, [roomTypes, handleMainRoomChange]);

  if (loading) {
    return <div className="mb-2">Loading rooms...</div>;
  }

  const displayError = props.error || error;
  
  // NEW: Conditional room grouping based on NDIS funding status
  const shouldSeparateRooms = isNdisFunded;
  
  // When NDIS funded: separate studio and upgrade rooms
  // When not NDIS funded: show all rooms together
  const studioRooms = roomTypes.filter(room => room.type === 'studio');
  const upgradeRooms = roomTypes.filter(room => room.type !== 'studio');
  const allRooms = roomTypes; // All rooms for non-NDIS users

  // Get currently selected main room
  const selectedMainRoom = selectedRooms[0]?.name || null;

  return (
    <div className="mb-2">
      {/* Main room selection */}
      <div className="mb-6">
        {props.label && (
          <label className={`font-semibold form-label inline-block mb-1.5 ${displayError ? 'text-red-700' : 'text-slate-700'}`}>
            {props.label}
            {props.required && <span className="text-red-500 ml-1">*</span>}
          </label>
        )}
        
        {shouldSeparateRooms ? (
          // NDIS funded: Show studio rooms first, then upgrades conditionally
          <>
            {/* Studio rooms */}
            <div className={`mt-4 ${getRoomContainerClasses(displayError, selectedMainRoom)}`}>
              <HorizontalCardSelection
                items={transformRoomData(studioRooms)}
                value={selectedMainRoom}
                onChange={handleMainRoomClick}
                required={props.required}
                size="extra-large"
                origin="room"
              />
            </div>
            
            {/* Upgrade rooms */}
            {showUpgrades && (
              <div className="mt-4">
                <h3 className="font-semibold text-slate-700 mb-2">Upgrade Options</h3>
                <div className={getRoomContainerClasses(displayError, selectedMainRoom)}>
                  <HorizontalCardSelection
                    items={transformRoomData(upgradeRooms)}
                    value={selectedMainRoom}
                    onChange={handleMainRoomClick}
                    required={props.required}
                    size="extra-large"
                    origin="room"
                  />
                </div>
              </div>
            )}
          </>
        ) : (
          // Non-NDIS funded: Show all rooms together
          <div className={`mt-4 ${getRoomContainerClasses(displayError, selectedMainRoom)}`}>
            <HorizontalCardSelection
              items={transformRoomData(allRooms)}
              value={selectedMainRoom}
              onChange={handleMainRoomChange} // Use handleMainRoomChange directly for non-NDIS
              required={props.required}
              size="extra-large"
              origin="room"
            />
          </div>
        )}
        
        {displayError && (
          <div className="mt-1.5 flex items-center">
            <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-600 text-sm font-medium">{displayError}</p>
          </div>
        )}
      </div>

      {/* Add room button */}
      {additionalRooms.length === 0 && !props.disabled && selectedMainRoom && (
        <button
          onClick={addAdditionalRoom}
          className="group flex items-center gap-2 px-6 py-3 text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
        >
          <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Add another room
        </button>
      )}

      {/* Additional rooms */}
      <div className="mt-4">
        {additionalRooms.map((room, roomIndex) => {
          // For additional rooms, always filter to studio rooms only regardless of NDIS status
          // This maintains the existing business logic for additional room selections
          const additionalRoomTypes = roomTypes.filter(r => r.type === 'studio');
          const selectedAdditionalRoom = room.name || null;

          return (
            <div key={roomIndex} className="mb-6 border-t pt-4">
              {/* Additional room header */}
              <div className="flex space-x-2 items-center mb-4">
                <h3 className="font-semibold text-slate-700 text-lg">
                  {ordinal(roomIndex + 2)} Room
                </h3>
                <span className="text-xs text-red-500 font-bold">*</span>
                <button
                  onClick={() => removeAdditionalRoom(roomIndex)}
                  className="ml-auto px-2 py-1 text-red-500 hover:text-red-700 cursor-pointer transition-colors"
                  title="Remove this room"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>

              {/* Additional room selection */}
              <div className={`mb-4 ${getRoomContainerClasses(additionalRoomErrors[roomIndex], selectedAdditionalRoom)}`}>
                <HorizontalCardSelection
                  items={transformRoomData(additionalRoomTypes, true)}
                  value={selectedAdditionalRoom}
                  onChange={(roomName) => handleAdditionalRoomChange(roomName, roomIndex)}
                  required={true}
                  size="extra-large"
                  origin="room"
                />
              </div>

              {/* Additional room error */}
              {additionalRoomErrors[roomIndex] && (
                <div className="mt-1.5 flex items-center">
                  <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <p className="text-red-600 text-sm font-medium">{additionalRoomErrors[roomIndex]}</p>
                </div>
              )}

              {/* Add next room button */}
              {(additionalRooms.length < 2 && roomIndex === additionalRooms.length - 1) && (
                <button
                  onClick={addAdditionalRoom}
                  className="group flex items-center gap-2 px-6 py-3 text-blue-600 bg-blue-50 border-2 border-blue-200 rounded-xl hover:bg-blue-100 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-200 transition-all duration-200 font-medium"
                >
                  <svg className="w-5 h-5 group-hover:scale-110 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add a {ordinal(roomIndex + 3)} room
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Maximum rooms reached message */}
      {additionalRooms.length >= 2 && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-amber-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-amber-800 text-sm font-medium">
              Maximum of 3 rooms total (1 main room + 2 additional rooms) allowed per booking.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RoomsField;