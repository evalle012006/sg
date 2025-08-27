import React, { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Search } from 'lucide-react';
import DateRangeFilter from '../../components/reports/booking/date-range-filter';
import ColumnSelector from '../../components/reports/booking/ColumnSelector';
import ExportButton from '../../components/reports/booking/ExportButton';
import StatusBadge from '../../components/ui-v2/StatusBadge';
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

// Enhanced ReportTable Component with individual column filtering
const ReportTable = ({ columns, data, columnTypes }) => {
  const [searchTerms, setSearchTerms] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  const itemsPerPageOptions = [10, 15, 25, 50];

  // Helper function to determine if a column should use StatusBadge
  const shouldUseBadge = (column, value) => {
    const columnName = column.toLowerCase();
    const columnLabel = columnTypes[column]?.toLowerCase() || '';
    
    if (columnName === 'status' || columnLabel.includes('status') || 
        columnName === 'eligibility' || columnLabel.includes('eligibility')) {
      return true;
    }
    
    const statusValues = ['confirmed', 'pending', 'approved', 'eligible', 'cancelled', 'completed', 'draft'];
    if (value && typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      return statusValues.some(status => lowerValue.includes(status));
    }
    
    return false;
  };

  // Helper function to get badge type based on value
  const getBadgeType = (value) => {
    if (!value || typeof value !== 'string') return 'secondary';
    
    const lowerValue = value.toLowerCase();
    
    if (lowerValue.includes('confirmed') || lowerValue.includes('approved') || 
        lowerValue.includes('eligible') || lowerValue.includes('completed')) {
      return 'success';
    }
    
    if (lowerValue.includes('pending') || lowerValue.includes('processing')) {
      return 'pending';
    }
    
    if (lowerValue.includes('cancelled') || lowerValue.includes('rejected') || 
        lowerValue.includes('failed')) {
      return 'error';
    }
    
    if (lowerValue.includes('draft')) {
      return 'draft';
    }
    
    return 'secondary';
  };

  // Helper function to format cell content
  const renderCellContent = (column, value) => {
    if (!value && value !== 0) return '-';
    
    if (shouldUseBadge(column, value)) {
      return (
        <StatusBadge 
          type={getBadgeType(value)}
          label={value}
          size="small"
        />
      );
    }
    
    return value;
  };

  // Filter data based on search terms
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return columns.every(column => {
        const searchTerm = searchTerms[column]?.toLowerCase() || '';
        if (!searchTerm) return true;
        
        const value = item[column];
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchTerm);
        }
        if (typeof value === 'number') {
          return value.toString().includes(searchTerm);
        }
        return true;
      });
    });
  }, [data, searchTerms, columns]);

  // Paginate filtered data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);

  const handleSearch = (columnKey, value) => {
    setSearchTerms(prev => ({
      ...prev,
      [columnKey]: value
    }));
    setCurrentPage(1); // Reset to first page when searching
  };

  const handlePageChange = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const renderPaginationButtons = () => {
    const buttons = [];
    const maxVisiblePages = 5;
    
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
    
    if (endPage - startPage < maxVisiblePages - 1) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      buttons.push(
        <button
          key={i}
          onClick={() => handlePageChange(i)}
          className={`px-3 py-1 mx-1 rounded ${
            currentPage === i
              ? 'bg-sea text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {i}
        </button>
      );
    }

    if (startPage > 1) {
      buttons.unshift(
        <span key="ellipsis-start" className="px-2 text-gray-500">...</span>
      );
    }
    
    if (endPage < totalPages) {
      buttons.push(
        <span key="ellipsis-end" className="px-2 text-gray-500">...</span>
      );
    }

    return buttons;
  };

  return (
    <div className="bg-white rounded-lg border border-neutral-light overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            {/* Column Labels Row */}
            <tr style={{ backgroundColor: '#ECECEC' }}>
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-left">
                  <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">
                    {columnTypes[column]}
                  </div>
                </th>
              ))}
            </tr>
            
            {/* Search/Filter Row */}
            <tr className="bg-gray-50">
              {columns.map((column) => (
                <th key={`search-${column}`} className="px-4 py-3 text-left">
                  <div className="h-10 flex items-center">
                    <div className="relative w-full font-normal">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search"
                        className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={searchTerms[column] || ''}
                        onChange={(e) => handleSearch(column, e.target.value)}
                      />
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-light bg-white">
            {paginatedData.length === 0 ? (
              <tr>
                <td 
                  colSpan={columns.length} 
                  className="px-6 py-12 text-center text-neutral text-body-md"
                >
                  No data available
                </td>
              </tr>
            ) : (
              paginatedData.map((row, index) => (
                <tr 
                  key={index} 
                  className="hover:bg-[#F2F5F9] transition-colors duration-150"
                >
                  {columns.map((column) => (
                    <td 
                      key={column} 
                      className="px-4 py-4 text-sm text-neutral-darker"
                    >
                      {renderCellContent(column, row[column])}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination and items per page */}
      <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-gray-200">
        <div className="flex items-center mb-4 sm:mb-0">
          <span className="mr-2 text-sm text-gray-700">View</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {itemsPerPageOptions.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          
          {renderPaginationButtons()}
          
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
};

const ReportConfig = () => {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [bookings, setBookings] = useState([]);
  const [columnTypes, setColumnTypes] = useState({...BASE_COLUMN_TYPES});
  const [selectedColumns, setSelectedColumns] = useState(Object.keys(BASE_COLUMN_TYPES));
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

  const fetchData = async () => {
    setLoading(true);
    const queryParams = new URLSearchParams({
      startDate,
      endDate
    });
    
    try {
      const response = await fetch(`/api/reports/booking-reports?${queryParams}`);
      if (!response.ok) throw new Error('Failed to fetch data');
      
      const { bookings: data, totalCount } = await response.json();
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

      setSelectedColumns(prev => {
        const validColumns = prev.filter(col => 
          newColumnTypes[col] !== undefined || BASE_COLUMN_TYPES[col] !== undefined
        );
        return validColumns;
      });

      previousColumnTypes.current = newColumnTypes;
      setColumnTypes(newColumnTypes);
      setBookings(processedData);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    dispatch(globalActions.setLoading(false));
    fetchData();
  }, [startDate, endDate]);

  const handleDateFilter = (start, end) => {
    setStartDate(start);
    setEndDate(end);
  };

  const handleClearFilter = () => {
    setStartDate('');
    setEndDate('');
  };

  return (
    <Layout title="Reports">
      <div className="p-8 col-span-9">
        {/* Title Bar */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-neutral-darker uppercase">REPORTS</h1>
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

        {/* Filters Row */}
        <div className="flex justify-between items-start mb-6">
          <ColumnSelector
            availableColumns={allAvailableColumns}
            selectedColumns={selectedColumns}
            onColumnToggle={handleColumnToggle}
            onColumnHide={handleColumnHide}
            onReorder={handleColumnReorder}
          />
          <DateRangeFilter 
            onFilterChange={handleDateFilter}
            onClear={handleClearFilter}
            totalCount={totalCount} 
          />
        </div>
        
        {exportError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md text-red-600">
            {exportError}
          </div>
        )}
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Spinner />
          </div>
        ) : (
          <ReportTable 
            columns={selectedColumns} 
            data={bookings} 
            columnTypes={columnTypes}
          />
        )}
      </div>
    </Layout>
  );
};

export default ReportConfig;