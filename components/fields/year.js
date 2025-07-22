import { useCallback, useEffect, useRef, useState } from "react";
import moment from 'moment';

const YearField = (props) => {
    const {
        label,
        defaultValue,
        onBlur,
        onChange,
        className,
        required = false,
        error: propsError,
        width,
        disabled = false,
        placeholder = "YYYY",
        size = "medium",
        ...otherProps
    } = props;

    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [year, setYear] = useState('');
    const [isValid, setIsValid] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    
    const container = useRef();
    const yearRef = useRef();
    const calendarRef = useRef(); // Add calendar ref

    const openCalendar = () => {
        if (!disabled) {
            setShowCalendar(true);
            setIsFocused(true);
        }
    };

    // Generate years for the decade view
    const generateDecadeYears = () => {
        const currentYear = dateValue.getFullYear();
        const currentDecade = Math.floor(currentYear / 10) * 10;
        const years = [];
        const selectedYear = year;
        
        // Add previous decade's last year
        years.push({
            year: currentDecade - 1,
            isCurrentDecade: false,
            isSelected: (currentDecade - 1).toString() === selectedYear,
            isToday: (currentDecade - 1) === new Date().getFullYear()
        });
        
        // Add current decade years
        for (let i = 0; i < 10; i++) {
            const yearNum = currentDecade + i;
            years.push({
                year: yearNum,
                isCurrentDecade: true,
                isSelected: yearNum.toString() === selectedYear,
                isToday: yearNum === new Date().getFullYear()
            });
        }
        
        // Add next decade's first year
        years.push({
            year: currentDecade + 10,
            isCurrentDecade: false,
            isSelected: (currentDecade + 10).toString() === selectedYear,
            isToday: (currentDecade + 10) === new Date().getFullYear()
        });
        
        return years;
    };

    // Navigate decades
    const navigateDecade = (direction) => {
        const newDate = new Date(dateValue);
        newDate.setFullYear(newDate.getFullYear() + (direction * 10));
        setDateValue(newDate);
    };

    // Handle year selection from calendar - EXACTLY like original with debugging
    const handleYearSelect = (selectedYear) => {
        setYear(selectedYear.toString());
        setDateValue(new Date(selectedYear, 0, 1));
        setShowCalendar(false);
        setDirty(true);
        setIsFocused(false);
    };

    // Handle default value - EXACTLY like original  
    useEffect(() => {
        if (defaultValue) {
            let yearValue = '';
            if (typeof defaultValue === 'string' && defaultValue.includes('-')) {
                const valArr = defaultValue.split('-');
                yearValue = valArr[0];
            } else {
                yearValue = defaultValue.toString();
            }
            setYear(yearValue);
            setDateValue(new Date(defaultValue));
            setDirty(true);
        }
    }, [defaultValue]);

    // Handle year changes - EXACTLY like original, but WITHOUT onBlur in dependencies
    useEffect(() => {
        if (year !== '' && year.toString().length === 4) {
            if (onBlur) {
                onBlur(year);
            }
            setError(false);
            setDirty(true);
            setIsValid(true);
        } else if (required && dirty) {
            setError(true);
            setErrorMessage('This field is required');
            setIsValid(false);
        }
    }, [year, required, dirty]); // REMOVED onBlur from dependencies

    // Handle prop error
    useEffect(() => {
        if (propsError) {
            setError(true);
            setErrorMessage(propsError);
            setIsValid(false);
        }
    }, [propsError]);

    const escFunction = useCallback((event) => {
        if (event.key === "Escape") {
            setShowCalendar(false);
            setIsFocused(false);
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
            // Check if click is outside both container AND calendar
            const isOutsideContainer = container.current && !container.current.contains(e.target);
            const isOutsideCalendar = calendarRef.current && !calendarRef.current.contains(e.target);
            
            if (isOutsideContainer && isOutsideCalendar) {
                setShowCalendar(false);
                setIsFocused(false);
            }
        };

        document.addEventListener('click', handleClickOutside, false); // Changed to false (bubble phase)
        return () => {
            document.removeEventListener('click', handleClickOutside, false);
        };
    }, []);

    // Simple input change handler - EXACTLY like original
    const handleInputChange = (e) => {
        const val = e.target.value;
        // Only allow numeric input and limit to 4 characters
        if ((val === '' || !isNaN(val)) && val.length <= 4) {
            setYear(val);
            setDirty(true);
        }
    };

    const handleInputFocus = () => {
        setIsFocused(true);
    };

    const handleInputBlur = () => {
        setIsFocused(false);
    };

    const shouldShowError = propsError || (error && dirty);
    const shouldShowValid = !shouldShowError && isValid && dirty && year && year.length === 4;

    // Get border and focus colors based on state
    const getBorderClasses = () => {
        if (shouldShowError) {
            return 'border-red-400 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-200';
        }
        if (shouldShowValid) {
            return 'border-green-400 focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-200';
        }
        if (isFocused || showCalendar) {
            return 'border-blue-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200';
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

    // Status icon component
    const StatusIcon = () => {
        if (shouldShowError) {
            return (
                <svg className="h-5 w-5 text-red-500 flex-shrink-0 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
            );
        }
        if (shouldShowValid) {
            return (
                <svg className="h-5 w-5 text-green-500 flex-shrink-0 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
            );
        }
        return null;
    };

    // Size classes
    const getSizeClasses = () => {
        switch (size) {
            case "small":
                return "px-3 py-1.5 text-sm h-8";
            case "large":
                return "px-4 py-3 text-lg h-12";
            case "medium":
            default:
                return "px-3.5 py-2.5 text-base h-12";
        }
    };

    // Container width style
    const containerStyle = {
        width: width || "auto"
    };

    return (
        <div className="flex mb-2" style={containerStyle}>
            <div className="mb-3 w-auto max-w-[140px]">
                {label && (
                    <label 
                        htmlFor={label} 
                        className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}
                    >
                        {label}
                        {required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                )}
                
                <div className={`
                    block w-full font-normal text-gray-700 bg-clip-padding 
                    border border-solid rounded-lg shadow-sm transition-all ease-in-out duration-200
                    focus-within:text-gray-700 focus-within:outline-none 
                    ${disabled ? 'opacity-80' : ''} 
                    ${getSizeClasses()} 
                    ${getBorderClasses()} ${getBackgroundClasses()}
                    ${className || ''}
                `}>
                    <div className="relative h-full">
                        <div className="flex flex-row items-center h-full" ref={container}>
                            <input 
                                ref={yearRef} 
                                type="text" 
                                disabled={disabled}
                                value={year}
                                className="flex-1 border-0 focus:outline-none focus:ring-0 bg-transparent placeholder:text-gray-400 p-0 m-0 text-left pr-14" 
                                onChange={handleInputChange}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                placeholder={placeholder}
                                maxLength="4"
                                {...otherProps}
                            />
                            
                            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center space-x-1">
                                {!disabled && (
                                    <svg 
                                        xmlns="http://www.w3.org/2000/svg" 
                                        fill="none" 
                                        viewBox="0 0 24 24" 
                                        strokeWidth="1.5" 
                                        stroke="currentColor" 
                                        className="w-5 h-5 cursor-pointer text-gray-400 hover:text-gray-600 flex-shrink-0" 
                                        onClick={openCalendar}
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 715.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                    </svg>
                                )}
                                <StatusIcon />
                            </div>
                        </div>
                        
                        {/* Custom Year Picker */}
                        {!disabled && showCalendar && (
                            <div 
                                ref={calendarRef}
                                className="mt-1 absolute top-full left-0 bg-white p-4 rounded-lg border border-gray-200 shadow-lg z-50 w-[280px]"
                                onClick={(e) => {
                                    e.stopPropagation(); // Prevent any parent handlers
                                }}
                            >
                                {/* Year Picker Header */}
                                <div className="flex items-center justify-between mb-4">
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigateDecade(-1);
                                        }}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
                                        aria-label="Previous decade"
                                    >
                                        ←
                                    </button>
                                    <h3 className="font-semibold text-gray-800">
                                        {Math.floor(dateValue.getFullYear() / 10) * 10}s
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            navigateDecade(1);
                                        }}
                                        className="p-1.5 hover:bg-gray-100 rounded-lg text-lg font-bold transition-colors"
                                        aria-label="Next decade"
                                    >
                                        →
                                    </button>
                                </div>
                                
                                {/* Year Grid */}
                                <div className="grid grid-cols-4 gap-2">
                                    {generateDecadeYears().map((yearObj) => {
                                        const { year: yearNum, isCurrentDecade, isSelected, isToday } = yearObj;
                                        
                                        return (
                                            <button
                                                key={yearNum}
                                                type="button"
                                                className={`
                                                    p-2 text-center rounded-md transition-all duration-200 text-sm font-medium h-10 flex items-center justify-center
                                                    ${!isCurrentDecade ? 'text-gray-400 hover:text-gray-600' : 'hover:bg-blue-50 cursor-pointer hover:scale-105'}
                                                    ${isToday ? 'bg-blue-100 font-bold border-2 border-blue-300 text-blue-700' : ''}
                                                    ${isSelected ? 'bg-blue-600 text-white font-bold shadow-md' : ''}
                                                    ${!isSelected && !isToday ? 'hover:bg-blue-50 hover:text-blue-600' : ''}
                                                `}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    handleYearSelect(yearNum);
                                                }}
                                                onMouseDown={(e) => {
                                                    // console.log('Mouse down on:', yearNum); // Debug log
                                                }}
                                            >
                                                {yearNum}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                {shouldShowError && (
                    <div className="mt-1.5 flex items-center">
                        <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                        <p className="text-red-600 text-sm font-medium">{propsError || errorMessage}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default YearField;