import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import moment from 'moment';
import dynamic from 'next/dynamic';
import { Plus, Edit, Trash2, AlertCircle } from 'lucide-react';

const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const ApprovalFormModal = dynamic(() => import('./ApprovalFormModal'));

const ApprovalsManagement = ({ uuid }) => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);

  useEffect(() => {
    if (uuid) {
      fetchApprovals();
    }
  }, [uuid]);

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/guests/${uuid}/approvals`);
      if (response.ok) {
        const data = await response.json();
        setApprovals(data);
      }
    } catch (error) {
      console.error('Error fetching approvals:', error);
      toast.error('Failed to load approvals');
    } finally {
      setLoading(false);
    }
  };

  const handleAddApproval = () => {
    setSelectedApproval(null);
    setModalOpen(true);
  };

  const handleEditApproval = (approval) => {
    setSelectedApproval(approval);
    setModalOpen(true);
  };

  const handleDeleteApproval = async (approvalId) => {
    if (!confirm('Are you sure you want to delete this approval?')) return;

    try {
      const response = await fetch(`/api/guests/${uuid}/approvals/${approvalId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Approval deleted successfully');
        fetchApprovals();
      } else {
        throw new Error('Failed to delete approval');
      }
    } catch (error) {
      console.error('Error deleting approval:', error);
      toast.error('Failed to delete approval');
    }
  };

  const getStatusBadgeType = (status) => {
    switch (status) {
      case 'active': return 'success';
      case 'expired': return 'warning';
      case 'exhausted': return 'error';
      case 'cancelled': return 'default';
      default: return 'primary';
    }
  };

  const ApprovalCard = ({ approval }) => {
    const nightsPercentage = approval.nights_approved > 0
      ? (approval.nights_used / approval.nights_approved) * 100
      : 0;

    const additionalNightsPercentage = approval.additional_room_nights_approved > 0
      ? (approval.additional_room_nights_used / approval.additional_room_nights_approved) * 100
      : 0;

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h3 className="text-lg font-semibold text-gray-800">
                {approval.approval_name || `Approval ${approval.approval_number || approval.id}`}
              </h3>
              <StatusBadge
                type={getStatusBadgeType(approval.status)}
                label={approval.status.toUpperCase()}
                size="small"
              />
              {!approval.is_valid && approval.status === 'active' && (
                <div className="flex items-center text-amber-600 text-xs">
                  <AlertCircle size={14} className="mr-1" />
                  <span>Outside validity period</span>
                </div>
              )}
            </div>
            
            {approval.approval_number && (
              <p className="text-sm text-gray-600">
                Approval #: {approval.approval_number}
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleEditApproval(approval)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Edit"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={() => handleDeleteApproval(approval.id)}
              className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Delete"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-xs text-gray-500 mb-1">Type</p>
            <p className="text-sm font-medium text-gray-800 capitalize">
              {approval.approval_type}
            </p>
          </div>

          {approval.package && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Package</p>
              <p className="text-sm font-medium text-gray-800">
                {approval.package.name}
                {approval.package.package_code && ` (${approval.package.package_code})`}
              </p>
            </div>
          )}

          <div>
            <p className="text-xs text-gray-500 mb-1">Valid Period</p>
            <p className="text-sm text-gray-700">
              {moment(approval.approval_from).format('DD MMM YYYY')} - {moment(approval.approval_to).format('DD MMM YYYY')}
            </p>
          </div>
        </div>

        {/* Primary Nights Tracker */}
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium text-gray-700">Primary Room Nights</p>
            <p className="text-sm font-semibold text-gray-800">
              {approval.nights_used} / {approval.nights_approved}
            </p>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all duration-300 ${
                nightsPercentage >= 100 ? 'bg-red-600' : 'bg-blue-600'
              }`}
              style={{ width: `${Math.min(100, nightsPercentage)}%` }}
            />
          </div>
          
          <p className="text-xs text-gray-600 mt-1">
            {approval.nights_remaining > 0
              ? `${approval.nights_remaining} nights remaining`
              : 'No nights remaining'}
          </p>
        </div>

        {/* Additional Room Tracker */}
        {approval.additional_room_approved && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-gray-700">
                Additional Room ({approval.additional_room_type?.name})
              </p>
              <p className="text-sm font-semibold text-gray-800">
                {approval.additional_room_nights_used} / {approval.additional_room_nights_approved}
              </p>
            </div>
            
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-300 ${
                  additionalNightsPercentage >= 100 ? 'bg-red-500' : 'bg-blue-500'
                }`}
                style={{ width: `${Math.min(100, additionalNightsPercentage)}%` }}
              />
            </div>
            
            <p className="text-xs text-gray-600 mt-1">
              {approval.additional_room_nights_remaining > 0
                ? `${approval.additional_room_nights_remaining} nights remaining`
                : 'No nights remaining'}
            </p>
          </div>
        )}

        {/* Bookings Count */}
        {approval.usages && approval.usages.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs text-gray-600">
              Used in {approval.usages.filter(u => u.status === 'confirmed').length} confirmed booking(s)
            </p>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Approvals Management</h2>
          <p className="text-sm text-gray-600 mt-1">
            Manage guest approvals and track night usage
          </p>
        </div>
        <Button
          onClick={handleAddApproval}
          size="medium"
          color="primary"
          label="Add Approval"
          withIcon={true}
          iconName="plus"
          Icon={Plus}
        />
      </div>

      {/* Approvals List */}
      {approvals.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Approvals Yet</h3>
          <p className="text-gray-600 mb-6">
            Get started by adding the first approval for this guest
          </p>
          <Button
            onClick={handleAddApproval}
            size="medium"
            color="primary"
            label="Add First Approval"
            withIcon={true}
            iconName="plus"
            Icon={Plus}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {approvals.map((approval) => (
            <ApprovalCard key={approval.id} approval={approval} />
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <ApprovalFormModal
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelectedApproval(null);
          }}
          approval={selectedApproval}
          uuid={uuid}
          onSuccess={fetchApprovals}
        />
      )}
    </div>
  );
};

export default ApprovalsManagement;