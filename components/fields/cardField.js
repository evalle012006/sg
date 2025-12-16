import React, { useCallback, useEffect, useState } from "react";
import CardSelection from "./cardSelection";

export default function CardField(props) {
  const {
    label,
    required,
    multi,
    size,
    builderMode,
    builder,
    options,
    option_type,
    value,
    onChange,
    error,
    forceShowErrors = false, 
    updateOptionLabel,
    handleRemoveOption,
    onImageUpload,
    ...restProps
  } = props;

  const [errorState, setErrorState] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const isValueInOptions = useCallback((val, optionsArray) => {
    if (!optionsArray || optionsArray.length === 0) return false;
    const opts = typeof optionsArray === 'string' ? JSON.parse(optionsArray) : optionsArray;
    return opts.some(opt => (opt.value || opt.label) === val);
  }, []);

  // Handle image upload in builder mode
  const handleImageUpload = (index, file) => {
    if (onImageUpload) {
      // Use parent's upload handler if provided
      onImageUpload(index, file);
    } else if (updateOptionLabel) {
      // Fallback: create object URL for preview (builder mode) - this will be replaced
      const imageUrl = URL.createObjectURL(file);
      updateOptionLabel(
        { target: { value: imageUrl }, stopPropagation: () => {} }, // Mock event object
        { index, field: 'imageUrl' },
        'card-selection'
      );
    }
  };

  // Convert options to items format expected by CardSelection
  const convertOptionsToItems = (options) => {
    if (!options) return [];
    const optionsArray = typeof options === 'string' ? JSON.parse(options) : options;
    return optionsArray.map(option => ({
      value: option.value || option.label,
      label: option.label,
      description: option.description || '',
      imageUrl: option.imageUrl || null,
      imageFilename: option.imageFilename || null
    }));
  };

  // Convert current answer to format expected by CardSelection
  const getCurrentValue = () => {
    if (!value) {
      return multi ? [] : null;
    }

    if (multi) {
      // For multi-select, expect array of selected values
      if (Array.isArray(value)) {
        return value;
      }
      // Handle string format (JSON)
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch (e) {
          return [value];
        }
      }
      return [value];
    } else {
      // For single select, expect single value
      if (Array.isArray(value)) {
        return value[0] || null;
      }
      return value;
    }
  };

  // Handle change events from CardSelection
  const handleChange = (newValue) => {
    setUserInteracted(true);
    setDirty(true);

    // Validate the selection
    if (required) {
      let isValidSelection = false;
      if (multi) {
        isValidSelection = Array.isArray(newValue) && newValue.length > 0;
      } else {
        isValidSelection = newValue !== null && newValue !== undefined && newValue !== '';
      }
      
      setIsValid(isValidSelection);
      setErrorState(!isValidSelection);
      setErrorMessage(isValidSelection ? '' : 'This field is required.');
    } else {
      setIsValid(true);
      setErrorState(false);
      setErrorMessage('');
    }

    // Call parent onChange
    if (onChange) {
      onChange(newValue);
    }
  };

  useEffect(() => {
    if (required && (userInteracted || forceShowErrors)) {
      let isValidSelection = false;
      const currentValue = getCurrentValue();
      
      if (multi) {
        // For multi-select: check if array has values
        // For courses, skip the isValueInOptions check since options are loaded dynamically
        isValidSelection = Array.isArray(currentValue) && 
                          currentValue.length > 0 &&
                          (option_type === 'course' || currentValue.every(val => isValueInOptions(val, options)));
      } else {
        // For single select: check if value exists
        // For courses, skip the isValueInOptions check since options are loaded dynamically
        isValidSelection = currentValue !== null && 
                          currentValue !== undefined && 
                          currentValue !== '' &&
                          (option_type === 'course' || isValueInOptions(currentValue, options));
      }
      
      setIsValid(isValidSelection);
      setErrorState(!isValidSelection);
      setErrorMessage(isValidSelection ? '' : 'This field is required.');
    } else if (!required || (!userInteracted && !forceShowErrors)) {
      setErrorState(false);
      setErrorMessage('');
    }
  }, [value, required, userInteracted, multi, forceShowErrors, option_type, options, isValueInOptions]); // ⭐ Added option_type and options to deps

  // Set initial validation state based on existing value
  useEffect(() => {
    const currentValue = getCurrentValue();
    let hasValue = false;
    
    if (multi) {
      hasValue = Array.isArray(currentValue) && currentValue.length > 0;
    } else {
      hasValue = currentValue !== null && currentValue !== undefined && currentValue !== '';
    }
    
    setIsValid(hasValue || !required);
    setErrorState(required && !hasValue && (userInteracted || forceShowErrors));
  }, [forceShowErrors]); 

  const shouldShowError = error || (errorState && (userInteracted || forceShowErrors));

  return (
    <div className="flex flex-col w-full mt-4">
      <CardSelection
        items={convertOptionsToItems(options)}
        value={getCurrentValue()}
        onChange={handleChange}
        required={required}
        multi={multi}
        size={size}
        builderMode={builderMode}
        optionType={option_type}
        updateOptionLabel={updateOptionLabel}
        handleRemoveOption={handleRemoveOption}
        onImageUpload={handleImageUpload}
        error={error || (errorState ? errorMessage : null)}
        forceShowErrors={forceShowErrors}
        {...restProps}
      />
      
      {shouldShowError && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">
            {error || errorMessage || 'This field is required.'}
          </p>
        </div>
      )}
    </div>
  );
}