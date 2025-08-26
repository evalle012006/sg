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
import HealthInformation from "../../components/guests/HealthInformation";
import { Eye, Edit, Trash2, Download, Mail } from 'lucide-react';

const Table = dynamic(() => import('../../components/ui-v2/Table'));
const StatusBadge = dynamic(() => import('../../components/ui-v2/StatusBadge'));
const MultipleUploadFile = dynamic(() => import('../../components/multiple-upload'));
const TabButton = dynamic(() => import('../../components/ui-v2/TabButton'));
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
  
  const [documents, setDocuments] = useState([]);
  const [approvalLetters, setApprovalLetters] = useState([]);
  const [comments, setComments] = useState([]);

  const [ndis, setNdis] = useState();
  const [icare, setIcare] = useState();
  const [healthInfoLastUpdated, setHealthInfoLastUpdated] = useState();

  const currentUser = useSelector(state => state.user.user);

  const [documentViewModalOpen, setDocumentViewModalOpen] = useState(false);
  const [selectedDocumentForView, setSelectedDocumentForView] = useState(null);

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
      setNdis(null);
      setIcare(null);
      setHealthInfoLastUpdated(null);
      return;
    }

    if (data) {
      // Set health information
      if (data.info && data.info.length > 0) {
        setHealthInfoLastUpdated(data.lastUpdated);
        // Reset all answers to false first
        updatedHealthInfo = healthInfo.map(item => ({ ...item, answer: false }));
        
        // Set answered conditions to true
        updatedHealthInfo.forEach((item, index) => {
          if (data.info.includes(item.diagnose)) {
            updatedHealthInfo[index].answer = true;
          }
        });
        setHealthInfo(updatedHealthInfo);
      } else {
        // No health conditions reported, set all to false
        updatedHealthInfo = healthInfo.map(item => ({ ...item, answer: false }));
        setHealthInfo(updatedHealthInfo);
        setHealthInfoLastUpdated(data.lastUpdated);
      }

      // Set participant numbers from API response
      setNdis(data.ndis_participant_number || null);
      setIcare(data.icare_participant_number || null);
    }
  }, [uuid, healthInfo, setHealthInfo, setHealthInfoLastUpdated, setNdis, setIcare]);

  // Helper function to get status badge type based on booking status
  const getStatusBadgeType = (statusName) => {
    const statusLower = statusName?.toLowerCase();
    
    if (statusLower === 'booking_confirmed') return 'success';
    if (statusLower === 'booking_pending') return 'pending';
    if (statusLower === 'booking_cancelled') return 'error';
    if (statusLower === 'booking_draft') return 'draft';
    
    return 'primary';
  };

  useEffect(() => {
    const upcomingBookings = bookings.filter(booking =>
      new Date(booking.preferred_departure_date).getTime() >= new Date().getTime()
      || !booking.preferred_departure_date
      || !booking.preferred_arrival_date
    ).filter(booking =>
      booking.status.name !== 'booking_cancelled'
    ).map(booking => {
      let temp = { ...booking };
      temp.check_in = temp.preferred_arrival_date ? moment(temp.preferred_arrival_date).format('DD MMM, YYYY') : "";
      temp.check_out = temp.preferred_departure_date ? moment(temp.preferred_departure_date).format('DD MMM, YYYY') : "";
      temp.sortDate = temp.check_in_date != undefined ? new Date(temp.check_in_date).getTime() : new Date(temp.preferred_arrival_date).getTime();
      temp.link = `/bookings/${booking.uuid}`;

      temp.allowDownloadEmail = booking.status.name === 'booking_confirmed';
      
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
      temp.check_in = moment(temp.preferred_arrival_date).format('DD MMM, YYYY');
      temp.check_out = moment(temp.preferred_departure_date).format('DD MMM, YYYY');
      temp.sortDate = temp.check_in_date != undefined ? new Date(temp.check_in_date).getTime() : new Date(temp.preferred_arrival_date).getTime();
      temp.link = `/bookings/${booking.uuid}`;
      return temp;
    });

    const sortedPastStays = pastSayBookings.sort((a,b) => a.sortDate - b.sortDate);
    setPastStay(sortedPastStays);
  }, [bookings]);

  const getFileType = (fileName) => {
    const extension = fileName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(extension)) {
      return 'image';
    } else if (extension === 'pdf') {
      return 'pdf';
    } else if (['doc', 'docx'].includes(extension)) {
      return 'document';
    } else if (['xls', 'xlsx'].includes(extension)) {
      return 'spreadsheet';
    } else if (['txt', 'csv'].includes(extension)) {
      return 'text';
    } else if (['zip', 'rar', '7z'].includes(extension)) {
      return 'archive';
    }
    return 'other';
  };

  const getFileIcon = (fileName) => {
    const fileType = getFileType(fileName);
    const iconClass = "w-5 h-5 mr-3 flex-shrink-0";
    
    switch (fileType) {
      case 'image':
        return (
          <svg className={`${iconClass} text-blue-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
          </svg>
        );
      case 'pdf':
        return (
          <svg className={`${iconClass} text-red-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'document':
        return (
          <svg className={`${iconClass} text-blue-600`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
            <path fillRule="evenodd" d="M3 8a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
          </svg>
        );
      case 'spreadsheet':
        return (
          <svg className={`${iconClass} text-green-600`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
        );
      case 'text':
        return (
          <svg className={`${iconClass} text-gray-600`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 11-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12zm-9 7a1 1 0 112 0v1.586l2.293-2.293a1 1 0 111.414 1.414L6.414 15H8a1 1 0 110 2H4a1 1 0 01-1-1v-4zm13-1a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 110-2h1.586l-2.293-2.293a1 1 0 111.414-1.414L15.586 13V12a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
        );
      case 'archive':
        return (
          <svg className={`${iconClass} text-yellow-600`} fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 000 2h1.084l.371 7.428A2 2 0 006.456 15h7.088a2 2 0 002.001-1.572L16.916 6H18a1 1 0 100-2H3zM6.5 9a.5.5 0 01.5-.5h6a.5.5 0 010 1H7a.5.5 0 01-.5-.5z" />
          </svg>
        );
      default:
        return (
          <svg className={`${iconClass} text-gray-500`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  const handleViewDocument = (document) => {
    const fileType = getFileType(document.name);
    
    if (fileType === 'image' || fileType === 'pdf') {
      setSelectedDocumentForView(document);
      setDocumentViewModalOpen(true);
    } else {
      // For other file types, open in new tab or download
      window.open(document.download_link, '_blank');
    }
  };

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
          date: moment(item.timeCreated).format('DD MMM, YYYY'),
          name: item.name,
          download_link: item.download_link,
          file_path: item.file_path,
          // These properties will be used in the action column
          _raw: item // Store raw data for actions
        };
      });

      setDocuments(updatedData);
      setTimeout(() => {
        dispatch(globalActions.setLoading(false));
      }, 1000);
    }
  };

  const documentsColumns = [
    {
      key: 'name',
      label: 'NAME',
      render: (value, document) => (
        <div className="flex items-center">
          {getFileIcon(value)}
          <span className="truncate">{value}</span>
        </div>
      )
    },
    {
      key: 'date',
      label: 'DATE'
    },
    {
      key: 'action',
      label: 'ACTION',
      searchable: false,
      render: (value, document) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => handleViewDocument(document)}
            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
            title="View Document"
          >
            <Eye size={16} />
          </button>
          <Can I="Create/Edit" a="Guest">
            <button
              onClick={() => {
                setSelectedDocument(document._raw);
                setRenameModalOpen(true);
              }}
              className="p-1 text-yellow-600 hover:text-yellow-800 transition-colors"
              title="Rename Document"
            >
              <Edit size={16} />
            </button>
            <button
              onClick={() => handleDeleteDocument(document.name, document.file_path)}
              className="p-1 text-red-600 hover:text-red-800 transition-colors"
              title="Delete Document"
            >
              <Trash2 size={16} />
            </button>
          </Can>
        </div>
      )
    }
  ];

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

  // Define columns for upcoming stays table
  const upcomingStaysColumns = [
    {
      key: 'type',
      label: 'TYPE',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'check_in',
      label: 'CHECK-IN'
    },
    {
      key: 'check_out',
      label: 'CHECK-OUT'
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <div style={{ maxWidth: '150px' }}>
          <StatusBadge 
            type={getStatusBadgeType(value.name)}
            label={value.label}
            size="small"
          />
        </div>
      )
    },
    {
      key: 'action',
      label: 'ACTION',
      searchable: false,
      render: (value, booking) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push(booking.link)}
            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
            title="View Details"
          >
            <Eye size={16} />
          </button>
          {booking.allowDownloadEmail && (
            <>
              <button
                onClick={() => handleDownloadPDF(booking.uuid)}
                className="p-1 text-green-600 hover:text-green-800 transition-colors"
                title="Download Summary"
              >
                <Download size={16} />
              </button>
              <button
                onClick={() => handleEmailPDF(booking.uuid)}
                className="p-1 text-purple-600 hover:text-purple-800 transition-colors"
                title="Email Summary"
              >
                <Mail size={16} />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  // Define columns for past stays table
  const pastStaysColumns = [
    {
      key: 'type',
      label: 'TYPE',
      render: (value) => <span className="font-medium">{value}</span>
    },
    {
      key: 'check_in',
      label: 'CHECK-IN'
    },
    {
      key: 'check_out',
      label: 'CHECK-OUT'
    },
    {
      key: 'status',
      label: 'STATUS',
      render: (value) => (
        <div style={{ maxWidth: '150px' }}>
          <StatusBadge 
            type={getStatusBadgeType(value.name)}
            label={value.label}
            size="small"
          />
        </div>
      )
    },
    {
      key: 'action',
      label: 'ACTION',
      searchable: false,
      render: (value, booking) => (
        <div className="flex items-center space-x-2">
          <button
            onClick={() => router.push(booking.link)}
            className="p-1 text-blue-600 hover:text-blue-800 transition-colors"
            title="View Details"
          >
            <Eye size={16} />
          </button>
        </div>
      )
    }
  ];

  // Empty state component for upcoming stays
  const UpcomingStaysEmptyState = () => (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mb-4">
        <svg 
          className="w-16 h-16 text-gray-300" 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-800 mb-2">UPCOMING STAYS</h3>
      <p className="text-gray-500 text-center">
        No upcoming stays yet, we'll list them here when they're booked.
      </p>
    </div>
  );

  const DocumentViewerModal = ({ isOpen, onClose, document }) => {
    if (!isOpen || !document) return null;

    const fileType = getFileType(document.name);

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-6xl max-h-[90vh] w-full overflow-hidden">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h3 className="text-lg font-medium truncate mr-4">{document.name}</h3>
            <div className="flex items-center space-x-2">
              <a
                href={document.download_link}
                download
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Download
              </a>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="p-4 max-h-[calc(90vh-80px)] overflow-auto">
            {fileType === 'image' && (
              <img
                src={document.download_link}
                alt={document.name}
                className="max-w-full h-auto mx-auto"
                style={{ maxHeight: 'calc(90vh - 150px)' }}
              />
            )}
            
            {fileType === 'pdf' && (
              <iframe
                src={document.download_link}
                className="w-full border-0"
                style={{ height: 'calc(90vh - 150px)' }}
                title={document.name}
              />
            )}
            
            {fileType !== 'image' && fileType !== 'pdf' && (
              <div className="text-center py-8">
                <div className="mb-4">
                  {getFileIcon(document.name)}
                </div>
                <p className="text-gray-600 mb-4">
                  Preview not available for this file type.
                </p>
                <a
                  href={document.download_link}
                  download
                  className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  <Download size={16} className="mr-2" />
                  Download File
                </a>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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

          <div className="">
            {selectedTab === "guest-profile" && (
              <div>
                <AdminGuestProfile />
              </div>
            )}

            {selectedTab === "courses" && (
              <GuestCourses guest={guest} />
            )}

            {selectedTab === "health-information" && (
              <HealthInformation 
                healthInfo={healthInfo}
                healthInfoLastUpdated={healthInfoLastUpdated}
                ndis={ndis}
                icare={icare}
              />
            )}

            {selectedTab === "upcoming-stays" && (
              <div>
                {upcomingStay.length > 0 ? (
                  <div className="mt-6 sm:mt-10">
                    <Table
                      title={`Upcoming Stays (${upcomingStay.length})`}
                      columns={upcomingStaysColumns}
                      data={upcomingStay}
                      itemsPerPage={10}
                      searchable={true}
                    />
                  </div>
                ) : (
                  <UpcomingStaysEmptyState />
                )}
              </div>
            )}

            {selectedTab === "past-stays" && (
              <div>
                {pastStay.length > 0 ? (
                  <div className="mt-6 sm:mt-10">
                    <Table
                      title={`Past Stays (${pastStay.length})`}
                      columns={pastStaysColumns}
                      data={pastStay}
                      itemsPerPage={10}
                      searchable={true}
                    />
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-16 px-4">
                    <div className="mb-4">
                      <svg 
                        className="w-16 h-16 text-gray-300" 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path 
                          strokeLinecap="round" 
                          strokeLinejoin="round" 
                          strokeWidth={1.5}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">PAST STAYS</h3>
                    <p className="text-gray-500 text-center">
                      No past stays to display.
                    </p>
                  </div>
                )}
              </div>
            )}

            {selectedTab === "documents" && (
              <div>
                {/* Upload Area */}
                <div className="mb-6">
                  <Can I="Create/Edit" a="Guest">
                    {guest && <MultipleUploadFile 
                      fileType={'guests/' + guest.id + '/documents/'}
                      metadata={{ guest_id: guest.id }}
                      onUpload={(url) => { fetchDocuments() }} 
                    />}
                  </Can>
                </div>

                {/* Documents Table */}
                <div className="overflow-x-auto">
                  <Table
                    title={`Documents (${documents.length})`}
                    columns={documentsColumns}
                    data={documents}
                    itemsPerPage={10}
                    searchable={true}
                  />
                </div>

                {/* Document Viewer Modal */}
                <DocumentViewerModal
                  isOpen={documentViewModalOpen}
                  onClose={() => {
                    setDocumentViewModalOpen(false);
                    setSelectedDocumentForView(null);
                  }}
                  document={selectedDocumentForView}
                />
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