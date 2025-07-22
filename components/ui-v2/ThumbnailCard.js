import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import Button from './Button';

const ThumbnailCard = ({ 
  type = "booking",
  bookingId = "-", 
  bookingDate = "-",
  title = "No Room Selected",
  checkInDate = "-",
  checkOutDate = "-",
  status = "Pending",
  statusColor = null,
  image = null,
  description = "-",
  minStayDates = "-",
  buttonText = "EDIT BOOKING",
  hideEditButton = false,
  customButtons = [], 
  onButtonClick = () => console.log("Button clicked"),
  viewDetails = () => console.log("View details clicked"),
  price = null,
  isPaid = false
}) => {
  // State to track if the image has failed to load
  const [imageError, setImageError] = useState(false);
  
  // Default placeholder image similar to the one in the screenshot
  const defaultImage = (
    <div className="flex items-center justify-center bg-gray-100 h-40">
      <div className="w-16 h-16 text-gray-300">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <rect x="3" y="3" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="2"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" strokeWidth="2" fill="none"/>
        </svg>
      </div>
    </div>
  );

  // Handle image load error
  const handleImageError = () => {
    setImageError(true);
  };

  // Map status string to StatusBadge type and icon
  const getStatusConfig = (status) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'approved') {
      return { type: 'success', icon: null};
    }
    if (statusLower === 'pending' || statusLower.includes('pending')) {
      return { type: 'pending', icon: null};
    }
    
    if (statusLower.includes('offer') || statusLower === 'special offer') {
      return { type: 'offer', icon: null };
    }
    
    if (statusLower === 'error') {
      return { type: 'error', icon: null };
    }
    
    if (statusLower === 'cancelled') {
      return { type: 'secondary', icon: null };
    }

    if (statusColor) {
      return { type: 'custom', icon: null, customColor: statusColor };  
    }
    
    return { type: 'primary', icon: null };
  };

  // Get status configuration
  const statusConfig = getStatusConfig(status);

  // Update blue color for consistency
  const blueColor = "#1B457B";

  // Render image section with error handling
  const renderImage = () => {
    // If no image provided or image had an error, show default
    if (!image || imageError) {
      return defaultImage;
    }
    
    // Otherwise render the image with error handler
    return (
      <img 
        src={image} 
        alt={title} 
        className="w-full h-40 object-cover"
        onError={handleImageError}
      />
    );
  };

  // Render paid badge if applicable
  const renderPaidBadge = () => {
    if (!isPaid) return null;
    
    return (
      <div className="inline-flex items-center px-2 py-1 bg-[#1B457B] text-white text-xs rounded-md">
        <svg className="w-3 h-3 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
          <path d="M9 16.17L5.53 12.7a.996.996 0 10-1.41 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71a.996.996 0 10-1.41-1.41L9 16.17z" />
        </svg>
        Paid
      </div>
    );
  };

  // Booking card layout
  const renderBookingCard = () => (
    <div className="bg-white border border-gray-200 overflow-hidden" style={{ boxShadow: '0px 3px 12px 0px #0000001A' }}>
      {/* Image and Status Badge */}
      <div className="relative">
        {renderImage()}

        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge 
            type={statusConfig.type}
            label={status}
            size="small"
            customColor={statusConfig.customColor}
            showIcon={true}
            icon={statusConfig.icon}
          />
        </div>
      </div>

      {/* Booking Details */}
      <div className="p-4">
        {/* Booking ID and Date */}
        <div className="flex justify-between text-sm text-gray-500 mb-3">
          <div>Booking ID: {bookingId}</div>
          <div>{bookingDate}</div>
        </div>

        {/* Room Title */}
        <h3 className="text-lg font-medium text-gray-800 mb-6">{title}</h3>

        {/* Check-in/Check-out */}
        <div className="flex justify-between mb-6 -mx-4 px-4 py-3" style={{ background: '#F9FBFC', border: '1px solid #EBECF0' }}>
          <div>
            <div className="flex items-center mb-1">
              <div className="w-5 h-5 bg-[#1B457B] text-white rounded-full flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                  <path d="M9 16.17L5.53 12.7a.996.996 0 10-1.41 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71a.996.996 0 10-1.41-1.41L9 16.17z" />
                </svg>
              </div>
              <div className="text-xs font-medium">Check-In</div>
            </div>
            <div className="text-xs font-medium ml-7">
              {checkInDate}
            </div>
          </div>

          <div>
            <div className="flex items-center mb-1">
              <div className="w-5 h-5 bg-[#1B457B] text-white rounded-full flex items-center justify-center mr-2">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="12" height="12">
                  <path d="M9 16.17L5.53 12.7a.996.996 0 10-1.41 1.41l4.18 4.18c.39.39 1.02.39 1.41 0L20.29 7.71a.996.996 0 10-1.41-1.41L9 16.17z" />
                </svg>
              </div>
              <div className="text-xs font-medium">Check-Out</div>
            </div>
            <div className="text-xs font-medium ml-7">
              {checkOutDate}
            </div>
          </div>
        </div>

        {/* Edit Button and Custom Buttons - moved to left, price section removed */}
        <div className="flex justify-start items-center gap-2">
          {!hideEditButton && (
            <Button 
              color="legacy-outline"
              size="small"
              label={buttonText}
              onClick={onButtonClick}
              withIcon={true}
              iconName="custom"
              iconSvg={
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              }
            />
          )}
          
          {/* Render custom buttons if provided */}
          {customButtons && customButtons.length > 0 && (
            customButtons.map((button, index) => (
              <React.Fragment key={index}>{button}</React.Fragment>
            ))
          )}
        </div>
      </div>
    </div>
  );

  // Special offer card layout
  const renderOfferCard = () => (
    <div className="bg-white border border-gray-200" style={{ boxShadow: '0px 3px 12px 0px #0000001A' }}>
      {/* Image and Status Badge */}
      <div className="relative">
        {renderImage()}
        
        {/* Status Badge */}
        <div className="absolute top-3 left-3">
          <StatusBadge 
            type={statusConfig.type}
            label={status}
            icon={statusConfig.icon}
            size="small"
          />
        </div>
      </div>

      {/* Offer Details */}
      <div className="p-4">
        {/* Offer Title */}
        <h3 className="text-base font-medium text-gray-800 mb-2">{title}</h3>
        
        {/* Description */}
        <p className="text-xs text-gray-600 mb-4">{description}</p>
        
        {/* Stay dates */}
        <div className="mb-4">
          <div className="text-xs text-gray-500">Minimum dates of stay</div>
          <div className="text-xs font-medium">{minStayDates}</div>
        </div>
        
        <div className="flex justify-between items-center">
          <button 
            onClick={viewDetails}
            className="text-blue-700 text-xs font-medium"
          >
            View details
          </button>
          
          {/* Render custom buttons array or default button */}
          <div className="flex flex-wrap gap-2">
            {customButtons && customButtons.length > 0 ? (
              customButtons.map((button, index) => (
                <React.Fragment key={index}>{button}</React.Fragment>
              ))
            ) : (
              <Button 
                color="primary"
                size="small"
                label={buttonText}
                onClick={onButtonClick}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return type === "offer" ? renderOfferCard() : renderBookingCard();
};

export default ThumbnailCard;