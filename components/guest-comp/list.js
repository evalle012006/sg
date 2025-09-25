import React, { useMemo, useEffect, useState, useContext } from "react";
import { useRouter } from "next/router";
import Image from 'next/image';
import { getGuestList } from '../../utilities/api/guests';
import { guestActions } from "../../store/guestSlice";
import { globalActions } from "../../store/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { toast } from 'react-toastify';
import { Eye, Trash2, User } from 'lucide-react';

import dynamic from 'next/dynamic';
import { getFirstLetters } from "../../utilities/common";
import ToggleButton from "../ui/toggle";
import { AbilityContext, Can } from "../../services/acl/can";
import { useDebouncedCallback } from "use-debounce";
import StatusBadge from "../ui-v2/StatusBadge";
const Table = dynamic(() => import('../ui-v2/Table'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const Modal = dynamic(() => import('../ui/modal'));

function GuestList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const list = useSelector(state => state.guest.list);
  const filteredList = useSelector(state => state.guest.filteredData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const ability = useContext(AbilityContext);

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedGuest, setSelectedGuest] = useState();
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
  const [data, setData] = useState([]);

  const debounceDeleteGuest = useDebouncedCallback((e, selected) => {
    e.preventDefault();
    handleDelete(selected);
  }, 1000);

  const handleDelete = async (selected) => {
    if (selected) {
      const response = await fetch('/api/guests/delete/', { method: 'DELETE', body: JSON.stringify(selected) });
      if (response.status == 500) {
        const data = await response.json();
        setIsLoading(false);
        if (data.error && data.message.includes('Cannot delete')) {
          toast.error('This guest is associated with a booking and cannot be deleted.');
        } else {
          toast.error('Something went wrong. Please try again later.');
        }
      }
      else if (response.error) {
        setIsLoading(false);
        console.log(response);
        toast.error('Something went wrong. Please try again later.');
      } else if (response.ok) {
        setIsLoading(false);
        setShowDeleteDialog(false);
        setTimeout(() => {
          loadGuests();
        }, 1000);
        toast.success('Selected guest was successfully deleted.');
      }
    }
  }

  const handleShowDeleteDialog = (selected) => {
    setSelectedGuest(selected);
    setShowDeleteDialog(true);
  }

  const handleShowDeactivateDialog = (selected) => {
    setSelectedGuest(selected);
    setShowDeactivateDialog(true);
  }

  const toggleGuestActive = async (e, guest) => {
    e.preventDefault();
    dispatch(globalActions.setLoading(true));
    const updatedGuest = { ...guest, active: !guest.active };
    await fetch(`/api/guests/${guest.uuid}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedGuest)
    });
    dispatch(globalActions.setLoading(false));

    loadGuests();
  }

  const renderGuestFlags = (flags) => {
    if (!flags || !Array.isArray(flags)) return null;
    
    const flagStyles = {
      'complex-care': 'bg-amber-500',
      'banned': 'bg-red-500',
      'outstanding-invoices': 'bg-fuchsia-500',
      'specific-room-requirements': 'bg-sky-500',
      'account-credit': 'bg-green-500',
      'deceased': 'bg-slate-700',
      'not-eligible': 'bg-gray-500'
    };

    return (
      <div className="flex mt-1">
        {flags.map((flag, index) => (
          <span
            key={index}
            className={`${index > 0 ? 'ml-1' : ''} ${flagStyles[flag] || 'bg-gray-500'} w-fit px-2 py-1 text-xs text-white rounded-full relative group cursor-help`}
            title={flag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
          >
            {getFirstLetters(flag)}
            <span className="absolute bg-black/90 p-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-full left-1/2 transform -translate-x-1/2 mb-1 z-10">
              {flag.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </span>
          </span>
        ))}
      </div>
    );
  };

  // Configure columns for the new Table component
  const columns = useMemo(() => {
    const baseColumns = [
      {
        key: 'name',
        label: 'NAME',
        searchable: true,
        render: (value, row) => (
          <div className="flex items-start">
            <div className="mr-3 flex-shrink-0">
              {row.profileUrl ? (
                <img
                  key={`${row.uuid}-img`}
                  src={row.profileUrl}
                  alt={`${row.first_name} ${row.last_name}`}
                  className="w-8 h-8 rounded-full object-cover"
                  onError={(e) => {
                    e.target.src = ''; // Clear broken src
                    e.target.style.display = 'none'; // Hide broken image
                  }}
                />
              ) : (
                <div className={`w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center ${row.profileUrl ? '' : 'block'}`}>
                  <User className="w-4 h-4 text-blue-600" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-gray-900">
                {row.first_name} {row.last_name}
              </div>
              {renderGuestFlags(row.flags)}
            </div>
          </div>
        )
      },
      {
        key: 'email',
        label: 'EMAIL',
        searchable: true,
        render: (value) => (
          <span className="text-gray-600">{value}</span>
        )
      },
      {
        key: 'phone_number',
        label: 'CONTACT NUMBER',
        searchable: true,
        render: (value) => (
          <span className="text-gray-600">{value}</span>
        )
      }
    ];

    // Add Active column only if user has permission
    if (ability.can("Create/Edit", "Guest")) {
      baseColumns.push({
        key: 'active',
        label: 'ACTIVE',
        searchable: false,
        render: (value, row) => (
          <div 
            className="w-fit cursor-pointer" 
            onClick={(e) => {
              e.stopPropagation();
              handleShowDeactivateDialog(row);
            }}
          >
            <ToggleButton 
              status={value} 
              disabled={!ability.can("Create/Edit", "Guest")} 
            />
          </div>
        )
      });
    }

    // Add Account Activated column
    baseColumns.push({
      key: 'email_verified',
      label: 'ACCOUNT STATUS',
      searchable: false,
      render: (value) => (
        <div className="flex justify-center">
          { value ? (
            <StatusBadge type="success" label="Active" />
          ) : (
            <StatusBadge type="error" label="Inactive" />
          )}
        </div>
      )
    });

    // Add Actions column only if user has permissions
    if (ability.can("Read", "Guest") || ability.can("Delete", "Guest")) {
      baseColumns.push({
        key: 'actions',
        label: 'ACTION',
        searchable: false,
        render: (value, row) => (
          <div className="flex items-center space-x-2">
            {ability.can("Read", "Guest") && (
              <button 
                className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                onClick={(e) => {
                  e.stopPropagation();
                  router.push(`/guests/${row.uuid}`);
                }}
              >
                <Eye className="w-4 h-4" />
              </button>
            )}
            {ability.can("Delete", "Guest") && (
              <button 
                className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleShowDeleteDialog(row);
                }}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )
      });
    }

    return baseColumns;
  }, [router, ability]);

  async function loadGuests() {
    setIsLoading(true);
    try {
      const result = await getGuestList();
      if (result) {
        const guestList = [];
        const responseData = result.users;
        responseData.map(guest => {
          let temp = { ...guest };
          temp.name = temp.first_name + " " + temp.last_name;
          temp.status = temp.email_verified ? "approved" : "pending";
          guestList.push(temp);
        });
        dispatch(guestActions.setList(guestList));
        setIsLoading(false);
      }
    } catch (e) {
      console.log(e);
      setError(e.message);
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadGuests();
  }, []);

  useEffect(() => {
    setData(list);
  }, [list]);

  if (isLoading) {
    return (
      <div className='h-screen flex items-center justify-center'>
        <Spinner />
      </div>
    )
  }

  return (
    <React.Fragment>
        {/* Table */}
        <Table 
          data={data} 
          columns={columns}
          itemsPerPageOptions={[10, 15, 25, 50]}
          defaultItemsPerPage={15}
        />

        {/* Modals */}
        {showDeleteDialog && (
          <Modal 
            title="Delete selected guest?"
            description="Selected guest data will be permanently removed."
            onClose={() => {
              setSelectedGuest(null)
              setShowDeleteDialog(false)
            }}
            onConfirm={(e) => {
              setIsLoading(true);
              debounceDeleteGuest(e, selectedGuest)
              setShowDeleteDialog(false)
            }} 
          />
        )}
        
        {showDeactivateDialog && (
          <Modal 
            title={`${selectedGuest?.active ? 'Deactivate' : 'Activate'} selected guest?`}
            description={`Selected guest account will be ${selectedGuest?.active ? 'deactivated' : 'activated'}.`}
            confirmLabel='Proceed'
            confirmColor='text-sargood-blue'
            onClose={() => {
              setSelectedGuest(null)
              setShowDeactivateDialog(false)
            }}
            onConfirm={(e) => {
              toggleGuestActive(e, selectedGuest)
              setShowDeactivateDialog(false)
            }} 
          />
        )}
    </React.Fragment>
  );
}

export default GuestList;