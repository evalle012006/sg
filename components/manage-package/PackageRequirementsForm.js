import React, { useState, useEffect } from 'react';
import { Settings, Save, X, AlertTriangle, CheckCircle, Info } from 'lucide-react';

const PackageRequirementsForm = ({ 
  packageData, 
  onSave, 
  onCancel, 
  isOpen = false 
}) => {
  const [requirements, setRequirements] = useState({
    care_hours_min: '',
    care_hours_max: '',
    requires_no_care: false,
    requires_course: null, // null = optional, true = required, false = not allowed
    compatible_with_course: true,
    living_situation: [],
    sta_requirements: {},
    display_priority: 0,
    notes: ''
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Load existing requirements when component opens
  useEffect(() => {
    if (isOpen && packageData?.id) {
      loadExistingRequirements();
    }
  }, [isOpen, packageData?.id]);

  const loadExistingRequirements = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/packages/${packageData.id}/requirements`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.requirement) {
          setRequirements({
            care_hours_min: data.requirement.care_hours_min || '',
            care_hours_max: data.requirement.care_hours_max || '',
            requires_no_care: data.requirement.requires_no_care || false,
            requires_course: data.requirement.requires_course,
            compatible_with_course: data.requirement.compatible_with_course !== false,
            living_situation: data.requirement.living_situation || [],
            sta_requirements: data.requirement.sta_requirements || {},
            display_priority: data.requirement.display_priority || 0,
            notes: data.requirement.notes || ''
          });
        }
      }
    } catch (error) {
      console.error('Error loading requirements:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setRequirements(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCareHoursChange = (field, value) => {
    const numValue = value === '' ? null : parseInt(value);
    setRequirements(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleLivingSituationChange = (situation, checked) => {
    setRequirements(prev => ({
      ...prev,
      living_situation: checked 
        ? [...prev.living_situation, situation]
        : prev.living_situation.filter(s => s !== situation)
    }));
  };

  const handleSTARequirementChange = (key, value) => {
    setRequirements(prev => ({
      ...prev,
      sta_requirements: {
        ...prev.sta_requirements,
        [key]: value
      }
    }));
  };

  const validateRequirements = () => {
    const errors = [];

    // Validate care hours logic
    if (!requirements.requires_no_care) {
      if (requirements.care_hours_min !== null && requirements.care_hours_max !== null) {
        if (requirements.care_hours_min > requirements.care_hours_max) {
          errors.push('Minimum care hours cannot be greater than maximum care hours');
        }
      }
    }

    // Validate display priority
    if (requirements.display_priority < 0) {
      errors.push('Display priority cannot be negative');
    }

    return errors;
  };

  const handleSave = async () => {
    setError(null);
    
    // Validate
    const validationErrors = validateRequirements();
    if (validationErrors.length > 0) {
      setError(validationErrors.join(', '));
      return;
    }

    setLoading(true);
    
    try {
      const response = await fetch(`/api/packages/${packageData.id}/requirements`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...requirements,
          package_id: packageData.id
        })
      });

      const data = await response.json();
      
      if (data.success) {
        onSave?.(data.requirement);
      } else {
        throw new Error(data.message || 'Failed to save requirements');
      }
    } catch (error) {
      console.error('Error saving requirements:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-4 mx-auto p-5 border w-full max-w-4xl shadow-lg rounded-md bg-white">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Package Requirements</h3>
              <p className="text-sm text-gray-600">
                Configure filtering rules for: <strong>{packageData?.name}</strong>
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {loading && (
          <div className="mb-4 flex items-center gap-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading requirements...</span>
          </div>
        )}

        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-red-800 text-sm">{error}</span>
            </div>
          </div>
        )}

        <div className="space-y-6">
          {/* Care Requirements Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Care Requirements
            </h4>
            
            <div className="space-y-4">
              {/* No Care Required */}
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="requires_no_care"
                  checked={requirements.requires_no_care}
                  onChange={(e) => handleInputChange('requires_no_care', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="requires_no_care" className="ml-2 text-sm text-gray-700">
                  This package requires <strong>no care</strong>
                </label>
              </div>

              {/* Care Hours Range */}
              {!requirements.requires_no_care && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Minimum Care Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={requirements.care_hours_min || ''}
                      onChange={(e) => handleCareHoursChange('care_hours_min', e.target.value)}
                      placeholder="0"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no minimum</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Maximum Care Hours
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="24"
                      value={requirements.care_hours_max || ''}
                      onChange={(e) => handleCareHoursChange('care_hours_max', e.target.value)}
                      placeholder="24"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Leave empty for no maximum</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Course Requirements Section */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-gray-900 mb-3 flex items-center gap-2">
              <Info className="w-4 h-4 text-blue-600" />
              Course Requirements
            </h4>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Course Participation
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="requires_course"
                      checked={requirements.requires_course === null}
                      onChange={() => handleInputChange('requires_course', null)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Course is optional</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="requires_course"
                      checked={requirements.requires_course === true}
                      onChange={() => handleInputChange('requires_course', true)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">Course is required</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="requires_course"
                      checked={requirements.requires_course === false}
                      onChange={() => handleInputChange('requires_course', false)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="ml-2 text-sm text-gray-700">No course allowed</span>
                  </label>
                </div>
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="compatible_with_course"
                  checked={requirements.compatible_with_course}
                  onChange={(e) => handleInputChange('compatible_with_course', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label htmlFor="compatible_with_course" className="ml-2 text-sm text-gray-700">
                  Package can be combined with courses
                </label>
              </div>
            </div>
          </div>

          {/* NDIS Specific Requirements */}
          {packageData?.funder === 'NDIS' && (
            <div className="bg-blue-50 rounded-lg p-4">
              <h4 className="text-md font-medium text-gray-900 mb-3">NDIS Specific Requirements</h4>
              
              <div className="space-y-3">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="requires_sta_in_plan"
                    checked={requirements.sta_requirements.requires_sta_in_plan || false}
                    onChange={(e) => handleSTARequirementChange('requires_sta_in_plan', e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="requires_sta_in_plan" className="ml-2 text-sm text-gray-700">
                    Requires STA (Short Term Accommodation) in NDIS plan
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* Living Situation Requirements */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-md font-medium text-gray-900 mb-3">Living Situation Compatibility</h4>
            <p className="text-sm text-gray-600 mb-3">Select which living situations this package supports (leave empty for all):</p>
            
            <div className="space-y-2">
              {[
                { value: 'alone', label: 'Lives alone' },
                { value: 'with_supports', label: 'Lives with informal supports' },
                { value: 'sil', label: 'Supported Independent Living (SIL)' }
              ].map(situation => (
                <label key={situation.value} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={requirements.living_situation.includes(situation.value)}
                    onChange={(e) => handleLivingSituationChange(situation.value, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="ml-2 text-sm text-gray-700">{situation.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Display Priority and Notes */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Display Priority
              </label>
              <input
                type="number"
                min="0"
                value={requirements.display_priority}
                onChange={(e) => handleInputChange('display_priority', parseInt(e.target.value) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">Higher numbers appear first in filtered results</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Admin Notes
              </label>
              <textarea
                value={requirements.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                rows={3}
                placeholder="Internal notes about this package's requirements..."
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <Save className="w-4 h-4" />
            )}
            Save Requirements
          </button>
        </div>
      </div>
    </div>
  );
};

export default PackageRequirementsForm;