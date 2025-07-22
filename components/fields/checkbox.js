import { useEffect, useRef, useState } from "react";

export default function CheckBox(props) {
  const [builderMode, setBuilderMode] = useState(false);
  const [label, setLabel] = useState(props.label ? props.label : "");
  const ref = useRef();

  // Size configurations for default mode
  const defaultSizeConfig = {
    small: {
      containerClass: 'flex items-center mb-2',
      checkboxSize: 'h-4 w-4',
      labelClass: 'ml-2 text-sm'
    },
    medium: {
      containerClass: 'flex items-center mb-3',
      checkboxSize: 'h-5 w-5',
      labelClass: 'ml-2 text-base'
    },
    large: {
      containerClass: 'flex items-center mb-4',
      checkboxSize: 'h-6 w-6',
      labelClass: 'ml-3 text-lg'
    }
  };

  // Size configurations for button mode
  const buttonSizeConfig = {
    small: {
      containerClass: 'inline-block mr-1 mb-1',
      buttonClass: 'px-2 py-1 text-sm font-medium',
      iconSize: 'h-3 w-3'
    },
    medium: {
      containerClass: 'inline-block mr-1 mb-1',
      buttonClass: 'px-3 py-1.5 text-sm font-medium',
      iconSize: 'h-3 w-3'
    },
    large: {
      containerClass: 'inline-block mr-2 mb-2',
      buttonClass: 'px-4 py-2 text-base font-medium',
      iconSize: 'h-4 w-4'
    }
  };

  const handleChange = (e) => {
    const value = e.target.value;
    if (value) {
      setLabel(value);
      props.updateOptionLabel(e, { index: props.index, label: value }, 'checkbox');
    }
  }

  const checkBox = () => {
    if (ref.current) {
      ref.current.checked = !props.value;
    }
    props.onChange(props.label, !props.value, props.notAvailableFlag);
  }

  useEffect(() => {
    if (props.builder) {
      setBuilderMode(props.builder);
    } else {
      setBuilderMode(false);
    }
  }, [props.builder]);

  const size = props.size || 'medium';
  const mode = props.mode || 'default';
  const isButtonMode = mode === 'button' || props.forceButtonMode;

  // Get styling classes - keep simple for individual checkboxes
  const getCheckboxClasses = () => {
    return props.checked 
      ? 'bg-[#1B457B] border-[#1B457B]' 
      : 'border-gray-300 bg-white hover:border-gray-400';
  };

  const getButtonModeClasses = () => {
    return props.checked 
      ? 'bg-[#E3EEF6] text-gray-700 shadow-md' 
      : 'bg-white text-gray-700 hover:bg-gray-50';
  };

  // Button mode rendering (including builder mode)
  if (isButtonMode) {
    const { containerClass, buttonClass, iconSize } = buttonSizeConfig[size] || buttonSizeConfig.medium;
    
    return (
      <div className={containerClass}>
        <label className="cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only"
            name={props.name}
            value={props.value ? props.value : false}
            checked={props.checked ? props.checked : false}
            onChange={() => props.onChange(props.label, !props.value)}
            disabled={props.disabled}
          />
          <div 
            className={`${buttonClass} rounded-md transition-all duration-200 flex items-center justify-center gap-1 ${
              getButtonModeClasses()
            } ${builderMode ? 'hover:bg-gray-100 cursor-text relative' : ''}`}
            style={{ border: '1px solid #E3EEF6' }}
            onClick={builderMode ? undefined : checkBox}
          >
            {props.checked && (
              <div className={`${iconSize} rounded-full flex items-center justify-center flex-shrink-0`} 
                   style={{ backgroundColor: '#00467F' }}>
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-2/3 w-2/3 text-white"
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor" 
                  strokeWidth={3}
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
              </div>
            )}
            {builderMode ? (
              <div className="flex flex-row group/field items-center">
                <input 
                  type="text" 
                  defaultValue={label} 
                  className="outline-none bg-transparent border-none text-inherit font-inherit text-center truncate placeholder-gray-400" 
                  placeholder="Enter option text"
                  size={Math.max(label.length || 10, 8)} // Dynamic width based on content
                  onBlur={(e) => { handleChange(e) }} 
                  onClick={(e) => e.stopPropagation()} // Prevent checkbox toggle when editing
                  onFocus={(e) => e.target.select()} // Select all text on focus for easy editing
                />
                <div className="flex flex-row justify-end invisible group-hover/field:visible ml-1 flex-shrink-0">
                  <button 
                    className='p-1 rounded text-sm outline-none hover:bg-red-100' 
                    onClick={(e) => {
                      e.stopPropagation();
                      props.handleRemoveOption(e, props.index, 'checkbox');
                    }} 
                    title="Delete Option"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor" className="w-3 h-3 text-red-500">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                  </button>
                </div>
                {/* Small edit indicator */}
                <div className="absolute top-0 right-0 transform translate-x-1 -translate-y-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full opacity-60"></div>
                </div>
              </div>
            ) : (
              label && <span className="truncate">{label}</span>
            )}
          </div>
        </label>
      </div>
    );
  }

  // Default mode (traditional checkbox)
  const { containerClass, checkboxSize, labelClass } = defaultSizeConfig[size] || defaultSizeConfig.medium;
  
  return (
    <div className="mt-1">
      <label className={`${containerClass} cursor-pointer ${builderMode ? 'hover:bg-gray-50' : ''}`}>
        <div className="relative flex items-center justify-center">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only"
            name={props.name}
            value={props.value ? props.value : false}
            checked={props.checked ? props.checked : false}
            onChange={() => props.onChange(props.label, !props.value)}
            disabled={props.disabled}
          />
          <div 
            className={`${checkboxSize} rounded border transition-colors duration-200 ${
              getCheckboxClasses()
            } flex items-center justify-center`}
            onClick={checkBox}
          >
            {props.checked && (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-3/4 w-3/4 text-white" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor" 
                strokeWidth={4}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  d="M5 13l4 4L19 7" 
                />
              </svg>
            )}
          </div>
        </div>
        {builderMode ? (
          <div className="flex flex-row group/field items-center ml-2">
            <input 
              type="text" 
              defaultValue={label} 
              className={`border-b border-zinc-300 outline-none ${label.length > 30 && 'w-[40em]'}`} 
              onBlur={(e) => { handleChange(e) }} 
            />
            <div className="flex flex-row justify-end pr-4 invisible group-hover/field:visible">
              <button 
                className='p-1 rounded text-sm mt-2 outline-none' 
                onClick={(e) => {
                  e.stopPropagation();
                  props.handleRemoveOption(e, props.index, 'checkbox');
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
          props.label && !props.hideLabel && (
            <span className={`${labelClass} ${props.bold ? 'font-bold' : 'font-medium'} text-gray-900`}>
              {label}
            </span>
          )
        )}
      </label>
    </div>
  );
}