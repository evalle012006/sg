import React, { useState, useEffect, useMemo } from 'react';
import { Check } from 'lucide-react';
import StatusBadge from './StatusBadge';

// Define the possible states for a step
export const StepState = {
  NOT_SELECTED: 'not_selected',
  SELECTED: 'selected',
  COMPLETED: 'completed'
};

// Main component for a single step
const Step = ({ 
  number, 
  label, 
  state, 
  status, 
  statusType, 
  onClick, 
  isLast, 
  isClickable = true,
  allowClickOnlyCompleted = false 
}) => {
  const getNumberStyle = () => {
    switch (state) {
      case StepState.SELECTED:
        return 'border-2 border-[#00467F] text-[#00467F]'; // Blue background with number
      case StepState.COMPLETED:
        return 'bg-[#00467F] border-2 border-[#00467F] text-white'; // Blue background with checkmark
      default:
        return 'bg-gray-200 border-2 border-gray-200 text-gray-600'; // Gray background
    }
  };

  const getContainerStyle = () => {
    if (allowClickOnlyCompleted) {
      // Only completed steps or currently selected steps are clickable
      const clickable = state === StepState.COMPLETED || state === StepState.SELECTED;
      return clickable ? 'cursor-pointer' : 'cursor-default';
    }
    return isClickable ? 'cursor-pointer' : 'cursor-default';
  };

  const handleClick = () => {
    if (allowClickOnlyCompleted) {
      // Only allow clicks on completed or currently selected steps
      if (state === StepState.COMPLETED || state === StepState.SELECTED) {
        onClick?.();
      }
    } else if (isClickable) {
      onClick?.();
    }
  };

  const displayCheckOrNumber = () => {
    if (state === StepState.SELECTED) {
      return number;
    } else if (state === StepState.COMPLETED) {
      return <Check className="w-4 h-4" strokeWidth={3} />;
    }
    return number;
  };

  return (
    <div className="relative">
      {/* Connecting line - properly centered on the circle */}
      {!isLast && (
        <div className="absolute left-4 top-12 w-0.5 h-8 bg-gray-300 z-0" />
      )}
      
      {/* Step content */}
      <div className={`flex items-start mb-12 ${getContainerStyle()}`} onClick={handleClick}>
        {/* Number or checkmark circle */}
        <div 
          className={`relative w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold z-10 flex-shrink-0 ${getNumberStyle()}`}
        >
          {displayCheckOrNumber()}
        </div>
        
        {/* Label and status - always same height */}
        <div className={`ml-3 flex flex-col min-h-[2.5rem] ${!status ? 'justify-center' : ''}`}>
          <div className="text-xs font-bold text-gray-800 leading-tight uppercase tracking-wide">
            {label}
          </div>
          {status && (
            <div className="mt-1" style={{ width: 'fit-content' }}>
              <StatusBadge 
                type={statusType}
                label={status}
                size="small"
                className="inline-flex"
                style={{ width: 'fit-content' }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Main component for the full list
const NumberedListComponent = ({ 
  steps = [], 
  onStepClick = null,
  allowClickOnlyCompleted = false,
  showForms = false // New prop to control form display
}) => {
  const [activeStep, setActiveStep] = useState(null);
  
  // OPTIMIZED: Use useMemo to compute step states and only recalculate when steps content actually changes
  const stepStates = useMemo(() => {
    const states = {};
    steps.forEach(step => {
      states[step.id] = step.initialState || StepState.NOT_SELECTED;
    });
    return states;
  }, [steps]);

  const handleStepClick = (stepId) => {
    if (onStepClick) {
      // Use external click handler (for navigation)
      onStepClick(stepId);
    } else if (showForms) {
      // Toggle active step for showing/hiding forms (original behavior)
      setActiveStep(activeStep === stepId ? null : stepId);
    }
  };

  return (
    <div className="w-full px-8 py-4">
      {steps.map((step, index) => (
        <div key={step.id}>
          <Step
            number={index + 1}
            label={step.label}
            state={stepStates[step.id]}
            status={step.status}
            statusType={step.statusType}
            onClick={() => handleStepClick(step.id)}
            isLast={index === steps.length - 1}
            allowClickOnlyCompleted={allowClickOnlyCompleted}
          />
          
          {/* Form container - shows when step is active and showForms is true */}
          {showForms && activeStep === step.id && (
            <div className="ml-16 mb-8 p-4 border border-gray-300 rounded-md bg-gray-50">
              {step.formContent || <p>Form content for {step.label}</p>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default NumberedListComponent;