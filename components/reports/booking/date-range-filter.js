import React, { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar, ChevronDown, X } from 'lucide-react';

const DateRangeFilter = ({ onFilterChange, onClear, dateFilterMode = 'created_at' }) => {
  // When filtering by check-in or check-out, offer an exact date option in addition to range
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [rangeError, setRangeError]   = useState('');
  const [searchMode, setSearchMode]   = useState('range');   // 'range' | 'exact'
  const [exactDate, setExactDate]     = useState(null);
  const [isFiltered, setIsFiltered] = useState(false);
  const containerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleApply = () => {
    // Exact date mode — send same date as both start and end
    if (searchMode === 'exact') {
      if (!exactDate) return;
      setRangeError('');
      if (typeof onFilterChange === 'function') {
        const fmt = (d) => {
          const y = d.getFullYear();
          const m = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };
        onFilterChange(fmt(exactDate), fmt(exactDate));
        setIsFiltered(true);
        setIsOpen(false);
      }
      return;
    }
    // Range mode
    if (!startDate || !endDate) return;
    if (endDate < startDate) {
      setRangeError('End date cannot be before start date.');
      return;
    }
    setRangeError('');
    if (typeof onFilterChange === 'function') {
      // Format to plain YYYY-MM-DD strings — no timezone info, no Date objects.
      // This prevents the API receiving timezone-encoded strings like
      // "Thu May 01 2025 00:00:00 GMT+0800" which shift the range when parsed server-side.
      const fmt = (d) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      };
      onFilterChange(fmt(startDate), fmt(endDate));
      setIsFiltered(true);
      setIsOpen(false);
    }
  };

  const handleClear = () => {
    setStartDate(null);
    setEndDate(null);
    setExactDate(null);
    setRangeError('');
    setIsFiltered(false);
    setIsOpen(false);
    if (typeof onClear === 'function') {
      onClear();
    }
  };

  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDisplayLabel = () => {
    if (searchMode === 'exact' && exactDate) return `Exact: ${formatDate(exactDate)}`;
    if (startDate && endDate) {
      if (startDate.toDateString() === endDate.toDateString()) return `Exact: ${formatDate(startDate)}`;
      return `${formatDate(startDate)} – ${formatDate(endDate)}`;
    }
    return searchMode === 'exact' ? 'Select a date' : 'Select date range';
  };

  const canApply = searchMode === 'exact' ? !!exactDate : (startDate && endDate);

  return (
    <>
      <style>{`
        .report-datepicker .react-datepicker {
          font-family: "Open Sans", sans-serif;
          border: 1px solid #cccccc;
          border-radius: 0.375rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .report-datepicker .react-datepicker__header {
          background-color: #00467F;
          border-bottom: 1px solid #003560;
          border-radius: 0.375rem 0.375rem 0 0;
        }
        .report-datepicker .react-datepicker__current-month,
        .report-datepicker .react-datepicker__day-name {
          color: #ffffff;
        }
        .report-datepicker .react-datepicker__navigation-icon::before {
          border-color: #ffffff;
        }
        .report-datepicker .react-datepicker__navigation:hover *::before {
          border-color: #FFCE00;
        }
        .report-datepicker .react-datepicker__day--selected,
        .report-datepicker .react-datepicker__day--keyboard-selected {
          background-color: #00467F;
          color: white;
          border-radius: 50%;
        }
        .report-datepicker .react-datepicker__day:hover {
          background-color: #e8f0f8;
          border-radius: 50%;
        }
        .report-datepicker .react-datepicker__day--outside-month {
          color: #aaaaaa;
        }
        .report-datepicker .react-datepicker__month-select,
        .report-datepicker .react-datepicker__year-select {
          background-color: #00467F;
          color: #ffffff;
          border: 1px solid #003560;
          border-radius: 4px;
          padding: 2px 4px;
          font-size: 0.85rem;
        }
      `}</style>

      <div className="flex flex-col items-end gap-2" ref={containerRef}>
        {/* Trigger button */}
        <div className="relative inline-flex">
          <button
            onClick={() => setIsOpen((v) => !v)}
            className="flex items-center justify-between w-64 px-3 py-2 text-sm bg-white border border-gray-300 rounded-l-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sea"
          >
            <span className="flex items-center truncate">
              <Calendar className="w-4 h-4 mr-2 flex-shrink-0 text-sea" />
              <span className={`truncate ${!isFiltered ? 'text-gray-400' : 'text-gray-800'}`}>
                {formatDisplayLabel()}
              </span>
            </span>
            <ChevronDown className={`w-4 h-4 flex-shrink-0 ml-2 text-sea transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            onClick={handleApply}
            disabled={!canApply}
            className="px-4 py-2 text-sm text-white bg-sea hover:bg-opacity-90 focus:outline-none focus:ring-2 focus:ring-sea disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Apply
          </button>

          {isFiltered && (
            <button
              onClick={handleClear}
              className="flex items-center px-3 py-2 text-sm text-gray-600 bg-gray-100 border-l border-gray-300 rounded-r-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-sea"
              title="Clear filter"
            >
              <X className="w-4 h-4" />
            </button>
          )}

          {/* Dropdown panel */}
          {isOpen && (
            <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-4 report-datepicker"
              style={{ minWidth: '560px' }}
            >
              {/* Mode toggle — only show for check-in / check-out filter modes */}
              {(dateFilterMode === 'preferred_arrival_date' || dateFilterMode === 'preferred_departure_date') && (
                <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg mb-4">
                  <button
                    onClick={() => setSearchMode('range')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                      searchMode === 'range' ? 'bg-white text-sea shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Date Range
                  </button>
                  <button
                    onClick={() => setSearchMode('exact')}
                    className={`flex-1 px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                      searchMode === 'exact' ? 'bg-white text-sea shadow-sm' : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Exact Date
                  </button>
                </div>
              )}

              {searchMode === 'exact' ? (
                /* Exact date picker — single calendar centred */
                <div className="flex justify-center">
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Select Date</p>
                    <DatePicker
                      selected={exactDate}
                      onChange={(date) => { setExactDate(date); setRangeError(''); }}
                      inline
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                    />
                  </div>
                </div>
              ) : (
              <div className="flex gap-6">
                {/* Start date picker */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Start Date</p>
                  <DatePicker
                    selected={startDate}
                    onChange={(date) => {
                      setStartDate(date);
                      setRangeError('');
                    }}
                    selectsStart
                    startDate={startDate}
                    endDate={endDate}
                    inline
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                  />
                </div>

                {/* End date picker — independent navigation */}
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase mb-2">End Date</p>
                  <DatePicker
                    selected={endDate}
                    onChange={(date) => { setEndDate(date); setRangeError(''); }}
                    selectsEnd
                    startDate={startDate}
                    endDate={endDate}
                    inline
                    showMonthDropdown
                    showYearDropdown
                    dropdownMode="select"
                    openToDate={endDate || startDate || new Date()}
                  />
                </div>
              </div>
              )} {/* end range/exact conditional */}

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <div className="text-sm text-gray-500">
                  {searchMode === 'exact' ? (
                    exactDate
                      ? <span className="font-medium text-gray-700">{formatDate(exactDate)}</span>
                      : <span className="text-gray-400">Select a date</span>
                  ) : startDate && endDate ? (
                    <span>
                      <span className="font-medium text-gray-700">{formatDate(startDate)}</span>
                      {' '}→{' '}
                      <span className="font-medium text-gray-700">{formatDate(endDate)}</span>
                    </span>
                  ) : startDate ? (
                    <span className="text-gray-400">Now select an end date</span>
                  ) : (
                    <span className="text-gray-400">Select a start date</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {rangeError && (
                    <span className="text-xs text-red-500">{rangeError}</span>
                  )}
                  <button
                    onClick={() => { setIsOpen(false); setRangeError(''); }}
                    className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleApply}
                    disabled={!canApply}
                    className="px-4 py-1.5 text-sm text-white bg-sea rounded-md hover:bg-opacity-90 disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    Apply Filter
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Total count — shown below trigger when filtered */}
        {isFiltered && typeof totalCount === 'number' && (
          <div className="text-sm text-gray-600">
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