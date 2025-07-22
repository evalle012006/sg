import React from 'react';

const HorizontalCardSelection = ({ 
  items = [], 
  value = null, 
  onChange, 
  required = false,
  multi = false,
  size = 'medium'
}) => {
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
  
  // Handle the change event for radio (single selection)
  const handleChange = (itemValue) => {
    if (onChange) {
      onChange(itemValue);
    }
  };

  // Handle the change event for checkbox (multi selection)
  const handleCheckboxChange = (itemValue) => {
    if (onChange) {
      if (Array.isArray(value)) {
        if (value.includes(itemValue)) {
          // Remove value if already selected
          onChange(value.filter(v => v !== itemValue));
        } else {
          // Add value if not selected
          onChange([...value, itemValue]);
        }
      } else {
        // Initialize array with the first selection
        onChange([itemValue]);
      }
    }
  };

  // Check if an item is selected
  const isSelected = (itemValue) => {
    if (multi) {
      return Array.isArray(value) && value.includes(itemValue);
    }
    return value === itemValue;
  };

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
        >
          <div className={`flex w-full ${currentSize.card} items-center`}>
            {/* Image container - now uses responsive sizing with proper centering */}
            <div className={`flex-shrink-0 ${currentSize.image} bg-gray-100 flex items-center justify-center overflow-hidden rounded-l-xl`}>
              {item.imageUrl ? (
                <img 
                  src={item.imageUrl} 
                  alt={item.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback to placeholder icon if image fails to load
                    e.target.style.display = 'none';
                    e.target.nextSibling.style.display = 'block';
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
                    onChange={() => handleCheckboxChange(item.value)}
                    required={required && (!Array.isArray(value) || value.length === 0)}
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
                    name="radio-selection"
                    className="sr-only" 
                    value={item.value}
                    checked={isSelected(item.value)}
                    onChange={() => handleChange(item.value)}
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
};

export default HorizontalCardSelection;