import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import moment from 'moment';
import dynamic from 'next/dynamic';
import { X } from 'lucide-react';

const TextField = dynamic(() => import('../ui-v2/TextField'));
const SelectComponent = dynamic(() => import('../ui/select'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));
const Button = dynamic(() => import('../ui-v2/Button'));

const ApprovalFormModal = ({ isOpen, onClose, approval, uuid, onSuccess }) => {
  const [formData, setFormData] = useState({
    approval_name: '',
    approval_number: '',
    approval_type: 'icare',
    nights_approved: '',
    package_id: null,
    approval_from: '',
    approval_to: '',
    additional_room_approved: null,
    additional_room_nights_approved: '',
    status: 'active'
  });

  const [isSaving, setIsSaving] = useState(false);
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);

  // Approval type options
  const approvalTypeOptions = [
    { label: 'iCare', value: 'icare' },
    { label: 'NDIS', value: 'ndis' },
    { label: 'Private', value: 'private' },
    { label: 'Other', value: 'other' }
  ];

  // Status options (only for edit mode)
  const statusOptions = [
    { label: 'Active', value: 'active' },
    { label: 'Expired', value: 'expired' },
    { label: 'Exhausted', value: 'exhausted' },
    { label: 'Cancelled', value: 'cancelled' }
  ];

  // Load package options
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
      toast.error('Failed to load package options');
    } finally {
      setLoadingPackages(false);
    }
  };

  // Load room types
  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    try {
      const response = await fetch('/api/manage-room?simple=true');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      const roomTypeList = [
        { label: 'No', value: null, roomTypeData: null }
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
      toast.error('Failed to load room types');
    } finally {
      setLoadingRoomTypes(false);
    }
  };

  // Load options on mount
  useEffect(() => {
    if (isOpen) {
      loadPackageOptions();
      loadRoomTypes();
    }
  }, [isOpen]);

  // Populate form when editing
  useEffect(() => {
    if (approval) {
      setFormData({
        approval_name: approval.approval_name || '',
        approval_number: approval.approval_number || '',
        approval_type: approval.approval_type || 'icare',
        nights_approved: approval.nights_approved || '',
        package_id: approval.package_id || null,
        approval_from: approval.approval_from || '',
        approval_to: approval.approval_to || '',
        additional_room_approved: approval.additional_room_approved || null,
        additional_room_nights_approved: approval.additional_room_nights_approved || '',
        status: approval.status || 'active'
      });
    } else {
      // Reset form for new approval
      setFormData({
        approval_name: '',
        approval_number: '',
        approval_type: 'icare',
        nights_approved: '',
        package_id: null,
        approval_from: '',
        approval_to: '',
        additional_room_approved: null,
        additional_room_nights_approved: '',
        status: 'active'
      });
    }
  }, [approval, isOpen]);

  // Get selected package label
  const getSelectedPackageLabel = () => {
    if (formData.package_id && packageOptions.length > 0) {
      const selectedOption = packageOptions.find(option => option.value === formData.package_id);
      return selectedOption ? selectedOption.label : '';
    }
    return '';
  };

  // Get selected room type label
  const getSelectedRoomTypeLabel = () => {
    if (formData.additional_room_approved === null || formData.additional_room_approved === undefined) {
      return 'No';
    }
    if (formData.additional_room_approved && roomTypeOptions.length > 0) {
      const selectedOption = roomTypeOptions.find(option => option.value === formData.additional_room_approved);
      return selectedOption ? selectedOption.label : 'No';
    }
    return 'No';
  };

  // Get selected approval type label
  const getSelectedApprovalTypeLabel = () => {
    const selectedOption = approvalTypeOptions.find(option => option.value === formData.approval_type);
    return selectedOption ? selectedOption.label : '';
  };

  // Get selected status label
  const getSelectedStatusLabel = () => {
    const selectedOption = statusOptions.find(option => option.value === formData.status);
    return selectedOption ? selectedOption.label : '';
  };

  // Handle package selection
  const handlePackageChange = (selected) => {
    if (selected && selected.value) {
      setFormData(prev => ({ ...prev, package_id: selected.value }));
    } else {
      setFormData(prev => ({ ...prev, package_id: null }));
    }
  };

  // Handle room type selection
  const handleRoomTypeChange = (selected) => {
    if (selected) {
      if (selected.value === null) {
        setFormData(prev => ({ 
          ...prev, 
          additional_room_approved: null,
          additional_room_nights_approved: ''
        }));
      } else {
        setFormData(prev => ({ ...prev, additional_room_approved: selected.value }));
      }
    } else {
      setFormData(prev => ({ 
        ...prev, 
        additional_room_approved: null,
        additional_room_nights_approved: ''
      }));
    }
  };

  // Handle approval type selection
  const handleApprovalTypeChange = (selected) => {
    if (selected && selected.value) {
      setFormData(prev => ({ ...prev, approval_type: selected.value }));
    }
  };

  // Handle status selection
  const handleStatusChange = (selected) => {
    if (selected && selected.value) {
      setFormData(prev => ({ ...prev, status: selected.value }));
    }
  };

  // Validation
  const validateForm = () => {
    if (!formData.nights_approved || parseInt(formData.nights_approved) < 0) {
      toast.error('Please enter a valid number of nights approved');
      return false;
    }

    if (!formData.approval_from) {
      toast.error('Please select an approval start date');
      return false;
    }

    if (!formData.approval_to) {
      toast.error('Please select an approval end date');
      return false;
    }

    // Validate date range
    const fromDate = moment(formData.approval_from);
    const toDate = moment(formData.approval_to);
    
    if (toDate.isBefore(fromDate)) {
      toast.error('Approval end date must be after start date');
      return false;
    }

    // Validate additional room nights if room is selected
    if (formData.additional_room_approved && !formData.additional_room_nights_approved) {
      toast.error('Please enter nights approved for the additional room');
      return false;
    }

    return true;
  };

  // Handle save
  const handleSave = async () => {
    if (!validateForm()) return;

    setIsSaving(true);
    try {
      const url = approval 
        ? `/api/guests/${uuid}/approvals/${approval.id}`
        : `/api/guests/${uuid}/approvals`;
      
      const method = approval ? 'PUT' : 'POST';

      const payload = {
        approval_name: formData.approval_name || null,
        approval_number: formData.approval_number || null,
        approval_type: formData.approval_type,
        nights_approved: parseInt(formData.nights_approved),
        package_id: formData.package_id,
        approval_from: formData.approval_from,
        approval_to: formData.approval_to,
        additional_room_approved: formData.additional_room_approved,
        additional_room_nights_approved: formData.additional_room_approved 
          ? parseInt(formData.additional_room_nights_approved) || 0 
          : 0,
        status: formData.status
      };

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        toast.success(approval ? 'Approval updated successfully!' : 'Approval created successfully!');
        if (onSuccess) {
          onSuccess();
        }
        onClose();
      } else {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save approval');
      }
    } catch (error) {
      console.error('Error saving approval:', error);
      toast.error(error.message || 'Failed to save approval. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-800">
            {approval ? 'Edit Approval' : 'Add New Approval'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            disabled={isSaving}
          >
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              {/* Approval Name */}
              <TextField
                label="Approval Name (Optional)"
                value={formData.approval_name}
                onChange={(value) => setFormData(prev => ({ ...prev, approval_name: value }))}
                placeholder="e.g., 2024 Winter Package"
                helperText="A friendly name to identify this approval"
              />

              {/* Approval Number */}
              <TextField
                label="Approval Number (Optional)"
                value={formData.approval_number}
                onChange={(value) => setFormData(prev => ({ ...prev, approval_number: value }))}
                placeholder="Enter approval number"
              />

              {/* Approval Type */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Approval Type *
                </label>
                <SelectComponent
                  options={approvalTypeOptions}
                  value={getSelectedApprovalTypeLabel()}
                  onChange={handleApprovalTypeChange}
                  placeholder="Select approval type"
                  isClearable={false}
                />
              </div>

              {/* Nights Approved */}
              <TextField
                label="Number of Nights Approved *"
                type="number"
                value={formData.nights_approved}
                onChange={(value) => setFormData(prev => ({ ...prev, nights_approved: value }))}
                placeholder="Enter number of nights"
                min="0"
                required
              />

              {/* Package Approved */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-700">
                  Package Approved (Optional)
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

              {/* Status (only show in edit mode) */}
              {approval && (
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Status *
                  </label>
                  <SelectComponent
                    options={statusOptions}
                    value={getSelectedStatusLabel()}
                    onChange={handleStatusChange}
                    placeholder="Select status"
                    isClearable={false}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Change status to mark approval as expired, exhausted, or cancelled
                  </p>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              {/* Approval From */}
              <DateComponent
                label="Approval From *"
                value={formData.approval_from}
                onChange={(value) => setFormData(prev => ({ ...prev, approval_from: value }))}
                required
              />

              {/* Approval To */}
              <DateComponent
                label="Approval To *"
                value={formData.approval_to}
                onChange={(value) => setFormData(prev => ({ ...prev, approval_to: value }))}
                required
              />

              {/* Additional Room Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">
                  Additional Room (Optional)
                </h3>
                
                {/* Additional Room Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Room Type
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

                {/* Additional Room Nights */}
                <TextField
                  label="Nights Approved for Additional Room"
                  type="number"
                  value={formData.additional_room_nights_approved}
                  onChange={(value) => setFormData(prev => ({ ...prev, additional_room_nights_approved: value }))}
                  placeholder="Enter number of nights"
                  min="0"
                  disabled={!formData.additional_room_approved}
                />
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-800">
                <p className="font-medium mb-1">About Approval Tracking</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Nights are automatically tracked when bookings are confirmed</li>
                  <li>On-time cancellations add nights back to the approval</li>
                  <li>Late cancellations keep nights subtracted</li>
                  <li>Approval validity is based on the date range you set</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <Button
            onClick={onClose}
            disabled={isSaving}
            size="medium"
            color="secondary"
            label="Cancel"
          />
          <Button
            onClick={handleSave}
            disabled={isSaving}
            size="medium"
            color="primary"
            label={isSaving ? 'Saving...' : (approval ? 'Update Approval' : 'Create Approval')}
            withIcon={true}
            iconName="check"
          />
        </div>
      </div>
    </div>
  );
};

export default ApprovalFormModal;