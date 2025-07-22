import React, { useEffect, useState } from "react";
import CheckBox from "./checkbox";

export default function CheckBoxField(props) {
  const [error, setError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [dirty, setDirty] = useState(false);
  const [userInteracted, setUserInteracted] = useState(false);
  const [isValid, setIsValid] = useState(false);

  const handleChange = (label, checked) => {
    setDirty(true);
    setUserInteracted(true);
    
    let newOptions = props.options && props.options.map((option) => {
      if (option.label === label) {
        return { ...option, value: checked };
      }
      return option;
    });

    validateSelection(newOptions);
    props.onChange && props.onChange(props.label, newOptions);
  };

  const validateSelection = (options) => {
    if (props.error) {
      setError(true);
      setErrorMessage(props.error);
      setIsValid(false);
      return;
    }

    if (props.required) {
      const hasSelection = options && options.some(option => option.value === true);
      if (!hasSelection) {
        setError(true);
        const fieldName = props.label || 'Selection';
        setErrorMessage(`${fieldName} is required`);
        setIsValid(false);
        return;
      }
    }

    setError(false);
    setErrorMessage('');
    const hasAnySelection = options && options.some(option => option.value === true);
    setIsValid(props.required && hasAnySelection);
  };

  useEffect(() => {
    const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
    validateSelection(propOptions);
    
    if (props.error) {
      setDirty(true);
    }
  }, [props.error, props.required, props.options]);

  const propOptions = typeof props.options === 'string' ? JSON.parse(props.options) : props.options;
  const shouldShowError = props.error || (error && userInteracted);
  const shouldShowValid = !shouldShowError && isValid && userInteracted;
  
  // Determine container layout based on mode
  const isButtonMode = props.mode === 'button';
  const containerClasses = isButtonMode 
    ? 'flex flex-wrap gap-1' // Button mode: horizontal with wrapping
    : 'flex flex-col';       // Default mode: vertical stacking

  return (
    <div className="mb-2">
      {props.label && (
        <label className={`font-semibold form-label inline-block mb-1.5 ${shouldShowError ? 'text-red-700' : 'text-slate-700'}`}>
          {props.label}
          {props.required && <span className="text-red-500 ml-1">*</span>}
        </label>
      )}
      <div className={`${containerClasses} ${props?.hideoptions && 'hidden'} 
          rounded-lg border transition-all duration-200 p-3
          ${shouldShowError 
              ? 'border-red-400 bg-red-50' 
              : shouldShowValid 
              ? 'border-green-400 bg-green-50'
              : 'border-gray-300 bg-white'
          }
      `}>
        {props.options && propOptions.map((option, index) => {
          return (
            <CheckBox 
              key={index}
              value={option.value} 
              checked={option.value} 
              name={option.label} 
              label={option.label}
              onChange={handleChange} 
              disabled={props.disabled}
              builder={props.builder ? props.builder : false} 
              index={index}
              updateOptionLabel={props.updateOptionLabel} 
              handleRemoveOption={props.handleRemoveOption}
              size={props.size || 'medium'}
              mode={props.mode || 'default'} // Pass through the mode prop
              hasError={shouldShowError}
              // Force button mode styling even in builder mode
              forceButtonMode={props.mode === 'button'}
            />
          )
        })}
      </div>
      {shouldShowError && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
        </div>
      )}
      {shouldShowValid && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-green-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <p className="text-green-600 text-sm font-medium">Selection confirmed</p>
        </div>
      )}
    </div>
  )
}