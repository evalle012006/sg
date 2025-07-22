import React, { useState, useEffect } from 'react';

const TabButton = ({ 
  tabs = [], 
  activeTab = 0, 
  onChange = () => {},
  type = 'filled', // 'filled' or 'outline'
  borderRadius = '12px' // customizable border radius
}) => {
  const [active, setActive] = useState(activeTab);

  // Update internal state when activeTab prop changes
  useEffect(() => {
    setActive(activeTab);
  }, [activeTab]);

  const handleClick = (index, onClick) => {
    setActive(index);
    onChange(index);
    if (onClick) onClick();
  };

  // Add CSS for hiding scrollbars
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .tab-scroll-container::-webkit-scrollbar {
        display: none;
      }
      .tab-scroll-container {
        -ms-overflow-style: none;
        scrollbar-width: none;
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  // Size classes mapping based on provided specs - now responsive
  const sizeClasses = {
    small: {
      container: "h-10",
      padding: "px-3 py-2 sm:px-4 sm:py-2",
      icon: "w-4 h-4 mr-1.5 sm:mr-2",
      gap: "gap-1.5 sm:gap-2"
    },
    medium: {
      container: "h-12",
      padding: "px-3 py-2.5 sm:px-5 sm:py-2.5",
      icon: "w-4 h-4 mr-2 sm:w-5 sm:h-5 sm:mr-2.5",
      gap: "gap-2 sm:gap-2.5"
    },
    large: {
      container: "h-14", 
      padding: "px-4 py-3 sm:px-6 sm:py-3",
      icon: "w-5 h-5 mr-2 sm:w-6 sm:h-6 sm:mr-3",
      gap: "gap-2 sm:gap-3"
    }
  };

  if (type === 'outline') {
    // Outline tabs with underline style - NOW WITH HORIZONTAL SCROLL
    return (
      <div className="w-full">
        <div className="tab-scroll-container flex flex-nowrap w-full overflow-x-auto">
          <div className="flex flex-nowrap min-w-max">
            {tabs.map((tab, index) => {
              const isActive = active === index;
              
              return (
                <button
                  key={index}
                  onClick={() => handleClick(index, tab.onClick)}
                  className={`
                    flex items-center justify-center
                    transition-colors duration-200
                    px-3 py-2.5 sm:px-5 sm:py-2.5
                    whitespace-nowrap
                    flex-shrink-0
                    ${isActive ? 'font-bold' : 'text-gray-600'}
                    relative
                    text-sm sm:text-base
                  `}
                  style={{
                    borderBottom: isActive ? '4px solid #FFCE00' : 'none',
                    marginBottom: '-1px'
                  }}
                >
                  {tab.withIcon && tab.icon && (
                    <span className="flex-shrink-0 mr-1.5 sm:mr-2.5">{tab.icon}</span>
                  )}
                  <span className="min-w-0">
                    {/* RESPONSIVE LABELS: Show shortened label on mobile, full label on larger screens */}
                    <span className="block sm:hidden">{tab.label}</span>
                    <span className="hidden sm:block">{tab.fullLabel || tab.label}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // Default filled style with borders - NOW WITH HORIZONTAL SCROLL
  return (
    <div className="w-full">
      <div className="tab-scroll-container flex flex-nowrap w-full overflow-x-auto">
        <div className="flex flex-nowrap min-w-max">
          {tabs.map((tab, index) => {
            const size = tab.size || 'medium';
            const sizeClass = sizeClasses[size] || sizeClasses.medium;
            
            // Determine if it's first or last tab
            const isFirst = index === 0;
            const isLast = index === tabs.length - 1;
            const isActive = active === index;
            
            // Apply specific styling based on position
            let tabStyle = {};
            let specificClasses = '';
            
            // MOBILE-FIRST RESPONSIVE CLASSES
            const baseClasses = "text-xs sm:text-sm whitespace-nowrap flex-shrink-0";
            
            if (isFirst) {
              tabStyle = {
                height: '48px',
                borderTopLeftRadius: borderRadius,
                borderBottomLeftRadius: borderRadius,
                background: isActive ? '#1B457B' : '#FFFFFF',
                border: '1px solid #EBECF0',
              };
              // RESPONSIVE PADDING: smaller on mobile, larger on desktop
              specificClasses = `py-2.5 px-3 sm:px-5 gap-2 sm:gap-2.5 ${isActive ? 'text-white' : 'text-gray-800'} ${baseClasses}`;
            } else if (isLast) {
              tabStyle = {
                height: '48px',
                borderTopRightRadius: borderRadius,
                borderBottomRightRadius: borderRadius,
                background: isActive ? '#1B457B' : '#FFFFFF',
                border: '1px solid #EBECF0',
              };
              specificClasses = `py-2.5 px-3 sm:px-5 gap-2 sm:gap-2.5 ${isActive ? 'text-white' : 'text-gray-800'} ${baseClasses}`;
            } else {
              tabStyle = {
                height: '48px',
                background: isActive ? '#1B457B' : '#FFFFFF',
                borderTop: '1px solid #EBECF0',
                borderBottom: '1px solid #EBECF0',
                borderRight: '1px solid #EBECF0',
              };
              specificClasses = `py-2.5 px-3 sm:px-5 gap-2 sm:gap-2.5 ${isActive ? 'text-white' : 'text-gray-800'} ${baseClasses}`;
            }
            
            if (isFirst) {
              tabStyle.borderLeft = '1px solid #EBECF0';
            }
            
            return (
              <button
                key={index}
                onClick={() => handleClick(index, tab.onClick)}
                className={`
                  flex items-center justify-center
                  transition-colors duration-200
                  ${specificClasses}
                `}
                style={tabStyle}
              >
                {tab.withIcon && tab.icon && (
                  <span className="flex-shrink-0 mr-1.5 sm:mr-2.5">
                    {tab.icon}
                  </span>
                )}
                <span className="min-w-0">
                  {/* RESPONSIVE LABELS: Show shortened label on mobile, full label on larger screens */}
                  <span className="block sm:hidden">{tab.label}</span>
                  <span className="hidden sm:block">{tab.fullLabel || tab.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default TabButton;