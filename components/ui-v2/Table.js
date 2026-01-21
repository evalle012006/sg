import React, { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { Droppable, Draggable } from 'react-beautiful-dnd';

const Table = ({ 
  data = [], 
  columns = [], 
  title = null,
  itemsPerPageOptions = [10, 15, 25, 50],
  defaultItemsPerPage = 15,
  draggable = false,
  isDragging = false
}) => {
  const [searchTerms, setSearchTerms] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(defaultItemsPerPage);

  // Filter data based on search terms
  const filteredData = useMemo(() => {
    return data.filter(item => {
      return columns.every(column => {
        // Skip filtering for columns that don't have search enabled
        if (column.searchable === false) return true;
        
        const searchTerm = searchTerms[column.key]?.toLowerCase() || '';
        if (!searchTerm) return true;
        
        const value = item[column.key];
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
              ? 'bg-blue-600 text-white'
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
    <div className="w-full bg-white rounded-lg shadow-sm">
      {/* Header */}
      {title && (
        <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full">
          {/* Table Header */}
          <thead>
            {/* Column Labels Row */}
            <tr style={{ backgroundColor: '#ECECEC' }}>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 text-left">
                  <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">
                    {column.label}
                  </div>
                </th>
              ))}
            </tr>
            
            {/* Search/Filter Row */}
            <tr className="bg-gray-50">
              {columns.map((column) => (
                <th key={`search-${column.key}`} className="px-4 py-3 text-left">
                  <div className="h-10 flex items-center">
                    {column.searchable !== false ? (
                      <div className="relative w-full font-normal">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search"
                          className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          value={searchTerms[column.key] || ''}
                          onChange={(e) => handleSearch(column.key, e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="w-full"></div>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Table Body */}
          <tbody className="divide-y divide-gray-200">
            {/* Use drag-and-drop if draggable prop is true */}
            {draggable ? (
              <Droppable droppableId="table-rows">
                {(provided) => (
                  <>
                    <tr ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'none' }}>
                      <td></td>
                    </tr>
                    {paginatedData.map((item, index) => (
                      <Draggable 
                        key={item.id?.toString() || index.toString()} 
                        draggableId={item.id?.toString() || index.toString()} 
                        index={index}
                      >
                        {(provided, snapshot) => (
                          <tr
                            ref={provided.innerRef}
                            {...provided.draggableProps}
                            className={`hover:bg-[#F2F5F9] transition-colors duration-150 ${
                              snapshot.isDragging ? 'bg-blue-50 shadow-md' : ''
                            }`}
                          >
                            {columns.map((column) => (
                              <td 
                                key={column.key} 
                                className="px-4 py-4 text-sm"
                                {...(column.key === 'dragHandle' ? provided.dragHandleProps : {})}
                              >
                                {column.render ? 
                                  column.render(item[column.key], item, index) : item[column.key]}
                              </td>
                            ))}
                          </tr>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </>
                )}
              </Droppable>
            ) : (
              /* Regular non-draggable rows */
              paginatedData.map((item, index) => (
                <tr key={index} className="hover:bg-[#F2F5F9] transition-colors duration-150">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4 text-sm">
                      {column.render ? 
                        column.render(item[column.key], item) : item[column.key]}
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

export default Table;