import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2, Users, Calendar, List } from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';
import { formatAUD } from '../../utilities/priceUtil';

const Layout = dynamic(() => import('../../components/layout'));
const Table = dynamic(() => import('../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const StatusBadge = dynamic(() => import('../../components/ui-v2/StatusBadge'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const CourseForm = dynamic(() => import('../../components/courses/CourseForm'));
const CourseOfferForm = dynamic(() => import('../../components/courses/CourseOfferForm'));
const TabButton = dynamic(() => import('../../components/ui-v2/TabButton'));
const CourseOffers = dynamic(() => import('../../components/courses/CourseOffers'));
const CalendarView = dynamic(() => import('../../components/courses/CalendarView'));
const CourseRates = dynamic(() => import('../../components/courses/CourseRates'));

export default function ManageCourses() {
    const router = useRouter();
    const { mode, id, selectedTab: urlSelectedTab, courseId } = router.query;
    
    // Determine current view mode - include offer modes
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view' || 
                       mode === 'offer-add' || mode === 'offer-edit' || mode === 'offer-view';
    
    // Tab state management - initialize from URL or default to courses
    const [selectedTab, setSelectedTab] = useState(urlSelectedTab || "courses");
    
    // View mode state - table or calendar
    const [viewMode, setViewMode] = useState('table');
    
    // Courses state
    const [courses, setCourses] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedCourse, setSelectedCourse] = useState(null);
    const [deleteWarning, setDeleteWarning] = useState(null);

    // Course rates state
    const [courseRates, setCourseRates] = useState([]);

    // Tab configuration
    const mainTabs = [
        { label: "COURSES", size: "medium", fullLabel: "COURSES" },
        { label: "OFFERS", size: "medium", fullLabel: "COURSE OFFERS" },
        { label: "RATES", size: "medium", fullLabel: "COURSE RATES" }
    ];

    // Update selectedTab when URL changes
    useEffect(() => {
        if (urlSelectedTab && urlSelectedTab !== selectedTab) {
            setSelectedTab(urlSelectedTab);
        } else if (!urlSelectedTab && selectedTab !== "courses") {
            // If no selectedTab in URL, default to courses
            setSelectedTab("courses");
        }
    }, [urlSelectedTab, selectedTab]);

    // Load course rates
    useEffect(() => {
        loadCourseRates();
    }, []);

    useEffect(() => {
        if (!isFormMode && selectedTab === "courses") {
            loadCourses();
        }
    }, [isFormMode, selectedTab]);

    // Load course rates function
    const loadCourseRates = async () => {
        try {
            const response = await fetch('/api/courses/rates');
            if (response.ok) {
                const result = await response.json();
                setCourseRates(result.data || []);
            }
        } catch (error) {
            console.error('Error loading course rates:', error);
        }
    };

    // Helper function to format dates in Australian format
    const formatAustralianDate = (dateString) => {
        if (!dateString) return null;
        const date = moment(dateString);
        return date.isValid() ? date.format('DD/MM/YYYY') : null;
    };

    // Helper function to format date ranges
    const formatDateRange = (startDate, endDate) => {
        const formattedStart = formatAustralianDate(startDate);
        const formattedEnd = formatAustralianDate(endDate);
        
        if (formattedStart && formattedEnd) {
            return `${formattedStart} - ${formattedEnd}`;
        }
        return 'TBD';
    };

    // Helper function to check if course can be offered to guests
    const canOfferCourse = (course) => {
        if (course.status !== 'active') return false;
        
        const now = moment();
        const courseStartDate = moment(course.start_date);
        return courseStartDate.isAfter(now);
    };

    // Load courses list with stored pricing
    const loadCourses = async () => {
        setIsListLoading(true);
        try {
            const response = await fetch('/api/courses/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            const courseList = [];
            const responseData = result.courses || result;
            
            if (Array.isArray(responseData)) {
                // Process courses - use stored prices instead of calculating
                responseData.forEach(course => {
                    let temp = { ...course };
                    
                    // Format date range using Australian format
                    temp.dateRange = formatDateRange(temp.start_date, temp.end_date);
                    temp.minDateRange = formatDateRange(temp.min_start_date, temp.min_end_date);
                    
                    // Use stored pricing
                    if (course.holiday_price !== null && course.sta_price !== null) {
                        temp.formattedHolidayPrice = formatAUD(parseFloat(course.holiday_price));
                        temp.formattedSTAPrice = formatAUD(parseFloat(course.sta_price));
                        temp.pricingCalculated = true;
                        temp.priceCalculatedAt = course.price_calculated_at;
                    } else {
                        // No stored pricing available
                        temp.formattedHolidayPrice = course.start_date && course.end_date ? 'Not calculated' : 'Set dates first';
                        temp.formattedSTAPrice = course.start_date && course.end_date ? 'Not calculated' : 'Set dates first';
                        temp.pricingCalculated = false;
                    }
                    
                    // Check if course can be offered
                    temp.canOffer = canOfferCourse(temp);
                    
                    courseList.push(temp);
                });
            }
            
            setCourses(courseList);
        } catch (error) {
            console.error('Error loading courses:', error);
            toast.error('Failed to load courses. Please try again later.');
        }
        setIsListLoading(false);
    };

    // Navigation functions
    const showList = () => {
        router.push('/courses', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/courses?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (course) => {
        router.push(`/courses?mode=edit&id=${course.id}`, undefined, { shallow: true });
    };

    const showViewForm = (course) => {
        router.push(`/courses?mode=view&id=${course.id}`, undefined, { shallow: true });
    };

    // New navigation functions for offer forms
    const showOfferForm = (course) => {
        router.push(`/courses?mode=offer-add&courseId=${course.id}`, undefined, { shallow: true });
    };

    const showEditOfferForm = (offerId) => {
        router.push(`/courses?mode=offer-edit&id=${offerId}&selectedTab=offers`, undefined, { shallow: true });
    };

    const showViewOfferForm = (offerId) => {
        router.push(`/courses?mode=offer-view&id=${offerId}&selectedTab=offers`, undefined, { shallow: true });
    };

    const handleDeleteCourse = (course) => {
        setSelectedCourse(course);
        setShowDeleteDialog(true);
    };

    const handleOfferCourse = (course) => {
        showOfferForm(course);
    };

    const confirmDelete = async () => {
        if (selectedCourse) {
            setIsListLoading(true);
            try {
                const response = await fetch(`/api/courses/${selectedCourse.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                const data = await response.json();

                if (response.status === 400) {
                    // Cannot delete due to active offers - show detailed warning
                    if (data.error === 'Cannot delete course' && data.details) {
                        setDeleteWarning({
                            message: data.message,
                            recommendation: data.recommendation,
                            details: data.details
                        });
                        setIsListLoading(false);
                        return; // Keep dialog open to show warning
                    } else {
                        toast.error(data.message || 'Cannot delete this course.');
                    }
                } else if (response.status === 500) {
                    if (data.error && data.message.includes('Cannot delete')) {
                        toast.error('This course cannot be deleted as it may have associated bookings.');
                    } else {
                        toast.error('Something went wrong. Please try again later.');
                    }
                } else if (!response.ok) {
                    toast.error(data.message || 'Something went wrong. Please try again later.');
                } else {
                    // Success
                    toast.success('Course was successfully deleted.');
                    setShowDeleteDialog(false);
                    setSelectedCourse(null);
                    setDeleteWarning(null);
                    setTimeout(() => {
                        loadCourses();
                    }, 1000);
                }
            } catch (error) {
                console.error('Error deleting course:', error);
                toast.error('Failed to delete course. Please try again later.');
            }
            setIsListLoading(false);
        }
    };

    const closeDeleteDialog = () => {
        setShowDeleteDialog(false);
        setSelectedCourse(null);
        setDeleteWarning(null);
    };

    // Form callbacks
    const handleFormCancel = () => {
        showList();
    };

    const handleFormSuccess = (result) => {
        if (result && result.action === 'edit' && result.id) {
            // Switch to edit mode for the same course
            showEditForm({ id: result.id });
        } else {
            // Return to list and refresh
            showList();
        }
    };

    // Offer form callbacks
    const handleOfferFormCancel = () => {
        // Always return to offers tab when canceling from any offer form
        router.push('/courses?selectedTab=offers', undefined, { shallow: true });
    };

    const handleOfferFormSuccess = (result) => {
        if (result && result.action === 'edit' && result.id) {
            // Switch to edit mode for the same offer
            showEditOfferForm(result.id);
        } else {
            // Return to offers tab
            router.push('/courses?selectedTab=offers', undefined, { shallow: true });
        }
    };

    // Handle tab changes
    const handleTabChange = (index) => {
        const tabNames = ["courses", "offers", "rates"];
        const selectedTabName = tabNames[index];
        setSelectedTab(selectedTabName);
        
        // Update URL to reflect tab change
        const query = { ...router.query };
        if (selectedTabName === "courses") {
            delete query.selectedTab;
        } else {
            query.selectedTab = selectedTabName;
        }
        // Remove form mode parameters when switching tabs
        delete query.mode;
        delete query.id;
        delete query.courseId;
        
        router.push({
            pathname: router.pathname,
            query
        }, undefined, { shallow: true });
    };

    // Handle view mode toggle
    const toggleViewMode = () => {
        setViewMode(prevMode => prevMode === 'table' ? 'calendar' : 'table');
    };

    // Configure columns for the table with updated pricing
    const columns = useMemo(() => [
        {
            key: 'title',
            label: 'COURSE TITLE',
            searchable: true,
            render: (value, row) => (
                <span className="font-medium text-gray-900">
                    {value || 'Untitled Course'}
                </span>
            )
        },
        {
            key: 'dateRange',
            label: 'COURSE DATES',
            searchable: true,
            render: (value, row) => (
                <span className="text-gray-700">
                    {value || 'TBD'}
                </span>
            )
        },
        {
            key: 'minDateRange',
            label: 'MIN BOOKING DATES',
            searchable: true,
            render: (value, row) => (
                <span className="text-gray-700 text-sm">
                    {value || 'TBD'}
                </span>
            )
        },
        {
            key: 'duration_hours',
            label: 'DURATION (HOURS)',
            searchable: true,
            render: (value, row) => (
                <span className="text-gray-700">
                    {value || 'TBD'}
                </span>
            )
        },
        {
            key: 'formattedSTAPrice',
            label: 'STA PRICE',
            searchable: false,
            render: (value, row) => (
                <div className="text-gray-700 font-medium">
                    <div>{value}</div>
                    {row.pricingCalculated && row.priceCalculatedAt && (
                        <div className="text-xs text-gray-500">
                            Calculated {moment(row.priceCalculatedAt).format('DD/MM/YY')}
                        </div>
                    )}
                    {!row.pricingCalculated && row.start_date && row.end_date && (
                        <div className="text-xs text-orange-600">
                            Needs calculation
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'formattedHolidayPrice',
            label: 'HOLIDAY PRICE',
            searchable: false,
            render: (value, row) => (
                <div className="text-gray-700 font-medium">
                    <div>{value}</div>
                    {row.pricingCalculated && row.priceCalculatedAt && (
                        <div className="text-xs text-gray-500">
                            Calculated {moment(row.priceCalculatedAt).format('DD/MM/YY')}
                        </div>
                    )}
                    {!row.pricingCalculated && row.start_date && row.end_date && (
                        <div className="text-xs text-orange-600">
                            Needs calculation
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'status',
            label: 'STATUS',
            searchable: false,
            render: (value, row) => (
                <div className="flex justify-center">
                    {value === 'active' ? (
                        <StatusBadge type="success" label="Active" />
                    ) : value === 'pending' ? (
                        <StatusBadge type="draft" label="Draft" />
                    ) : value === 'archived' ? (
                        <StatusBadge type="archived" label="Archived" />
                    ) : (
                        <StatusBadge type="neutral" label={value || 'Unknown'} />
                    )}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'ACTION',
            searchable: false,
            render: (value, row) => (
                <div className="flex items-center space-x-2">
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showViewForm(row);
                        }}
                        title="View Course"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showEditForm(row);
                        }}
                        title="Edit Course"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    {/* Offer to Guest button - only show for active courses with future dates */}
                    {row.canOffer && (
                        <button 
                            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                            style={{ backgroundColor: '#10B9811A', color: '#10B981' }}
                            onClick={(e) => {
                                e.stopPropagation();
                                handleOfferCourse(row);
                            }}
                            title="Offer to Guest"
                        >
                            <Users className="w-4 h-4" />
                        </button>
                    )}
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteCourse(row);
                        }}
                        title="Delete Course"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [courseRates]);

    // Show loading spinner for initial load
    if (!isFormMode && selectedTab === "courses" && isListLoading && courses.length === 0) {
        return (
            <Layout title="Course Management">
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Course Management">
            <div className="p-6">
                {/* TABS AND CONTENT (when not in form mode) */}
                {!isFormMode && (
                    <>
                        {/* Main Navigation Tabs */}
                        <div className="mb-6">
                            <TabButton
                                tabs={mainTabs}
                                activeTab={selectedTab === "offers" ? 1 : selectedTab === "rates" ? 2 : 0}
                                onChange={handleTabChange}
                                type="outline"
                            />
                        </div>

                        {/* COURSES TAB */}
                        {selectedTab === "courses" && (
                            <>
                                <div className="flex justify-between items-center mb-6">
                                    {/* View Toggle Buttons */}
                                    <div className="flex items-center space-x-2">
                                        <button
                                            onClick={toggleViewMode}
                                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                                                viewMode === 'table'
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            <List className="w-4 h-4" />
                                            <span className="text-sm font-medium">Table</span>
                                        </button>
                                        <button
                                            onClick={toggleViewMode}
                                            className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                                                viewMode === 'calendar'
                                                    ? 'bg-blue-100 text-blue-700 border border-blue-300'
                                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                                            }`}
                                        >
                                            <Calendar className="w-4 h-4" />
                                            <span className="text-sm font-medium">Calendar</span>
                                        </button>
                                    </div>

                                    {/* Add Course Button */}
                                    <Button
                                        color="primary"
                                        size="medium"
                                        label="+ ADD COURSE"
                                        onClick={showAddForm}
                                        className="font-semibold"
                                    />
                                </div>

                                {/* Table or Calendar View */}
                                {viewMode === 'table' ? (
                                    <Table 
                                        data={courses} 
                                        columns={columns}
                                        itemsPerPageOptions={[10, 15, 25, 50]}
                                        defaultItemsPerPage={15}
                                    />
                                ) : (
                                    <CalendarView courses={courses} />
                                )}

                                {/* Delete Confirmation Dialog */}
                                {showDeleteDialog && (
                                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                        <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                                            {!deleteWarning ? (
                                                // Initial delete confirmation
                                                <>
                                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                        Delete Course
                                                    </h3>
                                                    <p className="text-gray-600 mb-6">
                                                        Are you sure you want to delete &quot;{selectedCourse?.title}&quot;? This action cannot be undone.
                                                    </p>
                                                    <div className="flex justify-end space-x-3">
                                                        <Button
                                                            color="outline"
                                                            size="medium"
                                                            label="Cancel"
                                                            onClick={closeDeleteDialog}
                                                        />
                                                        <Button
                                                            color="secondary"
                                                            size="medium"
                                                            label="Delete"
                                                            onClick={confirmDelete}
                                                            disabled={isListLoading}
                                                        />
                                                    </div>
                                                </>
                                            ) : (
                                                // Warning about active offers
                                                <>
                                                    <div className="flex items-start space-x-3 mb-4">
                                                        <div className="flex-shrink-0">
                                                            <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                            </svg>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                                                Cannot Delete Course
                                                            </h3>
                                                            <p className="text-gray-700 mb-4">
                                                                {deleteWarning.message}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Active Offers Summary */}
                                                    {deleteWarning.details && (
                                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
                                                            <div className="flex items-center space-x-6 text-sm">
                                                                <div>
                                                                    <span className="text-gray-600">Active Offers:</span>
                                                                    <span className="ml-2 font-semibold text-gray-900">
                                                                        {deleteWarning.details.activeOffers}
                                                                    </span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-600">Linked to Bookings:</span>
                                                                    <span className="ml-2 font-semibold text-gray-900">
                                                                        {deleteWarning.details.linkedOffers}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Affected Guests List */}
                                                    {deleteWarning.details?.affectedGuests && deleteWarning.details.affectedGuests.length > 0 && (
                                                        <div className="mb-4">
                                                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                                                                Affected Guests ({deleteWarning.details.affectedGuests.length}):
                                                            </h4>
                                                            <div className="bg-gray-50 border border-gray-200 rounded-lg divide-y divide-gray-200 max-h-60 overflow-y-auto">
                                                                {deleteWarning.details.affectedGuests.map((guest, index) => (
                                                                    <div key={index} className="p-3 hover:bg-gray-100 transition-colors">
                                                                        <div className="flex items-center justify-between">
                                                                            <div className="flex-1">
                                                                                <p className="font-medium text-gray-900">
                                                                                    {guest.name}
                                                                                </p>
                                                                                <p className="text-sm text-gray-600">
                                                                                    {guest.email}
                                                                                </p>
                                                                            </div>
                                                                            <div className="ml-4">
                                                                                <StatusBadge 
                                                                                    type={guest.offerStatus === 'offered' ? 'offer' : 'primary'}
                                                                                    label={guest.offerStatus.charAt(0).toUpperCase() + guest.offerStatus.slice(1)}
                                                                                    size="small"
                                                                                />
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Recommendation */}
                                                    {deleteWarning.recommendation && (
                                                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                                                            <div className="flex items-start space-x-2">
                                                                <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                                                                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                                                </svg>
                                                                <p className="text-sm text-blue-900">
                                                                    <strong>Recommendation:</strong> {deleteWarning.recommendation}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action Buttons */}
                                                    <div className="flex justify-end space-x-3">
                                                        <Button
                                                            color="outline"
                                                            size="medium"
                                                            label="Cancel"
                                                            onClick={closeDeleteDialog}
                                                        />
                                                        {/* Future: Add "Force Delete" button if needed
                                                        <Button
                                                            color="secondary"
                                                            size="medium"
                                                            label="Force Delete Anyway"
                                                            onClick={handleForceDelete}
                                                        />
                                                        */}
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* COURSE OFFERS TAB */}
                        {selectedTab === "offers" && (
                            <CourseOffers 
                                onEditOffer={showEditOfferForm}
                                onViewOffer={showViewOfferForm}
                            />
                        )}

                        {/* COURSE RATES TAB */}
                        {selectedTab === "rates" && (
                            <CourseRates />
                        )}
                    </>
                )}

                {/* COURSE FORM VIEW (when in add/edit/view mode) */}
                {isFormMode && selectedTab === "courses" && (mode === 'add' || mode === 'edit' || mode === 'view') && (
                    <CourseForm
                        mode={mode}
                        courseId={id}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                )}

                {/* OFFER FORM VIEW (when in offer add/edit/view mode) */}
                {isFormMode && (mode === 'offer-add' || mode === 'offer-edit' || mode === 'offer-view') && (
                    <CourseOfferForm
                        mode={mode.replace('offer-', '')}
                        offerId={id}
                        preSelectedCourseId={courseId}
                        onCancel={handleOfferFormCancel}
                        onSuccess={handleOfferFormSuccess}
                    />
                )}
            </div>
        </Layout>
    );
}