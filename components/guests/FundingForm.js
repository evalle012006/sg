// components/guests/FundingForm.js
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
    package_approved: 'iCare',
    approval_from: '',
    approval_to: '',
    nights_used: 0
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // Package options
  const packageOptions = [
    { label: 'iCare', value: 'iCare' },
    { label: 'NDIS', value: 'NDIS' },
    { label: 'Sargood Foundation', value: 'Sargood Foundation' },
    { label: 'Private', value: 'Private' },
    { label: 'Other', value: 'Other' }
  ];

  // Update state when initialData changes
  useEffect(() => {
    if (initialData) {
      setFundingData(prev => ({
        ...prev,
        approval_number: initialData.approval_number || '',
        nights_approved: initialData.nights_approved || '',
        package_approved: initialData.package_approved || 'iCare',
        approval_from: initialData.approval_from || '',
        approval_to: initialData.approval_to || '',
        nights_used: initialData.nights_used || 0
      }));
    }
  }, [initialData]);

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
          package_approved: fundingData.package_approved,
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

            {/* Package Approved */}
            <SelectComponent
              label="Package Approved"
              options={packageOptions}
              value={fundingData.package_approved}
              onChange={(selected) => setFundingData(prev => ({ ...prev, package_approved: selected.value }))}
              placeholder="Select package type"
            />

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