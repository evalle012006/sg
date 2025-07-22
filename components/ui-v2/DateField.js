import React, { useState, useRef, useEffect } from 'react';
import { Calendar } from 'lucide-react';

/**
 * Date component that allows selecting a date or date range
 * 
 * @param {Object} props
 * @param {string} props.label - Label for the date input
 * @param {string|Array} props.value - Selected date value(s)
 * @param {Function} props.onChange - Function called when date changes
 * @param {boolean} props.required - Whether the field is required
 * @param {string} props.error - Error message to display
 * @param {boolean} props.disabled - Whether the field is disabled
 * @param {boolean} props.range - Whether to allow selecting a date range
 * @param {string} props.size - Size of the component (small, medium, large)
 * @param {string} props.format - Date format (default: "DD/MM/YYYY")
 * @param {boolean} props.allowPrevDate - Whether past dates are allowed (default: true)
 * @param {boolean} props.blockSundays - Whether to block Sunday selection (default: false)
 */
const DateComponent = (props) => {
  const {
    label,
    value = '',
    onChange,
    required = false,
    error = '',
    disabled = false,
    range = false,
    size = 'medium',
    format = 'DD/MM/YYYY',
    allowPrevDate = true,
    blockSundays = false
  } = props;

  // Create refs for input fields and container
  const containerRef = useRef(null);
  const dayInputRef = useRef(null);
  const monthInputRef = useRef(null);
  const yearInputRef = useRef(null);
  
  // State for input fields
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  
  // For range selection
  const [endDay, setEndDay] = useState('');
  const [endMonth, setEndMonth] = useState('');
  const [endYear, setEndYear] = useState('');
  
  // State for validation and UI
  const [dateError, setDateError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [showCalendar, setShowCalendar] = useState(false);
  const [isUpdatingFromValue, setIsUpdatingFromValue] = useState(false);
  
  // Function to check if a date is in the past (excluding today)
  const isDateInPast = (selectedDate) => {
    if (!selectedDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time part for accurate date comparison
    
    const dateToCheck = new Date(selectedDate);
    dateToCheck.setHours(0, 0, 0, 0);
    
    // Use < instead of <= to allow today's date
    return dateToCheck < today;
  };

  // Function to check if a date is a Sunday
  const isSunday = (selectedDate) => {
    if (!selectedDate) return false;
    const dateToCheck = new Date(selectedDate);
    return dateToCheck.getDay() === 0; // Sunday is 0
  };
  
  // Helper function to construct properly formatted date string
  const constructDateString = (d, m, y) => {
    if (!d || !m || !y || y.length !== 4) return null;
    
    const paddedDay = d.toString().padStart(2, '0');
    const paddedMonth = m.toString().padStart(2, '0');
    
    return `${y}-${paddedMonth}-${paddedDay}`;
  };
  
  // Validate date with improved logic
  const validateDate = () => {
    if (!day || !month || !year || year.length !== 4) {
      if (required && dirty) {
        setDateError('This field is required');
        return false;
      }
      setDateError(''); // Clear error if incomplete but not required
      return true; // Incomplete but not required or not dirty yet
    }
    
    // Parse individual components
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    // Basic range checks
    if (dayNum < 1 || dayNum > 31) {
      setDateError('Invalid day entered');
      return false;
    }
    
    if (monthNum < 1 || monthNum > 12) {
      setDateError('Invalid month entered');
      return false;
    }
    
    if (yearNum < 1900 || yearNum > 2100) {
      setDateError('Invalid year entered');
      return false;
    }
    
    // Construct properly formatted date string
    const dateStr = constructDateString(day, month, year);
    if (!dateStr) {
      setDateError('Invalid date entered');
      return false;
    }
    
    // Create date object and check if it's valid
    const dateObj = new Date(dateStr);
    
    if (isNaN(dateObj.getTime())) {
      setDateError('Invalid date entered');
      return false;
    }
    
    // Check if the date components match (this catches invalid dates like Feb 30)
    if (dateObj.getFullYear() !== yearNum || 
        dateObj.getMonth() !== monthNum - 1 || 
        dateObj.getDate() !== dayNum) {
      setDateError('Invalid date entered');
      return false;
    }
    
    // Check if past dates are allowed
    if (allowPrevDate === false && isDateInPast(dateObj)) {
      setDateError('Past dates are not allowed');
      return false;
    }

    // Check if Sundays are blocked
    if (blockSundays && isSunday(dateObj)) {
      setDateError('Sunday selection is not allowed');
      return false;
    }
    
    // Date is valid
    setDateError('');
    return true;
  };
  
  // Parse input value on component load and value changes
  useEffect(() => {
    // Prevent feedback loops when we're updating from manual input
    if (isUpdatingFromValue) return;
    
    if (!value) {
      // Reset fields if value is empty
      setDay('');
      setMonth('');
      setYear('');
      setEndDay('');
      setEndMonth('');
      setEndYear('');
      return;
    }
    
    if (range && Array.isArray(value)) {
      // Handle start date
      if (value[0]) {
        const date = new Date(value[0]);
        if (!isNaN(date.getTime())) {
          setDay(date.getDate().toString());
          setMonth((date.getMonth() + 1).toString());
          setYear(date.getFullYear().toString());
          setCalendarDate(date);
        }
      } else {
        setDay('');
        setMonth('');
        setYear('');
      }
      
      // Handle end date
      if (value[1]) {
        const date = new Date(value[1]);
        if (!isNaN(date.getTime())) {
          setEndDay(date.getDate().toString());
          setEndMonth((date.getMonth() + 1).toString());
          setEndYear(date.getFullYear().toString());
        }
      } else {
        setEndDay('');
        setEndMonth('');
        setEndYear('');
      }
    } else {
      // Handle single date (string value)
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        setDay(date.getDate().toString());
        setMonth((date.getMonth() + 1).toString());
        setYear(date.getFullYear().toString());
        setCalendarDate(date);
      }
    }
  }, [value, range, isUpdatingFromValue]);
  
  // Close calendar when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setShowCalendar(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Close calendar on escape key
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setShowCalendar(false);
      }
    };
    
    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);
  
  // Handle day input change
  const handleDayChange = (e) => {
    const value = e.target.value;
    if (/^\d{0,2}$/.test(value)) {
      setDay(value);
      setDirty(true);
      
      // Remove auto-advance to prevent interfering with multi-digit input
      // Users can manually tab or click to the next field
    }
  };
  
  // Handle month input change
  const handleMonthChange = (e) => {
    const value = e.target.value;
    if (/^\d{0,2}$/.test(value)) {
      setMonth(value);
      setDirty(true);
      
      // Remove auto-advance to prevent interfering with multi-digit input
      // Users can manually tab or click to the next field
    }
  };
  
  // Handle year input change
  const handleYearChange = (e) => {
    const value = e.target.value;
    if (/^\d{0,4}$/.test(value)) {
      setYear(value);
      setDirty(true);
    }
  };
  
  // Run validation and notify parent when inputs change
  useEffect(() => {
    if (dirty && day && month && year && year.length === 4) {
      const isValid = validateDate();
      
      if (isValid) {
        const dateStr = constructDateString(day, month, year);
        
        if (dateStr) {
          // Update calendar date
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            setCalendarDate(dateObj);
          }
          
          // Notify parent component for single date mode
          if (onChange && !range) {
            setIsUpdatingFromValue(true);
            onChange(dateStr);
            // Reset the flag after a brief delay to allow the effect to complete
            setTimeout(() => setIsUpdatingFromValue(false), 0);
          }
        }
      }
    } else if (dirty) {
      // If fields are incomplete, run validation to show appropriate errors
      validateDate();
    }
  }, [day, month, year, dirty, allowPrevDate, blockSundays]);
  
  // Handle validation and updates for range mode
  useEffect(() => {
    if (range && dirty && day && month && year && year.length === 4 && 
        endDay && endMonth && endYear && endYear.length === 4) {
      
      const startDateStr = constructDateString(day, month, year);
      const endDateStr = constructDateString(endDay, endMonth, endYear);
      
      if (!startDateStr || !endDateStr) return;
      
      // Validate both dates
      const startDateObj = new Date(startDateStr);
      const endDateObj = new Date(endDateStr);
      
      if (!isNaN(startDateObj.getTime()) && !isNaN(endDateObj.getTime())) {
        // Check if end date is after start date
        if (endDateObj < startDateObj) {
          setDateError('End date must be after or same as start date');
          return;
        }

        // Check if Sundays are blocked for both dates
        if (blockSundays) {
          if (isSunday(startDateObj)) {
            setDateError('Sunday selection is not allowed for start date');
            return;
          }
          if (isSunday(endDateObj)) {
            setDateError('Sunday selection is not allowed for end date');
            return;
          }
        }
        
        // Both dates are valid
        setDateError('');
        
        // Notify parent component for range mode
        if (onChange) {
          setIsUpdatingFromValue(true);
          onChange(startDateStr, endDateStr);
          setTimeout(() => setIsUpdatingFromValue(false), 0);
        }
      }
    }
  }, [range, day, month, year, endDay, endMonth, endYear, dirty, blockSundays]);
  
  // Handle calendar toggle
  const toggleCalendar = () => {
    setShowCalendar(!showCalendar);
  };
  
  // Keep track of which date we're selecting in range mode
  const [selectingSecondDate, setSelectingSecondDate] = useState(false);
  
  // Handle calendar date selection
  const handleDateSelect = (date) => {
    if (!date) return;
    
    const selectedDate = new Date(date);
    const formattedDay = selectedDate.getDate().toString();
    const formattedMonth = (selectedDate.getMonth() + 1).toString();
    const formattedYear = selectedDate.getFullYear().toString();
    
    if (range) {
      if (!selectingSecondDate) {
        // First date selection
        setDay(formattedDay);
        setMonth(formattedMonth);
        setYear(formattedYear);
        setDirty(true);
        
        // Clear second date
        setEndDay('');
        setEndMonth('');
        setEndYear('');
        
        // Next selection will be the second date
        setSelectingSecondDate(true);
        setCalendarDate(selectedDate);
        
        if (onChange) {
          setIsUpdatingFromValue(true);
          onChange(`${formattedYear}-${formattedMonth.padStart(2, '0')}-${formattedDay.padStart(2, '0')}`, '');
          setTimeout(() => setIsUpdatingFromValue(false), 0);
        }
      } else {
        // Second date selection
        const firstDate = new Date(constructDateString(day, month, year));
        
        if (selectedDate < firstDate) {
          // Swap dates if second date is before first
          setEndDay(day);
          setEndMonth(month);
          setEndYear(year);
          
          setDay(formattedDay);
          setMonth(formattedMonth);
          setYear(formattedYear);
        } else {
          setEndDay(formattedDay);
          setEndMonth(formattedMonth);
          setEndYear(formattedYear);
        }
        
        setSelectingSecondDate(false);
        setShowCalendar(false);
        setDirty(true);
        
        if (onChange) {
          setIsUpdatingFromValue(true);
          if (selectedDate < firstDate) {
            onChange(
              `${formattedYear}-${formattedMonth.padStart(2, '0')}-${formattedDay.padStart(2, '0')}`, 
              `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
            );
          } else {
            onChange(
              `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`, 
              `${formattedYear}-${formattedMonth.padStart(2, '0')}-${formattedDay.padStart(2, '0')}`
            );
          }
          setTimeout(() => setIsUpdatingFromValue(false), 0);
        }
      }
    } else {
      // Single date selection
      setDay(formattedDay);
      setMonth(formattedMonth);
      setYear(formattedYear);
      setDirty(true);
      
      setCalendarDate(selectedDate);
      setShowCalendar(false);
      
      if (onChange) {
        setIsUpdatingFromValue(true);
        onChange(`${formattedYear}-${formattedMonth.padStart(2, '0')}-${formattedDay.padStart(2, '0')}`);
        setTimeout(() => setIsUpdatingFromValue(false), 0);
      }
    }
  };
  
  // Calculate component classes based on size
  const getSizeClasses = () => {
    switch (size) {
      case 'small':
        return 'h-8 py-1 text-sm';
      case 'large':
        return 'h-12 py-3 text-lg';
      case 'medium':
      default:
        return 'h-12 py-2.5 text-base';
    }
  };

  // Generate calendar days for current month
  const generateCalendarDays = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date
    
    const currentMonth = calendarDate.getMonth();
    const currentYear = calendarDate.getFullYear();
    
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
      date.setHours(0, 0, 0, 0); // Normalize the date
      
      const isToday = date.getTime() === today.getTime();
      // FIXED: Use < instead of <= to allow current date
      const isPast = allowPrevDate === false && date.getTime() < today.getTime();
      const isSundayDate = blockSundays && date.getDay() === 0; // Check if it's Sunday and blocked
      const isSelected = dayNum.toString() === day && 
                        (currentMonth + 1).toString() === month && 
                        currentYear.toString() === year;
      
      days.push({
        day: dayNum,
        date,
        isToday,
        isPast,
        isSunday: isSundayDate,
        isSelected,
        isDisabled: isPast || isSundayDate
      });
    }
    
    return days;
  };

  const navigateMonth = (direction) => {
    const newDate = new Date(calendarDate);
    newDate.setMonth(newDate.getMonth() + direction);
    setCalendarDate(newDate);
  };

  return (
    <div className="w-full max-w-md" ref={containerRef}>
      {label && (
        <label className={`block mb-1.5 font-semibold text-slate-700 ${disabled ? 'text-gray-400' : ''} ${required ? 'after:content-["*"] after:ml-0.5 after:text-red-500' : ''}`}>
          {label}
        </label>
      )}
      
      <div 
        className={`
          relative flex items-center 
          border rounded-xl px-4 ${getSizeClasses()}
          ${(error || dateError) ? 'border-red-500' : 'border-gray-300'}
          ${disabled ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-800'}
          focus-within:ring-1 focus-within:ring-blue-300 focus-within:border-blue-400
        `}
      >
        <div className="flex items-center flex-1">
          {/* Date input fields for single date */}
          {!range && (
            <div className="flex items-center">
              <input
                ref={dayInputRef}
                type="text" 
                className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                placeholder="DD"
                maxLength={2}
                value={day}
                onChange={handleDayChange}
                disabled={disabled}
              />
              <span className="mx-1 text-gray-300">/</span>
              <input
                ref={monthInputRef}
                type="text"
                className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                placeholder="MM"
                maxLength={2}
                value={month}
                onChange={handleMonthChange}
                disabled={disabled}
              />
              <span className="mx-1 text-gray-300">/</span>
              <input
                ref={yearInputRef}
                type="text"
                className="w-12 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                placeholder="YYYY"
                maxLength={4}
                value={year}
                onChange={handleYearChange}
                disabled={disabled}
              />
            </div>
          )}
          
          {/* Date input fields for date range */}
          {range && (
            <div className="flex items-center">
              <div className="flex items-center">
                <input
                  type="text" 
                  className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="DD"
                  maxLength={2}
                  value={day}
                  onChange={handleDayChange}
                  disabled={disabled}
                />
                <span className="mx-1 text-gray-300">/</span>
                <input
                  type="text"
                  className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="MM"
                  maxLength={2}
                  value={month}
                  onChange={handleMonthChange}
                  disabled={disabled}
                />
                <span className="mx-1 text-gray-300">/</span>
                <input
                  type="text"
                  className="w-12 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="YYYY"
                  maxLength={4}
                  value={year}
                  onChange={handleYearChange}
                  disabled={disabled}
                />
              </div>
              
              <span className="mx-2 font-medium text-gray-500">/</span>
              
              <div className="flex items-center">
                <input
                  type="text" 
                  className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="DD"
                  maxLength={2}
                  value={endDay}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,2}$/.test(value)) {
                      setEndDay(value);
                      setDirty(true);
                      // No auto-advance for range end fields to avoid confusion
                    }
                  }}
                  disabled={disabled}
                />
                <span className="mx-1 text-gray-300">/</span>
                <input
                  type="text"
                  className="w-8 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="MM"
                  maxLength={2}
                  value={endMonth}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,2}$/.test(value)) {
                      setEndMonth(value);
                      setDirty(true);
                      // No auto-advance for range end fields to avoid confusion
                    }
                  }}
                  disabled={disabled}
                />
                <span className="mx-1 text-gray-300">/</span>
                <input
                  type="text"
                  className="w-12 border-0 focus:outline-none bg-transparent placeholder-gray-400 text-center"
                  placeholder="YYYY"
                  maxLength={4}
                  value={endYear}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (/^\d{0,4}$/.test(value)) {
                      setEndYear(value);
                      setDirty(true);
                      // No auto-advance for range end fields to avoid confusion
                    }
                  }}
                  disabled={disabled}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* Calendar icon */}
        <button 
          type="button"
          className={`ml-2 flex items-center justify-center p-1 rounded-full focus:outline-none ${disabled ? 'text-gray-400 cursor-not-allowed' : 'text-blue-800 hover:bg-blue-50 cursor-pointer'}`}
          onClick={disabled ? undefined : toggleCalendar}
          disabled={disabled}
          aria-label="Open calendar"
        >
          <Calendar size={size === 'small' ? 16 : 20} />
        </button>
        
        {/* Calendar dropdown */}
        {showCalendar && !disabled && (
          <div className="absolute top-full left-0 mt-1 z-50">
            <div className="bg-white p-4 rounded-lg border border-gray-300 shadow-lg min-w-[280px]">
              {range && (
                <div className="mb-2 text-sm text-gray-700 px-2">
                  {selectingSecondDate ? 
                    <span>Select end date</span> : 
                    <span>Select start date</span>
                  }
                </div>
              )}

              {blockSundays && (
                <div className="mb-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
                  <span>⚠️ Sunday selection is disabled</span>
                </div>
              )}
              
              {/* Calendar Header */}
              <div className="flex items-center justify-between mb-4">
                <button
                  type="button"
                  onClick={() => navigateMonth(-1)}
                  className="p-1 hover:bg-gray-100 rounded"
                  aria-label="Previous month"
                >
                  ←
                </button>
                <h3 className="font-semibold">
                  {calendarDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  type="button"
                  onClick={() => navigateMonth(1)}
                  className="p-1 hover:bg-gray-100 rounded"
                  aria-label="Next month"
                >
                  →
                </button>
              </div>
              
              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1 text-sm">
                {/* Day headers */}
                {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((dayName, index) => (
                  <div key={dayName} className={`text-center font-medium p-2 ${index === 0 && blockSundays ? 'text-red-400' : 'text-gray-500'}`}>
                    {dayName}
                  </div>
                ))}
                
                {/* Calendar days */}
                {generateCalendarDays().map((dayObj, index) => {
                  if (!dayObj) {
                    return <div key={index} className="p-2"></div>;
                  }
                  
                  const { day: dayNum, date, isToday, isPast, isSunday, isSelected, isDisabled } = dayObj;
                  
                  return (
                    <button
                      key={dayNum}
                      type="button"
                      disabled={isDisabled}
                      className={`
                        p-2 text-center rounded transition-colors text-sm
                        ${isDisabled ? 'text-gray-400 cursor-not-allowed' : 'hover:bg-blue-50 cursor-pointer'}
                        ${isSunday && !isDisabled ? 'bg-red-50 text-red-500' : ''}
                        ${isToday && !isDisabled ? 'bg-blue-100 font-semibold border border-blue-300' : ''}
                        ${isSelected ? 'bg-blue-600 text-white font-semibold' : ''}
                      `}
                      onClick={() => {
                        if (!isDisabled) {
                          handleDateSelect(date);
                        }
                      }}
                      title={isSunday ? 'Sunday selection is disabled' : ''}
                    >
                      {dayNum}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {/* Error message */}
      <div className="h-5 mt-1.5">
        {(error || dateError) && (
          <p className="text-xs text-red-500">{error || dateError}</p>
        )}
      </div>
    </div>
  );
};

export default DateComponent;