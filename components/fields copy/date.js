import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment';
import { validateDate } from "../../utilities/common";
import { toast } from "react-toastify";
import { useSelector } from "react-redux";

const DateField = (props) => {
    const [allowPrevDate, setAllowPrevDate] = useState(props.hasOwnProperty('allowPrevDate') ? props.allowPrevDate : true);
    const checkin = useSelector(state => state.bookingRequestForm.checkinDate);
    const checkout = useSelector(state => state.bookingRequestForm.checkoutDate);
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState();
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [isUserEditing, setIsUserEditing] = useState(false);
    const container = useRef();
    const validationTimeoutRef = useRef();
    const editingTimeoutRef = useRef();

    const monthRef = useRef();
    const yearRef = useRef();

    const openCalendar = () => {
        if (day && month && year) {
            const currentDate = `${year}-${month}-${day}`;
            if (!allowPrevDate && isDateInPast(currentDate)) {
                const today = new Date();
                setDateValue(today);
            }
        }
        setShowCalendar(true);
    };

    // Check if dates are in the past (separate from order validation)
    const areDatesInPast = () => {
        if (!checkin || !checkout || allowPrevDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const checkinDate = new Date(normalizeDate(checkin));
        const checkoutDate = new Date(normalizeDate(checkout));
        checkinDate.setHours(0, 0, 0, 0);
        checkoutDate.setHours(0, 0, 0, 0);
        
        return checkinDate < today || checkoutDate < today;
    };

    // Check if THIS SPECIFIC field's date is in the past
    const isThisFieldDateInPast = () => {
        if (allowPrevDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let currentFieldDate;
        if (props.name === 'checkinDate' && checkin) {
            currentFieldDate = new Date(normalizeDate(checkin));
        } else if (props.name === 'checkoutDate' && checkout) {
            currentFieldDate = new Date(normalizeDate(checkout));
        } else {
            return false;
        }
        
        currentFieldDate.setHours(0, 0, 0, 0);
        return currentFieldDate < today;
    };

    // Check if current dates are problematic (past dates or invalid range)
    const areCurrentDatesProblematic = () => {
        if (!checkin || !checkout) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const checkinDate = new Date(normalizeDate(checkin));
        const checkoutDate = new Date(normalizeDate(checkout));
        checkinDate.setHours(0, 0, 0, 0);
        checkoutDate.setHours(0, 0, 0, 0);
        
        // Check if dates are in past (when past dates not allowed)
        const datesInPast = !allowPrevDate && (checkinDate < today || checkoutDate < today);
        
        // Check if dates are in wrong order
        const wrongOrder = checkinDate >= checkoutDate;
        
        return datesInPast || wrongOrder;
    };

    // Function to check if a date is in the past
    const isDateInPast = (selectedDate) => {
        if (!selectedDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateToCheck = new Date(selectedDate);
        dateToCheck.setHours(0, 0, 0, 0);
        
        return dateToCheck < today;
    };

    // Function to validate if selected date is allowed
    const isDateAllowed = (selectedDate) => {
        if (allowPrevDate) return true;
        return !isDateInPast(selectedDate);
    };

    // Normalize date format
    const normalizeDate = (dateStr) => {
        if (!dateStr) return null;
        
        if (dateStr.includes('/')) {
            const parts = dateStr.split('/');
            if (parts.length === 3) {
                return `${parts[2]}-${parts[1]}-${parts[0]}`;
            }
        }
        
        return dateStr;
    };
    
    // Validation function for checkout date
    const validateCheckoutDate = (checkinDate, checkoutDate) => {
        if (!checkinDate || !checkoutDate) return null;
        
        const normalizedCheckin = normalizeDate(checkinDate);
        const normalizedCheckout = normalizeDate(checkoutDate);
        
        const checkinMoment = moment(normalizedCheckin, 'YYYY-MM-DD', true);
        const checkoutMoment = moment(normalizedCheckout, 'YYYY-MM-DD', true);
        
        if (!checkinMoment.isValid() || !checkoutMoment.isValid()) return null;
        
        if (checkoutMoment.isSameOrBefore(checkinMoment)) {
            return 'Check-out date must be after check-in date';
        }
        
        return null;
    };
    
    // Validation function for checkin date
    const validateCheckinDate = (checkinDate, checkoutDate) => {
        if (!checkinDate || !checkoutDate) return null;
        
        const normalizedCheckin = normalizeDate(checkinDate);
        const normalizedCheckout = normalizeDate(checkoutDate);
        
        const checkinMoment = moment(normalizedCheckin, 'YYYY-MM-DD', true);
        const checkoutMoment = moment(normalizedCheckout, 'YYYY-MM-DD', true);
        
        if (!checkinMoment.isValid() || !checkoutMoment.isValid()) return null;
        
        if (checkinMoment.isAfter(checkoutMoment)) {
            return 'Check-in date cannot be after check-out date';
        }
        
        return null;
    };

    // Check if we're in the process of fixing problematic dates
    const isFixingProblematicDates = () => {
        if (!checkin || !checkout) return false;
        
        // If dates were previously problematic (in past), we're more lenient during fixing
        return areDatesInPast();
    };

    // Debounced validation function
    const performDelayedValidation = useCallback(() => {
        if (validationTimeoutRef.current) {
            clearTimeout(validationTimeoutRef.current);
        }

        validationTimeoutRef.current = setTimeout(() => {
            if (!isUserEditing && checkin && checkout) {
                if (props.name === 'checkinDate') {
                    const errorMsg = validateCheckinDate(checkin, checkout);
                    if (errorMsg) {
                        setError(true);
                        setErrorMessage(errorMsg);
                    } else {
                        if (error && errorMessage === 'Check-in date cannot be after check-out date') {
                            setError(false);
                            setErrorMessage('');
                        }
                    }
                } else if (props.name === 'checkoutDate') {
                    const errorMsg = validateCheckoutDate(checkin, checkout);
                    if (errorMsg) {
                        setError(true);
                        setErrorMessage(errorMsg);
                    } else {
                        if (error && errorMessage === 'Check-out date must be after check-in date') {
                            setError(false);
                            setErrorMessage('');
                        }
                    }
                }
            }
        }, 1500);
    }, [checkin, checkout, props.name, error, errorMessage, isUserEditing]);

    // Track when user starts editing
    const handleEditingStart = () => {
        setIsUserEditing(true);
        
        if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current);
        }
        
        // Clear cross-validation errors while editing
        if (error && (errorMessage === 'Check-out date must be after check-in date' || 
                     errorMessage === 'Check-in date cannot be after check-out date')) {
            setError(false);
            setErrorMessage('');
        }
    };

    // Track when user stops editing
    const handleEditingStop = () => {
        if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current);
        }
        
        editingTimeoutRef.current = setTimeout(() => {
            setIsUserEditing(false);
        }, 800);
    };

    const setSelectedDate = (e) => {
        if (!allowPrevDate && isDateInPast(e)) {
            toast.error('Past dates are not allowed!');
            return;
        }

        const selectedDate = moment(e).format('DD-MM-YYYY');
        const dateArr = selectedDate.split('-');
        setDay(dateArr[0]);
        setMonth(dateArr[1]);
        setYear(dateArr[2]);
        setDateValue(e);
        setShowCalendar(false);
    };

    // Modified validation effect with delayed validation for cross-validation
    useEffect(() => {
        if (!checkin || !checkout) {
            if (error && (errorMessage === 'Check-out date must be after check-in date' || 
                         errorMessage === 'Check-in date cannot be after check-out date')) {
                setError(false);
                setErrorMessage('');
            }
            return;
        }
        
        performDelayedValidation();
        
        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current);
            }
        };
    }, [checkin, checkout, performDelayedValidation]);

    // Trigger validation when editing stops
    useEffect(() => {
        if (!isUserEditing) {
            performDelayedValidation();
        }
    }, [isUserEditing, performDelayedValidation]);

    useEffect(() => {
        if (props.value) {
            const valArr = props.value.split('-');
            setYear(valArr[0]);
            setMonth(valArr[1]);
            setDay(valArr[2]);
            setDateValue(new Date(props.value));
            setDirty(true);
        }
    }, [props.value]);

    useEffect(() => {
        if (day !== '' && month !== '' && year !== '' && year.length === 4) {
            const selectedDate = `${year}-${month}-${day}`;
            let hasError = false;
            let errorMsg = '';
            let blockOnChange = false;

            console.log(`Validating date: ${selectedDate} for field: ${props.name}`);

            // Check basic date validation first
            const basicValidationError = validateDate(selectedDate);
            console.log('Basic validation error:', basicValidationError);
            
            if (basicValidationError) {
                hasError = true;
                errorMsg = 'Invalid date entered!';
                console.log('Setting basic validation error');
                toast.error('Invalid date entered!');
            }

            // Check past date validation if no basic error
            if (!hasError && !allowPrevDate && isDateInPast(selectedDate)) {
                hasError = true;
                errorMsg = 'Past dates are not allowed!';
                console.log('Setting past date error');
                toast.error('Past dates are not allowed!');
            }

            // Check cross-validation only if no previous errors and not editing
            if (!hasError && !isUserEditing) {
                let crossValidationError = null;
                
                // Check if the OTHER field is in the past - if so, don't show cross-validation errors
                const otherFieldInPast = (props.name === 'checkinDate' && checkout && isDateInPast(normalizeDate(checkout))) ||
                                       (props.name === 'checkoutDate' && checkin && isDateInPast(normalizeDate(checkin)));
                
                if (!otherFieldInPast) {
                    if (props.name === 'checkinDate' && checkout) {
                        crossValidationError = validateCheckinDate(selectedDate, checkout);
                        console.log('Checkin cross-validation error:', crossValidationError);
                    } else if (props.name === 'checkoutDate' && checkin) {
                        crossValidationError = validateCheckoutDate(checkin, selectedDate);
                        console.log('Checkout cross-validation error:', crossValidationError);
                    }
                    
                    if (crossValidationError) {
                        hasError = true;
                        errorMsg = crossValidationError;
                        console.log('Setting cross-validation error:', crossValidationError);
                        toast.error(crossValidationError);
                    }
                } else {
                    console.log('Other field is in past - skipping cross-validation error for this field');
                }
            }

            // MODIFIED: More lenient cross-validation blocking when fixing problematic dates
            if (!hasError && !blockOnChange && !isUserEditing && checkin && checkout) {
                let oppositeFieldError = null;
                const fixingProblematic = isFixingProblematicDates();
                
                // Check if the OTHER field is in the past (more lenient when other field needs fixing)
                const otherFieldInPast = (props.name === 'checkinDate' && checkout && isDateInPast(normalizeDate(checkout))) ||
                                       (props.name === 'checkoutDate' && checkin && isDateInPast(normalizeDate(checkin)));
                
                // If we're fixing problematic dates OR the other field is in the past, be more lenient
                if (!fixingProblematic && !otherFieldInPast) {
                    if (props.name === 'checkinDate') {
                        oppositeFieldError = validateCheckoutDate(selectedDate, checkout);
                        console.log('Checking opposite field (checkout) validity:', oppositeFieldError);
                    } else if (props.name === 'checkoutDate') {
                        oppositeFieldError = validateCheckinDate(checkin, selectedDate);
                        console.log('Checking opposite field (checkin) validity:', oppositeFieldError);
                    }
                    
                    if (oppositeFieldError) {
                        blockOnChange = true;
                        console.log('Opposite field would have error, blocking onChange silently:', oppositeFieldError);
                    }
                } else {
                    console.log('Fixing problematic dates or other field in past - allowing more lenient validation');
                }
            }

            console.log('Final validation state - hasError:', hasError, 'blockOnChange:', blockOnChange, 'errorMsg:', errorMsg);

            // Set error state for THIS field only
            if (hasError) {
                setError(true);
                setErrorMessage(errorMsg);
            } else {
                setError(false);
                setErrorMessage('');
            }

            // Always call onChange, but pass error when there is one
            if (!hasError && !blockOnChange) {
                console.log('No errors and not blocked - calling onChange with no error');
                setDirty(true);
                debugOnChange(selectedDate, null, 'main-validation', hasError, errorMsg);
            } else if (hasError) {
                console.log('Has error - calling onChange with error');
                setDirty(true);
                debugOnChange(selectedDate, errorMsg, 'main-validation-with-error', hasError, errorMsg);
            } else {
                console.log('Blocked but no error - NOT calling onChange');
            }

        } else if (props.required && dirty && !isUserEditing) {
            console.log('Required field validation failed');
            setError(true);
            setErrorMessage('This field is required');
        } else {
            console.log('Incomplete date or user editing, skipping validation');
        }
    }, [day, month, year, allowPrevDate, checkin, checkout, props.name, dirty, isUserEditing]);

    const debugOnChange = (date, errorToPass, source = 'unknown', hasValidationError = null, validationErrorMsg = '') => {
        console.log(`🔍 onChange called from: ${source}`);
        console.log(`🔍 Date: ${date}`);
        console.log(`🔍 Error to pass: ${errorToPass || 'none'}`);
        
        // Use passed validation state if provided, otherwise fall back to current state
        const actualError = hasValidationError !== null ? hasValidationError : (error && errorMessage);
        const actualErrorMsg = hasValidationError !== null ? validationErrorMsg : errorMessage;
        
        console.log(`🔍 Validation state: ${actualError ? actualErrorMsg : 'no error'}`);
        console.log(`🔍 isUserEditing: ${isUserEditing}`);
        
        if (actualError && !errorToPass) {
            console.error(`❌ WARNING: onChange called despite validation error: ${actualErrorMsg}`);
            console.trace();
        }
        
        props.onChange(date, errorToPass);
    };

    // Custom function to determine which dates should be disabled in the calendar
    const tileDisabled = ({ date, view }) => {
        if (view !== 'month') return false;
        
        // Basic past date restriction (always applies when past dates not allowed)
        if (!allowPrevDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (date < today) return true;
        }
        
        // If current dates are problematic, don't apply cross-field restrictions
        const problematicDates = areCurrentDatesProblematic();
        if (problematicDates) {
            return false;
        }
        
        // Apply cross-field restrictions only when dates are NOT problematic and not editing
        if (!isUserEditing) {
            if (props.name === 'checkoutDate' && checkin) {
                try {
                    const normalizedCheckin = normalizeDate(checkin);
                    const checkinDate = new Date(normalizedCheckin);
                    checkinDate.setHours(0, 0, 0, 0);
                    
                    if (!isDateInPast(normalizedCheckin) && date <= checkinDate) return true;
                } catch (e) {
                    console.error('Error parsing check-in date for calendar:', e);
                }
            }
            
            if (props.name === 'checkinDate' && checkout) {
                try {
                    const normalizedCheckout = normalizeDate(checkout);
                    const checkoutDate = new Date(normalizedCheckout);
                    checkoutDate.setHours(0, 0, 0, 0);
                    
                    if (!isDateInPast(normalizedCheckout) && date >= checkoutDate) return true;
                } catch (e) {
                    console.error('Error parsing check-out date for calendar:', e);
                }
            }
        }
        
        return false;
    };

    // Fixed getMinDate function
    const getMinDate = () => {
        if (!allowPrevDate) {
            return new Date();
        }
        
        const problematicDates = areCurrentDatesProblematic();
        if (problematicDates) {
            return undefined;
        }
        
        if (props.name === 'checkoutDate' && checkin && !isUserEditing) {
            try {
                const normalizedCheckin = normalizeDate(checkin);
                if (!isDateInPast(normalizedCheckin)) {
                    const minDate = new Date(normalizedCheckin);
                    minDate.setDate(minDate.getDate() + 1);
                    return minDate;
                }
            } catch (e) {
                console.error('Error setting min date for checkout:', e);
            }
        }
        
        return undefined;
    };

    // Fixed getMaxDate function
    const getMaxDate = () => {
        const problematicDates = areCurrentDatesProblematic();
        if (problematicDates) {
            return undefined;
        }
        
        if (props.name === 'checkinDate' && checkout && !isUserEditing) {
            try {
                const normalizedCheckout = normalizeDate(checkout);
                if (!isDateInPast(normalizedCheckout)) {
                    const maxDate = new Date(normalizedCheckout);
                    maxDate.setDate(maxDate.getDate() - 1);
                    return maxDate;
                }
            } catch (e) {
                console.error('Error setting max date for checkin:', e);
            }
        }
        
        return undefined;
    };

    const escFunction = useCallback((event) => {
        if (event.key === "Escape") {
          setShowCalendar(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", escFunction, false);
        return () => {
            document.removeEventListener("keydown", escFunction, false);
        };
    }, []);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (container.current && !container.current.contains(e.target)) {
                setShowCalendar(false);
            }
        };

        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        }
    }, []);

    useEffect(() => {
        if (!allowPrevDate && dirty && day && month && year) {
            const currentDate = `${year}-${month}-${day}`;
            if (isDateInPast(currentDate)) {
                const today = new Date();
                setDay(String(today.getDate()).padStart(2, '0'));
                setMonth(String(today.getMonth() + 1).padStart(2, '0'));
                setYear(today.getFullYear().toString());
                setDateValue(today);
            }
        }
    }, [allowPrevDate]);

    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMessage(props.error);
        } else {
            setError(false);
            setErrorMessage('');
        }
    }, [props.error]);

    // Cleanup timeouts on unmount
    useEffect(() => {
        return () => {
            if (validationTimeoutRef.current) {
                clearTimeout(validationTimeoutRef.current);
            }
            if (editingTimeoutRef.current) {
                clearTimeout(editingTimeoutRef.current);
            }
        };
    }, []);

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3 max-w-96">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <div className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${(dirty && error) ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-slate-400'}`}>
                    <div className="relative">
                        <div className="flex flex-row" ref={container}>
                            <input 
                                type="text" 
                                disabled={props.disabled} 
                                value={day} 
                                className="w-8 border-1 focus:outline-none placeholder:text-black" 
                                onChange={(e) => {
                                    handleEditingStart();
                                    setDay(e.target.value);
                                    setDirty(true);
                                    if (e.target.value.length == 2) {
                                        monthRef.current.focus();
                                    }
                                }}
                                onBlur={handleEditingStop}
                                placeholder="DD" 
                            />
                            <p className="mx-2 text-gray-300">/</p>
                            <input 
                                ref={monthRef} 
                                type="text" 
                                disabled={props.disabled} 
                                value={month} 
                                className="w-8 border-1 focus:outline-none placeholder:text-black" 
                                onChange={(e) => {
                                    handleEditingStart();
                                    setMonth(e.target.value);
                                    setDirty(true);
                                    if (e.target.value.length == 2) {
                                        yearRef.current.focus();
                                    }
                                }}
                                onBlur={handleEditingStop}
                                placeholder="MM" 
                            />
                            <p className="mx-2 text-gray-300">/</p>
                            <input 
                                ref={yearRef} 
                                type="text" 
                                disabled={props.disabled} 
                                value={year} 
                                className="w-12 border-1 focus:outline-none placeholder:text-black mr-4" 
                                onChange={(e) => { 
                                    handleEditingStart();
                                    setYear(e.target.value); 
                                    setDirty(true);
                                }}
                                onBlur={handleEditingStop}
                                placeholder="YYYY" 
                            />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 cursor-pointer" onClick={openCalendar}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0121 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            {!props?.disabled && <Calendar 
                                onChange={setSelectedDate} 
                                value={dateValue} 
                                tileDisabled={tileDisabled}
                                minDate={getMinDate()}
                                maxDate={getMaxDate()}
                                className={`mt-2 absolute top-6 ${props.bottom} left-0 ${props.left} !max-w-[18rem] ${!showCalendar && 'hidden'}`} 
                            /> }
                        </div>
                    </div>
                </div>
                {/* Error messages */}
                {(error && errorMessage) && <p className="mt-1.5 text-red-500 text-xs">{errorMessage}</p>}
                
                {/* FIXED: Only show "Current dates need updating" when THIS field's date is in the past */}
                {isThisFieldDateInPast() && !isUserEditing && (
                    <p className="mt-1 text-amber-600 text-xs">
                        ⚠️ Current dates need updating. Use the calendar or manually enter new dates.
                    </p>
                )}
                
                {/* Editing hints */}
                {isUserEditing && checkin && checkout && (
                    <p className="mt-1 text-blue-500 text-xs">
                        💡 Update both dates as needed - validation will check when you&apos;re done editing
                    </p>
                )}
            </div>
        </div>
    );
};

export default DateField;