import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import moment from 'moment';
import dynamic from 'next/dynamic';

// Import existing UI components
const TextField = dynamic(() => import('../ui-v2/TextField'));
const SelectComponent = dynamic(() => import('../ui/select'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));
const Button = dynamic(() => import('../ui-v2/Button'));

const FundingForm = ({ uuid, initialData, onSave }) => {
  const [fundingData, setFundingData] = useState({
    approval_number: '',
    nights_approved: '',
    package_id: null, // New: use package_id instead of package_approved
    package_approved: '', // Keep for backward compatibility
    approval_from: '',
    approval_to: '',
    nights_used: 0
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Package options state
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Load package options from API
  const loadPackageOptions = async () => {
    setLoadingPackages(true);
    try {
      // Fetch non-NDIS packages from the API
      const response = await fetch('/api/packages/?funder=Non-NDIS&limit=100');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Transform API response to dropdown format
      const packageList = [];
      const responseData = result.packages || result;
      
      if (Array.isArray(responseData)) {
        responseData.forEach(pkg => {
          // Only include Non-NDIS packages
          if (pkg.funder === 'Non-NDIS') {
            const label = pkg.name + (pkg.package_code ? ` (${pkg.package_code})` : '');
            packageList.push({
              label: label,
              value: pkg.id, // Use package ID as value instead of label
              packageData: pkg // Store full package data for reference
            });
          }
        });
      }
      
      // Sort alphabetically by label
      packageList.sort((a, b) => a.label.localeCompare(b.label));

      setPackageOptions(packageList);

    } catch (error) {
      console.error('Error loading package options:', error);
      toast.error('Failed to load package options. Using default options.');
    } finally {
      setLoadingPackages(false);
    }
  };

  // Load package options on component mount
  useEffect(() => {
    loadPackageOptions();
  }, []);

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setFundingData(prev => ({
        ...prev,
        approval_number: initialData.approval_number || '',
        nights_approved: initialData.nights_approved || '',
        package_id: initialData.package_id || null,
        package_approved: initialData.package_approved || '', 
        approval_from: initialData.approval_from || '',
        approval_to: initialData.approval_to || '',
        nights_used: initialData.nights_used || 0
      }));
    }
  }, [initialData]);

  // Find the selected package label based on package_id
  const getSelectedPackageLabel = () => {
    if (fundingData.package_id && packageOptions.length > 0) {
      const selectedOption = packageOptions.find(option => option.value === fundingData.package_id);
      return selectedOption ? selectedOption.label : '';
    }
    return '';
  };

  // Handle package selection
  const handlePackageChange = (selected) => {
    if (selected && selected.value) {
      setFundingData(prev => ({ 
        ...prev, 
        package_id: selected.value,
        package_approved: selected.label // Update display name for compatibility
      }));
    } else {
      // Handle clearing the selection
      setFundingData(prev => ({ 
        ...prev, 
        package_id: null,
        package_approved: ''
      }));
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!uuid) {
      toast.error('Guest ID is required');
      return;
    }
    
    setIsSaving(true);
    try {
      const response = await fetch(`/api/guests/${uuid}/funding`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          approval_number: fundingData.approval_number,
          nights_approved: fundingData.nights_approved,
          package_id: fundingData.package_id, // Send package_id instead of package_approved
          approval_from: fundingData.approval_from,
          approval_to: fundingData.approval_to
        }),
      });

      if (response.ok) {
        toast.success('Funding information saved successfully!');
        if (onSave) {
          onSave();
        }
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save funding information');
      }
    } catch (error) {
      console.error('Error saving funding info:', error);
      toast.error(error.message || 'Failed to save funding information. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const nightsUsed = fundingData.nights_used || 0;
  const nightsApproved = parseInt(fundingData.nights_approved) || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Funding Information Form */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">Funding Information</h2>
          
          <div className="space-y-6">
            {/* Approval Number */}
            <TextField
              label="Approval number"
              value={fundingData.approval_number}
              onChange={(value) => setFundingData(prev => ({ ...prev, approval_number: value }))}
              placeholder="Enter approval number"
            />

            {/* Number of Nights Approved */}
            <TextField
              label="Number of nights approved"
              type="number"
              value={fundingData.nights_approved}
              onChange={(value) => setFundingData(prev => ({ ...prev, nights_approved: value }))}
              placeholder="Enter number of nights"
              min="0"
            />

            {/* Package Approved - Now uses package_id */}
            <div>
              <label className="block text-sm font-medium mb-2 text-gray-700">
                Package Approved
                {loadingPackages && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
              </label>
              <SelectComponent
                options={packageOptions}
                value={getSelectedPackageLabel()}
                onChange={handlePackageChange}
                placeholder={loadingPackages ? "Loading packages..." : "Select package type"}
                disabled={loadingPackages}
                isClearable={true}
              />
            </div>

            {/* Approval From */}
            <DateComponent
              label="Approval From"
              value={fundingData.approval_from}
              onChange={(value) => setFundingData(prev => ({ ...prev, approval_from: value }))}
            />

            {/* Approval To */}
            <DateComponent
              label="Approval To"
              value={fundingData.approval_to}
              onChange={(value) => setFundingData(prev => ({ ...prev, approval_to: value }))}
            />

            {/* Save Button */}
            <div className="pt-4">
              <Button
                onClick={handleSave}
                disabled={isSaving}
                size="medium"
                color="primary"
                label={isSaving ? 'Saving...' : 'Save Funding Information'}
                withIcon={true}
                iconName="check"
              />
            </div>
          </div>
        </div>

        {/* Right Column - Night Tracker */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-6">iCare Night Tracker</h2>
          
          <div>
            <p className="text-sm text-gray-600 mb-4">
              Number of nights used in service approval period
            </p>
            
            <div className="bg-gray-50 rounded-lg p-6 text-center">
              <div className="text-3xl font-bold text-gray-800 mb-2">
                {nightsUsed} of {nightsApproved || 0}
              </div>
              
              {nightsApproved > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                    style={{ 
                      width: `${Math.min(100, (nightsUsed / nightsApproved) * 100)}%` 
                    }}
                  />
                </div>
              )}
              
              <p className="text-sm text-gray-500">
                {nightsApproved && nightsUsed !== undefined
                  ? `${Math.max(0, nightsApproved - nightsUsed)} nights remaining`
                  : fundingData.approval_from && fundingData.approval_to
                    ? 'Calculating usage...'
                    : 'Set approval period and nights to track usage'
                }
              </p>
            </div>
            
            {fundingData.approval_from && fundingData.approval_to && (
              <div className="mt-4 text-sm text-gray-600">
                <p><strong>Approval Period:</strong></p>
                <p>
                  {moment(fundingData.approval_from).format('DD MMM, YYYY')} - {moment(fundingData.approval_to).format('DD MMM, YYYY')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundingForm;