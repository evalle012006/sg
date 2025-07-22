import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { 
  Eye, 
  Edit, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Clock,
  Filter,
  Calendar,
  UserCheck,
  Award,
  AlertCircle,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';

const Table = dynamic(() => import('../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const StatusBadge = dynamic(() => import('../../components/ui-v2/StatusBadge'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const Select = dynamic(() => import('../../components/ui-v2/Select'));

export default function CourseOffers({ onEditOffer, onViewOffer }) {
    const router = useRouter();
    
    const [courseOffers, setCourseOffers] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    
    // Filters
    const [statusFilter, setStatusFilter] = useState('');
    const [courseFilter, setCourseFilter] = useState('');
    
    // Bulk actions
    const [selectedOffers, setSelectedOffers] = useState([]);

    // Filter options (removed 'available')
    const statusOptions = [
        { value: '', label: 'All Statuses' },
        { value: 'offered', label: 'Offered' },
        { value: 'accepted', label: 'Accepted' },
        { value: 'completed', label: 'Completed' }
    ];

    useEffect(() => {
        loadOffers();
        loadCourses();
    }, [statusFilter, courseFilter]);

    const loadOffers = async () => {
        setIsLoading(true);
        try {
            const params = new URLSearchParams();
            if (courseFilter) params.append('course_id', courseFilter);
            if (statusFilter) params.append('status', statusFilter);
            params.append('limit', '100');
            params.append('include_invalid', 'true'); // Get all offers

            const response = await fetch(`/api/courses/offers?${params}`);
            if (!response.ok) {
                throw new Error('Failed to load course offers');
            }
            
            const result = await response.json();
            const offersData = result.data || [];
            
            // Process offers data for display
            const processedOffers = offersData.map(offer => ({
                ...offer,
                formattedOfferedAt: moment(offer.offered_at).format('DD/MM/YYYY HH:mm'),
                guestName: `${offer.guest?.first_name || ''} ${offer.guest?.last_name || ''}`.trim(),
                courseName: offer.course?.title || 'Unknown Course',
                bookingDeadline: moment(offer.course?.min_end_date).format('DD/MM/YYYY'),
                courseStartDate: moment(offer.course?.start_date).format('DD/MM/YYYY'),
                courseEndDate: moment(offer.course?.end_date).format('DD/MM/YYYY'),
                daysUntilDeadline: moment(offer.course?.min_end_date).diff(moment(), 'days'),
                daysUntilStart: moment(offer.course?.start_date).diff(moment(), 'days'),
                daysUntilEnd: moment(offer.course?.end_date).diff(moment(), 'days')
            }));
            
            setCourseOffers(processedOffers);
        } catch (error) {
            console.error('Error loading offers:', error);
            toast.error('Failed to load course offers');
        }
        setIsLoading(false);
    };

    const loadCourses = async () => {
        try {
            const response = await fetch('/api/courses/');
            if (response.ok) {
                const result = await response.json();
                const coursesData = result.courses || result || [];
                setCourses(coursesData);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    };

    // Navigation functions
    const showAddForm = () => {
        router.push('/courses?selectedTab=offers&mode=offer-add', undefined, { shallow: true });
    };

    const showEditForm = (offer) => {
        if (onEditOffer) {
            onEditOffer(offer.id);
        } else {
            router.push(`/courses?selectedTab=offers&mode=offer-edit&id=${offer.id}`, undefined, { shallow: true });
        }
    };

    const showViewForm = (offer) => {
        if (onViewOffer) {
            onViewOffer(offer.id);
        } else {
            router.push(`/courses?selectedTab=offers&mode=offer-view&id=${offer.id}`, undefined, { shallow: true });
        }
    };

    const getStatusInfo = (offer) => {
        const statusConfig = {
            offered: { 
                type: 'warning', 
                label: 'Offered', 
                icon: <AlertCircle className="w-4 h-4" />,
                description: 'Waiting for guest response'
            },
            accepted: { 
                type: 'success', 
                label: 'Accepted', 
                icon: <UserCheck className="w-4 h-4" />,
                description: 'Guest has accepted'
            },
            completed: { 
                type: 'success', 
                label: 'Completed', 
                icon: <Award className="w-4 h-4" />,
                description: 'Course completed'
            }
        };

        return statusConfig[offer.status] || statusConfig.offered;
    };

    // Note: Status changes are now handled by automated triggers
    // Manual status change functions removed

    const handleDeleteOffer = async (offer) => {
        if (offer.status === 'accepted') {
            toast.error('Cannot delete an accepted offer. Please change the status first.');
            return;
        }

        if (!window.confirm(`Are you sure you want to delete the offer for "${offer.guestName}"?`)) {
            return;
        }

        try {
            const response = await fetch(`/api/courses/offers/${offer.id}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const result = await response.json();
                throw new Error(result.message || 'Failed to delete offer');
            }

            toast.success('Offer deleted successfully');
            loadOffers();
        } catch (error) {
            console.error('Error deleting offer:', error);
            toast.error(error.message || 'Failed to delete offer');
        }
    };

    const handleBulkDelete = async () => {
        if (selectedOffers.length === 0) {
            toast.warning('Please select offers to delete');
            return;
        }

        // Check if any selected offers are accepted
        const acceptedOffers = courseOffers.filter(offer => 
            selectedOffers.includes(offer.id) && offer.status === 'accepted'
        );

        if (acceptedOffers.length > 0) {
            toast.error('Cannot delete accepted offers. Please change their status first.');
            return;
        }

        const confirmMessage = `Are you sure you want to delete ${selectedOffers.length} offer(s)?`;
        if (!window.confirm(confirmMessage)) {
            return;
        }

        try {
            const promises = selectedOffers.map(offerId =>
                fetch(`/api/courses/offers/${offerId}`, { method: 'DELETE' })
            );

            await Promise.all(promises);
            toast.success(`${selectedOffers.length} offers deleted successfully`);
            setSelectedOffers([]);
            loadOffers();
        } catch (error) {
            console.error('Error performing bulk delete:', error);
            toast.error('Failed to delete offers');
        }
    };

    // Course options for filter
    const courseOptions = useMemo(() => [
        { value: '', label: 'All Courses' },
        ...courses.map(course => ({
            value: course.id.toString(),
            label: course.title
        }))
    ], [courses]);

    // Table columns
    const columns = useMemo(() => [
        {
            key: 'selection',
            label: '',
            searchable: false,
            width: '50px',
            render: (value, row) => (
                <input
                    type="checkbox"
                    checked={selectedOffers.includes(row.id)}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedOffers(prev => [...prev, row.id]);
                        } else {
                            setSelectedOffers(prev => prev.filter(id => id !== row.id));
                        }
                    }}
                    className="h-4 w-4 text-blue-600 rounded border-gray-300"
                />
            )
        },
        {
            key: 'courseName',
            label: 'COURSE',
            searchable: true,
            render: (value, row) => (
                <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    <div className="text-sm text-gray-500">
                        Starts: {row.courseStartDate}
                    </div>
                </div>
            )
        },
        {
            key: 'guestName',
            label: 'GUEST',
            searchable: true,
            render: (value, row) => (
                <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    <div className="text-sm text-gray-500">{row.guest?.email}</div>
                </div>
            )
        },
        {
            key: 'status',
            label: 'STATUS',
            searchable: false,
            render: (value, row) => {
                const statusInfo = getStatusInfo(row);
                return (
                    <div className="flex items-center space-x-2">
                        <StatusBadge 
                            type={statusInfo.type} 
                            label={statusInfo.label} 
                        />
                        <div className="text-xs text-gray-500">
                            {statusInfo.description}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'timing',
            label: 'TIMING',
            searchable: false,
            render: (value, row) => {
                const now = moment();
                const bookingDeadline = moment(row.course?.min_end_date);
                const courseStart = moment(row.course?.start_date);
                const courseEnd = moment(row.course?.end_date);

                let timingInfo = '';
                let timingClass = 'text-gray-600';

                if (row.status === 'completed') {
                    timingInfo = `Completed: ${row.courseEndDate}`;
                    timingClass = 'text-green-600';
                } else if (now.isAfter(courseEnd)) {
                    timingInfo = 'Course ended';
                    timingClass = 'text-gray-500';
                } else if (now.isAfter(courseStart)) {
                    timingInfo = 'Course in progress';
                    timingClass = 'text-blue-600';
                } else if (now.isAfter(bookingDeadline)) {
                    timingInfo = 'Booking closed';
                    timingClass = 'text-red-600';
                } else {
                    const daysLeft = bookingDeadline.diff(now, 'days');
                    if (daysLeft === 0) {
                        timingInfo = 'Last day to book!';
                        timingClass = 'text-orange-600 font-medium';
                    } else if (daysLeft <= 7) {
                        timingInfo = `${daysLeft} days to book`;
                        timingClass = 'text-orange-600';
                    } else {
                        timingInfo = `${daysLeft} days to book`;
                        timingClass = 'text-green-600';
                    }
                }

                return (
                    <div>
                        <div className={`text-sm ${timingClass}`}>{timingInfo}</div>
                        <div className="text-xs text-gray-500">
                            Deadline: {row.bookingDeadline}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'formattedOfferedAt',
            label: 'OFFERED',
            searchable: false,
            render: (value) => (
                <span className="text-gray-700 text-sm">{value}</span>
            )
        },
        {
            key: 'actions',
            label: 'ACTIONS',
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
                        title="View Offer"
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
                        title="Edit Offer"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    
                    <button
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#EF44441A', color: '#EF4444' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteOffer(row);
                        }}
                        title="Delete Offer"
                        disabled={row.status === 'accepted'}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], [selectedOffers, onEditOffer, onViewOffer]);

    if (isLoading && courseOffers.length === 0) {
        return (
            <div className='h-screen flex items-center justify-center'>
                <Spinner />
            </div>
        );
    }

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <p className="text-gray-600 mt-1">Manage course offers. Status updates are handled automatically by system triggers.</p>
                </div>
                <Button
                    color="primary"
                    size="medium"
                    label="+ ADD OFFER"
                    onClick={showAddForm}
                    className="font-semibold"
                />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                        <Filter className="w-4 h-4 text-gray-500" />
                        <span className="text-sm font-medium text-gray-700">Filters:</span>
                    </div>
                    
                    <div className="w-48">
                        <Select
                            label=""
                            options={statusOptions}
                            value={statusOptions.find(opt => opt.value === statusFilter)}
                            onClick={(option) => setStatusFilter(option.value)}
                            size="small"
                        />
                    </div>
                    
                    <div className="w-64">
                        <Select
                            label=""
                            options={courseOptions}
                            value={courseOptions.find(opt => opt.value === courseFilter)}
                            onClick={(option) => setCourseFilter(option.value)}
                            size="small"
                        />
                    </div>

                    {(statusFilter || courseFilter) && (
                        <Button
                            color="outline"
                            size="small"
                            label="Clear Filters"
                            onClick={() => {
                                setStatusFilter('');
                                setCourseFilter('');
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Bulk Actions */}
            {selectedOffers.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-red-900">
                            {selectedOffers.length} offer(s) selected
                        </span>
                        <div className="flex items-center space-x-3">
                            <Button
                                color="secondary"
                                size="small"
                                label="Delete Selected"
                                onClick={handleBulkDelete}
                            />
                            <Button
                                color="outline"
                                size="small"
                                label="Clear Selection"
                                onClick={() => setSelectedOffers([])}
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Offers Table */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                <Table 
                    data={courseOffers} 
                    columns={columns}
                    itemsPerPageOptions={[25, 50, 100]}
                    defaultItemsPerPage={25}
                    emptyMessage="No course offers found"
                />
            </div>
        </div>
    );
}