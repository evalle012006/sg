import React from 'react';

const ProgressBar = ({ 
  label = "Loading", 
  progress = 10, 
  size = "medium" 
}) => {
  // Calculate styles based on size prop
  const getSizeStyles = () => {
    switch(size) {
      case "small":
        return {
          height: "8px",
          fontSize: "text-xs",
          padding: "p-2"
        };
      case "large":
        return {
          height: "16px",
          fontSize: "text-lg",
          padding: "p-4"
        };
      case "medium":
      default:
        return {
          height: "12px",
          fontSize: "text-base",
          padding: "p-3"
        };
    }
  };
  
  const sizeStyles = getSizeStyles();
  
  return (
    <div className="w-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className={`font-semibold ${sizeStyles.fontSize}`}>
          {progress}%
        </div>
        <div className={`text-gray-600 ${sizeStyles.fontSize}`}>
          {label}
        </div>
      </div>
      
      <div className="w-full bg-[#EBECF0] rounded-full overflow-hidden" style={{ height: sizeStyles.height }}>
        <div 
          className="h-full bg-[#FFCF01] rounded-full transition-all duration-300 ease-in-out"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ProgressBar;