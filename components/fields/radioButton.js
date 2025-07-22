import React, { useEffect, useRef, useState } from "react";

function RadioButton(props) {
  const ref = useRef();
  const [error, setError] = useState(false);
  const [label, setLabel] = useState(props.label ? props.label : "");
  const [builderMode, setBuilderMode] = useState(false);

  // Size configurations
  const sizeConfig = {
    small: {
      containerClass: 'flex items-center mb-2',
      radioSize: 'h-4 w-4',
      labelClass: 'ml-2 text-sm'
    },
    medium: {
      containerClass: 'flex items-center mb-3',
      radioSize: 'h-5 w-5',
      labelClass: 'ml-2 text-base'
    },
    large: {
      containerClass: 'flex items-center mb-4',
      radioSize: 'h-6 w-6',
      labelClass: 'ml-3 text-lg'
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;

    if (value) {
      setLabel(value);
      props.updateOptionLabel(e, {index: props.index, label: value}, 'radio');
    } else {
      setError(true);
    }
  }

  const selectRadio = () => {
    if (ref.current) {
      ref.current.checked = true;
    }
    // Use onClick if available, otherwise fallback to onChange
    if (props.onClick) {
      props.onClick(props.value);
    } else if (props.onChange) {
      props.onChange(props.label || props.value);
    }
  }

  useEffect(() => {
    if (props.builder) {
      setBuilderMode(true);
    }
  }, [props.builder]);

  const size = props.size || 'medium';
  const { containerClass, radioSize, labelClass } = sizeConfig[size] || sizeConfig.medium;
  
  // Handle both new interface (selectedValue) and old interface (checked)
  const isSelected = props.selectedValue 
    ? (props.value === props.selectedValue) 
    : (props.checked || false);

  // Get border and styling classes - keep simple for individual radio buttons
  const getRadioClasses = () => {
    return isSelected 
      ? 'bg-[#1B457B] border-[#1B457B]' 
      : 'border-gray-300 bg-white hover:border-gray-400';
  };

  return (
    <div className="mt-2">
      <label className={`${containerClass} cursor-pointer ${builderMode ? 'hover:bg-gray-50 p-1' : ''}`}>
        <div className="relative flex items-center justify-center">
          <input
            id={props.id}
            ref={ref}
            type="radio"
            className="sr-only"
            name={props.name}
            value={props.value || props.label}
            checked={isSelected}
            onChange={() => selectRadio()}
            disabled={props.disabled}
          />
          <div 
            className={`${radioSize} rounded-full border transition-colors duration-200 ${
              getRadioClasses()
            } flex items-center justify-center`}
            onClick={selectRadio}
          >
            {isSelected && (
              <div 
                className={`rounded-full bg-[#1B457B] flex items-center justify-center`}
                style={{ 
                  width: '100%', 
                  height: '100%',
                  transform: 'scale(1)' 
                }}
              >
                <div 
                  className="rounded-full bg-white" 
                  style={{ width: '50%', height: '50%' }} 
                />
              </div>
            )}
          </div>
        </div>
        {builderMode ? (
          <div className="flex flex-row group/field items-center ml-2">
            <input 
              type="text" 
              defaultValue={label} 
              className={`border-b border-zinc-300 outline-none ${label.length > 30 && 'w-[40em]'}`} 
              onBlur={(e) => {handleChange(e)}} 
            />
            <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
              <button 
                className='p-1 rounded text-sm mt-2 outline-none' 
                onClick={(e) => {
                  e.stopPropagation();
                  props.handleRemoveOption(e, props.index, 'radio');
                }} 
                title="Delete Option"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="ml-1 w-5 h-5 text-zinc-400">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>
          </div>
        ) : (
          !props.hideLabel && label && (
            <span className={`${labelClass} ${props?.boldLabel ? 'font-bold' : 'font-medium'} cursor-pointer text-gray-900`}>
              {label}
            </span>
          )
        )}
      </label>
    </div>
  );
}

export default RadioButton;