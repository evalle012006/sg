import React, { useState } from 'react';
import StatusBadge from './StatusBadge'; // Use your existing StatusBadge component

const Card = ({
  title = "Activity Title",
  image = null,
  isSpecialOffer = false,
  status = "Special offer", // Changed from offerStatus to status to match ThumbnailCard
  minStayDates = null,
  startDate = null,
  endDate = null,
  onViewDetails = () => console.log("View details clicked"),
  onBookNow = () => console.log("Book now clicked"),
  showBookNow = false,
  customButtons = [] // Added support for custom buttons like in ThumbnailCard
}) => {
  // State to track if the image has failed to load
  const [imageError, setImageError] = useState(false);
  
  // Format dates if provided
  const formattedDateRange = startDate && endDate ? 
    `${startDate} - ${endDate}` : 
    null;
  
  // Default placeholder image similar to the one in ThumbnailCard
  const defaultImage = (
    <div className="flex items-center justify-center bg-gray-100 h-24 md:h-28 lg:h-32 w-full rounded-l">
      <div className="w-12 h-12 text-gray-300">
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

  // Map status string to StatusBadge type and icon - using exact same function from ThumbnailCard
  const getStatusConfig = (status) => {
    const statusLower = status.toLowerCase();
    
    if (statusLower === 'approved' || statusLower.includes('confirmed')) {
      return { type: 'success', icon: null };
    }
    
    if (statusLower.includes('pending')) {
      return { type: 'pending', icon: null };
    }
    
    if (statusLower.includes('offer') || statusLower === 'special offer') {
      return { type: 'offer', icon: null };
    }
    
    if (statusLower === 'error') {
      return { type: 'error', icon: null };
    }
    
    if (statusLower.includes('cancelled')) {
      return { type: 'secondary', icon: null };
    }
    
    return { type: 'primary', icon: null };
  };

  // Get status configuration
  const statusConfig = getStatusConfig(status);

  // Render image section with error handling
  const renderImage = () => {
    if (!image || imageError) {
      return defaultImage;
    }
    
    return (
      <img 
        src={image} 
        alt={title} 
        className="h-24 md:h-28 lg:h-32 w-full object-cover rounded-l"
        onError={handleImageError}
      />
    );
  };

  // Render custom buttons if provided - similar to ThumbnailCard
  const renderButtons = () => {
    if (customButtons && customButtons.length > 0) {
      return (
        <div className="flex flex-wrap gap-2">
          {customButtons.map((button, index) => (
            <React.Fragment key={index}>{button}</React.Fragment>
          ))}
        </div>
      );
    }
    
    if (showBookNow) {
      return (
        <button 
          onClick={onBookNow}
          className="bg-yellow-400 text-black font-medium text-xs py-1 px-3 rounded hover:bg-yellow-500 transition-colors duration-200"
        >
          BOOK NOW
        </button>
      );
    }
    
    return null;
  };

  return (
    <div className="bg-white rounded shadow flex flex-row w-full hover:shadow-md transition-shadow duration-300">
      {/* Left side - Image with status badge */}
      <div className="relative w-1/3 flex-shrink-0">
        {renderImage()}
        
        {/* Status Badge - only show if isSpecialOffer is true */}
        {isSpecialOffer && (
          <div className="absolute top-3 left-3">
            <StatusBadge 
              type={statusConfig.type}
              label={status}
              icon={statusConfig.icon}
              size="small"
            />
          </div>
        )}
      </div>

      {/* Right side - Content */}
      <div className="p-3 flex flex-col justify-between w-2/3">
        <div>
          {/* Title */}
          <h3 className="text-base font-medium text-gray-800 mb-1">{title}</h3>
          
          {/* Minimum dates of stay or dates */}
          {(minStayDates || formattedDateRange) && (
            <div className="mb-2">
              <div className="text-xs text-gray-500">
                {minStayDates ? "Minimum dates of stay" : ""}
              </div>
              <div className="text-xs font-medium">
                {minStayDates || formattedDateRange}
              </div>
            </div>
          )}
        </div>
        
        {/* Bottom actions */}
        <div className="flex justify-between items-center mt-auto">
          <button 
            onClick={onViewDetails}
            className="text-blue-700 text-xs font-medium hover:underline"
          >
            View details
          </button>
          
          {renderButtons()}
        </div>
      </div>
    </div>
  );
};

export default Card;