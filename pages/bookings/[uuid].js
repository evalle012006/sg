import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Package, 
  FileText, 
  Settings, 
  User,
  AlertCircle,
  Home,
} from 'lucide-react';
import moment from 'moment';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { globalActions } from "../../store/globalSlice";
import { checklistActions } from '../../store/checklistSlice';
import { Can, AbilityContext } from "../../services/acl/can";
import { fetchBookingStatuses, fetchBookingEligibilities } from "../../services/booking/statuses";
import { QUESTION_KEYS } from "./../../services/booking/question-helper";
import dynamic from 'next/dynamic';
import _ from 'lodash';
import { getCancellationType, getFirstLetters, getFunder, isBookingCancelled } from "../../utilities/common";
import CancellationModal from '../../components/booking-comp/CancellationModal';

const Layout = dynamic(() => import('../../components/layout'));
const BookingEditView = dynamic(() => import('../../components/booking-comp/booking-edit-view'));
const AssetsAndEquipment = dynamic(() => import('../../components/booking-comp/assets-and-equipment'));
const Box = dynamic(() => import('../../components/booking-comp/box'));
const SelectComponent = dynamic(() => import('../../components/ui/select'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const Select = dynamic(() => import('../../components/fields/select'));
const CustomAccordionItem = dynamic(() => import('../../components/booking-comp/component-display/CustomAccordionItem'));
const FunderImageDisplay = dynamic(() => import('../../components/booking-comp/component-display/FunderImageDisplay'));
const QuestionDisplay = dynamic(() => import('../../components/booking-comp/component-display/QuestionDisplay'));
const AmendmentDisplay = dynamic(() => import('../../components/booking-comp/component-display/AmendmentDisplay'));

const handleEditBooking = (uuid) => {
  window.open(`/booking-request-form?uuid=${uuid}&origin=admin`, '_blank');
};

// Sidebar Component for flags, notes, checklist
const DetailSidebar = ({ booking, callback, guest, address, setEditBooking }) => {
  const dispatch = useDispatch();
  const [checklist, setChecklist] = useState();
  const checklistData = useSelector(state => state.checklist.list);
  const [editChecklist, setEditCheckList] = useState(false);
  const [notes, setNotes] = useState('');
  const [checkListNotes, setChecklistNotes] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [originalChecklistNotes, setOriginalChecklistNotes] = useState('');
  const user = useSelector(state => state.user.user);
  const [isSaving, setIsSaving] = useState(false);
  const [bookingLabels, setBookingLabels] = useState([]);
  const [settingsFlags, setSettingsFlags] = useState([]);
  const [selectedBookingLabels, setSelectedBookingLabels] = useState([]);

  const handleAddChangeChecklist = async (selected) => {
    const checklistActions = selected.actions.map(a => ({
      action: a,
      status: false,
      created_at: new Date(),
      updated_at: new Date()
    }));

    const checklistData = {
      name: selected.name,
      booking_id: booking.id,
      created_at: new Date(),
      updated_at: new Date(),
      ChecklistActions: checklistActions
    };

    const response = await fetch('/api/bookings/checklist/add-update', {
      method: 'POST',
      body: JSON.stringify(checklistData),
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      toast.success('Checklist successfully added.');
      // Close the edit mode
      setEditCheckList(false);
      // Refresh the local checklist data
      await getCheckList();
      // Refresh the booking data
      callback && callback();
    }
  };

  const fetchChecklistData = async () => {
    const response = await fetch("/api/manage-checklist");
    if (response.ok) {
      const respData = await response.json();
      const ckData = respData.map(ck => ({ ...ck, value: ck.id, label: ck.name }));
      dispatch(checklistActions.setList(ckData));
    }
  };

  // Handle checklist operations
  const getCheckList = async () => {
    const res = await fetch(`/api/bookings/checklist?bookingId=${booking.id}`);
    const data = await res.json();
    
    if (!data.hasOwnProperty('message')) {
      setChecklist(data);
    }
  };

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
  };

  const updateStatus = async (id, status) => {
    await fetch(`/api/bookings/checklist/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
  };

  // Handle notes
  const handleNotesChange = (e) => setNotes(e.target.value);
  const handleChecklistNotesChange = (e) => setChecklistNotes(e.target.value);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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

  const handleSelectBookingLabel = async (selectedLabels) => {
    // Ensure selectedLabels is an array of strings
    const labelStrings = selectedLabels.map(item => {
      // Handle case where item might be an object with a 'label' property
      if (typeof item === 'object' && item !== null) {
        return item.label || item.value || String(item);
      }
      // Handle case where item is already a string
      return String(item);
    });

    // Convert display labels back to original format for API
    const apiLabels = labelStrings.map(displayLabel => {
      // Find the original flag value from the display label
      const matchingFlag = settingsFlags.find(flag => 
        _.startCase(flag) === displayLabel
      );
      return matchingFlag || displayLabel.toLowerCase().replace(/\s+/g, '_');
    });

    const response = await fetch(`/api/bookings/${booking.uuid}/update-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: apiLabels })
    });

    if (response.ok) {
      callback && callback();
    }
  };

  const handleViewBookingHistory = () => {
    window.open(`/guests/${guest.uuid}`, '_blank');
  };

  useEffect(() => {
    const fetchSettingsFlagsList = async () => {
      const response = await fetch('/api/settings/booking_flag');
      if (response.ok) {
        const data = await response.json();
        setSettingsFlags(data.map(flag => flag.value));
      }
    };
    fetchSettingsFlagsList();
  }, []);

  useEffect(() => {
    let mounted = true;

    if (mounted && booking && settingsFlags.length > 0) {
      getCheckList();
      fetchChecklistData();
      setNotes(booking?.notes || '');
      setOriginalNotes(booking?.notes || '');
      setChecklistNotes(booking?.checklist_notes || '');
      setOriginalChecklistNotes(booking?.checklist_notes || '');

      // FIXED: Process booking labels properly
      if (booking?.label) {
        let existingLabels = booking.label;
        
        // Parse if it's a string
        if (typeof booking.label === 'string') {
          try {
            existingLabels = JSON.parse(booking.label);
          } catch (e) {
            console.warn('Failed to parse booking label:', e);
            existingLabels = [];
          }
        }
        
        // Ensure it's an array
        if (!Array.isArray(existingLabels)) {
          if (existingLabels && typeof existingLabels === 'object' && existingLabels.value) {
            existingLabels = [existingLabels.value];
          } else {
            existingLabels = [];
          }
        }
        
        // FIXED: Extract values from objects if needed
        const labelValues = existingLabels.map(label => {
          if (typeof label === 'object' && label.value) {
            return label.value;
          }
          return label;
        }).filter(Boolean);
        
        // Set selected labels (display format using startCase)
        setSelectedBookingLabels(labelValues.map(flag => _.startCase(flag)));
        
        // Set all available booking labels
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: labelValues.includes(flag)
        })));
      } else {
        setSelectedBookingLabels([]);
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: false
        })));
      }
    }

    return () => {
      mounted = false;
    };
  }, [booking, settingsFlags]);

  const hasNotesChanges = notes !== originalNotes;
  const hasChecklistNotesChanges = checkListNotes !== originalChecklistNotes;

  return (
    <div className="bg-white h-full overflow-y-auto border-l">
      {/* Guest Info Header */}
      <div className="p-4">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            {guest?.profileFileUrl ? (
              <Image 
                src={guest.profileFileUrl} 
                alt={`${guest?.first_name} ${guest?.last_name}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-full h-full flex items-center justify-center text-gray-500 ${guest?.profileFileUrl ? 'hidden' : 'flex'}`}
              style={{ display: guest?.profileFileUrl ? 'none' : 'flex' }}
            >
              {guest?.first_name && guest?.last_name ? (
                <span className="text-lg font-medium text-gray-600">
                  {guest.first_name.charAt(0)}{guest.last_name.charAt(0)}
                </span>
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {guest?.first_name} {guest?.last_name}
            </h2>
            <div className="space-y-1 text-sm">
              {guest?.email && (
                <div className="text-blue-600">{guest.email}</div>
              )}
              {guest?.phone_number && (
                <div className="text-gray-600">{guest.phone_number}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alternate Contact Section */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">ALTERNATE CONTACT</h3>
        <div className="space-y-2 text-sm text-gray-500">
          <div>{booking.alternate_contact_name ? booking.alternate_contact_name : 'N/A'}</div>
          <div>{booking.alternate_contact_phone ? booking.alternate_contact_phone : 'N/A'}</div>
        </div>
      </div>

      {user && user.type === 'user' && (
        <Can I="Create/Edit" a="Booking">
          <div className="p-4 space-y-6">
            {/* FIXED: Booking Labels with proper options */}
            <div>
              <Select 
                type="multi-select" 
                options={bookingLabels} 
                onChange={handleSelectBookingLabel} 
                value={selectedBookingLabels} 
                multi={true}
              />
            </div>

            {/* Notes */}
            <div>
              <textarea
                disabled={isSaving}
                className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${isSaving ? 'bg-gray-50' : ''}`}
                rows="6"
                value={notes}
                onChange={handleNotesChange}
                placeholder="Enter your note here"
              />
              {hasNotesChanges && (
                <div className="mt-3">
                  <Button
                    color="primary"
                    size="small"
                    label={isSaving ? "Saving..." : "Save Changes"}
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            <div>
              <Can I="Create/Edit" a="Booking">
                {checklist && checklist?.ChecklistActions?.length > 0 ? (
                  <div className="flex flex-col my-3 w-full">
                    {editChecklist ? (
                      <SelectComponent 
                        options={checklistData} 
                        onChange={handleAddChangeChecklist} 
                        value={checklist.name} 
                        width='100%' 
                      />
                    ) : (
                      <React.Fragment>
                        <span 
                          className="underline text-base text-blue-600 cursor-pointer flex justify-end mb-2" 
                          onClick={() => setEditCheckList(true)}
                        >
                          Change Checklist
                        </span>
                        <p className="text-blue-700 font-bold mr-4 flex justify-start mb-4">{checklist.name}</p>
                      </React.Fragment>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-row justify-between w-full mb-4">
                    {editChecklist ? (
                      <SelectComponent 
                        options={checklistData} 
                        onChange={handleAddChangeChecklist} 
                        width='100%' 
                      />
                    ) : (
                      <React.Fragment>
                        <span className="italic text-gray-500">No checklist added</span>
                        <span 
                          className="underline text-base text-blue-600 cursor-pointer" 
                          onClick={() => setEditCheckList(true)}
                        >
                          Add Checklist
                        </span>
                      </React.Fragment>
                    )}
                  </div>
                )}

                {/* Checklist Items Display */}
                <div className={`${checklist && 'overflow-scroll scrollbar-hidden'} mb-8`}>
                  {checklist && checklist?.ChecklistActions?.map((cka, idx) => (
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
                  ))}
                </div>
              </Can>

              {/* Fallback for users without edit permissions */}
              <Can not I="Create/Edit" a="Booking">
                <div className="text-sm text-gray-500 mb-3">No checklist access</div>
              </Can>
            </div>

            {/* Checklist Notes */}
            <div>
              <textarea
                disabled={isSaving}
                className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${isSaving ? 'bg-gray-50' : ''}`}
                rows="4"
                value={checkListNotes}
                onChange={handleChecklistNotesChange}
                placeholder="Enter your note here"
              />
              {hasChecklistNotesChanges && (
                <div className="mt-3">
                  <Button
                    color="primary"
                    size="small"
                    label={isSaving ? "Saving..." : "Save Changes"}
                    onClick={handleSaveChecklistNotes}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            {/* View Booking History */}
            <div className="pt-4">
              <Button 
                color="outline"
                size="medium"
                label="VIEW BOOKING HISTORY"
                onClick={handleViewBookingHistory}
                fullWidth={true}
                className="flex items-center justify-center"
              />
            </div>
          </div>
        </Can>
      )}

      {/* Limited view for guests */}
      {user && user.type === 'guest' && (
        <div className="p-6">
          <div className="text-center text-gray-500">
            <p className="text-sm">Limited information available for guest view.</p>
          </div>
        </div>
      )}

      {/* No user or unauthorized */}
      {!user && (
        <div className="p-6 text-center">
          <div className="text-gray-400 mb-3">
            <User className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-gray-500">Please log in to view booking details</p>
        </div>
      )}
    </div>
  );
};

// Main BookingDetail Component
export default function BookingDetail() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { uuid } = router.query;
  const currentUser = useSelector(state => state.user.user);
  const loading = useSelector(state => state.global.loading);
  
  // Check user type and permissions
  const isUser = currentUser && currentUser.type === 'user';
  const isGuest = currentUser && currentUser.type === 'guest';
  
  // Main state
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [healthInfo, setHealthInfo] = useState(null);

  const [openAccordionItems, setOpenAccordionItems] = useState(() => {
    // Initialize with empty object, will be set by useEffect
    return {};
  });
  const [editBooking, setEditBooking] = useState(false);
  const [editEquipment, setEditEquipment] = useState(false);
  
  // Package-related state
  const [packageDetails, setPackageDetails] = useState(null);
  const [loadingPackageDetails, setLoadingPackageDetails] = useState(false);
  
  // Add state for dropdowns
  const [statuses, setStatuses] = useState([]);
  const [eligibilities, setEligibilities] = useState([]);
  
  const [loadingStates, setLoadingStates] = useState({
    booking: true,
    amendments: false,
    healthInfo: false,
    equipment: false
  });

  // Course-related state
  const [courseDetails, setCourseDetails] = useState(null);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);

  // Funder-related state  
  const [funderOptions, setFunderOptions] = useState(null);
  const [selectedFunderOption, setSelectedFunderOption] = useState(null);

  const accordionInitialized = useRef(false);

  const [editingPackage, setEditingPackage] = useState(false);
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackageOptions, setLoadingPackageOptions] = useState(false);
  const [selectedPackageValue, setSelectedPackageValue] = useState(null);

  const [showCancellationModal, setShowCancellationModal] = useState(false);
  const [pendingCancellationStatus, setPendingCancellationStatus] = useState(null);

  const isCancellationStatus = (statusName) => {
    return ['booking_cancelled', 'guest_cancelled'].includes(statusName);
  };

  const hidePages = ['packages'];

  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Helper function to find package QA pair info from current booking data
  const findPackageQaPairInfo = useCallback(() => {
    if (!booking?.Sections) {
      console.log('❌ findPackageQaPairInfo: No booking.Sections found');
      return null;
    }
    
    let qaPairData = null;
    
    booking.Sections.forEach((section, sIdx) => {
      section.QaPairs?.forEach((qaPair, qIdx) => {
        const question = qaPair.Question;
        
        // Get question_key from Question object
        const questionKey = question?.question_key || '';
        
        // Get question type - check both qaPair level and Question level
        const questionType = qaPair.question_type || question?.type || '';
        
        // Check for package-related questions using QUESTION_KEYS constants
        const isPackageQuestion = 
          questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
          questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL ||
          questionType === 'package-selection';
        
        if (isPackageQuestion) {
          qaPairData = {
            qaPair: qaPair,
            section: section,
            question: question,
            questionType: questionType,
            questionKey: questionKey,
            currentAnswer: qaPair.answer,
            qaPairId: qaPair.id
          };
        }
      });
    });

    if (!qaPairData) {
      console.warn('⚠️ findPackageQaPairInfo: No package QA pair found');
    }

    return qaPairData;
  }, [booking]);

  const handleUpdatePackageWithData = useCallback(async (selectedOption, packageQaPairData) => {
    if (!packageQaPairData || !selectedOption) {
      console.error('❌ Missing required data:', { packageQaPairData, selectedOption });
      toast.error('Unable to update package. Missing required information.');
      return;
    }
    
    setIsSavingPackage(true);
    dispatch(globalActions.setLoading(true));
    
    try {
      const { qaPairId, currentAnswer } = packageQaPairData;
      
      const response = await fetch(`/api/qa-pairs/${qaPairId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: selectedOption.value,
          oldAnswer: currentAnswer
        })
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update package';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('❌ API Error:', errorData);
        } catch (e) {
          console.error('❌ Could not parse error response');
        }
        toast.error(errorMessage);
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Package updated successfully!');
        setEditingPackage(false);
        setSelectedPackageValue(null);
        setPackageOptions([]);
        
        // Refresh booking data
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        toast.error(result.message || 'Failed to update package');
        console.error('❌ Update failed:', result);
      }
    } catch (error) {
      console.error('❌ Error updating package:', error);
      toast.error(`Failed to update package: ${error.message}`);
    } finally {
      setIsSavingPackage(false);
      dispatch(globalActions.setLoading(false));
    }
  }, [dispatch, fetchBooking]);

  useEffect(() => {
    const loadOptions = async () => {
      if (!editingPackage || !packageQaPairInfo) {
        return;
      }
      
      setLoadingPackageOptions(true);
      
      try {
        const { question, questionType, currentAnswer } = packageQaPairInfo;

        // Check if this is a package-selection type question
        if (questionType === 'package-selection' || 
            question?.type === 'package-selection') {
          
          const funderDisplay = getFunderTypeDisplay();
          const funderValue = funderDisplay?.value || funderInfo?.answer;
          
          // Build the API URL with funder parameter
          let apiUrl = '/api/packages';
          const params = new URLSearchParams();
          
          if (funderValue) {
            params.append('funder', funderValue);
          }
          
          // Add other useful params
          params.append('limit', '100');
          params.append('sort', 'name');
          
          const queryString = params.toString();
          if (queryString) {
            apiUrl += `?${queryString}`;
          }
          
          const response = await fetch(apiUrl);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.packages) {
              const formattedOptions = data.packages.map(pkg => ({
                label: pkg.name,
                value: pkg.id.toString(),
                packageData: pkg
              }));
              
              setPackageOptions(formattedOptions);
              
              // Set the current package as selected
              if (currentAnswer) {
                setSelectedPackageValue(currentAnswer.toString());
              }
            } else {
              console.error('Invalid API response structure:', data);
              toast.error('Invalid package data received');
            }
          } else {
            console.error('API request failed:', response.status);
            toast.error('Failed to fetch packages from server');
          }
        } else {
          // Load options from Question.options (existing code)
          if (question?.options) {
            try {
              const options = typeof question.options === 'string' 
                ? JSON.parse(question.options) 
                : question.options;
              
              console.log('Parsed options:', options);
              
              const formattedOptions = Array.isArray(options) ? options.map(option => ({
                label: option.label || option.name || option.value,
                value: option.value || option.id || option.label,
                optionData: option
              })) : [];
              
              console.log('Formatted options:', formattedOptions);
              setPackageOptions(formattedOptions);
              
              if (currentAnswer) {
                console.log('Setting current answer:', currentAnswer);
                setSelectedPackageValue(currentAnswer.toString());
              }
            } catch (e) {
              console.error('Failed to parse package options:', e);
              toast.error('Failed to parse package options');
              setPackageOptions([]);
            }
          } else {
            console.warn('No options available in question object');
            toast.error('No package options available');
          }
        }
      } catch (error) {
        console.error('Error loading package options:', error);
        toast.error('Failed to load package options');
      } finally {
        setLoadingPackageOptions(false);
      }
    };

    loadOptions();
  }, [editingPackage, packageQaPairInfo, funderInfo]); 

  const handleUpdatePackage = useCallback(async (selectedOption) => {
    
    if (!packageQaPairInfo || !selectedOption) {
      console.error('❌ Missing required data:', { packageQaPairInfo, selectedOption });
      toast.error('Unable to update package. Missing required information.');
      return;
    }
    
    setIsSavingPackage(true);
    dispatch(globalActions.setLoading(true));
    
    try {
      const { qaPairId, currentAnswer } = packageQaPairInfo;
      
      const response = await fetch(`/api/qa-pairs/${qaPairId}/update`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          answer: selectedOption.value,
          oldAnswer: currentAnswer
        })
      });
      
      if (!response.ok) {
        let errorMessage = 'Failed to update package';
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
          console.error('❌ API Error:', errorData);
        } catch (e) {
          console.error('❌ Could not parse error response');
        }
        toast.error(errorMessage);
        return;
      }
      
      const result = await response.json();
      
      if (result.success) {
        toast.success('Package updated successfully!');
        setEditingPackage(false);
        setSelectedPackageValue(null);
        setPackageOptions([]);
        
        // Refresh booking data - use uuid directly instead of relying on closure
        console.log('🔄 Refreshing booking data...');
        await fetchBooking();
        console.log('✅ Booking data refreshed');
      } else {
        toast.error(result.message || 'Failed to update package');
        console.error('❌ Update failed:', result);
      }
    } catch (error) {
      console.error('❌ Error updating package:', error);
      toast.error(`Failed to update package: ${error.message}`);
    } finally {
      setIsSavingPackage(false);
      dispatch(globalActions.setLoading(false));
    }
  }, [packageQaPairInfo, dispatch, uuid]);

  // Change from useCallback to regular function
  const handleEditPackage = () => {
    console.log('🔍 Edit button clicked. Current packageQaPairInfo:', packageQaPairInfo);
    
    if (!packageQaPairInfo) {
      console.error('❌ Cannot edit package - packageQaPairInfo is null');
      toast.error('Package information is not ready. Please wait a moment and try again.');
      return;
    }
    
    console.log('✅ Starting package edit with:', packageQaPairInfo);
    setEditingPackage(true);
    setSelectedPackageValue(packageQaPairInfo?.currentAnswer || null);
  };

  const handleCancelPackageEdit = useCallback(() => {
    setEditingPackage(false);
    setSelectedPackageValue(null);
    setPackageOptions([]);
  }, []);

  // Helper function to serialize package names to short codes
  const serializePackage = (packageType) => {
    if (packageType.includes("Wellness & Very High Support Package")) {
      return "WVHS";
    } else if (packageType.includes("Wellness & High Support Package")) {
      return "WHS";
    } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
      return "WS";
    } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
      return "SP"
    } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
      return "CSP"
    } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
      return "HCSP"
    } else {
      return '';
    }
  };

  // Get course information
  const courseInfo = useMemo(() => {
    if (!booking?.Sections) {
      return null;
    }
    
    let course = null;
    let courseId = null;
    let questionType = null;
    let questionKey = null;
    
    booking.Sections.forEach((section) => {
      section.QaPairs?.forEach((qaPair) => {
        const question = qaPair.Question;
        const qKey = question?.question_key || '';
        const qType = qaPair.question_type || question?.type || '';
        
        // Use QUESTION_KEYS constant
        const isCourseQuestion = 
          qKey === QUESTION_KEYS.COURSE_SELECTION ||
          qKey === QUESTION_KEYS.WHICH_COURSE ||
          qType === 'course';
        
        if (isCourseQuestion) {
          course = qaPair.answer;
          questionType = qType;
          questionKey = qKey;
          
          if (qaPair.answer && /^\d+$/.test(qaPair.answer)) {
            courseId = qaPair.answer;
          }
        }
      });
    });
    
    return {
      answer: course,
      courseId: courseId,
      questionType: questionType,
      questionKey: questionKey
    };
  }, [booking]);

  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (courseInfo?.courseId) {
        setLoadingCourseDetails(true);
        
        try {
          const response = await fetch(`/api/courses/${courseInfo.courseId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
              setCourseDetails(data.data);
            } else if (data.success && data.course) {
              setCourseDetails(data.course);
            } else if (data.title) {
              setCourseDetails(data);
            } else {
              console.error('❌ Invalid course API response structure:', data);
              setCourseDetails(null);
            }
          } else {
            console.error('❌ Course HTTP Error:', response.status, response.statusText);
            
            try {
              const errorData = await response.json();
              console.error('❌ Error response:', errorData);
            } catch (parseError) {
              console.error('❌ Could not parse error response');
            }
            
            setCourseDetails(null);
          }
        } catch (error) {
          console.error('❌ Course Network/fetch error:', error);
          setCourseDetails(null);
        } finally {
          setLoadingCourseDetails(false);
        }
      } else {
        // Reset course details if no courseId
        if (courseDetails !== null) {
          setCourseDetails(null);
        }
      }
    };

    fetchCourseDetails();
  }, [courseInfo?.courseId]);

  const getCourseTypeDisplay = () => {
    // Check if we have a course ID and successfully fetched course details
    if (courseInfo?.courseId && courseDetails) {
      return {
        title: courseDetails.title,
        description: courseDetails.description,
        startDate: courseDetails.start_date,
        endDate: courseDetails.end_date,
        minStartDate: courseDetails.min_start_date,
        minEndDate: courseDetails.min_end_date,
        durationHours: courseDetails.duration_hours,
        ndisStaPrice: courseDetails.ndis_sta_price,
        ndisHspPrice: courseDetails.ndis_hsp_price,
        status: courseDetails.status,
        imageUrl: courseDetails.imageUrl
      };
    } 
    
    // REMOVED: Don't show raw answer if it's just an ID
    // The accordion section will handle showing the error message
    
    // Only return answer if it's not a numeric ID (i.e., it's an actual course name)
    if (courseInfo?.answer && !/^\d+$/.test(courseInfo.answer)) {
      return {
        title: courseInfo.answer,
        description: null,
        startDate: null,
        endDate: null,
        status: null
      };
    }
    
    // Return null if no valid course data is available
    // This will trigger the error message in the accordion section
    return null;
  };

  // Get funder information
  const funderInfo = useMemo(() => {
    if (!booking?.Sections) {
      return null;
    }
    
    let funder = null;
    let funderQuestion = null;
    let funderOptions = null;
    
    booking.Sections.forEach((section) => {
      section.QaPairs?.forEach((qaPair) => {
        const question = qaPair.Question;
        const qKey = question?.question_key || '';
        
        // Use QUESTION_KEYS constant
        const isFundingQuestion = qKey === QUESTION_KEYS.FUNDING_SOURCE;
        
        if (isFundingQuestion) {
          funder = qaPair.answer;
          funderQuestion = question;
          
          if (question?.options) {
            try {
              funderOptions = typeof question.options === 'string' 
                ? JSON.parse(question.options) 
                : question.options;
            } catch (e) {
              console.warn('Failed to parse funder options:', e);
            }
          }
        }
      });
    });
    
    return {
      answer: funder,
      question: funderQuestion,
      options: funderOptions
    };
  }, [booking]);

  useEffect(() => {
    if (funderInfo?.options && funderInfo?.answer) {
      // Find the selected funder option
      const selectedOption = funderInfo.options.find(option => 
        option.value === funderInfo.answer || option.label === funderInfo.answer
      );
      setSelectedFunderOption(selectedOption);
      setFunderOptions(funderInfo.options);
    } else {
      setSelectedFunderOption(null);
      setFunderOptions(null);
    }
  }, [funderInfo]);

  const getFunderTypeDisplay = () => {
    if (selectedFunderOption) {
      return {
        label: selectedFunderOption.label,
        value: selectedFunderOption.value,
        description: selectedFunderOption.description,
        imageUrl: selectedFunderOption.imageUrl,
        imageFilename: selectedFunderOption.imageFilename
      };
    } else if (funderInfo?.answer) {
      return {
        label: funderInfo.answer,
        value: funderInfo.answer,
        description: null,
        imageUrl: null
      };
    }
    
    console.log('❌ No funder information available');
    return null;
  };

  // Get package information with API fetch for package-selection type
  const packageInfo = useMemo(() => {
    if (!booking?.Sections) {
      console.log('❌ No booking.Sections found');
      return null;
    }
    
    // Extract package from Q&A pairs with improved detection
    let packageAnswer = null;
    let packageQuestionType = null;
    let packageId = null;
    let foundSection = null;
    let foundQaPair = null;
    
    // Check all sections for package-related questions
    booking.Sections.forEach(section => {
      section.QaPairs?.forEach(qaPair => {
        const question = qaPair.Question?.question || '';
        const questionType = qaPair.Question?.question_type || '';
        const questionKey = qaPair.question_key || '';
        
        // Check by question_key (original logic)
        if (questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
            questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) {
          if (qaPair.answer) {
            packageAnswer = qaPair.answer;
            packageQuestionType = questionType;
            foundSection = section;
            foundQaPair = qaPair;
            
            // FIXED: Always treat answer as packageId for package questions
            packageId = qaPair.answer;
          }
        }
        
        // Also check by question type (backup detection)
        if (!packageAnswer && questionType === 'package-selection' && qaPair.answer) {
          packageAnswer = qaPair.answer;
          packageQuestionType = questionType;
          packageId = qaPair.answer;
          foundSection = section;
          foundQaPair = qaPair;
        }
        
        if (!packageAnswer && 
            question.toLowerCase().includes('accommodation') && 
            question.toLowerCase().includes('package') && 
            qaPair.answer) {
          packageAnswer = qaPair.answer;
          packageQuestionType = questionType || 'package-selection'; // Default to package-selection
          foundSection = section;
          foundQaPair = qaPair;
          
          // Check if answer looks like a package ID (numeric)
          if (/^\d+$/.test(qaPair.answer)) {
            packageId = qaPair.answer;
          }
        }
      });
    });

    // Return the extracted package information
    return {
      answer: packageAnswer,
      questionType: packageQuestionType,
      packageId: packageId,
      packageDetails: packageDetails,
      foundSection: foundSection?.label || foundSection?.id,
      foundQaPair: foundQaPair?.id
    };
  }, [booking, packageDetails]);

  const packageQaPairInfo = useMemo(() => {
    if (!booking?.Sections) {
      console.log('❌ No booking.Sections found');
      return null;
    }
    
    let qaPairData = null;
    
    booking.Sections.forEach((section, sIdx) => {
      section.QaPairs?.forEach((qaPair, qIdx) => {
        const question = qaPair.Question;
        
        // Get question_key from Question object
        const questionKey = question?.question_key || '';
        
        // Get question type - check both qaPair level and Question level
        const questionType = qaPair.question_type || question?.type || '';
        
        // Check for package-related questions using QUESTION_KEYS constants
        const isPackageQuestion = 
          questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
          questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL ||
          questionType === 'package-selection';
        
        if (isPackageQuestion) {
          
          qaPairData = {
            qaPair: qaPair,
            section: section,
            question: question,
            questionType: questionType,
            questionKey: questionKey,
            currentAnswer: qaPair.answer,
            qaPairId: qaPair.id
          };
        }
      });
    });

    return qaPairData;
  }, [booking]);

  // Fetch package details when packageId is available
  useEffect(() => {
    const fetchPackageDetails = async () => {
      if (packageInfo?.packageId) {
        setLoadingPackageDetails(true);
        
        try {
          const response = await fetch(`/api/packages/${packageInfo.packageId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.package) {
              setPackageDetails(data.package);
            } else {
              console.error('❌ Invalid API response structure:', data);
              setPackageDetails(null);
            }
          } else {
            console.error('❌ HTTP Error:', response.status, response.statusText);
            
            try {
              const errorData = await response.json();
              console.error('❌ Error response:', errorData);
            } catch (parseError) {
              console.error('❌ Could not parse error response');
            }
            
            setPackageDetails(null);
          }
        } catch (error) {
          console.error('❌ Network/fetch error:', error);
          setPackageDetails(null);
        } finally {
          setLoadingPackageDetails(false);
        }
      } else {
        // Reset package details if no packageId
        if (packageDetails !== null) {
          console.log('🔄 Resetting package details - no packageId');
          setPackageDetails(null);
        }
      }
    };

    fetchPackageDetails();
  }, [packageInfo?.packageId]);

  // Get serialized package type for display
  const getPackageTypeDisplay = () => {
    // Check if we have a package ID and successfully fetched package details
    if (packageInfo?.packageId && packageDetails) {
      return {
        name: packageDetails.name,
        code: packageDetails.package_code,
        funder: packageDetails.funder,
        price: packageDetails.price,
        ndisPackageType: packageDetails.ndis_package_type,
        ndisLineItems: packageDetails.ndis_line_items
      };
    } 
    
    // Only process answer if it's not a numeric ID (i.e., it's an actual package name)
    if (packageInfo?.answer && !/^\d+$/.test(packageInfo.answer)) {
      let packageType = null;
      if (!courseInfo) {
        packageType = serializePackage(packageInfo.answer);
      } else if (courseInfo) {
        packageType = 'Course' + serializePackage(packageInfo.answer);
      } else {
        packageType = 'N/A';
      }
      
      return {
        name: packageInfo.answer,
        code: packageType,
        funder: null,
        price: null
      };
    }
    
    // Return null if no valid package data is available
    // This will trigger the error message in the accordion section
    return null;
  };

  // Get total guests helper function
  const getTotalGuests = (room) => {
    let totalGuests = 0;
    totalGuests += room.adults ?? 0;
    totalGuests += room.children ?? 0;
    totalGuests += room.infants ?? 0;
    totalGuests += room.pets ?? 0;
    return totalGuests;
  };

  // Add the toggle function
  const toggleAccordionItem = (index) => {
    setOpenAccordionItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Status update handlers from original component
  const handleUpdateStatus = useCallback(async (selected) => {
    // Check if this is a cancellation status
    if (isCancellationStatus(selected.name)) {
      // Store the pending status and show the modal
      setPendingCancellationStatus(selected);
      setShowCancellationModal(true);
      return;
    }
    
    // For non-cancellation statuses, proceed as normal
    await performStatusUpdate(selected, false);
  }, [booking?.uuid, status, dispatch]);

  const performStatusUpdate = useCallback(async (selected, isFullCharge = false) => {
    // Save the previous status to revert on error
    const previousStatus = status;
    
    dispatch(globalActions.setLoading(true));
    setStatus(selected);  // Optimistic update
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: selected,
          isFullChargeCancellation: isFullCharge
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update booking status';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        // REVERT status on error
        setStatus(previousStatus);
        toast.error(errorMessage);
        dispatch(globalActions.setLoading(false));
        return;
      }

      await fetchBooking();

      if (status.name == 'eligible') {
        toast.success("An invitation email has been sent to the guest.");
      }
      
      if (selected.name === 'booking_confirmed') {
        toast.success("Booking has been confirmed successfully!");
      }
      
      // Show appropriate message for cancellations
      if (isCancellationStatus(selected.name)) {
        const chargeType = isFullCharge ? 'Full Charge' : 'No Charge';
        toast.success(`Booking has been cancelled (${chargeType}).`);
      }

      dispatch(globalActions.setLoading(false));

    } catch (error) {
      console.error('Network error updating status:', error);
      // REVERT status on network error
      setStatus(previousStatus);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }, [booking?.uuid, status, dispatch, fetchBooking]);

  const handleUpdateEligibility = useCallback(async (selected) => {
    // Save the previous eligibility to revert on error
    const previousEligibility = eligibility;
    
    dispatch(globalActions.setLoading(true));
    setEligibility(selected);  // Optimistic update
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eligibility: selected
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update booking eligibility';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        // REVERT eligibility on error
        setEligibility(previousEligibility);
        toast.error(errorMessage);
        dispatch(globalActions.setLoading(false));
        return;
      }

      await fetchBooking();
      
      if (selected.name === 'eligible') {
        toast.success("Guest eligibility approved successfully!");
      } else if (selected.name === 'ineligible') {
        toast.success("Guest eligibility status updated.");
      }

      dispatch(globalActions.setLoading(false));

    } catch (error) {
      console.error('Network error updating eligibility:', error);
      // REVERT eligibility on network error
      setEligibility(previousEligibility);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }, [booking?.uuid, eligibility, dispatch, fetchBooking]);

  const handleCancellationConfirm = useCallback((isFullCharge) => {
    setShowCancellationModal(false);
    if (pendingCancellationStatus) {
      performStatusUpdate(pendingCancellationStatus, isFullCharge);
      setPendingCancellationStatus(null);
    }
  }, [pendingCancellationStatus, performStatusUpdate]);

  const handleCancellationModalClose = useCallback(() => {
    setShowCancellationModal(false);
    setPendingCancellationStatus(null);
  }, []);

  // Summary PDF handlers
  const handleDownloadPDF = async (booking) => {
    toast.info('Generating PDF. Please wait...');
    try {
      const isOldTemplate = booking.templateId <= 33;
      const apiEndpoint = isOldTemplate
            ? `/api/bookings/${booking.uuid}/download-summary-pdf-v1`
            : `/api/bookings/${booking.uuid}/download-summary-pdf-v2`;
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ origin: currentUser.type }),
      });

      if (!response.ok) throw new Error('Failed to generate PDF');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `summary-of-stay-${booking.uuid}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download summary of stay. Please try again.');
    }
  };

  const handleEmailPDF = async (booking) => {
    toast.info('Your email is being sent in the background. Feel free to navigate away or continue with other tasks.');
    try {
      const isOldTemplate = booking.templateId <= 33;
      const apiEndpoint = isOldTemplate
            ? `/api/bookings/${booking.uuid}/download-summary-pdf-v1`
            : `/api/bookings/${booking.uuid}/download-summary-pdf-v2`;
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          adminEmail: currentUser.type === 'user' ? currentUser.email : null, 
          origin: currentUser.type 
        }),
      });

      if (!response.ok) throw new Error('Failed to send email');
      toast.success('Summary sent to your email successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    }
  };

  // Fetch booking data
  const fetchBooking = useCallback(async () => {
    if (!uuid) return;
    
    setLoadingStates(prev => ({ ...prev, booking: true }));
    dispatch(globalActions.setLoading(true));
    
    try {
      const res = await fetch(`/api/bookings/${uuid}`);
      const data = await res.json();
      
      if (res.ok) {
        setBooking(data);
        setStatus(JSON.parse(data.status));
        setEligibility(JSON.parse(data.eligibility));

        const userAmendments = (data.Logs || [])
          .filter(log => log.type === 'qa_pair')
          .sort((a, b) => {
            // Primary sort: by createdAt date (most recent first)
            const dateA = new Date(a.createdAt);
            const dateB = new Date(b.createdAt);
            
            // Handle invalid dates gracefully
            if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
              console.warn('Invalid date found in amendments:', { a: a.createdAt, b: b.createdAt });
              return 0;
            }
            
            const dateDiff = dateB.getTime() - dateA.getTime();
            
            // If dates are exactly the same, use ID as secondary sort (higher ID = more recent)
            if (dateDiff === 0) {
              return (b.id || 0) - (a.id || 0);
            }
            
            return dateDiff;
          });
        
        setAmendments(userAmendments);
      } else {
        toast.error('Failed to load booking');
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking');
    } finally {
      setLoadingStates(prev => ({ ...prev, booking: false }));
      dispatch(globalActions.setLoading(false));
    }
  }, [uuid, dispatch]);

  // Fetch health info
  const fetchHealthInfo = useCallback(async () => {
    if (!booking?.Guest?.uuid) return;
    
    setLoadingStates(prev => ({ ...prev, healthInfo: true }));
    try {
      const response = await fetch('/api/bookings/history/health-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: booking.Guest.uuid })
      });
      if (response.ok) {
        const data = await response.json();
        setHealthInfo(data);
      }
    } catch (err) {
      console.error('Error fetching health info:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, healthInfo: false }));
    }
  }, [booking?.Guest?.uuid]);

  // Amendment approval/decline handlers
  const handleApproveDeclineAmendment = (amendment, approval) => async () => {
    dispatch(globalActions.setLoading(true));
    const currentUsername = currentUser.first_name + ' ' + currentUser.last_name;

    let approvedDeclineAmendments = { 
      approved: approval, 
      approved_by: currentUsername, 
      approval_date: new Date() 
    };
    
    if (!approval) {
      approvedDeclineAmendments = { 
        approved: approval, 
        approved_by: null, 
        approval_date: null, 
        declined_by: currentUsername, 
        decline_date: new Date() 
      };
    }

    try {
      const response = await fetch('/api/bookings/amendment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: amendment.id,
          ...approvedDeclineAmendments
        })
      });

      if (response.ok) {
        // Update the amendments state
        const updatedAmendments = amendments.map(item => {
          if (item.id === amendment.id) {
            return { 
              ...item, 
              data: { 
                ...item.data, 
                ...approvedDeclineAmendments 
              } 
            }
          }
          return item;
        });

        setAmendments(updatedAmendments);
        toast.success(`Amendment ${approval ? 'approved' : 'declined'} successfully`);
      } else {
        toast.error('Failed to update amendment');
      }
    } catch (error) {
      toast.error('Failed to update amendment');
      console.error('Error updating amendment:', error);
    } finally {
      dispatch(globalActions.setLoading(false));
    }
  };

  // Effects
  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    if (booking) {
      fetchHealthInfo();
      // Open first accordion item by default
      setOpenAccordionItems({ 0: true, 1: true });
    }
  }, [booking, fetchHealthInfo]);

  // Fetch statuses and eligibilities
  useEffect(() => {
    fetchBookingStatuses().then(data => {
      const arr = data.map(s => {
        const status = JSON.parse(s.value);
        return { ...status, value: status.name };
      });
      setStatuses(arr);
    });

    fetchBookingEligibilities().then(data => {
      const arr = data.map(s => {
        const status = JSON.parse(s.value);
        return { ...status, value: status.name };
      });
      setEligibilities(arr);
    });
  }, []);

  // Determine if summary options should be shown
  const showSummaryOptions = useMemo(() => {
    if (!booking || !status) return false;
    
    const funder = getFunder(booking.Sections)?.toLowerCase();
    return status.name === 'booking_confirmed' && funder && funder !== 'icare';
  }, [booking, status]);

  // Room setup calculation
  const roomSetupData = useMemo(() => {
    if (!booking?.Sections) return { adults: 0, children: 0, infants: 0, pets: 0 };
    
    // Extract room setup data from booking sections/Q&A pairs
    return {
      adults: 3, // Default values - replace with actual extraction logic
      children: 2,
      infants: 0,
      pets: 0
    };
  }, [booking]);

  // Create accordion items
  const accordionItems = useMemo(() => {
    if (!booking) return [];

    const items = [
      {
        title: 'Booking Status',
        description: 'Current booking status and eligibility information',
        customContent: (
          <div className="p-6">
            <Can I="Create/Edit" a="Booking">
              {isUser && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className='w-full lg:w-72'>
                      <SelectComponent 
                        label={'Status'} 
                        placeholder={'Update status'} 
                        value={status && status.label} 
                        options={statuses} 
                        onChange={handleUpdateStatus} 
                      />
                    </div>
                    <div className='w-full lg:w-72'>
                      <SelectComponent 
                        label={'Eligibility'} 
                        placeholder={'Update eligibility'} 
                        value={eligibility && eligibility.label} 
                        options={eligibilities} 
                        onChange={handleUpdateEligibility} 
                      />
                    </div>
                  </div>

                  {/* Cancellation Type Badge - Show if booking is cancelled */}
                  {isBookingCancelled(status) && getCancellationType(booking) && (
                    <div className="mt-6 p-4 rounded-lg border" style={{
                      backgroundColor: getCancellationType(booking) === 'Full Charge' ? '#FEF2F2' : '#F0FDF4',
                      borderColor: getCancellationType(booking) === 'Full Charge' ? '#FCA5A5' : '#86EFAC'
                    }}>
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-0.5">
                          <svg 
                            className={`w-5 h-5 ${getCancellationType(booking) === 'Full Charge' ? 'text-red-600' : 'text-green-600'}`}
                            fill="currentColor" 
                            viewBox="0 0 20 20"
                          >
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h4 className={`font-semibold mb-1 ${getCancellationType(booking) === 'Full Charge' ? 'text-red-900' : 'text-green-900'}`}>
                            {getCancellationType(booking)} Cancellation
                          </h4>
                          <p className={`text-sm ${getCancellationType(booking) === 'Full Charge' ? 'text-red-700' : 'text-green-700'}`}>
                            {getCancellationType(booking) === 'Full Charge'
                              ? 'Nights were NOT returned - guest lost nights as penalty'
                              : 'Nights were returned to guest\'s iCare approval (no penalty)'}
                          </p>
                          
                          {/* Show approval usage details if available */}
                          {booking.approvalUsages && booking.approvalUsages.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className={`text-xs font-medium mb-2 ${getCancellationType(booking) === 'Full Charge' ? 'text-red-800' : 'text-green-800'}`}>
                                Affected Approvals:
                              </p>
                              <div className="space-y-1">
                                {booking.approvalUsages
                                  .filter(usage => usage.status === 'charged' || usage.status === 'cancelled')
                                  .map((usage, idx) => (
                                    <div key={idx} className={`text-xs ${getCancellationType(booking) === 'Full Charge' ? 'text-red-600' : 'text-green-600'}`}>
                                      • {usage.approval?.approval_name || usage.approval?.approval_number || `Approval ${idx + 1}`}: {usage.nights_consumed} night{usage.nights_consumed !== 1 ? 's' : ''}
                                    </div>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </Can>
            
            {/* Show message for users without edit permissions */}
            <Can not I="Create/Edit" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <AlertCircle className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to update booking status</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Accommodation Type',
        description: 'Room type and booking dates',
        status: 'complete',
        customContent: (
          <div className="p-6">
            {booking.Rooms && booking.Rooms.length > 0 ? (
              booking.Rooms.map((room, index) => {
                // Calculate total guests for this room
                const totalGuests = (room.adults || 0) + (room.children || 0) + (room.infants || 0) + (room.pets || 0);
                
                // Get package info - you may need to adjust this based on your package data structure
                const packageTypeDisplay = getPackageTypeDisplay();
                const packageInfo = packageTypeDisplay?.code || packageTypeDisplay?.name || 'WHS';
                
                // Check if this is an additional room (index > 0)
                const isAdditionalRoom = index > 0;
                
                return (
                  <div key={index} className="mb-6 last:mb-0">
                    {/* Responsive flex container that stacks on mobile */}
                    <div className="flex flex-col lg:flex-row items-start gap-6">
                      {/* Large Room Image - responsive width */}
                      <div className="w-full lg:w-80 h-48 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {room.imageUrl ? (
                          <img 
                            src={room.imageUrl}
                            alt={room.RoomType?.name || 'Room'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = '/api/placeholder/320/192';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Home className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Room Details */}
                      <div className="flex-1 w-full">
                        {/* Room Title */}
                        <h4 className="text-xl font-semibold text-gray-900 mb-4 lg:mb-8">
                          {room.RoomType?.name || room.label || 'Standard Studio Room'}
                        </h4>
                        
                        {/* Info Grid - responsive: 2 cols on mobile, 3 on tablet, 4 on desktop (or 3 for additional rooms without guest) */}
                        <div className={`grid grid-cols-2 ${isAdditionalRoom ? 'sm:grid-cols-3' : 'md:grid-cols-3 lg:grid-cols-4'} gap-3 lg:gap-6`}>
                          {/* Check-in Card */}
                          <div className="text-center p-3 lg:p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-2 lg:mb-3">
                              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8.5 5L15.5 12L8.5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-xs lg:text-sm font-semibold text-gray-900 mb-1 lg:mb-2">CHECK-IN</div>
                            <div className="text-sm lg:text-lg font-bold text-gray-900 mb-1 break-words">
                              {room.checkin ? 
                                moment(room.checkin).format('DD/MM/YYYY') : 
                                (booking.preferred_arrival_date ? 
                                  moment(booking.preferred_arrival_date).format('DD/MM/YYYY') : 
                                  'Not set'
                                )
                              }
                            </div>
                            <div className="text-xs lg:text-sm text-gray-600">Preferred</div>
                          </div>
                          
                          {/* Check-out Card */}
                          <div className="text-center p-3 lg:p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-2 lg:mb-3">
                              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M15.5 19L8.5 12L15.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-xs lg:text-sm font-semibold text-gray-900 mb-1 lg:mb-2">CHECK-OUT</div>
                            <div className="text-sm lg:text-lg font-bold text-gray-900 mb-1 break-words">
                              {room.checkout ? 
                                moment(room.checkout).format('DD/MM/YYYY') : 
                                (booking.preferred_departure_date ? 
                                  moment(booking.preferred_departure_date).format('DD/MM/YYYY') : 
                                  'Not set'
                                )
                              }
                            </div>
                            <div className="text-xs lg:text-sm text-gray-600">Preferred</div>
                          </div>
                          
                          {/* Package Card */}
                          <div className="text-center p-3 lg:p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-2 lg:mb-3">
                              <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M21 8.5V16.5C21 17.33 20.33 18 19.5 18H4.5C3.67 18 3 17.33 3 16.5V8.5L12 3L21 8.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                <path d="M3 8.5L12 13.5L21 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-xs lg:text-sm font-semibold text-gray-900 mb-1 lg:mb-2">PACKAGE</div>
                            <div 
                              className={`font-bold text-gray-900 break-words ${
                                packageInfo && packageInfo.length > 12 
                                  ? 'text-xs lg:text-sm' 
                                  : 'text-sm lg:text-lg'
                              }`}
                              title={packageInfo}
                            >
                              {packageInfo}
                            </div>
                          </div>
                          
                          {/* Guests Card - HIDDEN for additional rooms */}
                          {!isAdditionalRoom && (
                            <div className="text-center p-3 lg:p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                              <div className="mb-2 lg:mb-3">
                                <svg className="w-5 h-5 lg:w-6 lg:h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M16 21V19C16 17.9 15.1 17 14 17H6C4.9 17 4 17.9 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                  <circle cx="10" cy="9" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                                  <path d="M19 8V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                  <path d="M22 11H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                </svg>
                              </div>
                              <div className="text-xs lg:text-sm font-semibold text-gray-900 mb-1 lg:mb-2">GUEST</div>
                              <div className="text-sm lg:text-lg font-bold text-gray-900">
                                {totalGuests !== 0 ? totalGuests : (room.total_guests ?? 0)}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Multiple rooms separator */}
                    {index < booking.Rooms.length - 1 && (
                      <div className="mt-6 lg:mt-8 pt-4 lg:pt-6 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          Additional Room {index + 2}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No room information available</p>
              </div>
            )}
          </div>
        )
      },
      {
        title: `Recent Amendments (${amendments.length})`,
        description: `${amendments.length} amendment${amendments.length !== 1 ? 's' : ''} found`,
        customContent: (
          <div className="p-6">
            <Can I="Read" a="Booking">
              {loadingStates.amendments ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : amendments.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <Box>
                    {amendments
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((amendment, index) => (
                        <div key={amendment.id || index}>
                          <AmendmentDisplay 
                            amendment={amendment}
                            onApprove={isUser ? handleApproveDeclineAmendment(amendment, true) : null}
                            onDecline={isUser ? handleApproveDeclineAmendment(amendment, false) : null}
                            currentUser={currentUser}
                            booking={booking} 
                          />
                          {/* Add separator line between amendments (except for last item) */}
                          {index !== amendments.length - 1 && (
                            <hr className="border border-slate-300" />
                          )}
                        </div>
                      ))}
                  </Box>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No amendments found</p>
                </div>
              )}
            </Can>
            <Can not I="Read" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <FileText className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to view amendments</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Assets & Equipment',
        description: `${booking.Equipment?.length || 0} equipment items assigned`,
        customContent: (
          <div className="p-6">
            <Can I="Read" a="Booking">
              {isUser ? (
                <AssetsAndEquipment 
                  equipmentsData={booking.Equipment ? 
                    [...booking.Equipment].sort((a, b) => 
                      (a.name || '').localeCompare(b.name || '', undefined, { 
                        numeric: true, 
                        sensitivity: 'base' 
                      })
                    ) : []
                  } 
                  bookingId={booking.id} 
                />
              ) : (
                <div className="space-y-4">
                  {booking.Equipment && booking.Equipment.length > 0 ? (
                    <ul className="space-y-2">
                      {[...booking.Equipment]
                        .sort((a, b) => 
                          (a.name || '').localeCompare(b.name || '', undefined, { 
                            numeric: true, 
                            sensitivity: 'base' 
                          })
                        )
                        .map((equipment, index) => {
                          const equipmentDisplay = `${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`;
                          return (
                            <li key={index} className="flex gap-1 items-start">
                              <div className="relative min-w-5 min-h-5 w-5 h-5 mt-0.5">
                                <Image
                                  alt={"check in sargood"}
                                  src={"/icons/check-green.png"}
                                  width={20}
                                  height={20}
                                  className="w-full h-full object-contain"
                                />
                              </div>
                              <span className="font-bold">{equipmentDisplay}</span>
                            </li>
                          );
                        })}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No equipment assigned</p>
                    </div>
                  )}
                </div>
              )}
            </Can>
            <Can not I="Read" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <Settings className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to view equipment details</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Room Setup',
        description: booking.Rooms?.length > 0 ? `${getTotalGuests(booking.Rooms[0])} total guests` : 'No room information',
        customContent: (
          <div className="p-6">
            {booking.hasOwnProperty('Rooms') && booking.Rooms.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Adults</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].adults ?? 0}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Children</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].children ?? 0}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Infants</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].infants ?? 0}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Pets</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].pets ?? 0}</p>
                    </div>
                  </div>
                </div>
                
                {booking.Rooms[0].guests?.length && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-bold mb-4">Guest List</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {JSON.parse(booking.Rooms[0].guests).map((guest, index) => (
                        <div key={index} className="flex space-x-3 items-center">
                          <Image
                            alt={"check in sargood"}
                            src={"/icons/check-green.png"}
                            width={20}
                            height={20}
                          />
                          <p>{guest.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">The guest has not selected a room yet. Room setup will be available once the guest has selected a room.</p>
              </div>
            )}
          </div>
        )
      },
      {
        title: 'Packages',
        description: (() => {
          const packageDisplay = getPackageTypeDisplay();
          if (loadingPackageDetails) return 'Loading package details...';
          
          if (packageDisplay && (packageDisplay.name || packageDisplay.code)) {
            return `Package: ${packageDisplay.code || packageDisplay.name}`;
          }
          
          if (packageInfo?.answer && /^\d+$/.test(packageInfo.answer)) {
            return 'Package not found - see details';
          }
          
          return 'No package selected';
        })(),
        customContent: (
          <div className="p-6">
            {loadingPackageDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading package details...</span>
              </div>
            ) : (
              <>
                {/* Current Package Display */}
                {(() => {
                  const packageDisplay = getPackageTypeDisplay();
                  
                  if (packageDisplay && packageDisplay.name && packageDetails) {
                    return (
                      <div className="space-y-4 mb-4">
                        <div className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-4">
                              <div className="flex-shrink-0">
                                <Image
                                  alt={"check in sargood"}
                                  src={"/icons/check-green.png"}
                                  width={20}
                                  height={20}
                                />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {packageDisplay.name}
                                </p>
                                {packageDisplay.code && (
                                  <p className="text-sm text-gray-600">
                                    Code: {packageDisplay.code}
                                  </p>
                                )}
                              </div>
                            </div>
                            
                            {/* Edit Button - FIXED VERSION */}
                            <Can I="Create/Edit" a="Booking">
                              {isUser && !editingPackage && (
                                <Button
                                  color="outline"
                                  size="small"
                                  label="EDIT"
                                  onClick={() => {
                                    // Access packageQaPairInfo directly at click time
                                    console.log('🖱️ EDIT button clicked');
                                    console.log('📦 packageQaPairInfo at click:', packageQaPairInfo);
                                    
                                    if (!packageQaPairInfo) {
                                      console.error('❌ packageQaPairInfo is null!');
                                      toast.error('Package data not ready. Please refresh the page.');
                                      return;
                                    }
                                    
                                    console.log('✅ Starting edit mode with qaPairId:', packageQaPairInfo.qaPairId);
                                    setEditingPackage(true);
                                    setSelectedPackageValue(packageQaPairInfo.currentAnswer || null);
                                  }}
                                />
                              )}
                            </Can>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  if (packageInfo?.answer && /^\d+$/.test(packageInfo.answer)) {
                    return (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                        <div className="flex items-start space-x-3">
                          <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <h4 className="text-sm font-semibold text-amber-900 mb-1">Package Not Found</h4>
                            <p className="text-sm text-amber-700 mb-2">
                              The selected package (ID: {packageInfo.answer}) could not be loaded.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  return (
                    <div className="text-center py-4 mb-4">
                      <Package className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No package selected</p>
                    </div>
                  );
                })()}
                
                {/* Edit Form - Show BELOW current package when editing */}
                {editingPackage && (
                  <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                    <h4 className="font-medium text-blue-900 mb-3">Update Package</h4>
                    
                    {loadingPackageOptions ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-blue-700">Loading options...</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="w-full">
                          <SelectComponent
                            label="Select Package"
                            placeholder="Choose a package..."
                            value={packageOptions.find(opt => opt.value === selectedPackageValue)?.label || ''}
                            options={packageOptions}
                            onChange={(selected) => {
                              setSelectedPackageValue(selected.value);
                            }}
                            width="100%"
                          />
                        </div>
                        
                        <div className="flex space-x-2">
                          <Button
                            color="primary"
                            size="small"
                            label={isSavingPackage ? "Saving..." : "Save"}
                            onClick={() => {
                              // Find fresh packageQaPairInfo right before saving
                              const freshPackageQaPairInfo = findPackageQaPairInfo();
                              
                              if (!freshPackageQaPairInfo) {
                                console.error('❌ Could not find package information in booking data');
                                toast.error('Unable to save. Package information not found. Please refresh the page.');
                                return;
                              }
                              
                              const selectedOption = packageOptions.find(opt => opt.value === selectedPackageValue);
                              
                              if (!selectedOption) {
                                console.error('❌ No valid option selected');
                                toast.error('Please select a valid package option');
                                return;
                              }
                              
                              // Check if actually different
                              if (String(selectedPackageValue) === String(freshPackageQaPairInfo.currentAnswer)) {
                                toast.info('No changes detected - package is already set to this value');
                                return;
                              }
                              
                              toast.info('Updating package...');
                              
                              // Call update function with fresh data
                              handleUpdatePackageWithData(selectedOption, freshPackageQaPairInfo);
                            }}
                            disabled={
                              isSavingPackage || 
                              !selectedPackageValue
                            }
                          />
                          <Button
                            color="outline"
                            size="small"
                            label="Cancel"
                            onClick={() => {
                              console.log('❌ Cancel clicked');
                              setEditingPackage(false);
                              setSelectedPackageValue(null);
                              setPackageOptions([]);
                            }}
                            disabled={isSavingPackage}
                          />
                        </div>
                        
                        {selectedPackageValue && (
                          <div className="text-sm text-blue-700 mt-2">
                            Selected: {packageOptions.find(opt => opt.value === selectedPackageValue)?.label}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )
      },
      {
        title: 'Courses',
        description: (() => {
          const courseDisplay = getCourseTypeDisplay();
          if (loadingCourseDetails) return 'Loading course details...';
          
          // Check if we have valid course data
          if (courseDisplay && courseDisplay.title && courseDisplay.title !== courseInfo?.answer) {
            return `Course: ${courseDisplay.title}`;
          }
          
          // Check if we have a course ID but no details (404 error case)
          if (courseInfo?.answer && /^\d+$/.test(courseInfo.answer)) {
            return 'Course not found - see details';
          }
          
          return 'No course selected';
        })(),
        customContent: (
          <div className="p-6">
            {loadingCourseDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading course details...</span>
              </div>
            ) : (() => {
              const courseDisplay = getCourseTypeDisplay();
              
              // Case 1: Valid course data loaded successfully
              if (courseDisplay && courseDisplay.title && courseDetails) {
                return (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="flex items-center space-x-4">
                      {/* Course Image */}
                      {courseDisplay.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={courseDisplay.imageUrl}
                            alt={courseDisplay.title}
                            className="w-16 h-16 object-cover rounded-lg"
                            onError={(e) => {
                              e.target.style.display = 'none';
                            }}
                          />
                        </div>
                      )}
                      
                      <div className="flex items-center space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <Image
                            alt={"check in sargood"}
                            src={"/icons/check-green.png"}
                            width={20}
                            height={20}
                          />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{courseDisplay.title}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Case 2: Course ID exists but data failed to load (404 error)
              if (courseInfo?.answer && /^\d+$/.test(courseInfo.answer)) {
                return (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="text-sm font-semibold text-amber-900 mb-1">Course Not Found</h4>
                        <p className="text-sm text-amber-700 mb-2">
                          The selected course (ID: {courseInfo.answer}) could not be loaded.
                        </p>
                        <p className="text-xs text-amber-600">
                          This course may have been deleted or is no longer available in the system. Please contact support if you need to update this booking.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              
              // Case 3: No course selected at all
              return (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6zM5 13.18l7 3.82 7-3.82V11L12 15 5 11v2.18z"/>
                    </svg>
                  </div>
                  <p className="text-gray-500 italic">No course selected.</p>
                </div>
              );
            })()}
          </div>
        )
      },
      {
        title: 'Funder Type',
        description: (() => {
          const funderDisplay = getFunderTypeDisplay();
          if (funderDisplay) return `Funder: ${funderDisplay.label}`;
          return 'No funding information';
        })(),
        customContent: (
          <div className="p-4">
            <FunderImageDisplay funderDisplay={getFunderTypeDisplay()} />
          </div>
        )
      }
    ];

    if (booking?.templatePages && booking.templatePages.length > 0) {
      // Sort template pages by order to ensure correct display sequence
      const sortedTemplatePages = [...booking.templatePages].sort((a, b) => a.order - b.order);
      
      sortedTemplatePages.forEach((page) => {
        // Don't show template pages if it's in hidePages
        if (hidePages.includes(page.title?.toLowerCase())) {
          return;
        }

        const sectionQaPairs = booking.Sections?.filter(section => 
          section.pageId === page.id
        ) || [];
        
        // Filter sections to only include those with answered questions
        const sectionsWithAnswers = sectionQaPairs
          .map(section => {
            // Filter QaPairs to only include those with answers
            const answeredQaPairs = section.QaPairs?.filter(qaPair => 
              qaPair.Question && 
              qaPair.answer !== null && 
              qaPair.answer !== undefined && 
              qaPair.answer !== ''
            ) || [];
            
            // Return section only if it has answered questions
            return answeredQaPairs.length > 0 ? {
              ...section,
              QaPairs: answeredQaPairs
            } : null;
          })
          .filter(Boolean); // Remove null sections
        
        // Only add template page if it has sections with answers
        if (sectionsWithAnswers.length > 0) {
          const totalAnsweredQuestions = sectionsWithAnswers.reduce((acc, section) => 
            acc + (section.QaPairs?.length || 0), 0
          );
          
          items.push({
            title: page.title,
            description: `${totalAnsweredQuestions} question${totalAnsweredQuestions !== 1 ? 's' : ''} answered`,
            status: 'complete',
            customContent: (
              <div className="p-6">
                <div className="space-y-6">
                  {sectionsWithAnswers
                    .sort((a, b) => a.order - b.order) // Sort sections by order
                    .map((section, sectionIndex) => (
                      <div key={section.id || sectionIndex} className="space-y-4">
                        {/* Section label if available */}
                        {section.label && (
                          <div className="border-b border-gray-200 pb-2 mb-4">
                            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                              {section.label}
                            </h4>
                          </div>
                        )}
                        
                        {/* Questions and Answers - only answered ones */}
                        <div className="space-y-4">
                          {section.QaPairs.map((qaPair, qaPairIndex) => {
                            const question = qaPair.Question;
                            
                            // Parse options safely - FIXED JSON parsing error
                            let options = null;
                            try {
                              // Handle case where options might already be an object
                              if (typeof question.options === 'object' && question.options !== null) {
                                options = question.options;
                              } else if (typeof question.options === 'string' && question.options.trim() !== '') {
                                options = JSON.parse(question.options);
                              }
                            } catch (e) {
                              console.warn('Failed to parse question options:', e);
                              options = null;
                            }
                            
                            return (
                              <QuestionDisplay
                                key={qaPair.id || `${section.id}-${qaPairIndex}`}
                                question={question.question}
                                answer={qaPair.answer}
                                questionType={question.question_type || question.type}
                                options={options}
                                optionType={question.option_type}
                                courseData={courseDetails}
                                packageData={packageDetails}
                                fileUrls={qaPair.fileUrls || []}
                              />
                            );
                          })}
                        </div>
                        
                        {/* Section separator (except for last section) */}
                        {sectionIndex < sectionsWithAnswers.length - 1 && (
                          <div className="border-b border-gray-100 mt-6"></div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )
          });
        }
      });
    }

    return items;
  }, [
    booking, 
    amendments, 
    healthInfo, 
    loadingStates, 
    editEquipment, 
    currentUser, 
    roomSetupData, 
    isUser, 
    status, 
    eligibility, 
    statuses, 
    eligibilities, 
    handleUpdateStatus, 
    handleUpdateEligibility, 
    packageDetails, 
    loadingPackageDetails, 
    courseInfo, 
    funderInfo, 
    getPackageTypeDisplay,
    packageQaPairInfo,
    editingPackage,
    handleEditPackage,
    packageOptions,
    selectedPackageValue,     
    loadingPackageOptions,    
    isSavingPackage,          
    handleUpdatePackage,      
    courseDetails,            
    loadingCourseDetails,
    handleCancelPackageEdit
  ]);

  // useEffect(() => {
  //   // Set all accordion items to open by default when booking data loads
  //   if (booking && accordionItems.length > 0 && !accordionInitialized.current) {
  //     const allOpenItems = {};
  //     accordionItems.forEach((_, index) => {
  //       allOpenItems[index] = true;
  //     });
  //     setOpenAccordionItems(allOpenItems);
  //     accordionInitialized.current = true;
  //   }
  // }, [booking?.id, accordionItems]); 

  useEffect(() => {
    if (booking?.id) {
      accordionInitialized.current = false;
    }
  }, [booking?.id]);

  // Loading state
  if (loadingStates.booking || loading) {
    return (
      <Layout title="Booking Details">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner />
            <p className="text-gray-500 mt-4">Loading booking details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (!booking) {
    return (
      <Layout title="Booking Not Found">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-500 mb-4">The booking you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
            <Button
              color="primary"
              size="medium"
              label="Go Back"
              onClick={() => router.back()}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Show edit view if in edit mode
  if (editBooking) {
    return (
      <Layout title="Edit Booking">
        <BookingEditView booking={booking} onCancel={() => setEditBooking(false)} />
      </Layout>
    );
  }

  return (
    <Layout title={`Booking - ${booking.Guest?.first_name} ${booking.Guest?.last_name}`} noScroll={false}>
      <div className="flex flex-col bg-gray-50 px-6 py-4" style={{ minHeight: '100vh' }}>
        {/* Full Width Header with Breadcrumbs and Edit Button */}
        <div className='mb-4 flex-shrink-0'>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-blue-600">
                <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.46046 17.435C1.73569 17.4345 1.14844 16.8468 1.14844 16.122V8.62633C1.14844 7.90397 1.446 7.21352 1.97109 6.71745L7.27469 1.70703C8.28826 0.749484 9.87346 0.751043 10.8852 1.71057L16.1965 6.74814C16.7193 7.244 17.0154 7.93291 17.0154 8.65347V16.125C17.0154 16.8502 16.4276 17.438 15.7024 17.438H12.0917V13.1707C12.0917 12.4456 11.5038 11.8577 10.7787 11.8577H7.75874C7.03359 11.8577 6.44573 12.4456 6.44573 13.1707V17.438L2.46046 17.435Z" fill="#00467F" stroke="#00467F" strokeWidth="1.313" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg text-gray-900">
                  <span className="font-semibold">BOOKINGS / </span>{booking.Guest?.first_name?.toUpperCase()} {booking.Guest?.last_name?.toUpperCase()}
                </h1>
              </div>
            </div>
            
            {/* Action Buttons */}
            <Can I="Create/Edit" a="Booking">
              {isUser && (
                <div className="flex items-center space-x-3">
                  {/* Summary Options - only show for confirmed bookings with specific funders */}
                  {showSummaryOptions && (
                    <>
                      {/* Download Summary Button */}
                      <button
                        onClick={() => handleDownloadPDF(booking)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Download Summary of Stay"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                      </button>
                      
                      {/* Email Summary Button */}
                      <button
                        onClick={() => handleEmailPDF(booking)}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Send Summary of Stay via Email"
                      >
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </button>
                    </>
                  )}
                  
                  {/* Edit Booking Button - Hide for cancelled bookings */}
                  {!isBookingCancelled(status) && (
                    <Button
                      color="primary"
                      size="medium"
                      label="EDIT BOOKING"
                      onClick={() => handleEditBooking(booking.uuid)}
                    />
                  )}
                </div>
              )}
            </Can>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex border border-gray-100 shadow" style={{ minHeight: '800px' }}>
          {/* Left Content - Accordion */}
          <div className="flex-1 bg-white">
            {/* Accordion Content - Remove all height constraints that prevent scrolling */}
            <div className="bg-white" style={{ border: '1px solid #E6E6E6' }}>
              <div className="bg-white">
                {accordionItems.map((item, index) => (
                  <CustomAccordionItem
                    key={index}
                    title={item.title}
                    description={item.description}
                    status={item.status}
                    bookingStatus={status}
                    isOpen={openAccordionItems[index] || false}
                    onToggle={() => toggleAccordionItem(index)}
                  >
                    {item.customContent}
                  </CustomAccordionItem>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          {isUser ? (
            <div className="w-96 flex-shrink-0">
              <DetailSidebar 
                booking={booking} 
                guest={booking.Guest}
                address={booking.Guest?.Addresses?.[0]}
                callback={fetchBooking}
                setEditBooking={setEditBooking}
              />
            </div>
          ) : isGuest ? (
            <div className="w-96 bg-white border-l border-gray-200 flex-shrink-0">
              <div className="p-6">
                <div className="text-center">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Guest View</h3>
                  <p className="text-sm text-gray-500">You have limited access to booking details.</p>
                </div>
                
                {booking.Guest && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Your Booking</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Check-in:</span>
                        <span className="text-blue-800">
                          {booking.preferred_arrival_date ? 
                            moment(booking.preferred_arrival_date).format('DD MMM YYYY') : 
                            'Not set'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Check-out:</span>
                        <span className="text-blue-800">
                          {booking.preferred_departure_date ? 
                            moment(booking.preferred_departure_date).format('DD MMM YYYY') : 
                            'Not set'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Room:</span>
                        <span className="text-blue-800">{booking.Room?.RoomType?.name || 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
      <CancellationModal
        isOpen={showCancellationModal}
        onClose={handleCancellationModalClose}
        onConfirm={handleCancellationConfirm}
        bookingId={booking?.reference_id}
      />
    </Layout>
  );
}