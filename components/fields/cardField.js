import React, { useEffect, useState } from "react";
import CardSelection from "./cardSelection";

export default function CardField(props) {
  // Destructure only the props we need, excluding function props that shouldn't go to DOM
  const {
    label,
    required,
    multi,
    size,
    builderMode,
    builder,
    options,
    option_type, // New prop for option type
    value,
    onChange,
    error,
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
      imageUrl: option.imageUrl || null, // This will be populated by API on fetch
      imageFilename: option.imageFilename || null // This is stored in database
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
          return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
          return [];
        }
      }
      return [];
    } else {
      // For single select, expect single value
      if (Array.isArray(value)) {
        return value[0] || null;
      }
      return value;
    }
  };

  const handleChange = (newValue) => {
    setDirty(true);
    setUserInteracted(true);
    
    validateSelection(newValue);
    
    if (onChange) {
      if (multi) {
        // For multi-select, pass array of selected values
        onChange(newValue || []);
      } else {
        // For single select, pass the selected value
        onChange(newValue);
      }
    }
  };

  const validateSelection = (value) => {
    if (error) {
      setErrorState(true);
      setErrorMessage(error);
      setIsValid(false);
      return;
    }

    if (required) {
      let hasSelection = false;
      
      if (multi) {
        hasSelection = Array.isArray(value) && value.length > 0;
      } else {
        hasSelection = value !== null && value !== undefined && value !== '';
      }
      
      if (!hasSelection) {
        setErrorState(true);
        const fieldName = label || 'Selection';
        setErrorMessage(`${fieldName} is required`);
        setIsValid(false);
        return;
      }
    }

    setErrorState(false);
    setErrorMessage('');
    
    // Set valid state
    if (required) {
      let hasSelection = false;
      if (multi) {
        hasSelection = Array.isArray(value) && value.length > 0;
      } else {
        hasSelection = value !== null && value !== undefined && value !== '';
      }
      setIsValid(hasSelection);
    } else {
      setIsValid(true);
    }
  };

  useEffect(() => {
    validateSelection(getCurrentValue());
    
    if (error) {
      setDirty(true);
    }
  }, [error, required, value, multi]);

  const items = convertOptionsToItems(options);
  const currentValue = getCurrentValue();
  const shouldShowError = error || (errorState && userInteracted);
  const shouldShowValid = !shouldShowError && isValid && userInteracted && required;

  return (
    <div className="mb-2">
      {label && (
        <label className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className={`rounded-lg border transition-all duration-200 p-3 ${
        shouldShowError 
          ? 'border-red-400 bg-red-50' 
          : shouldShowValid 
          ? 'border-green-400 bg-green-50'
          : 'border-gray-300 bg-white'
      }`}>
        <CardSelection
          items={items}
          value={currentValue}
          onChange={handleChange}
          required={required}
          multi={multi}
          size={size || 'medium'}
          builderMode={builderMode || builder}
          optionType={option_type || 'funder'} // Pass option type to CardSelection
          updateOptionLabel={updateOptionLabel}
          handleRemoveOption={handleRemoveOption}
          onImageUpload={handleImageUpload}
        />
      </div>

      {shouldShowError && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
        </div>
      )}
      
      {/* {shouldShowValid && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-green-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-green-600 text-sm font-medium">Selection confirmed</p>
        </div>
      )} */}
    </div>
  );
}