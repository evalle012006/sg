import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';

const Select = ({
  label,
  options = [],
  multi = false,
  onClick,
  size = 'medium',
  className = '',
  value = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedValues, setSelectedValues] = useState(multi ? (Array.isArray(value) ? value : []) : value);
  const selectRef = useRef(null);

  // Determine size classes
  const sizeClasses = {
    small: 'p-1 text-sm',
    medium: 'p-2',
    large: 'p-3 text-lg',
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Handle option selection
  const handleOptionClick = (option) => {
    if (multi) {
      // For multi-select
      const updatedValues = selectedValues.some(item => item.value === option.value)
        ? selectedValues.filter(item => item.value !== option.value)
        : [...selectedValues, option];
      
      setSelectedValues(updatedValues);
      if (onClick) onClick(updatedValues);
    } else {
      // For single select
      setSelectedValues(option);
      setIsOpen(false);
      if (onClick) onClick(option);
    }
  };

  // Remove a selected option (for multi-select)
  const removeOption = (e, optionToRemove) => {
    e.stopPropagation();
    const updatedValues = selectedValues.filter(item => item.value !== optionToRemove.value);
    setSelectedValues(updatedValues);
    if (onClick) onClick(updatedValues);
  };

  // Get display text for the select button
  const getDisplayText = () => {
    if (!selectedValues || (Array.isArray(selectedValues) && selectedValues.length === 0)) {
      return label || 'Select';
    }

    if (multi) {
      return selectedValues.length === 1 
        ? selectedValues[0].label 
        : `${selectedValues.length} items selected`;
    }

    return selectedValues.label;
  };

  // Check if an option is selected
  const isOptionSelected = (option) => {
    if (multi) {
      return selectedValues.some(item => item.value === option.value);
    }
    return selectedValues && selectedValues.value === option.value;
  };

  return (
    <div className={`relative w-full ${className}`} ref={selectRef}>
      {/* Select button */}
      <button
        type="button"
        className={`flex items-center justify-between w-full rounded-md border border-gray-300 bg-white ${sizeClasses[size]} text-left shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex flex-wrap items-center gap-1">
          {multi && Array.isArray(selectedValues) && selectedValues.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((selectedOption) => (
                <span
                  key={selectedOption.value}
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
            <span className={selectedValues ? '' : 'text-gray-500'}>
              {getDisplayText()}
            </span>
          )}
        </div>
        <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown options */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full rounded-md bg-white shadow-lg max-h-60 overflow-auto">
          <ul className="py-1">
            {options.map((option) => (
              <li
                key={option.value}
                className={`${
                  isOptionSelected(option) ? 'bg-blue-50 text-blue-900' : 'text-gray-900'
                } cursor-pointer select-none relative ${sizeClasses[size]} hover:bg-gray-100`}
                onClick={() => handleOptionClick(option)}
              >
                <div className="flex items-center justify-between">
                  <span>{option.label}</span>
                  {isOptionSelected(option) && (
                    <Check className="h-4 w-4 text-blue-600" />
                  )}
                </div>
              </li>
            ))}
            {options.length === 0 && (
              <li className="px-4 py-2 text-gray-500">No options available</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Select;