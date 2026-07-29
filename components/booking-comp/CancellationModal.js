import React, { useState } from 'react';

/**
 * Modal for cancelling a booking.
 * - Funded bookings: choose cancellation type (No Charge vs Full Charge) — nights impact iCare approvals.
 * - AOB bookings: no nights/approval concept applies; instead capture a free-text reason,
 *   since payment/refund handling for AOB is a separate concern from this modal.
 */
const CancellationModal = ({
  isOpen,
  onClose,
  onConfirm,
  bookingId,
  bookingType, // 'accommodation_only' | 'funded' | null
  title,
  description,
}) => {
  const [reason, setReason] = useState('');

  if (!isOpen) return null;

  const isAOB = bookingType === 'accommodation_only';

  const resolvedTitle = title || (isAOB ? 'Cancel Booking' : 'Select Cancellation Type');
  const resolvedDescription = description || (isAOB
    ? 'Please provide a reason for cancelling this booking. The guest will be notified.'
    : 'Please select the type of cancellation for this booking:');

  const handleAOBConfirm = () => {
    if (!reason.trim()) return; // require a reason before allowing confirm
    onConfirm({ reason: reason.trim() });
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose}>
      <div className="flex items-center justify-center h-full">
        <div
          className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-3">{resolvedTitle}</h2>
            {bookingId && (
              <p className="text-sm text-gray-500 mb-2">Booking: {bookingId}</p>
            )}
            <p className="text-gray-700 mb-6">
              {resolvedDescription}
            </p>
            {console.log('isAOB', isAOB, 'bookingType', bookingType)}
            {isAOB ? (
              <div className="mb-6">
                <textarea
                  className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors"
                  rows="4"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Enter reason for cancellation"
                />
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                <button
                  className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-green-50 transition-colors group"
                  onClick={() => onConfirm({ isFullCharge: false })}
                >
                  <div className="font-medium text-gray-900 group-hover:text-green-700">No Charge Cancellation</div>
                  <div className="text-sm text-gray-500">Nights WILL be returned to the guest&apos;s iCare approval (no penalty)</div>
                </button>

                <button
                  className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-red-50 transition-colors group"
                  onClick={() => onConfirm({ isFullCharge: true })}
                >
                  <div className="font-medium text-gray-900 group-hover:text-red-700">Full Charge Cancellation</div>
                  <div className="text-sm text-gray-500">Nights will NOT be returned - guest loses nights as a penalty</div>
                </button>
              </div>
            )}

            <div className="flex justify-end items-center gap-4">
              <button
                className="font-medium text-gray-500 uppercase text-sm px-4 py-2 hover:text-gray-700"
                onClick={onClose}
              >
                CANCEL
              </button>
              {isAOB && (
                <button
                  className="font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed uppercase text-sm px-4 py-2 rounded-lg transition-colors"
                  onClick={handleAOBConfirm}
                  disabled={!reason.trim()}
                >
                  Confirm Cancellation
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancellationModal;