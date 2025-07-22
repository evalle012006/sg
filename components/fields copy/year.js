import { useCallback, useEffect, useRef, useState } from "react";
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import moment from 'moment';

const YearField = (props) => {
    const [dateValue, setDateValue] = useState(new Date());
    const [showCalendar, setShowCalendar] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState(false);
    const [year, setYear] = useState('');
    const container = useRef();

    const yearRef = useRef();

    const openCalendar = () => {
        setShowCalendar(true);
    };

    const handleClickYear = (e) => {
        const selectedYear = moment(e).year();
        setYear(selectedYear);
        setDateValue(e);
        setShowCalendar(false);
    };

    useEffect(() => {
        if (props.defaultValue) {
            if ((typeof props.defaultValue === 'string' && props.defaultValue.includes('-'))) {
                const valArr = props.defaultValue.split('-');
                setYear(valArr[0]);
            } else {
                setYear(props.defaultValue);
            }
            setDateValue(new Date(props.defaultValue));
            setDirty(true);
        }
    }, [props]);

    useEffect(() => {
        if (year !== '' && year.toString().length == 4) {
            props.onBlur(year);
            setError(false);
            setDirty(true);
        } else if (props.required) {
            setError(true)
        }
    }, [year]);

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
        <div className="flex mb-2" style={{ width: props.width }}>
            <div className="mb-3 max-w-96">
                {props.label && <label htmlFor={props.label} className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                    {props.label}
                </label>}
                <div className={`block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white bg-clip-padding border border-solid
                                rounded-lg shadow-sm transition ease-in-out m-0 focus:text-gray-700 focus:bg-white focus:outline-none 
                                ${props.className || ''} 
                                ${(dirty && error && !props.className) ? 'border-red-400 focus:border-red-500' : !props.className ? 'border-gray-300 focus:border-slate-400' : ''}`}>
                    <div className="relative">
                        <div className="flex flex-row" ref={container}>
                            <input ref={yearRef} type="text" disabled={props?.disabled} defaultValue={year} className="w-12 border-1 focus:outline-none placeholder:text-black mr-4" onChange={(e) => { setYear(e.target.value); setDirty(true) }} placeholder="YYYY" />
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5 cursor-pointer" onClick={openCalendar}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
                            </svg>
                            {!props?.disabled && <Calendar defaultView={"decade"} maxDetail={"year"} view={"decade"} value={dateValue} onClickYear={handleClickYear} className={`mt-2 absolute top-6 left-0 !max-w-[18rem] ${!showCalendar && 'hidden'}`} />}
                        </div>
                    </div>
                </div>
                {props.error && <p className="mt-1.5 text-red-500 text-xs">{props.error}</p>}
            </div>
        </div>
    );
};

export default YearField;