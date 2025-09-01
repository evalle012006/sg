import { useRouter } from "next/router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import dynamic from 'next/dynamic';
import moment from "moment";
import { useDispatch, useSelector } from "react-redux";
import { fetchBookingStatuses, fetchBookingEligibilities } from "../../services/booking/statuses";
import Image from "next/image";
import BookingDetailComp from "../../components/booking-comp/details";
const Layout = dynamic(() => import('../../components/layout'));
const LayoutWithRightPanel = dynamic(() => import('../../components/layoutWithRightPanel'));
const DetailSidebar = dynamic(() => import('../../components/booking-comp/detail-sidebar'));
const RightPanel = dynamic(() => import('../../components/rightPanel'));
const SelectComponent = dynamic(() => import('../../components/ui/select'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
import { globalActions } from "../../store/globalSlice";
import { Can } from "../../services/acl/can";
import BookingActionIcons from "../../components/booking-comp/booking-action";
import { toast } from "react-toastify";
import { getFunder } from "../../utilities/common";

function BookingDetail() {
  const loading = useSelector(state => state.global.loading);

  const dispatch = useDispatch();
  const currentUser = useSelector(state => state.user.user);
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const router = useRouter()
  const { uuid } = router.query;
  const [hidePanel, setHidePanel] = useState(true);
  const [funder, setFunder] = useState(null);

  const [statuses, setStatuses] = useState([]);
  const [eligibilities, setEligibilities] = useState([]);

  const [rightPanelIsOpen, setRightPanelIsOpen] = useState(false);

  const bookingDetailsRef = useRef();

  const fetchBooking = useCallback(async () => {
    const res = await fetch(`/api/bookings/${uuid}`)

    const data = await res.json();
    if (res.ok) {
      setBooking(data);
      setFunder(getFunder(data.Sections));
      setStatus(JSON.parse(data.status));
      setEligibility(JSON.parse(data.eligibility));
      dispatch(globalActions.setLoading(false));
      setHidePanel(false);
    }
  });

  const createBookingRequestForm = async () => {
    await fetch(`/api/booking-request-form/check-booking-section`, {
      method: 'POST',
      body: JSON.stringify({ bookingId: booking.id }),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  };

  const handleUpdateStatus = async (selected) => {
    dispatch(globalActions.setLoading(true));
    setStatus(selected);
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: selected
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
        dispatch(globalActions.setLoading(false));
        return;
      }

      // Success case
      await fetchBooking();

      if (status.name == 'eligible') {
        toast.success("An invitation email has been sent to the guest.");
      }
      
      // Show success message for booking confirmation
      if (selected.name === 'booking_confirmed') {
        toast.success("Booking has been confirmed successfully!");
      }

    } catch (error) {
      console.error('Network error updating status:', error);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }

  const handleUpdateEligibility = async (selected) => {
    dispatch(globalActions.setLoading(true));
    setEligibility(selected);
    
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
        // Try to parse error message from response
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
        
        toast.error(errorMessage);
        dispatch(globalActions.setLoading(false));
        return;
      }

      // Success case
      await fetchBooking();
      
      if (selected.name === 'eligible') {
        toast.success("Guest eligibility approved successfully!");
      } else if (selected.name === 'ineligible') {
        toast.success("Guest eligibility status updated.");
      }

    } catch (error) {
      console.error('Network error updating eligibility:', error);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }

  const handleEditBooking = () => {
    window.open(`/booking-request-form?uuid=${uuid}&origin=admin`, '_blank');
  }

  useEffect(() => {
    let mounted = true;

    mounted && uuid && fetchBooking(uuid);

    return (() => {
      mounted = false;
    });

  }, [uuid]);

  useEffect(() => {
    if (booking) {
      createBookingRequestForm();
    }
  }, [booking]);

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

  const handleDownloadPDF = async () => {
    try {
      const response = await fetch(`/api/bookings/${uuid}/download-summary-pdf-v2`, {
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
      a.download = `summary-of-stay-${uuid}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download summary of stay. Please try again.');
    }
  }

  const handleEmailPDF = async () => {
    try {
      const response = await fetch(`/api/bookings/${uuid}/email-summary-v2`, {
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

  return (
    <Layout hideTitleBar={true}>
      {hidePanel ? (
        <div className='h-screen flex items-center justify-center'>
          <Spinner />
        </div>
      ) : (
        <LayoutWithRightPanel
          mainContent={
            <div className="">
              <div className="relative">
                {currentUser?.type == 'user' ? (
                  <React.Fragment>
                    <div className="py-12 pl-12 px-6">
                      <div className="flex flex-col lg:mb-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
                          {status?.name != 'enquiry' ? 
                            <h1 className="page-title mb-2 sm:mb-0">Booking Detail</h1> : 
                            <h1 className="page-title mb-2 sm:mb-0">Booking Enquiry</h1>
                          }
                          <div className="flex items-center gap-2">
                            {booking && booking.pdfFileUrl && (
                              <a 
                                target="_blank" 
                                rel="noreferrer" 
                                href={booking.pdfFileUrl} 
                                className="flex items-center hover:bg-gray-100 rounded-full p-1.5 md:p-2 transition-colors duration-200"
                              >
                                <Image
                                  title="Export Booking to PDF"
                                  alt="Export Booking to PDF"
                                  src="/icons/download.png"
                                  width={34}
                                  height={34}
                                />
                              </a>
                            )}
                            {(status?.name == 'booking_confirmed' && funder && funder?.toLowerCase() != 'icare') && 
                              <BookingActionIcons 
                                handleDownloadPDF={handleDownloadPDF} 
                                handleEmailPDF={handleEmailPDF} 
                              />
                            }
                          </div>
                        </div>
                        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                          <Can I="Create/Edit" a="Booking">
                            <div className="flex flex-col w-full md:w-fit md:flex-row md:space-x-3 md:items-start md:flex-wrap gap-3">
                              <SelectComponent 
                                label={'Status'} 
                                placeholder={'Update status'} 
                                value={status && status.label} 
                                options={statuses} 
                                onChange={handleUpdateStatus} 
                              />
                              <SelectComponent 
                                label={'Eligibility'} 
                                placeholder={'Update status'} 
                                value={eligibility && eligibility.label} 
                                options={eligibilities} 
                                onChange={handleUpdateEligibility} 
                              />
                              {/* {booking?.complete && ( */}
                                {/* <div className="my-auto w-full md:w-fit"><button className="w-full md:w-fit bg-sargood-blue h-fit py-3 px-5 rounded-md text-white font-bold" onClick={() => bookingDetailsRef?.current?.enableBookingEditMode()}>Edit Booking</button></div> */}
                                <div className="my-auto w-full md:w-fit"><button className="w-full md:w-fit bg-sargood-blue h-fit py-3 px-5 rounded-md text-white font-bold" onClick={handleEditBooking}>Edit Booking</button></div>
                              {/* )} */}
                            </div>
                          </Can>
                        </div>
                      </div>
                      {eligibility?.name == 'eligible' ? <BookingDetailComp ref={bookingDetailsRef} booking={booking} /> :
                        <div className="h-full">
                          <div className="bg-yellow-100 rounded-lg py-2.5 px-3.5 mb-10 text-sm border mr-8" role="alert">
                            <h4 className="text-lg font-medium leading-tight mb-2">{status?.label}</h4>
                            <p className="mb-4">
                              This booking is currently <strong>{status?.label}</strong>. Please approve the booking to send an invitation email to the guest.
                              You will see the booking details once the guest has completed the booking form.
                            </p>
                          </div>

                          {booking ? <div className="flex flex-col md:flex-row flex-wrap">
                            <div className="info-item w-1/2">
                              <label>Full name</label>
                              <p>{booking.Guest.first_name + ' ' + booking.Guest.last_name}</p>
                            </div>
                            <div className="info-item w-1/2">
                              <label>Level / Type of SCI</label>
                              <p>{booking.type_of_spinal_injury}</p>
                            </div>

                            <div className="info-item w-1/2">
                              <label>Email</label>
                              <p>{booking.Guest.email}</p>
                            </div>
                            <div className="info-item w-1/2">
                              <label>Phone</label>
                              <p>{booking.Guest.phone_number}</p>
                            </div>

                            <div className="info-item w-1/2">
                              <label>Alternate Contact Name</label>
                              <p>{booking.alternate_contact_name ? booking.alternate_contact_name : 'N/A'}</p>
                            </div>
                            <div className="info-item w-1/2">
                              <label>Alternate Contact Number</label>
                              <p>{booking.alternate_contact_number ? booking.alternate_contact_number : 'N/A'}</p>
                            </div>

                            <div className="info-item w-1/2">
                              <label>Preffered Arrival Date</label>
                              <p>{moment(booking.preferred_arrival_date).isValid() ? moment(booking.preferred_arrival_date).format('DD/MM/YYYY') : "N/A"}</p>
                            </div>
                            <div className="info-item w-1/2">
                              <label>Preferred Departure Date</label>
                              <p>{moment(booking.preferred_departure_date).isValid() ? moment(booking.preferred_departure_date).format('DD/MM/YYYY') : "N/A"}</p>
                            </div>
                          </div>
                            : null}
                        </div>
                      }

                    </div>
                    {/* <div className="sticky bottom-0 bg-white w-full border-zinc-100 border-t-8 flex">
                        <div className="py-10 pl-12 pr-36 flex justify-between w-full items-center ">
                          <button onClick={() => router.back()} className="px-8 py-2 border-2 rounded-md border-emerald-500 font-bold text-emerald-500">
                            Back
                          </button>
                          <div className="flex items-center space-x-5">
                            <div>
                              <span
                                className={`relative inline-flex rounded-full h-3 w-3 mr-2 bg-${status?.color}-400`}
                              ></span>
                              {status?.label}
                            </div>
                            {status?.name == 'pending_eligibility' && <button className="px-10 py-2 bg-emerald-500 text-white rounded-md font-bold">Approve Eligibility</button>}
                          </div>
                        </div>
                      </div> */}
                  </React.Fragment>
                ) : (
                  <React.Fragment>
                    <div className="py-12 pl-12 px-6">
                      <BookingDetailComp ref={bookingDetailsRef} booking={booking} />
                    </div>
                  </React.Fragment>
                )}
              </div>
            </div>}
          rightPanel={
            <RightPanel>
              <div className="relative p-2 xl:p-6">
                <DetailSidebar booking={booking} callback={fetchBooking} />
              </div>
            </RightPanel>} />
      )}
    </Layout>
  );
}

export default BookingDetail;