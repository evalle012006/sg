import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, ChevronDown, X } from 'lucide-react';

const DateRangeFilter = ({ onFilterChange, totalCount, onClear }) => {
  const [dateRange, setDateRange] = useState([null, null]);
  const [startDate, endDate] = dateRange;
  const [isFiltered, setIsFiltered] = useState(false);

  const handleFilter = () => {
    if (typeof onFilterChange === 'function') {
      onFilterChange(startDate, endDate);
      setIsFiltered(true);
    } else {
      console.error('onFilterChange is not a function');
    }
  };

  const handleClear = () => {
    setDateRange([null, null]);
    setIsFiltered(false);
    if (typeof onClear === 'function') {
      onClear();
    }
  };

  const formatDateRange = () => {
    if (startDate && endDate) {
      return `${startDate.toLocaleDateString()} - ${endDate.toLocaleDateString()}`;
    }
    return 'Select date range';
  };

  return (
    <>
      <style>
        {`
          .react-datepicker__navigation-icon::before {
            border-color: var(--sargood-blue);
          }
          
          .react-datepicker__navigation:hover *::before {
            border-color: var(--sargood-blue);
          }
        `}
      </style>
      <div className="flex flex-col min-h-[72px] justify-start">
        <div className="relative inline-flex">
          <div className="relative">
            <DatePicker
              selectsRange={true}
              startDate={startDate}
              endDate={endDate}
              onChange={(update) => {
                setDateRange(update);
                if (!update[0] || !update[1]) {
                  setIsFiltered(false);
                }
              }}
              monthsShown={2}
              customInput={
                <button className="flex items-center justify-between w-52 px-3 py-2 text-sm bg-white border rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sargood-blue">
                  <span className="flex items-center truncate">
                    <Calendar className="w-4 h-4 mr-2 flex-shrink-0 text-sargood-blue" />
                    <span className="truncate">{formatDateRange()}</span>
                  </span>
                  <ChevronDown className="w-4 h-4 flex-shrink-0 ml-2 text-sargood-blue" />
                </button>
              }
              popperClassName="date-range-popper"
              popperPlacement="bottom-end"
              calendarClassName="date-range-calendar"
              wrapperClassName="date-range-wrapper"
            />
          </div>
          <div className="flex">
            <button
              onClick={handleFilter}
              disabled={!startDate || !endDate}
              className="px-4 py-2 text-sm text-white bg-sargood-blue hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-sargood-blue disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Apply
            </button>
            {isFiltered && (
              <button
                onClick={handleClear}
                className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 border-l border-gray-300 rounded-r-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-sargood-blue"
                title="Clear filter"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        {isFiltered && typeof totalCount === 'number' && (
          <div className="mt-2 text-sm text-gray-600">
            {totalCount === 0 ? (
              <span>No results found for selected date range</span>
            ) : (
              <span>
                Total results: <strong>{totalCount.toLocaleString()}</strong>
              </span>
            )}
          </div>
        )}
      </div>
    </>
  );
};

export default DateRangeFilter;