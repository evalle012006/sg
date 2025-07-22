import React, { useState, useEffect, useCallback, useRef } from 'react';

const CardSelection = ({ 
  items = [], 
  value = null, 
  onChange, 
  required = false,
  multi = false,
  size = 'medium',
  builderMode = false,
  optionType = null,
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  ...restProps
}) => {
  const [dynamicItems, setDynamicItems] = useState(items);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [localInputValues, setLocalInputValues] = useState({});
  const updateTimeoutRef = useRef({});

  // Function to auto-generate value from label
  const generateValueFromLabel = (label) => {
    if (!label) return '';
    return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  // Fetch active courses from API
  const fetchActiveCourses = async () => {
    try {
      setCoursesLoading(true);
      const response = await fetch('/api/courses?active=true');
      const data = await response.json();
      
      if (data.success) {
        return data.courses.map(course => ({
          label: course.title,
          value: generateValueFromLabel(course.title),
          description: course.description || '',
          imageFilename: course.image_filename || null,
          imageUrl: course.imageUrl || null
        }));
      } else {
        console.error('Failed to fetch courses:', data);
        return [];
      }
    } catch (error) {
      console.error('Error fetching courses:', error);
      return [];
    } finally {
      setCoursesLoading(false);
    }
  };

  // Auto-fetch courses when option type is "course" and in builder mode
  useEffect(() => {
    if (optionType === 'course') {
      // If items array is empty, fetch courses automatically
      if (!items || items.length === 0) {
        fetchActiveCourses().then(courses => {
          setDynamicItems(courses);
        });
      } else {
        // In builder mode, don't override dynamicItems if we have manually added items
        // Only set dynamicItems if it's currently empty (initial load)
        if (dynamicItems.length === 0) {
          setDynamicItems(items);
        }
      }
    } else {
      // For non-course types, always use items directly in builder mode
      // Only use dynamicItems for course auto-fetching
      if (!builderMode) {
        setDynamicItems(items);
      }
    }
  }, [optionType, items]);

  // Use appropriate items for display
  const displayItems = builderMode ? 
    (optionType === 'course' && (!items || items.length === 0) ? dynamicItems : items) : 
    dynamicItems;

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
    console.log(itemValue, 'itemValue in handleChange');
    if (onChange && !builderMode) {
      onChange(itemValue);
    }
  };

  // Handle the change event for checkbox (multi selection)
  const handleCheckboxChange = (itemValue) => {
    if (onChange && !builderMode) {
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

  // Initialize local input values when items change
  useEffect(() => {
    const initialValues = {};
    displayItems.forEach((item, index) => {
      initialValues[`${index}-label`] = item.label || '';
      initialValues[`${index}-description`] = item.description || '';
    });
    setLocalInputValues(initialValues);
  }, [displayItems.length]); // Only reinitialize when the number of items changes

  // Debounced update function
  const debouncedUpdate = useCallback((index, field, value) => {
    const key = `${index}-${field}`;
    
    // Clear existing timeout for this field
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
    }
    
    // Set new timeout
    updateTimeoutRef.current[key] = setTimeout(() => {
      if (updateOptionLabel) {
        if (field === 'label') {
          const autoGeneratedValue = generateValueFromLabel(value);
          
          // Update both label and auto-generated value
          updateOptionLabel(
            { target: { value }, stopPropagation: () => {} },
            { index, label: value, field: 'label' },
            'card-selection'
          );
          
          // Also update the value with auto-generated one
          setTimeout(() => {
            updateOptionLabel(
              { target: { value: autoGeneratedValue }, stopPropagation: () => {} },
              { index, label: autoGeneratedValue, field: 'value' },
              'card-selection'
            );
          }, 0);
        } else {
          updateOptionLabel(
            { target: { value }, stopPropagation: () => {} },
            { index, label: value, field },
            'card-selection'
          );
        }
      }
      delete updateTimeoutRef.current[key];
    }, 1000); // 1 second delay
  }, [updateOptionLabel]);

  // Handle immediate local input updates (for visual feedback)
  const handleLocalInputChange = useCallback((index, field, value) => {
    const key = `${index}-${field}`;
    setLocalInputValues(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Trigger debounced update
    debouncedUpdate(index, field, value);
  }, [debouncedUpdate]);

  // Handle immediate update on blur (when user loses focus)
  const handleInputBlur = useCallback((index, field, value) => {
    const key = `${index}-${field}`;
    
    // Clear any pending debounced update
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
      delete updateTimeoutRef.current[key];
    }
    
    // Immediately update
    if (updateOptionLabel) {
      if (field === 'label') {
        const autoGeneratedValue = generateValueFromLabel(value);
        
        updateOptionLabel(
          { target: { value }, stopPropagation: () => {} },
          { index, label: value, field: 'label' },
          'card-selection'
        );
        
        setTimeout(() => {
          updateOptionLabel(
            { target: { value: autoGeneratedValue }, stopPropagation: () => {} },
            { index, label: autoGeneratedValue, field: 'value' },
            'card-selection'
          );
        }, 0);
      } else {
        updateOptionLabel(
          { target: { value }, stopPropagation: () => {} },
          { index, label: value, field },
          'card-selection'
        );
      }
    }
  }, [updateOptionLabel]);

  // Handle card click for selection (only in display mode)
  const handleCardClick = useCallback((itemValue, event) => {
    // Don't handle clicks in builder mode or if clicking on input elements
    if (builderMode) return;
    
    // Don't handle if clicking on interactive elements
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'BUTTON' || event.target.tagName === 'LABEL') {
      return;
    }

    if (multi) {
      handleCheckboxChange(itemValue);
    } else {
      handleChange(itemValue);
    }
  }, [builderMode, multi, handleCheckboxChange, handleChange]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(updateTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Handle image upload
  const handleImageUpload = (index, file) => {
    if (onImageUpload) {
      onImageUpload(index, file);
    }
  };

  // Handle option removal with image cleanup (dynamic file path)
  const handleOptionRemoval = async (index) => {
    const item = displayItems[index];
    
    // Only allow removal if not in course auto-populate mode
    if (builderMode && optionType === 'course' && (!items || items.length === 0)) {
      // This is an auto-populated course, don't allow removal
      return;
    }
    
    // If there's an imageFilename, delete it from storage first
    if (item.imageFilename) {
      try {
        // Delete the image from storage using the dynamic option type
        await fetch(`/api/storage/upload?filename=${item.imageFilename}&filepath=${optionType}/`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.warn('Failed to delete image from storage:', error);
        // Continue with option removal even if image deletion fails
      }
    }
    
    // Clean up blob URLs to prevent memory leaks
    if (item.imageUrl && item.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.imageUrl);
    }
    
    // Remove the option
    if (handleRemoveOption) {
      handleRemoveOption(null, index, 'card-selection');
    }
  };

  // Handle image removal (just the image, not the entire option) with dynamic file path
  const handleImageRemove = async (index) => {
    const item = displayItems[index];
    
    // If there's an imageFilename, delete it from storage first
    if (item.imageFilename) {
      try {
        // Delete the image from storage using the dynamic option type
        await fetch(`/api/storage/upload?filename=${item.imageFilename}&filepath=${optionType}/`, {
          method: 'DELETE'
        });
      } catch (error) {
        console.warn('Failed to delete image from storage:', error);
      }
    }
    
    // Clean up blob URLs
    if (item.imageUrl && item.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.imageUrl);
    }
    
    // Update the option to remove both image references
    if (updateOptionLabel) {
      updateOptionLabel(
        { target: { value: null }, stopPropagation: () => {} }, // Mock event object
        { index, field: 'imageFilename' },
        'card-selection'
      );
    }
  };

  // Get placeholder text based on option type
  const getPlaceholderText = (field) => {
    const placeholders = {
      funder: {
        title: 'Funder name',
        description: 'Funding description',
        addLabel: 'Add Funder Image'
      },
      course: {
        title: 'Course name',
        description: 'Course description', 
        addLabel: 'Add Course Image'
      }
    };
    
    return placeholders[optionType] || placeholders.funder;
  };

  // Show loading state for courses
  if (coursesLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="flex flex-col items-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <span className="text-sm text-gray-600">Loading courses...</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full ${currentSize.container}`}>
      {builderMode && optionType === 'course' && displayItems.length > 0 && (!items || items.length === 0) && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center">
            <svg className="h-4 w-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-sm text-blue-700">
              Showing active courses. Select courses to add them to this question.
            </span>
          </div>
        </div>
      )}
      
      {displayItems.map((item, index) => (
        <div
          key={item.value || index}
          onClick={(e) => handleCardClick(item.value, e)}
          className={`flex border-2 rounded-xl transition-all duration-200 ${
            !builderMode && isSelected(item.value) 
              ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200' 
              : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
          } ${builderMode ? 'border-dashed border-gray-400 bg-gray-50' : 'cursor-pointer hover:bg-gray-50'}`}
        >
          <div className={`flex w-full ${currentSize.card} items-center`}>
            {/* Image container with upload functionality in builder mode */}
            <div className={`flex-shrink-0 w-24 bg-gray-100 flex items-center justify-center overflow-hidden rounded-l-xl relative group self-stretch`}>
              {(() => {
                // Use the imageUrl directly from the item (provided by backend)
                const imageUrl = item.imageUrl;
                
                if (item.uploading) {
                  // Show loading spinner during upload
                  return (
                    <div className="flex items-center justify-center w-full h-full bg-gray-200">
                      <div className="flex flex-col items-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
                        <span className="text-xs text-gray-600">Uploading...</span>
                      </div>
                    </div>
                  );
                }
                
                if (item.uploadError) {
                  // Show error state
                  return (
                    <div className="flex flex-col items-center justify-center text-red-500 w-full h-full bg-red-50">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <span className="text-xs text-center px-2">Upload Failed</span>
                    </div>
                  );
                }
                
                if (imageUrl) {
                  return (
                    <>
                      <img 
                        src={imageUrl} 
                        alt={item.label}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to placeholder when image fails to load
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'flex';
                        }}
                      />
                      <div className="text-gray-400 hidden w-full h-full bg-gray-200 flex-col items-center justify-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs text-center px-2">Image not found</span>
                      </div>
                      {builderMode && (
                        <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <label className="cursor-pointer bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-2 transition-all duration-200 shadow-lg">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  handleImageUpload(index, file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </>
                  );
                } else {
                  return (
                    <div className={`text-gray-400 w-full h-full bg-gray-200 flex flex-col items-center justify-center ${builderMode ? 'relative group' : ''}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                      </svg>
                      <span className="text-xs text-center px-2">No Image</span>
                      {builderMode && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <label 
                            className="cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-white bg-opacity-90 hover:bg-opacity-100 rounded-full p-3 shadow-lg"
                            title={getPlaceholderText().addLabel}
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files[0];
                                if (file) {
                                  handleImageUpload(index, file);
                                }
                              }}
                            />
                          </label>
                        </div>
                      )}
                    </div>
                  );
                }
              })()}
            </div>
            
            {/* Content container */}
            <div className={`flex flex-col flex-grow justify-center ${currentSize.content} ${builderMode ? 'space-y-2' : ''}`}>
              {builderMode ? (
                // Builder mode: editable fields (value auto-generated from label)
                <div className="space-y-2">
                  <input
                    type="text"
                    value={localInputValues[`${index}-label`] ?? item.label ?? ''}
                    onChange={(e) => handleLocalInputChange(index, 'label', e.target.value)}
                    onBlur={(e) => handleInputBlur(index, 'label', e.target.value)}
                    className={`${currentSize.title} text-gray-800 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full`}
                    placeholder={getPlaceholderText().title}
                    onFocus={(e) => e.target.select()}
                  />
                  <textarea
                    value={localInputValues[`${index}-description`] ?? item.description ?? ''}
                    onChange={(e) => handleLocalInputChange(index, 'description', e.target.value)}
                    onBlur={(e) => handleInputBlur(index, 'description', e.target.value)}
                    className={`${currentSize.description} text-gray-600 bg-transparent border-b border-gray-300 focus:border-blue-500 focus:outline-none w-full resize-none`}
                    placeholder={getPlaceholderText().description}
                    rows="2"
                    onFocus={(e) => e.target.select()}
                  />
                </div>
              ) : (
                // Display mode: static content
                <>
                  <div className={`${currentSize.title} text-gray-800 mb-2`}>{item.label}</div>
                  <div className={`${currentSize.description} text-gray-600 leading-relaxed`}>{item.description}</div>
                </>
              )}
            </div>
            
            {/* Selection control or remove button */}
            <div className={`flex-shrink-0 flex items-center justify-center ml-auto ${currentSize.controlPadding}`}>
              {builderMode ? (
                // Builder mode: remove button (only for manually added options)
                <>
                  {!(optionType === 'course' && (!items || items.length === 0)) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOptionRemoval(index);
                      }}
                      className="text-red-500 hover:text-red-700 transition-colors p-1 rounded hover:bg-red-50"
                      title="Remove option"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                  {optionType === 'course' && (!items || items.length === 0) && (
                    <div className="text-blue-500 text-xs">Auto-loaded</div>
                  )}
                </>
              ) : (
                // Display mode: selection control
                <>
                  {multi ? (
                    // Checkbox for multi-selection (circular)
                    <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
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
                    </label>
                  ) : (
                    // Radio button for single selection (with checkmark)
                    <label className="cursor-pointer" onClick={(e) => e.stopPropagation()}>
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
                    </label>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default CardSelection;