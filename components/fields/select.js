import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

const SelectField = ({
  label,
  options = [],
  multi = false,
  onClick,
  onChange,
  size = 'medium',
  className = '',
  value,
  defaultValue,
  required = false,
  error: propsError,
  placeholder,
  builderMode = false,
  builder = false,
  updateOptionLabel,
  handleRemoveOption,
  validateOnMount = true,
  forceShowErrors = false,
  ...otherProps
}) => {
  // Helper function to check if a value is "empty" (but allows 0)
  const isEmpty = (val) => {
    return val === null || val === undefined || val === '';
  };

  // Helper function to check if a value exists (allows 0)
  const hasValue = (val) => {
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return val !== null && val !== undefined && val !== '';
  };

  // ENHANCED: Normalize options to handle problematic data formats
  const normalizeOptions = (rawOptions) => {
    // Handle loading states and invalid options
    if (!rawOptions || !Array.isArray(rawOptions) || rawOptions.length === 0) {
      return [];
    }
    
    return rawOptions.map((option, index) => {
      // Handle string options
      if (typeof option === 'string') {
        return { label: option, value: option };
      }
      
      // Handle object options (this is the main case)
      if (option && typeof option === 'object') {
        let label = option.label;
        let value = option.value;
        
        // Ensure label is defined
        if (isEmpty(label)) {
          label = `Option ${index + 1}`;
        }
        
        // Fix problematic values (but preserve 0)
        if (value === false || value === undefined || value === null) {
          value = option.id || option.key || `option_${index}`;
        }
        
        return { label: label, value: String(value) };
      }
      
      // Fallback for any other format
      return { label: `Option ${index + 1}`, value: `option_${index}` };
    });
  };

  // Normalize the options prop
  const normalizedOptions = normalizeOptions(options);

  // Determine if this is multi-select
  const isMultiSelect = (() => {
    if (multi !== undefined) return multi;
    if ((builderMode || builder) && otherProps.question?.type) {
      return otherProps.question.type === 'multi-select';
    }
    return false;
  })();

  // Helper to normalize input values to proper format
  const normalizeValue = (rawValue) => {
    if (isEmpty(rawValue)) return isMultiSelect ? [] : null;
    
    if (isMultiSelect) {
      if (!Array.isArray(rawValue)) return [];
      return rawValue.map(item => {
        if (typeof item === 'object' && item.label !== undefined && item.value !== undefined) return item;
        if (typeof item === 'string' || typeof item === 'number') {
          const found = normalizedOptions.find(opt => opt.value == item || opt.label == item);
          return found || { label: item, value: item };
        }
        return item;
      });
    } else {
      if (typeof rawValue === 'object' && rawValue.label !== undefined && rawValue.value !== undefined) return rawValue;
      if (typeof rawValue === 'string' || typeof rawValue === 'number') {
        const found = normalizedOptions.find(opt => opt.value == rawValue || opt.label == rawValue);
        return found || { label: rawValue, value: rawValue };
      }
      return rawValue;
    }
  };

  // Initialize state
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState(() => normalizeValue(value ?? defaultValue));
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const selectRef = useRef(null);

  // Size classes
  const sizeClasses = {
    small: 'px-3 py-1.5 text-sm min-h-[2rem]',
    medium: 'px-3.5 py-2.5 text-base min-h-[3rem]',
    large: 'px-4 py-3 text-lg min-h-[3.5rem]',
  };

  // Enhanced validation function
  const validateInput = (inputValue, shouldSetDirty = false) => {
    let isFieldValid = true;
    
    if (propsError) {
      setError(true);
      setErrorMessage(propsError);
      if (shouldSetDirty) setDirty(true);
      return;
    }
    
    if (required) {
      if (isMultiSelect) {
        isFieldValid = inputValue && Array.isArray(inputValue) && inputValue.length > 0;
      } else {
        isFieldValid = hasValue(inputValue) && (
          (typeof inputValue === 'object' && inputValue.value !== undefined && inputValue.value !== null && inputValue.value !== '') ||
          (typeof inputValue === 'string' && inputValue.trim() !== '') ||
          (typeof inputValue === 'number')
        );
      }
    }
    
    if (isFieldValid) {
      setError(false);
      setErrorMessage('');
    } else {
      setError(true);
      const fieldName = label || (isMultiSelect ? 'Selection' : 'Option');
      setErrorMessage(`${fieldName} is required`);
    }
    
    setIsValid(isFieldValid);
    if (shouldSetDirty) setDirty(true);
  };

  // Initial setup effect - handles pre-populated data validation
  useEffect(() => {
    const initialValue = normalizeValue(value ?? defaultValue);
    
    if (hasValue(initialValue) && validateOnMount) {
      setSelectedValues(initialValue);
      setDirty(true);
      validateInput(initialValue);
    } else if (hasValue(initialValue)) {
      setSelectedValues(initialValue);
      validateInput(initialValue);
    }
    
    setIsInitialized(true);
  }, []);

  // Handle builder mode initialization
  useEffect(() => {
    if ((builderMode || builder) && otherProps.question) {
      const questionValue = normalizeValue(otherProps.question.value ?? otherProps.question.defaultValue);
      if (hasValue(questionValue) && validateOnMount) {
        setSelectedValues(questionValue);
        setDirty(true);
        validateInput(questionValue);
      } else if (hasValue(questionValue)) {
        setSelectedValues(questionValue);
        validateInput(questionValue);
      }
    }
  }, [builderMode, builder, otherProps.question]);

  // Sync with external value changes (after initial mount)
  useEffect(() => {
    if (isInitialized && value !== undefined) {
      const normalized = normalizeValue(value);
      const valueExists = hasValue(normalized);
      
      setSelectedValues(normalized);
      if (valueExists && validateOnMount) {
        setDirty(true);
      }
      validateInput(normalized, valueExists && validateOnMount);
    }
  }, [value, isInitialized]);

  // Validation effect - runs when dependencies change
  useEffect(() => {
    if (isInitialized) {
      validateInput(selectedValues);
    }
  }, [required, isInitialized]);

  // Handle propsError
  useEffect(() => {
    if (isInitialized && propsError) {
      const valueIsEmpty = isMultiSelect 
        ? !selectedValues || !Array.isArray(selectedValues) || selectedValues.length === 0
        : !hasValue(selectedValues);
      
      if (valueIsEmpty && required) {
        setError(true);
        setErrorMessage(propsError);
        if (validateOnMount) setDirty(true);
      }
    }
  }, [propsError, isInitialized]);

  // Check if option is selected
  const isOptionSelected = (option) => {
    if (isMultiSelect) {
      if (!Array.isArray(selectedValues)) return false;
      return selectedValues.some(item => {
        if (typeof item === 'object') return item.value === option.value && item.label === option.label;
        if (typeof item === 'string' || typeof item === 'number') return item == option.value || item == option.label;
        return false;
      });
    } else {
      if (!hasValue(selectedValues)) return false;
      if (typeof selectedValues === 'object') {
        return selectedValues.value === option.value && selectedValues.label === option.label;
      }
      if (typeof selectedValues === 'string' || typeof selectedValues === 'number') {
        // Use loose equality (==) to handle number/string comparisons
        return selectedValues == option.value || selectedValues == option.label;
      }
      return false;
    }
  };

  // Handle option selection
  const handleOptionClick = (option) => {
    setDirty(true);
    let updatedValues;

    if (isMultiSelect) {
      const currentValues = Array.isArray(selectedValues) ? [...selectedValues] : [];
      const isSelected = isOptionSelected(option);
      
      if (isSelected) {
        // Remove option
        updatedValues = currentValues.filter(item => {
          if (typeof item === 'object') {
            return !(item.value === option.value && item.label === option.label);
          }
          if (typeof item === 'string') {
            return !(item === option.value || item === option.label);
          }
          return true;
        });
      } else {
        // Add option
        updatedValues = [...currentValues, option];
      }
    } else {
      // Single select
      const isSame = isOptionSelected(option);
      updatedValues = isSame ? null : option;
      setIsOpen(false);
      setIsFocused(false);
    }
    
    setSelectedValues(updatedValues);
    validateInput(updatedValues, true);
    
    if (onClick) onClick(updatedValues);
    if (onChange) onChange(updatedValues);
  };

  // Remove selected option (for multi-select tags)
  const removeOption = (e, optionToRemove) => {
    e.preventDefault();
    e.stopPropagation();
    setDirty(true);
    
    const updatedValues = selectedValues.filter(item => 
      !(item.value === optionToRemove.value && item.label === optionToRemove.label)
    );
    
    setSelectedValues(updatedValues);
    validateInput(updatedValues, true);
    
    if (onClick) onClick(updatedValues);
    if (onChange) onChange(updatedValues);
  };

  // Get display text
  const getDisplayText = () => {
    if (!hasValue(selectedValues) || (Array.isArray(selectedValues) && selectedValues.length === 0)) {
      return placeholder || label || 'Select...';
    }

    if (isMultiSelect && Array.isArray(selectedValues)) {
      return selectedValues.length === 1 
        ? selectedValues[0].label 
        : `${selectedValues.length} items selected`;
    }

    if (typeof selectedValues === 'string' || typeof selectedValues === 'number') return selectedValues;
    
    // Fix: Don't use || operator with label since "0" is falsy
    if (selectedValues?.label !== undefined && selectedValues?.label !== null) {
      return selectedValues.label;
    }
    return 'Select...';
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    const handleEscapeKey = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsFocused(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isOpen]);

  // Visual states
  const shouldShowError = error && (dirty || forceShowErrors);
  const shouldShowValid = !shouldShowError && isValid && (dirty || forceShowErrors);

  const getBorderClasses = () => {
    if (shouldShowError) return 'border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-200';
    if (shouldShowValid) return 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-200';
    if (isFocused || isOpen) return 'border-blue-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-200';
    return 'border-gray-300 focus:border-blue-400 focus:ring-2 focus:ring-blue-200';
  };

  const getBackgroundClasses = () => {
    if (shouldShowError) return 'bg-red-50 focus:bg-white';
    if (shouldShowValid) return 'bg-green-50 focus:bg-white';
    return 'bg-white';
  };

  const StatusIcon = () => {
    if (shouldShowError) {
      return (
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    if (shouldShowValid) {
      return (
        <div className="absolute right-8 top-1/2 transform -translate-y-1/2 pointer-events-none">
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
      );
    }
    return null;
  };

  // Builder mode rendering
  if (builderMode || builder) {
    return (
      <div className="w-full" ref={selectRef}>
        <div className="relative">
          <button
            type="button"
            className={`flex items-center justify-between w-full rounded-lg border transition-all ease-in-out duration-200 text-left shadow-sm focus:outline-none pr-10 ${sizeClasses[size]} ${getBorderClasses()} ${getBackgroundClasses()} ${className}`}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsOpen(!isOpen);
              setIsFocused(true);
            }}
          >
            <div className="flex flex-wrap items-center gap-1 min-h-[1.5rem]">
              {isMultiSelect && Array.isArray(selectedValues) && selectedValues.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {selectedValues.map((selectedOption, index) => (
                    <span
                      key={selectedOption.value || index}
                      className="inline-flex items-center bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-sm"
                    >
                      {builderMode && updateOptionLabel ? (
                        <input
                          className="bg-transparent border-none outline-none text-blue-800 w-auto min-w-[50px]"
                          value={selectedOption.label}
                          onChange={(e) => updateOptionLabel(e, { ...selectedOption, index }, isMultiSelect ? 'multi-select' : 'select')}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        selectedOption.label
                      )}
                      {builderMode && handleRemoveOption ? (
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={(e) => handleRemoveOption(e, index, isMultiSelect ? 'multi-select' : 'select')}
                        />
                      ) : (
                        <X 
                          className="ml-1 h-3 w-3 cursor-pointer" 
                          onClick={(e) => removeOption(e, selectedOption)}
                        />
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <span className={hasValue(selectedValues) ? 'text-gray-900' : 'text-gray-500'}>
                  {getDisplayText()}
                  {isMultiSelect && (!hasValue(selectedValues) || (Array.isArray(selectedValues) && selectedValues.length === 0)) && (
                    <span className="text-xs text-gray-400 ml-1"> (multiple)</span>
                  )}
                </span>
              )}
            </div>
            <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform absolute right-2 ${isOpen ? 'rotate-180' : ''}`} />
          </button>
          <StatusIcon />

          {isOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto border border-gray-200">
              <ul className="py-1">
                {normalizedOptions.length === 0 ? (
                  <li className="px-3 py-2 text-gray-500">
                    {options && options.length === 0 ? 'No options available' : 'Loading options...'}
                  </li>
                ) : (
                  normalizedOptions.map((option, index) => (
                    <li
                      key={option.value || index}
                      className={`${
                        isOptionSelected(option) ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                      } cursor-pointer select-none relative px-3 py-2 hover:bg-gray-100 transition-colors duration-150`}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleOptionClick(option);
                      }}
                    >
                      <div className="flex items-center justify-between">
                        {builderMode && updateOptionLabel ? (
                          <input
                            className="bg-transparent border-none outline-none flex-1"
                            value={option.label}
                            onChange={(e) => updateOptionLabel(e, { ...option, index }, isMultiSelect ? 'multi-select' : 'select')}
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <span className="flex-1">{option.label}</span>
                        )}
                        <div className="flex items-center gap-2">
                          {isMultiSelect && isOptionSelected(option) && (
                            <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                          )}
                          {builderMode && handleRemoveOption && (
                            <X 
                              className="h-4 w-4 text-red-500 cursor-pointer flex-shrink-0" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveOption(e, index, isMultiSelect ? 'multi-select' : 'select');
                              }}
                            />
                          )}
                        </div>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}
        </div>

        {shouldShowError && (
          <div className="mt-1 flex items-center">
            <svg className="h-4 w-4 text-red-500 mr-1 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // Standard form rendering
  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}>
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      
      <div className="relative" ref={selectRef}>
        <button
          type="button"
          className={`flex items-center justify-between w-full rounded-lg border transition-all ease-in-out duration-200 text-left shadow-sm focus:outline-none pr-10 ${sizeClasses[size]} ${getBorderClasses()} ${getBackgroundClasses()}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setIsOpen(!isOpen);
            setIsFocused(true);
          }}
          {...otherProps}
        >
          <div className="flex flex-wrap items-center gap-1 min-h-[1.5rem]">
            {isMultiSelect && Array.isArray(selectedValues) && selectedValues.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {selectedValues.map((selectedOption, index) => (
                  <span
                    key={selectedOption.value || index}
                    className="inline-flex items-center bg-blue-100 text-blue-800 rounded px-2 py-0.5 text-sm"
                  >
                    {selectedOption.label}
                    <X 
                      className="ml-1 h-3 w-3 cursor-pointer" 
                      onClick={(e) => removeOption(e, selectedOption)}
                    />
                  </span>
                ))}
              </div>
            ) : (
              <span className={hasValue(selectedValues) ? 'text-gray-900' : 'text-gray-500'}>
                {getDisplayText()}
                {isMultiSelect && (!hasValue(selectedValues) || (Array.isArray(selectedValues) && selectedValues.length === 0)) && (
                  <span className="text-xs text-gray-400 ml-1">(multiple)</span>
                )}
              </span>
            )}
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform absolute right-2 ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        <StatusIcon />

        {isOpen && (
          <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto border border-gray-200">
            {isMultiSelect && normalizedOptions.length > 0 && (
              <div className="px-3 py-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50">
                Click options to select multiple items
              </div>
            )}
            <ul className="py-1">
              {normalizedOptions.length === 0 ? (
                <li className="px-3 py-2 text-gray-500">
                  {options && options.length === 0 ? 'No options available' : 'Loading options...'}
                </li>
              ) : (
                normalizedOptions.map((option, index) => (
                  <li
                    key={option.value || index}
                    className={`${
                      isOptionSelected(option) ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                    } cursor-pointer select-none relative px-3 py-2 hover:bg-gray-100 transition-colors duration-150`}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleOptionClick(option);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="flex-1">{option.label}</span>
                      {isOptionSelected(option) && (
                        <Check className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      )}
                    </div>
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>

      {shouldShowError && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default SelectField;