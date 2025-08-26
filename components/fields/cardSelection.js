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
  // ✨ NEW: Enhanced props for pricing and filtering
  localFilterState = null,
  bestMatchPackage = null,
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

  // ✨ NEW: Helper function to get price based on NDIS package type
  const getCoursePrice = (courseOffer) => {
    // Don't show prices for non-NDIS funders
    if (!localFilterState || localFilterState.funderType !== 'NDIS') {
      return null;
    }

    if (!courseOffer.pricing || !courseOffer.pricing.hasPricing) {
      return null;
    }

    const { ndisPackageType } = localFilterState;
    
    switch (ndisPackageType) {
      case 'sta':
        return courseOffer.pricing.staPrice;
      case 'holiday':
      case 'holiday-plus':
        return courseOffer.pricing.holidayPrice;
      default:
        return null;
    }
  };

  // ✨ NEW: Helper function to format price display
  const formatPrice = (price) => {
    if (!price) return null;
    return `$${parseFloat(price).toFixed(2)}`;
  };

  // ✨ NEW: Helper function to get price label
  const getPriceLabel = () => {
    if (!localFilterState || localFilterState.funderType !== 'NDIS') {
      return null;
    }
    return 'Price';
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
      // ✅ FIRST: Check if we have course offers passed from parent
      if (courseOffers && courseOffers.length > 0) {
          console.log('🎓 Using course offers passed from parent:', courseOffers.length);
          
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
              disabled: offer.dateValid === false,
              statusText: offer.dateValid === false ? 'Incompatible dates' : 'Compatible dates',
              statusColor: offer.dateValid === false ? 'red' : 'green',
              // ✨ NEW: Pricing information
              pricing: offer.pricing || null
          }));
          
          return courses;
      }

      // ✅ FALLBACK: Only fetch if no course offers provided AND not already fetched globally
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
                      imageUrl: course.imageUrl || null,
                      // ✨ NEW: Pricing information from fetched courses
                      pricing: {
                          holidayPrice: course.holiday_price ? parseFloat(course.holiday_price) : null,
                          staPrice: course.sta_price ? parseFloat(course.sta_price) : null,
                          priceCalculatedAt: course.price_calculated_at,
                          hasPricing: !!(course.holiday_price || course.sta_price)
                      }
                  }));
              }
          } else {
              // Guest mode: Fetch course offers with date validation
              const currentGuestId = getGuestId();
              
              if (!currentGuestId) {
                  console.warn('⚠️ No guest ID available for fetching course offers');
                  return [];
              }

              // Get stay dates from props for validation
              let checkInDate = null;
              let checkOutDate = null;
              
              // Try to get dates from stayDates prop
              if (stayDates?.checkInDate && stayDates?.checkOutDate) {
                  checkInDate = stayDates.checkInDate;
                  checkOutDate = stayDates.checkOutDate;
                  console.log('🎓 Using stay dates for course validation:', { checkInDate, checkOutDate });
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
              
              console.log('🎓 Fetching course offers with URL:', apiUrl);
              
              const response = await fetch(apiUrl);
              
              if (!response.ok) {
                  if (response.status === 404) {
                      console.log('📭 No course offers found for guest:', currentGuestId);
                      return [];
                  }
                  throw new Error(`HTTP error! status: ${response.status}`);
              }
              
              const data = await response.json();
              console.log('🎓 API Response:', data);
              
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
                      // Add visual indicators for validation
                      disabled: offer.dateValid === false, // Only disable if explicitly false
                      statusText: offer.dateValid === false ? 'Incompatible dates' : 'Compatible dates',
                      statusColor: offer.dateValid === false ? 'red' : 'green',
                      pricing: offer.pricing || null
                  }));
                  
                  console.log('✅ Enhanced course offers with validation and pricing:', courses);
                  console.log('🎓 Date validation was performed:', data.dateValidationPerformed);
              } else {
                  console.log('📭 No course offers in response');
              }
          }
          
          // Store globally only if we have courses
          if (courses.length > 0) {
              globalCoursesData = courses;
              coursesFetched = true;
              console.log(`✅ Courses fetched successfully: ${courses.length} courses`);
          } else {
              console.log(`📭 No courses available`);
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

  useEffect(() => {
    if (initialized) return;
    
    if (optionType === 'course') {
          // ✅ Use passed course offers if available
          if (courseOffers && courseOffers.length > 0) {
              console.log('🎓 Using passed course offers immediately');
              const courses = courseOffers.map(offer => ({
                  label: offer.courseName || 'Untitled Course',
                  value: offer.courseId?.toString() || offer.id?.toString(),
                  description: offer.courseDescription || '',
                  imageFilename: offer.courseImage || null,
                  imageUrl: offer.courseImageUrl || null,
                  offerStatus: offer.offerStatus,
                  dateValid: offer.dateValid !== undefined ? offer.dateValid : true,
                  validationMessage: offer.dateValidationMessage,
                  disabled: offer.dateValid === false,
                  statusText: offer.dateValid === false ? 'Incompatible dates' : 'Compatible dates',
                  statusColor: offer.dateValid === false ? 'red' : 'green',
                  pricing: offer.pricing || null
              }));
              setDynamicItems(courses);
          } 
          // ✅ Only fetch if no course offers provided AND parent says loading is complete
          else if (courseOffersLoaded && courseOffers.length === 0) {
              console.log('🎓 No course offers from parent, fetching as fallback...');
              fetchActiveCourses().then(courses => {
                  setDynamicItems(courses);
              }).catch(error => {
                  console.error('❌ Course fetch failed:', error);
                  setDynamicItems([]);
              });
          }
          // ✅ Still loading from parent, show loading state
          else if (!courseOffersLoaded) {
              console.log('⏳ Waiting for course offers from parent...');
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
          // Log pricing information
          if (matchingCourse.pricing) {
            console.log('✅ Current answer matches course with pricing:', {
              courseName: matchingCourse.label,
              pricing: matchingCourse.pricing,
              priceToShow: getCoursePrice(matchingCourse),
              priceLabel: getPriceLabel()
            });
          }
        } else {
          console.warn('⚠️ Current answer does not match any available course:', value);
        }
      }
    }
  }, [displayItems, value, optionType, builderMode, initialized, multi, localFilterState]);

  // Handle card click for selection
  const handleCardClick = (itemValue, item, event) => {
      if (builderMode) return; // Don't handle selection in builder mode

      event.preventDefault();
      event.stopPropagation();

      // Check if course is disabled due to date validation
      if (item.disabled && !item.dateValid) {
          // Show tooltip or message about why it's disabled
          console.log('🚫 Course disabled due to date incompatibility:', item.validationMessage);
          return; // Don't allow selection
      }

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

            {/* ✨ NEW: Show package info and pricing context */}
            {!builderMode && optionType === 'course' && localFilterState && displayItems.length > 0 && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-700">
                                Funding Type: {localFilterState.funderType || 'Unknown'}
                            </span>
                            {localFilterState.ndisPackageType && (
                                <span className="px-2 py-1 rounded text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                                    {localFilterState.ndisPackageType}
                                </span>
                            )}
                        </div>
                        {localFilterState.funderType === 'NDIS' && (
                            <div className="text-xs text-gray-600">
                                {getPriceLabel()}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Show validation summary for multiple courses */}
            {!builderMode && optionType === 'course' && displayItems.length > 1 && (
                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                            Course Compatibility with Your Stay Dates:
                        </span>
                        <div className="flex gap-4 text-xs">
                            <span className="flex items-center">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1"></div>
                                {displayItems.filter(item => item.dateValid).length} Compatible
                            </span>
                            <span className="flex items-center">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-1"></div>
                                {displayItems.filter(item => !item.dateValid).length} Incompatible
                            </span>
                        </div>
                    </div>
                </div>
            )}
            
            {displayItems.map((item, index) => {
                // ✨ NEW: Get course price for this item
                const coursePrice = getCoursePrice(item);
                const priceLabel = getPriceLabel();
                const showPrice = coursePrice && priceLabel && localFilterState?.funderType === 'NDIS';

                return (
                <div
                    key={item.value || index}
                    onClick={(e) => handleCardClick(item.value, item, e)}
                    className={`flex border-2 rounded-xl transition-all duration-200 relative ${
                        !builderMode && isSelected(item.value) 
                            ? 'border-blue-600 bg-blue-50 shadow-md ring-2 ring-blue-200' 
                            : item.disabled
                                ? 'border-red-200 bg-red-50 opacity-75 cursor-not-allowed'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm cursor-pointer'
                    } ${builderMode ? 'cursor-default' : ''} ${currentSize.card}`}
                >
                    {/* Validation indicator */}
                    {!builderMode && optionType === 'course' && item.hasOwnProperty('dateValid') && (
                        <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center ${
                            item.dateValid ? 'bg-green-500' : 'bg-red-500'
                        }`}>
                            {item.dateValid ? (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                            ) : (
                                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            )}
                        </div>
                    )}

                    {/* Image Section */}
                    <div className="flex-shrink-0 mr-4">
                        {item.imageUrl ? (
                            <div className="relative">
                                <img
                                    src={item.imageUrl}
                                    alt={item.label || 'Course image'}
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
                                    <p className={`${currentSize.description} text-gray-600 mb-2`}>
                                        {item.description}
                                    </p>
                                )}
                                
                                {/* ✨ NEW: Course pricing display */}
                                {showPrice && (
                                    <div className="mb-2">
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                            {priceLabel}: {formatPrice(coursePrice)}
                                        </span>
                                    </div>
                                )}
                                
                                {/* Course-specific validation info */}
                                {!builderMode && optionType === 'course' && item.hasOwnProperty('dateValid') && (
                                    <div className="mt-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                            item.dateValid 
                                                ? 'bg-green-100 text-green-800' 
                                                : 'bg-red-100 text-red-800'
                                        }`}>
                                            {item.statusText}
                                        </span>
                                        {!item.dateValid && item.validationMessage && (
                                            <p className="text-xs text-red-600 mt-1">
                                                {item.validationMessage}
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
                            // Builder mode controls...
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
                            // Selection controls
                            <>
                                {multi ? (
                                    // Checkbox for multi-selection
                                    <label className={`cursor-pointer ${item.disabled ? 'cursor-not-allowed' : ''}`} onClick={(e) => e.stopPropagation()}>
                                        <div className={`${currentSize.control} rounded-full border-2 flex items-center justify-center ${
                                            isSelected(item.value) 
                                                ? 'border-blue-600 bg-blue-600' 
                                                : item.disabled
                                                    ? 'border-gray-300 bg-gray-100'
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
                                                disabled={item.disabled}
                                                onChange={() => handleCheckboxChange(item.value)}
                                                required={required && (!Array.isArray(value) || value.length === 0)}
                                            />
                                        </div>
                                    </label>
                                ) : (
                                    // Radio button for single selection
                                    <label className={`cursor-pointer ${item.disabled ? 'cursor-not-allowed' : ''}`} onClick={(e) => e.stopPropagation()}>
                                        <div className={`${currentSize.control} rounded-full border-2 flex items-center justify-center ${
                                            isSelected(item.value) 
                                                ? 'border-blue-600 bg-blue-600' 
                                                : item.disabled
                                                    ? 'border-gray-300 bg-gray-100'
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
                                                disabled={item.disabled}
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
            )})}

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