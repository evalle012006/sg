import React, { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import DateRangeFilter from '../../components/reports/booking/date-range-filter';
import ColumnSelector from '../../components/reports/booking/ColumnSelector';
import ExportButton from '../../components/reports/booking/ExportButton';
import { processAnswer, processBookingData } from '../../lib/report-utils';
import moment from 'moment';
import Spinner from '../../components/ui/spinner';
import { useDispatch } from 'react-redux';
import { globalActions } from '../../store/globalSlice';

const Layout = dynamic(() => import('../../components/layout'));

const BASE_COLUMN_TYPES = {
  BOOKING: 'Booking',
  GUEST: 'Guest',
  BOOKING_TYPE: 'Booking Type',
  CREATED: 'Created',
  STATUS: 'Status',
  ELIGIBILITY: 'Eligibility',
};

const ReportTable = ({ columns, data, columnTypes }) => {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-left text-gray-500">
        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
          <tr>
            {columns.map((column) => (
              <th key={column} scope="col" className="px-6 py-3">
                {columnTypes[column]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index} className="bg-white border-b hover:bg-gray-50">
              {columns.map((column) => (
                <td key={column} className="px-6 py-4">
                  {row[column]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
  return (
    <div className="flex justify-center items-center mt-4">
      <button
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        className="px-4 py-2 mr-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        Previous
      </button>
      <span className="mx-4">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        className="px-4 py-2 ml-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
      >
        Next
      </button>
    </div>
  );
};

const ReportConfig = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [columnTypes, setColumnTypes] = useState({...BASE_COLUMN_TYPES});
  const [selectedColumns, setSelectedColumns] = useState(Object.keys(BASE_COLUMN_TYPES));
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [exportError, setExportError] = useState(null);
  const [totalCount, setTotalCount] = useState(0);
  const [allAvailableColumns, setAllAvailableColumns] = useState({...BASE_COLUMN_TYPES});

  const previousColumnTypes = useRef({});

  const handleColumnToggle = (column) => {
    setSelectedColumns((prev) => [...prev, column]);
  };

  const handleColumnHide = (column) => {
    setSelectedColumns((prev) => prev.filter((col) => col !== column));
  };

  const handleColumnReorder = (startIndex, endIndex) => {
    const result = Array.from(selectedColumns);
    const [removed] = result.splice(startIndex, 1);
    result.splice(endIndex, 0, removed);
    setSelectedColumns(result);
  };

  const handleExportError = (error) => {
    console.error('Export failed:', error);
    setExportError(error.message);
  };

  const fetchData = async (page = 1) => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      page,
      pageSize: 10,
      startDate,
      endDate
    });
    
    try {
      const response = await fetch(`/api/reports/booking-reports?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const { bookings: data, totalPages, totalCount } = await response.json();
      setTotalCount(totalCount);
      
      const newColumnTypes = {...BASE_COLUMN_TYPES};
      const allQuestions = [];

      data.forEach(booking => {
        const qaList = processBookingData(booking);
        qaList.forEach(qa => {
          if (!allQuestions.some(q => q.question === qa.question)) {
            allQuestions.push(qa);
          }
        });
      });

      allQuestions.sort((a, b) => {
        if (a.sectionOrder === b.sectionOrder) {
          return a.questionId - b.questionId;
        }
        return a.sectionOrder - b.sectionOrder;
      });

      allQuestions.forEach((qa, index) => {
        const key = `q_${index}`;
        newColumnTypes[key] = qa.question;
      });

      // Update all available columns with new columns
      setAllAvailableColumns(prev => ({...prev, ...newColumnTypes}));

      const processedData = data.map(booking => {
        const baseBookingData = {
          BOOKING: booking.reference_id || '',
          GUEST: booking.Guest ? `${booking.Guest.first_name || ''} ${booking.Guest.last_name || ''}`.trim() : '',
          BOOKING_TYPE: booking.type || '',
          CREATED: booking.createdAt ? moment(booking.createdAt).format('DD-MM-YYYY') : '',
          STATUS: processAnswer(booking.status),
          ELIGIBILITY: processAnswer(booking.eligibility),
        };

        const qaMap = new Map(processBookingData(booking).map(qa => {
          const isRoomSelection = qa.question.toLowerCase().includes('room') && 
                                qa.question.toLowerCase().includes('selection');
          return [qa.question, processAnswer(qa.answer, isRoomSelection)];
        }));

        allQuestions.forEach((qa, index) => {
          const key = `q_${index}`;
          baseBookingData[key] = qaMap.get(qa.question) || '';
        });

        return baseBookingData;
      });

      // Maintain selected columns while ensuring they exist in current data
      setSelectedColumns(prev => {
        const validColumns = prev.filter(col => 
          newColumnTypes[col] !== undefined || BASE_COLUMN_TYPES[col] !== undefined
        );
        return validColumns;
      });

      previousColumnTypes.current = newColumnTypes;
      setColumnTypes(newColumnTypes);
      setBookings(processedData);
      setTotalPages(totalPages);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(globalActions.setLoading(false));
    fetchData(currentPage);
  }, [currentPage, startDate, endDate]);

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleDateFilter = (start, end) => {
    setStartDate(start);
    setEndDate(end);
    setCurrentPage(1);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  return (
    <Layout title="Reports">
      <div className="p-8 col-span-9">
        <div className="flex justify-between items-start mb-4">
          <ColumnSelector
            availableColumns={allAvailableColumns}
            selectedColumns={selectedColumns}
            onColumnToggle={handleColumnToggle}
            onColumnHide={handleColumnHide}
            onReorder={handleColumnReorder}
          />
          <div className="flex items-start gap-4">
            <DateRangeFilter 
              onFilterChange={handleDateFilter}
              onClear={handleClearFilter}
              totalCount={totalCount} 
            />
            <ExportButton 
              data={bookings}
              columns={selectedColumns}
              columnTypes={columnTypes}
              startDate={startDate}
              endDate={endDate}
              onExportStart={() => setExportError(null)}
              onExportComplete={() => {}}
              onExportError={handleExportError}
            />
          </div>
        </div>
        {exportError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
            {exportError}
          </div>
        )}
        {loading ? (
          <Spinner />
        ) : (
          <>
            <ReportTable 
              columns={selectedColumns} 
              data={bookings} 
              columnTypes={columnTypes}
            />
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          </>
        )}
      </div>
    </Layout>
  );
};

export default ReportConfig;