import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/router';
import Image from 'next/image';
import { toast } from 'react-toastify';
import { Home } from 'lucide-react';
import moment from 'moment';
import { checkFileSize, omitAttribute } from '../../utilities/common';

import dynamic from 'next/dynamic';

const Button = dynamic(() => import('../ui-v2/Button'));
const SelectComponent = dynamic(() => import('../ui-v2/Select'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const DateComponent = dynamic(() => import('../ui-v2/DateField'));
const Spinner = dynamic(() => import('../ui/spinner'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));

export default function AssetEquipmentForm({ 
  mode, 
  equipmentId, 
  onCancel, 
  onSuccess, 
  assetCategories: rawAssetCategories, 
  assetStatuses: initialAssetStatuses, 
  supplierList: initialSupplierList 
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [supplierList, setSupplierList] = useState(initialSupplierList || []);
  const [assetStatuses, setAssetStatuses] = useState(initialAssetStatuses || []);
  const imageRef = useRef();

  const [equipment, setEquipment] = useState({
    name: '',
    serial_number: '',
    category_name: '',
    category_id: '',
    supplier_name: '',
    supplier_id: '',
    supplier_contact_number: '',
    purchase_date: '',
    warranty_period: '',
    type: 'independent',
    last_service_date: '',
    next_service_date: '',
    status: 'active', // Default to active
    image_filename: '',
    url: '',
    EquipmentCategory: null,
    Supplier: null
  });

  const isViewMode = mode === 'view';
  const isEditMode = mode === 'edit';
  const isAddMode = mode === 'add';

  // Required fields
  const requiredFields = [
    'name',
    'serial_number',
    'category_id',
    'supplier_id'
  ];

  // Transform raw asset categories to proper format for SelectComponent
  const assetCategories = useMemo(() => {
    if (!rawAssetCategories || !Array.isArray(rawAssetCategories)) return [];
    
    return rawAssetCategories.map(category => {
      // Format the category name for display (convert underscore to space and capitalize)
      const displayName = category.name
        ? category.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
        : '';
      
      return {
        id: category.id,
        label: displayName,
        value: displayName,
        name: category.name // Keep original name for backend
      };
    });
  }, [rawAssetCategories]);

  // Filter asset statuses to remove any "All" option
  const filteredAssetStatuses = useMemo(() => {
    return assetStatuses?.filter(status => 
      status.value !== 'All' && 
      status.value !== 'all' && 
      status.label !== 'All' && 
      status.label !== 'all'
    ) || [];
  }, [assetStatuses]);

  // Helper functions to get display values for SelectComponents
  const getStatusDisplayValue = (status) => {
    if (!status || !filteredAssetStatuses || filteredAssetStatuses.length === 0) return null;
    const statusOption = filteredAssetStatuses.find(s => 
      s.value?.toLowerCase() === status.toLowerCase() || 
      s.label?.toLowerCase() === status.toLowerCase()
    );
    return statusOption || null;
  };

  const getCategoryDisplayValue = (categoryName) => {
    if (!categoryName || !assetCategories || assetCategories.length === 0) return null;
    const categoryOption = assetCategories.find(c => 
      c.label === categoryName || c.value === categoryName
    );
    return categoryOption || null;
  };

  const getSupplierDisplayValue = (supplierId) => {
    if (!supplierId || !supplierList || supplierList.length === 0) return null;
    const supplierOption = supplierList.find(s => s.id === supplierId || s.id === parseInt(supplierId));
    return supplierOption || null;
  };

  const getTypeDisplayValue = (type) => {
    if (!type) return null;
    const typeOptions = [
      { label: 'Independent', value: 'independent' }, 
      { label: 'Group', value: 'group' }
    ];
    const typeOption = typeOptions.find(t => t.value === type);
    return typeOption || null;
  };

  // Add state to track if all options are loaded
  const [optionsLoaded, setOptionsLoaded] = useState(false);

  // Check if all required options are loaded
  useEffect(() => {
    const allLoaded = 
      (filteredAssetStatuses && filteredAssetStatuses.length > 0) &&
      (assetCategories && assetCategories.length > 0) &&
      (supplierList && supplierList.length > 0);
    
    if (allLoaded && !optionsLoaded) {
      setOptionsLoaded(true);
    }
  }, [filteredAssetStatuses, assetCategories, supplierList, optionsLoaded]);

  // Load suppliers from API
  const loadSuppliers = async () => {
    try {
      const response = await fetch('/api/supplier');
      if (response.ok) {
        const data = await response.json();
        const suppliersData = data.map(s => ({
          ...s,
          label: s.name,
          value: s.name
        }));
        setSupplierList(suppliersData);
      }
    } catch (error) {
      console.error('Error loading suppliers:', error);
    }
  };

  // Load asset statuses from API
  const loadAssetStatuses = async () => {
    try {
      const response = await fetch('/api/equipments/get-asset-status');
      if (response.ok) {
        const data = await response.json();
        const statuses = [];
        data.assetStatus.map(status => {
          statuses.push(JSON.parse(status.value));
        });
        setAssetStatuses(statuses);
      }
    } catch (error) {
      console.error('Error loading asset statuses:', error);
    }
  };

  const loadEquipment = async () => {
    if (!equipmentId || isAddMode) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/equipments/${equipmentId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Set the equipment data with proper structure
        const equipmentData = {
          ...data,
          // Use image_url from API response, fallback to constructing URL
          url: data.image_url || (data.image_filename && !data.image_filename.includes("default-") ? 
            `/equipments/${data.image_filename}` : ''),
          // Ensure category information is properly set using the formatted category_name
          category_name: data.category_name || (data.EquipmentCategory?.name ? 
            data.EquipmentCategory.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : ''),
          category_id: data.EquipmentCategory?.id || data.category_id || '',
          // Ensure supplier information is properly set
          supplier_name: data.supplier_name || data.Supplier?.name || '',
          supplier_id: data.Supplier?.id || data.supplier_id || '',
          supplier_contact_number: data.supplier_contact_number || data.Supplier?.phone_number || '',
          // Ensure status is set with fallback to 'active' if empty
          status: data.status && data.status.trim() !== '' ? data.status : 'active',
          // Ensure type is set
          type: data.type || 'independent'
        };
        
        setEquipment(equipmentData);
      } else if (response.status === 404) {
        toast.error('Equipment not found.');
        if (onCancel) onCancel();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Failed to load equipment.');
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast.error('Failed to load equipment. Please try again later.');
    }
    setIsLoading(false);
  };

  useEffect(() => {
    // Load suppliers if not provided as prop
    if (!initialSupplierList || initialSupplierList.length === 0) {
      loadSuppliers();
    }
    
    // Load asset statuses if not provided as prop
    if (!initialAssetStatuses || initialAssetStatuses.length === 0) {
      loadAssetStatuses();
    }
    
    // Load equipment data for edit/view mode
    loadEquipment();
  }, [equipmentId, mode]);

  // Handle form field changes
  const onChange = (value, field) => {
    let updated = { ...equipment };
    updated[field] = value;

    // Auto-calculate next service date when last service date changes
    if (field === 'last_service_date') {
      const nextServiceDate = moment(value).add(12, 'month').format('YYYY-MM-DD');
      updated['next_service_date'] = nextServiceDate;
    }

    setEquipment(updated);
  };

  // Status Change Handler
  const handleStatusChange = (selected) => {
    setEquipment({ 
      ...equipment, 
      status: selected?.value || ''
    });
  };

  // Category Change Handler - FIXED
  const handleCategoryChange = (selected) => {
    setEquipment({ 
      ...equipment, 
      category_name: selected?.value || '', 
      category_id: selected?.id || '',
      EquipmentCategory: selected ? {
        id: selected.id,
        name: selected.name || selected.value.toLowerCase().replaceAll(" ", "_")
      } : null
    });
  };

  // Supplier Change Handler - FIXED
  const handleSupplierChange = (selected) => {
    setEquipment({ 
      ...equipment, 
      supplier_name: selected?.value || '', 
      supplier_id: selected?.id || '', 
      supplier_contact_number: selected?.phone_number || '',
      Supplier: selected ? {
        id: selected.id,
        name: selected.value,
        phone_number: selected.phone_number || ''
      } : null
    });
  };

  const handleTypeChange = (selected) => {
    setEquipment({ 
      ...equipment, 
      type: selected?.value || ''
    });
  };

  const updatePhoto = async (e) => {
    setImageUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();

    const fileSizeMsg = checkFileSize(file.size, 51200000);
    if (fileSizeMsg) {
      toast.error(fileSizeMsg);
      setImageUploading(false);
      return;
    }

    formData.append("fileType", "equipment-photo");
    formData.append("equipmentId", equipment.id);
    formData.append("file", file);

    try {
      const response = await fetch("/api/storage/equipment-photo", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      onChange(data.url, 'url');
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image. Please try again.');
    }
    setImageUploading(false);
  };

  const handleImageError = (e) => {
    setImageLoadError(true);
    e.target.onError = null;
    e.target.src = "/no-image-placeholder.png";
  };

  // Validation
  const validateForm = () => {
    const errors = [];
    
    requiredFields.forEach(field => {
      if (!equipment[field] || equipment[field].toString().trim() === '') {
        errors.push(field);
      }
    });

    return errors;
  };

  const handleSave = async () => {
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/equipments/add-update', {
        method: 'POST',
        body: JSON.stringify(omitAttribute(equipment, 'image_filename')),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        
        toast.success(isAddMode ? "Equipment added successfully." : "Equipment updated successfully.");
        
        if (onSuccess) {
          if (isEditMode) {
            onSuccess({ action: 'edit', id: data.equipment?.id || equipmentId });
          } else {
            onSuccess({ action: 'add', id: data.equipment?.id });
          }
        }
      } else {
        toast.error("Failed to save equipment. Please try again.");
      }
    } catch (error) {
      console.error('Error saving equipment:', error);
      toast.error("Failed to save equipment. Please try again.");
    }
    setIsSaving(false);
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      const response = await fetch('/api/equipments/add-update', {
        method: 'POST',
        body: JSON.stringify({
          ...omitAttribute(equipment, 'image_filename'),
          status: 'archived'
        }),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        toast.success("Equipment archived successfully.");
        if (onSuccess) {
          onSuccess();
        }
      } else {
        toast.error("Failed to archive equipment. Please try again.");
      }
    } catch (error) {
      console.error('Error archiving equipment:', error);
      toast.error("Failed to archive equipment. Please try again.");
    }
    setIsArchiving(false);
  };

  // Function to map asset status to badge type (same as in list)
  const getStatusBadgeType = (status) => {
    const statusLower = (status || '').toLowerCase().trim();
    
    switch (statusLower) {
      case 'active':
        return 'success';
      case 'decommissioned':
        return 'archived';
      case 'needs maintenance':
        return 'error';
      case 'being repaired':
        return 'pending';
      default:
        return 'archived';
    }
  };

  const getStatusLabel = (status) => {
    if (!status || status.trim() === '') {
      return 'Active'; // Default to Active if no status
    }
    const statusTrimmed = status.trim();
    // Capitalize first letter and make rest lowercase for consistency
    return statusTrimmed.charAt(0).toUpperCase() + statusTrimmed.slice(1).toLowerCase();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  // View Mode - Equipment Preview
  if (isViewMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Home className="w-4 h-4" />
              <button 
                onClick={onCancel}
                className="hover:text-blue-600 transition-colors font-medium"
              >
                EQUIPMENT
              </button>
              <span>/</span>
              <span className="font-medium text-gray-900 uppercase">
                {equipment.name || 'EQUIPMENT DETAILS'}
              </span>
            </div>
            <Button
              type="button"
              color="primary"
              size="medium"
              label="EDIT EQUIPMENT"
              onClick={() => {
                if (onSuccess) {
                  onSuccess({ action: 'edit', id: equipmentId });
                }
              }}
              className="bg-yellow-400 hover:bg-yellow-500 text-gray-900 font-semibold"
            />
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column - Main Content */}
              <div className="lg:col-span-2">
                <h1 className="text-4xl font-bold text-gray-900 mb-6">
                  {equipment.name}
                </h1>

                {/* Equipment Image */}
                <div className="mb-6">
                  {equipment.url && !imageLoadError ? (
                    <div className="w-full h-80 overflow-hidden rounded-lg">
                      <img
                        src={equipment.url}
                        alt={equipment.name}
                        className="w-full h-full object-cover"
                        onError={handleImageError}
                      />
                    </div>
                  ) : (
                    <div className="w-full h-80 bg-gray-200 rounded-lg flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mx-auto mb-3">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8 text-gray-400">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        </div>
                        <div className="text-lg">No image available</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Equipment Details */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Equipment Details</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Serial Number</label>
                      <p className="text-gray-900 mt-1">{equipment.serial_number || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Category</label>
                      <p className="text-gray-900 mt-1">{equipment.category_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Supplier</label>
                      <p className="text-gray-900 mt-1">{equipment.supplier_name || 'Not specified'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Type</label>
                      <p className="text-gray-900 mt-1 capitalize">{equipment.type || 'Not specified'}</p>
                    </div>
                    {equipment.supplier_contact_number && (
                      <div>
                        <label className="text-sm font-medium text-gray-700">Supplier Contact</label>
                        <p className="text-gray-900 mt-1">{equipment.supplier_contact_number}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Right Column - Sidebar Info */}
              <div className="lg:col-span-1">
                <div className="rounded-lg border border-gray-200 overflow-hidden" style={{ background: '#F1F3F6' }}>
                  
                  {/* Status Section */}
                  <div className="p-6 border-b border-gray-200">
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Status</h3>
                    <div className="flex items-center space-x-2">
                        <StatusBadge 
                            type={getStatusBadgeType(equipment.status)} 
                            label={getStatusLabel(equipment.status)}
                        />
                    </div>
                  </div>

                  {/* Service Information */}
                  {(equipment.last_service_date || equipment.next_service_date) && (
                    <div className="p-6 border-b border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Service Information</h3>
                      <div className="space-y-3">
                        {equipment.last_service_date && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Last Service</label>
                            <p className="text-gray-900 mt-1">{moment(equipment.last_service_date).format('MMM DD, YYYY')}</p>
                          </div>
                        )}
                        {equipment.next_service_date && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Next Service</label>
                            <p className="text-gray-900 mt-1">{moment(equipment.next_service_date).format('MMM DD, YYYY')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Purchase Information */}
                  {(equipment.purchase_date || equipment.warranty_period) && (
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">Purchase Information</h3>
                      <div className="space-y-3">
                        {equipment.purchase_date && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Purchase Date</label>
                            <p className="text-gray-900 mt-1">{moment(equipment.purchase_date).format('MMM DD, YYYY')}</p>
                          </div>
                        )}
                        {equipment.warranty_period && (
                          <div>
                            <label className="text-sm font-medium text-gray-700">Warranty Expires</label>
                            <p className="text-gray-900 mt-1">{moment(equipment.warranty_period).format('MMM DD, YYYY')}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit/Add Mode - Form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Home className="w-4 h-4" />
            <button 
              onClick={onCancel}
              className="hover:text-blue-600 transition-colors"
            >
              EQUIPMENT
            </button>
            <span>/</span>
            <span className="font-medium">
              {isAddMode && 'ADD EQUIPMENT'}
              {isEditMode && 'EDIT EQUIPMENT'}
            </span>
          </div>
          <div className="flex items-center space-x-3">
            {/* Archive button - only show in edit mode and if equipment is not already archived */}
            {isEditMode && equipment.status !== 'archived' && (
              <Button
                type="button"
                color="outline"
                size="medium"
                label={isArchiving ? "ARCHIVING..." : "ARCHIVE"}
                onClick={handleArchive}
                disabled={isArchiving}
              />
            )}
            <Button
              type="button"
              color="outline"
              size="medium"
              label="CANCEL"
              onClick={onCancel}
            />
            <Button
              type="button"
              color="primary"
              size="medium"
              label={isSaving ? "SAVING..." : (isAddMode ? "CREATE EQUIPMENT" : "UPDATE EQUIPMENT")}
              onClick={handleSave}
              disabled={isSaving}
            />
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Form Fields */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                <div className="space-y-4">
                  <TextField 
                    label="Asset Name" 
                    value={equipment.name}
                    onChange={(value) => onChange(value, 'name')} 
                    required
                    placeholder="Enter equipment name"
                  />

                  <TextField 
                    label="Serial Number" 
                    value={equipment.serial_number}
                    onChange={(value) => onChange(value, 'serial_number')} 
                    required
                    placeholder="Enter serial number"
                  />

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status <span className="text-red-500">*</span>
                    </label>
                    {filteredAssetStatuses && filteredAssetStatuses.length > 0 ? (
                      <SelectComponent 
                        key={`status-${equipment.status}-${optionsLoaded}`}
                        options={filteredAssetStatuses} 
                        onClick={handleStatusChange} 
                        value={getStatusDisplayValue(equipment.status)}
                        width="100%" 
                        placeholder="Select status"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-10 border border-gray-300 rounded-md bg-gray-50">
                        <span className="text-gray-500 text-sm">Loading statuses...</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asset Category <span className="text-red-500">*</span>
                    </label>
                    {assetCategories && assetCategories.length > 0 ? (
                      <SelectComponent 
                        key={`category-${equipment.category_id}-${equipment.category_name}-${optionsLoaded}`}
                        options={assetCategories} 
                        onClick={handleCategoryChange} 
                        value={getCategoryDisplayValue(equipment.category_name)}
                        width="100%" 
                        placeholder="Select category"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-10 border border-gray-300 rounded-md bg-gray-50">
                        <span className="text-gray-500 text-sm">Loading categories...</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Asset Type
                    </label>
                    <SelectComponent 
                      key={`type-${equipment.type}-${optionsLoaded}`}
                      options={[
                        { label: 'Independent', value: 'independent' }, 
                        { label: 'Group', value: 'group' }
                      ]} 
                      onClick={handleTypeChange} 
                      value={getTypeDisplayValue(equipment.type)}
                      width="100%"
                      placeholder="Select type"
                    />
                  </div>
                </div>
              </div>

              {/* Supplier Information Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Supplier Information</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supplier <span className="text-red-500">*</span>
                    </label>
                    {supplierList && supplierList.length > 0 ? (
                      <SelectComponent 
                        key={`supplier-${equipment.supplier_id}-${equipment.supplier_name}-${optionsLoaded}`}
                        options={supplierList} 
                        onClick={handleSupplierChange} 
                        value={getSupplierDisplayValue(equipment.supplier_id)}
                        width="100%" 
                        placeholder="Select supplier"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-10 border border-gray-300 rounded-md bg-gray-50">
                        <span className="text-gray-500 text-sm">Loading suppliers...</span>
                      </div>
                    )}
                  </div>

                  <TextField 
                    label="Supplier Contact Number" 
                    value={equipment.supplier_contact_number}
                    onChange={(value) => onChange(value, 'supplier_contact_number')} 
                    disabled={true}
                    placeholder="Auto-filled from supplier"
                  />
                </div>
              </div>

              {/* Purchase & Warranty Information Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Purchase & Warranty Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DateComponent 
                    label="Purchase Date"
                    value={equipment.purchase_date} 
                    onChange={(value) => onChange(value, 'purchase_date')} 
                    placeholder="Select purchase date" 
                  />

                  <DateComponent 
                    label="Warranty Expires"
                    value={equipment.warranty_period} 
                    onChange={(value) => onChange(value, 'warranty_period')} 
                    placeholder="Select warranty expiry date" 
                  />
                </div>
              </div>

              {/* Service Information Section */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Information</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DateComponent 
                    label="Last Service Date"
                    value={equipment.last_service_date} 
                    onChange={(value) => onChange(value, 'last_service_date')} 
                    placeholder="Select last service date" 
                  />

                  <DateComponent 
                    label="Next Service Date"
                    value={equipment.next_service_date} 
                    placeholder="Auto-calculated" 
                    disabled={true} 
                  />
                </div>
                {equipment.last_service_date && (
                  <div className="mt-2 text-sm text-gray-600">
                    <p>Next service date is automatically calculated as 12 months from the last service date.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column - Equipment Image & Quick Info */}
            <div className="lg:col-span-1 space-y-6">
              {/* Equipment Image */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Equipment Image</h3>
                <div className="flex justify-center">
                  <div className="rounded-lg w-full h-64 relative group border-2 border-dashed border-gray-300 bg-gray-50">
                    {imageUploading ? (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <Spinner />
                        <span className="mt-2 text-sm">Uploading image...</span>
                      </div>
                    ) : (
                      <>
                        <div 
                          className="absolute top-2 right-2 cursor-pointer z-20 bg-black/60 text-white rounded-full p-2 invisible group-hover:visible transition-all" 
                          onClick={() => imageRef.current.click()}
                          title="Change image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                          </svg>
                        </div>
                        {equipment.url || equipment.image_filename ? (
                          <img 
                            className="w-full h-full object-cover rounded-lg" 
                            alt="Equipment Photo" 
                            src={equipment.url || `/equipments/${equipment.image_filename}`} 
                            onError={handleImageError} 
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center mb-2">
                              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-8 h-8">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                              </svg>
                            </div>
                            <div className="text-sm text-center">
                              <p>No image uploaded</p>
                              <p className="text-xs mt-1">Click to upload</p>
                            </div>
                          </div>
                        )}
                        <input 
                          ref={imageRef} 
                          type="file" 
                          className="hidden" 
                          onChange={updatePhoto} 
                          accept="image/*" 
                        />
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Quick Info Panel */}
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Info</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Current Status</label>
                    <div className="flex items-center space-x-2">
                      <StatusBadge 
                        type={getStatusBadgeType(equipment.status || 'active')} 
                        label={getStatusLabel(equipment.status || 'active')}
                      />
                    </div>
                  </div>
                  
                  {equipment.category_name && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Category</label>
                      <p className="text-gray-900 text-sm mt-1">{equipment.category_name}</p>
                    </div>
                  )}

                  {equipment.next_service_date && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Next Service Due</label>
                      <p className="text-gray-900 text-sm mt-1">
                        {moment(equipment.next_service_date).format('MMM DD, YYYY')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}