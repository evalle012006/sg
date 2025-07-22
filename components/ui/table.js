/* eslint-disable react/display-name */
/* eslint-disable react/jsx-key */
import React, { useEffect, useState } from "react";
import { useTable, usePagination, useRowSelect, useSortBy } from "react-table";

const IndeterminateCheckbox = React.forwardRef(
  ({ indeterminate, ...rest }, ref) => {
    const defaultRef = React.useRef();
    const resolvedRef = ref || defaultRef;

    React.useEffect(() => {
      resolvedRef.current.indeterminate = indeterminate;
    }, [resolvedRef, indeterminate]);

    return (
      <div className="">
        <input
          className="rounded-md p-2"
          type="checkbox"
          ref={resolvedRef}
          {...rest}
        />
      </div>
    );
  }
);

function Table({ columns, apiResult, hiddenColumns = [], selection = false }) {
  const [col, setCol] = useState(columns);
  const [data, setData] = useState(apiResult);

  useEffect(() => {
    setData(apiResult);
  }, [apiResult]);

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: { pageIndex: 0, hiddenColumns: hiddenColumns },
      autoResetPage: false
    },
    useSortBy,
    usePagination,
    useRowSelect,
    (hooks) => {
      if (selection) {
        hooks.visibleColumns.push((columns) => [
          // Let's make a column for selection
          {
            id: "selection",
            // The header can use the table's getToggleAllRowsSelectedProps method
            // to render a checkbox
            Header: ({ getToggleAllRowsSelectedProps }) => (
              <div className="">
                <IndeterminateCheckbox {...getToggleAllRowsSelectedProps()} />
              </div>
            ),
            // The cell can use the individual row's getToggleRowSelectedProps method
            // to the render a checkbox
            Cell: ({ row }) => (
              <div className="">
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
    page, // Instead of using 'rows', we'll use page,
    // which has only the rows for the active page

    // The rest of these things are super handy, too ;)
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    state: { pageIndex, pageSize },
  } = tableInstance;

  return (
    <div className="relative h-full">
      {/* <pre>
        <code>
          {JSON.stringify(
            {
              pageIndex,
              pageSize,
              pageCount,
              canNextPage,
              canPreviousPage,
            },
            null,
            2
          )}
        </code>
      </pre> */}
      <table
        {...getTableProps()}
        className="table-auto w-full border-collapse rounded-t-lg h-full"
      >
        <thead className="bg-yellow-500">
          {headerGroups.map((headerGroup, indx) => (
            <tr key={indx} {...headerGroup.getHeaderGroupProps()}>
              {headerGroup.headers.map((column, index) => (
                <th
                  className={`px-3 py-5 border-r text-left text-neutral-700 text-sm ${index === 0 && "rounded-tl-lg"
                    } ${index === headerGroup.headers.length - 1 && "rounded-tr-lg"
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
        <tbody {...getTableBodyProps()}>
          {page.map((row, index) => {
            prepareRow(row);
            return (
              <tr
                className={`${index % 2 == 0 ? "bg-white" : "bg-slate-100"}`}
                {...row.getRowProps()}
              >
                {row.cells.map((cell, index) => {
                  return (
                    <td className={`py-4 px-3 `} {...cell.getCellProps()}>
                      {cell.render("Cell")}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="pagination flex items-center justify-center mt-5">
        <div className="flex justify-between items-center w-full">
          <div className="flex items-center">
            <button
              className={`shadow rounded-md py-2 px-8 mr-5 ${!canPreviousPage ? "bg-slate-50" : "bg-emerald-400 text-white"
                }`}
              onClick={() => previousPage()}
              disabled={!canPreviousPage}
            >
              Previous Page
            </button>{" "}
            <div>
              <span className="text-sm text-slate-500">
                Page {pageIndex + 1} of {pageOptions.length}
              </span>
            </div>
          </div>

          <div>
            <button
              className={`shadow rounded-md py-2 px-8 ${!canNextPage ? "bg-slate-50" : "bg-emerald-500 text-white"
                }`}
              onClick={() => nextPage()}
              disabled={!canNextPage}
            >
              Next Page
            </button>{" "}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Table;
