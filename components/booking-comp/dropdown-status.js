"use strict";

import { toast } from 'react-toastify';

import React, { useEffect, useState } from "react";
import { statusContext } from "./../../services/booking/statuses";
import { trim } from 'lodash';
import { BOOKING_TYPES } from '../constants';

export const DropdownStatus = ({ status, booking, fetchData, disabled }) => {
  const [isDrop, setIsDrop] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  const updateStatus = async (status, booking) => {
    setIsUpdating(true);
    setIsDrop(false); // Close dropdown immediately
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: status
        })
      });

      if (!response.ok) {
        // Try to parse error message from response
        let errorMessage = 'Failed to update booking status';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          // If JSON parsing fails, use default message
          console.error('Error parsing error response:', parseError);
        }
        
        toast.error(errorMessage);
        setIsUpdating(false);
        return;
      }

      // Success case
      await fetchData();
      
      if (status.name == 'eligible' && BOOKING_TYPES.FIRST_TIME_GUEST === booking.type) {
        toast.success("An invitation email has been sent to the guest.");
      } else if (status.name === 'booking_confirmed') {
        toast.success("Booking has been confirmed successfully!");
      } else if (status.name === 'booking_cancelled') {
        toast.success("Booking has been cancelled.");
      } else if (status.name === 'on_hold') {
        toast.success("Booking has been put on hold.");
      } else {
        // Generic success message for other status changes
        toast.success(`Booking status updated to ${status.label}.`);
      }
      
      setIsUpdating(false);

    } catch (error) {
      console.error('Network error updating status:', error);
      toast.error('Network error occurred. Please check your connection and try again.');
      setIsUpdating(false);
    }
  }

  return (<>
    <div className="relative">
      <button
        className={`p-2 flex justify-between items-center w-full ${
          !disabled && !isUpdating ? 'cursor-pointer' : 'cursor-not-allowed'
        } ${isUpdating ? 'opacity-50' : ''}`}
        onClick={() => {
          if (!disabled && !isUpdating) {
            setIsDrop(!isDrop);
          }
        }}
        disabled={disabled || isUpdating}
      >
        <div className='flex space-x-2 flex-nowrap'>
          <span className={`col-start-auto my-auto rounded-full h-3 w-3 ${(selectedStatus.label.length > 12 && selectedStatus.label.length < 19) && 'w-[0.9rem]'} ${selectedStatus.label.length > 19 && 'w-4'} mr-1 bg-${selectedStatus.color}-400`}></span>
          <span className={`col-span-2 text-left ml-0`}>
            {isUpdating ? 'Updating...' : trim(selectedStatus.label)}
          </span>
        </div>

        {!disabled && !isUpdating && <svg xmlns="http://www.w3.org/2000/svg"
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

        {isUpdating && (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-900"></div>
        )}
      </button>
      
      {isDrop && !isUpdating && (
        <ul className="bg-white w-full shadow-md rounded-md absolute z-50 border border-slate-300">
          <statusContext.Consumer>
            {(value) => {
              const filteredStatuses = value.filter(status => JSON.parse(status.value).name !== selectedStatus.name)
                .map(status => JSON.parse(status.value))

              return filteredStatuses.map((status, index) => {
                return (
                  <li className="w-full text-left p-2 hover:bg-gray-100 cursor-pointer" key={index} onClick={() => {
                    return updateStatus(status, booking);
                  }}>
                    <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${status.color}-400`}></span>
                    {status.label}
                  </li>
                );
              })
            }}
          </statusContext.Consumer>
        </ul>
      )}
    </div>
    {isDrop && !isUpdating && (
      <div className="fixed inset-0 h-full w-full z-40" onClick={() => setIsDrop(false)}></div>
    )}
  </>);
}