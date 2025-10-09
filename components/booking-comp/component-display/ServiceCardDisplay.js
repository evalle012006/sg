import React from 'react';
import { CheckCircle, XCircle } from 'lucide-react';

/**
 * ServiceCardsDisplay Component
 * 
 * Displays ALL services with their Yes/No selection status and any sub-options
 * Used in both QuestionDisplay (regular view) and AmendmentDisplay (changes view)
 * 
 * @param {Object} data - Current service data (e.g., { "occupational-therapy": { selected: true, subOptions: [...] } })
 * @param {Object} oldData - Previous service data (for amendments) - optional
 * @param {Array} options - Service options from question definition with labels and sub-options
 */
const ServiceCardsDisplay = ({ data, oldData = null, options }) => {
  if (!options || options.length === 0) {
    return <span className="text-gray-500">No service options available</span>;
  }

  try {
    // Parse data if it's a string
    const serviceData = typeof data === 'string' ? JSON.parse(data) : (data || {});
    const oldServiceData = oldData ? (typeof oldData === 'string' ? JSON.parse(oldData) : oldData) : null;
    
    // Parse options to get service labels and sub-option labels
    const serviceOptions = options ? (typeof options === 'string' ? JSON.parse(options) : options) : [];
    
    // Determine if we're showing changes (amendment mode)
    const hasChanges = oldServiceData !== null;
    
    return (
      <div className="space-y-4">
        {serviceOptions.map(serviceOption => {
          const serviceKey = serviceOption.value;
          const service = serviceData[serviceKey] || { selected: false, subOptions: [] };
          const oldService = oldServiceData?.[serviceKey] || { selected: false, subOptions: [] };
          
          // Determine selection status
          const wasSelected = oldService.selected === true;
          const isSelected = service.selected === true;
          const selectionChanged = hasChanges && wasSelected !== isSelected;
          
          // Get sub-options
          const oldSubOptions = oldService.subOptions || [];
          const newSubOptions = service.subOptions || [];
          const subOptionsChanged = hasChanges && 
            JSON.stringify([...oldSubOptions].sort()) !== JSON.stringify([...newSubOptions].sort());
          
          return (
            <div key={serviceKey} className="border border-gray-200 rounded-lg p-4">
              {/* Service Header with Yes/No Status */}
              <div className="mb-3">
                {selectionChanged ? (
                  // Show both old and new when selection changed
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{serviceOption.label}</span>
                    </div>
                    <div className="flex items-center gap-4 ml-6">
                      <div className="line-through text-gray-500 text-sm">
                        Old: <span className="font-semibold">{wasSelected ? 'Yes' : 'No'}</span>
                        <span className="text-xs text-red-600 ml-2">[CHANGED]</span>
                      </div>
                      <div className="text-sm">
                        New: <span className={`font-semibold ${isSelected ? 'text-green-700' : 'text-gray-700'}`}>
                          {isSelected ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Normal display when no selection change
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{serviceOption.label}</span>
                    <span className={`text-sm font-semibold px-3 py-1 rounded ${
                      isSelected 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      {isSelected ? 'Yes' : 'No'}
                    </span>
                  </div>
                )}
              </div>
              
              {/* New Sub-Options */}
              {isSelected && newSubOptions.length > 0 && (
                <div className="ml-6 space-y-2 mt-3">
                  {newSubOptions.map(subOptValue => {
                    const subOptInfo = serviceOption.subOptions?.find(so => so.value === subOptValue) || 
                      { label: subOptValue };
                    const wasInOld = oldSubOptions.includes(subOptValue);
                    const isNew = hasChanges && !wasInOld;
                    
                    return (
                      <div key={subOptValue} className="flex items-center gap-2 text-sm">
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                          isNew ? 'bg-green-500' : 'bg-blue-500'
                        }`}></div>
                        <span className={isNew ? 'text-green-700 font-medium' : 'text-gray-700'}>
                          {subOptInfo.label}
                        </span>
                        {isNew && <span className="text-xs text-green-600 ml-auto">[NEW]</span>}
                      </div>
                    );
                  })}
                </div>
              )}
              
              {/* Removed Sub-Options (only show in amendment mode) */}
              {hasChanges && oldSubOptions.length > 0 && (
                <div className="ml-6 space-y-2 mt-2">
                  {oldSubOptions
                    .filter(subOptValue => !newSubOptions.includes(subOptValue))
                    .map(subOptValue => {
                      const subOptInfo = serviceOption.subOptions?.find(so => so.value === subOptValue) || 
                        { label: subOptValue };
                      
                      return (
                        <div key={subOptValue} className="flex items-center gap-2 text-sm line-through text-gray-500">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0"></div>
                          <span>{subOptInfo.label}</span>
                          <span className="text-xs text-red-600 ml-auto">[REMOVED]</span>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  } catch (e) {
    console.error('Error displaying service cards data:', e);
    return <span className="text-red-500">Error displaying service data</span>;
  }
};

export default ServiceCardsDisplay;