import React, { useEffect, useMemo, useRef, useState } from "react";
import SelectFilterComponent from "../../components/ui/select-filter";
import moment from "moment";
import { useDispatch } from "react-redux";
import { globalActions } from "./../../store/globalSlice"
import dynamic from 'next/dynamic';

const Layout = dynamic(() => import('../../components/layout'));

const AssetTypeAvailabilityPage = () => {
    const dispatch = useDispatch();
    const [dates, setDates] = useState([]); //array of dates of current week
    const [availabilityData, setAvailabilityData] = useState([]); //array of objects with availability data for each asset type

    const fetchTypeAvailability = async (startDate, endDate) => {
        dispatch(globalActions.setLoading(true));
        const response = await fetch("/api/equipments/categories/get-category-status", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                start_date: startDate,
                end_date: endDate,
            }),
        });
        const data = await response.json();
        setAvailabilityData(data);
        dispatch(globalActions.setLoading(false));
    }

    const getWeekDates = (initialDate = new Date()) => {
        let dates = [];
        let startDate = initialDate;
        let endDate = new Date();

        startDate.setDate(startDate.getDate() - startDate.getDay());
        endDate.setDate(endDate.getDate() - endDate.getDay() + 6);

        for (let i = 0; i < 7; i++) {
            let currentDate = new Date(startDate);
            currentDate.setDate(currentDate.getDate() + i);
            dates.push(currentDate);
        }
        return dates;
    }

    const handleWeekChange = (direction) => {
        let newDates = [];
        if (direction == "next") {
            newDates = getWeekDates(moment(dates[0]).add(7, 'days').toDate());
        } else {
            newDates = getWeekDates(moment(dates[0]).subtract(7, 'days').toDate());
        }
        setDates(newDates);
        fetchTypeAvailability(newDates[0], newDates[newDates.length - 1]);
    }

    useEffect(() => {
        let dates = getWeekDates();
        setDates(dates);

        fetchTypeAvailability(dates[0], dates[dates.length - 1]);
    }, []);

    return (
        <Layout title="Asset Type Availability">
            <div className='container mx-auto px-4 py-8'>
                <div className="availability-table mt-10">
                    <div className="table-header grid grid-cols-8">
                        <div className="col-span-1 text-left text-base text-zinc-500 flex items-center">Category</div>
                        <div className="col-span-7 grid grid-cols-7 text-left text-base text-zinc-500 w-full relative">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cursor-pointer absolute top-8 w-7 h-7"
                                onClick={() => handleWeekChange("previous")}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 9l-3 3m0 0l3 3m-3-3h7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>

                            {dates.map((date, index) => {
                                return (<div className={`p-4 text-center ${dates.length - 1 == index ? '' : 'border-r-2 border-slate-300'}`} key={index}>
                                    <p className="pb-2">{moment(date).format('MMM D')}</p>
                                    <p>{moment(date).format('dd')}</p>
                                </div>)
                            })}

                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="cursor-pointer absolute top-8 right-0 w-7 h-7"
                                onClick={() => handleWeekChange("next")}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>

                        </div>
                    </div>
                    <div className="table-body">
                        {availabilityData.length ? availabilityData.map((assetType, index) => {
                            return (
                                <div className="grid grid-cols-8 gap-2" key={index}>
                                    <div className="col-span-1 text-left text-base flex items-center">{_.startCase(assetType.name)}</div>
                                    <div className="col-span-7 grid grid-cols-7 gap-1 pb-1 text-left text-base w-full relative">
                                        {assetType.data.sort((a, b) => moment(a.date) - moment(b.date)).map((data, index) => {
                                            return (<div className={`rounded-md p-4 text-center ${data.value < 0 ? 'bg-red-500 text-white' : data.value < 2 ? 'bg-orange-300' : 'bg-green-400'}`} key={index}>
                                                <p className="pb-2 font-semibold">{data.value}</p>
                                            </div>)
                                        })}
                                    </div>
                                </div>)
                        }) :
                            <div className="flex flex-row justify-center align-middle">
                                <div className="text-base text-zinc-500 m-10">No data available</div>
                            </div>}
                    </div>
                </div>
            </div>
        </Layout>
    )
}

export default AssetTypeAvailabilityPage;