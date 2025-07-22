import moment from 'moment';
import { useEffect, useState } from 'react';
import { DateRangePicker } from 'react-date-range';

export default function DateRangeSelector({ dateRangeSelection, handleRangeSelection, fetchData }) {
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleFetchData = () => {
        setShowDatePicker(false);
        fetchData();
    }
    return <div className='relative'>
        <div className='text-xs p-1'>Date Range</div>
        <div className='flex p-2 border border-slate-400 rounded-md'>
            <span className='mx-1'>{moment(dateRangeSelection.startDate).format('DD/MM/YYYY')}</span>
            <span className='mx-1'> - </span>
            <span className='mx-1 mr-2'>{dateRangeSelection.endDate && moment(dateRangeSelection.endDate).format('DD/MM/YYYY')}</span>
            <svg onClick={() => setShowDatePicker(!showDatePicker)} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="cursor-pointer w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
            </svg>
        </div>
        {showDatePicker && <div className='top-full right-0 absolute drop-shadow z-50 bg-white rounded-md'>
            <DateRangePicker ranges={[dateRangeSelection]} onChange={(e) => handleRangeSelection(e)} />
            <button className='bg-blue-400 px-4 py-2 text-white float-right rounded-br-md' onClick={() => handleFetchData()}>Update</button>
        </div>}
        {showDatePicker && <div className='fixed bg-black/20 inset-0 z-40' onClick={() => setShowDatePicker(false)}></div>}
    </div>
}