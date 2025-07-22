import React from 'react';

// Size Options:
// small: Compact buttons
// medium: Standard size (default)
// large: Larger, more prominent buttons

// Color Options:
// primary: Yellow (#FFCF01) - hover adds blue border
// secondary: Blue (#1B457B) - has yellow border by default, hover changes bg to yellow
// outline: No background, configurable border color
// white: White (#FFFFFF)
// legacy-outline: Transparent with blue border (maintained for backward compatibility)

// Required Props:
// label: Text to display on the button
// onClick: Function to handle click events
// disabled: Toggle disabled state (default: false)
// submit: Set as form submit button (default: false)
// className: Additional custom classes

const Button = ({
  size = 'medium',
  color = 'primary',
  label,
  onClick,
  disabled = false,
  submit = false,
  fullWidth = false,
  withIcon = false,
  iconName = 'check',
  iconSvg = null,
  className = '',
  // New config options
  secondaryNoBorder = false,
  secondaryNoHoverEffect = false,
  outlineBorderColor = '#1B457B',
}) => {
  // Size classes with responsive adjustments
  const sizeClasses = {
    small: 'px-2 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm',
    medium: 'px-3 py-2 text-sm sm:px-4 sm:py-3 sm:text-base',
    large: 'px-4 py-3 text-base sm:px-5 sm:py-4 sm:text-lg',
  };
  
  // Color classes - updated to match new requirements
  const colorClasses = {
    // Yellow buttons (previously warning) - hover adds blue border
    primary: 'bg-[#FFCF01] text-[#1B457B] hover:ring-2 hover:ring-[#1B457B]',
    
    // Blue buttons (previously primary) - yellow border by default, hover changes bg to yellow
    secondary: `bg-[#1B457B] text-white ${!secondaryNoBorder ? 'border border-[#FFCF01]' : ''} 
                ${!secondaryNoHoverEffect ? 'hover:bg-[#FFCF01] hover:text-[#1B457B]' : 'hover:bg-[#15386a]'}`,
    
    // No background, configurable border (previously light gray)
    outline: `bg-transparent border border-[${outlineBorderColor}] text-[${outlineBorderColor}] 
              hover:bg-[#1B457B] hover:text-white hover:border-transparent`,
    
    // White buttons - kept the same
    white: 'bg-[#FFFFFF] text-[#1B457B] border border-[#1B457B] hover:bg-[#f5f5f5]',
    
    // For backward compatibility
    'legacy-outline': 'bg-transparent border border-[#1B457B] text-[#1B457B] hover:bg-[#f5f5f5]',
    
    // For backward compatibility (now maps to primary)
    warning: 'bg-[#FFCF01] text-[#1B457B] hover:ring-2 hover:ring-[#1B457B]',
  };

  // Width classes
  const widthClasses = fullWidth ? 'w-full' : 'w-auto';
  
  // Render the appropriate icon based on iconName
  const renderIcon = () => {
    if (!withIcon) return null;

    const iconSize = size === 'small' ? 16 : size === 'medium' ? 18 : 20;
    const iconClass = "mr-1.5";
    
    switch (iconName) {
      case 'check':
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={iconSize} 
            height={iconSize} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={iconClass}
          >
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        );
      case 'wrong':
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={iconSize} 
            height={iconSize} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={iconClass}
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        );
      case 'delete':
        return (
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            width={iconSize} 
            height={iconSize} 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2" 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            className={iconClass}
          >
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        );
      case 'custom':
        return iconSvg ? React.cloneElement(iconSvg, { 
          className: iconClass,
          width: iconSize,
          height: iconSize
        }) : null;
      default:
        return null;
    }
  };

  return (
    <button
      type={submit ? 'submit' : 'button'}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
      className={`
        whitespace-nowrap
        ${widthClasses}
        min-w-[80px] sm:min-w-[100px]
        max-w-full
        rounded
        font-semibold
        transition-colors
        duration-200
        shadow-sm
        flex items-center justify-center
        gap-1 sm:gap-2
        overflow-hidden
        text-ellipsis
        ${sizeClasses[size] || sizeClasses.medium}
        ${colorClasses[color] || colorClasses.primary}
        ${disabled ? 'opacity-50' : ''}
        ${className}
      `}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
    >
      {withIcon && renderIcon()}
      {label}
    </button>
  );
};

export default Button;