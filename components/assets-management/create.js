import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import Input from "../ui/input";
import DateInputField from "../ui/date";
import Image from "next/image";
import SelectComponent from "../ui/select";
import { useSelector } from "react-redux";
import { checkFileSize } from "../../utilities/common";
import { toast } from 'react-toastify';

function CreateEquiment(props, ref) {
    const supplierList = useSelector(state => state.supplier.list);
    const [showModal, setShowModal] = useState(false);
    const [equipment, setEquipment] = useState({
        name: '',
        category_name: '',
        serial_number: '',
        purchase_date: '',
        warranty_period: '',
        category_id: '',
        type: 'independent'
    });
    const [selectedAssetType, setSelectedAssetType] = useState();

    const [errors, setErrors] = useState({
        name: '',
        category_name: '',
        purchase_date: '',
        warranty_period: ''
    });

    const imageRef = useRef(null);
    useImperativeHandle(ref, () => ({

        openModal() {
            setShowModal(true);
        }
    }));

    const validateForm = () => {
        let isValid = true;
        const newErrors = {
            name: '',
            category_name: '',
            purchase_date: '',
            warranty_period: ''
        };
    
        // Asset Name validation
        if (!equipment.name.trim()) {
            newErrors.name = 'Asset Name is required';
            isValid = false;
        }
    
        // Asset Category validation
        if (!equipment.category_name) {
            newErrors.category_name = 'Asset Category is required';
            isValid = false;
        }
    
        // Purchase Date validation
        if (!equipment.purchase_date) {
            newErrors.purchase_date = 'Purchase Date is required';
            isValid = false;
        }
    
        // Warranty Period validation
        if (!equipment.warranty_period) {
            newErrors.warranty_period = 'Warranty Period is required';
            isValid = false;
        }
    
        setErrors(newErrors);
        return isValid;
    };

    const handleImageError = (e) => {
        e.target.onError = null;
        e.target.src = "/no-image-placeholder.png";
      }

    const updatePhotoPreview = (e) => {
        const file = e.target.files[0];
        if (file) {
            const fileSizeMsg = checkFileSize(file.size, 51200000);
            if (fileSizeMsg) {
                toast.error(fileSizeMsg);
            } else {
                const objectUrl = URL.createObjectURL(file);
                setEquipment({ ...equipment, url: objectUrl });
            }
        }
    }

    const createEquiment = async () => {
        if (!validateForm()) {
            toast.error('Please fill in all required fields');
            return;
        }
    
        const response = await fetch('/api/equipments/add-update', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(equipment)
        });
    
        const data = await response.json();
        if (data.success) {
            setErrors({
                name: '',
                category_name: '',
                purchase_date: '',
                warranty_period: ''
            });
            // upload the image
            const file = imageRef.current.files[0];
            const equipmentId = data.equipment.id;

            if (file && equipmentId) {
                const formData = new FormData();
                formData.append('file', file);
                formData.append('fileType', 'equipment-photo');
                formData.append('equipmentId', equipmentId);

                const response = await fetch('/api/storage/equipment-photo', {
                    method: 'POST',
                    body: formData
                });

                const data = await response.json();
                console.log('image uploaded successfully');
            }

            setShowModal(false);
            console.log(data.equipment, 'equipment added successfully');
            setEquipment({
                name: '',
                category_name: '',
                serial_number: '',
                purchase_date: '',
                warranty_period: '',
            });

            props.onSuccess();
        }
    }

    const onChange = (value, key) => {
        if (value) {
            setErrors(prev => ({
                ...prev,
                [key]: ''
            }));
        }
    
        if (key === "category_name") {
            const selectedValue = value;
            setEquipment({ ...equipment, [key]: selectedValue.value, category_id: value.id });
        } else if (key === "type") {
            setEquipment({ ...equipment, [key]: value.value });
        } else {
            setEquipment({ ...equipment, [key]: value });
        }
    }

    const handleSupplierChange = (selected) => {
        setEquipment({...equipment, supplier_name: selected.value, supplier_id: selected.id, supplier_contact_number: selected.phone_number})
    }

    const closeModal = () => {
        setShowModal(false);
        setErrors({
            name: '',
            category_name: '',
            purchase_date: '',
            warranty_period: ''
        });
        setEquipment({
            name: '',
            category_name: '',
            serial_number: '',
            purchase_date: '',
            warranty_period: '',
            category_id: '',
            type: 'independent'
        });
    }

    return (showModal && <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowModal(false)}>
        <div className="flex items-center justify-center h-screen">
            <div className="bg-white rounded-xl shadow-lg p-4 min-w-[30%]" onClick={(e) => e.stopPropagation()}>
                <div className="text-center px-8 py-2">
                    <div>
                        <div className="flex flex-col p-2">
                            <div className="flex justify-center">
                                <div className="rounded-full w-36 h-36 relative group">
                                    <>
                                        <div className="right-0 text-xs cursor-pointer absolute z-20 bg-black/20 text-white rounded-3xl p-2 invisible group-hover:visible" onClick={() => imageRef.current.click()}>
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                            </svg>
                                        </div>
                                        <div className="w-40 mx-auto h-40 relative">
                                            <Image className="rounded-full" alt="Equipment Photo" src={equipment.url ? equipment.url : ''} onError={handleImageError} placeholder="empty" blurDataURL="/no-image-placeholder.png" layout="fill" objectFit="cover"/>
                                        </div>
                                        <input ref={imageRef} type="file" className="hidden" onChange={updatePhotoPreview} />
                                    </>
                                </div>
                            </div>
                            <div className="flex flex-col mt-2">
                                <Input 
                                    label={'Asset Name'} 
                                    onChange={(e) => onChange(e.target.value, 'name')} 
                                    value={equipment.name}
                                    error={errors.name ? errors.name : null}
                                    required
                                />
                                
                                <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 text-left`}>
                                    Asset Category <span className="text-red-500">*</span>
                                </label>
                                <SelectComponent 
                                    options={props.assetCategories} 
                                    onChange={(e) => {
                                        onChange(e, 'category_name');
                                        if (e?.value) {
                                            setErrors(prev => ({
                                                ...prev,
                                                category_name: ''
                                            }));
                                        }
                                    }} 
                                    value={equipment.category_name}
                                    error={errors.category_name}
                                />
                                {errors.category_name && (
                                    <span className="text-red-500 text-sm text-left -mt-6 mb-2">{errors.category_name}</span>
                                )}
                                
                                <Input 
                                    label={'Serial Number'} 
                                    onChange={(e) => onChange(e.target.value, 'serial_number')} 
                                    value={equipment.serial_number} 
                                />
                                
                                <DateInputField 
                                    value={equipment.purchase_date} 
                                    width='100%' 
                                    label={'Purchase Date'} 
                                    placeholder={'Please Input Purchase Date'} 
                                    onChange={(e) => {
                                        onChange(e, 'purchase_date');
                                        if (e) {
                                            setErrors(prev => ({
                                                ...prev,
                                                purchase_date: ''
                                            }));
                                        }
                                    }}
                                    error={errors.purchase_date}
                                    required
                                />
                                {errors.purchase_date && (
                                    <span className="text-red-500 text-sm text-left -mt-4 mb-2">{errors.purchase_date}</span>
                                )}

                                <DateInputField 
                                    value={equipment.warranty_period} 
                                    width='100%' 
                                    label={'Warranty Period'} 
                                    placeholder={'Please Input Warranty Period'} 
                                    onChange={(e) => {
                                        onChange(e, 'warranty_period');
                                        if (e) {
                                            setErrors(prev => ({
                                                ...prev,
                                                warranty_period: ''
                                            }));
                                        }
                                    }}
                                    error={errors.warranty_period}
                                    required
                                />
                                {errors.warranty_period && (
                                    <span className="text-red-500 text-sm text-left -mt-4 mb-2">{errors.warranty_period}</span>
                                )}

                                <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>
                                    Supplier
                                </label>
                                <SelectComponent
                                    options={supplierList} 
                                    onChange={handleSupplierChange} 
                                    value={equipment.supplier_name} 
                                    width='100%' 
                                />
                            </div>
                            {/* <div className="flex flex-col mt-2">
                                <Input label={'Asset Name'} onChange={(e) => onChange(e.target.value, 'name')} value={equipment.name} />
                                <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Asset Category</label>
                                <SelectComponent options={props.assetCategories} onChange={(e) => onChange(e, 'category_name')} value={equipment.category_name} />
                                <Input label={'Serial Number'} onChange={(e) => onChange(e.target.value, 'serial_number')} value={equipment.serial_number} />
                                <DateInputField value={equipment.purchase_date} width='100%' label={'Purchase Date'} placeholder={'Please Input Purchase Date'} onChange={(e) => onChange(e, 'purchase_date')} />
                                <DateInputField value={equipment.warranty_period} width='100%' label={'Warranty Period'} placeholder={'Please Input Warranty Period'} onChange={(e) => onChange(e, 'warranty_period')} />
                                <label className={`block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between`}>Supplier</label>
                                <SelectComponent options={supplierList} onChange={handleSupplierChange} value={equipment.supplier_name} width='100%' />
                            </div> */}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-4 mt-10">
                        <>
                            <button className="font-semibold text-neutral-500" onClick={closeModal}>
                                Cancel
                            </button>
                            <button className="font-semibold text-white rounded py-2 px-4 bg-sargood-blue" onClick={createEquiment}>
                                Add Equipment
                            </button>
                        </>
                    </div>
                </div>
            </div>
        </div>
    </div >)
}

export default forwardRef(CreateEquiment);