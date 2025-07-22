import React from 'react';

const RadioButton = ({ 
    label, 
    onClick, 
    value, 
    size = 'medium', 
    selectedValue,
    name
  }) => {
    const isSelected = value === selectedValue;
    
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
    
    const { containerClass, radioSize, labelClass } = sizeConfig[size] || sizeConfig.medium;
    
    return (
      <label className={containerClass}>
        <div className="relative flex items-center justify-center">
          <input
            type="radio"
            className="sr-only"
            name={name}
            value={value}
            checked={isSelected}
            onChange={() => onClick(value)}
          />
          <div 
            className={`${radioSize} rounded-full border ${
              isSelected 
                ? 'bg-[#1B457B] border-[#1B457B]' 
                : 'border-gray-300 bg-white'
            } flex items-center justify-center`}
          >
            {isSelected && (
              <div 
                className={`${radioSize} rounded-full bg-[#1B457B] flex items-center justify-center`}
                style={{ transform: 'scale(1)' }}
              >
                <div className="rounded-full bg-white" style={{ width: '50%', height: '50%' }} />
              </div>
            )}
          </div>
        </div>
        {label && <span className={labelClass}>{label}</span>}
      </label>
    );
};

export default RadioButton;