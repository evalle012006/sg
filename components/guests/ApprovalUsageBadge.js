import React from 'react';

const ApprovalUsageBadge = ({ status, nightsConsumed }) => {
  const getBadgeStyles = () => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'late_cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'confirmed': return 'Confirmed';
      case 'pending': return 'Pending';
      case 'cancelled': return 'Cancelled (Refunded)';
      case 'late_cancelled': return 'Late Cancellation';
      default: return status;
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getBadgeStyles()}`}>
      {getStatusLabel()}
      {nightsConsumed > 0 && (
        <span className="ml-1 font-semibold">
          ({nightsConsumed} {nightsConsumed === 1 ? 'night' : 'nights'})
        </span>
      )}
    </span>
  );
};

export default ApprovalUsageBadge;