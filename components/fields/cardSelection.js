import React, { useState, useEffect, useCallback, useRef } from 'react';

// Simple global flag to prevent multiple API calls
let coursesFetched = false;
let coursesFetching = false;
let globalCoursesData = null;

const CardSelection = ({ 
  items = [], 
  value = null, 
  onChange, 
  required = false,
  multi = false,
  size = 'medium',
  builderMode = false,
  optionType = null, // ← KEY: Now correctly receives optionType
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  guestId = null,        // Guest ID for fetching course offers
  bookingId = null,      // Booking ID as fallback
  currentUser = null,    // Current user as fallback
  ...restProps
}) => {
  const [dynamicItems, setDynamicItems] = useState(items);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [localInputValues, setLocalInputValues] = useState({});
  const updateTimeoutRef = useRef({});
  
  // Track if this component instance has been initialized
  const [initialized, setInitialized] = useState(false);

  const getGuestId = () => {
    // Priority: explicit guestId prop > bookingId > currentUser.id
    if (guestId) {
      return guestId;
    }
    if (bookingId) {
      return bookingId;
    }
    if (currentUser?.id) {
      return currentUser.id;
    }
    return null;
  };

  // Size configurations
  const sizeConfig = {
    small: {
      container: 'space-y-2',
      card: 'p-3',
      title: 'text-sm font-medium',
      description: 'text-xs',
      image: 'w-12 h-12',
      control: 'w-5 h-5',
      controlIcon: 'w-3 h-3'
    },
    medium: {
      container: 'space-y-3',
      card: 'p-4',
      title: 'text-base font-medium',
      description: 'text-sm',
      image: 'w-16 h-16',
      control: 'w-6 h-6',
      controlIcon: 'w-4 h-4'
    },
    large: {
      container: 'space-y-4',
      card: 'p-6',
      title: 'text-lg font-semibold',
      description: 'text-base',
      image: 'w-20 h-20',
      control: 'w-7 h-7',
      controlIcon: 'w-5 h-5'
    }
  };

  const currentSize = sizeConfig[size] || sizeConfig.medium;

  // Function to auto-generate value from label
  const generateValueFromLabel = (label) => {
    if (!label) return '';
    return label.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  };

  const fetchActiveCourses = async () => {
    // If already fetching or fetched, don't fetch again
    if (coursesFetching) {
      if (globalCoursesData) {
        return globalCoursesData;
      }
      return [];
    }

    try {
      coursesFetching = true;
      setCoursesLoading(true);
      
      let apiUrl;
      let courses = [];

      if (builderMode) {
        // Builder mode: Fetch all active courses (current behavior)
        console.log('🔄 [Builder Mode] Fetching all active courses from API...');
        apiUrl = '/api/courses?active=true';
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.courses)) {
          courses = data.courses.map(course => ({
            label: course.title || 'Untitled Course',
            value: course.id?.toString() || generateValueFromLabel(course.title || 'untitled-course'),
            description: course.description || '',
            imageFilename: course.image_filename || null,
            imageUrl: course.imageUrl || null
          }));
        }
      } else {
        // Guest mode: Fetch only offered courses for this guest
        const currentGuestId = getGuestId();
        
        if (!currentGuestId) {
          console.warn('⚠️ No guest ID available for fetching course offers');
          return [];
        }

        console.log('🔄 [Guest Mode] Fetching offered courses for guest:', currentGuestId);
        apiUrl = `/api/guests/${currentGuestId}/course-offers`;
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          if (response.status === 404) {
            console.log('📭 No course offers found for guest:', currentGuestId);
            return [];
          }
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && Array.isArray(data.courseOffers)) {
          courses = data.courseOffers.map(offer => ({
            label: offer.courseName || 'Untitled Course',
            value: offer.courseId?.toString() || offer.id?.toString(),
            description: offer.courseDescription || '',
            imageFilename: null, // Course offers don't typically have images
            imageUrl: null,
            // Add additional info from course offer
            offerStatus: offer.offerStatus,
            minStartDate: offer.minStartDate,
            minEndDate: offer.minEndDate
          }));
          
          console.log('✅ Found course offers:', courses.length);
        } else {
          console.log('📭 No course offers in response');
        }
      }
      
      // Store globally only if we have courses
      if (courses.length > 0) {
        globalCoursesData = courses;
        coursesFetched = true;
        console.log(`✅ Courses fetched successfully: ${courses.length} courses (${builderMode ? 'all active' : 'offered only'})`);
      } else {
        console.log(`📭 No courses available (${builderMode ? 'no active courses' : 'no course offers'})`);
      }
      
      return courses;
    } catch (error) {
      console.error('❌ Error fetching courses:', error);
      return [];
    } finally {
      coursesFetching = false;
      setCoursesLoading(false);
    }
  };
  // ENHANCED: One-time initialization effect - ALWAYS fetch courses for course type
  useEffect(() => {
    if (initialized) return;
    
    console.log('🚀 CardSelection initializing:', { 
      optionType, 
      hasItems: items?.length > 0,
      hasValue: !!value,
      value: value,
      coursesFetched,
      coursesFetching,
      builderMode,
      globalCoursesDataLength: globalCoursesData?.length || 0
    });

    if (optionType === 'course') {
      console.log('🎓 Course option type detected!');
      console.log('📝 For course type, always fetch available courses regardless of existing answer');
      
      // FIXED: Always fetch courses for course type, regardless of items or existing answers
      if (globalCoursesData && globalCoursesData.length > 0) {
        console.log('📦 Using cached courses:', globalCoursesData.length);
        setDynamicItems(globalCoursesData);
      } else if (!coursesFetching) {
        console.log('🔍 Starting course fetch (even with existing answer)...');
        fetchActiveCourses().then(courses => {
          console.log('📊 Fetch completed, setting courses:', courses.length);
          console.log('🎯 Current answer will be matched against fetched courses:', value);
          setDynamicItems(courses);
        }).catch(error => {
          console.error('❌ Course fetch failed:', error);
          setDynamicItems([]);
        });
      } else {
        console.log('⏳ Course fetch already in progress...');
        // Wait for ongoing fetch to complete
        const checkFetch = setInterval(() => {
          if (!coursesFetching && globalCoursesData) {
            console.log('📦 Fetch completed, using cached courses:', globalCoursesData.length);
            setDynamicItems(globalCoursesData);
            clearInterval(checkFetch);
          }
        }, 100);
        
        // Clear interval after 5 seconds to prevent infinite checking
        setTimeout(() => clearInterval(checkFetch), 5000);
      }
    } else {
      console.log('🏷️ Non-course option type:', optionType);
      // For non-course types, use provided items
      setDynamicItems(items || []);
    }
    
    setInitialized(true);
  }, []); // Empty dependency array - only run once

  // Handle items changes (for builder mode or when items prop changes)
  useEffect(() => {
    if (!initialized) return;
    
    if (optionType === 'course' && items && items.length > 0) {
      console.log('📝 Course items updated, using provided items:', items.length);
      setDynamicItems(items);
    } else if (optionType !== 'course') {
      console.log('📝 Non-course items updated:', items?.length || 0);
      setDynamicItems(items);
    }
  }, [items, optionType, initialized]);

  // FIXED: Use appropriate items for display - Always use dynamicItems for courses
  const displayItems = (() => {
    console.log('📋 Calculating displayItems:', {
      optionType,
      builderMode,
      itemsLength: items?.length || 0,
      dynamicItemsLength: dynamicItems?.length || 0,
      hasValue: !!value
    });

    // For course option type, ALWAYS use dynamicItems (fetched courses)
    if (optionType === 'course') {
      // In builder mode with manually added items, use those
      if (builderMode && items && items.length > 0) {
        console.log('📋 Builder mode: Using provided items');
        return items;
      }
      // Otherwise, use dynamicItems (fetched courses)
      console.log('📋 Course mode: Using dynamicItems (fetched courses)');
      return dynamicItems || [];
    }
    
    // For non-course option types, use items directly
    console.log('📋 Non-course mode: Using provided items');
    return items || [];
  })();

  // Enhanced logging for display items with answer matching
  useEffect(() => {
    if (initialized) {
      console.log('📊 Final display state:', {
        optionType,
        builderMode,
        displayItemsCount: displayItems?.length || 0,
        currentValue: value,
        selectedItems: displayItems?.filter(item => {
          if (multi) {
            return Array.isArray(value) && value.includes(item.value);
          }
          return value === item.value;
        })
      });
      
      // Check if current answer matches any available courses
      if (optionType === 'course' && value && displayItems?.length > 0) {
        const matchingCourse = displayItems.find(item => item.value === value);
        if (matchingCourse) {
          console.log('✅ Current answer matches course:', matchingCourse.label);
        } else {
          console.warn('⚠️ Current answer does not match any available course:', value);
          console.log('Available course values:', displayItems.map(item => item.value));
        }
      }
    }
  }, [displayItems, value, optionType, builderMode, initialized, multi]);

  // Handle card click for selection
  const handleCardClick = (itemValue, event) => {
    if (builderMode) return; // Don't handle selection in builder mode

    event.preventDefault();
    event.stopPropagation();

    if (multi) {
      handleCheckboxChange(itemValue);
    } else {
      handleChange(itemValue);
    }
  };

  // Handle radio button change (single selection)
  const handleChange = (itemValue) => {
    if (onChange) {
      onChange(value === itemValue ? null : itemValue);
    }
  };

  // Handle checkbox change (multi-selection)
  const handleCheckboxChange = (itemValue) => {
    if (onChange) {
      if (Array.isArray(value)) {
        if (value.includes(itemValue)) {
          // Remove item
          onChange(value.filter(v => v !== itemValue));
        } else {
          // Add item
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
    }, 1000); // 1 second debounce
  }, [updateOptionLabel]);

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
  if (coursesLoading || (optionType === 'course' && coursesFetching && !globalCoursesData)) {
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
              Showing {displayItems.length} active courses. Select courses to add them to this question.
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
          } ${builderMode ? 'cursor-default' : 'cursor-pointer'} ${currentSize.card}`}
        >
          {/* Image Section */}
          <div className="flex-shrink-0 mr-4">
            {item.imageUrl ? (
              <div className="relative">
                <img
                  src={item.imageUrl}
                  alt={item.label || 'Option image'}
                  className={`${currentSize.image} object-cover rounded-lg`}
                />
                {builderMode && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleImageRemove(index);
                    }}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600"
                  >
                    ×
                  </button>
                )}
              </div>
            ) : builderMode ? (
              <div className={`${currentSize.image} border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center`}>
                <label className="cursor-pointer text-center">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files[0]) {
                        handleImageUpload(index, e.target.files[0]);
                      }
                    }}
                  />
                  <div className="text-gray-400 text-xs">
                    {getPlaceholderText().addLabel}
                  </div>
                </label>
              </div>
            ) : (
              <div className={`${currentSize.image} bg-gray-100 rounded-lg flex items-center justify-center`}>
                <span className="text-gray-400 text-xs">No Image</span>
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="flex-1 min-w-0">
            {builderMode ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={localInputValues[`${index}-label`] || ''}
                  placeholder={getPlaceholderText('title')}
                  className={`w-full bg-transparent border-none outline-none ${currentSize.title} text-gray-900`}
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalInputValues(prev => ({
                      ...prev,
                      [`${index}-label`]: newValue
                    }));
                    debouncedUpdate(index, 'label', newValue);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                <textarea
                  value={localInputValues[`${index}-description`] || ''}
                  placeholder={getPlaceholderText('description')}
                  className={`w-full bg-transparent border-none outline-none ${currentSize.description} text-gray-600 resize-none`}
                  rows="2"
                  onChange={(e) => {
                    const newValue = e.target.value;
                    setLocalInputValues(prev => ({
                      ...prev,
                      [`${index}-description`]: newValue
                    }));
                    debouncedUpdate(index, 'description', newValue);
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            ) : (
              <div>
                <h3 className={`${currentSize.title} text-gray-900 mb-1`}>
                  {item.label || 'Untitled'}
                </h3>
                {item.description && (
                  <p className={`${currentSize.description} text-gray-600`}>
                    {item.description}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Control Section */}
          <div className="flex-shrink-0 ml-4 flex items-center justify-center">
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
                        className="sr-only"
                        name={`card-selection-${Math.random()}`}
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
      ))}

      {displayItems.length === 0 && !coursesLoading && !coursesFetching && (
        <div className="text-center py-8 text-gray-500">
          <p>
            {optionType === 'course' 
              ? (builderMode 
                  ? 'No active courses available' 
                  : 'No course offers available for this guest'
                )
              : 'No options available'
            }
          </p>
          {optionType === 'course' && (
            <p className="text-sm mt-2">
              {builderMode 
                ? 'Make sure there are active courses in the system.'
                : 'Course offers are managed by administrators and will appear here when available.'
              }
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default CardSelection;