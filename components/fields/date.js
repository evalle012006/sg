import { useCallback, useEffect, useRef, useState } from "react";
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
    const [isFocused, setIsFocused] = useState(false);
    const [isValid, setIsValid] = useState(false);
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

    // FIXED: Check if current dates are problematic (past dates or invalid range)
    const areCurrentDatesProblematic = () => {
        // If either date is missing, not problematic
        if (!checkin || !checkout) return false;
        
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const checkinDate = new Date(checkin);
            const checkoutDate = new Date(checkout);
            
            // If either date is invalid, not problematic
            if (isNaN(checkinDate.getTime()) || isNaN(checkoutDate.getTime())) {
                return false;
            }
            
            checkinDate.setHours(0, 0, 0, 0);
            checkoutDate.setHours(0, 0, 0, 0);
            
            // Check if dates are in past (when past dates not allowed)
            const datesInPast = !allowPrevDate && (checkinDate < today || checkoutDate < today);
            
            // Check if dates are in wrong order
            const wrongOrder = checkinDate >= checkoutDate;
            
            return datesInPast || wrongOrder;
        } catch (error) {
            console.error('Error in areCurrentDatesProblematic:', error);
            return false; // If there's an error, assume not problematic
        }
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
                        setIsValid(false);
                    } else {
                        if (error && errorMessage === 'Check-in date cannot be after check-out date') {
                            setError(false);
                            setErrorMessage('');
                            setIsValid(true);
                        }
                    }
                } else if (props.name === 'checkoutDate') {
                    const errorMsg = validateCheckoutDate(checkin, checkout);
                    if (errorMsg) {
                        setError(true);
                        setErrorMessage(errorMsg);
                        setIsValid(false);
                    } else {
                        if (error && errorMessage === 'Check-out date must be after check-in date') {
                            setError(false);
                            setErrorMessage('');
                            setIsValid(true);
                        }
                    }
                }
            }
        }, 1500);
    }, [checkin, checkout, props.name, error, errorMessage, isUserEditing]);

    // Track when user starts editing
    const handleEditingStart = () => {
        setIsUserEditing(true);
        setIsFocused(true);
        
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
        setIsFocused(false);
        
        if (editingTimeoutRef.current) {
            clearTimeout(editingTimeoutRef.current);
        }
        
        editingTimeoutRef.current = setTimeout(() => {
            setIsUserEditing(false);
        }, 800);
    };

    // Validation state helpers (similar to InputField)
    const shouldShowError = props.error || (error && dirty);
    const shouldShowValid = !shouldShowError && isValid && dirty && day && month && year;

    // Get border and focus colors based on state (similar to InputField)
    const getBorderClasses = () => {
        if (shouldShowError) {
            return 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200';
        }
        if (shouldShowValid) {
            return 'border-green-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200';
        }
        if (isFocused) {
            return 'border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200';
        }
        return 'border-gray-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200';
    };

    // Get background color based on state (similar to InputField)
    const getBackgroundClasses = () => {
        if (shouldShowError) {
            return 'bg-red-50 focus-within:bg-white';
        }
        if (shouldShowValid) {
            return 'bg-green-50 focus-within:bg-white';
        }
        return 'bg-white';
    };

    // Status icon component (similar to InputField) - positioned to avoid overlap
    const StatusIcon = () => {
        if (shouldShowError) {
            return (
                <div className="absolute inset-y-0 right-0 flex items-center pr-10 pointer-events-none">
                    <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        if (shouldShowValid) {
            return (
                <div className="absolute inset-y-0 right-0 flex items-center pr-10 pointer-events-none">
                    <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                </div>
            );
        }
        return null;
    };

    // FIXED: Generate calendar days for current month
    const generateCalendarDays = () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentMonth = dateValue.getMonth();
        const currentYear = dateValue.getFullYear();
        
        // Get first day of month and number of days
        const firstDay = new Date(currentYear, currentMonth, 1);
        const lastDay = new Date(currentYear, currentMonth + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();
        
        const days = [];
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }
        
        // Add days of the month
        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const date = new Date(currentYear, currentMonth, dayNum);
            date.setHours(0, 0, 0, 0);
            
            const isToday = date.getTime() === today.getTime();
            const isPast = !allowPrevDate && date.getTime() < today.getTime();
            const isSelected = dayNum.toString() === day && 
                              (currentMonth + 1).toString() === month && 
                              currentYear.toString() === year;
            
            // Apply calendar-specific disabled logic
            let isDisabled = isPast;
            
            // SIMPLIFIED: Cross-field restrictions - only apply if we have BOTH dates
            if (!isUserEditing && checkin && checkout && !areCurrentDatesProblematic()) {
                if (props.name === 'checkoutDate') {
                    // For checkout field: disable dates on or before checkin
                    try {
                        const checkinDate = new Date(checkin);
                        if (!isNaN(checkinDate.getTime())) {
                            checkinDate.setHours(0, 0, 0, 0);
                            if (date.getTime() <= checkinDate.getTime()) {
                                isDisabled = true;
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                } else if (props.name === 'checkinDate') {
                    // For checkin field: disable dates on or after checkout
                    try {
                        const checkoutDate = new Date(checkout);
                        if (!isNaN(checkoutDate.getTime())) {
                            checkoutDate.setHours(0, 0, 0, 0);
                            if (date.getTime() >= checkoutDate.getTime()) {
                                isDisabled = true;
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors
                    }
                }
            }
            
            days.push({
                day: dayNum,
                date,
                isToday,
                isPast,
                isSelected,
                isDisabled
            });
        }
        
        return days;
    };

    // Navigate calendar month
    const navigateMonth = (direction) => {
        const newDate = new Date(dateValue);
        newDate.setMonth(newDate.getMonth() + direction);
        setDateValue(newDate);
    };

    // Handle calendar date selection
    const handleCalendarDateSelect = (selectedDate) => {
        if (!allowPrevDate && isDateInPast(selectedDate)) {
            toast.error('Past dates are not allowed!');
            return;
        }

        const formattedDate = moment(selectedDate).format('DD-MM-YYYY');
        const dateArr = formattedDate.split('-');
        setDay(dateArr[0]);
        setMonth(dateArr[1]);
        setYear(dateArr[2]);
        setDateValue(selectedDate);
        setShowCalendar(false);
        setDirty(true);
        setIsValid(true);
        setError(false);
        setErrorMessage('');

        // FIXED: Immediately notify parent of the valid date
        if (props.onChange) {
            const isoFormattedDate = moment(selectedDate).format('YYYY-MM-DD');
            props.onChange(isoFormattedDate, null);
        }
    };

    // FIXED: Helper function to call onChange with proper formatting
    const notifyParent = (dayVal, monthVal, yearVal, errorMsg = null) => {
        if (props.onChange && dayVal && monthVal && yearVal && yearVal.length === 4) {
            const formattedDate = `${yearVal}-${monthVal.padStart(2, '0')}-${dayVal.padStart(2, '0')}`;
            props.onChange(formattedDate, errorMsg);
        } else if (props.onChange && errorMsg) {
            // Notify parent of error even if date is incomplete
            const formattedDate = (dayVal && monthVal && yearVal) ? 
                `${yearVal}-${monthVal.padStart(2, '0')}-${dayVal.padStart(2, '0')}` : '';
            props.onChange(formattedDate, errorMsg);
        }
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
            setIsValid(true);
        }
    }, [props.value]);

    // FIXED: Main validation and onChange effect
    useEffect(() => {
        if (day !== '' && month !== '' && year !== '' && year.length === 4) {
            const selectedDate = `${year}-${month}-${day}`;
            let hasError = false;
            let errorMsg = '';
            let blockOnChange = false;

            // Check basic date validation first
            const basicValidationError = validateDate(selectedDate);
            
            if (basicValidationError) {
                hasError = true;
                errorMsg = 'Invalid date entered!';
                toast.error('Invalid date entered!');
            }

            // Check past date validation if no basic error
            if (!hasError && !allowPrevDate && isDateInPast(selectedDate)) {
                hasError = true;
                errorMsg = 'Past dates are not allowed!';
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
                    } else if (props.name === 'checkoutDate' && checkin) {
                        crossValidationError = validateCheckoutDate(checkin, selectedDate);
                    }
                    
                    if (crossValidationError) {
                        hasError = true;
                        errorMsg = crossValidationError;
                        toast.error(crossValidationError);
                    }
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
                    } else if (props.name === 'checkoutDate') {
                        oppositeFieldError = validateCheckinDate(checkin, selectedDate);
                    }
                    
                    if (oppositeFieldError) {
                        blockOnChange = true;
                    }
                }
            }

            // Set error state for THIS field only
            if (hasError) {
                setError(true);
                setErrorMessage(errorMsg);
                setIsValid(false);
                // FIXED: Still notify parent of error
                notifyParent(day, month, year, errorMsg);
            } else {
                setError(false);
                setErrorMessage('');
                setIsValid(true);
                // FIXED: Notify parent of valid date if not blocked
                if (!blockOnChange) {
                    notifyParent(day, month, year, null);
                }
            }

            // Always mark as dirty when we have a complete date
            if (!hasError && !blockOnChange) {
                setDirty(true);
            } else if (hasError) {
                setDirty(true);
            }

        } else if (props.required && dirty && !isUserEditing) {
            setError(true);
            setErrorMessage('This field is required');
            setIsValid(false);
            // FIXED: Notify parent of required field error
            notifyParent(day, month, year, 'This field is required');
        }
    }, [day, month, year, allowPrevDate, checkin, checkout, props.name, dirty, isUserEditing, props.required]);

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
            setIsValid(false);
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
            <div className="mb-3 w-full max-w-sm">
                {props.label && (
                    <label 
                        htmlFor={props.label} 
                        className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}
                    >
                        {props.label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                <div className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition-all ease-in-out duration-200 focus-within:text-gray-700 focus-within:outline-none 
                                ${getBorderClasses()} ${getBackgroundClasses()}`}>
                    <div className="relative">
                        <div className="flex flex-row items-center" ref={container}>
                            <input 
                                type="text" 
                                disabled={props.disabled} 
                                value={day} 
                                className="w-8 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center" 
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
                                className="w-8 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center" 
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
                                className="w-12 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center mr-1" 
                                onChange={(e) => { 
                                    handleEditingStart();
                                    setYear(e.target.value); 
                                    setDirty(true);
                                }}
                                onBlur={handleEditingStop}
                                placeholder="YYYY" 
                            />
                            <div className="flex items-center ml-auto">
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    strokeWidth="1.5" 
                                    stroke="currentColor" 
                                    className="w-5 h-5 cursor-pointer text-gray-500 hover:text-blue-600 transition-colors mr-2" 
                                    onClick={openCalendar}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0121 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                <StatusIcon />
                            </div>
                            
                            {/* FIXED: Custom Calendar - Compact size with unique keys */}
                            {!props?.disabled && showCalendar && (
                                <div className={`mt-1 absolute top-8 ${props.bottom} left-0 ${props.left} bg-white p-4 rounded-lg border border-gray-200 shadow-lg z-50 w-[280px]`}>
                                    {/* Calendar Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        <button
                                            type="button"
                                            onClick={() => navigateMonth(-1)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
                                            aria-label="Previous month"
                                        >
                                            ←
                                        </button>
                                        <h3 className="font-semibold text-gray-800">
                                            {dateValue.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                        </h3>
                                        <button
                                            type="button"
                                            onClick={() => navigateMonth(1)}
                                            className="p-1.5 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
                                            aria-label="Next month"
                                        >
                                            →
                                        </button>
                                    </div>
                                    
                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {/* Day headers */}
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(dayName => (
                                            <div key={dayName} className="text-center font-semibold p-2 text-gray-600 text-xs">
                                                {dayName}
                                            </div>
                                        ))}
                                        
                                        {/* FIXED: Calendar days with unique keys */}
                                        {generateCalendarDays().map((dayObj, index) => {
                                            if (!dayObj) {
                                                return <div key={`empty-${index}`} className="p-2"></div>;
                                            }
                                            
                                            const { day: dayNum, date, isToday, isPast, isSelected, isDisabled } = dayObj;
                                            
                                            return (
                                                <button
                                                    key={`day-${dayNum}`}
                                                    type="button"
                                                    disabled={isDisabled}
                                                    className={`
                                                        p-2 text-center rounded-md transition-all duration-200 text-sm font-medium h-8 w-8 flex items-center justify-center
                                                        ${isDisabled ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50 cursor-pointer hover:scale-105'}
                                                        ${isToday && !isDisabled ? 'bg-blue-100 font-bold border-2 border-blue-300 text-blue-700' : ''}
                                                        ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : ''}
                                                        ${!isSelected && !isToday && !isDisabled ? 'hover:bg-blue-50 hover:text-blue-600' : ''}
                                                    `}
                                                    onClick={() => {
                                                        if (!isDisabled) {
                                                            handleCalendarDateSelect(date);
                                                        }
                                                    }}
                                                >
                                                    {dayNum}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Error messages with icons (similar to InputField) */}
                {shouldShowError && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{props.error || errorMessage}</p>
                    </div>
                )}
                
                {/* FIXED: Only show "Current dates need updating" when THIS field's date is in the past */}
                {isThisFieldDateInPast() && !isUserEditing && (
                    <p className="mt-1 text-amber-600 text-xs flex items-center">
                        <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        Current dates need updating. Use the calendar or manually enter new dates.
                    </p>
                )}
                
                {/* Editing hints */}
                {isUserEditing && checkin && checkout && (
                    <p className="mt-1 text-blue-500 text-xs flex items-center">
                        <svg className="h-4 w-4 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        Update both dates as needed - validation will check when you&apos;re done editing
                    </p>
                )}
            </div>
        </div>
    );
};

export default DateField;