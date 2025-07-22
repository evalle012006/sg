import React, { useEffect, useRef, useState } from "react";
import 'react-date-range/dist/styles.css'; // main style file
import 'react-date-range/dist/theme/default.css'; // theme css file
import { DateRange } from 'react-date-range';
import moment from 'moment';
import { toast } from "react-toastify";
import { validateDate } from "../../utilities/common";

const DateRangeField = (props) => {
    const [allowPrevDate, setAllowPrevDate] = useState(props.hasOwnProperty('allowPrevDate') ? props.allowPrevDate : true);
    const [error, setError] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [dirty, setDirty] = useState(false);
    const [selectionRange, setSelectionRange] = useState([
        {
            startDate: new Date(),
            endDate: new Date(),
            key: 'selection'
        }
    ]);
    const [showCalendar, setShowCalendar] = useState(false);
    const container = useRef();

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleSelectionRange = (ranges) => {
        const startDate = ranges[0].startDate;
        const endDate = ranges[0].endDate;
        
        // Check for past dates when not allowed
        if (!allowPrevDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            const startDateCheck = new Date(startDate);
            const endDateCheck = new Date(endDate);
            startDateCheck.setHours(0, 0, 0, 0);
            endDateCheck.setHours(0, 0, 0, 0);
            
            if (startDateCheck < today || endDateCheck < today) {
                const errorMsg = 'Past dates are not allowed!';
                toast.error(errorMsg);
                setError(true);
                setErrorMessage(errorMsg);
                // Pass error to parent component with current date range
                const startStr = moment(startDate).format('YYYY-MM-DD');
                const endStr = moment(endDate).format('YYYY-MM-DD');
                const currentValue = `${startStr} - ${endStr}`;
                if (props.onChange) {
                    props.onChange(currentValue, errorMsg);
                }
                return;
            }
        }
        
        setSelectionRange(ranges);
        setDirty(true);
    }

    const [startDay, setStartDay] = useState('');
    const [startMonth, setStartMonth] = useState('');
    const [startYear, setStartYear] = useState('');

    const [endDay, setEndDay] = useState('');
    const [endMonth, setEndMonth] = useState('');
    const [endYear, setEndYear] = useState('');

    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    const startMonthRef = useRef();
    const startYearRef = useRef();
    const endDayRef = useRef();
    const endMonthRef = useRef();
    const endYearRef = useRef();

    // Check if a date is in the past
    const isDateInPast = (selectedDate) => {
        if (!selectedDate || allowPrevDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const dateToCheck = new Date(selectedDate);
        dateToCheck.setHours(0, 0, 0, 0);
        
        return dateToCheck < today;
    };

    const validation = (date) => {
        let error = false;
        if (date) {
            // arrival date not more than 12 months
            const diffMonths = getDiffMonths(new Date(), new Date(date), false);
            error = diffMonths > 12;
        }

        return error;
    }

    const getDiffMonths = (currentDate, selectedDate, roundUpFractionalMonths) => {
        //Months will be calculated between start and end dates.
        //Make sure start date is less than end date.
        //But remember if the difference should be negative.
        let startDate = currentDate;
        let endDate = selectedDate;
        let inverse = false;
        if (currentDate > selectedDate) {
            startDate = selectedDate;
            endDate = currentDate;
            inverse = true;
        }

        //Calculate the differences between the start and end dates
        let yearsDifference = endDate.getFullYear() - startDate.getFullYear();
        let monthsDifference = endDate.getMonth() - startDate.getMonth();
        let daysDifference = endDate.getDate() - startDate.getDate();

        let monthCorrection = 0;
        //If roundUpFractionalMonths is true, check if an extra month needs to be added from rounding up.
        //The difference is done by ceiling (round up), e.g. 3 months and 1 day will be 4 months.
        if (roundUpFractionalMonths === true && daysDifference > 0) {
            monthCorrection = 1;
        }
        //If the day difference between the 2 months is negative, the last month is not a whole month.
        else if (roundUpFractionalMonths !== true && daysDifference < 0) {
            monthCorrection = -1;
        }

        return (inverse ? -1 : 1) * (yearsDifference * 12 + monthsDifference + monthCorrection);
    }

    const validateDateRange = (start, end) => {
        if (start && end) {
            const startMoment = moment(start);
            const endMoment = moment(end);
            
            if (endMoment.isBefore(startMoment)) {
                const errorMsg = 'End date cannot be before start date.';
                setError(true);
                setErrorMessage(errorMsg);
                // Pass error to parent component with current combined value
                const currentValue = `${start} - ${end}`;
                if (props.onChange) {
                    props.onChange(currentValue, errorMsg);
                }
                return false;
            }
        }
        return true;
    }

    // Comprehensive validation function for individual dates
    const validateIndividualDate = (date, isStartDate = true) => {
        if (!date) return { isValid: true, error: '' };

        // Basic date validation
        const basicError = validateDate(date);
        if (basicError) {
            return { isValid: false, error: 'Invalid date entered!' };
        }

        // Past date validation
        if (isDateInPast(date)) {
            return { isValid: false, error: 'Past dates are not allowed!' };
        }

        // 12 months validation
        if (validation(date)) {
            return { 
                isValid: false, 
                error: `${isStartDate ? 'Start' : 'End'} date is more than 12 months.` 
            };
        }

        return { isValid: true, error: '' };
    };

    useEffect(() => {
        if (startDay != '' && startMonth != '' && startYear != '' &&
        startDay > 0 && startMonth > 0 && startYear.length == 4) {
            const selectedStartDate = `${startYear}-${startMonth}-${startDay}`;
            
            const startValidation = validateIndividualDate(selectedStartDate, true);
            
            if (!startValidation.isValid) {
                toast.error(startValidation.error);
                setError(true);
                setErrorMessage(startValidation.error);
                // ALWAYS call onChange with current value and error
                const currentValue = endDate ? `${selectedStartDate} - ${endDate}` : (props.value || '');
                if (props.onChange) {
                    props.onChange(currentValue, startValidation.error);
                }
                return;
            }
            
            if (!validateDateRange(selectedStartDate, endDate)) {
                // validateDateRange already calls onChange with error
                return;
            }
            
            setError(false);
            setErrorMessage('');
            setStartDate(selectedStartDate);
        }
    }, [startDay, startMonth, startYear, endDate, allowPrevDate]);

    useEffect(() => {
        if (endDay != '' && endMonth != '' && endYear != '' && 
        endDay > 0 && endMonth > 0 && endYear.length == 4) {
            const selectedEndDate = `${endYear}-${endMonth}-${endDay}`;
            
            const endValidation = validateIndividualDate(selectedEndDate, false);
            
            if (!endValidation.isValid) {
                toast.error(endValidation.error);
                setError(true);
                setErrorMessage(endValidation.error);
                // ALWAYS call onChange with current value and error
                const currentValue = startDate ? `${startDate} - ${selectedEndDate}` : (props.value || '');
                if (props.onChange) {
                    props.onChange(currentValue, endValidation.error);
                }
                return;
            }
            
            if (!validateDateRange(startDate, selectedEndDate)) {
                // validateDateRange already calls onChange with error
                return;
            }
            
            setError(false);
            setErrorMessage('');
            setEndDate(selectedEndDate);
        }
    }, [endDay, endMonth, endYear, startDate, allowPrevDate]);

    useEffect(() => {
        if (startDate && endDate) {
            if (validateDateRange(startDate, endDate)) {
                setError(false);
                setErrorMessage('');
                // Pass null as error when validation passes
                props.onChange(`${startDate} - ${endDate}`, null);
            }
        } else {
            setError(true);
            setErrorMessage('Both start and end dates are required');
            // Pass error message to parent when there's an error
            if (props.onChange) {
                props.onChange(props.value || '', 'Both start and end dates are required');
            }
        }
    }, [startDate, endDate]);

    useEffect(() => {
        if (dirty) {
            const startDate = moment(selectionRange[0].startDate).format('DD-MM-YYYY');
            const endDate = moment(selectionRange[0].endDate).format('DD-MM-YYYY');

            const startDateArr = startDate.split('-');
            setStartDay(startDateArr[0]);
            setStartMonth(startDateArr[1]);
            setStartYear(startDateArr[2]);

            const endDateArr = endDate.split('-');
            setEndDay(endDateArr[0]);
            setEndMonth(endDateArr[1]);
            setEndYear(endDateArr[2]);

            setDirty(false);
        }
    }, [dirty]);

    useEffect(() => {
        if (props.value && props.value !== ' - ') {
            const valArr = props.value.split(' - ');
            if (valArr.length > 1) {
                setSelectionRange([
                    {
                        startDate: new Date(valArr[0]),
                        endDate: new Date(valArr[1]),
                        key: 'selection'
                    }
                ]);
                const startDateArr = valArr[0].split('-');
                const endDateArr = valArr[1].split('-');

                if (startDateArr.length > 0) {
                    setStartDay(startDateArr[2]);
                    setStartMonth(startDateArr[1]);
                    setStartYear(startDateArr[0]);
                }

                if (endDateArr.length > 0) {
                    setEndDay(endDateArr[2]);
                    setEndMonth(endDateArr[1]);
                    setEndYear(endDateArr[0]);
                }

                // Validate the loaded dates immediately
                const startValidation = validateIndividualDate(valArr[0], true);
                const endValidation = validateIndividualDate(valArr[1], false);
                
                if (!startValidation.isValid) {
                    setError(true);
                    setErrorMessage(startValidation.error);
                    if (props.onChange) {
                        props.onChange(props.value, startValidation.error);
                    }
                } else if (!endValidation.isValid) {
                    setError(true);
                    setErrorMessage(endValidation.error);
                    if (props.onChange) {
                        props.onChange(props.value, endValidation.error);
                    }
                } else if (!validateDateRange(valArr[0], valArr[1])) {
                    // validateDateRange already sets error and calls onChange
                } else {
                    setError(false);
                    setErrorMessage('');
                    if (props.onChange) {
                        props.onChange(props.value, null);
                    }
                }
            }
        }
    }, [props.value, allowPrevDate]);

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

    // Check if current dates are in the past and need updating
    const areCurrentDatesInPast = () => {
        if (allowPrevDate) return false;
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            start.setHours(0, 0, 0, 0);
            end.setHours(0, 0, 0, 0);
            
            return start < today || end < today;
        }
        
        return false;
    };

    return (
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3 max-w-96">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <div className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${(error || props.error) ? 'border-red-400 focus:border-red-500' : 'border-gray-300 focus:border-slate-400'}`}>
                    <div className="relative">
                        <div className="flex flex-col sm:flex-col md:flex-row lg:flex-row mr-2 w-full" ref={container}>
                            <div className="flex flex-row">
                                <input type="number" disabled={props.disabled} value={startDay} className="w-7 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => {
                                    setStartDay(e.target.value);
                                    if (e.target.value.length == 2) {
                                        startMonthRef.current.focus();
                                    }
                                }} placeholder="DD" />
                                <p className="mr-1 text-gray-300">/</p>
                                <input type="number" disabled={props.disabled} value={startMonth} ref={startMonthRef} className="w-7 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => {
                                    setStartMonth(e.target.value);
                                    if (e.target.value.length == 2) {
                                        startYearRef.current.focus();
                                    }
                                }} placeholder="MM" />
                                <p className="mx-1 text-gray-300">/</p>
                                <input type="number" disabled={props.disabled} value={startYear} ref={startYearRef} className="w-12 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => {
                                    setStartYear(e.target.value);
                                    if (e.target.value.length == 4) {
                                        endDayRef.current.focus();
                                    }
                                }} placeholder="YYYY" />
                            </div>
                            <p className="ml-1 mr-2 text-black font-bold">-</p>
                            <div className="flex flex-row">
                                <input type="number" disabled={props.disabled} value={endDay} ref={endDayRef} className="w-7 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => {
                                    setEndDay(e.target.value);
                                    if (e.target.value.length == 2) {
                                        endMonthRef.current.focus();
                                    }
                                }} placeholder="DD" />
                                <p className="mr-1 text-gray-300">/</p>
                                <input type="number" disabled={props.disabled} value={endMonth} ref={endMonthRef} className="w-7 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => {
                                    setEndMonth(e.target.value);
                                    if (e.target.value.length == 2) {
                                        endYearRef.current.focus();
                                    }
                                }} placeholder="MM" />
                                <p className="mx-1 text-gray-300">/</p>
                                <input type="number" disabled={props.disabled} value={endYear} ref={endYearRef} className="w-12 border-0 focus:outline-none placeholder:text-black bg-transparent" onChange={(e) => setEndYear(e.target.value)} placeholder="YYYY" />
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 cursor-pointer ml-2" onClick={openCalendar}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            {!props?.disabled && (
                                <React.Fragment>
                                    {allowPrevDate ?
                                        <DateRange
                                            showDateDisplay={false}
                                            editableDateInputs={false}
                                            onChange={item => handleSelectionRange([item.selection])}
                                            moveRangeOnFirstSelection={false}
                                            ranges={selectionRange}
                                            className={`mt-2 absolute top-6 left-0 !max-w-[24rem] z-10 border border-zinc-400 mb-4 ${!showCalendar && '!hidden'}`}
                                        />
                                        :
                                        <DateRange
                                            showDateDisplay={false}
                                            editableDateInputs={false}
                                            onChange={item => handleSelectionRange([item.selection])}
                                            moveRangeOnFirstSelection={false}
                                            ranges={selectionRange}
                                            minDate={moment().toDate()}
                                            className={`mt-2 absolute top-6 left-0 !max-w-[24rem] z-10 border border-zinc-400 mb-4 ${!showCalendar && '!hidden'}`}
                                        />
                                    }
                                </React.Fragment>
                            )}
                            
                        </div>
                    </div>
                </div>

                {/* Error messages - prioritize props.error over internal error to avoid duplicates */}
                {(props.error || (error && errorMessage)) && (
                    <p className="mt-1.5 text-red-500 text-xs">
                        {props.error || errorMessage}
                    </p>
                )}
                
                {/* Warning for past dates */}
                {areCurrentDatesInPast() && (
                    <p className="mt-1 text-amber-600 text-xs">
                        ⚠️ Current dates are in the past. Please select new dates.
                    </p>
                )}
            </div>
        </div>
    );
};

export default DateRangeField;