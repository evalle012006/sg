import { useRouter } from "next/router";
import React, { useContext, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checklistActions } from '../../store/checklistSlice';
import { toast } from "react-toastify";

import dynamic from 'next/dynamic';
import { AbilityContext, Can } from "../../services/acl/can";

const MultiSelect = dynamic(() => import('../../components/fields/select'));
const SelectComponent = dynamic(() => import('../ui/select'));

function DetailSidebar({ booking, callback }) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [guest, setGuest] = useState({});
  const [address, setAddress] = useState();
  const [checklist, setChecklist] = useState();
  const checklistData = useSelector(state => state.checklist.list);
  const [editChecklist, setEditCheckList] = useState(false);
  const [notes, setNotes] = useState('');
  const [checkListNotes, setChecklistNotes] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [originalChecklistNotes, setOriginalChecklistNotes] = useState('');
  const ability = useContext(AbilityContext);
  const user = useSelector(state => state.user.user);
  const [isSaving, setIsSaving] = useState(false);

  const [bookingLabels, setBookingLabels] = useState([]);
  const [settingsFlags, setSettingsFlags] = useState([]);
  const [selectedBookingLabels, setSelectedBookingLabels] = useState([]);

  const getCheckList = async () => {
    const res = await fetch(`/api/bookings/checklist?bookingId=${booking.id}`);
    const data = await res.json();
    
    if (data.hasOwnProperty('message')) {
      return;
    }

    setChecklist(data);
  }

  const handleOnChange = (e, index) => {
    let temp = { ...checklist };

    temp.ChecklistActions = temp.ChecklistActions.map((cka, idx) => {
      if (idx === index) {
        cka.status = e.target.checked;
        updateStatus(cka.id, cka.status);
      }

      return cka;
    });

    setChecklist(temp);
  }

  const updateStatus = async (id, status) => {
    await fetch(`/api/bookings/checklist/update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: id,
        status: status
      })
    }).then(() => {
      getCheckList();
    })
      .catch(err => console.log(err))
  }

  const handleViewBookingHistory = () => {
    router.push('./history?uuid=' + guest.uuid);
  }

  const handleAddChangeChecklist = async (selected) => {
    const checklistActions = selected.actions.map(a => {
      return {
        action: a,
        status: false,
        created_at: new Date(),
        updated_at: new Date()
      }
    });

    const checklistData = {
      name: selected.name,
      booking_id: booking.id,
      created_at: new Date(),
      updated_at: new Date(),
      ChecklistActions: checklistActions
    }

    const response = await fetch('/api/bookings/checklist/add-update', {
      method: 'POST',
      body: JSON.stringify(checklistData),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      toast.success('Checklist selected succesfully added.');
      getCheckList();
      setEditCheckList(false);
    }
  }

  const handleNotesChange = (e) => {
    setNotes(e.target.value);
  };

  const handleChecklistNotesChange = (e) => {
    setChecklistNotes(e.target.value);
  };

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ notes })
      });

      if (response.ok) {
        setOriginalNotes(notes);
        toast.success('Notes saved successfully');
        callback && callback();
      }
    } catch (error) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChecklistNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-checklist-notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ checklist_notes: checkListNotes })
      });

      if (response.ok) {
        setOriginalChecklistNotes(checkListNotes);
        toast.success('Checklist notes saved successfully');
        callback && callback();
      }
    } catch (error) {
      toast.error('Failed to save checklist notes');
    } finally {
      setIsSaving(false);
    }
  };

  const fetchChecklistData = async () => {
    const response = await fetch("/api/manage-checklist")

    if (response.ok) {
      const respData = await response.json();
      const ckData = respData.map(ck => { return { ...ck, value: ck.id, label: ck.name } });
      dispatch(checklistActions.setList(ckData));
    }
  }

  const handleSelectBookingLabel = async (selectedLabels) => {
    const response = await fetch(`/api/bookings/${booking.uuid}/update-label`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ label: selectedLabels })
    });

    if (response.ok) {
        callback && callback();
    }
  }

  useEffect(() => {
    const fetchSettingsFlagsList = async () => {
      const response = await fetch('/api/settings/booking_flag');

      if (response.ok) {
        const data = await response.json();
        setSettingsFlags(data.map(flag => flag.value));
      }
    }
    fetchSettingsFlagsList();
  }, []);

  useEffect(() => {
    let mounted = true;

    if (mounted && booking) {
      getCheckList(booking);
      setGuest(booking.Guest);
      setNotes(booking?.notes || '');
      setOriginalNotes(booking?.notes || '');
      setChecklistNotes(booking?.checklist_notes || '');
      setOriginalChecklistNotes(booking?.checklist_notes || '');

      if (booking?.label) {
        let existingLabels = booking.label ? typeof booking.label == 'string' ? JSON.parse(booking.label) : booking.label : null;
        if (existingLabels && !Array.isArray(existingLabels)) {
          existingLabels = [existingLabels.value];
        }
        setSelectedBookingLabels(existingLabels.map(flag => _.startCase(flag)));
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: existingLabels && existingLabels?.includes(flag)
        })))
      } else {
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: false
        })))
      }
    }
    mounted && fetchChecklistData();

    return (() => {
      mounted = false;
    });
  }, [booking, settingsFlags]);

  useEffect(() => {
    if (guest.hasOwnProperty('Addresses') && guest.Addresses.length > 0) {
      setAddress(guest.Addresses[0]);
    }
  }, [guest]);

  const hasNotesChanges = notes !== originalNotes;
  const hasChecklistNotesChanges = checkListNotes !== originalChecklistNotes;

  return (
    <div className="">
      <div className="pt-10 overflow-scroll h-screen scrollbar-hidden">
        <h1 className="text-sky-700 font-bold text-3xl mb-3">{guest && `${guest.first_name} ${guest.last_name}`}</h1>
        <p className="">{address && `${address.address_line_1} ${address.address_line_2} ${address.city} ${address.country} ${address.zip_code}`}</p>
        <p className="">{guest && guest.email}</p>
        <p className="">{guest && guest.phone_number}</p>

        {booking ? <div className="flex flex-wrap">
          <div className="info-item w-full">
            <label>Alternate Contact</label>
            <p>{booking.alternate_contact_name ? booking.alternate_contact_name : 'N/A'}</p>
            <p>{booking.alternate_contact_number ? booking.alternate_contact_number : 'N/A'}</p>
          </div>
        </div>
          : null}

        {user && user.type == 'user' && (
          <>
            <div className="flex flex-col mt-2 mb-4">
              <MultiSelect type="multi-select" options={bookingLabels} onChange={handleSelectBookingLabel} value={selectedBookingLabels} width='100%'/>
            </div>
            <div className="flex flex-col mt-2 mb-4">
              <textarea
                disabled={!ability.can("Create/Edit", "Booking")}
                className={`peer block min-h-[auto] w-full rounded border-0 px-3 py-[0.32rem] leading-[1.6] outline-none transition-all duration-200 ease-linear focus:placeholder:opacity-100 data-[te-input-state-active]:placeholder:opacity-100 motion-reduce:transition-none ${isSaving ? 'bg-gray-50' : ''}`}
                rows="7"
                value={notes}
                onChange={handleNotesChange}
                placeholder={ability.can("Create/Edit", "Booking") ? 'Enter your notes here' : ''}>
              </textarea>
              {hasNotesChanges && (
                <button
                  onClick={handleSaveNotes}
                  disabled={isSaving}
                  className="mt-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </>
        )}

        <Can I="Create/Edit" a="Booking">
          {checklist && checklist?.ChecklistActions?.length > 0 ? (
            <div className="flex flex-col my-3 w-full">
              {editChecklist ?
                <SelectComponent options={checklistData} onChange={handleAddChangeChecklist} value={checklist.name} width='100%' />
                :
                <React.Fragment>
                  <span className="underline text-base text-sargood-blue cursor-pointer flex justify-end" onClick={() => setEditCheckList(true)}>Change Checklist</span>
                  <p className="text-sky-700 font-bold mr-4 flex justify-start">{checklist.name}</p>
                </React.Fragment>
              }
            </div>
          ) : (
            <div className="flex flex-row justify-between w-full">
              {editChecklist ? (
                <React.Fragment>
                  <SelectComponent options={checklistData} onChange={handleAddChangeChecklist} width='100%' />
                </React.Fragment>
              )
                :
                <React.Fragment>
                  <span className="italic">No checklist added</span>
                  <span className="underline text-base text-sargood-blue cursor-pointer" onClick={() => setEditCheckList(true)}>Add Checklist</span>
                </React.Fragment>
              }
            </div>
          )}
          <div className={`${checklist && 'overflow-scroll scrollbar-hidden'} mb-8`}>
            <div className="">
              {checklist && checklist?.ChecklistActions?.map((cka, idx) => {
                return (
                  <div key={idx} className="mt-2">
                    <label className="flex flex-row items-start p-2">
                      <input
                        type="checkbox"
                        name={cka.id}
                        className="w-4 h-4 text-green-600 border-0 rounded-md focus:ring-0"
                        value={cka.status}
                        onChange={(e) => handleOnChange(e, idx)}
                        checked={cka.status}
                      />
                      <span className="ml-2 -mt-1">{cka.action}</span>
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        </Can>

        {user && user.type == 'user' && (
          <React.Fragment>
            <div className="flex flex-col mt-2 mb-4">
              <textarea
                disabled={!ability.can("Create/Edit", "Booking")}
                className={`peer block min-h-[auto] w-full rounded border-0 px-3 py-[0.32rem] leading-[1.6] outline-none transition-all duration-200 ease-linear focus:placeholder:opacity-100 data-[te-input-state-active]:placeholder:opacity-100 motion-reduce:transition-none ${isSaving ? 'bg-gray-50' : ''}`}
                rows="7"
                value={checkListNotes}
                onChange={handleChecklistNotesChange}
                placeholder={ability.can("Create/Edit", "Booking") ? 'Enter your notes here' : ''}>
              </textarea>
              {hasChecklistNotesChanges && (
                <button
                  onClick={handleSaveChecklistNotes}
                  disabled={isSaving}
                  className="mt-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:bg-gray-400"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
            <div className="flex justify-center items-center sticky bottom-0 bg-zinc-100 w-full h-36">
              <button className="bg-white w-full p-4 mt-2 border-2 border-emerald-400 rounded-lg font-bold text-emerald-400" onClick={handleViewBookingHistory}>View Booking History</button>
            </div>
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

export default DetailSidebar;