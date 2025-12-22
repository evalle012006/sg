import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Check, Plus, X, Upload, Trash2 } from 'lucide-react';
import { getDefaultImage } from '../../lib/defaultImages';

const ServiceCards = ({
  items = [],
  value = {},
  onChange,
  builderMode = false,
  updateOptionLabel,
  handleRemoveOption,
  onImageUpload,
  optionType = 'service',
  error = null,
  forceShowErrors = false,
  required = false,
}) => {
  const [localValue, setLocalValue] = useState(value || {});
  const [brokenImages, setBrokenImages] = useState(new Set());
  const [editingFields, setEditingFields] = useState({});
  const [localInputValues, setLocalInputValues] = useState({});
  const [refreshedImageUrls, setRefreshedImageUrls] = useState(new Map());
  const updateTimeoutRef = useRef({});
  const prevValueRef = useRef(value);
  const hasRefreshedUrls = useRef(false);

  const initializeAllServices = useCallback((currentValue, serviceItems) => {
      if (!serviceItems || serviceItems.length === 0) {
          return currentValue || {};
      }
      
      const initialized = { ...(currentValue || {}) };
      
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

  // Check if a service has been explicitly answered by the user (from saved data or user interaction)
  const isServiceAnswered = useCallback((serviceValue) => {
    if (!value || typeof value !== 'object') return false;
    const serviceData = value[serviceValue];
    return serviceData && typeof serviceData.selected === 'boolean';
  }, [value]);

  // Check if ALL services have been answered
  const allServicesAnswered = useCallback(() => {
    if (!items || items.length === 0) return false;
    return items.every(item => isServiceAnswered(item.value));
  }, [items, isServiceAnswered]);

  useEffect(() => {
    const newValueStr = JSON.stringify(value);
    const prevValueStr = JSON.stringify(prevValueRef.current);
    
    if (newValueStr !== prevValueStr) {        
        const initializedValue = initializeAllServices(value, items);
        setLocalValue(initializedValue);
        prevValueRef.current = initializedValue;
    }
  }, [value, items, initializeAllServices]);

  useEffect(() => {
    const refreshImageUrls = async () => {
      if (!items || items.length === 0 || hasRefreshedUrls.current) return;
      
      hasRefreshedUrls.current = true;
      const newRefreshedUrls = new Map();

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

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
      }

      setRefreshedImageUrls(newRefreshedUrls);
    };

    refreshImageUrls();
  }, [items, optionType]);

  useEffect(() => {
    return () => {
      Object.values(updateTimeoutRef.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
    };
  }, []);

  // Get the current image URL (refreshed if available, otherwise original, or default)
  const getImageUrl = (index, originalUrl) => {
    const refreshedUrl = refreshedImageUrls.get(`service-${index}`);
    return refreshedUrl || originalUrl || getDefaultImage('service');
  };

  const handleImageError = (index) => {
    setBrokenImages(prev => new Set([...prev, index]));
  };

  const handleFieldChange = useCallback((index, field, value) => {
    const key = `${index}-${field}`;
    
    setLocalInputValues(prev => ({
      ...prev,
      [key]: value
    }));
    
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
    }
    
    updateTimeoutRef.current[key] = setTimeout(() => {
      if (updateOptionLabel) {
        updateOptionLabel(
          { target: { value }, stopPropagation: () => {} },
          { index, field, label: value },
          'service-card'
        );
      }
      delete updateTimeoutRef.current[key];
    }, 500);
  }, [updateOptionLabel]);

  const handleSubOptionLabelChange = useCallback((serviceIndex, subIndex, newLabel) => {
    const key = `${serviceIndex}-${subIndex}-subOptionLabel`;
    
    setLocalInputValues(prev => ({
      ...prev,
      [key]: newLabel
    }));
    
    if (updateTimeoutRef.current[key]) {
      clearTimeout(updateTimeoutRef.current[key]);
    }
    
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

  const getFieldValue = (index, field) => {
    const key = `${index}-${field}`;
    if (localInputValues && localInputValues[key] !== undefined) {
      return localInputValues[key];
    }
    return items[index]?.[field] || '';
  };

  const getSubOptionLabelValue = (serviceIndex, subIndex) => {
    const key = `${serviceIndex}-${subIndex}-subOptionLabel`;
    if (localInputValues && localInputValues[key] !== undefined) {
      return localInputValues[key];
    }
    return items[serviceIndex]?.subOptions?.[subIndex]?.label || '';
  };

  useEffect(() => {
    const initialValues = {};
    items.forEach((item, index) => {
      initialValues[`${index}-label`] = item.label || '';
      initialValues[`${index}-description`] = item.description || '';
      initialValues[`${index}-availability`] = item.availability || '';
      initialValues[`${index}-subOptionsTitle`] = item.subOptionsTitle || '';
      initialValues[`${index}-subOptionsNote`] = item.subOptionsNote || '';
      
      if (item.subOptions && item.subOptions.length > 0) {
        item.subOptions.forEach((subOption, subIndex) => {
          initialValues[`${index}-${subIndex}-subOptionLabel`] = subOption.label || '';
        });
      }
    });
    setLocalInputValues(initialValues);
  }, [items]);

  const handleServiceToggle = (serviceValue, isSelected) => {
      // Only update the specific service that was clicked
      // Don't spread initialized values - that would mark unanswered services as answered
      const currentValue = value || {};
      
      const newValue = {
          ...currentValue,
          [serviceValue]: {
              selected: isSelected,
              subOptions: isSelected ? (currentValue[serviceValue]?.subOptions || []) : []
          }
      };
      
      // Update local state for immediate UI feedback
      setLocalValue(prev => ({
          ...prev,
          [serviceValue]: {
              selected: isSelected,
              subOptions: isSelected ? (prev[serviceValue]?.subOptions || []) : []
          }
      }));
      
      onChange?.(newValue);
  };

  const handleSubOptionToggle = (serviceValue, subOptionValue) => {
      // Only update the specific service's sub-options
      const currentValue = value || {};
      
      const currentSubOptions = currentValue[serviceValue]?.subOptions || [];
      const newSubOptions = currentSubOptions.includes(subOptionValue)
          ? currentSubOptions.filter(id => id !== subOptionValue)
          : [...currentSubOptions, subOptionValue];
      
      const newValue = {
          ...currentValue,
          [serviceValue]: {
              ...currentValue[serviceValue],
              subOptions: newSubOptions
          }
      };
      
      // Update local state for immediate UI feedback
      setLocalValue(prev => ({
          ...prev,
          [serviceValue]: {
              ...prev[serviceValue],
              subOptions: newSubOptions
          }
      }));
      
      onChange?.(newValue);
  };

  const handleServiceImageUpload = (index, file) => {
    if (onImageUpload) {
      onImageUpload(index, file);
    }
  };

  useEffect(() => {
      if (items && items.length > 0) {
          const initialized = initializeAllServices(localValue, items);
          
          if (JSON.stringify(initialized) !== JSON.stringify(localValue)) {
              setLocalValue(initialized);
          }
      }
  }, [items, initializeAllServices, localValue]);

  // Determine styling for individual service cards
  const getServiceCardClasses = (serviceValue) => {
    if (builderMode) {
      return 'border-gray-200 bg-white hover:border-gray-300';
    }
    
    const serviceAnswered = isServiceAnswered(serviceValue);
    const hasError = error && forceShowErrors;
    
    // If there's an error and this service is NOT answered, show red
    if (hasError && !serviceAnswered) {
      return 'border-red-400 bg-red-50';
    }
    
    // If this service IS answered (regardless of Yes/No), show green
    if (serviceAnswered) {
      return 'border-green-400 bg-green-50';
    }
    
    // Default gray
    return 'border-gray-200 bg-white hover:border-gray-300';
  };

  // Get Yes button styling
  const getYesButtonClasses = (isSelected, serviceValue) => {
    const serviceAnswered = isServiceAnswered(serviceValue);
    const hasError = error && forceShowErrors;
    
    // If Yes is selected
    if (isSelected) {
      return 'bg-emerald-600 text-white';
    }
    
    // If error and not answered, show red-ish buttons
    if (hasError && !serviceAnswered) {
      return 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-300';
    }
    
    // Default gray
    return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  // Get No button styling
  const getNoButtonClasses = (isSelected, serviceValue) => {
    const serviceAnswered = isServiceAnswered(serviceValue);
    const hasError = error && forceShowErrors;
    
    // If service is answered and NOT selected (meaning No was chosen)
    if (serviceAnswered && !isSelected) {
      return 'bg-gray-600 text-white';
    }
    
    // If error and not answered, show red-ish buttons
    if (hasError && !serviceAnswered) {
      return 'bg-red-100 text-red-600 hover:bg-red-200 border border-red-300';
    }
    
    // Default gray
    return 'bg-gray-100 text-gray-600 hover:bg-gray-200';
  };

  return (
    <div className="space-y-6">
      {items.map((service, serviceIndex) => {
        const isSelected = localValue[service.value]?.selected || false;
        const currentImageUrl = getImageUrl(serviceIndex, service.imageUrl);
        const hasCustomImage = Boolean(service.imageUrl);
        const isBroken = brokenImages.has(serviceIndex);
        
        return (
          <div key={service.value || serviceIndex} className="space-y-4">
            {/* Service Card */}
            <div
              className={`border-2 rounded-lg p-6 transition-all ${
                builderMode ? 'cursor-default' : 'cursor-pointer'
              } ${getServiceCardClasses(service.value)}`}
              onClick={() => !builderMode && handleServiceToggle(service.value, !isSelected)}
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0">
                  {builderMode ? (
                    <div className="w-24 h-24">
                      <div className="relative w-24 h-24 group">
                        <img
                          src={isBroken ? getDefaultImage('service') : currentImageUrl}
                          alt={service.label || 'Service'}
                          className={`w-full h-full object-cover rounded-lg ${
                            !hasCustomImage || isBroken ? 'opacity-60' : ''
                          }`}
                          onError={(e) => {
                            if (hasCustomImage && !isBroken) {
                              handleImageError(serviceIndex);
                            }
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
                          <span className="text-xs text-white">
                            {hasCustomImage && !isBroken ? 'Replace' : 'Upload'}
                          </span>
                        </label>
                        {hasCustomImage && !isBroken && (
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
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="w-24 h-24">
                      <img
                        src={isBroken ? getDefaultImage('service') : currentImageUrl}
                        alt={service.label || 'Service'}
                        className={`w-24 h-24 object-cover rounded-lg ${
                          !hasCustomImage || isBroken ? 'opacity-60' : ''
                        }`}
                        onError={(e) => {
                          if (hasCustomImage && !isBroken) {
                            handleImageError(serviceIndex);
                          }
                        }}
                      />
                    </div>
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
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${getYesButtonClasses(isSelected, service.value)}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleServiceToggle(service.value, true);
                            }}
                          >
                            Yes
                          </button>
                          <button
                            type="button"
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${getNoButtonClasses(isSelected, service.value)}`}
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
                    
                    return (
                      <div key={subOption.value || subIndex} className="flex items-center gap-3">
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
                          <label className="flex items-center gap-3 cursor-pointer group flex-1">
                            <div className="relative flex-shrink-0">
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
                        value: `sub-option-${Date.now()}`
                      };
                      const updatedSubOptions = [...(service.subOptions || []), newSubOption];
                      
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
                    value: `sub-option-${Date.now()}`
                  };
                  
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

// ServiceCardsField Wrapper Component
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
  forceShowErrors = false,
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

  // Check if user has answered all services
  const hasAllAnswers = value && typeof value === 'object' && 
    items.length > 0 && 
    items.every(item => value[item.value] && typeof value[item.value].selected === 'boolean');

  // Check if user has answered ANY service
  const hasAnyAnswer = value && typeof value === 'object' &&
    items.some(item => value[item.value] && typeof value[item.value].selected === 'boolean');

  const shouldShowError = !builderMode && required && (
    error || 
    (forceShowErrors && !hasAllAnswers)
  );
  
  // Show valid (green) when all services are answered and no error
  const shouldShowValid = !builderMode && !shouldShowError && hasAllAnswers;

  return (
    <div className="mb-6">
      {label && !builderMode && (
        <label className="font-semibold form-label inline-block mb-4 text-slate-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}

      <div className={`
        rounded-lg border-2 transition-all duration-200 p-3
        ${shouldShowError
            ? 'border-red-400 bg-red-50'
            : shouldShowValid
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 bg-white'
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
          error={shouldShowError ? (error || 'Please answer all service options') : null}
          forceShowErrors={forceShowErrors}
          required={required}
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