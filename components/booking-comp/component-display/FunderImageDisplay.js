import React, { useState, useEffect } from 'react';
import { CreditCard } from 'lucide-react';

const FunderImageDisplay = ({ funderDisplay }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchImageUrl = async () => {
      // If imageUrl already exists (from question data), use it
      if (funderDisplay?.imageUrl) {
        setImageUrl(funderDisplay.imageUrl);
        return;
      }

      // If imageFilename exists but no imageUrl, fetch it from storage API
      if (funderDisplay?.imageFilename && !imageError) {
        setImageLoading(true);
        setImageError(false);

        try {
          const response = await fetch(`/api/storage/upload?filename=${funderDisplay.imageFilename}&filepath=funder/`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.fileUrl) {
              setImageUrl(data.fileUrl);
            } else {
              setImageError(true);
            }
          } else {
            setImageError(true);
          }
        } catch (error) {
          console.error('Error fetching funder image URL:', error);
          setImageError(true);
        } finally {
          setImageLoading(false);
        }
      }
    };

    fetchImageUrl();
  }, [funderDisplay?.imageUrl, funderDisplay?.imageFilename, imageError]);

  if (!funderDisplay) {
    return (
      <div className="text-center py-8">
        <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No funding information available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-6">
        {/* Funder Image - from storage API - Made bigger */}
        {(imageUrl || imageLoading) && (
          <div className="flex-shrink-0">
            {imageLoading ? (
              <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <img 
                src={imageUrl}
                alt={funderDisplay.label}
                className="w-32 h-32 object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )}
        
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">{funderDisplay.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FunderImageDisplay;