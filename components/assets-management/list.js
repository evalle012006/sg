import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import Image from "next/image";
import { toast } from "react-toastify";
import { useDispatch, useSelector } from "react-redux";
import { assetListActions } from "../../store/assetsSlice";
import moment from "moment";
import { UppercaseFirstLetter, checkFileSize, omitAttribute } from "../../utilities/common";
import CreateEquipment from './create';

import dynamic from 'next/dynamic';
import { assetCategoriesActions } from "../../store/assetCategoriesSlice";
import { Can } from "../../services/acl/can";
import { 
  Calendar, 
  Edit, 
  Trash2,
  Plus
} from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const SelectComponent = dynamic(() => import('../ui-v2/Select'));
const DateInputField = dynamic(() => import('../ui/date'));
const Input = dynamic(() => import('../ui/input'));
const AssetAvailability = dynamic(() => import('./asset-availability'));

function AssetEquipmentList() {
  const router = useRouter();
  const dispatch = useDispatch();
  const list = useSelector(state => state.assets.list);
  const supplierList = useSelector(state => state.supplier.list);
  const [data, setData] = useState([]);
  const [mode, setMode] = useState();
  const [showModal, setShowModal] = useState(false);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [equipment, setEquipment] = useState();
  const [imageUploading, setImageUploading] = useState(false);
  const imageRef = useRef();
  const createEquimentRef = useRef();
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

  const onClickAvailability = async (selected) => {
    const url = await getUrl(selected.image_filename);
    const selectedEq = { ...selected, url: url };
    dispatch(assetListActions.setData(selectedEq));
    setShowAvailabilityModal(true);
  }

  const onClickEdit = async (selected) => {
    if (selected) {
      let selectedEq = { ...selected };
      if (selected.image_filename && !selected.image_filename.includes("default-")) {
        const url = await getUrl(selected.image_filename);
        selectedEq.url = url;
      }

      dispatch(assetListActions.setData(selectedEq));
      setEquipment(selectedEq);
      setMode('edit');
      setShowModal(true);
    }
  }

  const onClickDelete = (selected) => {
    setEquipment(selected);
    setMode('delete');
    setShowModal(true);
  }

  // Status Change Handler
  const handleStatusChange = (selected) => {
    console.log("Selected status:", selected);
    setEquipment({ 
      ...equipment, 
      status: selected.value,
      assetStatus: selected.value
    });
  }

  // Category Change Handler
  const handleCategoryChange = (selected) => {
    console.log("Selected category:", selected);
    setEquipment({ 
      ...equipment, 
      category_name: selected.value, 
      category_id: selected.id,
      EquipmentCategory: {
        id: selected.id,
        name: selected.name || selected.value.toLowerCase().replaceAll(" ", "_")
      }
    });
  }

  // Supplier Change Handler
  const handleSupplierChange = (selected) => {
    console.log("Selected supplier:", selected);
    setEquipment({ 
      ...equipment, 
      supplier_name: selected.value, 
      supplier_id: selected.id, 
      supplier_contact_number: selected.phone_number,
      Supplier: {
        id: selected.id,
        name: selected.value,
        phone_number: selected.phone_number
      }
    });
  }

  const handleTypeChange = (selected) => {
    console.log("Selected type:", selected);
    setEquipment({ 
      ...equipment, 
      type: selected.value
    });
  }

  const onChange = (value, field) => {
    console.log(`Changing ${field} to:`, value);
    let selected = { ...equipment };
    selected[field] = value;

    if (field === 'last_service_date') {
      const nextServiceDate = moment(value).add(12, 'month').format('YYYY-MM-DD');
      selected['next_service_date'] = nextServiceDate;
    }

    setEquipment(selected);
  }

  const handleUpdate = async () => {
    const response = await fetch('/api/equipments/add-update', {
      method: 'POST',
      body: JSON.stringify(omitAttribute(equipment, 'image_filename')),
      headers: {
        'Content-Type': 'application/json'
      }
    });
  
    if (response.ok) {
      const data = await response.json();
      
      if (data.equipment) {
        setEquipment({ ...equipment, ...data.equipment });
      }
      
      setShowModal(false);
      fetchData();
      toast.success("Successfully updated.");
    } else {
      toast.error("Failed to update. Please try again.");
    }
  }

  const handleDelete = async () => {
    const response = await fetch(`/api/equipments/delete?id=${equipment.id}`, {
      method: "DELETE",
    });

    const data = await response.json();

    if (response.status === 200) {
      setShowModal(false);
      fetchData();
      toast("Equpment deleted sucessfully.", { type: 'success' });
    }
    else if (response.status === 400) {
      toast(data.message, { type: 'error' })
    }
    else toast("Sorry, something went wrong. Please try again.", { type: 'error' });

  }

  const handleImageError = (e) => {
    e.target.onError = null;
    e.target.src = "/no-image-placeholder.png";
  }

  const updatePhoto = async (e) => {
    setImageUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();

    const fileSizeMsg = checkFileSize(file.size, 51200000);
    if (fileSizeMsg) {
      toast.error(fileSizeMsg);
    } else {
      formData.append("fileType", "equipment-photo");
      formData.append("equipmentId", equipment.id);
      formData.append("file", file);

      const response = await fetch("/api/storage/equipment-photo", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      onChange(data.url, 'url');
      setImageUploading(false);
    }
  }

  // Updated columns to match BookingTemplateList pattern
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
        <span className="text-gray-600">{value}</span>
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
          
          <Can I="Create/Edit" an="Equipment">
            <button 
              title="Edit" 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
              onClick={(e) => {
                e.stopPropagation();
                onClickEdit(row);
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
                onClickDelete(row);
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

    mounted && fetchData() && fetchCategories() && getAssetStatus();

    return (() => {
      mounted = false;
    });
  }, []);

  const openCreateModal = () => {
    createEquimentRef.current.openModal();
  }

  useEffect(() => {
    setData(list);
  }, [list]);

  return (
    <div className="rounded-md mt-2">
      <div className="">
        {/* Add Equipment Button - using new Button component */}
        <div className="flex justify-end mb-6">
          <Can I="Create/Edit" a="Equipment">
            <Button
              color="secondary"
              size="medium"
              label="Add Equipment"
              onClick={openCreateModal}
              withIcon={true}
              iconName="custom"
              iconSvg={<Plus />}
            />
          </Can>
        </div>

        {/* Table - using new Table component */}
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
                    onClick={openCreateModal}
                    withIcon={true}
                    iconName="custom"
                    iconSvg={<Plus />}
                  />
                </div>
              </Can>
            </div>
          </div>
        )}

        {/* Edit/Delete Modal */}
        {showModal &&
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowModal(false)}>
            <div className="flex items-center justify-center h-screen">
              <div className="bg-white rounded-xl shadow-lg p-4 min-w-[30%] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="text-center px-8 py-2 overflow-auto h-[50rem]">
                  <div>
                    <div className="flex flex-col p-2">
                      <div className="flex justify-center">
                        <div className="rounded-full w-52 h-52 relative group">
                          {imageUploading ? (
                            <div className="flex justify-center mt-4 text-zinc-500">
                              Uploading image...
                            </div>
                          ) : (
                            <React.Fragment>
                              <div className="right-0 text-xs cursor-pointer absolute z-20 bg-black/20 text-white rounded-3xl p-2 invisible group-hover:visible" onClick={() => imageRef.current.click()}>
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                </svg>
                              </div>
                              <Image className="rounded-full" alt="Equipment Photo" src={equipment.url ? equipment.url : equipment.image_filename ? `/equipments/${equipment.image_filename}` : '/no-image-placeholder.png'} onError={handleImageError} layout="fill" objectFit="cover" />
                              <input ref={imageRef} type="file" className="hidden" onChange={updatePhoto} />
                            </React.Fragment>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col mt-2">
                        <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Status</label>
                        <SelectComponent disabled={mode !== 'edit'} options={assetStatuses} onChange={handleStatusChange} value={equipment.status} width='100%' />
                        <Input inputClass={mode === 'edit' ? '' : 'text-gray-500 bg-gray-100'} disabled={mode !== 'edit'} label={'Asset Name'} onChange={(e) => onChange(e.target.value, 'name')} value={equipment.name} />
                        <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Asset Category</label>
                        <SelectComponent disabled={mode !== 'edit'} options={assetCategories} onChange={handleCategoryChange} value={equipment.category_name} width='100%' />
                        <Input inputClass={mode === 'edit' ? '' : 'text-gray-500 bg-gray-100'} disabled={mode !== 'edit'} label={'Serial Number'} onChange={(e) => onChange(e.target.value, 'serial_number')} value={equipment.serial_number} />
                        <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Supplier</label>
                        <SelectComponent disabled={mode !== 'edit'} options={supplierList} onChange={handleSupplierChange} value={equipment.supplier_name} width='100%' />
                        <Input inputClass={mode === 'edit' ? '' : 'text-gray-500 bg-gray-100'} disabled={true} label={'Supplier Contact Number'} onChange={(e) => onChange(e.target.value, 'supplier_contact_number')} value={equipment.supplier_contact_number} />
                        <DateInputField value={equipment.purchase_date} width='100%' label={'Purchase Date'} placeholder={'Please Input Purchase Date'} disabled={mode !== 'edit'} onChange={(e) => onChange(e, 'purchase_date')} />
                        <DateInputField value={equipment.warranty_period} width='100%' label={'Warranty Period'} placeholder={'Please Input Warranty Period'} disabled={mode !== 'edit'} onChange={(e) => onChange(e, 'warranty_period')} />
                        <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Asset Type</label>
                        <SelectComponent disabled={mode !== 'edit'} options={[{ label: 'Independent', value: 'independent' }, { label: 'Group', value: 'group' }]} onChange={handleTypeChange} value={equipment.type} />
                        <DateInputField value={equipment.last_service_date} width='100%' label={'Last Service Date'} placeholder={'Please Input Last Service Date'} disabled={mode !== 'edit'} onChange={(e) => onChange(e, 'last_service_date')} />
                        <DateInputField value={equipment.next_service_date} width='100%' label={'Next Service Date'} placeholder={''} disabled={true} />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end space-x-4 mt-10">
                    {mode === 'edit' ? (
                      <React.Fragment>
                        <button className="font-semibold text-neutral-500" onClick={() => setShowModal(false)}>
                          Cancel
                        </button>
                        <button className="font-semibold text-white rounded py-2 px-4 bg-sargood-blue" onClick={handleUpdate}>
                          Update
                        </button>
                      </React.Fragment>
                    ) : (
                      <React.Fragment>
                        <button className="font-semibold text-red-600" onClick={handleDelete}>
                          Delete
                        </button>
                        <button className="font-semibold bg-zinc-100 rounded py-2 px-4" onClick={() => setShowModal(false)}>
                          Close
                        </button>
                      </React.Fragment>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>}
        {showAvailabilityModal && <AssetAvailability setShowModal={setShowAvailabilityModal} />}
        <CreateEquipment ref={createEquimentRef} assetCategories={assetCategories} onSuccess={() => fetchData()} />
      </div>
    </div>
  );
}

export default AssetEquipmentList;