import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { assetListActions } from "../../store/assetsSlice";
import moment from "moment";
import { UppercaseFirstLetter, checkFileSize, omitAttribute } from "../../utilities/common";

import dynamic from 'next/dynamic';
import { assetCategoriesActions } from "../../store/assetCategoriesSlice";
import { Can } from "../../services/acl/can";
import { 
  Calendar, 
  Edit, 
  Trash2,
  Plus,
  Eye
} from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const Spinner = dynamic(() => import('../ui/spinner'));
const AssetAvailability = dynamic(() => import('./asset-availability'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const AssetEquipmentForm = dynamic(() => import('./AssetEquipmentForm')); // New component

function AssetEquipmentList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { mode, id } = router.query;
  
  // Determine current view mode
  const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
  
  const list = useSelector(state => state.assets.list);
  const supplierList = useSelector(state => state.supplier.list);
  
  const [data, setData] = useState([]);
  const [isListLoading, setIsListLoading] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState(null);
  const [assetStatuses, setAssetStatuses] = useState([]);
  const assetCategories = useSelector(state => state.assetCategories.list);

  const getUrl = async (image_filename) => {
    if (image_filename) {
      const response = await fetch("/api/equipments/get-equipment-url?image_filename=" + image_filename, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => res.json());

      return await response.url;
    }

    return null;
  }

  // Navigation functions (following Courses pattern)
  const showList = () => {
    router.push('/assets-management', undefined, { shallow: true });
  };

  const showAddForm = () => {
    router.push('/assets-management?mode=add', undefined, { shallow: true });
  };

  const showEditForm = (equipment) => {
    router.push(`/assets-management?mode=edit&id=${equipment.id}`, undefined, { shallow: true });
  };

  const showViewForm = (equipment) => {
    router.push(`/assets-management?mode=view&id=${equipment.id}`, undefined, { shallow: true });
  };

  const onClickAvailability = async (selected) => {
    const url = await getUrl(selected.image_filename);
    const selectedEq = { ...selected, url: url };
    dispatch(assetListActions.setData(selectedEq));
    setShowAvailabilityModal(true);
  }

  const handleDeleteEquipment = (equipment) => {
    setSelectedEquipment(equipment);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (selectedEquipment) {
      setIsListLoading(true);
      try {
        const response = await fetch(`/api/equipments/delete?id=${selectedEquipment.id}`, {
          method: "DELETE",
        });

        const data = await response.json();

        if (response.status === 200) {
          setShowDeleteDialog(false);
          fetchData();
          toast("Equipment deleted successfully.", { type: 'success' });
        } else if (response.status === 400) {
          toast(data.message, { type: 'error' })
        } else {
          toast("Sorry, something went wrong. Please try again.", { type: 'error' });
        }
      } catch (error) {
        console.error('Error deleting equipment:', error);
        toast.error('Failed to delete equipment. Please try again later.');
      }
      setIsListLoading(false);
    }
    setShowDeleteDialog(false);
    setSelectedEquipment(null);
  };

  // Form callbacks (following Courses pattern)
  const handleFormCancel = () => {
    showList();
  };

  const handleFormSuccess = (result) => {
    if (result && result.action === 'edit' && result.id) {
      // Switch to edit mode for the same equipment
      showEditForm({ id: result.id });
    } else {
      // Return to list and refresh
      showList();
      fetchData();
    }
  };

  // Function to map asset status to badge type
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

  // Function to get display label for status
  const getStatusLabel = (status) => {
    const statusTrimmed = (status || '').trim();
    return statusTrimmed || 'Archived';
  };

  // Updated columns following Courses pattern
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'ASSET',
      searchable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">{value}</span>
      )
    },
    {
      key: 'serial_number',
      label: 'SERIAL NUMBER',
      searchable: true,
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'category_name',
      label: 'ASSET CATEGORY',
      searchable: true,
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'status',
      label: 'STATUS',
      searchable: true,
      render: (value) => (
        <div className="flex items-center space-x-2">
          <StatusBadge 
            type={getStatusBadgeType(value)} 
            label={getStatusLabel(value)}
          />
        </div>
      )
    },
    {
      key: 'actions',
      label: 'ACTION',
      searchable: false,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <button 
            title="Check Availability" 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#06b6d41A', color: '#06b6d4' }}
            onClick={(e) => {
              e.stopPropagation();
              onClickAvailability(row);
            }}
          >
            <Calendar className="w-4 h-4" />
          </button>
          
          <Can I="View" an="Equipment">
            <button 
              title="View" 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#10b9811A', color: '#10b981' }}
              onClick={(e) => {
                e.stopPropagation();
                showViewForm(row);
              }}
            >
              <Eye className="w-4 h-4" />
            </button>
          </Can>
          
          <Can I="Create/Edit" an="Equipment">
            <button 
              title="Edit" 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
              onClick={(e) => {
                e.stopPropagation();
                showEditForm(row);
              }}
            >
              <Edit className="w-4 h-4" />
            </button>
          </Can>
          
          <Can I="Delete" an="Equipment">
            <button 
              title="Delete" 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#dc26261A', color: '#dc2626' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteEquipment(row);
              }}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </Can>
        </div>
      )
    }
  ], []);

  const fetchData = async () => {
    setIsListLoading(true);
    try {
      const response = await fetch("/api/equipments?" + new URLSearchParams({ includeHidden: false }));

      if (response.ok) {
        const responseData = await response.json();

        const updatedData = responseData.map(d => {
          const categoryName = UppercaseFirstLetter(d.EquipmentCategory.name.replaceAll("_", " "));
          const supplierName = d.Supplier?.name;
          const supplierPhoneNumber = d.Supplier?.phone_number;
          return { ...d, url: '', category_name: categoryName, supplier_name: supplierName, supplier_contact_number: supplierPhoneNumber, assetStatus: d.status };
        });

        dispatch(assetListActions.setList(updatedData));
        setData(updatedData);
      }
    } catch (error) {
      console.error('Error loading equipment:', error);
      toast.error('Failed to load equipment. Please try again later.');
    }
    setIsListLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    const fetchCategories = async () => {
      const response = await fetch("/api/equipments/categories", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const data = await response.json();
      let categoriesData = [];
      data.map(c => {
        const categoryName = UppercaseFirstLetter(c.name.replaceAll("_", " "));
        categoriesData.push({
          ...c,
          label: categoryName,
          value: categoryName,
          id: c.id
        });
      });
      dispatch(assetCategoriesActions.setList(categoriesData));
    }

    const getAssetStatus = async () => {
      const response = await fetch("/api/equipments/get-asset-status", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
  
      const data = await response.json();
      const statuses = [];

      data.assetStatus.map(status => {
        statuses.push(JSON.parse(status.value));
      });
      setAssetStatuses(statuses);
    }

    if (mounted) {
      // Always load categories and statuses, even in form mode
      fetchCategories();
      getAssetStatus();
      
      // Only fetch data if not in form mode
      if (!isFormMode) {
        fetchData();
      }
    }

    return (() => {
      mounted = false;
    });
  }, [isFormMode]);

  useEffect(() => {
    setData(list);
  }, [list]);

  if (isListLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="rounded-md mt-2">
      {/* LIST VIEW (when not in form mode) */}
      {!isFormMode && (
        <>
          <div className="flex justify-end mb-6">
            <Can I="Create/Edit" a="Equipment">
              <Button
                color="primary"
                size="medium"
                label="Add Equipment"
                onClick={showAddForm}
                withIcon={true}
                iconName="custom"
                iconSvg={<Plus />}
              />
            </Can>
          </div>

          {/* Table */}
          {data.length > 0 ? (
            <Table 
              data={data} 
              columns={columns}
              itemsPerPageOptions={[10, 15, 25, 50]}
              defaultItemsPerPage={15}
            />
          ) : (
            <div className="flex justify-center items-center h-96">
              <div className="text-center">
                <h1 className="text-2xl font-bold">No equipment found</h1>
                <p className="text-gray-500">Click on the button below to add new equipment.</p>
                <Can I="Create/Edit" a="Equipment">
                  <div className="mt-5">
                    <Button
                      color="secondary"
                      size="medium"
                      label="Add Equipment"
                      onClick={showAddForm}
                      withIcon={true}
                      iconName="custom"
                      iconSvg={<Plus />}
                    />
                  </div>
                </Can>
              </div>
            </div>
          )}

          {/* Delete Confirmation Dialog */}
          {showDeleteDialog && (
            <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center">
              <div className="bg-white rounded-xl shadow-lg p-6 max-w-md mx-4">
                <div className="text-center">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Delete Equipment
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Are you sure you want to delete "{selectedEquipment?.name}"? This action cannot be undone.
                  </p>
                  <div className="flex justify-end space-x-3">
                    <Button
                      color="outline"
                      size="medium"
                      label="Cancel"
                      onClick={() => {
                        setShowDeleteDialog(false);
                        setSelectedEquipment(null);
                      }}
                    />
                    <Button
                      color="secondary"
                      size="medium"
                      label="Delete"
                      onClick={confirmDelete}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Asset Availability Modal */}
          {showAvailabilityModal && <AssetAvailability setShowModal={setShowAvailabilityModal} />}
        </>
      )}

      {/* FORM VIEW (when in add/edit/view mode) */}
      {isFormMode && (
        <AssetEquipmentForm
          mode={mode}
          equipmentId={id}
          onCancel={handleFormCancel}
          onSuccess={handleFormSuccess}
          assetCategories={assetCategories}
          assetStatuses={assetStatuses}
          supplierList={supplierList}
        />
      )}
    </div>
  );
}

export default AssetEquipmentList;