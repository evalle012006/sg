import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Check, Plus, X, Upload, Trash2 } from 'lucide-react';

const ServiceCards = ({
  items = [],
  value = {},
  onChange,
  builderMode = false,
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  optionType = 'service',
  forceShowErrors = false,
}) => {
  const [localValue, setLocalValue] = useState(value || {});
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [brokenSubOptionImages, setBrokenSubOptionImages] = useState(new Set());
  const [editingFields, setEditingFields] = useState({});
  const [localInputValues, setLocalInputValues] = useState({}); // FIXED: Added missing state
  const [refreshedImageUrls, setRefreshedImageUrls] = useState(new Map());
  const updateTimeoutRef = useRef({});
  const prevValueRef = useRef(value);
  const hasRefreshedUrls = useRef(false);

  const initializeAllServices = useCallback((currentValue, serviceItems) => {
      if (!serviceItems || serviceItems.length === 0) {
          return currentValue || {};
      }
      
      // Start with current value or empty object
      const initialized = { ...(currentValue || {}) };
      
      // Ensure every service in items exists in the value
      serviceItems.forEach(item => {
          if (!initialized[item.value]) {
              initialized[item.value] = {
                  selected: false,
                  subOptions: []
              };
          }
      });
      
      return initialized;
  }, []);

  // Only update localValue when value actually changes (deep comparison)
  useEffect(() => {
    const newValueStr = JSON.stringify(value);
    const prevValueStr = JSON.stringify(prevValueRef.current);
    
    if (newValueStr !== prevValueStr) {        
        // IMPORTANT: Ensure ALL services are initialized in the value
        const initializedValue = initializeAllServices(value, items);
        
        setLocalValue(initializedValue);
        prevValueRef.current = initializedValue;
    }
}, [value, items]);

  // Refresh signed URLs ONCE on mount - don't update parent to avoid infinite loop
  useEffect(() => {
    const refreshImageUrls = async () => {
      if (!items || items.length === 0 || hasRefreshedUrls.current) return;
      
      hasRefreshedUrls.current = true;
      const newRefreshedUrls = new Map();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        // Refresh main service image
        if (item.imageFilename && item.imageUrl) {
          try {
            const fileType = optionType || 'service';
            const response = await fetch(
              `/api/storage/upload?filename=${item.imageFilename}&filepath=${fileType}/`,
              { method: 'GET' }
            );
            const data = await response.json();
            
            if (data.fileUrl) {
              newRefreshedUrls.set(`service-${i}`, data.fileUrl);
            }
          } catch (error) {
            console.warn(`Failed to refresh URL for ${item.imageFilename}:`, error);
          }
        }

        // Refresh sub-option images
        if (item.subOptions && item.subOptions.length > 0) {
          for (let subIndex = 0; subIndex < item.subOptions.length; subIndex++) {
            const subOption = item.subOptions[subIndex];
            if (subOption.imageFilename && subOption.imageUrl) {
              try {
                const fileType = optionType || 'service';
                const response = await fetch(
                  `/api/storage/upload?filename=${subOption.imageFilename}&filepath=${fileType}/`,
                  { method: 'GET' }
                );
                const data = await response.json();
                
                if (data.fileUrl) {
                  newRefreshedUrls.set(`suboption-${i}-${subIndex}`, data.fileUrl);
                }
              } catch (error) {
                console.warn(`Failed to refresh URL for ${subOption.imageFilename}:`, error);
              }
            }
          }
        }
      }

      setRefreshedImageUrls(newRefreshedUrls);
    };

    refreshImageUrls();
  }, []);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      Object.values(updateTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Get the current image URL (refreshed if available, otherwise original)
  const getImageUrl = (index, originalUrl) => {
    const refreshedUrl = refreshedImageUrls.get(`service-${index}`);
    return refreshedUrl || originalUrl;
  };

  // Get the current sub-option image URL
  const getSubOptionImageUrl = (serviceIndex, subOptionIndex, originalUrl) => {
    const refreshedUrl = refreshedImageUrls.get(`suboption-${serviceIndex}-${subOptionIndex}`);
    return refreshedUrl || originalUrl;
  };

  // Handle image error for services
  const handleImageError = (index) => {
    setBrokenImages(prev => new Set([...prev, index]));
  };

  // Handle image error for sub-options
  const handleSubOptionImageError = (serviceIndex, subOptionIndex) => {
    const key = `${serviceIndex}-${subOptionIndex}`;
    setBrokenSubOptionImages(prev => new Set([...prev, key]));
  };

  // FIXED: Handle immediate local update and debounced parent update
  const handleFieldChange = useCallback((index, field, value) => {
    const key = `${index}-${field}`;
    
    // Update local state immediately
    setLocalInputValues(prev => ({
      ...prev,
      [key]: value
    }));
    
    // Clear existing timeout
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
    }
    
    // Debounce the parent update
    updateTimeoutRef.current[key] = setTimeout(() => {
      if (updateOptionLabel) {
        updateOptionLabel(
          { target: { value }, stopPropagation: () => {} },
          { index, field, label: value }, // FIXED: Added 'label' property
          'service-card'
        );
      }
      delete updateTimeoutRef.current[key];
    }, 500);
  }, [updateOptionLabel]);

  // NEW: Handle sub-option label changes with debouncing
  const handleSubOptionLabelChange = useCallback((serviceIndex, subIndex, newLabel) => {
    const key = `${serviceIndex}-${subIndex}-subOptionLabel`;
    
    // Update local state immediately
    setLocalInputValues(prev => ({
      ...prev,
      [key]: newLabel
    }));
    
    // Clear existing timeout
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
    }
    
    // Debounce the parent update
    updateTimeoutRef.current[key] = setTimeout(() => {
      const service = items[serviceIndex];
      const newValue = newLabel.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || service.subOptions[subIndex].value;
      
      const updatedSubOptions = [...service.subOptions];
      updatedSubOptions[subIndex] = {
        ...updatedSubOptions[subIndex],
        label: newLabel,
        value: newValue
      };
      
      if (updateOptionLabel) {
        updateOptionLabel(
          { target: { value: JSON.stringify(updatedSubOptions) }, stopPropagation: () => {} },
          { index: serviceIndex, field: 'subOptions', label: JSON.stringify(updatedSubOptions) },
          'service-card'
        );
      }
      delete updateTimeoutRef.current[key];
    }, 500);
  }, [items, updateOptionLabel]);

  // Get the display value for a field (from local state or items prop)
  const getFieldValue = (index, field) => {
    const key = `${index}-${field}`;
    // First check local input values, then fall back to items prop
    if (localInputValues && localInputValues[key] !== undefined) {
      return localInputValues[key];
    }
    return items[index]?.[field] || '';
  };

  // NEW: Get the display value for sub-option label
  const getSubOptionLabelValue = (serviceIndex, subIndex) => {
    const key = `${serviceIndex}-${subIndex}-subOptionLabel`;
    // First check local input values, then fall back to items prop
    if (localInputValues && localInputValues[key] !== undefined) {
      return localInputValues[key];
    }
    return items[serviceIndex]?.subOptions?.[subIndex]?.label || '';
  };

  // Initialize local input values when items change
  useEffect(() => {
    const initialValues = {};
    items.forEach((item, index) => {
      initialValues[`${index}-label`] = item.label || '';
      initialValues[`${index}-description`] = item.description || '';
      initialValues[`${index}-availability`] = item.availability || '';
      initialValues[`${index}-subOptionsTitle`] = item.subOptionsTitle || '';
      initialValues[`${index}-subOptionsNote`] = item.subOptionsNote || '';
      
      // Initialize sub-option labels
      if (item.subOptions && item.subOptions.length > 0) {
        item.subOptions.forEach((subOption, subIndex) => {
          initialValues[`${index}-${subIndex}-subOptionLabel`] = subOption.label || '';
        });
      }
    });
    setLocalInputValues(initialValues);
  }, [items]);

  // Handle service Yes/No selection
  const handleServiceToggle = (serviceValue, isSelected) => {
      // Ensure we start with all services initialized
      const baseValue = initializeAllServices(localValue, items);
      
      const newValue = {
          ...baseValue, // Spread ALL services first
          [serviceValue]: {
              selected: isSelected,
              subOptions: isSelected ? (baseValue[serviceValue]?.subOptions || []) : []
          }
      };
      
      setLocalValue(newValue);
      onChange?.(newValue);
  };

    // Handle sub-option checkbox toggle
    const handleSubOptionToggle = (serviceValue, subOptionValue) => {
      // Ensure we start with all services initialized
      const baseValue = initializeAllServices(localValue, items);
      
      const currentSubOptions = baseValue[serviceValue]?.subOptions || [];
      const newSubOptions = currentSubOptions.includes(subOptionValue)
          ? currentSubOptions.filter(id => id !== subOptionValue)
          : [...currentSubOptions, subOptionValue];
      
      const newValue = {
          ...baseValue, // Spread ALL services first
          [serviceValue]: {
              ...baseValue[serviceValue],
              subOptions: newSubOptions
          }
      };
      
      setLocalValue(newValue);
      onChange?.(newValue);
  };

  // Handle image upload for services
  const handleServiceImageUpload = (index, file) => {
    if (onImageUpload) {
      onImageUpload(index, file);
    }
  };

  // Handle image upload for sub-options
  const handleSubOptionImageUpload = (serviceIndex, subOptionIndex, file) => {
    if (onImageUpload) {
      const service = items[serviceIndex];
      if (service && service.subOptions && service.subOptions[subOptionIndex]) {
        const updatedSubOptions = [...service.subOptions];
        const previewUrl = URL.createObjectURL(file);
        
        updatedSubOptions[subOptionIndex] = {
          ...updatedSubOptions[subOptionIndex],
          imageUrl: previewUrl,
          uploading: true
        };
        
        if (updateOptionLabel) {
          updateOptionLabel(
            { target: { value: JSON.stringify(updatedSubOptions) }, stopPropagation: () => {} },
            { index: serviceIndex, field: 'subOptions', label: JSON.stringify(updatedSubOptions) },
            'service-card'
          );
        }
        
        onImageUpload(serviceIndex, file, subOptionIndex);
      }
    }
  };

  useEffect(() => {
      // Initialize all services when component first mounts or items change
      if (items && items.length > 0) {
          const initialized = initializeAllServices(localValue, items);
          
          // Only update if there were missing services
          if (JSON.stringify(initialized) !== JSON.stringify(localValue)) {
              setLocalValue(initialized);
              
              // Also notify parent if starting from null/undefined
              if (!value || Object.keys(value).length === 0) {
                  onChange?.(initialized);
              }
          }
      }
  }, [items, initializeAllServices]);

  return (
    <div className="space-y-6">
      {items.map((service, serviceIndex) => {
        const isSelected = localValue[service.value]?.selected || false;
        const currentImageUrl = getImageUrl(serviceIndex, service.imageUrl);
        
        return (
          <div key={service.value || serviceIndex} className="space-y-4">
            {/* Service Card */}
            <div
              className={`border-2 rounded-lg p-6 transition-all ${
                builderMode ? 'cursor-default' : 'cursor-pointer'
              } ${
                isSelected && !builderMode
                  ? 'border-emerald-400 bg-emerald-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
              onClick={() => !builderMode && handleServiceToggle(service.value, !isSelected)}
            >
              <div className="flex items-start gap-6">
                {/* Image Section */}
                <div className="flex-shrink-0">
                  {builderMode ? (
                    <div className="w-24 h-24">
                      {currentImageUrl && !brokenImages.has(serviceIndex) ? (
                        <div className="relative w-24 h-24 group">
                          <img
                            src={currentImageUrl}
                            alt={service.label}
                            className="w-full h-full object-cover rounded-lg"
                            onError={() => handleImageError(serviceIndex)}
                            onLoad={() => {
                              setBrokenImages(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(serviceIndex);
                                return newSet;
                              });
                            }}
                          />
                          <label className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files[0]) {
                                  setBrokenImages(prev => {
                                    const newSet = new Set(prev);
                                    newSet.delete(serviceIndex);
                                    return newSet;
                                  });
                                  handleServiceImageUpload(serviceIndex, e.target.files[0]);
                                }
                              }}
                            />
                            <Upload className="w-5 h-5 text-white mb-1" />
                            <span className="text-xs text-white">Replace</span>
                          </label>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              updateOptionLabel?.(
                                { target: { value: null }, stopPropagation: () => {} },
                                { index: serviceIndex, field: 'imageFilename', label: null },
                                'service-card'
                              );
                              updateOptionLabel?.(
                                { target: { value: null }, stopPropagation: () => {} },
                                { index: serviceIndex, field: 'imageUrl', label: null },
                                'service-card'
                              );
                            }}
                            className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center hover:bg-red-600 z-10"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <label className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center bg-gray-50 cursor-pointer hover:border-gray-400">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files[0]) {
                                setBrokenImages(prev => {
                                  const newSet = new Set(prev);
                                  newSet.delete(serviceIndex);
                                  return newSet;
                                });
                                handleServiceImageUpload(serviceIndex, e.target.files[0]);
                              }
                            }}
                          />
                          {brokenImages.has(serviceIndex) ? (
                            <>
                              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                              <span className="text-xs text-gray-500 mt-1">Failed</span>
                              <span className="text-xs text-gray-500">Click to retry</span>
                            </>
                          ) : (
                            <>
                              <Upload className="w-6 h-6 text-gray-400" />
                              <span className="text-xs text-gray-500 mt-1">Upload</span>
                            </>
                          )}
                        </label>
                      )}
                    </div>
                  ) : (
                    currentImageUrl && (
                      <div className="w-24 h-24">
                        {!brokenImages.has(serviceIndex) ? (
                          <img
                            src={currentImageUrl}
                            alt={service.label}
                            className="w-24 h-24 object-cover rounded-lg"
                            onError={() => handleImageError(serviceIndex)}
                            onLoad={() => {
                              setBrokenImages(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(serviceIndex);
                                return newSet;
                              });
                            }}
                          />
                        ) : (
                          <div className="w-24 h-24 bg-gray-100 rounded-lg flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>
                
                {/* Content Section */}
                <div className="flex-1">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      {builderMode ? (
                        <>
                          <input
                            type="text"
                            value={getFieldValue(serviceIndex, 'label')}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleFieldChange(serviceIndex, 'label', e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Service Title"
                            className="text-lg font-semibold text-gray-900 mb-2 w-full border border-gray-300 rounded px-2 py-1"
                          />
                          <textarea
                            value={getFieldValue(serviceIndex, 'description')}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleFieldChange(serviceIndex, 'description', e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Service Description"
                            className="text-gray-600 text-sm mb-3 w-full border border-gray-300 rounded px-2 py-1"
                            rows="2"
                          />
                          <input
                            type="text"
                            value={getFieldValue(serviceIndex, 'availability')}
                            onChange={(e) => {
                              e.stopPropagation();
                              handleFieldChange(serviceIndex, 'availability', e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Availability (e.g., Thursdays & Fridays 8am-4:30pm)"
                            className="text-sm text-gray-500 italic w-full border border-gray-300 rounded px-2 py-1"
                          />
                        </>
                      ) : (
                        <>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            {service.label}
                            {service.required && <span className="text-red-500 ml-1">*</span>}
                          </h3>
                          {service.description && (
                            <p className="text-gray-600 text-sm mb-3">{service.description}</p>
                          )}
                          {service.availability && (
                            <p className="text-sm text-gray-500 italic">{service.availability}</p>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Control Buttons */}
                    <div className="flex gap-3 ml-4">
                      {builderMode ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveOption?.(e, serviceIndex, 'service-card');
                          }}
                          className="text-red-500 hover:text-red-700 p-2"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              isSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceToggle(service.value, true);
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                              !isSelected
                                ? 'bg-gray-600 text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceToggle(service.value, false);
                            }}
                          >
                            No
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-Options Section */}
            {((isSelected && !builderMode) || builderMode) && service.subOptions && service.subOptions.length > 0 && (
              <div className={`ml-6 border-l-2 ${builderMode ? 'border-gray-300' : 'border-emerald-300'} pl-6 py-4 ${builderMode ? 'bg-gray-50' : 'bg-emerald-50/50'} rounded-r-lg`}>
                {builderMode ? (
                  <>
                    <input
                      type="text"
                      value={getFieldValue(serviceIndex, 'subOptionsTitle')}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFieldChange(serviceIndex, 'subOptionsTitle', e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Sub-options Title (e.g., Select Options)"
                      className="font-semibold text-gray-900 mb-4 w-full border border-gray-300 rounded px-2 py-1"
                    />
                    <input
                      type="text"
                      value={getFieldValue(serviceIndex, 'subOptionsNote')}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleFieldChange(serviceIndex, 'subOptionsNote', e.target.value);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      placeholder="Note for sub-options (optional)"
                      className="text-sm text-gray-600 mb-4 italic w-full border border-gray-300 rounded px-2 py-1"
                    />
                  </>
                ) : (
                  <>
                    <h4 className="font-semibold text-gray-900 mb-4">
                      {service.subOptionsTitle || 'Select Options'}
                      {service.subOptionsRequired && <span className="text-red-500 ml-1">*</span>}
                    </h4>
                    {service.subOptionsNote && (
                      <p className="text-sm text-gray-600 mb-4 italic">{service.subOptionsNote}</p>
                    )}
                  </>
                )}
                
                <div className="space-y-3">
                  {service.subOptions.map((subOption, subIndex) => {
                    const isSubOptionSelected = localValue[service.value]?.subOptions?.includes(subOption.value) || false;
                    const currentSubImageUrl = getSubOptionImageUrl(serviceIndex, subIndex, subOption.imageUrl);
                    
                    return (
                      <div key={subOption.value || subIndex} className="flex items-start gap-3">
                        {(builderMode || currentSubImageUrl) && (
                          <div className="flex-shrink-0">
                            {builderMode ? (
                              <>
                                {currentSubImageUrl && !brokenSubOptionImages.has(`${serviceIndex}-${subIndex}`) ? (
                                  <div className="relative w-12 h-12 group">
                                    <img
                                      src={currentSubImageUrl}
                                      alt={subOption.label}
                                      className="w-full h-full object-cover rounded"
                                      onError={() => handleSubOptionImageError(serviceIndex, subIndex)}
                                      onLoad={() => {
                                        setBrokenSubOptionImages(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(`${serviceIndex}-${subIndex}`);
                                          return newSet;
                                        });
                                      }}
                                    />
                                    <label className="absolute inset-0 bg-black bg-opacity-50 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                                      <input
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={(e) => {
                                          if (e.target.files[0]) {
                                            setBrokenSubOptionImages(prev => {
                                              const newSet = new Set(prev);
                                              newSet.delete(`${serviceIndex}-${subIndex}`);
                                              return newSet;
                                            });
                                            handleSubOptionImageUpload(serviceIndex, subIndex, e.target.files[0]);
                                          }
                                        }}
                                      />
                                      <Upload className="w-3 h-3 text-white" />
                                    </label>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        const updatedSubOptions = [...service.subOptions];
                                        updatedSubOptions[subIndex] = {
                                          ...updatedSubOptions[subIndex],
                                          imageFilename: null,
                                          imageUrl: null
                                        };
                                        updateOptionLabel?.(
                                          { target: { value: JSON.stringify(updatedSubOptions) }, stopPropagation: () => {} },
                                          { index: serviceIndex, field: 'subOptions', label: JSON.stringify(updatedSubOptions) },
                                          'service-card'
                                        );
                                      }}
                                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-red-600 z-10"
                                    >
                                      <X className="w-2 h-2" />
                                    </button>
                                  </div>
                                ) : (
                                  <label className="w-12 h-12 border border-dashed border-gray-300 rounded flex flex-col items-center justify-center bg-white cursor-pointer hover:border-gray-400">
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        if (e.target.files[0]) {
                                          setBrokenSubOptionImages(prev => {
                                            const newSet = new Set(prev);
                                            newSet.delete(`${serviceIndex}-${subIndex}`);
                                            return newSet;
                                          });
                                          handleSubOptionImageUpload(serviceIndex, subIndex, e.target.files[0]);
                                        }
                                      }}
                                    />
                                    {brokenSubOptionImages.has(`${serviceIndex}-${subIndex}`) ? (
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                    ) : (
                                      <Upload className="w-4 h-4 text-gray-400" />
                                    )}
                                  </label>
                                )}
                              </>
                            ) : (
                              currentSubImageUrl && (
                                <div className="w-12 h-12">
                                  {!brokenSubOptionImages.has(`${serviceIndex}-${subIndex}`) ? (
                                    <img
                                      src={currentSubImageUrl}
                                      alt={subOption.label}
                                      className="w-12 h-12 object-cover rounded"
                                      onError={() => handleSubOptionImageError(serviceIndex, subIndex)}
                                      onLoad={() => {
                                        setBrokenSubOptionImages(prev => {
                                          const newSet = new Set(prev);
                                          newSet.delete(`${serviceIndex}-${subIndex}`);
                                          return newSet;
                                        });
                                      }}
                                    />
                                  ) : (
                                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
                                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                      </svg>
                                    </div>
                                  )}
                                </div>
                              )
                            )}
                          </div>
                        )}
                        
                        {builderMode ? (
                          <div className="flex-1 flex items-center gap-2">
                            <input
                              type="text"
                              value={getSubOptionLabelValue(serviceIndex, subIndex)}
                              onChange={(e) => {
                                e.stopPropagation();
                                handleSubOptionLabelChange(serviceIndex, subIndex, e.target.value);
                              }}
                              onClick={(e) => e.stopPropagation()}
                              placeholder="Sub-option label"
                              className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                            />
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedSubOptions = service.subOptions.filter((_, i) => i !== subIndex);
                                updateOptionLabel?.(
                                  { target: { value: JSON.stringify(updatedSubOptions) }, stopPropagation: () => {} },
                                  { index: serviceIndex, field: 'subOptions', label: JSON.stringify(updatedSubOptions) },
                                  'service-card'
                                );
                              }}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <label className="flex items-start gap-3 cursor-pointer group flex-1">
                            <div className="relative flex-shrink-0 mt-0.5">
                              <input
                                type="checkbox"
                                checked={isSubOptionSelected}
                                onChange={() => handleSubOptionToggle(service.value, subOption.value)}
                                className="sr-only"
                              />
                              <div
                                className={`w-5 h-5 border-2 rounded flex items-center justify-center transition-colors ${
                                  isSubOptionSelected
                                    ? 'bg-emerald-600 border-emerald-600'
                                    : 'border-gray-300 group-hover:border-gray-400'
                                }`}
                              >
                                {isSubOptionSelected && (
                                  <Check className="w-3.5 h-3.5 text-white" />
                                )}
                              </div>
                            </div>
                            <span className="text-gray-700 text-sm">{subOption.label}</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {builderMode && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newSubOption = {
                        label: '',
                        value: `sub-option-${Date.now()}`,
                        imageUrl: null,
                        imageFilename: null
                      };
                      const updatedSubOptions = [...(service.subOptions || []), newSubOption];
                      
                      // Update local state for the new sub-option
                      const newSubIndex = updatedSubOptions.length - 1;
                      setLocalInputValues(prev => ({
                        ...prev,
                        [`${serviceIndex}-${newSubIndex}-subOptionLabel`]: ''
                      }));
                      
                      updateOptionLabel?.(
                        { target: { value: JSON.stringify(updatedSubOptions) }, stopPropagation: () => {} },
                        { index: serviceIndex, field: 'subOptions', label: JSON.stringify(updatedSubOptions) },
                        'service-card'
                      );
                    }}
                    className="mt-3 px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" /> Add Sub-Option
                  </button>
                )}
              </div>
            )}
            
            {builderMode && (!service.subOptions || service.subOptions.length === 0) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  const initialSubOption = {
                    label: '',
                    value: `sub-option-${Date.now()}`,
                    imageUrl: null,
                    imageFilename: null
                  };
                  
                  // Initialize local state for the new sub-option
                  setLocalInputValues(prev => ({
                    ...prev,
                    [`${serviceIndex}-0-subOptionLabel`]: ''
                  }));
                  
                  updateOptionLabel?.(
                    { target: { value: JSON.stringify([initialSubOption]) }, stopPropagation: () => {} },
                    { index: serviceIndex, field: 'subOptions', label: JSON.stringify([initialSubOption]) },
                    'service-card'
                  );
                }}
                className="ml-6 px-4 py-2 text-sm bg-emerald-100 text-emerald-700 rounded hover:bg-emerald-200 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" /> Add Sub-Options Section
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ============================================
// ServiceCardsField Wrapper Component
// ============================================
const ServiceCardsField = ({
  label,
  required,
  builderMode = false,
  builder,
  options,
  option_type = 'service',
  value,
  onChange,
  error,
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  ...restProps
}) => {
  const convertOptionsToItems = (options) => {
    if (!options) return [];
    const optionsArray = typeof options === 'string' ? JSON.parse(options) : options;
    return optionsArray.map(option => ({
      value: option.value || option.label?.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '') || `option-${Date.now()}`,
      label: option.label || '',
      description: option.description || '',
      availability: option.availability || '',
      imageUrl: option.imageUrl || null,
      imageFilename: option.imageFilename || null,
      required: option.required || false,
      subOptions: option.subOptions || [],
      subOptionsTitle: option.subOptionsTitle || '',
      subOptionsNote: option.subOptionsNote || '',
      subOptionsRequired: option.subOptionsRequired || false
    }));
  };

  const items = convertOptionsToItems(options);

  const hasValue = value && Object.keys(value).some(key => value[key]?.selected);
  const shouldShowError = !builderMode && required && (
    error || 
    (forceShowErrors && !hasValue)
  );
  const shouldShowValid = !builderMode && required && !shouldShowError && hasValue;


  return (
    <div className="mb-6">
      {label && !builderMode && (
        <label className="font-semibold form-label inline-block mb-4 text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={`
        rounded-lg border transition-all duration-200 p-3
        ${shouldShowError
            ? 'border-red-400 bg-red-50'
            : shouldShowValid
                ? 'border-green-400 bg-green-50'
                : 'border-gray-300 bg-white'
        }
      `}>
        <ServiceCards
          items={items}
          value={value}
          onChange={onChange}
          builderMode={builderMode}
          updateOptionLabel={updateOptionLabel}
          handleRemoveOption={handleRemoveOption}
          onImageUpload={onImageUpload}
          optionType={option_type}
        />
      </div>
      
      {shouldShowError && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">
            {error || 'Please select at least one service'}
          </p>
        </div>
      )}
    </div>
  );
};

export default ServiceCardsField;