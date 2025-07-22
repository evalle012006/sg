import React, { useCallback, useContext, useEffect, useRef, useState } from "react";
import Layout from "../../components/layout";
import { useRouter } from "next/router";
import { toast } from "react-toastify";
import dynamic from 'next/dynamic';
import { useDispatch, useSelector } from "react-redux";
import { globalActions } from "../../store/globalSlice";
import _ from 'lodash';
import moment from "moment";
import { AbilityContext, Can } from "../../services/acl/can";
import { guestActions } from "../../store/guestSlice";

const SimpleTable = dynamic(() => import('../../components/ui/simpleTable'));
const MultipleUploadFile = dynamic(() => import('../../components/multiple-upload'));
const TabButton = dynamic(() => import('../../components/ui-v2/TabButton'));
const Box = dynamic(() => import('./../../components/ui/box'));
const NotesAndComments = dynamic(() => import('./notes'));
const DocumentRenameModal = dynamic(() => import('../../components/ui/document-rename-modal'));
const AdminGuestProfile = dynamic(() => import('../../components/my-profile/AdminGuestProfile'));
const GuestCourses = dynamic(() => import('../../components/guest-comp/GuestCourses'));

export default function GuestPage() {
  const router = useRouter();
  const { uuid } = router.query;
  const dispatch = useDispatch();
  const ability = useContext(AbilityContext);
  const [guest, setGuest] = useState({});
  const [bookings, setBookings] = useState([]);
  const [pastStay, setPastStay] = useState([]);
  const [upcomingStay, setUpcomingStay] = useState([]);
  
  const [selectedTab, setSelectedTab] = useState("guest-profile");

  const [healthInfo, setHealthInfo] = useState([
    {
      diagnose: "Medications recently changed",
      answer: false,
    },
    {
      diagnose: "Low blood pressure",
      answer: false,
    },
    {
      diagnose: "Autonomic Dysreflexia",
      answer: false,
    },
    {
      diagnose: "Current Pressure Injuries",
      answer: false,
    },
    {
      diagnose: "Current open wounds, cuts, abrasions or stitches",
      answer: false,
    },
    {
      diagnose: "Osteoperosis/Osteopenia",
      answer: false,
    },
    {
      diagnose: "Low bone density",
      answer: false,
    },
    {
      diagnose: "Admission to hospital in the last 3 months",
      answer: false,
    },
    {
      diagnose: "Fracture/s in the last 12 months",
      answer: false,
    },
    {
      diagnose: "Head/Brain injury or memory loss",
      answer: false,
    },
    {
      diagnose: "Respiratory complications",
      answer: false,
    },
    {
      diagnose: "Moderate to severe spasm/spasticity",
      answer: false,
    },
    {
      diagnose: "Diabetes",
      answer: false,
    },
    {
      diagnose: "Been advised by your doctor not to participate in particular actvities",
      answer: false,
    },
    {
      diagnose: "I currently require subcutaneous injections",
      answer: false,
    }
  ]);
  
  // Remove the mock courses data as it's now handled in GuestCourses component
  // const [courses, setCourses] = useState([...]);

  const [documents, setDocuments] = useState([]);
  const [approvalLetters, setApprovalLetters] = useState([]);
  const [comments, setComments] = useState([]);

  const [ndis, setNdis] = useState();
  const [icare, setIcare] = useState();
  const [healthInfoLastUpdated, setHealthInfoLastUpdated] = useState();

  const currentUser = useSelector(state => state.user.user);

  // Tab configuration for main navigation - responsive labels
  const mainTabs = [
    { label: "PROFILE", size: "medium", fullLabel: "GUEST PROFILE" },
    { label: "COURSES", size: "medium", fullLabel: "COURSES" }, 
    { label: "HEALTH", size: "medium", fullLabel: "HEALTH INFORMATION" },
    { label: "UPCOMING", size: "medium", fullLabel: "UPCOMING STAYS" },
    { label: "PAST", size: "medium", fullLabel: "PAST STAYS" },
    { label: "DOCS", size: "medium", fullLabel: "DOCUMENTS" },
    { label: "NOTES", size: "medium", fullLabel: "NOTES & COMMENTS" }
  ];

  // Remove course sub-tabs as they're now in GuestCourses component
  // const courseTabs = [...];

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

  useEffect(() => {
    if (!router.isReady) return;
    fetchGuest();
  }, [router.isReady, fetchGuest]);

  const fetchGuest = useCallback(async () => {
    dispatch(globalActions.setLoading(true));
    const response = await fetch(`/api/guests/${uuid}`);
    if (response.ok) {
      const data = await response.json();
      setGuest(data);
      if (data.Bookings && data.Bookings.length > 0) {
        setBookings(data?.Bookings.map((booking) => { return { ...booking, status: JSON.parse(booking.status) } }));
      }
      setComments(data.Comments);
      dispatch(guestActions.setData(data));
      setTimeout(() => {
        dispatch(globalActions.setLoading(false));
      }, 1000);
    }
  });

  useEffect(() => {
    if (router.isReady && uuid) {
      fetchHelthInfo();
    }
  }, [router.isReady, uuid]);

  const fetchHelthInfo = useCallback(async () => {
    const response = await fetch(`/api/bookings/history/health-info`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ uuid: uuid }),
    });

    const data = await response.json();
    let updatedHealthInfo = [...healthInfo];

    if (data?.message === "No previous booking found") {
      setHealthInfo([]);
    }

    if (data && data?.info?.length > 0) {
      setHealthInfoLastUpdated(data.lastUpdated);
      healthInfo.forEach((item, index) => {
        if (data && data.info.includes(item.diagnose)) {
          updatedHealthInfo[index].answer = true;
        }
      })
      setHealthInfo(updatedHealthInfo);
    }
  }, [uuid, setHealthInfo, healthInfo, setHealthInfoLastUpdated]);

  useEffect(() => {
    let ndisNumber = null;
    let icareNumber = null;
    const upcomingBookings = bookings.filter(booking =>
      new Date(booking.preferred_departure_date).getTime() >= new Date().getTime()
      || !booking.preferred_departure_date
      || !booking.preferred_arrival_date
    ).filter(booking =>
      booking.status.name !== 'booking_cancelled'
    ).map(booking => {
      let temp = { ...booking };
      temp.preferred_arrival_date = temp.preferred_arrival_date ? moment(temp.preferred_arrival_date).format('DD/MM/YYYY') : "";
      temp.preferred_departure_date = temp.preferred_departure_date ? moment(temp.preferred_departure_date).format('DD/MM/YYYY') : "";
      temp.sortDate = temp.check_in_date != undefined ? new Date(temp.check_in_date).getTime() : new Date(temp.preferred_arrival_date).getTime();
      temp.link = `/bookings/${booking.uuid}`;
      ndisNumber = temp.ndisNumber;
      icareNumber = temp.icareNumber;

      temp.allowDownloadEmail = booking.status.name === 'booking_confirmed';
      if (temp.allowDownloadEmail) {
        temp.downloadSummaryAction = (uuid) => handleDownloadPDF(uuid);
        temp.emailSummaryAction = (uuid) => handleEmailPDF(uuid);
      }

      return temp;
    });

    const sortedUpcomingStays = upcomingBookings.sort((a,b) => a.sortDate - b.sortDate);
    setUpcomingStay(sortedUpcomingStays);

    const pastSayBookings = bookings.filter((booking) =>
      new Date(booking.preferred_departure_date).getTime() <= new Date().getTime()
    ).filter(booking =>
      booking.status.name !== 'booking_cancelled' && booking.complete == true
    ).map(booking => {
      let temp = { ...booking };
      temp.preferred_arrival_date = moment(temp.preferred_arrival_date).format('DD/MM/YYYY');
      temp.preferred_departure_date = moment(temp.preferred_departure_date).format('DD/MM/YYYY');
      temp.sortDate = temp.check_in_date != undefined ? new Date(temp.check_in_date).getTime() : new Date(temp.preferred_arrival_date).getTime();
      temp.link = `/bookings/${booking.uuid}`;
      if (!ndisNumber) {
        ndisNumber = temp.ndisNumber;
      }
      if (!icareNumber) {
        icareNumber = temp.icareNumber;
      }
      return temp;
    });

    const sortedPastStays = pastSayBookings.sort((a,b) => a.sortDate - b.sortDate);

    setNdis(ndisNumber);
    setIcare(icareNumber);
    setPastStay(sortedPastStays);
  }, [bookings]);

  const fetchDocuments = async () => {
    dispatch(globalActions.setLoading(true));
    if (guest.id === undefined) return;
    const response = await fetch(`/api/storage/list?filePath=${'guests/' + guest.id + '/documents/'}`, {
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (response.ok) {
      const data = await response.json();
      const sortedData = [...data].sort((a, b) => {
        return new Date(b.timeCreated) - new Date(a.timeCreated);
      });

      const updatedData = sortedData.map((item) => {
        return {
          date: moment(item.timeCreated).format('DD/MM/YYYY'),
          name: item.name,
          download_link: item.download_link,
          file_path: item.file_path,
          deleteAction: () => handleDeleteDocument(item.name, item.file_path),
          renameAction: () => {
            setSelectedDocument(item);
            setRenameModalOpen(true);
          }
        };
      });

      setDocuments(updatedData);
      setTimeout(() => {
        dispatch(globalActions.setLoading(false));
      }, 1000);
    }
  };

  const handleTabChange = async (selectedTabName) => {
    switch (selectedTabName) {
      case "documents":
        fetchDocuments();
        break;
      default:
        break;
    }
    setSelectedTab(selectedTabName);
  };

  const handleDeleteDocument = (fileName, filePath) => {
    fetch(`/api/storage/upload?filename=${fileName}&filepath=${filePath}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
    }).then(() => {
      toast("Document deleted successfully", { type: "success" });
      fetchDocuments();
    });
  }

  const [renameModalOpen, setRenameModalOpen] = useState(false);
  const [selectedDocument, setSelectedDocument] = useState(null);

  const handleRenameDocument = async (oldName, newName, filePath) => {
    if (oldName == newName) return;
    
    const response = await fetch('/api/storage/rename', {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            oldFilename: oldName,
            newFilename: newName,
            filepath: filePath
        })
    });
  
    if (response.ok) {
      toast.success('Document renamed successfully');
      fetchDocuments();
    } else {
      toast.error('Failed to rename document');
    }
  };

  // Remove the course-related functions as they're now in GuestCourses component
  // const getFilteredCourses = () => { ... };
  // const renderCourseCard = (course) => { ... };

  return (
    <Layout hideTitleBar={true}>
      <div className="relative px-4 py-2 sm:p-4 lg:p-10 w-full">
        {/* Breadcrumb */}
        <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6 overflow-x-auto">
          <button 
            onClick={() => router.push('/guests')}
            className="hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
            </svg>
          </button>
          <button 
            onClick={() => router.push('/guests')}
            className="font-medium text-blue-600 hover:text-blue-800 transition-colors whitespace-nowrap"
          >
            GUEST LIST
          </button>
          <span>/</span>
          <span className="font-medium truncate">{guest.first_name ? `${guest.first_name.toUpperCase()} ${guest.last_name.toUpperCase()}` : 'LOADING...'}</span>
        </div>

        <div className="main-content">
          {/* Main Navigation Tabs */}
          <div className="mb-4 sm:mb-6">
            <TabButton
              tabs={mainTabs}
              onChange={(index) => {
                const tabNames = ["guest-profile", "courses", "health-information", "upcoming-stays", "past-stays", "documents", "notes-and-comments"];
                const selectedTabName = tabNames[index];
                setSelectedTab(selectedTabName);
                handleTabChange(selectedTabName);
              }}
              type="outline"
            />
          </div>

          {/* Remove course sub-tabs as they're now handled in GuestCourses component */}

          <div className="">
            {selectedTab === "guest-profile" && (
              <div>
                <AdminGuestProfile />
              </div>
            )}

            {/* Replace the courses section with the new GuestCourses component */}
            {selectedTab === "courses" && (
              <GuestCourses guest={guest} />
            )}

            {selectedTab === "health-information" && (
              <div>
                <div className="flex flex-col sm:flex-row sm:justify-between py-6 sm:py-10 space-y-2 sm:space-y-0">
                  <h1 className="text-lg sm:text-xl font-bold">Health Information</h1>
                  <p className="text-zinc-400 font-bold text-sm sm:text-base">
                    <span>Last Update: {moment(healthInfoLastUpdated).format('DD/MM/YYYY')}</span>
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 sm:p-6 lg:p-10 rounded-2xl bg-slate-400 font-bold">
                  <div className="flex flex-col sm:flex-row sm:items-center text-neutral-700 space-y-2 sm:space-y-0">
                    <p className="text-sm sm:text-base">NDIS participant #</p>
                    <p className={`h-fit w-full sm:w-fit bg-white p-2 px-4 sm:px-8 rounded-md sm:ml-6 text-center ${!ndis && 'sm:w-40'}`}>
                      {ndis ? ndis : 'N/A'}
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center text-neutral-700 space-y-2 sm:space-y-0">
                    <p className="text-sm sm:text-base">iCare participant #</p>
                    <p className={`h-fit w-full sm:w-fit bg-white p-2 px-4 sm:px-8 rounded-md sm:ml-6 text-center ${!icare && 'sm:w-40'}`}>
                      {icare ? icare : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="mt-4">
                  {healthInfo.length > 0 ? <div>
                    <div className="hidden sm:flex sm:justify-between">
                      <p className="p-4 font-bold">Description</p>
                      <div className="flex justify-between">
                        <p className="p-4 font-bold">Last Stay</p>
                      </div>
                    </div>
                    {healthInfo.map((health, index) =>
                      <Box key={index} bg={(index % 2) !== 0 && 'bg-white'}>
                        <div className="flex flex-col sm:flex-row sm:justify-between space-y-2 sm:space-y-0">
                          <div className="sm:max-w-[50%]">
                            <p className="text-sm sm:text-base font-medium sm:font-normal">{health.diagnose}</p>
                          </div>
                          <div className="flex justify-start sm:justify-between">
                            <p className={`font-bold text-sm sm:text-base ${health.answer ? 'text-emerald-400' : 'text-red-500'}`}>
                              {health.answer ? 'Yes' : 'No'}
                            </p>
                          </div>
                        </div>
                      </Box>)}
                  </div> : <div className="bg-yellow-100 rounded-lg py-5 px-6 mb-4 text-base" role="alert">
                    <h4 className="text-lg font-medium leading-tight mb-2">No health information to show.</h4>
                  </div>}
                </div>
              </div>
            )}

            {selectedTab === "upcoming-stays" && (
              <div>
                <h1 className="text-lg sm:text-xl font-bold my-6 sm:my-8">Upcoming Stays</h1>
                <div className="mt-6 sm:mt-10 overflow-x-auto">
                  {upcomingStay.length > 0 ? <SimpleTable
                    columns={[
                      { label: "Type", attribute: "type" },
                      { label: "Check-in", attribute: "preferred_arrival_date" },
                      { label: "Check-out", attribute: "preferred_departure_date" },
                      { label: "Status", attribute: "status.label" },
                    ]}
                    data={upcomingStay}
                    options={{ hasViewOption: true, hasDownloadStayOption: true, hasSendEmailStayOption: true }}
                    actions={true}
                  /> : <p className="text-center py-8">No upcoming stays</p>}
                </div>
              </div>
            )}

            {selectedTab === "past-stays" && (
              <div>
                <h1 className="text-lg sm:text-xl font-bold my-6 sm:my-8">Past Stays</h1>
                <div className="mt-6 sm:mt-10 overflow-x-auto">
                  {pastStay.length > 0 ? <SimpleTable
                    columns={[
                      { label: "Type", attribute: "type" },
                      { label: "Check-in", attribute: "preferred_arrival_date" },
                      { label: "Check-out", attribute: "preferred_departure_date" },
                      { label: "Status", attribute: "status.label" },
                    ]}
                    data={pastStay}
                    options={{ hasViewOption: true }}
                    actions={true}
                  /> : <p className="text-center py-8">No past stays</p>}
                </div>
              </div>
            )}

            {selectedTab === "documents" && (
              <div>
                <div className="mt-6 sm:mt-10 overflow-x-auto">
                  <SimpleTable
                    columns={[
                      { label: "Date", attribute: "date" },
                      { label: "name", attribute: "name" },
                    ]}
                    data={documents}
                    options={{ hasDownloadLink: true, hasDeleteOption: true, hasRenameOption: true  }}
                    actions={true}
                  />
                </div>

                <div className="mt-6 sm:mt-10">
                  <Can I="Create/Edit" a="Guest">
                    <h3 className="font-bold mb-4">Upload Documents</h3>
                    {guest && <MultipleUploadFile fileType={'guests/' + guest.id + '/documents/'}
                      metadata={{ guest_id: guest.id, }}
                      onUpload={(url) => { fetchDocuments() }} />}
                  </Can>
                </div>
              </div>
            )}

            {selectedTab === "notes-and-comments" && (
              <div>
                <NotesAndComments guest={guest} comments={comments} />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {renameModalOpen && selectedDocument && (
        <DocumentRenameModal
          isOpen={renameModalOpen}
          onClose={() => {
            setRenameModalOpen(false);
            setSelectedDocument(null);
          }}
          currentName={selectedDocument.name}
          onRename={(newName) => 
            handleRenameDocument(selectedDocument.name, newName, selectedDocument.file_path)
          }
        />
      )}
    </Layout>
  );
}