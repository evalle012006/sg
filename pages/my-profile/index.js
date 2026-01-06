import React, { useEffect, useState, useContext, useCallback } from "react";
import dynamic from 'next/dynamic';
import { globalActions } from "../../store/globalSlice";
import { useDispatch, useSelector } from "react-redux";
import { toast } from "react-toastify";
import { ChevronLeft, Eye, Download } from "lucide-react";
import { useRouter } from "next/router";
import { AbilityContext } from "../../services/acl/can";
import { guestActions } from "../../store/guestSlice";
import moment from 'moment';

const Layout = dynamic(() => import('../../components/layout'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const TabButton = dynamic(() => import('../../components/ui-v2/TabButton'));
const GuestProfileTab = dynamic(() => import('../../components/my-profile/GuestProfileTab'));
const HealthInformation = dynamic(() => import('../../components/guests/HealthInformation'));
const FundingApprovalsReadOnly = dynamic(() => import('../../components/my-profile/FundingApprovalsReadOnly'));
const StatusBadge = dynamic(() => import('../../components/ui-v2/StatusBadge'));

export default function GuestProfilePage() {
    const dispatch = useDispatch();
    const router = useRouter();
    const currentUser = useSelector((state) => state.user.user);
    
    const [loading, setLoading] = useState(true);
    const [guest, setGuest] = useState({});
    const [selectedTab, setSelectedTab] = useState("profile");
    
    // Health info state
    const [healthInfo, setHealthInfo] = useState([]);
    const [healthInfoLastUpdated, setHealthInfoLastUpdated] = useState(null);
    const [ndis, setNdis] = useState(null);
    const [icare, setIcare] = useState(null);

    const isGuestUser = currentUser?.type === 'guest';

    const handleBack = () => {
        if (window.history.length > 1) {
            router.back();
        } else {
            router.push('/bookings');
        }
    };

    // Tab configuration - same as admin but with "Profile" label
    const mainTabs = [
        { label: "PROFILE", size: "medium", fullLabel: "PROFILE" },
        // { label: "HEALTH", size: "medium", fullLabel: "HEALTH INFORMATION" },
        // { label: "FUNDING", size: "medium", fullLabel: "FUNDING APPROVALS" }
    ];

    // Fetch guest data - same as admin GuestPage
    const fetchGuest = useCallback(async () => {
        if (!currentUser?.uuid) return;
        
        dispatch(globalActions.setLoading(true));
        try {
            const response = await fetch(`/api/guests/${currentUser.uuid}`);
            if (response.ok) {
                const data = await response.json();
                setGuest(data);
                
                // Process bookings
                // if (data.Bookings && data.Bookings.length > 0) {
                //     const processedBookings = data.Bookings.map((booking) => ({ 
                //         ...booking, 
                //         status: typeof booking.status === 'string' ? JSON.parse(booking.status) : booking.status 
                //     }));
                //     setBookings(processedBookings);
                    
                //     // Separate upcoming and past stays
                //     const now = moment();
                //     const upcoming = processedBookings.filter(b => moment(b.check_in_date).isAfter(now) || moment(b.check_out_date).isAfter(now));
                //     const past = processedBookings.filter(b => moment(b.check_out_date).isBefore(now));
                    
                //     setUpcomingStay(upcoming);
                //     setPastStay(past);
                // }
                
                // Set comments
                
                // Store guest in Redux
                dispatch(guestActions.setData(data));
            }
        } catch (error) {
            console.error('Error loading guest data:', error);
            toast.error('Failed to load profile data');
        } finally {
            setLoading(false);
            dispatch(globalActions.setLoading(false));
        }
    }, [currentUser?.uuid, dispatch]);

    // Fetch health information - same as admin GuestPage
    const fetchHealthInfo = useCallback(async () => {
        if (!currentUser?.uuid) return;
        
        try {
            const response = await fetch('/api/bookings/history/health-info', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uuid: currentUser.uuid })
            });
            
            if (response.ok) {
                const data = await response.json();
                setHealthInfo(data.info || []);
                setHealthInfoLastUpdated(data.lastUpdated);
                setNdis(data.ndis_participant_number);
                setIcare(data.icare_participant_number);
            }
        } catch (error) {
            console.error('Error loading health info:', error);
        }
    }, [currentUser?.uuid]);

    // Fetch documents - same as admin GuestPage
    // const fetchDocuments = useCallback(async () => {
    //     if (!guest?.id) return;
        
    //     dispatch(globalActions.setLoading(true));
    //     try {
    //         const response = await fetch(`/api/storage/list?filePath=guests/${guest.id}/documents/`, {
    //             headers: { "Content-Type": "application/json" },
    //         });

    //         if (response.ok) {
    //             const data = await response.json();
    //             const sortedData = [...data].sort((a, b) => {
    //                 return new Date(b.timeCreated) - new Date(a.timeCreated);
    //             });

    //             const updatedData = sortedData.map((item) => ({
    //                 date: moment(item.timeCreated).format('DD MMM, YYYY'),
    //                 name: item.name,
    //                 download_link: item.download_link,
    //                 file_path: item.file_path,
    //                 _raw: item
    //             }));

    //             setDocuments(updatedData);
    //         }
    //     } catch (error) {
    //         console.error('Error loading documents:', error);
    //     } finally {
    //         dispatch(globalActions.setLoading(false));
    //     }
    // }, [guest?.id, dispatch]);

    // Initial data load
    useEffect(() => {
        if (currentUser?.uuid) {
            fetchGuest();
            fetchHealthInfo();
        }
    }, [currentUser?.uuid, fetchGuest, fetchHealthInfo]);

    // Fetch documents when guest is loaded
    // useEffect(() => {
    //     if (guest?.id) {
    //         fetchDocuments();
    //     }
    // }, [guest?.id, fetchDocuments]);

    // Handle tab changes
    const handleTabChange = (tabName) => {
        setSelectedTab(tabName);
        // if (tabName === 'documents') {
        //     fetchDocuments();
        // }
    };

    // Get file type helper
    const getFileType = (filename) => {
        if (!filename) return 'other';
        const extension = filename.split('.').pop().toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension)) return 'image';
        if (extension === 'pdf') return 'pdf';
        return 'other';
    };

    // Get file icon helper
    const getFileIcon = (filename) => {
        const fileType = getFileType(filename);
        const iconClass = 'w-5 h-5 mr-2';
        
        switch (fileType) {
            case 'image':
                return (
                    <svg className={`${iconClass} text-green-600`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                    </svg>
                );
            case 'pdf':
                return (
                    <svg className={`${iconClass} text-red-600`} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
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

    // Handle view document
    const handleViewDocument = (document) => {
        const fileType = getFileType(document.name);
        
        if (fileType === 'image' || fileType === 'pdf') {
            setSelectedDocumentForView(document);
            setDocumentViewModalOpen(true);
        } else {
            window.open(document.download_link, '_blank');
        }
    };

    // Document columns for table
    const documentsColumns = [
        {
            key: 'name',
            label: 'NAME',
            searchable: true,
            render: (value) => (
                <div className="flex items-center">
                    {getFileIcon(value)}
                    <span className="truncate">{value}</span>
                </div>
            )
        },
        {
            key: 'date',
            label: 'DATE',
            searchable: false
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
                    {document.download_link && (
                        <a
                            href={document.download_link}
                            download
                            className="p-1 text-green-600 hover:text-green-800 transition-colors"
                            title="Download"
                        >
                            <Download size={16} />
                        </a>
                    )}
                </div>
            )
        }
    ];

    // Get status display for bookings
    const getBookingStatus = (booking) => {
        const status = booking.status;
        if (!status) return { label: 'Unknown', type: 'default' };
        
        // Handle different status formats
        if (typeof status === 'object') {
            if (status.confirmed) return { label: 'Confirmed', type: 'success' };
            if (status.pending_confirmation) return { label: 'Pending', type: 'warning' };
            if (status.guest_cancelled) return { label: 'Cancelled', type: 'error' };
        }
        
        return { label: 'Pending', type: 'warning' };
    };

    // Booking columns for stays tables
    const staysColumns = [
        {
            key: 'id',
            label: 'BOOKING #',
            searchable: true,
            render: (value, booking) => (
                <span className="font-medium text-blue-600">#{value}</span>
            )
        },
        {
            key: 'check_in_date',
            label: 'CHECK IN',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">
                    {value ? moment(value).format('DD MMM, YYYY') : '-'}
                </span>
            )
        },
        {
            key: 'check_out_date',
            label: 'CHECK OUT',
            searchable: false,
            render: (value) => (
                <span className="text-gray-600">
                    {value ? moment(value).format('DD MMM, YYYY') : '-'}
                </span>
            )
        },
        {
            key: 'status',
            label: 'STATUS',
            searchable: false,
            render: (value, booking) => {
                const statusInfo = getBookingStatus(booking);
                return (
                    <StatusBadge
                        type={statusInfo.type}
                        label={statusInfo.label}
                        size="small"
                    />
                );
            }
        }
    ];

    if (loading) {
        return (
            <Layout hideTitleBar={true}>
                <div className="flex items-center justify-center min-h-screen">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout hideTitleBar={true} hideSidebar={true}>
            <div className="relative px-4 py-2 sm:p-4 lg:p-10 w-full">
                {/* Header with Back Button */}
                <div className="flex items-center space-x-2 text-xs sm:text-sm text-gray-600 mb-4 sm:mb-6">
                    <button
                        onClick={handleBack}
                        className="flex items-center text-blue-600 hover:text-blue-800 transition-colors"
                    >
                        <ChevronLeft className="w-4 h-4 mr-1" />
                        <span>Back</span>
                    </button>
                    <span>/</span>
                    <span className="font-medium">MY PROFILE</span>
                </div>

                <div className="main-content">
                    {/* Main Navigation Tabs */}
                    <div className="mb-4 sm:mb-6">
                        <TabButton
                            tabs={mainTabs}
                            onChange={(index) => {
                                const tabNames = ["profile", "health-information", "funding-approvals"];
                                const selectedTabName = tabNames[index];
                                setSelectedTab(selectedTabName);
                                handleTabChange(selectedTabName);
                            }}
                            type="outline"
                        />
                    </div>

                    <div className="">
                        {/* Profile Tab */}
                        {selectedTab === "profile" && (
                            <div>
                                <GuestProfileTab isGuestUser={isGuestUser} />
                            </div>
                        )}

                        {/* Health Information Tab */}
                        {/* {selectedTab === "health-information" && (
                            <HealthInformation 
                                healthInfo={healthInfo}
                                healthInfoLastUpdated={healthInfoLastUpdated}
                                ndis={ndis}
                                icare={icare}
                            />
                        )} */}

                        {/* Funding Approvals Tab - Read Only for guests */}
                        {/* {selectedTab === "funding-approvals" && (
                            <div>
                                <FundingApprovalsReadOnly uuid={currentUser?.uuid} />
                            </div>
                        )} */}
                    </div>
                </div>
            </div>
        </Layout>
    );
}