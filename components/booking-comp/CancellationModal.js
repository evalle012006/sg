import React from 'react';

/**
 * Modal for selecting cancellation type (No Charge vs Full Charge)
 * Used when admin cancels a booking or processes a guest cancellation request
 */
const CancellationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  bookingId,
  title = "Select Cancellation Type",
  description = "Please select the type of cancellation for this booking:"
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/30 z-50" onClick={onClose}>
      <div className="flex items-center justify-center h-full">
        <div 
          className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4" 
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h2 className="text-xl font-bold text-blue-800 mb-3">{title}</h2>
            {bookingId && (
              <p className="text-sm text-gray-500 mb-2">Booking: {bookingId}</p>
            )}
            <p className="text-gray-700 mb-6">
              {description}
            </p>
            
            <div className="space-y-3 mb-6">
              <button
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors group"
                onClick={() => onConfirm(false)}
              >
                <div className="font-medium text-gray-900 group-hover:text-blue-700">No Charge Cancellation</div>
                <div className="text-sm text-gray-500">Nights will NOT be returned to the guest's approval</div>
              </button>
              
              <button
                className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors group"
                onClick={() => onConfirm(true)}
              >
                <div className="font-medium text-gray-900 group-hover:text-blue-700">Full Charge Cancellation</div>
                <div className="text-sm text-gray-500">Nights WILL be returned to the guest's iCare approval</div>
              </button>
            </div>
            
            <div className="flex justify-end">
              <button 
                className="font-medium text-gray-500 uppercase text-sm px-4 py-2 hover:text-gray-700" 
                onClick={onClose}
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CancellationModal;