import React, { useState, useEffect } from 'react';
import { Info, Plus, X } from 'lucide-react';
import { getAvailableConditions } from '../../services/triggerContextRegistryClient';

/**
 * Inline Context Conditions Selector
 * 
 * Displays available conditions for a trigger event as an inline UI
 * (similar to booking status conditions), not as a modal.
 * Only shows predefined conditions - no free text input.
 */
const ContextConditionsSelector = ({ 
  triggerContext, 
  currentConditions = {}, 
  onChange,
  disabled = false
}) => {
  const [availableConditions, setAvailableConditions] = useState([]);
  const [showAddMenu, setShowAddMenu] = useState(false);

  useEffect(() => {
    if (triggerContext) {
      const available = getAvailableConditions(triggerContext);
      setAvailableConditions(available);
    } else {
      setAvailableConditions([]);
    }
  }, [triggerContext]);

  const handleAddCondition = (conditionDef) => {
    const defaultValue = getDefaultValue(conditionDef.type, conditionDef.options);
    onChange({
      ...currentConditions,
      [conditionDef.key]: defaultValue
    });
    setShowAddMenu(false);
  };

  const handleUpdateCondition = (key, value) => {
    onChange({
      ...currentConditions,
      [key]: value
    });
  };

  const handleRemoveCondition = (key) => {
    const updated = { ...currentConditions };
    delete updated[key];
    onChange(updated);
  };

  const getDefaultValue = (type, options = []) => {
    switch (type) {
      case 'boolean': return false;
      case 'number': return 0;
      case 'select': return options.length > 0 ? options[0] : '';
      case 'multi-select': return []; // ✅ NEW: Default to empty array for multi-select
      default: return '';
    }
  };

  const getConditionDef = (key) => {
    return availableConditions.find(c => c.key === key);
  };

  const getUnusedConditions = () => {
    const usedKeys = Object.keys(currentConditions);
    return availableConditions.filter(c => !usedKeys.includes(c.key));
  };

  const renderConditionInput = (key, value) => {
    const conditionDef = getConditionDef(key);
    if (!conditionDef) return null;

    switch (conditionDef.type) {
      case 'boolean':
        return (
          <select
            value={value ? 'true' : 'false'}
            onChange={(e) => handleUpdateCondition(key, e.target.value === 'true')}
            disabled={disabled}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => handleUpdateCondition(key, e.target.value)}
            disabled={disabled}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {conditionDef.options?.map(option => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        );

      case 'multi-select':
        // ✅ NEW: Multi-select with chips display
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1">
              {selectedValues.length === 0 ? (
                <span className="text-xs text-gray-400 italic">None selected (all allowed)</span>
              ) : (
                selectedValues.map(val => (
                  <span
                    key={val}
                    className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                  >
                    {val}
                    {!disabled && (
                      <button
                        type="button"
                        onClick={() => {
                          const updated = selectedValues.filter(v => v !== val);
                          handleUpdateCondition(key, updated);
                        }}
                        className="hover:text-blue-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </span>
                ))
              )}
            </div>
            {!disabled && (
              <select
                value=""
                onChange={(e) => {
                  if (e.target.value && !selectedValues.includes(e.target.value)) {
                    handleUpdateCondition(key, [...selectedValues, e.target.value]);
                  }
                }}
                className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-full"
              >
                <option value="">+ Add status...</option>
                {conditionDef.options?.map(option => (
                  <option 
                    key={option} 
                    value={option}
                    disabled={selectedValues.includes(option)}
                  >
                    {option}
                  </option>
                ))}
              </select>
            )}
            {conditionDef.description && (
              <p className="text-xs text-gray-500">{conditionDef.description}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleUpdateCondition(key, parseInt(e.target.value) || 0)}
            disabled={disabled}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 w-24"
            placeholder="Enter number"
          />
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleUpdateCondition(key, e.target.value)}
            disabled={disabled}
            className="px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Enter value"
          />
        );
    }
  };

  if (!triggerContext) {
    return (
      <div className="border rounded p-3 bg-gray-50">
        <p className="text-xs text-gray-500">
          Select a trigger event first to see available conditions
        </p>
      </div>
    );
  }

  const unusedConditions = getUnusedConditions();

  return (
    <div className="space-y-3">
      {/* Help Banner */}
      {availableConditions.length > 0 && Object.keys(currentConditions).length === 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-2 text-sm text-blue-800">
            <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Available conditions for this event:</p>
              <ul className="mt-1 space-y-1 text-xs">
                {availableConditions.slice(0, 3).map((cond, idx) => (
                  <li key={idx}>
                    • <code className="bg-blue-100 px-1 py-0.5 rounded">{cond.key}</code>: {cond.label}
                  </li>
                ))}
                {availableConditions.length > 3 && (
                  <li className="text-blue-600 font-medium">
                    + {availableConditions.length - 3} more available
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Current Conditions */}
      <div className="border rounded p-3 bg-gray-50">
        {Object.keys(currentConditions).length === 0 ? (
          <p className="text-xs text-gray-500 mb-2">
            No conditions set. Trigger will fire for all occurrences of the event.
          </p>
        ) : (
          <div className="space-y-2 mb-3">
            {Object.entries(currentConditions).map(([key, value]) => {
              const conditionDef = getConditionDef(key);
              return (
                <div key={key} className="flex items-center gap-2 p-2 bg-white border border-gray-200 rounded">
                  <div className="flex-1 flex items-center gap-2">
                    <span className="text-xs font-medium text-gray-700 min-w-[120px]">
                      {conditionDef?.label || key}:
                    </span>
                    {renderConditionInput(key, value)}
                    {conditionDef?.type && (
                      <span className="text-xs text-gray-400">({conditionDef.type})</span>
                    )}
                  </div>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => handleRemoveCondition(key)}
                      className="text-red-500 hover:text-red-700 p-1"
                      title="Remove condition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Add Condition Button */}
        {!disabled && unusedConditions.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddMenu(!showAddMenu)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 border-2 border-dashed border-gray-300 rounded hover:border-blue-400 hover:bg-blue-50 transition-colors text-xs font-medium text-gray-600 hover:text-blue-600"
            >
              <Plus className="w-4 h-4" />
              Add Condition
            </button>

            {/* Dropdown Menu */}
            {showAddMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowAddMenu(false)}
                />
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-48 overflow-y-auto">
                  {unusedConditions.map(condition => (
                    <button
                      key={condition.key}
                      type="button"
                      onClick={() => handleAddCondition(condition)}
                      className="w-full text-left px-3 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm text-gray-900">{condition.label}</span>
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                          {condition.type}
                        </span>
                      </div>
                      {condition.options && condition.options.length > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          Options: {condition.options.slice(0, 3).join(', ')}
                          {condition.options.length > 3 && `, +${condition.options.length - 3} more`}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {!disabled && unusedConditions.length === 0 && Object.keys(currentConditions).length > 0 && (
          <p className="text-xs text-gray-500 text-center">
            All available conditions have been added
          </p>
        )}
      </div>

      {/* Examples (show only when no conditions set) */}
      {availableConditions.length > 0 && Object.keys(currentConditions).length === 0 && (
        <div className="text-xs text-gray-500">
          <p className="font-medium mb-1">Example usage:</p>
          <ul className="space-y-1 ml-4">
            <li>• Add <code className="text-blue-600">status_from</code> to only fire when changing from a specific status</li>
            <li>• Add <code className="text-blue-600">cancelled_by</code> to distinguish admin vs guest cancellations</li>
            <li>• Leave empty to fire for all occurrences</li>
          </ul>
        </div>
      )}
    </div>
  );
};

export default ContextConditionsSelector;