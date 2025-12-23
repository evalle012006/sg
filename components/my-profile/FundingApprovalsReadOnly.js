import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import moment from 'moment';
import { AlertCircle, Calendar, CheckCircle, Clock, XCircle } from 'lucide-react';

const Spinner = dynamic(() => import('../ui/spinner'));

const FundingApprovalsReadOnly = ({ uuid }) => {
    const [loading, setLoading] = useState(true);
    const [fundingApprovals, setFundingApprovals] = useState([]);

    useEffect(() => {
        if (uuid) {
            fetchFundingApprovals();
        }
    }, [uuid]);

    const fetchFundingApprovals = async () => {
        setLoading(true);
        try {
            const response = await fetch(`/api/guests/${uuid}/funding-approvals`);
            if (response.ok) {
                const result = await response.json();
                setFundingApprovals(result.data || []);
            }
        } catch (error) {
            console.error('Error fetching funding approvals:', error);
        } finally {
            setLoading(false);
        }
    };

    // Sort approvals: active first (by date desc), then expired (by date desc)
    const sortedApprovals = useMemo(() => {
        const now = moment();
        
        // Separate into active and expired
        const active = [];
        const expired = [];
        
        fundingApprovals.forEach(approval => {
            const isExpired = approval.status === 'expired' || 
                (approval.approval_to && moment(approval.approval_to).isBefore(now));
            
            if (isExpired) {
                expired.push({ ...approval, isExpired: true });
            } else {
                active.push({ ...approval, isExpired: false });
            }
        });
        
        // Sort each group by approval_from date descending (newest first)
        const sortByDate = (a, b) => {
            const dateA = moment(a.approval_from || a.created_at);
            const dateB = moment(b.approval_from || b.created_at);
            return dateB.diff(dateA);
        };
        
        active.sort(sortByDate);
        expired.sort(sortByDate);
        
        // Return active first, then expired
        return [...active, ...expired];
    }, [fundingApprovals]);

    // Calculate totals
    const totals = useMemo(() => {
        return fundingApprovals.reduce((acc, approval) => {
            acc.totalAllocated += approval.nights_approved || 0;
            acc.totalUsed += approval.nights_used || 0;
            acc.totalRemaining += (approval.nights_approved || 0) - (approval.nights_used || 0);
            return acc;
        }, { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 });
    }, [fundingApprovals]);

    const getStatusInfo = (approval) => {
        const now = moment();
        const fromDate = approval.approval_from ? moment(approval.approval_from) : null;
        const toDate = approval.approval_to ? moment(approval.approval_to) : null;
        
        // Check if expired
        if (approval.status === 'expired' || (toDate && toDate.isBefore(now))) {
            return {
                label: 'Expired',
                color: 'text-gray-500',
                bgColor: 'bg-gray-100',
                borderColor: 'border-gray-200',
                icon: XCircle,
                iconColor: 'text-gray-400'
            };
        }
        
        // Check if inactive
        if (approval.status === 'inactive') {
            return {
                label: 'Inactive',
                color: 'text-gray-500',
                bgColor: 'bg-gray-50',
                borderColor: 'border-gray-200',
                icon: XCircle,
                iconColor: 'text-gray-400'
            };
        }
        
        // Check if not yet started
        if (fromDate && fromDate.isAfter(now)) {
            return {
                label: 'Upcoming',
                color: 'text-blue-600',
                bgColor: 'bg-blue-50',
                borderColor: 'border-blue-200',
                icon: Clock,
                iconColor: 'text-blue-500'
            };
        }
        
        // Active
        return {
            label: 'Active',
            color: 'text-green-600',
            bgColor: 'bg-green-50',
            borderColor: 'border-green-200',
            icon: CheckCircle,
            iconColor: 'text-green-500'
        };
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return moment(dateString).format('DD MMM YYYY');
    };

    const ApprovalCard = ({ approval }) => {
        const statusInfo = getStatusInfo(approval);
        const StatusIcon = statusInfo.icon;
        const nightsRemaining = (approval.nights_approved || 0) - (approval.nights_used || 0);
        
        return (
            <div className={`border rounded-lg overflow-hidden ${statusInfo.borderColor} ${approval.isExpired ? 'opacity-75' : ''}`}>
                {/* Header */}
                <div className={`${statusInfo.bgColor} px-4 py-3 flex items-center justify-between`}>
                    <div className="flex items-center space-x-3">
                        <StatusIcon className={`w-5 h-5 ${statusInfo.iconColor}`} />
                        <div>
                            <h3 className="font-semibold text-gray-800">
                                {approval.approval_name || 'Funding Approval'}
                            </h3>
                            {approval.approval_number && (
                                <p className="text-xs text-gray-500">
                                    Ref: {approval.approval_number}
                                </p>
                            )}
                        </div>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.bgColor} ${statusInfo.color}`}>
                        {statusInfo.label}
                    </span>
                </div>
                
                {/* Body */}
                <div className="p-4 bg-white">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Approval Period */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Approval Period</p>
                            <div className="flex items-center text-sm text-gray-700">
                                <Calendar className="w-4 h-4 mr-1 text-gray-400" />
                                <span>
                                    {formatDate(approval.approval_from)} - {formatDate(approval.approval_to)}
                                </span>
                            </div>
                        </div>
                        
                        {/* Package */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Package</p>
                            <p className="text-sm text-gray-700">
                                {approval.package?.name || '-'}
                                {approval.package?.package_code && (
                                    <span className="text-gray-400 ml-1">
                                        ({approval.package.package_code})
                                    </span>
                                )}
                            </p>
                        </div>
                        
                        {/* Nights Allocated */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Nights Allocated</p>
                            <p className="text-sm font-medium text-gray-700">
                                {approval.nights_approved ?? '-'}
                            </p>
                        </div>
                        
                        {/* Nights Used / Remaining */}
                        <div>
                            <p className="text-xs text-gray-500 mb-1">Nights Used / Remaining</p>
                            <p className="text-sm text-gray-700">
                                <span className="font-medium">{approval.nights_used ?? 0}</span>
                                <span className="text-gray-400 mx-1">/</span>
                                <span className={nightsRemaining > 0 ? 'text-green-600' : nightsRemaining < 0 ? 'text-red-600' : 'text-gray-500'}>
                                    {nightsRemaining}
                                </span>
                            </p>
                        </div>
                    </div>
                    
                    {/* Additional Room Info (if applicable) */}
                    {approval.additional_room_type_id && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-2">Additional Room</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        {approval.additionalRoomType?.name || 'Additional Room'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Nights Approved</p>
                                    <p className="text-sm font-medium text-gray-700">
                                        {approval.additional_room_nights_approved ?? '-'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500">Nights Used</p>
                                    <p className="text-sm font-medium text-gray-700">
                                        {approval.additional_room_nights_used ?? 0}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Notes (if any) */}
                    {approval.notes && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-500 mb-1">Notes</p>
                            <p className="text-sm text-gray-600">{approval.notes}</p>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-16">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-800 mb-1">Funding Approvals</h2>
                <p className="text-sm text-gray-600">
                    View your funding approvals and track night usage
                </p>
            </div>

            {/* Summary Cards */}
            {fundingApprovals.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Total Allocated</p>
                        <p className="text-2xl font-bold text-gray-800">{totals.totalAllocated}</p>
                        <p className="text-xs text-gray-500">nights</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Total Used</p>
                        <p className="text-2xl font-bold text-gray-800">{totals.totalUsed}</p>
                        <p className="text-xs text-gray-500">nights</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-lg p-4 sm:col-span-1 col-span-2">
                        <p className="text-xs text-gray-500 mb-1">Total Remaining</p>
                        <p className={`text-2xl font-bold ${totals.totalRemaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {totals.totalRemaining}
                        </p>
                        <p className="text-xs text-gray-500">nights</p>
                    </div>
                </div>
            )}

            {/* Info Banner */}
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
                    <div className="text-sm text-blue-800">
                        <p>
                            This is a read-only view of your funding approvals. 
                            Contact the Sargood team if you have any questions about your funding.
                        </p>
                    </div>
                </div>
            </div>

            {/* Approvals List */}
            {sortedApprovals.length === 0 ? (
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                    <div className="mb-4">
                        <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Funding Approvals</h3>
                    <p className="text-gray-600">
                        You don't have any funding approvals yet. Contact the Sargood team for more information.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Active Approvals */}
                    {sortedApprovals.filter(a => !a.isExpired).length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-500 uppercase mb-3">
                                Current Approvals
                            </h3>
                            <div className="space-y-4">
                                {sortedApprovals
                                    .filter(a => !a.isExpired)
                                    .map(approval => (
                                        <ApprovalCard key={approval.id} approval={approval} />
                                    ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Expired Approvals */}
                    {sortedApprovals.filter(a => a.isExpired).length > 0 && (
                        <div className="mt-8">
                            <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">
                                Expired Approvals
                            </h3>
                            <div className="space-y-4">
                                {sortedApprovals
                                    .filter(a => a.isExpired)
                                    .map(approval => (
                                        <ApprovalCard key={approval.id} approval={approval} />
                                    ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default FundingApprovalsReadOnly;