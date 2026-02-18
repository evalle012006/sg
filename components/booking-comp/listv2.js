import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from "react";
import { DropdownStatus } from "./dropdown-status";
import { useRouter } from "next/router";
import { statusContext, fetchBookingStatuses } from "./../../services/booking/statuses";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { bookingsActions } from "../../store/bookingsSlice";
import { toast } from "react-toastify";
import { getCancellationType, getFirstLetters, getFunder, isBookingCancelled } from "../../utilities/common";
import { QUESTION_KEYS } from "./../../services/booking/question-helper";
import _ from "lodash";

import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import { eligibilityContext, fetchBookingEligibilities } from "../../services/booking/eligibilities";
import { DropdownEligibility } from "./dropdown-eligibility";
import ActionDropDown from "./action-dropdown";
import { AbilityContext } from "../../services/acl/can";

// Dynamic imports for better initial load time
const PaginatedTable = dynamic(() => import('../ui/paginated-table'));
const SelectFilterComponent = dynamic(() => import('../ui/select-filter'));
const ToggleButton = dynamic(() => import('../ui/togglev2'));

function BookingList(props) {
  const router = useRouter();
  const dispatch = useDispatch();
  const ability = useContext(AbilityContext);
  const currentUser = useSelector(state => state.user.user);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [executionTime, setExecutionTime] = useState(null);
  
  // Data states
  const [data, setData] = useState([]);
  const loading = useSelector(state => state.global.loading);
  
  // Filter states
  const [statuses, setStatuses] = useState([]);
  const [eligibilities, setEligibilities] = useState([]);
  const [filterStatuses, setFilterStatuses] = useState([]);
  const [filterEligibilities, setFilterElibilities] = useState([]);
  const [searchValue, setSearchValue] = useState('');
  const [selectedFilterStatus, setSelectedFilterStatus] = useState('');
  const [selectedFilterEligibility, setSelectedFilterEligibility] = useState('');
  const [toggleIncomplete, setToggleIncomplete] = useState(false);
  
  // UI states
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [deletableBookingUuid, setDeletableBookingUuid] = useState('');

  const [selectedRows, setSelectedRows] = useState([]);

  // Create debounced search function that will only execute after typing stops
  const debouncedSearch = useCallback(
    _.debounce((searchTerm) => {
      fetchBookings(searchTerm, true);
    }, 500), 
    [pageSize, toggleIncomplete, selectedFilterStatus, selectedFilterEligibility, currentPage]
  );

  // Initial load - fetch filters and set permissions
  useEffect(() => {
    fetchFilters();
    
    // Set hidden columns based on permissions
    const hiddenCols = [];
    if (!ability.can("Create/Edit", "Booking") && !ability.can("Delete", "Booking")) {
      hiddenCols.push("action");
    }
    setHiddenColumns(hiddenCols);
  }, []);

  // Monitor search value changes and trigger debounced search
  useEffect(() => {
    if (searchValue.trim() !== '') {
      debouncedSearch(searchValue);
    }
    
    // Cleanup debounce on unmount
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchValue]);

  // Monitor filter/page changes and trigger fetch
  useEffect(() => {
    fetchBookings(searchValue, true);
  }, [currentPage, pageSize, toggleIncomplete, selectedFilterStatus, selectedFilterEligibility]);

  const fetchFilters = async () => {
    try {
      // Fetch status filters
      const statusData = await fetchBookingStatuses();
      setStatuses(statusData);
      
      const fStatus = [{ label: 'All', value: 'all' }];
      statusData.forEach(s => {
        const st = JSON.parse(s.value);
        fStatus.push({ label: st.label, value: st.name });
      });
      setFilterStatuses(fStatus);

      // Fetch eligibility filters
      const eligibilityData = await fetchBookingEligibilities();
      setEligibilities(eligibilityData);
      
      const fEligibilities = [{ label: 'All', value: 'all' }];
      eligibilityData.forEach(e => {
        const et = JSON.parse(e.value);
        fEligibilities.push({ label: et.label, value: et.name });
      });
      setFilterElibilities(fEligibilities);
    } catch (error) {
      console.error("Error fetching filters:", error);
      toast.error("Failed to load filters");
    }
  };

const fetchBookings = async (searchTerm = searchValue, invalidateCache = false) => {
  dispatch(globalActions.setLoading(true));
  
  try {
    // Build query parameters - using the unified endpoint
    const queryParams = new URLSearchParams({
      include_qa: true,
      page: currentPage,
      limit: pageSize,
      invalidate_cache: invalidateCache.toString(),
      // debug: 'true',
    });
    
    // If we have a search term, add it as a query parameter
    // and don't add filters
    if (searchTerm && searchTerm.trim() !== '') {
      queryParams.append('search', searchTerm);
    } else {
      // Only apply these filters if we don't have a search term
      queryParams.append('incomplete', toggleIncomplete.toString());
      
      if (selectedFilterStatus && selectedFilterStatus !== 'All') {
        const statusObj = filterStatuses.find(s => s.label === selectedFilterStatus);
        if (statusObj && statusObj.value !== 'all') {
          queryParams.append('status', statusObj.value);
        }
      }
      
      if (selectedFilterEligibility && selectedFilterEligibility !== 'All') {
        const eligibilityObj = filterEligibilities.find(e => e.label === selectedFilterEligibility);
        if (eligibilityObj && eligibilityObj.value !== 'all') {
          queryParams.append('eligibility', eligibilityObj.value);
        }
      }
    }
    
    // Use the unified API endpoint for all booking queries
    const endpoint = `/api/bookings?${queryParams.toString()}`;
    const response = await fetch(endpoint);
    
    if (response.ok) {
      const result = await response.json();
      
      // Update state with fetched data
      setData(result.data);
      dispatch(bookingsActions.setData(result.data));
      setTotalItems(result.meta.filtered || result.meta.total);
      setTotalPages(result.meta.totalPages);
      
      // Show execution time for debugging (can be removed in production)
      if (result.meta.executionTimeMs) {
        setExecutionTime(result.meta.executionTimeMs);
        console.log(`Query executed in ${result.meta.executionTimeMs.toFixed(2)}ms`);
      }
    } else {
      toast.error("Failed to fetch bookings");
    }
  } catch (error) {
    console.error("Error fetching bookings:", error);
    toast.error("An error occurred while fetching bookings");
  } finally {
    dispatch(globalActions.setLoading(false));
  }
};

  const toggleBookingList = () => {
    setToggleIncomplete(!toggleIncomplete);
    setCurrentPage(1); // Reset to first page when toggling
  };

  const handleSearchChange = () => {
    setCurrentPage(1); // Reset to first page on new search
    fetchBookings(searchValue, true);
  };
  
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearchChange();
    }
  };

  const handleChangeStatus = (selected) => {
    setSelectedFilterStatus(selected.label);
    setSearchValue('');
    setCurrentPage(1); // Reset to first page on new filter
  };

  const handleChangeEligibility = (selected) => {
    setSelectedFilterEligibility(selected.label);
    setSearchValue('');
    setCurrentPage(1); // Reset to first page on new filter
  };

  // Pagination handlers
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const confirmDeleteBooking = (uuid) => {
    setDeletableBookingUuid(uuid);
    setConfirmModal(true);
  };

  const deleteBooking = async () => {
    setConfirmModal(false);
    
    if (selectedRows.length > 0) {
      // If we have selected rows, delete multiple
      deleteMultipleBookings();
      return;
    }
    
    if (!deletableBookingUuid) return;
    
    try {
      dispatch(globalActions.setLoading(true));
      const response = await fetch(`/api/bookings/${deletableBookingUuid}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      if (response.ok) {
        toast.success("Booking deleted successfully");
        fetchBookings(null, true); // Refresh the current page
      } else {
        toast.error("Failed to delete booking. Please try again.");
      }
    } catch (error) {
      console.error("Error deleting booking:", error);
      toast.error("An error occurred while deleting the booking");
    } finally {
      dispatch(globalActions.setLoading(false));
      setDeletableBookingUuid('');
    }
  };

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

  // Helper function to extract check-in date from booking data using question keys
  const getCheckInDate = (booking) => {
    let checkinDate = null;
    
    if (booking.Sections) {
      for (const section of booking.Sections) {
        if (!section.QaPairs) continue;
        
        for (const qaPair of section.QaPairs) {
          // Check for combined check-in/out date using question key
          if (qaPair.Question?.question_key === QUESTION_KEYS.CHECK_IN_OUT_DATE) {
            const dates = qaPair.answer.split(' - ');
            if (dates.length) {
              checkinDate = dates[0];
              break;
            }
          } 
          // Check for separate check-in date using question key
          else if (qaPair.Question?.question_key === QUESTION_KEYS.CHECK_IN_DATE) {
            checkinDate = qaPair.answer;
            break;
          }
        }
        
        if (checkinDate) break;
      }
    }
    
    if (checkinDate) {
      return moment(checkinDate).format('DD/MM/YYYY');
    } else if (booking.preferred_arrival_date) {
      return (
        <p>
          <p className="text-xs">preferred</p> 
          {moment(booking.preferred_arrival_date).format('DD/MM/YYYY')}
        </p>
      );
    }
    
    return 'N/A';
  };

  // Helper function to extract check-out date from booking data using question keys
  const getCheckOutDate = (booking) => {
    let checkoutDate = null;
    
    if (booking.Sections) {
      for (const section of booking.Sections) {
        if (!section.QaPairs) continue;
        
        for (const qaPair of section.QaPairs) {
          // Check for combined check-in/out date using question key
          if (qaPair.Question?.question_key === QUESTION_KEYS.CHECK_IN_OUT_DATE) {
            const dates = qaPair.answer.split(' - ');
            if (dates.length > 1) {
              checkoutDate = dates[1];
              break;
            }
          } 
          // Check for separate check-out date using question key
          else if (qaPair.Question?.question_key === QUESTION_KEYS.CHECK_OUT_DATE) {
            checkoutDate = qaPair.answer;
            break;
          }
        }
        
        if (checkoutDate) break;
      }
    }
    
    if (checkoutDate) {
      return moment(checkoutDate).format('DD/MM/YYYY');
    } else if (booking.preferred_departure_date) {
      return (
        <p>
          <p className="text-xs">preferred</p> 
          {moment(booking.preferred_departure_date).format('DD/MM/YYYY')}
        </p>
      );
    }
    
    return 'N/A';
  };

  // Helper function to get package information using question keys
  const getPackageInfo = (booking) => {
    const packageData = { package: null, courseAnsweredYes: false, packageDetails: null, packageCode: null };
    
    if (booking.Sections) {
      for (const section of booking.Sections) {
        if (!section.QaPairs) continue;
        
        // First, check for package-selection question type with packageDetails
        const packageSelectionQuestion = section.QaPairs.find(qaPair => 
          qaPair.Question?.type === 'package-selection' && qaPair.packageDetails
        );
        
        if (packageSelectionQuestion && packageSelectionQuestion.packageDetails) {
          packageData.package = packageSelectionQuestion.packageDetails.name;
          packageData.packageDetails = packageSelectionQuestion.packageDetails;
          packageData.packageCode = packageSelectionQuestion.packageDetails.package_code;
        }
        
        // Fallback: Check for full accommodation package using question key
        if (!packageData.package) {
          const packageQuestion = section.QaPairs.find(qaPair => 
            qaPair.Question?.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL
          );
          
          if (packageQuestion) {
            packageData.package = packageQuestion.answer;
          }
        }
        
        // Fallback: Check for course package using question key
        if (!packageData.package) {
          const coursePackageQuestion = section.QaPairs.find(qaPair => 
            qaPair.Question?.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES
          );
          
          if (coursePackageQuestion) {
            packageData.package = coursePackageQuestion.answer;
          }
        }
        
        // Check if course was selected using question key
        const courseQuestion = section.QaPairs.find(qaPair => 
          qaPair.Question?.question_key === QUESTION_KEYS.COURSE_SELECTION
        );
        
        if (courseQuestion && courseQuestion.answer) {
          packageData.courseAnsweredYes = true;
        }
      }
    }

    return packageData;
  };

  // Helper to get abbreviated package code
  const getPackageCode = (packageData) => {
    // If we have packageDetails with package_code, use it directly
    if (packageData?.packageCode) {
      return packageData.packageCode;
    }
    
    // If we have packageDetails but no packageCode, try to extract from package_code field
    if (packageData?.packageDetails?.package_code) {
      return packageData.packageDetails.package_code;
    }
    
    // Fallback: Parse package type text (legacy logic)
    const packageType = packageData?.package;
    if (!packageType) return '';
    
    if (packageType.includes("Wellness & Very High Support Package")) {
      return "WVHS";
    } else if (packageType.includes("Wellness & High Support Package")) {
      return "WHS";
    } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
      return "WS";
    } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
      return "SP";
    } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
      return "CSP";
    } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
      return "HCSP";
    }
    return '';
  };

  // Helper to get funder information using question key
  const getFunderInfo = (booking) => {
    let result = "N/A";
    
    if (booking.Sections) {
      for (const section of booking.Sections) {
        if (section.QaPairs) {
          const questionFound = section.QaPairs.find(qaPair => 
            qaPair.Question?.question_key === QUESTION_KEYS.FUNDING_SOURCE
          );
          
          if (questionFound) {
            result = questionFound.answer?.toUpperCase() || "N/A";
            break;
          }
        }
      }
    }
    
    return _.truncate(result);
  };

  const handleMultipleDelete = () => {
    if (selectedRows.length === 0) {
      toast.warn("Please select at least one booking to delete");
      return;
    }
    
    // Set modal for confirmation
    setConfirmModal(true);
  };

  const deleteMultipleBookings = async () => {
    setConfirmModal(false);
    
    if (selectedRows.length === 0) return;
    
    try {
      dispatch(globalActions.setLoading(true));
      
      // Extract UUIDs from selected rows
      const uuids = selectedRows.map(row => row.uuid);
      
      // Store the count before clearing selection
      const selectedCount = selectedRows.length;
      
      // Call the batch delete API endpoint
      const response = await fetch('/api/bookings/batch-delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uuids }),
      });
      
      const result = await response.json();
      
      if (response.ok) {
        if (result.deleted === result.requested) {
          toast.success(`${result.deleted} booking${result.deleted !== 1 ? 's' : ''} deleted successfully`);
        } else if (result.deleted > 0) {
          toast.warning(`${result.deleted} out of ${result.requested} bookings were deleted`);
        } else {
          toast.error("No bookings were deleted. They may have already been removed.");
        }
        
        // Clear selection
        setSelectedRows([]);
        
        // Refresh the list
        fetchBookings(null, true);
      } else {
        // Handle different error states with appropriate messages
        switch (response.status) {
          case 400:
            toast.error("Invalid selection. Please try again.");
            break;
          case 403:
            toast.error("You don't have permission to delete these bookings.");
            break;
          case 404:
            toast.warning("The selected bookings were not found or have already been deleted.");
            break;
          default:
            toast.error(result.message || "Failed to delete bookings. Please try again.");
        }
      }
    } catch (error) {
      console.error("Error in batch delete operation:", error);
      toast.error("An error occurred during the delete operation. Please try again.");
    } finally {
      dispatch(globalActions.setLoading(false));
    }
  };

  // Memoized columns to prevent unnecessary re-renders
  const columns = useMemo(
    () => [
      {
        Header: "Date",
        accessor: "createdAt",
        Cell: ({ row: { original } }) => moment(original.createdAt).format('DD/MM/YYYY')
      },
      {
        Header: "Booking ID",
        accessor: "reference_id",
      },
      {
        Header: "Type",
        accessor: "type",
      },
      {
        Header: "Name",
        accessor: "name",
        Cell: ({ row: { original } }) => {
          return (
            <>
              {original.Guest?.first_name} {original.Guest?.last_name}
              <div className="flex relative">
                {original.Guest?.flags && original.Guest.flags.map((flag, index) => {
                  // Flag color mapping
                  const flagColors = {
                    'complex-care': 'amber',
                    'banned': 'red',
                    'outstanding-invoices': 'fuchsia',
                    'specific-room-requirements': 'sky',
                    'account-credit': 'green',
                    'deceased': 'slate-700',
                    'not-eligible': 'gray'
                  };
                  
                  const color = flagColors[flag] || 'gray';
                  
                  return (
                    <p key={index} className={`${index > 0 && 'ml-1'} bg-${color}-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>
                      {getFirstLetters(flag)}
                      <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span>
                    </p>
                  );
                })}
              </div>
            </>
          );
        },
      },
      {
        Header: "Check-in",
        accessor: "preferred_arrival_date",
        Cell: ({ row: { original } }) => getCheckInDate(original)
      },
      {
        Header: "Check-out",
        accessor: "preferred_departure_date",
        Cell: ({ row: { original } }) => getCheckOutDate(original)
      },
      {
        Header: "Eligibility",
        accessor: "eligibility",
        Cell: ({ row: { original } }) => (
          <DropdownEligibility 
            disabled={!ability.can("Create/Edit", "Booking")} 
            status={JSON.parse(original.eligibility)} 
            booking={original} 
            fetchData={() => fetchBookings(searchValue, true)} 
          />
        ),
      },
      {
        Header: "Status",
        accessor: "status",
        Cell: ({ row: { original } }) => {
          const statusObj = original.status ? JSON.parse(original.status) : null;
          const cancellationType = getCancellationType(original);
          const isCancelled = isBookingCancelled(original.status);
          return (
            <div className="flex flex-col space-y-1">
              <DropdownStatus 
                disabled={!ability.can("Create/Edit", "Booking")} 
                status={statusObj}
                booking={original} 
                fetchData={() => fetchBookings(searchValue, true)}
              />
              
              {/* Cancellation Type Badge */}
              {isCancelled && cancellationType && (
                <div 
                  className={`px-2 py-0.5 rounded text-xs font-medium w-fit ${
                    cancellationType === 'Full Charge' 
                      ? 'bg-red-100 text-red-800 border border-red-200' 
                      : 'bg-green-100 text-green-800 border border-green-200'
                  }`}
                  title={
                    cancellationType === 'Full Charge'
                      ? 'Nights NOT returned - guest lost nights as penalty'
                      : 'Nights returned to guest\'s iCare approval (no penalty)'
                  }
                >
                  <div className="flex items-center space-x-1">
                    {cancellationType === 'Full Charge' ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    )}
                    <span>{cancellationType}</span>
                  </div>
                </div>
              )}
            </div>
          );
        },
      },
      {
        Header: "Package Type",
        accessor: "package_type",
        Cell: ({ row: { original } }) => {
          const packageData = getPackageInfo(original);
          const packageCode = getPackageCode(packageData);
          const displayCode = packageData.courseAnsweredYes ? `Course${packageCode}` : packageCode;
          
          return (
            <div className="flex flex-nowrap">
              <p>{displayCode || "N/A"}</p>
              {(packageData.package || packageData.packageDetails) && displayCode !== "N/A" && (
                <div className="group relative">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                  </svg>
                  <div className="absolute text-xs p-4 bg-black/80 rounded-md text-white bottom-[100%] right-0 hidden group-hover:block w-[300px]">
                    {packageData.packageDetails?.name || packageData.package}
                    {packageData.packageDetails && (
                      <div className="mt-2 text-gray-300">
                        <div>Code: {packageData.packageDetails.package_code}</div>
                        <div>Funder: {packageData.packageDetails.funder}</div>
                        {packageData.packageDetails.ndis_package_type && (
                          <div>Type: {packageData.packageDetails.ndis_package_type.toUpperCase()}</div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        }
      },
      {
        Header: "Funder",
        accessor: "funder",
        Cell: ({ row: { original } }) => getFunderInfo(original)
      },
      {
        Header: "Labels",
        accessor: "label",
        Cell: ({ row: { original } }) => {
          const labels = (original.label && original.label.length > 0) ? original.label : [];
          
          // Label color mapping
          const labelColors = {
            'travel_grant': 'amber',
            'foundation_stay': 'violet',
            'waiting_icare_approval': 'fuchsia',
            'waiting_icare_approval_2nd_room': 'sky',
            'waiting_emergency_contacts': 'green',
            'waiting_new_dates': 'slate-700',
            'waiting_snapform': 'yellow',
            'waiting_icare_confirmation': 'blue',
            'waiting_to_hear_from_seb': 'orange',
            'see_notes': 'gray'
          };
          
          return (
            <div className="flex relative">
              {labels.map((label, index) => {
                const color = labelColors[label] || 'gray';
                const displayLabel = label instanceof Object ? label.label : label;
                return (
                  <p key={index} className={`${index > 0 && 'ml-1'} bg-${color}-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>
                    {getFirstLetters(displayLabel, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(displayLabel)}</span>
                  </p>
                );
              })}
            </div>
          );
        },
      },
      {
        Header: "Action",
        accessor: "action",
        Cell: ({ row: { original } }) => {
          const rowData = {...original};
          const funder = getFunder(rowData.Sections)?.toLowerCase();
          
          // Only show these options for confirmed bookings with specific funders
          const showSummaryOptions = 
            rowData.statusObj?.name === 'booking_confirmed' && 
            funder && 
            funder !== 'icare';
          
          return (
            <ActionDropDown options={[
              {
                label: "View",
                action: () => {
                  router.push("bookings/" + original.uuid);
                },
                hidden: !ability.can("Read", "Booking"),
                icon: () => (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                  </svg>
                )
              },
              {
                label: "Download Summary of Stay",
                action: () => {
                  handleDownloadPDF(original);
                },
                hidden: !showSummaryOptions,
                icon: () => (
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                )
              },
              {
                label: "Send Summary of Stay via Email",
                action: () => {
                  handleEmailPDF(original);
                },
                hidden: !showSummaryOptions,
                icon: () => (
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )
              },
              {
                label: "Delete",
                action: () => {
                  confirmDeleteBooking(original.uuid);
                },
                hidden: !ability.can("Delete", "Booking"),
                icon: () => (
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                )
              }
            ]} />
          );
        },
      },
    ], 
    [router, ability, fetchBookings, searchValue]
  );

  return (
    <>
      <div className="rounded-md">
        <div className="">
        <div className="flex flex-row justify-between mb-2">
          <div className="flex items-center">
            <label className="relative block w-96">
              <input 
                className="w-full bg-white placeholder:font-italitc border border-slate-300 rounded-full py-2 pl-4 pr-16 focus:outline-none" 
                value={searchValue} 
                onChange={(e) => setSearchValue(e.target.value)} 
                onKeyPress={handleKeyPress} 
                placeholder="Search for Name, Type, Spinal Injury Type" 
                type="text" 
              />
              <button 
                className="absolute inset-y-0 right-0 flex items-center px-4 text-blue-600 hover:text-blue-800 font-medium rounded-r-full"
                onClick={handleSearchChange}
                aria-label="Search"
              >
                <svg className="h-5 w-5 fill-black" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 30 30">
                  <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z"></path>
                </svg>
              </button>
            </label>
            {toggleIncomplete && selectedRows.length > 0 && ability.can("Delete", "Booking") && (
              <button
                className="ml-3 bg-red-500/90 text-white rounded-md flex items-center hover:bg-red-600 transition-colors text-sm shadow-sm"
                onClick={handleMultipleDelete}
                disabled={loading}
                aria-label="Delete Selected Bookings"
              >
                <div className="px-2 py-1.5 flex items-center">
                  {loading ? (
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                  )}
                  <span className="font-medium">
                    Selected ({selectedRows.length})
                  </span>
                </div>
              </button>
            )}
          </div>
          
          <div className="flex flex-row items-center">
            <div className="text-base text-zinc-500 mr-2">Filters: </div>
              {searchValue.trim() !== '' && (
                <div className="mr-2 bg-blue-50 text-blue-800 px-3 py-1 rounded-full text-sm flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 mr-1">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
                  </svg>
                  Search Mode
                  <button 
                    onClick={() => {
                      setSearchValue('');
                      fetchBookings('', true);
                    }}
                    className="ml-2 text-blue-600 hover:text-blue-800"
                    title="Clear Search"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )}
            <div className="mr-2 w-fit">
              <SelectFilterComponent 
                options={filterEligibilities} 
                placeholder={"Eligibility"} 
                onChange={handleChangeEligibility} 
                value={selectedFilterEligibility} 
                disabled={toggleIncomplete || searchValue.trim() !== ''} 
              />
            </div>
            <div className="mr-2 w-fit">
              <SelectFilterComponent 
                options={filterStatuses} 
                placeholder={"Status"} 
                onChange={handleChangeStatus} 
                value={selectedFilterStatus} 
                disabled={toggleIncomplete || searchValue.trim() !== ''} 
              />
            </div>
            <div className="w-fit my-auto ml-2">
              <ToggleButton 
                status={toggleIncomplete} 
                title="Toggle Incomplete/Complete Bookings" 
                disabled={loading || searchValue.trim() !== ''} 
                onChange={toggleBookingList}
              />
            </div>
          </div>
        </div>
          
          <statusContext.Provider value={statuses}>
            <eligibilityContext.Provider value={eligibilities}>
            <PaginatedTable
                columns={columns}
                data={data}
                hiddenColumns={hiddenColumns}
                currentPage={currentPage}
                pageSize={pageSize}
                totalItems={totalItems}
                totalPages={totalPages}
                loading={loading}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                selection={ability.can("Delete", "Booking")} // Only enable selection if user can delete
                selectedRows={selectedRows}
                setSelectedRows={setSelectedRows}
              />
            </eligibilityContext.Provider>
          </statusContext.Provider>
        </div>
      </div>
      
      {confirmModal && (
        <DeleteConfirmModal
          title="Delete Selected Bookings"
          description={`Are you sure you want to delete ${selectedRows.length > 0 ? selectedRows.length : '1'} selected booking${selectedRows.length > 1 ? 's' : ''}? This action cannot be undone.`}
          selectedCount={selectedRows.length}
          onClose={() => {
            setConfirmModal(false);
            setDeletableBookingUuid('');
          }}
          onConfirm={deleteBooking}
        />
      )}

    </>
  );
}

export default BookingList;


function DeleteConfirmModal({ title, description, onClose, onConfirm, selectedCount }) {
  return (
      <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose}>
          <div className="flex items-center justify-center h-full">
              <div 
                  className="bg-white rounded-lg shadow-lg w-full max-w-lg mx-4" 
                  onClick={(e) => e.stopPropagation()}
              >
                  <div className="p-6">
                      <h2 className="text-xl font-bold text-blue-800 mb-3">{title || `Delete Selected Bookings`}</h2>
                      <p className="text-gray-700 mb-8">
                          {description || `Are you sure you want to delete ${selectedCount} selected booking${selectedCount !== 1 ? 's' : ''}? This action cannot be undone.`}
                      </p>
                      
                      <div className="flex justify-end space-x-8">
                          <button 
                              className="font-medium text-gray-500 uppercase text-sm" 
                              onClick={onClose}
                          >
                              CANCEL
                          </button>
                          <button 
                              className="font-medium text-blue-700 uppercase text-sm" 
                              onClick={onConfirm}
                          >
                              DELETE
                          </button>
                      </div>
                  </div>
              </div>
          </div>
      </div>
  );
}