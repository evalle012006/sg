import { useCallback, useEffect, useRef, useState } from "react";
import moment from 'moment';
import { validateDate } from "../../utilities/common";
import { toast } from "react-toastify";

const DateField = (props) => {
    // Basic component state
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState();
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const [isValid, setIsValid] = useState(false);
    
    // Calendar navigation state
    const [showMonthSelector, setShowMonthSelector] = useState(false);
    const [showYearSelector, setShowYearSelector] = useState(false);
    
    // Refs
    const container = useRef();
    const monthRef = useRef();
    const yearRef = useRef();

    // Props with defaults
    const allowPrevDate = props.hasOwnProperty('allowPrevDate') ? props.allowPrevDate : true;
    
    // Determine if this is a booking field that needs cross-validation
    const isBookingField = props.name === 'checkinDate' || props.name === 'checkoutDate';
    const crossValidationValue = props.crossValidationValue || null;

    // Month names for dropdown
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    // Generate year range for dropdown (current year ± 10 years)
    const generateYearRange = () => {
        const currentYear = new Date().getFullYear();
        const years = [];
        for (let i = currentYear - 10; i <= currentYear + 10; i++) {
            years.push(i);
        }
        return years;
    };

    // Open calendar handler
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

    // Calendar navigation functions
    const navigateMonth = (direction) => {
        const newDate = new Date(dateValue);
        newDate.setMonth(newDate.getMonth() + direction);
        setDateValue(newDate);
    };

    const navigateYear = (direction) => {
        const newDate = new Date(dateValue);
        newDate.setFullYear(newDate.getFullYear() + direction);
        setDateValue(newDate);
    };

    const selectMonth = (monthIndex) => {
        const newDate = new Date(dateValue);
        newDate.setMonth(monthIndex);
        setDateValue(newDate);
        setShowMonthSelector(false);
    };

    const selectYear = (selectedYear) => {
        const newDate = new Date(dateValue);
        newDate.setFullYear(selectedYear);
        setDateValue(newDate);
        setShowYearSelector(false);
    };

    const toggleMonthSelector = () => {
        setShowMonthSelector(!showMonthSelector);
        setShowYearSelector(false);
    };

    const toggleYearSelector = () => {
        setShowYearSelector(!showYearSelector);
        setShowMonthSelector(false);
    };

    // Utility functions
    const isDateInPast = (selectedDate) => {
        if (!selectedDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateToCheck = new Date(selectedDate);
        dateToCheck.setHours(0, 0, 0, 0);
        
        return dateToCheck < today;
    };

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

    // Enhanced validation with cross-field validation for booking dates
    const validateCurrentDate = (selectedDate) => {
        // Basic date validation
        const basicValidationError = validateDate(selectedDate);
        if (basicValidationError) {
            return { isValid: false, error: 'Invalid date entered!' };
        }

        // Past date validation
        if (!allowPrevDate && isDateInPast(selectedDate)) {
            return { isValid: false, error: 'Past dates are not allowed!' };
        }

        // Special cross-validation for booking dates
        if (isBookingField && props.name === 'checkinDate' && crossValidationValue) {
            const selectedMoment = moment(selectedDate);
            const checkoutMoment = moment(crossValidationValue);
            
            if (selectedMoment.isSameOrAfter(checkoutMoment, 'day')) {
                return { 
                    isValid: false, 
                    error: 'Check-in date must be before the check-out date' 
                };
            }
        }
        
        if (isBookingField && props.name === 'checkoutDate' && crossValidationValue) {
            const selectedMoment = moment(selectedDate);
            const checkinMoment = moment(crossValidationValue);
            
            if (selectedMoment.isSameOrBefore(checkinMoment, 'day')) {
                return { 
                    isValid: false, 
                    error: 'Check-out date must be after the check-in date' 
                };
            }
        }

        return { isValid: true, error: null };
    };

    // Simplified calendar generation - only disable past dates, handle cross-validation on selection
    const generateCalendarDays = useCallback(() => {
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
            const isPastDate = date.getTime() < today.getTime();
            const isSelected = dayNum.toString() === day && 
                              (currentMonth + 1).toString() === month && 
                              currentYear.toString() === year;
            
            // SIMPLIFIED: Only disable past dates when allowPrevDate is false
            // Cross-validation will be handled on selection with error messages
            const isDisabled = !allowPrevDate && isPastDate;
            
            days.push({
                day: dayNum,
                date,
                isToday,
                isPast: isPastDate,
                isSelected,
                isDisabled
            });
        }
        
        return days;
    }, [dateValue, day, month, year, allowPrevDate]);

    // Handle calendar date selection
    const handleCalendarDateSelect = (selectedDate) => {
        const validation = validateCurrentDate(moment(selectedDate).format('YYYY-MM-DD'));
        
        if (!validation.isValid) {
            toast.error(validation.error);
            return;
        }

        // Set the selected date
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

        // Notify parent
        if (props.onChange) {
            const isoFormattedDate = moment(selectedDate).format('YYYY-MM-DD');
            props.onChange(isoFormattedDate, null);
        }
    };

    // Helper function to notify parent
    const notifyParent = (dayVal, monthVal, yearVal, errorMsg = null) => {
        if (props.onChange) {
            if (dayVal && monthVal && yearVal && yearVal.length === 4) {
                const formattedDate = `${yearVal}-${monthVal.padStart(2, '0')}-${dayVal.padStart(2, '0')}`;
                props.onChange(formattedDate, errorMsg);
            } else if (errorMsg) {
                const formattedDate = (dayVal && monthVal && yearVal) ? 
                    `${yearVal}-${monthVal.padStart(2, '0')}-${dayVal.padStart(2, '0')}` : '';
                props.onChange(formattedDate, errorMsg);
            }
        }
    };

    // Validation state helpers
    const shouldShowError = props.error || (error && dirty);
    const shouldShowValid = !shouldShowError && isValid && dirty && day && month && year;

    // Styling functions
    const getBorderClasses = () => {
        if (shouldShowError) {
            return 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200';
        }
        if (shouldShowValid) {
            return 'border-green-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200';
        }
        return 'border-gray-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200';
    };

    const getBackgroundClasses = () => {
        if (shouldShowError) {
            return 'bg-red-50 focus-within:bg-white';
        }
        if (shouldShowValid) {
            return 'bg-green-50 focus-within:bg-white';
        }
        return 'bg-white';
    };

    // Status icon component
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

    // EFFECTS

    // Initialize from props.value
    useEffect(() => {
        if (props.value) {
            const valArr = props.value.split('-');
            if (valArr.length === 3) {
                setYear(valArr[0]);
                setMonth(valArr[1]);
                setDay(valArr[2]);
                setDateValue(new Date(props.value));
                setDirty(true);
                setIsValid(true);
            }
        }
    }, [props.value]);

    // Handle external error prop
    useEffect(() => {
        if (props.error) {
            setError(true);
            setErrorMessage(props.error);
            setIsValid(false);
        } else if (!props.error && error && errorMessage === props.error) {
            // Only clear if this was the external error
            setError(false);
            setErrorMessage('');
        }
    }, [props.error]);

    // Main validation effect - SIMPLIFIED
    useEffect(() => {
        if (day !== '' && month !== '' && year !== '' && year.length === 4) {
            const selectedDate = `${year}-${month}-${day}`;
            const validation = validateCurrentDate(selectedDate);
            
            if (!validation.isValid) {
                setError(true);
                setErrorMessage(validation.error);
                setIsValid(false);
                toast.error(validation.error);
                notifyParent(day, month, year, validation.error);
            } else {
                // Only clear our own validation errors, not external ones
                if (!props.error) {
                    setError(false);
                    setErrorMessage('');
                }
                setIsValid(true);
                notifyParent(day, month, year, null);
            }
            setDirty(true);
        } else if (props.required && dirty) {
            const requiredError = 'This field is required';
            setError(true);
            setErrorMessage(requiredError);
            setIsValid(false);
            notifyParent(day, month, year, requiredError);
        }
    }, [day, month, year, allowPrevDate, props.required, props.error]);

    // Keyboard and click outside handlers
    const escFunction = useCallback((event) => {
        if (event.key === "Escape") {
          setShowCalendar(false);
          setShowMonthSelector(false);
          setShowYearSelector(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", escFunction, false);
        return () => {
            document.removeEventListener("keydown", escFunction, false);
        };
    }, [escFunction]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (container.current && !container.current.contains(e.target)) {
                setShowCalendar(false);
                setShowMonthSelector(false);
                setShowYearSelector(false);
            }
        };

        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        }
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
                                    setDay(e.target.value);
                                    setDirty(true);
                                    if (e.target.value.length === 2) {
                                        monthRef.current.focus();
                                    }
                                }}
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
                                    setMonth(e.target.value);
                                    setDirty(true);
                                    if (e.target.value.length === 2) {
                                        yearRef.current.focus();
                                    }
                                }}
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
                                    setYear(e.target.value); 
                                    setDirty(true);
                                }}
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
                            
                            {/* Calendar */}
                            {!props?.disabled && showCalendar && (
                                <div className={`mt-1 absolute top-8 ${props.bottom} left-0 ${props.left} bg-white p-4 rounded-lg border border-gray-200 shadow-lg z-50 w-[320px]`}>
                                    {/* Calendar Header */}
                                    <div className="flex items-center justify-between mb-4">
                                        {/* Year Navigation */}
                                        <div className="flex items-center space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => navigateYear(-1)}
                                                className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                aria-label="Previous year"
                                                title="Previous year"
                                            >
                                                ««
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigateMonth(-1)}
                                                className="p-1 hover:bg-gray-100 rounded text-lg font-bold transition-colors"
                                                aria-label="Previous month"
                                                title="Previous month"
                                            >
                                                ‹
                                            </button>
                                        </div>
                                        
                                        {/* Clickable Month/Year Display */}
                                        <div className="flex items-center space-x-2">
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={toggleMonthSelector}
                                                    className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                    title="Select month"
                                                >
                                                    {monthNames[dateValue.getMonth()]}
                                                </button>
                                                
                                                {showMonthSelector && (
                                                    <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-32 max-h-48 overflow-y-auto">
                                                        {monthNames.map((monthName, index) => (
                                                            <button
                                                                key={monthName}
                                                                type="button"
                                                                onClick={() => selectMonth(index)}
                                                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                    ${index === dateValue.getMonth() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                {monthName}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            
                                            <div className="relative">
                                                <button
                                                    type="button"
                                                    onClick={toggleYearSelector}
                                                    className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                    title="Select year"
                                                >
                                                    {dateValue.getFullYear()}
                                                </button>
                                                
                                                {showYearSelector && (
                                                    <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-20 max-h-48 overflow-y-auto">
                                                        {generateYearRange().map((yearOption) => (
                                                            <button
                                                                key={yearOption}
                                                                type="button"
                                                                onClick={() => selectYear(yearOption)}
                                                                className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                    ${yearOption === dateValue.getFullYear() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
                                                            >
                                                                {yearOption}
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        
                                        {/* Forward Navigation */}
                                        <div className="flex items-center space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => navigateMonth(1)}
                                                className="p-1 hover:bg-gray-100 rounded text-lg font-bold transition-colors"
                                                aria-label="Next month"
                                                title="Next month"
                                            >
                                                ›
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => navigateYear(1)}
                                                className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                aria-label="Next year"
                                                title="Next year"
                                            >
                                                »»
                                            </button>
                                        </div>
                                    </div>
                                    
                                    {/* Calendar Grid */}
                                    <div className="grid grid-cols-7 gap-1">
                                        {/* Day headers */}
                                        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(dayName => (
                                            <div key={dayName} className="text-center font-semibold p-2 text-gray-600 text-xs">
                                                {dayName}
                                            </div>
                                        ))}
                                        
                                        {/* Calendar days */}
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
                                    
                                    {/* Navigation Hints */}
                                    <div className="mt-3 text-xs text-gray-500 text-center">
                                        Click month/year to select • Use ‹ › for months • Use «« »» for years
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                
                {/* Error messages */}
                {shouldShowError && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{props.error || errorMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DateField;