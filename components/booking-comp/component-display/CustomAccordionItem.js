import { ChevronDown, ChevronRight } from 'lucide-react';
import React from 'react';

const CustomAccordionItem = ({ title, description, isOpen, onToggle, children, status, bookingStatus }) => {
  // Check if this is the booking status accordion and status is confirmed
  const isBookingStatusConfirmed = title === 'Booking Status' && bookingStatus?.name === 'booking_confirmed';
  
  return (
    <div>
      {/* Header */}
      <div 
        className={`flex items-center justify-between py-6 px-6 cursor-pointer transition-colors ${
          isBookingStatusConfirmed 
            ? (isOpen ? 'bg-green-100' : 'bg-green-50 hover:bg-green-100') 
            : (isOpen ? 'bg-gray-100' : 'bg-white hover:bg-gray-50')
        }`}
        onClick={onToggle}
      >
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1">
            <h3 className={`font-semibold text-base uppercase tracking-wide ${
              isBookingStatusConfirmed ? 'text-green-800' : 'text-gray-800'
            }`}>
              {title}
            </h3>
            {description && (
              <p className={`text-sm mt-1 ${
                isBookingStatusConfirmed ? 'text-green-700' : 'text-gray-600'
              }`}>
                {description}
              </p>
            )}
          </div>
        </div>
        <div className={isBookingStatusConfirmed ? 'text-green-600' : 'text-sargood-blue'}>
          {isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </div>
      </div>
      
      {/* Content */}
      {isOpen && (
        <div className="bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

export default CustomAccordionItem;