import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check, AlertCircle, Loader2 } from 'lucide-react';
import { Element } from 'react-scroll';
import StatusBadge from './StatusBadge';
import Button from './Button';

const AccordionItem = ({
  title,
  description,
  status,
  isOpen,
  customContent,
  index,
  totalItems,
  onNext,
  onBack,
  onHeaderClick,
  canGoNext,
  canGoBack,
  isLastItem,
  origin,
  isNavigating,
  activeButton // 'next', 'back', 'submit', or null
}) => {

  const getStatusBadgeType = () => {
    switch (status) {
      case 'complete':
        return 'success';
      case 'error':
        return 'error';
      case 'pending':
        return 'pending';
      default:
        return 'pending';
    }
  };

  const getStatusBadgeLabel = () => {
    switch (status) {
      case 'complete':
        return 'Complete';
      case 'error':
        return 'Error';
      case 'pending':
        return 'Pending';
      default:
        return 'Pending';
    }
  };

  // Handle header click
  const handleHeaderClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Prevent clicking during navigation
    if (isNavigating) {
      return;
    }
    
    if (onHeaderClick) {
      onHeaderClick(index);
    }
  };

  return (
    <Element 
      name={`accordion-item-${index}`}
      className="accordion-item-wrapper"
    >
      <div
        id={`accordion-item-${index}`}
        className="border-b border-gray-200 last:border-b-0 accordion-item"
        style={{ 
          opacity: 1,
          transition: 'opacity 0.15s ease-in-out',
        }}
      >
        {/* Header - Now clickable */}
        <div 
          className={`flex items-center justify-between py-4 px-8 ${isOpen ? 'bg-gray-50' : 'bg-white'} transition-colors ${isNavigating ? 'cursor-not-allowed opacity-75' : 'cursor-pointer hover:bg-gray-50'}`}
          onClick={handleHeaderClick}
        >
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex-1">
              <div className="flex items-center space-x-3 mb-1">
                <h3 className="font-semibold text-gray-800 text-lg">{title}</h3>
                <StatusBadge
                  type={getStatusBadgeType()}
                  label={getStatusBadgeLabel()}
                  size="small"
                  showIcon={true}
                />
              </div>
              <p className="text-sm text-gray-600">{description}</p>
            </div>
          </div>
          {/* Visual indicator that shows if section is open */}
          <div className="text-gray-400">
            {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
          </div>
        </div>

        {/* Content Area - Only shown when open */}
        {isOpen && (
          <div className="bg-white" data-accordion-content>
            {/* Content Area - Full width with no horizontal padding */}
            <div className="py-2">
              {customContent ? (
                customContent
              ) : (
                <div className="px-8">
                  <p className="text-gray-600">{description}</p>
                </div>
              )}
            </div>

            {/* Navigation Footer - Right aligned buttons only */}
            <div className="px-8 py-4 bg-white border-t border-gray-200 flex items-center justify-end">
              <div className="flex items-center space-x-3">
                {/* Back Button */}
                {canGoBack && (
                  <Button
                    color="outline"
                    size="medium"
                    label={
                      <span className="flex items-center gap-2">
                        {isNavigating && activeButton === 'back' && (
                          <Loader2 className="animate-spin" size={16} />
                        )}
                        PREVIOUS
                      </span>
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isNavigating) {
                        onBack && onBack(index);
                      }
                    }}
                    outlineBorderColor="#10b981"
                    disabled={isNavigating}
                  />
                )}

                {/* Next/Submit Button */}
                {canGoNext ? (
                  <Button
                    color="secondary"
                    size="medium"
                    label={
                      <span className="flex items-center gap-2">
                        {isNavigating && activeButton === 'next' && (
                          <Loader2 className="animate-spin" size={16} />
                        )}
                        NEXT
                      </span>
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isNavigating) {
                        onNext && onNext(index);
                      }
                    }}
                    disabled={isNavigating}
                  />
                ) : isLastItem ? (
                  <Button
                    color="secondary"
                    size="medium"
                    label={
                      <span className="flex items-center gap-2">
                        {isNavigating && activeButton === 'submit' && (
                          <Loader2 className="animate-spin" size={16} />
                        )}
                        SUBMIT
                      </span>
                    }
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!isNavigating) {
                        onNext && onNext(index, true);
                      }
                    }}
                    disabled={isNavigating}
                  />
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
    </Element>
  );
};

const Accordion = ({
  items = [],
  defaultOpenIndex = null,
  className = "",
  allowMultiple = false,
  onNavigate,
  onHeaderClick,
  origin
}) => {
  const [openItems, setOpenItems] = useState(
    defaultOpenIndex !== null ? [defaultOpenIndex] : []
  );
  const [isNavigating, setIsNavigating] = useState(false);
  const [activeButton, setActiveButton] = useState(null); // 'next', 'back', 'submit', or null

  // Update open items when defaultOpenIndex changes (controlled from parent)
  useEffect(() => {
    if (defaultOpenIndex !== null) {
      // Add a small delay to coordinate with scroll
      setIsNavigating(true);
      setOpenItems([defaultOpenIndex]);
      
      // Reset navigating state after transition
      const timer = setTimeout(() => {
        setIsNavigating(false);
        setActiveButton(null);
      }, 800); // Slightly longer to ensure all async operations complete
      
      return () => clearTimeout(timer);
    }
  }, [defaultOpenIndex]);

  const isItemOpen = (index) => {
    return openItems.includes(index);
  };

  const handleNext = async (currentIndex, isSubmit = false) => {
    // Prevent double-click
    if (isNavigating) {
      console.log('⏸️ Navigation already in progress, ignoring click');
      return;
    }

    // Set loading state
    setIsNavigating(true);
    setActiveButton(isSubmit ? 'submit' : 'next');
    
    try {
      if (isSubmit) {
        await onNavigate?.(currentIndex, 'submit');
      } else if (currentIndex < items.length - 1) {
        const nextIndex = currentIndex + 1;
        await onNavigate?.(nextIndex, 'next');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Reset state even if navigation fails
      setIsNavigating(false);
      setActiveButton(null);
    }
  };

  const handleBack = async (currentIndex) => {
    // Prevent double-click
    if (isNavigating) {
      console.log('⏸️ Navigation already in progress, ignoring click');
      return;
    }

    // Set loading state
    setIsNavigating(true);
    setActiveButton('back');
    
    try {
      if (currentIndex > 0) {
        const prevIndex = currentIndex - 1;
        await onNavigate?.(prevIndex, 'back');
      }
    } catch (error) {
      console.error('Navigation error:', error);
      // Reset state even if navigation fails
      setIsNavigating(false);
      setActiveButton(null);
    }
  };

  const handleItemHeaderClick = async (clickedIndex) => {
    // Prevent double-click
    if (isNavigating) {
      console.log('⏸️ Navigation already in progress, ignoring header click');
      return;
    }

    // If clicking on the already open item, do nothing (no need to navigate)
    if (openItems.includes(clickedIndex)) {
      console.log('ℹ️ Clicked on already open accordion item, ignoring');
      return;
    }

    setIsNavigating(true);
    setActiveButton(null); // No specific button for header clicks
    
    try {
      if (onHeaderClick) {
        await onHeaderClick(clickedIndex);
      } else if (onNavigate) {
        await onNavigate(clickedIndex, 'header-click');
      }
    } catch (error) {
      console.error('Header click navigation error:', error);
    } finally {
      // Reset navigating state after a short delay to allow for state updates
      // This handles cases where the parent doesn't change the index (e.g., validation failure)
      setTimeout(() => {
        setIsNavigating(false);
        setActiveButton(null);
      }, 100);
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <div 
        className="bg-white h-full"
        style={{
          opacity: isNavigating ? 0.98 : 1,
          transition: 'opacity 0.15s ease-in-out'
        }}
      >
        {items.map((item, index) => (
          <AccordionItem
            key={`accordion-${index}-${item.title}`}
            title={item.title}
            description={item.description}
            status={item.status}
            isOpen={isItemOpen(index)}
            customContent={item.customContent}
            index={index}
            totalItems={items.length}
            onNext={handleNext}
            onBack={handleBack}
            onHeaderClick={handleItemHeaderClick}
            canGoNext={index < items.length - 1}
            canGoBack={index > 0}
            isLastItem={index === items.length - 1}
            origin={origin}
            isNavigating={isNavigating}
            activeButton={activeButton}
          />
        ))}
      </div>
    </div>
  );
};

export default Accordion;