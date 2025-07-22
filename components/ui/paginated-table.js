/* eslint-disable react/display-name */
/* eslint-disable react/jsx-key */
import React, { useEffect } from "react";
import { useTable, useSortBy, useRowSelect } from "react-table";

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
          className="h-5 w-5 rounded border-gray-300 text-yellow-500 focus:ring-yellow-500 cursor-pointer"
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
  onPageSizeChange
}) {
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
          className={`${index % 2 === 0 ? "bg-white" : "bg-slate-100"} 
            ${row.isSelected ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-l-blue-500" : "hover:bg-slate-200"}`}
          {...row.getRowProps()}
        >
          {row.cells.map((cell, cellIndex) => {
            return (
              <td 
                key={cellIndex}
                className={`py-4 px-3 ${cell.column.id === 'selection' ? 'w-10' : ''}`}
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
      const currentSelectedIds = selectedRows.map(row => row.uuid);
      const newSelectedIds = newSelectedRowsData.map(row => row.uuid);
      
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

  const pageSizeOptions = [10, 20, 50, 100];

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // If total pages is less than or equal to maxVisiblePages, show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate middle pages
      let startPage = Math.max(2, currentPage - Math.floor(maxVisiblePages / 2));
      let endPage = Math.min(totalPages - 1, startPage + maxVisiblePages - 3);

      // Adjust start page if end page is too small
      if (endPage - startPage < maxVisiblePages - 3) {
        startPage = Math.max(2, endPage - (maxVisiblePages - 3));
      }

      // Add ellipsis if needed
      if (startPage > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed
      if (endPage < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="relative w-full">
      {/* Selection info row */}
      {selection && selectedFlatRows.length > 0 && (
        <div className="bg-blue-50 py-2 px-3 mb-3 rounded-md flex justify-between items-center border border-blue-200">
          <span className="text-blue-800 font-medium text-sm">
            {selectedFlatRows.length} booking{selectedFlatRows.length !== 1 ? 's' : ''} selected
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

      <div className="overflow-x-auto w-full" style={{ height: "calc(100vh - 250px)", minHeight: "400px" }}>
        <table
          {...getTableProps()}
          className="table-auto w-full border-collapse rounded-t-lg"
        >
          <thead className="bg-yellow-500 sticky top-0 z-10">
            {headerGroups.map((headerGroup, indx) => (
              <tr key={indx} {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column, index) => (
                  <th
                    className={`px-3 py-5 border-r text-left text-neutral-700 text-sm ${index === 0 && "rounded-tl-lg"} ${
                      index === headerGroup.headers.length - 1 && "rounded-tr-lg"
                    }`}
                    key={index}
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                  >
                    <div className="flex justify-between items-center w-full">
                      <span>{column.render("Header")}</span>
                      <span>
                        {column.isSorted ? (
                          column.isSortedDesc ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-6 h-6"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19.5 8.25l-7.5 7.5-7.5-7.5"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                              strokeWidth="1.5"
                              stroke="currentColor"
                              className="w-6 h-6"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M4.5 15.75l7.5-7.5 7.5 7.5"
                              />
                            </svg>
                          )
                        ) : (
                          ""
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody {...getTableBodyProps()} className="overflow-y-auto">
          {loading ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="text-center py-10">
                  <div className="flex justify-center items-center">
                    <svg className="animate-spin h-8 w-8 text-yellow-500 mr-3" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Loading...
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selection ? 1 : 0)} className="text-center py-10">
                  No data available
                </td>
              </tr>
            ) : (
              memoizedRows
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination controls */}
      <div className="flex items-center justify-between mt-5 mb-5">
        <div className="flex items-center space-x-2">
          <span className="text-sm text-slate-500">Show</span>
          <select
            className="rounded border p-1 text-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
          >
            {pageSizeOptions.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-slate-500">entries</span>
        </div>

        <div className="text-sm text-slate-500">
          Showing {data.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, totalItems)} of {totalItems} entries
        </div>

        <div className="flex items-center">
          <button
            className={`px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 text-white'}`}
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
          >
            First
          </button>
          
          <button
            className={`ml-2 px-3 py-1 rounded ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 text-white'}`}
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </button>
          
          <div className="flex mx-2">
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                className={`px-3 py-1 mx-1 rounded ${
                  page === currentPage 
                    ? 'bg-emerald-500 text-white' 
                    : page === '...' 
                      ? 'bg-transparent text-gray-500 cursor-default' 
                      : 'bg-gray-200 hover:bg-gray-300'
                }`}
                onClick={() => page !== '...' && onPageChange(page)}
                disabled={page === '...'}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            className={`mr-2 px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 text-white'}`}
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </button>
          
          <button
            className={`px-3 py-1 rounded ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-yellow-500 text-white'}`}
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
          >
            Last
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaginatedTable;