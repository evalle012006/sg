"use strict";

import { toast } from 'react-toastify';

import React, { useEffect, useState } from "react";
import { statusContext } from "./../../services/booking/statuses";
import { trim } from 'lodash';
import { BOOKING_TYPES } from '../constants';
export const DropdownStatus = ({ status, booking, fetchData, disabled }) => {
  const [isDrop, setIsDrop] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  const updateStatus = async (status, booking) => {

    await fetch(`/api/bookings/${booking.uuid}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        status: status
      })
    })
      .then(() => {
        fetchData();
        if (status.name == 'eligible' && BOOKING_TYPES.FIRST_TIME_GUEST === booking.type) {
          const notify = () => toast("An invitation email has been sent to the guest.", { type: 'success' });
          notify();
        }
      })
      .catch(err => console.log(err))
  }

  return (<>
    <div className="relative">
      <button
        className={`p-2 flex justify-between items-center w-full ${!disabled ? 'cursor-pointer' : 'cursor-not-allowed'}`}
        onClick={() => {
          !disabled && setIsDrop(!isDrop);
        }}>
        <div className='flex space-x-2 flex-nowrap'>
          <span className={`col-start-auto my-auto rounded-full h-3 w-3 ${(selectedStatus.label.length > 12 && selectedStatus.label.length < 19) && 'w-[0.9rem]'} ${selectedStatus.label.length > 19 && 'w-4'} mr-1 bg-${selectedStatus.color}-400`}></span>
          <span className={`col-span-2 text-left ml-0`}>{trim(selectedStatus.label)}</span>
        </div>

        {!disabled && <svg xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth="1.5"
          stroke="currentColor"
          className="w-6 h-6">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 8.25l-7.5 7.5-7.5-7.5"
          />
        </svg>}
      </button>
      {isDrop && <ul className="bg-white w-full shadow-md rounded-md absolute z-50 border border-slate-300">
        <statusContext.Consumer>
          {(value) => {

            const filteredStatuses = value.filter(status => JSON.parse(status.value).name !== selectedStatus.name)
              .map(status => JSON.parse(status.value))

            return filteredStatuses.map((status, index) => {
              return (
                <li className="w-full text-left p-2 hover:bg-gray-100 cursor-pointer" key={index} onClick={() => {
                  setIsDrop(false);
                  return updateStatus(status, booking);
                }}>
                  <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${status.color}-400`}></span>
                  {status.label}
                </li>
              );
            })
          }
          }
        </statusContext.Consumer>
      </ul>}
    </div>
    {isDrop && <div className="fixed inset-0 h-full w-full z-40" onClick={() => setIsDrop(false)}></div>}
  </>);
}