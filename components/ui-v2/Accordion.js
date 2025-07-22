import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check, AlertCircle } from 'lucide-react';
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
  canGoNext,
  canGoBack,
  isLastItem,
  origin
}) => {
  const getStatusIcon = () => {
    if (status === 'complete') {
      return <div className="flex items-center justify-center w-6 h-6 rounded-full bg-green-500"><Check size={16} color="white" /></div>;
    } else if (status === 'error') {
      return <div className="flex items-center justify-center w-6 h-6 rounded-full bg-red-500"><AlertCircle size={16} color="white" /></div>;
    }
    return <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gray-300 text-white text-xs font-medium">{index + 1}</div>;
  };

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

  return (
    <div className="border-b border-gray-200 last:border-b-0">
      {/* Header - No longer clickable */}
      <div className={`flex items-center justify-between py-6 px-8 ${isOpen ? 'bg-gray-50' : 'bg-white'} transition-colors`}>
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
        <div className="bg-white">
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
                  label="PREVIOUS"
                  onClick={(e) => {
                    e.stopPropagation();
                    onBack && onBack(index);
                  }}
                  outlineBorderColor="#10b981"
                />
              )}

              {/* Next/Submit Button */}
              {canGoNext ? (
                <Button
                  color="secondary"
                  size="medium"
                  label="NEXT"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext && onNext(index);
                  }}
                />
              ) : isLastItem ? (
                <Button
                  color="secondary"
                  size="medium"
                  label="SUBMIT"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNext && onNext(index, true);
                  }}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Accordion = ({ 
  items = [], 
  defaultOpenIndex = null,
  className = "",
  allowMultiple = false,
  onNavigate,
  origin
}) => {
  const [openItems, setOpenItems] = useState(
    defaultOpenIndex !== null ? [defaultOpenIndex] : []
  );

  // Update open items when defaultOpenIndex changes (controlled from parent)
  useEffect(() => {
    if (defaultOpenIndex !== null) {
      setOpenItems([defaultOpenIndex]);
    }
  }, [defaultOpenIndex]);

  const isItemOpen = (index) => {
    return openItems.includes(index);
  };

  const handleNext = (currentIndex, isSubmit = false) => {
    if (isSubmit) {
      // This is the last item being completed - don't change accordion state
      onNavigate && onNavigate(currentIndex, 'submit');
    } else if (currentIndex < items.length - 1) {
      // Let parent handle navigation - don't change accordion state here
      // The parent will update defaultOpenIndex if navigation is successful
      const nextIndex = currentIndex + 1;
      onNavigate && onNavigate(nextIndex, 'next');
    }
  };

  const handleBack = (currentIndex) => {
    if (currentIndex > 0) {
      // Let parent handle navigation - don't change accordion state here
      // The parent will update defaultOpenIndex if navigation is successful
      const prevIndex = currentIndex - 1;
      onNavigate && onNavigate(prevIndex, 'back');
    }
  };

  return (
    <div className={`w-full h-full ${className}`}>
      <div className="bg-white h-full">
        {items.map((item, index) => (
          <AccordionItem 
            key={index}
            title={item.title}
            description={item.description}
            status={item.status}
            isOpen={isItemOpen(index)}
            customContent={item.customContent}
            index={index}
            totalItems={items.length}
            onNext={handleNext}
            onBack={handleBack}
            canGoNext={index < items.length - 1}
            canGoBack={index > 0}
            isLastItem={index === items.length - 1}
            origin={origin}
          />
        ))}
      </div>
    </div>
  );
};

export default Accordion;