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
    package_id: null,
    package_approved: '',
    approval_from: '',
    approval_to: '',
    nights_used: 0,
    // New additional room fields
    additional_room_approved: null,
    additional_room_nights_approved: '',
    additional_room_nights_used: 0
  });
  
  const [isSaving, setIsSaving] = useState(false);
  
  // Package options state
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);

  // Room types options state
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);

  // Load package options from API
  const loadPackageOptions = async () => {
    setLoadingPackages(true);
    try {
      const response = await fetch('/api/packages/?funder=Non-NDIS&limit=100');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      const packageList = [];
      const responseData = result.packages || result;
      
      if (Array.isArray(responseData)) {
        responseData.forEach(pkg => {
          if (pkg.funder === 'Non-NDIS') {
            const label = pkg.name + (pkg.package_code ? ` (${pkg.package_code})` : '');
            packageList.push({
              label: label,
              value: pkg.id,
              packageData: pkg
            });
          }
        });
      }
      
      packageList.sort((a, b) => a.label.localeCompare(b.label));
      setPackageOptions(packageList);

    } catch (error) {
      console.error('Error loading package options:', error);
      toast.error('Failed to load package options. Using default options.');
    } finally {
      setLoadingPackages(false);
    }
  };

  // Load room types from API with optional filtering
  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    try {
      // Use manage-room API with simple=true for faster response
      // Optional: filter by specific room types (e.g., only ocean_view and deluxe)
      // const filterTypes = ['ocean_view', 'deluxe']; // Uncomment and customize as needed
      
      let apiUrl = '/api/manage-room?simple=true';
      
      // Uncomment the following lines to enable filtering by room types
      // if (filterTypes && filterTypes.length > 0) {
      //   apiUrl += `&types=${filterTypes.join(',')}`;
      // }
      
      const response = await fetch(apiUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      const roomTypeList = [
        // Add "No" as the first option
        {
          label: 'No',
          value: null,
          roomTypeData: null
        }
      ];
      
      if (Array.isArray(result)) {
        result.forEach(roomType => {
          roomTypeList.push({
            label: roomType.name,
            value: roomType.id,
            roomTypeData: roomType
          });
        });
      }
      
      // Sort all options except the first "No" option
      const noOption = roomTypeList.shift();
      roomTypeList.sort((a, b) => a.label.localeCompare(b.label));
      roomTypeList.unshift(noOption);
      
      setRoomTypeOptions(roomTypeList);

    } catch (error) {
      console.error('Error loading room types:', error);
      toast.error('Failed to load room types.');
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  // Load options on component mount
  useEffect(() => {
    loadPackageOptions();
    loadRoomTypes();
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
        nights_used: initialData.nights_used || 0,
        // New additional room fields
        additional_room_approved: initialData.additional_room_approved || null,
        additional_room_nights_approved: initialData.additional_room_nights_approved || '',
        additional_room_nights_used: initialData.additional_room_nights_used || 0
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

  // Find the selected room type label based on additional_room_approved
  const getSelectedRoomTypeLabel = () => {
    if (fundingData.additional_room_approved === null || fundingData.additional_room_approved === undefined) {
      return 'No';
    }
    if (fundingData.additional_room_approved && roomTypeOptions.length > 0) {
      const selectedOption = roomTypeOptions.find(option => option.value === fundingData.additional_room_approved);
      return selectedOption ? selectedOption.label : 'No';
    }
    return 'No';
  };

  // Handle package selection
  const handlePackageChange = (selected) => {
    if (selected && selected.value) {
      setFundingData(prev => ({ 
        ...prev, 
        package_id: selected.value,
        package_approved: selected.label
      }));
    } else {
      setFundingData(prev => ({ 
        ...prev, 
        package_id: null,
        package_approved: ''
      }));
    }
  };

  // Handle room type selection
  const handleRoomTypeChange = (selected) => {
    if (selected) {
      // If "No" is selected or value is null
      if (selected.value === null) {
        setFundingData(prev => ({ 
          ...prev, 
          additional_room_approved: null,
          additional_room_nights_approved: '',
          additional_room_nights_used: 0
        }));
      } else {
        // A room type is selected
        setFundingData(prev => ({ 
          ...prev, 
          additional_room_approved: selected.value
        }));
      }
    } else {
      // Cleared selection
      setFundingData(prev => ({ 
        ...prev, 
        additional_room_approved: null,
        additional_room_nights_approved: '',
        additional_room_nights_used: 0
      }));
    }
  };

  // Handle save
  const handleSave = async () => {
    if (!uuid) {
      toast.error('Guest ID is required');
      return;
    }
    
    // Validation: nights_used cannot exceed nights_approved
    const nightsUsed = parseInt(fundingData.nights_used) || 0;
    const nightsApproved = parseInt(fundingData.nights_approved) || 0;
    
    if (nightsApproved > 0 && nightsUsed > nightsApproved) {
      toast.error('Nights used cannot exceed nights approved');
      return;
    }

    // Validation: additional_room_nights_used cannot exceed additional_room_nights_approved
    // Only validate if an additional room is actually selected
    if (fundingData.additional_room_approved) {
      const additionalNightsUsed = parseInt(fundingData.additional_room_nights_used) || 0;
      const additionalNightsApproved = parseInt(fundingData.additional_room_nights_approved) || 0;
      
      if (additionalNightsApproved > 0 && additionalNightsUsed > additionalNightsApproved) {
        toast.error('Additional room nights used cannot exceed nights approved');
        return;
      }
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
          package_id: fundingData.package_id,
          approval_from: fundingData.approval_from,
          approval_to: fundingData.approval_to,
          nights_used: nightsUsed,
          // New additional room fields
          additional_room_approved: fundingData.additional_room_approved,
          additional_room_nights_approved: fundingData.additional_room_nights_approved,
          additional_room_nights_used: fundingData.additional_room_approved ? 
            (parseInt(fundingData.additional_room_nights_used) || 0) : 0
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

  const nightsUsed = parseInt(fundingData.nights_used) || 0;
  const nightsApproved = parseInt(fundingData.nights_approved) || 0;
  const additionalNightsUsed = parseInt(fundingData.additional_room_nights_used) || 0;
  const additionalNightsApproved = parseInt(fundingData.additional_room_nights_approved) || 0;

  return (
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Funding Information Form */}
        <div className="space-y-8">
          {/* iCare Package Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-6">iCare Package Funding</h2>
            
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

              {/* Number of Nights Used */}
              <TextField
                label="Number of nights used"
                type="number"
                value={fundingData.nights_used}
                onChange={(value) => setFundingData(prev => ({ ...prev, nights_used: value }))}
                placeholder="Enter number of nights used"
                min="0"
                max={fundingData.nights_approved || undefined}
              />

              {/* Package Approved */}
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
            </div>
          </div>

          {/* Additional Room Section */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Additional Room Funding</h2>
            <p className="text-sm text-gray-500 mb-6">Separate funding allocation for additional rooms</p>
            
            <div className="space-y-6">
              {/* Additional Room Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Additional Room Type Approved
                  {loadingRoomTypes && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                </label>
                <SelectComponent
                  options={roomTypeOptions}
                  value={getSelectedRoomTypeLabel()}
                  onChange={handleRoomTypeChange}
                  placeholder={loadingRoomTypes ? "Loading room types..." : "Select room type"}
                  disabled={loadingRoomTypes}
                  isClearable={false}
                />
              </div>

              {/* Additional Room Nights Approved */}
              <TextField
                label="Additional room nights approved"
                type="number"
                value={fundingData.additional_room_nights_approved}
                onChange={(value) => setFundingData(prev => ({ ...prev, additional_room_nights_approved: value }))}
                placeholder="Enter number of nights"
                min="0"
                disabled={!fundingData.additional_room_approved}
              />

              {/* Additional Room Nights Used */}
              <TextField
                label="Additional room nights used"
                type="number"
                value={fundingData.additional_room_nights_used}
                onChange={(value) => setFundingData(prev => ({ ...prev, additional_room_nights_used: value }))}
                placeholder="Enter number of nights used"
                min="0"
                max={fundingData.additional_room_nights_approved || undefined}
                disabled={!fundingData.additional_room_approved}
              />
            </div>
          </div>

          {/* Save Button */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
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

        {/* Right Column - Trackers */}
        <div className="space-y-8">
          {/* iCare Night Tracker */}
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
                      className={`h-3 rounded-full transition-all duration-300 ${
                        nightsUsed > nightsApproved ? 'bg-gray-600' : 'bg-blue-600'
                      }`}
                      style={{ 
                        width: `${Math.min(100, (nightsUsed / nightsApproved) * 100)}%` 
                      }}
                    />
                  </div>
                )}
                
                <p className={`text-sm ${nightsUsed > nightsApproved ? 'text-gray-600 font-medium' : 'text-gray-500'}`}>
                  {nightsApproved && nightsUsed !== undefined
                    ? nightsUsed > nightsApproved
                      ? `${nightsUsed - nightsApproved} nights over limit`
                      : `${Math.max(0, nightsApproved - nightsUsed)} nights remaining`
                    : fundingData.approval_from && fundingData.approval_to
                      ? 'Set nights approved to track usage'
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

          {/* Additional Room Tracker */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-gray-600 mb-6">Additional Room Tracker</h2>
            
            <div>
              <p className="text-sm text-gray-600 mb-4">
                Number of nights used in service approval period for additional rooms
              </p>
              
              {fundingData.additional_room_approved ? (
                // Show tracker when a room type is selected
                <>
                  <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-100">
                    <div className="text-3xl font-bold text-gray-600 mb-2">
                      {additionalNightsUsed} of {additionalNightsApproved || 0}
                    </div>
                    
                    {additionalNightsApproved > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            additionalNightsUsed > additionalNightsApproved ? 'bg-gray-700' : 'bg-blue-500'
                          }`}
                          style={{ 
                            width: `${Math.min(100, (additionalNightsUsed / additionalNightsApproved) * 100)}%` 
                          }}
                        />
                      </div>
                    )}
                    
                    <p className={`text-sm ${additionalNightsUsed > additionalNightsApproved ? 'text-gray-700 font-medium' : 'text-gray-600'}`}>
                      {additionalNightsApproved && additionalNightsUsed !== undefined
                        ? additionalNightsUsed > additionalNightsApproved
                          ? `${additionalNightsUsed - additionalNightsApproved} nights over limit`
                          : `${Math.max(0, additionalNightsApproved - additionalNightsUsed)} nights remaining`
                        : 'Set additional room nights to track usage'
                      }
                    </p>
                  </div>
                  
                  {fundingData.additional_room_approved && roomTypeOptions.length > 0 && (
                    <div className="mt-4 text-sm text-gray-600">
                      <p><strong>Room Type:</strong></p>
                      <p>{getSelectedRoomTypeLabel()}</p>
                    </div>
                  )}
                </>
              ) : (
                // Show message when no room type is selected
                <div className="bg-gray-50 rounded-lg p-6 text-center border border-gray-200">
                  <div className="text-gray-400 mb-2">
                    <svg className="w-16 h-16 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <p className="text-gray-500 text-sm">
                    No additional room approved
                  </p>
                  <p className="text-gray-400 text-xs mt-2">
                    Select a room type above to start tracking
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FundingForm;