import { useCallback, useEffect, useRef, useState } from "react";
import moment from 'moment';
import { validateDate } from "../../utilities/common";
import { toast } from "react-toastify";

const DateRangeField = (props) => {
    const [windowWidth, setWindowWidth] = useState(1024); // Default for SSR
    
    // Track window width for responsive calendar positioning
    useEffect(() => {
        // Set initial width on client side
        if (typeof window !== 'undefined') {
            setWindowWidth(window.innerWidth);
        }
        
        const handleResize = () => {
            if (typeof window !== 'undefined') {
                setWindowWidth(window.innerWidth);
            }
        };
        
        if (typeof window !== 'undefined') {
            window.addEventListener('resize', handleResize);
            return () => window.removeEventListener('resize', handleResize);
        }
    }, []);
    
    // Get calendar positioning classes based on screen size
    const getCalendarPosition = (isStartCalendar = true) => {
        if (windowWidth < 480) { // Mobile
            return 'left-1/2 transform -translate-x-1/2'; // Center on mobile
        } else { // Larger screens
            return isStartCalendar ? 'left-0' : 'right-0';
        }
    };

    const [allowPrevDate, setAllowPrevDate] = useState(props.hasOwnProperty('allowPrevDate') ? props.allowPrevDate : true);
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [showStartCalendar, setShowStartCalendar] = useState(false);
    const [showEndCalendar, setShowEndCalendar] = useState(false);
    const [startDateValue, setStartDateValue] = useState(new Date());
    const [endDateValue, setEndDateValue] = useState(new Date());
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [isValid, setIsValid] = useState(false);
    
    // Start date fields
    const [startDay, setStartDay] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');
    
    // End date fields
    const [endDay, setEndDay] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');
    
    // ADDED: Enhanced navigation state for both calendars
    const [showStartMonthSelector, setShowStartMonthSelector] = useState(false);
    const [showStartYearSelector, setShowStartYearSelector] = useState(false);
    const [showEndMonthSelector, setShowEndMonthSelector] = useState(false);
    const [showEndYearSelector, setShowEndYearSelector] = useState(false);
    
    // ADDED: Track if component has been initialized to prevent re-initialization  
    const [isInitialized, setIsInitialized] = useState(false);
    
    const startContainer = useRef();
    const endContainer = useRef();
    const startMonthRef = useRef();
    const startYearRef = useRef();
    const endMonthRef = useRef();
    const endYearRef = useRef();

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

    // Enhanced navigation functions for start calendar
    const navigateStartMonth = (direction) => {
        const newDate = new Date(startDateValue);
        newDate.setMonth(newDate.getMonth() + direction);
        setStartDateValue(newDate);
    };

    const navigateStartYear = (direction) => {
        const newDate = new Date(startDateValue);
        newDate.setFullYear(newDate.getFullYear() + direction);
        setStartDateValue(newDate);
    };

    const selectStartMonth = (monthIndex) => {
        const newDate = new Date(startDateValue);
        newDate.setMonth(monthIndex);
        setStartDateValue(newDate);
        setShowStartMonthSelector(false);
    };

    const selectStartYear = (selectedYear) => {
        const newDate = new Date(startDateValue);
        newDate.setFullYear(selectedYear);
        setStartDateValue(newDate);
        setShowStartYearSelector(false);
    };

    // Enhanced navigation functions for end calendar
    const navigateEndMonth = (direction) => {
        const newDate = new Date(endDateValue);
        newDate.setMonth(newDate.getMonth() + direction);
        setEndDateValue(newDate);
    };

    const navigateEndYear = (direction) => {
        const newDate = new Date(endDateValue);
        newDate.setFullYear(newDate.getFullYear() + direction);
        setEndDateValue(newDate);
    };

    const selectEndMonth = (monthIndex) => {
        const newDate = new Date(endDateValue);
        newDate.setMonth(monthIndex);
        setEndDateValue(newDate);
        setShowEndMonthSelector(false);
    };

    const selectEndYear = (selectedYear) => {
        const newDate = new Date(endDateValue);
        newDate.setFullYear(selectedYear);
        setEndDateValue(newDate);
        setShowEndYearSelector(false);
    };

    // Toggle selectors for start calendar
    const toggleStartMonthSelector = () => {
        setShowStartMonthSelector(!showStartMonthSelector);
        setShowStartYearSelector(false);
        // Close end calendar selectors
        setShowEndMonthSelector(false);
        setShowEndYearSelector(false);
    };

    const toggleStartYearSelector = () => {
        setShowStartYearSelector(!showStartYearSelector);
        setShowStartMonthSelector(false);
        // Close end calendar selectors
        setShowEndMonthSelector(false);
        setShowEndYearSelector(false);
    };

    // Toggle selectors for end calendar
    const toggleEndMonthSelector = () => {
        setShowEndMonthSelector(!showEndMonthSelector);
        setShowEndYearSelector(false);
        // Close start calendar selectors
        setShowStartMonthSelector(false);
        setShowStartYearSelector(false);
    };

    const toggleEndYearSelector = () => {
        setShowEndYearSelector(!showEndYearSelector);
        setShowEndMonthSelector(false);
        // Close start calendar selectors
        setShowStartMonthSelector(false);
        setShowStartYearSelector(false);
    };

    // Check if a date is in the past
    const isDateInPast = (selectedDate) => {
        if (!selectedDate) return false;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateToCheck = new Date(selectedDate);
        dateToCheck.setHours(0, 0, 0, 0);
        
        return dateToCheck < today;
    };

    // Validation state helpers
    const shouldShowError = props.error || (error && (dirty || props.forceShowErrors));
    const shouldShowValid = !shouldShowError && isValid && (dirty || props.forceShowErrors) && startDate && endDate;

    // Get border and focus colors based on state
    const getBorderClasses = () => {
        if (shouldShowError) {
            return 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200';
        }
        if (shouldShowValid) {
            return 'border-green-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200';
        }
        return 'border-gray-300 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-200';
    };

    // Get background color based on state
    const getBackgroundClasses = () => {
        if (shouldShowError) {
            return 'bg-red-50 focus-within:bg-white';
        }
        if (shouldShowValid) {
            return 'bg-green-50 focus-within:bg-white';
        }
        return 'bg-white';
    };

    // Generate calendar days for current month
    const generateCalendarDays = (dateValue, isStartCalendar = true) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const currentMonth = dateValue.getMonth();
        const currentYear = dateValue.getFullYear();
        
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
            
            let isSelected = false;
            if (isStartCalendar) {
                isSelected = dayNum.toString() === startDay && 
                           (currentMonth + 1).toString() === startMonth && 
                           currentYear.toString() === startYear;
            } else {
                isSelected = dayNum.toString() === endDay && 
                           (currentMonth + 1).toString() === endMonth && 
                           currentYear.toString() === endYear;
            }
            
            let isDisabled = isPast;
            
            // Add range restrictions
            if (!isStartCalendar && startDate) {
                const startDateObj = new Date(startDate);
                startDateObj.setHours(0, 0, 0, 0);
                if (date.getTime() <= startDateObj.getTime()) {
                    isDisabled = true;
                }
            }
            
            if (isStartCalendar && endDate) {
                const endDateObj = new Date(endDate);
                endDateObj.setHours(0, 0, 0, 0);
                if (date.getTime() >= endDateObj.getTime()) {
                    isDisabled = true;
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

    // Legacy navigate month function (keeping for compatibility)
    const navigateMonth = (direction, isStartCalendar = true) => {
        if (isStartCalendar) {
            navigateStartMonth(direction);
        } else {
            navigateEndMonth(direction);
        }
    };

    // Handle calendar date selection
    const handleCalendarDateSelect = (selectedDate, isStartCalendar = true) => {
        if (!allowPrevDate && isDateInPast(selectedDate)) {
            toast.error('Past dates are not allowed!');
            return;
        }

        const formattedDate = moment(selectedDate).format('DD-MM-YYYY');
        const dateArr = formattedDate.split('-');
        
        if (isStartCalendar) {
            setStartDay(dateArr[0]);
            setStartMonth(dateArr[1]);
            setStartYear(dateArr[2]);
            setStartDateValue(selectedDate);
            setStartDate(moment(selectedDate).format('YYYY-MM-DD'));
            setShowStartCalendar(false);
        } else {
            setEndDay(dateArr[0]);
            setEndMonth(dateArr[1]);
            setEndYear(dateArr[2]);
            setEndDateValue(selectedDate);
            setEndDate(moment(selectedDate).format('YYYY-MM-DD'));
            setShowEndCalendar(false);
        }
        
        setDirty(true);
    };

    // Notify parent of changes
    const notifyParent = useCallback(() => {
        if (props.onChange && startDate && endDate) {
            const dateRange = `${startDate} - ${endDate}`;
            
            // ADDED: Prevent notifying parent with the same value that was passed in
            if (dateRange === props.value) {
                return;
            }
            
            // Validate date range
            const startMoment = moment(startDate);
            const endMoment = moment(endDate);
            
            if (!startMoment.isValid() || !endMoment.isValid()) {
                props.onChange(dateRange, 'Invalid date range');
                return;
            }
            
            if (endMoment.isSameOrBefore(startMoment)) {
                props.onChange(dateRange, 'End date must be after start date');
                setError(true);
                setErrorMessage('End date must be after start date');
                setIsValid(false);
                return;
            }
            
            // Valid date range
            props.onChange(dateRange, null);
            setError(false);
            setErrorMessage('');
            setIsValid(true);
        }
    }, [startDate, endDate, props.onChange, props.value]);

    // Effect to handle validation and parent notification
    useEffect(() => {
        if (startDay && startMonth && startYear && startYear.length === 4) {
            const formattedStartDate = `${startYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
            setStartDate(formattedStartDate);
        }
    }, [startDay, startMonth, startYear]);

    useEffect(() => {
        if (endDay && endMonth && endYear && endYear.length === 4) {
            const formattedEndDate = `${endYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
            setEndDate(formattedEndDate);
        }
    }, [endDay, endMonth, endYear]);

    useEffect(() => {
        notifyParent();
    }, [notifyParent]);

    useEffect(() => {
        if (props.value && props.value.includes(' - ')) {
            const [start, end] = props.value.split(' - ');
            if (start && end) {
                const startArr = start.split('-');
                const endArr = end.split('-');
                
                setStartYear(startArr[0]);
                setStartMonth(startArr[1]);
                setStartDay(startArr[2]);
                setStartDate(start);
                setStartDateValue(new Date(start));
                
                setEndYear(endArr[0]);
                setEndMonth(endArr[1]);
                setEndDay(endArr[2]);
                setEndDate(end);
                setEndDateValue(new Date(end));
                
                setDirty(true);
                setIsValid(true);
            }
        }
    }, [props.value]);

    // Validation effect for required fields
    useEffect(() => {
        if (props.required && (dirty || props.forceShowErrors)) {
            if (!startDate || !endDate) {
                setError(true);
                setErrorMessage('Both start and end dates are required');
                setIsValid(false);
            } else {
                // Dates exist, validate the range
                const startMoment = moment(startDate);
                const endMoment = moment(endDate);
                
                if (!startMoment.isValid() || !endMoment.isValid()) {
                    setError(true);
                    setErrorMessage('Invalid date range');
                    setIsValid(false);
                } else if (endMoment.isSameOrBefore(startMoment)) {
                    setError(true);
                    setErrorMessage('End date must be after start date');
                    setIsValid(false);
                } else {
                    if (!props.error) {  // Only clear if no external error
                        setError(false);
                        setErrorMessage('');
                    }
                    setIsValid(true);
                }
            }
        } else if (!props.required && !dirty && !props.forceShowErrors) {
            setError(false);
            setErrorMessage('');
            setIsValid(false);
        }
    }, [startDate, endDate, props.required, props.forceShowErrors, dirty, props.error]);

    // Handle click outside to close calendars and selectors
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (startContainer.current && !startContainer.current.contains(e.target)) {
                setShowStartCalendar(false);
                setShowStartMonthSelector(false);
                setShowStartYearSelector(false);
            }
            if (endContainer.current && !endContainer.current.contains(e.target)) {
                setShowEndCalendar(false);
                setShowEndMonthSelector(false);
                setShowEndYearSelector(false);
            }
        };

        document.addEventListener('click', handleClickOutside, true);
        return () => {
            document.removeEventListener('click', handleClickOutside, true);
        }
    }, []);

    // Handle escape key
    const escFunction = useCallback((event) => {
        if (event.key === "Escape") {
            setShowStartCalendar(false);
            setShowEndCalendar(false);
            setShowStartMonthSelector(false);
            setShowStartYearSelector(false);
            setShowEndMonthSelector(false);
            setShowEndYearSelector(false);
        }
    }, []);

    useEffect(() => {
        document.addEventListener("keydown", escFunction, false);
        return () => {
            document.removeEventListener("keydown", escFunction, false);
        };
    }, []);

    return (
        <div className="flex mb-2 w-full" style={{ width: props.width || 'auto' }}>
            <div className="mb-3 w-full max-w-xs">
                {props.label && (
                    <label 
                        htmlFor={props.label} 
                        className={`font-semibold form-label inline-block mb-1.5 text-sm ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}
                    >
                        {props.label}
                        {props.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                
                <div className={`block w-full px-3 py-3 text-sm font-normal text-gray-700 bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition-all ease-in-out duration-200 focus-within:text-gray-700 focus-within:outline-none 
                                ${getBorderClasses()} ${getBackgroundClasses()}`}>
                    <div className="relative">
                        <div className="flex flex-row items-center justify-between w-full">
                            {/* Start Date */}
                            <div className="flex flex-row items-center flex-1" ref={startContainer}>
                                <input 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={startDay} 
                                    className="w-6 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm touch-manipulation" 
                                    onChange={(e) => {
                                        setStartDay(e.target.value);
                                        setDirty(true);
                                        if (e.target.value.length == 2) {
                                            startMonthRef.current.focus();
                                        }
                                    }}
                                    placeholder="DD" 
                                    maxLength="2"
                                />
                                <p className="mx-0.5 text-gray-300 text-sm">/</p>
                                <input 
                                    ref={startMonthRef} 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={startMonth} 
                                    className="w-6 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm touch-manipulation" 
                                    onChange={(e) => {
                                        setStartMonth(e.target.value);
                                        setDirty(true);
                                        if (e.target.value.length == 2) {
                                            startYearRef.current.focus();
                                        }
                                    }}
                                    placeholder="MM" 
                                    maxLength="2"
                                />
                                <p className="mx-0.5 text-gray-300 text-sm">/</p>
                                <input 
                                    ref={startYearRef} 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={startYear} 
                                    className="w-10 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm touch-manipulation" 
                                    onChange={(e) => { 
                                        setStartYear(e.target.value); 
                                        setDirty(true);
                                    }}
                                    placeholder="YYYY" 
                                    maxLength="4"
                                />
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    strokeWidth="1.5" 
                                    stroke="currentColor" 
                                    className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-blue-600 transition-colors ml-1 touch-manipulation" 
                                    onClick={() => setShowStartCalendar(true)}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                
                                {/* Enhanced Start Date Calendar */}
                                {!props?.disabled && showStartCalendar && (
                                    <div className={`mt-1 absolute top-8 ${getCalendarPosition(true)} bg-white p-4 rounded-lg border border-gray-200 shadow-lg z-50 w-[320px] max-w-[calc(100vw-2rem)]`}>
                                        {/* Enhanced Calendar Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            {/* Year Navigation */}
                                            <div className="flex items-center space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => navigateStartYear(-1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                    aria-label="Previous year"
                                                    title="Previous year"
                                                >
                                                    ««
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigateStartMonth(-1)}
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
                                                        onClick={toggleStartMonthSelector}
                                                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                        title="Select month"
                                                    >
                                                        {monthNames[startDateValue.getMonth()]}
                                                    </button>
                                                    
                                                    {/* Month Selector Dropdown */}
                                                    {showStartMonthSelector && (
                                                        <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-32 max-h-48 overflow-y-auto">
                                                            {monthNames.map((monthName, index) => (
                                                                <button
                                                                    key={monthName}
                                                                    type="button"
                                                                    onClick={() => selectStartMonth(index)}
                                                                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                        ${index === startDateValue.getMonth() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
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
                                                        onClick={toggleStartYearSelector}
                                                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                        title="Select year"
                                                    >
                                                        {startDateValue.getFullYear()}
                                                    </button>
                                                    
                                                    {/* Year Selector Dropdown */}
                                                    {showStartYearSelector && (
                                                        <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-20 max-h-48 overflow-y-auto">
                                                            {generateYearRange().map((yearOption) => (
                                                                <button
                                                                    key={yearOption}
                                                                    type="button"
                                                                    onClick={() => selectStartYear(yearOption)}
                                                                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                        ${yearOption === startDateValue.getFullYear() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
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
                                                    onClick={() => navigateStartMonth(1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-lg font-bold transition-colors"
                                                    aria-label="Next month"
                                                    title="Next month"
                                                >
                                                    ›
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigateStartYear(1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                    aria-label="Next year"
                                                    title="Next year"
                                                >
                                                    »»
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-7 gap-1">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(dayName => (
                                                <div key={dayName} className="text-center font-semibold p-2 text-gray-600 text-xs">
                                                    {dayName}
                                                </div>
                                            ))}
                                            
                                            {generateCalendarDays(startDateValue, true).map((dayObj, index) => {
                                                if (!dayObj) {
                                                    return <div key={`start-empty-${index}`} className="p-2"></div>;
                                                }
                                                
                                                const { day: dayNum, date, isToday, isSelected, isDisabled } = dayObj;
                                                
                                                return (
                                                    <button
                                                        key={`start-day-${dayNum}`}
                                                        type="button"
                                                        disabled={isDisabled}
                                                        className={`
                                                            p-2 text-center rounded-md transition-all duration-200 text-sm font-medium h-8 w-8 flex items-center justify-center touch-manipulation
                                                            ${isDisabled ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50 cursor-pointer hover:scale-105'}
                                                            ${isToday && !isDisabled ? 'bg-blue-100 font-bold border-2 border-blue-300 text-blue-700' : ''}
                                                            ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : ''}
                                                            ${!isSelected && !isToday && !isDisabled ? 'hover:bg-blue-50 hover:text-blue-600' : ''}
                                                        `}
                                                        onClick={() => {
                                                            if (!isDisabled) {
                                                                handleCalendarDateSelect(date, true);
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

                            {/* Separator */}
                            <div className="flex items-center px-0.5">
                                <span className="text-gray-400 font-medium text-xs">to</span>
                            </div>

                            {/* End Date */}
                            <div className="flex flex-row items-center" ref={endContainer}>
                                <input 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={endDay} 
                                    className="w-6 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm" 
                                    onChange={(e) => {
                                        setEndDay(e.target.value);
                                        setDirty(true);
                                        if (e.target.value.length == 2) {
                                            endMonthRef.current.focus();
                                        }
                                    }}
                                    placeholder="DD" 
                                />
                                <p className="mx-0.5 text-gray-300 text-sm">/</p>
                                <input 
                                    ref={endMonthRef} 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={endMonth} 
                                    className="w-6 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm" 
                                    onChange={(e) => {
                                        setEndMonth(e.target.value);
                                        setDirty(true);
                                        if (e.target.value.length == 2) {
                                            endYearRef.current.focus();
                                        }
                                    }}
                                    placeholder="MM" 
                                />
                                <p className="mx-0.5 text-gray-300 text-sm">/</p>
                                <input 
                                    ref={endYearRef} 
                                    type="text" 
                                    disabled={props.disabled} 
                                    value={endYear} 
                                    className="w-10 border-0 focus:outline-none bg-transparent placeholder:text-gray-400 text-center text-sm" 
                                    onChange={(e) => { 
                                        setEndYear(e.target.value); 
                                        setDirty(true);
                                    }}
                                    placeholder="YYYY" 
                                />
                                <svg 
                                    xmlns="http://www.w3.org/2000/svg" 
                                    fill="none" 
                                    viewBox="0 0 24 24" 
                                    strokeWidth="1.5" 
                                    stroke="currentColor" 
                                    className="w-3.5 h-3.5 cursor-pointer text-gray-500 hover:text-blue-600 transition-colors ml-1" 
                                    onClick={() => setShowEndCalendar(true)}
                                >
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                
                                {/* Enhanced End Date Calendar */}
                                {!props?.disabled && showEndCalendar && (
                                    <div className={`mt-1 absolute top-8 ${getCalendarPosition(false)} bg-white p-4 rounded-lg border border-gray-200 shadow-lg z-50 w-[320px] max-w-[calc(100vw-2rem)]`}>
                                        {/* Enhanced Calendar Header */}
                                        <div className="flex items-center justify-between mb-4">
                                            {/* Year Navigation */}
                                            <div className="flex items-center space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => navigateEndYear(-1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                    aria-label="Previous year"
                                                    title="Previous year"
                                                >
                                                    ««
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigateEndMonth(-1)}
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
                                                        onClick={toggleEndMonthSelector}
                                                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                        title="Select month"
                                                    >
                                                        {monthNames[endDateValue.getMonth()]}
                                                    </button>
                                                    
                                                    {/* Month Selector Dropdown */}
                                                    {showEndMonthSelector && (
                                                        <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-32 max-h-48 overflow-y-auto">
                                                            {monthNames.map((monthName, index) => (
                                                                <button
                                                                    key={monthName}
                                                                    type="button"
                                                                    onClick={() => selectEndMonth(index)}
                                                                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                        ${index === endDateValue.getMonth() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
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
                                                        onClick={toggleEndYearSelector}
                                                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors cursor-pointer px-2 py-1 rounded hover:bg-gray-100"
                                                        title="Select year"
                                                    >
                                                        {endDateValue.getFullYear()}
                                                    </button>
                                                    
                                                    {/* Year Selector Dropdown */}
                                                    {showEndYearSelector && (
                                                        <div className="absolute top-8 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-60 w-20 max-h-48 overflow-y-auto">
                                                            {generateYearRange().map((yearOption) => (
                                                                <button
                                                                    key={yearOption}
                                                                    type="button"
                                                                    onClick={() => selectEndYear(yearOption)}
                                                                    className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition-colors text-sm
                                                                        ${yearOption === endDateValue.getFullYear() ? 'bg-blue-100 text-blue-700 font-medium' : 'text-gray-700'}`}
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
                                                    onClick={() => navigateEndMonth(1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-lg font-bold transition-colors"
                                                    aria-label="Next month"
                                                    title="Next month"
                                                >
                                                    ›
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => navigateEndYear(1)}
                                                    className="p-1 hover:bg-gray-100 rounded text-sm font-bold transition-colors"
                                                    aria-label="Next year"
                                                    title="Next year"
                                                >
                                                    »»
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <div className="grid grid-cols-7 gap-1">
                                            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(dayName => (
                                                <div key={dayName} className="text-center font-semibold p-2 text-gray-600 text-xs">
                                                    {dayName}
                                                </div>
                                            ))}
                                            
                                            {generateCalendarDays(endDateValue, false).map((dayObj, index) => {
                                                if (!dayObj) {
                                                    return <div key={`end-empty-${index}`} className="p-2"></div>;
                                                }
                                                
                                                const { day: dayNum, date, isToday, isSelected, isDisabled } = dayObj;
                                                
                                                return (
                                                    <button
                                                        key={`end-day-${dayNum}`}
                                                        type="button"
                                                        disabled={isDisabled}
                                                        className={`
                                                            p-2 text-center rounded-md transition-all duration-200 text-sm font-medium h-8 w-8 flex items-center justify-center touch-manipulation
                                                            ${isDisabled ? 'text-gray-300 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50 cursor-pointer hover:scale-105'}
                                                            ${isToday && !isDisabled ? 'bg-blue-100 font-bold border-2 border-blue-300 text-blue-700' : ''}
                                                            ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : ''}
                                                            ${!isSelected && !isToday && !isDisabled ? 'hover:bg-blue-50 hover:text-blue-600' : ''}
                                                        `}
                                                        onClick={() => {
                                                            if (!isDisabled) {
                                                                handleCalendarDateSelect(date, false);
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

export default DateRangeField;