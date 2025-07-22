import React from 'react';

const Checkbox = ({ 
  label, 
  onClick, 
  value, 
  size = 'medium', 
  checked,
  name,
  mode = 'default' // 'default' or 'button'
}) => {
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
      buttonClass: 'px-3 py-2 text-sm font-medium',
      iconSize: 'h-3 w-3'
    },
    medium: {
      containerClass: 'inline-block mr-1 mb-1',
      buttonClass: 'px-4 py-2 text-base font-medium',
      iconSize: 'h-4 w-4'
    },
    large: {
      containerClass: 'inline-block mr-2 mb-2',
      buttonClass: 'px-5 py-3 text-lg font-medium',
      iconSize: 'h-5 w-5'
    }
  };

  if (mode === 'button') {
    const { containerClass, buttonClass, iconSize } = buttonSizeConfig[size] || buttonSizeConfig.medium;
    
    return (
      <div className={containerClass}>
        <label className="cursor-pointer">
          <input
            type="checkbox"
            className="sr-only"
            name={name}
            value={value}
            checked={checked}
            onChange={() => onClick(!checked, value)}
          />
          <div 
            className={`${buttonClass} rounded-md transition-all duration-200 flex items-center justify-center gap-2 min-w-0 ${
              checked 
                ? 'bg-[#E3EEF6] text-gray-700 shadow-md' 
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
            style={{ border: '1px solid #E3EEF6' }}
          >
            {checked && (
              <div className={`${iconSize} rounded-full flex items-center justify-center flex-shrink-0`} style={{ backgroundColor: '#00467F' }}>
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
            {label && <span className="truncate">{label}</span>}
          </div>
        </label>
      </div>
    );
  }

  // Default mode (existing functionality)
  const { containerClass, checkboxSize, labelClass } = defaultSizeConfig[size] || defaultSizeConfig.medium;
  
  return (
    <label className={containerClass}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          className="sr-only"
          name={name}
          value={value}
          checked={checked}
          onChange={() => onClick(!checked, value)}
        />
        <div 
          className={`${checkboxSize} rounded border ${
            checked 
              ? 'bg-[#1B457B] border-[#1B457B]' 
              : 'border-gray-300 bg-white'
          } flex items-center justify-center`}
        >
          {checked && (
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
      {label && <span className={labelClass}>{label}</span>}
    </label>
  );
};

export default Checkbox;