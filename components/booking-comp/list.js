import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DropdownStatus } from "./dropdown-status";
import { useRouter } from "next/router";
import { statusContext, fetchBookingStatuses } from "./../../services/booking/statuses";
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { bookingsActions } from "../../store/bookingsSlice";
import { toast } from "react-toastify";
import { getFirstLetters } from "../../utilities/common";

import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import { eligibilityContext, fetchBookingEligibilities } from "../../services/booking/eligibilities";
import { DropdownEligibility } from "./dropdown-eligibility";
import ActionDropDown from "./action-dropdown";
import Modal from "../ui/genericModal";
import { AbilityContext } from "../../services/acl/can";

const Table = dynamic(() => import('../ui/table'));
const SelectFilterComponent = dynamic(() => import('../ui/select-filter'));
const ToggleButton = dynamic(() => import('../ui/togglev2'));

function BookingList(props) {
  const router = useRouter();
  const dispatch = useDispatch();
  const list = useSelector(state => state.bookings.list);
  const filteredList = useSelector(state => state.bookings.filteredData);
  const [filterStatuses, setFilterStatuses] = useState();
  const [filterEligibilities, setFilterElibilities] = useState();
  const [isFiltering, setIsFiltering] = useState(true);
  const [searchValue, setSearchValue] = useState();
  const [selectedFilterStatus, setSelectedFilterStatus] = useState();
  const [selectedFilterEligibility, setSelectedFilterEligibility] = useState();
  const [data, setData] = useState([]);
  const [confirmModal, setConfirmModal] = useState(false);
  const [deletableBookingUuid, setDeletableBookingUuid] = useState();
  const [hiddenColumns, setHiddenColumns] = useState([]);
  const ability = useContext(AbilityContext);
  const [toggleIncomplete, setToggleIncomplete] = useState(false);
  const loading = useSelector(state => state.global.loading);
  const currentUser = useSelector(state => state.user.user);

  const handleDownloadPDF = async (bookingId) => {
    toast.info('Generating PDF. Please wait...');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/download-summary-pdf-v2`, {
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
      a.download = `summary-of-stay-${bookingId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download summary of stay. Please try again.');
    }
  }

  const handleEmailPDF = async (bookingId) => {
    toast.info('Your email is being sent in the background. Feel free to navigate away or continue with other tasks.');
    try {
      const response = await fetch(`/api/bookings/${bookingId}/email-summary-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminEmail: currentUser.type == 'user' ? currentUser.email : null, origin: currentUser.type }),
      });
  
      if (!response.ok) throw new Error('Failed to send email');
      toast.success('Summary sent to your email successfully!');
    } catch (error) {
      console.error('Error sending email:', error);
      toast.error('Failed to send email. Please try again.');
    }
  };

  const toggleBookingList = () => {
    setToggleIncomplete(prevState => {
      const newState = !prevState;
      if (newState) {
        fetchIncompleteBookings();
      } else {
        fetchData();
      }
      return newState;
    });
  };

  const handleSearchChange = (e) => {
    setSearchValue(e.target.value);
    setSelectedFilterStatus('');
    handleFilter('any', e.target.value, list);
  }

  const handleChangeStatus = (selected) => {
    setSelectedFilterStatus(selected.label);
    setSearchValue('');
    handleFilter('status', selected.value, list);
  }

  const handleChangeEligibility = (selected) => {
    setSelectedFilterEligibility(selected.label);
    setSearchValue('');
    handleFilter('eligibility', selected.value, list);
  }

  const handleFilter = (field, value, dataArr) => {
    if (value) {
      let searchResult = [];
      if (field === 'status') {
        if (value === 'all') {
          searchResult = list.map(b => {
            let temp = { ...b };
            temp.statusObj = JSON.parse(temp.status);
            return temp;
          }).filter(b => { return b.statusObj.name !== 'booking_confirmed' })
            .filter(b => { return b.statusObj.name !== 'booking_cancelled' });
        } else {
          searchResult = dataArr.filter(b => {
            const st = JSON.parse(b.status);
            if (st.name === value) {
              return b;
            }
          });
        }
      } else if (field === 'eligibility') {
        if (value === 'all') {
          searchResult = list;
        } else {
          searchResult = dataArr.filter(b => {
            const st = JSON.parse(b.eligibility);
            if (st.name === value) {
              return b;
            }
          });
        }
      } else {
        const uniqueBookings = new Set();
        dataArr.map(b => {
          if (b?.name?.toLowerCase()?.includes(value.toLowerCase())) {
            uniqueBookings.add(b);
          }

          if (b?.type?.toLowerCase()?.includes(value.toLowerCase())) {
            uniqueBookings.add(b);
          }

          if (b?.type_of_spinal_injury?.toLowerCase()?.includes(value.toLowerCase())) {
            uniqueBookings.add(b);
          }

          if (b?.reference_id?.toLowerCase()?.includes(value.toLowerCase())) {
            uniqueBookings.add(b);
          }
        });

        searchResult = Array.from(uniqueBookings);
      }

      dispatch(bookingsActions.setFilteredData(searchResult));
      setIsFiltering(true);
    } else {
      setSelectedFilterStatus('');
      setData(list);
      setIsFiltering(false);
    }
  }

  useEffect(() => {
    fetchData();

    let hiddenColumns = [];
    if (!ability.can("Create/Edit", "Booking") && !ability.can("Delete", "Booking")) {
      hiddenColumns.push("action");
    }
    setHiddenColumns(hiddenColumns);
  }, []);

  const fetchData = async () => {
    // presenting 'all' filtered data by default.
    dispatch(bookingsActions.setList([]));
    dispatch(bookingsActions.setFilteredData([]));
    dispatch(globalActions.setLoading(true));
    const response = await fetch("/api/bookings")

    if (response.ok) {
      const dataArr = [];
      const responseData = await response.json();

      const guestCancelledBookings = responseData.filter(booking => booking.status.includes('guest_cancelled'));

      const amendedBookings = responseData.filter(booking => booking.status.includes('booking_amended'));

      const otherStatusBookings = responseData.filter(booking => !booking.status.includes('guest_cancelled') && !booking.status.includes('booking_amended'));

      const sortedData = [...guestCancelledBookings, ...amendedBookings, ...otherStatusBookings];

      sortedData.map(booking => {
        let temp = { ...booking };
        temp.name = temp?.Guest.first_name + " " + temp?.Guest.last_name;
        dataArr.push(temp);
      });

      // excluding confirmed and canceled bookings
      const filteredDataArr = dataArr.map(b => {
        let temp = { ...b };
        temp.statusObj = JSON.parse(temp.status);
        return temp;
      }).filter(b => { return b.statusObj.name !== 'booking_confirmed' })
        .filter(b => { return b.statusObj.name !== 'booking_cancelled' });

        dispatch(bookingsActions.setFilteredData(filteredDataArr));
        setTimeout(() => {
          dispatch(globalActions.setLoading(false));
          dispatch(bookingsActions.setList(dataArr));
      }, 1000);
    }
  }

  const fetchIncompleteBookings = async () => {
    // presenting 'all' filtered data by default.
    dispatch(globalActions.setLoading(true));
    const response = await fetch("/api/bookings/get-incomplete")

    if (response.ok) {
      const dataArr = [];
      const responseData = await response.json();
      const guestCancelledBookings = responseData.filter(booking => booking.status.includes('guest_cancelled'));

      const amendedBookings = responseData.filter(booking => booking.status.includes('booking_amended'));

      const otherStatusBookings = responseData.filter(booking => !booking.status.includes('guest_cancelled') && !booking.status.includes('booking_amended'));

      const sortedData = [...guestCancelledBookings, ...amendedBookings, ...otherStatusBookings];

      sortedData.map(booking => {
        let temp = { ...booking };
        temp.name = temp?.Guest.first_name + " " + temp?.Guest.last_name;
        temp.statusObj = JSON.parse(temp.status);
        if (temp.statusObj.name === 'pending_approval' || temp.statusObj.name === 'ready_to_process') {
          temp.status = JSON.stringify({ name: 'incomplete', label: 'Incomplete', color: 'transparent' });
          temp.statusObj = JSON.parse(temp.status);
        }
        dataArr.push(temp);
      });

      // excluding confirmed and canceled bookings
      const filteredDataArr = dataArr
          .filter(b => { return b.statusObj.name !== 'booking_confirmed' })
          .filter(b => { return b.statusObj.name !== 'booking_cancelled' });

        dispatch(bookingsActions.setFilteredData(filteredDataArr));
        setTimeout(() => {
          dispatch(globalActions.setLoading(false));
          dispatch(bookingsActions.setList(dataArr));
      }, 1000);
    }
  }

  // const statusContextInstance = React.useContext(statusContext);
  const [statuses, setStatuses] = useState([]);
  const [eligibilities, setEligibilities] = useState([]);

  useEffect(() => {
    let fStatus = [];
    fetchBookingStatuses().then(data => {
      setStatuses(data);
      fStatus.push({ label: 'All', value: 'all' });
      data.map(s => {
        const st = JSON.parse(s.value);
        fStatus.push({ label: st.label, value: st.name });
      });

      setFilterStatuses(fStatus);
    });

    let fEligibilities = [];
    fetchBookingEligibilities().then(data => {
      setEligibilities(data);
      fEligibilities.push({ label: 'All', value: 'all' });
      data.map(e => {
        const et = JSON.parse(e.value);
        fEligibilities.push({ label: et.label, value: et.name });
      });

      setFilterElibilities(fEligibilities);
    })
  }, []);

  useEffect(() => {
    if (isFiltering) {
      setData(filteredList);
    } else {
      setData(list);
    }
  }, [isFiltering, filteredList, list]);

  const confirmDeleteBooking = async (uuid) => {
    setDeletableBookingUuid(uuid);
    setConfirmModal(true);
  }

  const deleteBooking = async (uuid) => {
    setConfirmModal(false);
    setDeletableBookingUuid('');
    const response = await fetch("/api/bookings/" + uuid, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      toast.success("Booking deleted successfully");
      fetchData();
    } else {
      toast.error("Failed to delete booking. Please try again.");
    }
  };

  const columns = useMemo(
    () => [
      {
        Header: "Date",
        accessor: "createdAt",
        Cell: function ({ row: { original } }) {
          return moment(original.createdAt).format('DD/MM/YYYY');
        }
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
        accessor: "name", // accessor is the "key" in the data
        Cell: function ({ row: { original } }) {
          return <>
            {original.Guest.first_name + " " + original.Guest.last_name}
            <div className="flex relative">
              {original.Guest.flags && original.Guest.flags.map((flag, index) => {
                if (flag == 'complex-care') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-amber-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'banned') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-red-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'outstanding-invoices') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-fuchsia-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'specific-room-requirements') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-sky-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'account-credit') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-green-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'deceased') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-slate-700 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'not-eligible') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-gray-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag)}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                }
              })}
            </div>
          </>;
        },
      },
      {
        Header: "Check-in",
        accessor: "preferred_arrival_date",
        Cell: function ({ row: { original } }) {
          let checkinCheckoutDates = [];
          original.Sections.map(section => section.QaPairs.map(qaPair => {
            if (qaPair.question == 'Check In Date and Check Out Date') {
              checkinCheckoutDates = qaPair.answer.split(' - ');
            } else if (qaPair.question == 'Check In Date') {
              checkinCheckoutDates = [qaPair.answer];
            }
          }));
          if (checkinCheckoutDates.length) {
            return moment(checkinCheckoutDates[0]).format('DD/MM/YYYY');
          }

          if (original.preferred_arrival_date) {
            return <p><p className="text-xs">preferred</p> {moment(original.preferred_arrival_date).format('DD/MM/YYYY')}</p>;
          }

          return 'N/A';
        }
      },
      {
        Header: "Check-out",
        accessor: "preferred_departure_date",
        Cell: function ({ row: { original } }) {
          let checkinCheckoutDates = [];
          original.Sections.map(section => section.QaPairs.map(qaPair => {
            if (qaPair.question == 'Check In Date and Check Out Date') {
              checkinCheckoutDates = qaPair.answer.split(' - ');
            } else if (qaPair.question == 'Check Out Date') {
              checkinCheckoutDates = ['', qaPair.answer];
            }
          }));

          if (checkinCheckoutDates.length) {
            return moment(checkinCheckoutDates[1]).format('DD/MM/YYYY');
          }

          if (original.preferred_departure_date) {
            return <p> <p className="text-xs">preferred</p> {moment(original.preferred_departure_date).format('DD/MM/YYYY')} </p>;
          }

          return 'N/A';
        }
      },
      {
        Header: "Eligibility",
        accessor: "eligibility",
        Cell: function ({ row: { original } }) {
          return (
            <DropdownEligibility disabled={!ability.can("Create/Edit", "Booking")} status={JSON.parse(original.eligibility)} booking={original} fetchData={fetchData} />
          );
        },
      },
      {
        Header: "Status",
        accessor: "status",
        Cell: function ({ row: { original } }) {
          return (
            <DropdownStatus disabled={!ability.can("Create/Edit", "Booking")} status={original.status ? JSON.parse(original.status) : ""} booking={original} fetchData={fetchData} />
          );
        },
      },
      {
        Header: "Package Type",
        accessor: "package_type",
        Cell: function ({ row: { original } }) {
          const packageData = { package: null, courseAnsweredYes: false };

          original.Sections.map(section => {
            if (section.QaPairs) {
              let packageQuestionFound = section.QaPairs.find(qaPair => qaPair.question == 'Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.');
              if (packageQuestionFound) {
                packageData.package = packageQuestionFound.answer;
              }

              let courseQuestionFound = section.QaPairs.find(qaPair => qaPair.question == 'Accommodation package options for Sargood Courses are:');
              if (courseQuestionFound) {
                packageData.package = courseQuestionFound.answer;
              }

              let courseAnsweredYes = section.QaPairs.find(qaPair => qaPair.question == 'Which course?');
              if (courseAnsweredYes && courseAnsweredYes.answer) {
                packageData.courseAnsweredYes = true;
              }
            }
          });

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
          }

          const serializePackageAndCourse = () => {
            if (!packageData.package) {
              return;
            }

            if (!packageData.courseAnsweredYes) {
              return serializePackage(packageData.package);
            }

            if (packageData.courseAnsweredYes) {
              return 'Course' + serializePackage(packageData.package);
            }

            return "N/A";
          }
          return <div className="flex flex-nowrap">
            <p>{serializePackageAndCourse()}</p>
            {serializePackageAndCourse() != "N/A" && <div className="group relative">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 ml-2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              <div className="absolute text-xs p-4 bg-black/80 rounded-md text-white bottom-[100%] right-0 hidden group-hover:block w-[300px]">{packageData.package}</div>
            </div>}
          </div>;
        }
      },
      {
        Header: "Funder",
        accessor: "funder",
        Cell: function ({ row: { original } }) {
          let result = "N/A";
          original.Sections.map(section => {
            if (section.QaPairs) {
              let questionFound = section.QaPairs.find(qaPair => qaPair.question == 'How will your stay be funded?');
              if (questionFound) {
                result = questionFound.answer;
              }
            }
          });
          return _.truncate(result);
        }
      },
      {
        Header: "Labels",
        accessor: "label",
        Cell: function ({ row: { original } }) {
          const labels = (original.label && original.label.length > 0) ? original.label : [];
          return <>
            <div className="flex relative">
              {labels.map((flag, index) => {
                if (flag == 'travel_grant') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-amber-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'foundation_stay') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-violet-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_icare_approval') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-fuchsia-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_icare_approval_2nd_room') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-sky-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_emergency_contacts') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-green-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_new_dates') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-slate-700 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_snapform') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-yellow-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_icare_confirmation') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-blue-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'waiting_to_hear_from_seb') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-orange-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                } else if (flag == 'see_notes') {
                  return <p key={index} className={`${index > 0 && 'ml-1'} bg-gray-500 w-fit px-2 p-1 text-xs text-white rounded-full group`}>{getFirstLetters(flag, '_')}
                    <span className="absolute bg-black/90 p-4 py-2 rounded-md hidden group-hover:block whitespace-nowrap bottom-2/3">{_.startCase(flag)}</span></p>
                }
              })}
            </div>
          </>;
        },
      },
      {
        Header: "Action",
        accessor: "action",
        Cell: function ({ row: { original } }) {
          const rowData = {...original};
          if (!original.hasOwnProperty('statusObj')) {
            rowData.statusObj = JSON.parse(original.status);
          }
          return (
            <ActionDropDown options={[
              {
                label: "View",
                action: () => {
                  router.push("bookings/" + original.uuid);
                },
                hidden: !ability.can("Read", "Booking"),
                icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                </svg>
              },
              {
                label: "Download Summary of Stay",
                action: () => {
                  handleDownloadPDF(original.uuid);
                },
                hidden: rowData.statusObj?.name != 'booking_confirmed' ? true : false,
                icon: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>

              },
              {
                label: "Send Summary of Stay via Email",
                action: () => {
                  handleEmailPDF(original.uuid);
                },
                hidden: rowData.statusObj?.name != 'booking_confirmed' ? true : false,
                icon: () => <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>

              },
              {
                label: "Delete",
                action: () => {
                  confirmDeleteBooking(original.uuid);
                },
                hidden: !ability.can("Delete", "Booking"),
                icon: () => <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
              }
            ]} />
          );
        },
      },
    ], [router]);


  return (
    <>
      <div className="rounded-md">
        <div className="">
          <div className="flex flex-row justify-between mb-2">
            <label className="relative block w-4/12">
              <span className="absolute inset-y-0 left-0 flex items-center p-3 pt-5 h-5">
                <svg className="h-5 w-5 fill-black" xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="30" height="30" viewBox="0 0 30 30">
                  <path d="M 13 3 C 7.4889971 3 3 7.4889971 3 13 C 3 18.511003 7.4889971 23 13 23 C 15.396508 23 17.597385 22.148986 19.322266 20.736328 L 25.292969 26.707031 A 1.0001 1.0001 0 1 0 26.707031 25.292969 L 20.736328 19.322266 C 22.148986 17.597385 23 15.396508 23 13 C 23 7.4889971 18.511003 3 13 3 z M 13 5 C 17.430123 5 21 8.5698774 21 13 C 21 17.430123 17.430123 21 13 21 C 8.5698774 21 5 17.430123 5 13 C 5 8.5698774 8.5698774 5 13 5 z"></path>
                </svg>
              </span>
              <input className="w-full bg-white placeholder:font-italitc border border-slate-300 rounded-full py-2 pl-10 pr-4 focus:outline-none" value={searchValue} onChange={handleSearchChange} placeholder="Search for Name, Type, Spinal Injury Type" type="text" />
            </label>
            <div className="flex flex-row justify-center align-middle">
              <div className="text-base text-zinc-500 m-3">Filters: </div>
              <div className="mr-2 w-fit">
                <SelectFilterComponent options={filterEligibilities} placeholder={"Eligibility"} onChange={handleChangeEligibility} value={selectedFilterEligibility} disabled={toggleIncomplete} />
              </div>
              <div className="mr-2 w-fit">
                <SelectFilterComponent options={filterStatuses} placeholder={"Status"} onChange={handleChangeStatus} value={selectedFilterStatus} disabled={toggleIncomplete} />
              </div>
              <div className="w-fit my-auto">
                  <ToggleButton status={toggleIncomplete} title="Toggle Incomplete/Complete Bookings" disabled={loading} onChange={toggleBookingList}/>
              </div>
            </div>
          </div>
          <statusContext.Provider value={statuses}>
            <eligibilityContext.Provider value={eligibilities}>
              <Table
                columns={columns}
                apiResult={data}
                hiddenColumns={hiddenColumns}
              />
            </eligibilityContext.Provider>
          </statusContext.Provider>
        </div>
      </div>
      {confirmModal && (
        <Modal
          title="Confirm Deletion"
          description="Are you sure you want to delete this booking?"
          onConfirm={() => deleteBooking(deletableBookingUuid)}
          onClose={() => setConfirmModal(false)}
        />
      )}
    </>
  );
}

export default BookingList;
