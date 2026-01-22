import React, { useState, useEffect, useMemo } from 'react';
import { toast } from 'react-toastify';
import moment from 'moment';
import { Eye, Check, X } from 'lucide-react';
import dynamic from 'next/dynamic';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const Spinner = dynamic(() => import('../ui/spinner'));
const ConfirmDialog = dynamic(() => import('../ui-v2/ConfirmDialog'));

export default function CourseEOIs() {
    const [eois, setEois] = useState([]);
    const [courses, setCourses] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [processingId, setProcessingId] = useState(null);
    const [processingAction, setProcessingAction] = useState(null); // 'accept' or 'reject'
    const [viewModalData, setViewModalData] = useState(null);
    const [confirmDialog, setConfirmDialog] = useState({
        isOpen: false,
        type: 'info',
        title: '',
        message: '',
        onConfirm: null,
        eoiData: null
    });

    useEffect(() => {
        loadEOIs();
        loadCourses();
    }, []);

    const loadCourses = async () => {
        try {
            const response = await fetch('/api/courses/');
            if (response.ok) {
                const result = await response.json();
                setCourses(result.courses || []);
            }
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    };

    const loadEOIs = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/courses/eoi');
            if (response.ok) {
                const result = await response.json();
                console.log('CourseEOIs - API Response:', result);
                console.log('CourseEOIs - Data count:', result.data?.length || 0);
                setEois(result.data || []);
            } else {
                console.error('CourseEOIs - API Error:', response.status);
                toast.error('Failed to load course EOIs');
            }
        } catch (error) {
            console.error('Error loading EOIs:', error);
            toast.error('Failed to load course EOIs');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAccept = (eoi) => {
        setConfirmDialog({
            isOpen: true,
            type: 'success',
            title: 'Accept Course EOI',
            message: `Accept EOI from ${eoi.guest_name}? This will create a course offer and send an email notification.`,
            eoiData: eoi,
            onConfirm: () => executeAccept(eoi)
        });
    };

    const executeAccept = async (eoi) => {
        setProcessingId(eoi.id);
        setProcessingAction('accept');
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
            const response = await fetch(`/api/courses/eoi/${eoi.id}/accept`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                toast.success(result.message || 'EOI accepted and course offer created');
                loadEOIs(); // Reload the list
            } else {
                const error = await response.json();
                toast.error(error.message || 'Failed to accept EOI');
            }
        } catch (error) {
            console.error('Error accepting EOI:', error);
            toast.error('Failed to accept EOI');
        } finally {
            setProcessingId(null);
            setProcessingAction(null);
        }
    };

    const handleReject = (eoi) => {
        setConfirmDialog({
            isOpen: true,
            type: 'danger',
            title: 'Reject Course EOI',
            message: `Are you sure you want to reject the EOI from ${eoi.guest_name}? This action cannot be undone.`,
            eoiData: eoi,
            onConfirm: () => executeReject(eoi)
        });
    };

    const executeReject = async (eoi) => {
        setProcessingId(eoi.id);
        setProcessingAction('reject');
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        
        try {
            const response = await fetch(`/api/courses/eoi/${eoi.id}/reject`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const result = await response.json();
                toast.success(result.message || 'EOI rejected');
                loadEOIs(); // Reload the list
            } else {
                const error = await response.json();
                toast.error(error.message || 'Failed to reject EOI');
            }
        } catch (error) {
            console.error('Error rejecting EOI:', error);
            toast.error('Failed to reject EOI');
        } finally {
            setProcessingId(null);
            setProcessingAction(null);
        }
    };

    const handleViewDetails = (eoi) => {
        setViewModalData(eoi);
    };

    const closeViewModal = () => {
        setViewModalData(null);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'pending': return 'warning';
            case 'accepted': return 'success';
            case 'rejected': return 'error';
            case 'converted': return 'info';
            default: return 'default';
        }
    };

    const columns = useMemo(() => [
        {
            key: 'submitted_at',
            label: 'SUBMITTED',
            searchable: true,
            render: (value) => (
                <span className="text-sm text-gray-700">
                    {value ? moment(value).format('DD/MM/YYYY h:mm A') : '-'}
                </span>
            )
        },
        {
            key: 'guest_name',
            label: 'GUEST NAME',
            searchable: true,
            render: (value, row) => {
                // Fallback to guest object if guest_name is not available
                const name = value || (row.guest ? `${row.guest.first_name} ${row.guest.last_name}` : '-');
                return <span className="font-medium text-gray-900">{name}</span>;
            }
        },
        {
            key: 'guest_email',
            label: 'EMAIL',
            searchable: true,
            render: (value, row) => {
                // Fallback to guest object if guest_email is not available
                const email = value || row.guest?.email || '-';
                return <span className="text-sm text-gray-600">{email}</span>;
            }
        },
        {
            key: 'guest_phone',
            label: 'PHONE',
            searchable: true,
            render: (value) => (
                <span className="text-sm text-gray-600">{value || '-'}</span>
            )
        },
        {
            key: 'selected_courses',
            label: 'COURSES',
            searchable: false,
            render: (value) => {
                try {
                    const courseIds = JSON.parse(value || '[]');
                    if (courseIds.length === 0) return <span className="text-sm text-gray-600">-</span>;
                    
                    // Get course names
                    const courseNames = courseIds.map(id => {
                        const course = courses.find(c => c.id === id);
                        return course ? course.title : `Course #${id}`;
                    }).join(', ');
                    
                    return (
                        <span className="text-sm text-gray-600" title={courseNames}>
                            {courseNames}
                        </span>
                    );
                } catch (e) {
                    return <span className="text-sm text-gray-600">-</span>;
                }
            }
        },
        {
            key: 'status',
            label: 'STATUS',
            searchable: true,
            render: (value) => (
                <div className='flex justify-center'>
                    <StatusBadge 
                        label={value ? value.toUpperCase() : 'PENDING'} 
                        color={getStatusColor(value)}
                        type={value == 'rejected' ? 'error' : value == 'accepted' ? 'success' : 'pending'}
                    />
                </div>
            )
        },
        {
            key: 'id',
            label: 'ACTIONS',
            searchable: false,
            render: (value, row) => {
                const isProcessing = processingId === row.id;
                const isAcceptProcessing = isProcessing && processingAction === 'accept';
                const isRejectProcessing = isProcessing && processingAction === 'reject';
                
                return (
                    <div className="flex gap-2 justify-center">
                        <button
                            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                            onClick={() => handleViewDetails(row)}
                            title="View Details"
                            disabled={isProcessing}
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        {row.status === 'pending' && (
                            <>
                                <button
                                    className="p-2 rounded transition-colors duration-150 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: '#10B9811A', color: '#10B981' }}
                                    onClick={() => handleAccept(row)}
                                    title="Accept & Create Offer"
                                    disabled={isProcessing}
                                >
                                    {isAcceptProcessing ? (
                                        <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                </button>
                                <button
                                    className="p-2 rounded transition-colors duration-150 hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{ backgroundColor: '#EF44441A', color: '#EF4444' }}
                                    onClick={() => handleReject(row)}
                                    title="Reject"
                                    disabled={isProcessing}
                                >
                                    {isRejectProcessing ? (
                                        <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                    ) : (
                                        <X className="w-4 h-4" />
                                    )}
                                </button>
                            </>
                        )}
                    </div>
                );
            }
        }
    ], [processingId, processingAction, courses]);

    if (isLoading) {
        return (
            <div className="h-screen flex items-center justify-center">
                <Spinner />
            </div>
        );
    }

    console.log('CourseEOIs - Rendering with data:', eois);
    console.log('CourseEOIs - Columns:', columns);

    return (
        <div>
            <div className="mb-4 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-900">Course Expressions of Interest</h2>
                <Button
                    type="button"
                    color="secondary"
                    size="medium"
                    label="Refresh"
                    onClick={loadEOIs}
                />
            </div>

            {eois && eois.length > 0 ? (
                <Table
                    data={eois}
                    columns={columns}
                    itemsPerPageOptions={[10, 15, 25, 50]}
                    defaultItemsPerPage={15}
                />
            ) : (
                <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                    <p className="text-gray-500">No course EOIs found</p>
                </div>
            )}

            {/* View Details Modal */}
            {viewModalData && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-xl font-bold text-gray-900">EOI Details</h3>
                                <button
                                    onClick={closeViewModal}
                                    className="text-gray-400 hover:text-gray-600"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Guest Information</h4>
                                    <div className="bg-gray-50 p-4 rounded space-y-2">
                                        <p><span className="font-medium">Name:</span> {viewModalData.guest_name}</p>
                                        <p><span className="font-medium">Email:</span> {viewModalData.guest_email}</p>
                                        <p><span className="font-medium">Phone:</span> {viewModalData.guest_phone || 'N/A'}</p>
                                        <p><span className="font-medium">Funding Type:</span> {viewModalData.funding_type || 'N/A'}</p>
                                        <p><span className="font-medium">Has SCI:</span> {viewModalData.has_sci ? 'Yes' : 'No'}</p>
                                    </div>
                                </div>

                                {viewModalData.completing_for === 'other' && (
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">Support Person</h4>
                                        <div className="bg-gray-50 p-4 rounded space-y-2">
                                            <p><span className="font-medium">Name:</span> {viewModalData.support_name || 'N/A'}</p>
                                            <p><span className="font-medium">Email:</span> {viewModalData.support_email || 'N/A'}</p>
                                            <p><span className="font-medium">Phone:</span> {viewModalData.support_phone || 'N/A'}</p>
                                            <p><span className="font-medium">Role:</span> {viewModalData.support_role || 'N/A'}</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">SCI Levels</h4>
                                    <div className="bg-gray-50 p-4 rounded">
                                        <p>{viewModalData.sci_levels || 'Not specified'}</p>
                                    </div>
                                </div>

                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Course Preferences</h4>
                                    <div className="bg-gray-50 p-4 rounded">
                                        <p><span className="font-medium">Selected Courses:</span> {
                                            (() => {
                                                try {
                                                    const courseIds = JSON.parse(viewModalData.selected_courses || '[]');
                                                    const courseNames = courseIds.map(id => {
                                                        const course = courses.find(c => c.id === id);
                                                        return course ? course.title : `Course #${id}`;
                                                    }).join(', ');
                                                    return courseNames || 'None';
                                                } catch (e) {
                                                    return 'None';
                                                }
                                            })()
                                        }</p>
                                    </div>
                                </div>

                                {viewModalData.comments && (
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">Comments</h4>
                                        <div className="bg-gray-50 p-4 rounded">
                                            <p>{viewModalData.comments}</p>
                                        </div>
                                    </div>
                                )}

                                <div>
                                    <h4 className="font-semibold text-gray-700 mb-2">Status Information</h4>
                                    <div className="bg-gray-50 p-4 rounded space-y-2">
                                        <p><span className="font-medium">Status:</span><div className='flex'><StatusBadge label={viewModalData.status.toUpperCase()} color={getStatusColor(viewModalData.status)} /></div></p>
                                        <p><span className="font-medium">Submitted:</span> {moment(viewModalData.submitted_at).format('DD/MM/YYYY h:mm A')}</p>
                                        {viewModalData.contacted_at && (
                                            <p><span className="font-medium">Contacted:</span> {moment(viewModalData.contacted_at).format('DD/MM/YYYY h:mm A')}</p>
                                        )}
                                    </div>
                                </div>

                                {viewModalData.admin_notes && (
                                    <div>
                                        <h4 className="font-semibold text-gray-700 mb-2">Admin Notes</h4>
                                        <div className="bg-gray-50 p-4 rounded">
                                            <p>{viewModalData.admin_notes}</p>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="mt-6 flex justify-end gap-2">
                                {viewModalData.status === 'pending' && (
                                    <>
                                        <Button
                                            type="button"
                                            color="primary"
                                            size="medium"
                                            label="Accept & Create Offer"
                                            onClick={() => {
                                                closeViewModal();
                                                handleAccept(viewModalData);
                                            }}
                                            icon={<Check className="w-4 h-4" />}
                                        />
                                        <Button
                                            type="button"
                                            color="error"
                                            size="medium"
                                            label="Reject"
                                            onClick={() => {
                                                closeViewModal();
                                                handleReject(viewModalData);
                                            }}
                                            icon={<X className="w-4 h-4" />}
                                        />
                                    </>
                                )}
                                <Button
                                    type="button"
                                    color="secondary"
                                    size="medium"
                                    label="Close"
                                    onClick={closeViewModal}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmDialog.isOpen}
                onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                onConfirm={confirmDialog.onConfirm}
                title={confirmDialog.title}
                message={confirmDialog.message}
                type={confirmDialog.type}
                confirmText={confirmDialog.type === 'danger' ? 'Reject' : 'Accept'}
                cancelText="Cancel"
                isLoading={processingId === confirmDialog.eoiData?.id}
            />
        </div>
    );
}