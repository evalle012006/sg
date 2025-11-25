import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Trash2, Edit2, AlertCircle, Calendar } from 'lucide-react';
import moment from 'moment';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const SelectComponent = dynamic(() => import('../ui/select'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));

const FundingForm = ({ uuid, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [fundingApprovals, setFundingApprovals] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingApproval, setEditingApproval] = useState(null);

  // Package and Room Type options
  const [packageOptions, setPackageOptions] = useState([]);
  const [loadingPackages, setLoadingPackages] = useState(false);
  const [roomTypeOptions, setRoomTypeOptions] = useState([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);

  useEffect(() => {
    if (uuid) {
      fetchFundingApprovals();
      loadPackageOptions();
      loadRoomTypes();
    }
  }, [uuid]);

  const fetchFundingApprovals = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/guests/${uuid}/funding-approvals`);
      if (response.ok) {
        const result = await response.json();
        setFundingApprovals(result.data || []);
      }
    } catch (error) {
      console.error('Error fetching funding approvals:', error);
      toast.error('Failed to load funding approvals');
    } finally {
      setLoading(false);
    }
  };

  const loadPackageOptions = async () => {
    setLoadingPackages(true);
    try {
      const response = await fetch('/api/packages/?funder=Non-NDIS&limit=100');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();
      const packageList = [];
      const responseData = result.packages || result;
      
      if (Array.isArray(responseData)) {
        responseData.forEach(pkg => {
          if (pkg.funder === 'Non-NDIS') {
            packageList.push({
              label: pkg.name + (pkg.package_code ? ` (${pkg.package_code})` : ''),
              value: pkg.id,
              packageData: pkg
            });
          }
        });
      }
      
      packageList.sort((a, b) => a.label.localeCompare(b.label));
      setPackageOptions(packageList);
    } catch (error) {
      console.error('Error loading packages:', error);
      toast.error('Failed to load package options');
    } finally {
      setLoadingPackages(false);
    }
  };

  const loadRoomTypes = async () => {
    setLoadingRoomTypes(true);
    try {
      const response = await fetch('/api/manage-room?simple=true');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      
      const result = await response.json();
      const roomTypeList = [{ label: 'No', value: null, roomTypeData: null }];
      
      if (Array.isArray(result)) {
        result.forEach(roomType => {
          roomTypeList.push({
            label: roomType.name,
            value: roomType.id,
            roomTypeData: roomType
          });
        });
      }
      
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

  const handleAddNew = () => {
    setEditingApproval(null);
    setShowModal(true);
  };

  const handleEdit = (approval) => {
    setEditingApproval(approval);
    setShowModal(true);
  };

  const handleDelete = async (approvalId) => {
    if (!confirm('Are you sure you want to delete this funding approval?')) return;

    try {
      const response = await fetch(`/api/guests/${uuid}/funding-approvals/${approvalId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Funding approval deleted successfully');
        fetchFundingApprovals();
      } else {
        throw new Error('Failed to delete approval');
      }
    } catch (error) {
      console.error('Error deleting approval:', error);
      toast.error('Failed to delete funding approval');
    }
  };

  const calculateTotals = () => {
    return fundingApprovals.reduce((totals, approval) => {
      const nightsApproved = approval.nights_approved || 0;
      const nightsUsed = approval.nights_used || 0;
      const nightsRemaining = Math.max(0, nightsApproved - nightsUsed);

      return {
        totalAllocated: totals.totalAllocated + nightsApproved,
        totalUsed: totals.totalUsed + nightsUsed,
        totalRemaining: totals.totalRemaining + nightsRemaining
      };
    }, { totalAllocated: 0, totalUsed: 0, totalRemaining: 0 });
  };

  const totals = calculateTotals();

  const ApprovalCard = ({ approval }) => {
    const nightsApproved = approval.nights_approved || 0;
    const nightsUsed = approval.nights_used || 0;
    const nightsRemaining = Math.max(0, nightsApproved - nightsUsed);
    const nightsPercentage = nightsApproved > 0 ? (nightsUsed / nightsApproved) * 100 : 0;

    const additionalNightsApproved = approval.additional_room_nights_approved || 0;
    const additionalNightsUsed = approval.additional_room_nights_used || 0;
    const additionalNightsRemaining = Math.max(0, additionalNightsApproved - additionalNightsUsed);
    const additionalPercentage = additionalNightsApproved > 0 ? (additionalNightsUsed / additionalNightsApproved) * 100 : 0;

    const isExpired = approval.approval_to && moment(approval.approval_to).isBefore(moment());
    const isActive = approval.approval_from && approval.approval_to 
      ? moment().isBetween(moment(approval.approval_from), moment(approval.approval_to), 'day', '[]')
      : false;

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        {/* Card Header */}
        <div className={`p-4 border-b border-gray-200 ${isActive ? 'bg-blue-50' : 'bg-gray-50'}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base font-semibold text-gray-800">
                  {approval.approval_name}
                </h3>
                {isActive && (
                  <span className="px-2 py-0.5 bg-blue-600 text-white text-xs font-medium rounded">
                    Active
                  </span>
                )}
                {isExpired && (
                  <span className="px-2 py-0.5 bg-gray-400 text-white text-xs font-medium rounded">
                    Expired
                  </span>
                )}
              </div>
              {approval.approval_number && (
                <p className="text-xs text-gray-500">
                  Approval number: {approval.approval_number}
                </p>
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-gray-600">
                <Calendar size={13} className="flex-shrink-0" />
                <span>
                  {moment(approval.approval_from).format('DD MMM YYYY')} - {moment(approval.approval_to).format('DD MMM YYYY')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(approval)}
                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Edit"
              >
                <Edit2 size={16} />
              </button>
              <button
                onClick={() => handleDelete(approval.id)}
                className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column - Info */}
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">iCare Package Funding</h4>
                
                {approval.package && (
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Package approved</p>
                    <p className="text-sm text-gray-800">
                      {approval.package.name}
                      {approval.package.package_code && ` (${approval.package.package_code})`}
                    </p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Number of nights approved</span>
                    <span className="font-medium text-gray-800">{nightsApproved}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Number of nights used</span>
                    <span className="font-medium text-gray-800">{nightsUsed}</span>
                  </div>
                </div>
              </div>

              {/* Additional Room Info */}
              {approval.additional_room_type_id && approval.additionalRoomType && (
                <div className="pt-4 border-t border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Room Funding</h4>
                  <p className="text-xs text-gray-500 mb-3">Separate funding allocation for additional rooms</p>
                  
                  <div className="mb-3 pb-3 border-b border-gray-200">
                    <p className="text-xs text-gray-500 mb-1">Additional room type approved</p>
                    <p className="text-sm text-gray-800">{approval.additionalRoomType.name}</p>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additional room nights approved</span>
                      <span className="font-medium text-gray-800">{additionalNightsApproved}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Additional room nights used</span>
                      <span className="font-medium text-gray-800">{additionalNightsUsed}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column - Trackers */}
            <div className="space-y-6">
              {/* iCare Night Tracker */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">iCare Night Tracker</h4>
                <p className="text-xs text-gray-600 mb-4">Number of nights used in service approval period</p>
                
                <div className="bg-gray-50 rounded-lg p-6 text-center">
                  <div className="text-3xl font-bold text-gray-800 mb-2">
                    {nightsUsed} of {nightsApproved}
                  </div>
                  
                  {nightsApproved > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                      <div 
                        className={`h-3 rounded-full transition-all duration-300 ${
                          nightsPercentage >= 100 ? 'bg-red-600' : 'bg-blue-600'
                        }`}
                        style={{ width: `${Math.min(100, nightsPercentage)}%` }}
                      />
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    {nightsApproved > 0
                      ? nightsRemaining > 0
                        ? `${nightsRemaining} nights remaining`
                        : 'No nights remaining'
                      : 'Set approval period and nights to track usage'
                    }
                  </p>
                </div>
              </div>

              {/* Additional Room Tracker */}
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Additional Room Tracker</h4>
                <p className="text-xs text-gray-600 mb-4">Number of nights used in service approval period for additional rooms</p>
                
                {approval.additional_room_type_id && approval.additionalRoomType ? (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="text-3xl font-bold text-gray-800 mb-2">
                      {additionalNightsUsed} of {additionalNightsApproved}
                    </div>
                    
                    {additionalNightsApproved > 0 && (
                      <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                        <div 
                          className={`h-3 rounded-full transition-all duration-300 ${
                            additionalPercentage >= 100 ? 'bg-red-600' : 'bg-blue-600'
                          }`}
                          style={{ width: `${Math.min(100, additionalPercentage)}%` }}
                        />
                      </div>
                    )}
                    
                    <p className="text-sm text-gray-600">
                      {additionalNightsApproved > 0
                        ? additionalNightsRemaining > 0
                          ? `${additionalNightsRemaining} nights remaining`
                          : 'No nights remaining'
                        : 'Set additional room nights to track usage'
                      }
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <div className="mb-3">
                      <svg className="w-12 h-12 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                    </div>
                    <p className="text-gray-500 text-sm mb-1">No additional room approved</p>
                    <p className="text-gray-400 text-xs">Select a room type above to start tracking</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const ApprovalFormModal = () => {
    const [formData, setFormData] = useState({
      approval_name: '',
      approval_number: '',
      nights_approved: '',
      nights_used: 0,
      package_id: null,
      approval_from: '',
      approval_to: '',
      additional_room_type_id: null,
      additional_room_nights_approved: '',
      additional_room_nights_used: 0,
      status: 'active',
      notes: ''
    });

    const [saving, setSaving] = useState(false);

    useEffect(() => {
      if (editingApproval) {
        setFormData({
          approval_name: editingApproval.approval_name || '',
          approval_number: editingApproval.approval_number || '',
          nights_approved: editingApproval.nights_approved || '',
          nights_used: editingApproval.nights_used || 0,
          package_id: editingApproval.package_id || null,
          approval_from: editingApproval.approval_from || '',
          approval_to: editingApproval.approval_to || '',
          additional_room_type_id: editingApproval.additional_room_type_id || null,
          additional_room_nights_approved: editingApproval.additional_room_nights_approved || '',
          additional_room_nights_used: editingApproval.additional_room_nights_used || 0,
          status: editingApproval.status || 'active',
          notes: editingApproval.notes || ''
        });
      } else {
        setFormData({
          approval_name: '',
          approval_number: '',
          nights_approved: '',
          nights_used: 0,
          package_id: null,
          approval_from: '',
          approval_to: '',
          additional_room_type_id: null,
          additional_room_nights_approved: '',
          additional_room_nights_used: 0,
          status: 'active',
          notes: ''
        });
      }
    }, [editingApproval]);

    const getSelectedPackageLabel = () => {
      if (formData.package_id && packageOptions.length > 0) {
        const selectedOption = packageOptions.find(option => option.value === formData.package_id);
        return selectedOption ? selectedOption.label : '';
      }
      return '';
    };

    const getSelectedRoomTypeLabel = () => {
      if (formData.additional_room_type_id === null || formData.additional_room_type_id === undefined) {
        return 'No';
      }
      if (formData.additional_room_type_id && roomTypeOptions.length > 0) {
        const selectedOption = roomTypeOptions.find(option => option.value === formData.additional_room_type_id);
        return selectedOption ? selectedOption.label : 'No';
      }
      return 'No';
    };

    const validateForm = () => {
      if (!formData.approval_name.trim()) {
        toast.error('Please enter an approval name');
        return false;
      }

      if (!formData.approval_number.trim()) {
        toast.error('Please enter an approval number');
        return false;
      }

      if (!formData.approval_from) {
        toast.error('Please select a start date');
        return false;
      }

      if (!formData.approval_to) {
        toast.error('Please select an end date');
        return false;
      }

      if (formData.approval_from && formData.approval_to) {
        const fromDate = moment(formData.approval_from);
        const toDate = moment(formData.approval_to);
        
        if (toDate.isBefore(fromDate)) {
          toast.error('Approval end date must be after start date');
          return false;
        }
      }

      if (!formData.package_id) {
        toast.error('Please select a package');
        return false;
      }

      if (!formData.nights_approved || parseInt(formData.nights_approved) < 0) {
        toast.error('Please enter a valid number of nights approved');
        return false;
      }

      if (formData.nights_used === '' || formData.nights_used === null || parseInt(formData.nights_used) < 0) {
        toast.error('Please enter a valid number of nights used');
        return false;
      }

      if (formData.additional_room_type_id && !formData.additional_room_nights_approved) {
        toast.error('Please enter nights approved for the additional room');
        return false;
      }

      if (formData.additional_room_type_id && (formData.additional_room_nights_used === '' || formData.additional_room_nights_used === null)) {
        toast.error('Please enter nights used for the additional room');
        return false;
      }

      return true;
    };

    const handleSave = async () => {
      if (!validateForm()) return;

      setSaving(true);
      try {
        const url = editingApproval 
          ? `/api/guests/${uuid}/funding-approvals/${editingApproval.id}`
          : `/api/guests/${uuid}/funding-approvals`;
        
        const method = editingApproval ? 'PUT' : 'POST';

        const payload = {
          approval_name: formData.approval_name,
          approval_number: formData.approval_number || null,
          nights_approved: parseInt(formData.nights_approved),
          nights_used: parseInt(formData.nights_used) || 0,
          package_id: formData.package_id,
          approval_from: formData.approval_from || null,
          approval_to: formData.approval_to || null,
          additional_room_type_id: formData.additional_room_type_id,
          additional_room_nights_approved: formData.additional_room_type_id 
            ? parseInt(formData.additional_room_nights_approved) || 0 
            : 0,
          additional_room_nights_used: formData.additional_room_type_id 
            ? parseInt(formData.additional_room_nights_used) || 0 
            : 0,
          status: formData.status,
          notes: formData.notes || null
        };

        const response = await fetch(url, {
          method: method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (response.ok) {
          toast.success(editingApproval ? 'Funding approval updated successfully!' : 'Funding approval created successfully!');
          setShowModal(false);
          fetchFundingApprovals();
        } else {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to save funding approval');
        }
      } catch (error) {
        console.error('Error saving funding approval:', error);
        toast.error(error.message || 'Failed to save funding approval. Please try again.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
        <div className="bg-white rounded-lg max-w-5xl w-full max-h-[95vh] sm:max-h-[90vh] flex flex-col my-4 sm:my-8">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 flex-shrink-0">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                {editingApproval ? 'Edit Funding Approval' : 'Add New Funding Approval'}
              </h2>
              <p className="text-xs sm:text-sm text-gray-500 mt-1">
                {editingApproval ? 'Update the funding approval details' : 'Create a new funding approval for this guest'}
              </p>
            </div>
            <button
              onClick={() => setShowModal(false)}
              className="p-2 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0"
              disabled={saving}
            >
              <span className="text-2xl text-gray-500">×</span>
            </button>
          </div>

          {/* Modal Content - Scrollable */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 sm:p-6">
              {/* Basic Information Section */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Basic Information</h3>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                  <TextField
                    label="Approval name"
                    value={formData.approval_name}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_name: value }))}
                    placeholder="e.g., iCare Winter 2024"
                    required
                  />

                  <TextField
                    label="Approval number"
                    value={formData.approval_number}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_number: value }))}
                    placeholder="Enter approval reference number"
                    required
                  />
                </div>
              </div>

              {/* Approval Period Section */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Approval Period</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  <DateComponent
                    label="Start date"
                    value={formData.approval_from}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_from: value }))}
                    required
                  />

                  <DateComponent
                    label="End date"
                    value={formData.approval_to}
                    onChange={(value) => setFormData(prev => ({ ...prev, approval_to: value }))}
                    required
                  />
                </div>
                
                {formData.approval_from && formData.approval_to && (
                  <div className="mt-3 p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <p className="text-xs sm:text-sm text-blue-700">
                      <span className="font-medium">Duration:</span> {moment(formData.approval_to).diff(moment(formData.approval_from), 'days') + 1} days
                    </p>
                  </div>
                )}
              </div>

              {/* iCare Package Funding Section */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">iCare Package Funding</h3>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium mb-2 text-gray-700">
                        Package approved <span className='text-red-600 font-semibold'>*</span>
                        {loadingPackages && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                      </label>
                      <SelectComponent
                        options={packageOptions}
                        value={getSelectedPackageLabel()}
                        onChange={(selected) => {
                          setFormData(prev => ({ ...prev, package_id: selected?.value || null }));
                        }}
                        placeholder={loadingPackages ? "Loading packages..." : "Select package type"}
                        disabled={loadingPackages}
                        isClearable={true}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Select the iCare package associated with this approval</p>
                    </div>

                    <div>
                      <TextField
                        label="Nights approved"
                        type="number"
                        value={formData.nights_approved}
                        onChange={(value) => setFormData(prev => ({ ...prev, nights_approved: value }))}
                        placeholder="0"
                        min="0"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Total nights allocated in this approval</p>
                    </div>

                    <div>
                      <TextField
                        label="Nights used"
                        type="number"
                        value={formData.nights_used}
                        onChange={(value) => setFormData(prev => ({ ...prev, nights_used: value }))}
                        placeholder="0"
                        min="0"
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Nights already consumed from this approval</p>
                    </div>
                  </div>

                  {formData.nights_approved && (
                    <div className="mt-4 p-3 bg-white border border-gray-200 rounded-lg">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Remaining nights:</span>
                        <span className="font-semibold text-gray-800">
                          {Math.max(0, parseInt(formData.nights_approved || 0) - parseInt(formData.nights_used || 0))} nights
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Room Funding Section */}
              <div className="mb-6 sm:mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-blue-600 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Additional Room Funding</h3>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 sm:p-5">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    <div className="lg:col-span-2">
                      <label className="block text-sm font-medium mb-2 text-gray-700">
                        Additional room type <span className='text-red-600 font-semibold'>*</span>
                        {loadingRoomTypes && <span className="text-xs text-gray-500 ml-2">(Loading...)</span>}
                      </label>
                      <SelectComponent
                        options={roomTypeOptions}
                        value={getSelectedRoomTypeLabel()}
                        onChange={(selected) => {
                          if (selected?.value === null) {
                            setFormData(prev => ({ 
                              ...prev, 
                              additional_room_type_id: null,
                              additional_room_nights_approved: '',
                              additional_room_nights_used: 0
                            }));
                          } else {
                            setFormData(prev => ({ ...prev, additional_room_type_id: selected?.value || null }));
                          }
                        }}
                        placeholder={loadingRoomTypes ? "Loading room types..." : "Select additional room type"}
                        disabled={loadingRoomTypes}
                        isClearable={false}
                        required
                      />
                      <p className="text-xs text-gray-500 mt-1.5">Choose the type of additional room or select &quot;No&quot; to skip</p>
                    </div>

                    {formData.additional_room_type_id && (
                      <>
                        <div>
                          <TextField
                            label="Additional nights approved"
                            type="number"
                            value={formData.additional_room_nights_approved}
                            onChange={(value) => setFormData(prev => ({ ...prev, additional_room_nights_approved: value }))}
                            placeholder="0"
                            min="0"
                            disabled={!formData.additional_room_type_id}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1.5">Total additional room nights allocated</p>
                        </div>

                        <div>
                          <TextField
                            label="Additional nights used"
                            type="number"
                            value={formData.additional_room_nights_used}
                            onChange={(value) => setFormData(prev => ({ ...prev, additional_room_nights_used: value }))}
                            placeholder="0"
                            min="0"
                            disabled={!formData.additional_room_type_id}
                            required
                          />
                          <p className="text-xs text-gray-500 mt-1.5">Additional room nights already consumed</p>
                        </div>

                        {formData.additional_room_nights_approved && (
                          <div className="lg:col-span-2">
                            <div className="p-3 bg-white border border-gray-200 rounded-lg">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Additional nights remaining:</span>
                                <span className="font-semibold text-gray-800">
                                  {Math.max(0, parseInt(formData.additional_room_nights_approved || 0) - parseInt(formData.additional_room_nights_used || 0))} nights
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes Section */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-5 bg-gray-400 rounded-full"></div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-800">Additional Notes</h3>
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2 text-gray-700">
                    Notes <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Add any additional notes, special conditions, or important details about this approval..."
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer - Fixed */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3 p-4 sm:p-6 border-t border-gray-200 bg-gray-50 flex-shrink-0">
            <Button
              onClick={() => setShowModal(false)}
              disabled={saving}
              size="medium"
              color="secondary"
              label="Cancel"
            />
            <Button
              onClick={handleSave}
              disabled={saving}
              size="medium"
              color="primary"
              label={saving ? 'Saving...' : (editingApproval ? 'Update Approval' : 'Create Approval')}
              withIcon={true}
              iconName="check"
            />
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Simple Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 mb-1">Funding Approvals</h2>
          <p className="text-sm text-gray-600">
            Track and manage funding approvals for this guest
          </p>
        </div>
        <Button
          onClick={handleAddNew}
          size="medium"
          color="primary"
          label="Add Approval"
          withIcon={true}
          iconName="plus"
          Icon={Plus}
        />
      </div>

      {/* Summary Cards */}
      {fundingApprovals.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total allocated</p>
            <p className="text-2xl font-bold text-gray-800">{totals.totalAllocated}</p>
            <p className="text-xs text-gray-500">nights</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total used</p>
            <p className="text-2xl font-bold text-gray-800">{totals.totalUsed}</p>
            <p className="text-xs text-gray-500">nights</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4">
            <p className="text-xs text-gray-500 mb-1">Total remaining</p>
            <p className="text-2xl font-bold text-gray-800">{totals.totalRemaining}</p>
            <p className="text-xs text-gray-500">nights</p>
          </div>
        </div>
      )}

      {/* Info Banner */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">How funding approvals work:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Each approval shows allocated nights vs. nights used</li>
              <li>Active approvals are highlighted (within date range)</li>
              <li>Nights are automatically tracked when bookings are confirmed</li>
              <li>You can create multiple approvals with different date ranges</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Approvals List */}
      {fundingApprovals.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
          <div className="mb-4">
            <svg className="w-16 h-16 text-gray-300 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-800 mb-2">No Funding Approvals Yet</h3>
          <p className="text-gray-600 mb-6">
            Create funding approvals for this guest to start tracking night usage
          </p>
          <Button
            onClick={handleAddNew}
            size="medium"
            color="primary"
            label="Add First Approval"
            withIcon={true}
            iconName="plus"
            Icon={Plus}
          />
        </div>
      ) : (
        <div className="space-y-6">
          {fundingApprovals
            .sort((a, b) => moment(a.approval_from).diff(moment(b.approval_from)))
            .map((approval) => (
              <ApprovalCard key={approval.id} approval={approval} />
            ))}
        </div>
      )}

      {showModal && <ApprovalFormModal />}
    </div>
  );
};

export default FundingForm;