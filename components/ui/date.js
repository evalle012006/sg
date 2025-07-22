import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment';
import { toast } from "react-toastify";

const DateInputField = (props) => {
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [day, setDay] = useState('');
    const [month, setMonth] = useState('');
    const [year, setYear] = useState('');
    const container = useRef();

    const monthRef = useRef();
    const yearRef = useRef();

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const setSelectedDate = (e) => {
        const selectedDate = moment(e).format('DD-MM-YYYY');
        const dateArr = selectedDate.split('-');
        setDay(dateArr[0]);
        setMonth(dateArr[1]);
        setYear(dateArr[2]);
        setDateValue(e);
        setShowCalendar(false);
    };

    useEffect(() => {
        if (props.value) {
            let tempYear;
            let tempMonth;
            let tempDay;
            if (props.value.includes('T')) {
                const dateTime = props.value.split('T');
                const valArr = dateTime[0].split('-');
                tempYear = valArr[0];
                tempMonth = valArr[1];
                tempDay = valArr[2];
            } else {
                const valArr = props.value.split('-');
                tempYear = valArr[0];
                tempMonth = valArr[1];
                tempDay = valArr[2];
            }
        
            setYear(tempYear);
            setMonth(tempMonth);
            setDay(tempDay);
            setDirty(true);
        }
    }, [props]);

    useEffect(() => {
        if (day != '' && month != '' && year != '' && year.length == 4) {
            props.onChange && props.onChange(`${year}-${month}-${day}`);
            setError(false);
            setDirty(true);
        } else if (props.required) {
            setError(true)
        }
    }, [day, month, year]);

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

    return (
        <div className="flex mb-2">
            <div className="mb-3 max-w-96" style={{ width: props.width }}>
                {props.label && <label htmlFor={props.label} className={`block text-slate-700 text-sm font-medium ml-1 mb-2 ${props?.required ? 'text-left' : 'flex justify-between'}`}>
                    {props.label} {props.required && <span className="text-red-500">*</span>}
                </label>}
                <div className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border-2 border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                border-gray-200`}>
                    <div className="relative">
                        <div className="flex flex-row" ref={container}>
                            <input type="text" value={day} className="w-8 border-1 focus:outline-none placeholder:text-gray-400" disabled={props.disabled} onChange={(e) => {
                                const value = parseInt(e.target.value);
                                if (value < 1 || value > 31) {
                                    toast.error("Invalid day entered!");
                                } else {
                                    setDay(e.target.value);
                                    setDirty(true)
                                    if (e.target.value.length == 2) {
                                        monthRef.current.focus();
                                    }
                                }
                            }} placeholder="DD" />
                            <p className="mx-2 text-gray-300">/</p>
                            <input ref={monthRef} type="text" value={month} className="w-8 border-1 focus:outline-none placeholder:text-gray-400" disabled={props.disabled} onChange={(e) => {
                                let inputValue = e.target.value;
                                if (!inputValue) inputValue = "";
                                if (inputValue.length > 2) inputValue = inputValue.slice(0, 2);
                                if (parseInt(inputValue) < 1 || parseInt(inputValue) > 12) {
                                    toast.error("Invalid month entered!");
                                } else {
                                    setMonth(inputValue);
                                    setDirty(true)
                                    if (inputValue.length == 2) {
                                        yearRef.current.focus();
                                    }
                                }
                            }} placeholder="MM" />
                            <p className="mx-2 text-gray-300">/</p>
                            <input ref={yearRef} type="text" value={year} className="w-12 border-1 focus:outline-none placeholder:text-gray-400 mr-4" disabled={props.disabled} onChange={(e) => { setYear(e.target.value); setDirty(true) }} placeholder="YYYY" />
                            <div className="flex justify-end w-full">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 cursor-pointer mr-4" 
                                        onClick={props.disabled ? null : openCalendar}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                                </svg>
                                <Calendar onChange={setSelectedDate} value={dateValue} className={`mt-2 z-30 absolute ${props.top ? props.top : 'top-6'} ${props.bottom} left-0 ${props.left} !max-w-[18rem] ${!showCalendar && 'hidden'}`} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DateInputField;