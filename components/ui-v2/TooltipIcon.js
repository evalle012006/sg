import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';

/**
 * TooltipIcon Component
 * 
 * Displays a help circle icon that shows tooltip content on hover.
 */
const TooltipIcon = ({ 
    tooltip, 
    position = 'top', 
    size = 16, 
    className = '' 
}) => {
    const [isVisible, setIsVisible] = useState(false);

    // Don't render if no tooltip content
    if (!tooltip || tooltip.trim() === '') {
        return null;
    }

    const positionStyles = {
        top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
        bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
        left: 'right-full top-1/2 -translate-y-1/2 mr-2',
        right: 'left-full top-1/2 -translate-y-1/2 ml-2'
    };

    const arrowStyles = {
        top: 'top-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-gray-900',
        bottom: 'bottom-full left-1/2 -translate-x-1/2 border-l-8 border-r-8 border-b-8 border-l-transparent border-r-transparent border-b-gray-900',
        left: 'left-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-l-8 border-t-transparent border-b-transparent border-l-gray-900',
        right: 'right-full top-1/2 -translate-y-1/2 border-t-8 border-b-8 border-r-8 border-t-transparent border-b-transparent border-r-gray-900'
    };

    return (
        <span 
            className={`relative inline-flex items-center ${className}`}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            <button
                type="button"
                className="text-gray-400 hover:text-blue-500 focus:outline-none p-2"
                onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsVisible(!isVisible);
                }}
                aria-label="Show help information"
            >
                <HelpCircle width={size} height={size} />
            </button>
            
            {isVisible && (
                <div 
                    className={`absolute z-[9999] ${positionStyles[position] || positionStyles.top}`}
                    style={{ width: 'max-content', maxWidth: '250px' }}
                >
                    <div className="bg-gray-900 text-white text-sm rounded-lg px-3 py-2 shadow-lg">
                        {tooltip}
                    </div>
                    <div className={`absolute w-0 h-0 ${arrowStyles[position] || arrowStyles.top}`} />
                </div>
            )}
        </span>
    );
};

export default TooltipIcon;