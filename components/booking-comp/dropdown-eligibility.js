"use strict";

import { toast } from 'react-toastify';

import React, { useEffect, useState } from "react";
import { eligibilityContext } from "../../services/booking/eligibilities";
import { trim } from 'lodash';
import Modal from '../ui/modal';
export const DropdownEligibility = ({ status, booking, fetchData, disabled }) => {
  const [isDrop, setIsDrop] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(status);
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);

  useEffect(() => {
    setSelectedStatus(status);
  }, [status]);

  const handleShowDeactivateDialog = (selected) => {
    setSelectedStatus(selected);
    setShowDeactivateDialog(true);
  }

  const handleStatusChange = (status, booking) => {
    if (status) {
      if (status?.name == 'ineligible') {
        handleShowDeactivateDialog(status);
      } else {
        updateStatus(status, booking);
      }
    }
  }

  const updateStatus = async (status, booking) => {
    console.log(status, booking)
    await fetch(`/api/bookings/${booking.uuid}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ eligibility: status })
    })
      .then(() => {
        fetchData();
        if (status.name == 'eligible' && booking.type == 'Enquiry') {
          const notify = () => toast("An invitation email has been sent to the guest.", { type: 'success' });
          notify();
        }
        if (status.name == 'ineligible') {
          const notify = () => toast("An email has been sent to the guest.", { type: 'success' });
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
        <eligibilityContext.Consumer>
          {(value) => {

            const filteredStatuses = value.filter(status => JSON.parse(status.value).name !== selectedStatus.name)
              .map(status => JSON.parse(status.value))

            return filteredStatuses.map((status, index) => {
              return (
                <li className="w-full text-left p-2 hover:bg-gray-100 cursor-pointer" key={index} onClick={() => {
                  setIsDrop(false);
                  handleStatusChange(status, booking);
                }}>
                  <span className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${status.color}-400`}></span>
                  {status.label}
                </li>
              );
            })
          }
          }
        </eligibilityContext.Consumer>
      </ul>}
    </div>
    {isDrop && <div className="fixed inset-0 h-full w-full z-40" onClick={() => setIsDrop(false)}></div>}
    {(showDeactivateDialog && selectedStatus) && <Modal title={`Deactivate Guest`}
      description={`Selected guest account will be deactivated.`}
      confirmLabel='Proceed'
      confirmColor='text-sargood-blue'
      onClose={() => {
        setSelectedGuest(null)
        setShowDeactivateDialog(false)
      }}
      onConfirm={(e) => {
        updateStatus(selectedStatus, booking);
        setShowDeactivateDialog(false)
      }} />}
  </>);
}