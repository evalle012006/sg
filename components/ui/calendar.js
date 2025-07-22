import React, { useEffect, useState } from 'react';
import moment from "moment";
import { toast } from "react-toastify";

const CalendarComponent = (props) => {
    const [calendar, setCalendar] = useState([]);
    const [currentMonth, setCurrentMonth] = useState(moment().month());
    const [currentYear, setCurrentYear] = useState(moment().year());
    const [showExtraDays, setShowExtraDays] = useState(true);
    const [data, setData] = useState([]);
    const [shadedDate, setShadedDate] = useState([]);
    const [dateRange, setDateRange] = useState({ from: null, to: null });

    const convertToFullDate = (day) => {
        const cMonth = parseInt(currentMonth) + 1;
        const tDate = currentYear + '-' + cMonth + '-' + day;

        return moment(tDate).format('DD/MM/YYYY');
    }

    const updateSelection = (day, weekIndex, dayIndex, dr, reset) => {
        // updates only start date and end date
        let updatedCalendar = calendar.map((w, x) => {
            let tempW = [...w];

            if (reset) {
                tempW = w.map(wd => {
                    return { day: wd.day, selected: false };
                });
            }

            if (x === weekIndex) {
                tempW = tempW.map((wd, y) => {
                    let tempD = { ...wd };
                    if (y === dayIndex) {
                        if (dr.from || dr.to) {
                            if (dr.from === day || dr.to === day) {
                                tempD.selected = true;
                            } else {
                                tempD.selected = false;
                            }
                        } else {
                            tempD.selected = false;
                        }
                    }

                    return tempD;
                });
            }

            return tempW;
        });

        setCalendar(updatedCalendar);
    }

    const selectDates = (day, weekIndex, dayIndex) => {
        let dr = { ...dateRange };
        if ((!dateRange.from)) {
            dr.from = day;
            updateSelection(day, weekIndex, dayIndex, dr, false);
        } else if (!dateRange.to) {
            dr.to = day;
            updateSelection(day, weekIndex, dayIndex, dr, false);
        } else if (dateRange.from && dateRange.to) {
            dr.from = day;
            dr.to = null;
            updateSelection(day, weekIndex, dayIndex, dr, true);
        }

        setDateRange(dr);
        props.updateDateRange && props.updateDateRange(dr);

        return dr;
    }

    const isExtraDays = (week, date) => {
        if (week === 0 && date > 10) {
            return true;
        } else if (week === 5 && date < 10) {
            return true;
        } else if (week === 4 && date < 10) {
            return true;
        } else {
            return false;
        }
    }

    const getDatesBetween = (start, end) => {
        const now = start.clone();
        const dates = [];

        while (now.isSameOrBefore(end)) {
            dates.push(now.format('DD/MM/YYYY'));
            now.add(1, 'days');
        }
        return dates;
    }

    const isAvailable = (date) => {
        const sd = shadedDate.includes(date);
        return sd ? false : true;
    }

    const createCalendar = () => {
        let calendarDays = [];

        const startDate = moment([currentYear, currentMonth])
            .clone()
            .startOf("month")
            .startOf("week");

        const endDate = moment([currentYear, currentMonth]).clone().endOf("month");

        const sDay = startDate.clone().subtract(1, "day");

        while (sDay.isBefore(endDate, "day")) {
            calendarDays.push(
                Array(7)
                    .fill(0)
                    .map(() => sDay.add(1, "day").clone().format("DD"))
            );
        }

        calendarDays = calendarDays.map(week => {
            return week.map(d => {
                return { day: d, selected: false };
            });
        });

        setCalendar(calendarDays);
    }

    const getDate = () => {
        if (calendar.length > 0) {
            return calendar.map((week, index) => {
                return (
                    <tr key={index} className='p-2'>
                        {week.map((d, idx) => {
                            const day = d.day;
                            const selected = d.selected;
                            const tDate = convertToFullDate(day);
                            let available = isAvailable(tDate);
                            const highlightDay = (day, available, weekIndex, dayIndex) => {
                                if (available) {
                                    selectDates(day, weekIndex, dayIndex);
                                } else {
                                    toast.error('Selected date is not available.');
                                }
                            }

                            return (
                                <React.Fragment key={idx}>
                                    {showExtraDays ? (
                                        <td className='font-thin cursor-pointer' onClick={() => highlightDay(tDate, available, index, idx)}>
                                            {isExtraDays(index, day) ? (
                                                <span className={`w-10 p-2 text-red-500 border-2 border-white hover:bg-slate-400 ${selected && 'border-yellow-400'}`}>{day}</span>
                                            ) : (
                                                <span className={`w-10 p-2 border-2 border-white hover:bg-slate-400 ${selected && 'border-yellow-400'}`}>{day}</span>
                                            )}
                                        </td>
                                    ) : (
                                        <td className='font-normal'>
                                            {isExtraDays(index, day) ? (
                                                <span className='w-10 p-2'></span>
                                            ) : (
                                                <span className={`w-10 p-2 border-2 border-white
                                                                ${available ? 'text-white cursor-pointer bg-black hover:bg-slate-400' : 'text-zinc-300 bg-zinc-200'}`}>
                                                    {day}
                                                </span>
                                            )}
                                        </td>
                                    )}
                                </React.Fragment>
                            )
                        })}
                    </tr>
                )
            });
        }
    }

    useEffect(() => {
        let mounted = true;

        if (mounted) {
            if (props.hasOwnProperty('selectedMonth')) {
                setCurrentMonth(props.selectedMonth);
            }

            if (props.hasOwnProperty('selectedYear')) {
                setCurrentYear(props.selectedYear);
            }

            if (props.hasOwnProperty('showExtraDays')) {
                setShowExtraDays(props.showExtraDays);
            }

            if (props.hasOwnProperty('data')) {
                setData(props.data);
            }
        }

        return (() => {
            mounted = false;
        });
    }, [props]);

    useEffect(() => {
        createCalendar();
    }, [currentMonth, currentYear]);

    useEffect(() => {
        if (data) {
            const temp = [];

            data.map(booking => {
                if (booking.from && booking.departure) {
                    const startDate = moment(booking.from, 'DD/MM/YYYY');
                    const endDate = moment(booking.departure, 'DD/MM/YYYY');
                    if (startDate.isValid() && endDate.isValid()) {
                        temp.push(...getDatesBetween(startDate, endDate));
                    } else {
                        console.log('Invalid start and end dates', booking.from, booking.departure)
                    }
                }
            });

            setShadedDate(temp);
        }
    }, [data]);

    useEffect(() => {
        if (dateRange.from && dateRange.to) {
            const valStart = dateRange.from.split('/');
            const valEnd = dateRange.to.split('/');
            const start = moment(valStart[2] + '-' + valStart[1] + '-' + valStart[0]);
            const end = moment(valEnd[2] + '-' + valEnd[1] + '-' + valEnd[0]);
            const rangeDates = getDatesBetween(start, end);

            let updatedCalendar = calendar.map(w => {
                return w.map(wd => {
                    let tempD = { ...wd };

                    const fullDate = convertToFullDate(wd.day);

                    const rd = rangeDates.includes(fullDate);
                    if (rd) {
                        tempD.selected = true;
                    } else {
                        tempD.selected = false;
                    }

                    return tempD;
                });
            });

            setCalendar(updatedCalendar);
        }
    }, [dateRange]);

    return (
        <div className='text-center m-0 p-0'>
            {props.title && (
                <div className='text-left p-1'>
                    <h1>{props.title}</h1>
                </div>
            )}
            <div>
                <table className='table-auto font-bold'>
                    <thead>
                        <tr>
                            <th>S</th>
                            <th>M</th>
                            <th>T</th>
                            <th>W</th>
                            <th>T</th>
                            <th>F</th>
                            <th>S</th>
                        </tr>
                    </thead>
                    <tbody className='!h-[15rem]'>
                        {getDate()}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default CalendarComponent;