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
  optionType = null,
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  guestId = null,
  bookingId = null,
  currentUser = null,
  stayDates = null,
  courseOffers = [],
  courseOffersLoaded = false,
  localFilterState = null,
  bestMatchPackage = null,
  error = null,
  forceShowErrors = false, 
  ...restProps
}) => {
  const [dynamicItems, setDynamicItems] = useState(items);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [localInputValues, setLocalInputValues] = useState({});
  const [showDateWarning, setShowDateWarning] = useState(false);
  const [pendingSelection, setPendingSelection] = useState(null);
  const [brokenImages, setBrokenImages] = useState(new Set()); // NEW: Track broken images
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

  // Helper function to format dates for display
  const formatDate = (dateString) => {
    if (!dateString) return null;
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-AU', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
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

  // NEW: Handle image load error
  const handleImageError = (index) => {
    setBrokenImages(prev => new Set([...prev, index]));
  };

  // NEW: Check if image should show placeholder
  const shouldShowPlaceholder = (item, index) => {
    return !item.imageUrl || brokenImages.has(index);
  };

  // NEW: Reset broken images when displayItems change
  useEffect(() => {
    setBrokenImages(new Set());
  }, [displayItems]);

  const fetchActiveCourses = async () => {
      // Check if we have course offers passed from parent
      if (courseOffers && courseOffers.length > 0) {
          console.log('Using course offers passed from parent:', courseOffers.length);
          
          const courses = courseOffers.map(offer => ({
              label: offer.courseName || 'Untitled Course',
              value: offer.courseId?.toString() || offer.id?.toString(),
              description: offer.courseDescription || '',
              imageFilename: offer.courseImage || null,
              imageUrl: offer.courseImageUrl || null,
              offerStatus: offer.offerStatus,
              minStartDate: offer.minStartDate,
              minEndDate: offer.minEndDate,
              dateValid: offer.dateValid !== undefined ? offer.dateValid : true,
              validationMessage: offer.dateValidationMessage,
              offerId: offer.id,
              courseId: offer.courseId,
              // REMOVED: disabled property - courses are never disabled now
              statusText: offer.dateValid === false ? 'Outside minimum stay period' : 'Within minimum stay period',
              statusColor: offer.dateValid === false ? 'amber' : 'green' // Changed to amber instead of red
          }));
          
          return courses;
      }

      // Fallback: Only fetch if no course offers provided AND not already fetched globally
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
              // Guest mode: Fetch course offers with date validation
              const currentGuestId = getGuestId();
              
              if (!currentGuestId) {
                  console.warn('No guest ID available for fetching course offers');
                  return [];
              }

              // Get stay dates from props for validation
              let checkInDate = null;
              let checkOutDate = null;
              
              // Try to get dates from stayDates prop
              if (stayDates?.checkInDate && stayDates?.checkOutDate) {
                  checkInDate = stayDates.checkInDate;
                  checkOutDate = stayDates.checkOutDate;
                  console.log('Using stay dates for course validation:', { checkInDate, checkOutDate });
              }
              
              // Build API URL with correct parameter name (uuid) and date parameters if available
              apiUrl = `/api/guests/${currentGuestId}/course-offers`;
              const queryParams = [];
              
              if (checkInDate && checkOutDate) {
                  queryParams.push(`checkInDate=${encodeURIComponent(checkInDate)}`);
                  queryParams.push(`checkOutDate=${encodeURIComponent(checkOutDate)}`);
              }
              
              if (queryParams.length > 0) {
                  apiUrl += `?${queryParams.join('&')}`;
              }
              
              console.log('Fetching course offers with URL:', apiUrl);
              
              const response = await fetch(apiUrl);
              
              if (!response.ok) {
                  if (response.status === 404) {
                      console.log('No course offers found for guest:', currentGuestId);
                      return [];
                  }
                  throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const data = await response.json();
              console.log('API Response:', data);
              
              if (data.success && Array.isArray(data.courseOffers)) {
                  courses = data.courseOffers.map(offer => ({
                      label: offer.courseName || 'Untitled Course',
                      value: offer.courseId?.toString() || offer.id?.toString(),
                      description: offer.courseDescription || '',
                      imageFilename: offer.courseImage || null,
                      imageUrl: offer.courseImageUrl || null,
                      // Enhanced course offer data
                      offerStatus: offer.offerStatus,
                      minStartDate: offer.minStartDate,
                      minEndDate: offer.minEndDate,
                      dateValid: offer.dateValid !== undefined ? offer.dateValid : true, // Default to true if not provided
                      validationMessage: offer.dateValidationMessage,
                      offerId: offer.id,
                      courseId: offer.courseId,
                      // REMOVED: disabled property - courses are never disabled now
                      statusText: offer.dateValid === false ? 'Outside minimum stay period' : 'Within minimum stay period',
                      statusColor: offer.dateValid === false ? 'amber' : 'green' // Changed to amber
                  }));
                  
                  console.log('Enhanced course offers with validation:', courses);
                  console.log('Date validation was performed:', data.dateValidationPerformed);
              } else {
                  console.log('No course offers in response');
              }
          }
          
          // Store globally only if we have courses
          if (courses.length > 0) {
              globalCoursesData = courses;
              coursesFetched = true;
              console.log(`Courses fetched successfully: ${courses.length} courses`);
          } else {
              console.log(`No courses available`);
          }
          
          return courses;
          
      } catch (error) {
          console.error('Error fetching courses:', error);
          return [];
      } finally {
          coursesFetching = false;
          setCoursesLoading(false);
      }
  };

  useEffect(() => {
    if (initialized) return;
    
    if (optionType === 'course') {
          // Use passed course offers if available
          if (courseOffers && courseOffers.length > 0) {
              console.log('Using passed course offers immediately');
              const courses = courseOffers.map(offer => ({
                  label: offer.courseName || 'Untitled Course',
                  value: offer.courseId?.toString() || offer.id?.toString(),
                  description: offer.courseDescription || '',
                  imageFilename: offer.courseImage || null,
                  imageUrl: offer.courseImageUrl || null,
                  offerStatus: offer.offerStatus,
                  minStartDate: offer.minStartDate,
                  minEndDate: offer.minEndDate,
                  dateValid: offer.dateValid !== undefined ? offer.dateValid : true,
                  validationMessage: offer.dateValidationMessage,
                  // REMOVED: disabled property
                  statusText: offer.dateValid === false ? 'Outside minimum stay period' : 'Within minimum stay period',
                  statusColor: offer.dateValid === false ? 'amber' : 'green'
              }));
              setDynamicItems(courses);
          } 
          // Only fetch if no course offers provided AND parent says loading is complete
          else if (courseOffersLoaded && courseOffers.length === 0) {
              console.log('No course offers from parent, fetching as fallback...');
              fetchActiveCourses().then(courses => {
                  setDynamicItems(courses);
              }).catch(error => {
                  console.error('Course fetch failed:', error);
                  setDynamicItems([]);
              });
          }
          // Still loading from parent, show loading state
          else if (!courseOffersLoaded) {
              console.log('Waiting for course offers from parent...');
              setCoursesLoading(true);
          }
      } else {
          setDynamicItems(items || []);
      }
      
      setInitialized(true);
  }, [courseOffers, courseOffersLoaded, optionType, initialized]);

  useEffect(() => {
      if (courseOffersLoaded) {
          setCoursesLoading(false);
      }
  }, [courseOffersLoaded]);

  // Handle items changes (for builder mode or when items prop changes)
  useEffect(() => {
    if (!initialized) return;
    
    if (optionType === 'course' && items && items.length > 0) {
      setDynamicItems(items);
    } else if (optionType !== 'course') {
      setDynamicItems(items);
    }
  }, [items, optionType, initialized]);

  // FIXED: Use appropriate items for display - Always use dynamicItems for courses
  const displayItems = (() => {
    // For course option type, ALWAYS use dynamicItems (fetched courses)
    if (optionType === 'course') {
      // In builder mode with manually added items, use those
      if (builderMode && items && items.length > 0) {
        return items;
      }
      // Otherwise, use dynamicItems (fetched courses)
      return dynamicItems || [];
    }
    
    // For non-course option types, use items directly
    return items || [];
  })();

  // Enhanced logging for display items with answer matching
  useEffect(() => {
    if (initialized) {
      // Check if current answer matches any available courses
      if (optionType === 'course' && value && displayItems?.length > 0) {
        const matchingCourse = displayItems.find(item => item.value === value);
        if (matchingCourse) {
          console.log('Current answer matches course:', {
            courseName: matchingCourse.label,
            startDate: matchingCourse.minStartDate,
            endDate: matchingCourse.minEndDate
          });
        } else {
          console.warn('Current answer does not match any available course:', value);
        }
      }
    }
  }, [displayItems, value, optionType, builderMode, initialized, multi]);

  // Handle card click for selection
  const handleCardClick = (itemValue, item, event) => {
      if (builderMode) return; // Don't handle selection in builder mode

      event.preventDefault();
      event.stopPropagation();

      // Allow selection of all courses regardless of date compatibility
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
  }, [displayItems.length]);

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

  // ENHANCED: Handle image removal (just the image, not the entire option) with enhanced error handling
  const handleImageRemove = async (index) => {
    const item = displayItems[index];
    
    // If there's an imageFilename, try to delete it from storage
    if (item.imageFilename) {
      try {
        const response = await fetch(`/api/storage/upload?filename=${item.imageFilename}&filepath=${optionType}/`, {
          method: 'DELETE'
        });
        
        // Log the result but don't prevent removal based on API response
        if (response.status === 404) {
          console.log('Image file already deleted from storage:', item.imageFilename);
        } else if (!response.ok) {
          console.warn('Failed to delete image from storage:', response.status, response.statusText);
        } else {
          console.log('Image successfully deleted from storage:', item.imageFilename);
        }
      } catch (error) {
        console.warn('Error during image deletion:', error);
        // Continue with UI cleanup regardless of API error
      }
    }
    
    // Clean up blob URLs to prevent memory leaks
    if (item.imageUrl && item.imageUrl.startsWith('blob:')) {
      URL.revokeObjectURL(item.imageUrl);
    }
    
    // Remove from broken images set
    setBrokenImages(prev => {
      const newSet = new Set(prev);
      newSet.delete(index);
      return newSet;
    });
    
    // Update the option to remove BOTH image references
    if (updateOptionLabel) {
      // Clear imageFilename
      updateOptionLabel(
        { target: { value: null }, stopPropagation: () => {} },
        { index, field: 'imageFilename' },
        'card-selection'
      );
      
      // Also clear imageUrl to ensure the image disappears from the UI
      updateOptionLabel(
        { target: { value: null }, stopPropagation: () => {} },
        { index, field: 'imageUrl' },
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

        {/* Updated validation summary for multiple courses */}
        {!builderMode && optionType === 'course' && displayItems.length > 1 && (
            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                        Course Compatibility with Your Stay Dates:
                    </span>
                    <div className="flex gap-4 text-xs">
                        <span className="flex items-center">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                            {displayItems.filter(item => item.dateValid).length} Within period
                        </span>
                        <span className="flex items-center">
                            <div className="w-2 h-2 bg-amber-500 rounded-full mr-1"></div>
                            {displayItems.filter(item => !item.dateValid).length} Outside period
                        </span>
                    </div>
                </div>
                <div className="mt-2 text-xs text-gray-600">
                    All courses can be selected. Courses outside the minimum stay period may require extending your stay.
                </div>
            </div>
        )}
        
        <div className={`
            rounded-lg border transition-all duration-200 p-3
            ${!builderMode && (
                error || 
                (forceShowErrors && required && (
                    (multi && (!value || (Array.isArray(value) && value.length === 0))) ||
                    (!multi && (!value || value === ''))
                ))
            )
                ? 'border-red-400 bg-red-50'
                : !builderMode && required && (
                    (multi && Array.isArray(value) && value.length > 0) ||
                    (!multi && value && value !== '')
                )
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white'
            }
        `}>
            <div className={currentSize.container}>
                {displayItems.map((item, index) => (
                    <div
                        key={item.value || index}
                        onClick={(e) => handleCardClick(item.value, item, e)}
                        className={`flex border-2 rounded-xl transition-all duration-200 relative cursor-pointer ${
                            !builderMode && isSelected(item.value) 
                                ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                                : item.dateValid === false
                                    ? 'border-amber-200 bg-amber-50 hover:border-amber-300 hover:shadow-sm'
                                    : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        } ${builderMode ? 'cursor-default' : ''} ${currentSize.card}`}
                    >
                        {/* Rest of card content stays the same... */}
                        {/* Updated validation indicator */}
                        {!builderMode && optionType === 'course' && item.hasOwnProperty('dateValid') && (
                            <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                                item.dateValid ? 'bg-green-500' : 'bg-amber-500'
                            }`}>
                                {item.dateValid ? (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                ) : (
                                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                )}
                            </div>
                        )}

                        {/* ENHANCED Image Section with Error Handling */}
                        <div className="flex-shrink-0 mr-4">
                            {shouldShowPlaceholder(item, index) ? (
                                builderMode ? (
                                    <div className={`${currentSize.image} border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50`}>
                                        <label className="cursor-pointer text-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={(e) => {
                                                    if (e.target.files[0]) {
                                                        setBrokenImages(prev => {
                                                            const newSet = new Set(prev);
                                                            newSet.delete(index);
                                                            return newSet;
                                                        });
                                                        handleImageUpload(index, e.target.files[0]);
                                                    }
                                                }}
                                            />
                                            <div className="text-gray-400 text-xs text-center">
                                                <svg className="w-6 h-6 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                                                </svg>
                                                {brokenImages.has(index) ? 'Replace Image' : getPlaceholderText().addLabel}
                                            </div>
                                        </label>
                                    </div>
                                ) : (
                                    <div className={`${currentSize.image} bg-gray-100 rounded-lg flex items-center justify-center`}>
                                        <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                )
                            ) : (
                                <div className="relative">
                                    <img
                                        src={item.imageUrl}
                                        alt={item.label || 'Image'}
                                        className={`${currentSize.image} object-cover rounded-lg`}
                                        onError={() => handleImageError(index)}
                                        onLoad={() => {
                                            setBrokenImages(prev => {
                                                const newSet = new Set(prev);
                                                newSet.delete(index);
                                                return newSet;
                                            });
                                        }}
                                    />
                                    {builderMode && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleImageRemove(index);
                                            }}
                                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                            title="Remove image"
                                        >
                                            ×
                                        </button>
                                    )}
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
                                    
                                    {optionType === 'course' && (item.minStartDate || item.minEndDate) && (
                                        <div className="mb-2">
                                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                </svg>
                                                <span>
                                                    Minimum stay: {formatDate(item.minStartDate)} - {formatDate(item.minEndDate)}
                                                </span>
                                            </div>
                                        </div>
                                    )}
                                    
                                    {!builderMode && optionType === 'course' && item.hasOwnProperty('dateValid') && (
                                        <div className="mt-2">
                                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                                item.dateValid 
                                                    ? 'bg-green-100 text-green-800' 
                                                    : 'bg-amber-100 text-amber-800'
                                            }`}>
                                                {item.statusText}
                                            </span>
                                            {!item.dateValid && (
                                                <p className="text-xs text-amber-600 mt-1">
                                                    You can still select this course but may need to extend your stay dates to meet the minimum requirements.
                                                </p>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Control Section */}
                        <div className="flex-shrink-0 ml-4 flex items-center justify-center">
                            {builderMode ? (
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
                                </>
                            ) : (
                                <>
                                    {multi ? (
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
            </div>
        </div>
        {/* ⭐ END of validation-styled container wrapper */}

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