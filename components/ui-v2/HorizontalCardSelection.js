import React, { useState, useEffect, useCallback, useRef, memo } from 'react';

const HorizontalCardSelection = memo(({ 
  items = [], 
  value = null, 
  onChange, 
  required = false,
  multi = false,
  size = 'medium'
}) => {
  // Local state for immediate UI updates
  const [localValue, setLocalValue] = useState(value);
  const [isUpdating, setIsUpdating] = useState(false);
  
  // Ref for debounced updates
  const updateTimeoutRef = useRef(null);
  const mountedRef = useRef(true);

  // Size configuration
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
      placeholderIcon: 'w-5 h-5'
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
      placeholderIcon: 'w-6 h-6'
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
      placeholderIcon: 'w-7 h-7'
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
      placeholderIcon: 'w-8 h-8'
    }
  };

  // Get current size configuration
  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Sync local value with prop changes (only when not updating)
  useEffect(() => {
    if (!isUpdating && JSON.stringify(value) !== JSON.stringify(localValue)) {
      console.log('🔄 Syncing localValue with prop value:', value);
      setLocalValue(value);
    }
  }, [value, isUpdating, localValue]);

  // Debounced update to parent
  const debouncedOnChange = useCallback((newValue) => {
    if (!mountedRef.current) return;
    
    // Clear existing timeout
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    // Set updating flag to prevent sync conflicts
    setIsUpdating(true);

    // Update parent after delay
    updateTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current && onChange) {
        console.log('📤 Sending debounced update to parent:', newValue);
        onChange(newValue);
        setIsUpdating(false);
      }
    }, 150); // Reduced debounce time for better responsiveness

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [onChange]);

  // Handle immediate local updates
  const handleLocalChange = useCallback((itemValue) => {
    let newValue;
    
    if (multi) {
      const currentArray = Array.isArray(localValue) ? localValue : [];
      if (currentArray.includes(itemValue)) {
        // Remove value if already selected
        newValue = currentArray.filter(v => v !== itemValue);
      } else {
        // Add value if not selected
        newValue = [...currentArray, itemValue];
      }
    } else {
      // Single selection - toggle or select
      newValue = localValue === itemValue ? null : itemValue;
    }

    console.log('🎯 Local change:', { itemValue, oldValue: localValue, newValue });
    
    // Update local state immediately for UI responsiveness
    setLocalValue(newValue);
    
    // Debounce parent update
    debouncedOnChange(newValue);
  }, [localValue, multi, debouncedOnChange]);

  // Check if an item is selected (use local value for immediate feedback)
  const isSelected = useCallback((itemValue) => {
    if (multi) {
      return Array.isArray(localValue) && localValue.includes(itemValue);
    }
    return localValue === itemValue;
  }, [localValue, multi]);

  // Handle card click
  const handleCardClick = useCallback((itemValue, event) => {
    event.preventDefault();
    event.stopPropagation();
    handleLocalChange(itemValue);
  }, [handleLocalChange]);

  // Handle checkbox/radio input changes
  const handleInputChange = useCallback((itemValue) => {
    handleLocalChange(itemValue);
  }, [handleLocalChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, []);

  return (
    <div className={`flex flex-col w-full ${currentSize.container}`}>
      {items.map((item) => (
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
            {/* Image container */}
            <div className={`flex-shrink-0 ${currentSize.image} bg-gray-100 flex items-center justify-center overflow-hidden rounded-l-xl`}>
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.style.display = 'none';
                    if (e.target.nextSibling) {
                      e.target.nextSibling.style.display = 'block';
                    }
                  }}
                />
              ) : null}
              <div className={`text-gray-400 ${item.imageUrl ? 'hidden' : 'block'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" className={currentSize.placeholderIcon} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            </div>
            
            {/* Content container */}
            <div className={`flex flex-col flex-grow justify-center ${currentSize.content}`}>
              <div className={`${currentSize.title} text-gray-800 mb-2`}>{item.label}</div>
              <div className={`${currentSize.description} text-gray-600 leading-relaxed`}>{item.description}</div>
            </div>
            
            {/* Selection control */}
            <div className={`flex-shrink-0 flex items-center justify-center ml-auto ${currentSize.controlPadding}`}>
              {multi ? (
                // Checkbox for multi-selection (circular)
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
                // Radio button for single selection (with checkmark)
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
      ))}
    </div>
  );
});

HorizontalCardSelection.displayName = 'HorizontalCardSelection';

export default HorizontalCardSelection;