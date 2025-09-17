/* eslint-disable react/display-name */
/* eslint-disable react/jsx-key */
import React, { useEffect, useState, useMemo } from "react";
import { useTable, useSortBy, useRowSelect } from "react-table";
import { Search, ChevronUp, ChevronDown } from 'lucide-react';

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <div className="flex items-center justify-center">
        <input
          type="checkbox"
          ref={resolvedRef}
          className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          {...rest}
        />
      </div>
    );
  }
);

function PaginatedTable({ 
  columns, 
  data, 
  hiddenColumns = [], 
  selection = false,
  selectedRows = [],
  setSelectedRows = () => {},
  currentPage,
  pageSize,
  totalItems,
  totalPages,
  loading,
  onPageChange,
  onPageSizeChange,
  title = null,
  onSearch = () => {} // New prop for search functionality
}) {
  const [searchTerms, setSearchTerms] = useState({});

  // Handle search functionality
  const handleSearch = (columnId, value) => {
    setSearchTerms(prev => ({
      ...prev,
      [columnId]: value
    }));
    
    // Call the parent's search handler if provided
    onSearch({
      ...searchTerms,
      [columnId]: value
    });
  };

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: { hiddenColumns },
      manualPagination: true, // Tell the table we're handling pagination
      pageCount: totalPages,
      disableMultiSort: true,
    },
    useSortBy,
    useRowSelect,
    (hooks) => {
      if (selection) {
        hooks.visibleColumns.push((columns) => [
          // Selection column
          {
            id: "selection",
            Header: ({ getToggleAllRowsSelectedProps }) => {
              const toggleAllProps = getToggleAllRowsSelectedProps();
              
              // Create a modified version of toggleAllProps that preserves the indeterminate state
              // but has a controlled checked state that's only true when ALL rows are selected
              const modifiedProps = {
                ...toggleAllProps,
                onChange: (e) => {
                  if (e.target.checked) {
                    tableInstance.toggleAllRowsSelected(true);
                  } else {
                    tableInstance.toggleAllRowsSelected(false);
                  }
                }
              };
              
              return (
                <div className="flex justify-center">
                  <IndeterminateCheckbox {...modifiedProps} />
                </div>
              );
            },
            Cell: ({ row }) => (
              <div className="flex justify-center">
                <IndeterminateCheckbox {...row.getToggleRowSelectedProps()} />
              </div>
            ),
          },
          ...columns,
        ]);
      } else {
        hooks.visibleColumns.push((columns) => [
          ...columns,
        ]);
      }
    }
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    rows,
    selectedFlatRows,
    state: { selectedRowIds }
  } = tableInstance;

  const memoizedRows = React.useMemo(() => {
    return rows.map((row, index) => {
      prepareRow(row);
      return (
        <tr
          key={row.id}
          className={`${row.isSelected ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500" : "hover:bg-[#F2F5F9] transition-colors duration-150"}`}
          {...row.getRowProps()}
        >
          {row.cells.map((cell, cellIndex) => {
            return (
              <td 
                key={cellIndex}
                className={`px-4 py-4 text-sm ${cell.column.id === 'selection' ? 'w-10' : ''}`}
                {...cell.getCellProps()}
              >
                {cell.render("Cell")}
              </td>
            );
          })}
        </tr>
      );
    });
  }, [rows, prepareRow]);

  // Update the parent component with selected rows
  useEffect(() => {
    if (selection) {
      const newSelectedRowsData = selectedFlatRows.map(row => row.original);
      
      // Only update if the selection has actually changed
      // Compare the UUIDs (or IDs) of the selected rows rather than the whole objects
      const currentSelectedIds = selectedRows.map(row => row.uuid || row.id);
      const newSelectedIds = newSelectedRowsData.map(row => row.uuid || row.id);
      
      // Check if arrays have different lengths or different content
      const selectionChanged = 
        currentSelectedIds.length !== newSelectedIds.length ||
        newSelectedIds.some(id => !currentSelectedIds.includes(id));
      
      if (selectionChanged) {
        setSelectedRows(newSelectedRowsData);
      }
    }
  }, [selectedRowIds, selection, selectedFlatRows]);

  useEffect(() => {
    // Only add the cleanup function, don't do anything else in the main body
    return () => {
      if (selection && tableInstance) {
        tableInstance.toggleAllRowsSelected(false);
      }
    };
  }, [currentPage, pageSize, selection]);

  const itemsPerPageOptions = [10, 20, 50, 100];

  // Generate page numbers for pagination
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
          onClick={() => onPageChange(i)}
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

      {/* Selection info row */}
      {selection && selectedFlatRows.length > 0 && (
        <div className="bg-blue-50 py-2 px-4 border-b border-blue-200 flex justify-between items-center">
          <span className="text-blue-800 font-medium text-sm">
            {selectedFlatRows.length} item{selectedFlatRows.length !== 1 ? 's' : ''} selected
          </span>
          <button 
            className="text-blue-700 hover:text-blue-900 underline text-sm font-medium"
            onClick={() => {
              // Clear selection by resetting all checkboxes
              tableInstance.toggleAllRowsSelected(false);
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table
          {...getTableProps()}
          className="w-full"
        >
          <thead>
            {headerGroups.map((headerGroup, indx) => (
              <React.Fragment key={indx}>
                {/* Column Labels Row */}
                <tr {...headerGroup.getHeaderGroupProps()} style={{ backgroundColor: '#ECECEC' }}>
                  {headerGroup.headers.map((column, index) => (
                    <th
                      className="px-4 py-3 text-left"
                      key={index}
                      {...column.getHeaderProps(column.getSortByToggleProps())}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-gray-700 text-sm uppercase tracking-wider font-bold">
                          {column.render("Header")}
                        </span>
                        <span className="ml-2">
                          {column.isSorted ? (
                            column.isSortedDesc ? (
                              <ChevronDown className="w-4 h-4 text-gray-600" />
                            ) : (
                              <ChevronUp className="w-4 h-4 text-gray-600" />
                            )
                          ) : column.canSort ? (
                            <div className="w-4 h-4"></div>
                          ) : null}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </React.Fragment>
            ))}
          </thead>
          
          <tbody {...getTableBodyProps()} className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="text-center py-10">
                  <div className="flex justify-center items-center">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="text-center py-10 text-gray-500">
                  No data available
                </td>
              </tr>
            ) : (
              memoizedRows
            )}
          </tbody>
        </table>
      </div>

      {/* Footer with pagination and items per page */}
      <div className="flex flex-col sm:flex-row justify-between items-center px-6 py-4 border-t border-gray-200">
        <div className="flex items-center mb-4 sm:mb-0">
          <span className="mr-2 text-sm text-gray-700">View</span>
          <select
            className="border border-gray-300 rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {itemsPerPageOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="text-sm text-gray-700 mb-4 sm:mb-0">
          Showing {data.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ‹
          </button>
          
          {renderPaginationButtons()}
          
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-3 py-1 text-gray-500 hover:text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginatedTable;