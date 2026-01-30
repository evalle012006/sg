import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import ImageModal from './ImageModal';
import { getDefaultImage } from '../../lib/defaultImages';

const HorizontalCardSelection = memo(({ 
  items = [], 
  value = null, 
  onChange, 
  required = false,
  multi = false,
  size = 'medium',
  origin = null,
}) => {
  const [localValue, setLocalValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);
  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState({ url: '', alt: '' });
  const [imageStates, setImageStates] = useState({}); // { index: { loading: bool, error: bool, url: string } }
  
  const updateTimeoutRef = useRef(null);
  const mountedRef = useRef(true);
  const imageTimeoutsRef = useRef({});

  const sizeConfig = {
    small: {
      container: 'gap-2',
      card: 'min-h-[80px]',
      image: 'w-16 h-16',
      content: 'px-3 py-2',
      title: 'font-medium text-sm',
      description: 'text-xs',
      control: 'w-4 h-4',
      controlIcon: 'h-3 w-3',
      controlPadding: 'pr-3',
      placeholderIcon: 'w-5 h-5',
      spinner: 'h-6 w-6'
    },
    medium: {
      container: 'gap-2',
      card: 'min-h-[100px]',
      image: 'w-24 h-24',
      content: 'px-4 py-3',
      title: 'font-semibold text-base',
      description: 'text-sm',
      control: 'w-5 h-5',
      controlIcon: 'h-3 w-3',
      controlPadding: 'pr-4',
      placeholderIcon: 'w-6 h-6',
      spinner: 'h-8 w-8'
    },
    large: {
      container: 'gap-3',
      card: 'min-h-[120px]',
      image: 'w-32 h-32',
      content: 'px-5 py-4',
      title: 'font-semibold text-lg',
      description: 'text-base',
      control: 'w-6 h-6',
      controlIcon: 'h-4 w-4',
      controlPadding: 'pr-5',
      placeholderIcon: 'w-7 h-7',
      spinner: 'h-10 w-10'
    },
    'extra-large': {
      container: 'gap-3',
      card: 'min-h-[140px]',
      image: 'w-48 h-36',
      content: 'px-6 py-4',
      title: 'font-semibold text-xl',
      description: 'text-lg',
      control: 'w-7 h-7',
      controlIcon: 'h-4 w-4',
      controlPadding: 'pr-6',
      placeholderIcon: 'w-8 h-8',
      spinner: 'h-12 w-12'
    }
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Initialize image states when items change
  useEffect(() => {
    const initialStates = {};
    items.forEach((item, index) => {
      const hasCustomImage = Boolean(item.imageUrl);
      initialStates[index] = {
        loading: hasCustomImage, // Only show loading for custom images
        error: false,
        url: hasCustomImage ? item.imageUrl : getDefaultImage('equipment'),
        hasCustomImage
      };
    });
    setImageStates(initialStates);

    // Clear any existing timeouts
    Object.values(imageTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    imageTimeoutsRef.current = {};
  }, [items]);

  // Foolproof timeout: force clear loading state after 3 seconds
  useEffect(() => {
    items.forEach((item, index) => {
      const state = imageStates[index];
      if (state?.loading) {
        // Clear any existing timeout for this index
        if (imageTimeoutsRef.current[index]) {
          clearTimeout(imageTimeoutsRef.current[index]);
        }

        // Set new timeout
        imageTimeoutsRef.current[index] = setTimeout(() => {
          console.warn(`Image ${index} timeout - forcing default image`);
          setImageStates(prev => ({
            ...prev,
            [index]: {
              ...prev[index],
              loading: false,
              error: true,
              url: getDefaultImage('equipment')
            }
          }));
        }, 3000); // 3 second timeout
      }
    });

    return () => {
      Object.values(imageTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, [imageStates, items]);

  useEffect(() => {
    if (!isUpdating && JSON.stringify(value) !== JSON.stringify(localValue)) {
      setLocalValue(value);
    }
  }, [value, isUpdating, localValue]);

  const debouncedOnChange = useCallback((newValue) => {
    if (!mountedRef.current) return;
    
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    setIsUpdating(true);

    updateTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && onChange) {
        onChange(newValue);
        setIsUpdating(false);
      }
    }, 150);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [onChange]);

  const handleLocalChange = useCallback((itemValue) => {
    let newValue;
    
    if (multi) {
      const currentArray = Array.isArray(localValue) ? localValue : [];
      if (currentArray.includes(itemValue)) {
        newValue = currentArray.filter(v => v !== itemValue);
      } else {
        newValue = [...currentArray, itemValue];
      }
    } else {
      newValue = localValue === itemValue ? null : itemValue;
    }
    
    setLocalValue(newValue);
    debouncedOnChange(newValue);
  }, [localValue, multi, debouncedOnChange]);

  const isSelected = useCallback((itemValue) => {
    if (multi) {
      return Array.isArray(localValue) && localValue.includes(itemValue);
    }
    return localValue === itemValue;
  }, [localValue, multi]);

  const handleCardClick = useCallback((itemValue, event) => {
    event.preventDefault();
    event.stopPropagation();
    handleLocalChange(itemValue);
  }, [handleLocalChange]);

  const handleInputChange = useCallback((itemValue) => {
    handleLocalChange(itemValue);
  }, [handleLocalChange]);

  const handleImageError = useCallback((index) => {
    console.log(`Image ${index} error - switching to default`);
    
    // Clear timeout for this image
    if (imageTimeoutsRef.current[index]) {
      clearTimeout(imageTimeoutsRef.current[index]);
      delete imageTimeoutsRef.current[index];
    }

    setImageStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        loading: false,
        error: true,
        url: getDefaultImage('equipment')
      }
    }));
  }, []);

  const handleImageLoad = useCallback((index) => {
    // console.log(`Image ${index} loaded successfully`);
    
    // Clear timeout for this image
    if (imageTimeoutsRef.current[index]) {
      clearTimeout(imageTimeoutsRef.current[index]);
      delete imageTimeoutsRef.current[index];
    }

    setImageStates(prev => ({
      ...prev,
      [index]: {
        ...prev[index],
        loading: false,
        error: false
      }
    }));
  }, []);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
      Object.values(imageTimeoutsRef.current).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  return (
    <div className={`flex flex-col w-full ${currentSize.container}`}>
      {items.map((item, index) => {
        const state = imageStates[index] || { loading: false, error: false, url: getDefaultImage('equipment'), hasCustomImage: false };
        const { loading, error, url, hasCustomImage } = state;
        
        return (
          <label
            key={item.value}
            className={`flex cursor-pointer items-center border-2 rounded-xl transition-all duration-200 ${
              isSelected(item.value) 
                ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
            }`}
            onClick={(e) => handleCardClick(item.value, e)}
          >
            <div className={`flex w-full ${currentSize.card} items-center`}>
              <div className={`flex-shrink-0 ${currentSize.image} bg-gray-100 flex items-center justify-center overflow-hidden ${origin == 'room' ? '' : 'rounded-l-xl'} relative group`}>
                {/* Loading spinner overlay - only show if still loading */}
                {loading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-100 z-10">
                    <div className={`animate-spin rounded-full ${currentSize.spinner} border-b-2 border-blue-600`}></div>
                  </div>
                )}
                
                {/* Image - always render, hide with opacity if loading */}
                <img 
                  src={url} 
                  alt={item.label}
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    loading ? 'opacity-0' : 'opacity-100'
                  } ${!hasCustomImage || error ? 'opacity-50' : ''}`}
                  onLoad={() => handleImageLoad(index)}
                  onError={() => handleImageError(index)}
                  loading="eager"
                />
                
                {/* Zoom button overlay - only for successfully loaded custom images */}
                {hasCustomImage && !error && !loading && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setSelectedImage({ url: item.imageUrl, alt: item.label });
                      setImageModalOpen(true);
                    }}
                    className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-50 transition-all duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100"
                    title="Click to enlarge"
                  >
                    <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
                    </svg>
                  </button>
                )}
              </div>
              
              {/* Content container */}
              <div className={`flex flex-col flex-grow justify-center ${currentSize.content}`}>
                <div className={`${currentSize.title} text-gray-800 mb-2`}>{item.label}</div>
                <div className={`${currentSize.description} text-gray-600 leading-relaxed`}>{item.description}</div>
              </div>
              
              {/* Selection control */}
              <div className={`flex-shrink-0 flex items-center justify-center ml-auto ${currentSize.controlPadding}`}>
                {multi ? (
                  <div className={`${currentSize.control} rounded-full border-2 flex items-center justify-center ${
                    isSelected(item.value) 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-gray-300'
                  }`}>
                    {isSelected(item.value) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={currentSize.controlIcon + " text-white"} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <input
                      type="checkbox"
                      className="sr-only" 
                      value={item.value}
                      checked={isSelected(item.value)}
                      onChange={() => handleInputChange(item.value)}
                      required={required && (!Array.isArray(localValue) || localValue.length === 0)}
                    />
                  </div>
                ) : (
                  <div className={`${currentSize.control} rounded-full border-2 flex items-center justify-center ${
                    isSelected(item.value) 
                      ? 'border-blue-600 bg-blue-600' 
                      : 'border-gray-300'
                  }`}>
                    {isSelected(item.value) && (
                      <svg xmlns="http://www.w3.org/2000/svg" className={currentSize.controlIcon + " text-white"} viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    <input
                      type="radio"
                      name="horizontal-card-selection"
                      className="sr-only" 
                      value={item.value}
                      checked={isSelected(item.value)}
                      onChange={() => handleInputChange(item.value)}
                      required={required}
                    />
                  </div>
                )}
              </div>
            </div>
          </label>
        );
      })}
      {/* Image Modal */}
      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        imageUrl={selectedImage.url}
        altText={selectedImage.alt}
      />
    </div>
  );
});

HorizontalCardSelection.displayName = 'HorizontalCardSelection';

export default HorizontalCardSelection;