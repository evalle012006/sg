import React, { useEffect } from "react";

import dynamic from 'next/dynamic';
const Input = dynamic(() => import('../ui/input'));

export function SupplierUpdateForm({ selectedData, closeModal, saveData, deleteData }) {
    const [editMode, setEditMode] = React.useState(false);
    const [formState, setFormState] = React.useState(selectedData);

    return (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={closeModal}>
            <div className="flex items-center justify-center h-screen">
                <div className="w-96 max-w-full h-auto bg-white drop-shadow-md  rounded-lg flex flex-col justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="py-10 px-8">
                        <div>
                            <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Name'} onChange={(e) => setFormState({ ...formState, name: e.target.value })} value={formState.name} name={'name'} />
                            <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Phone Number'} onChange={(e) => setFormState({ ...formState, phone_number: e.target.value })} value={formState.phone_number} name={'phone_number'} />
                        </div>
                    </div>
                    <div>
                        {editMode ? <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                            <button className="py-2.5 px-3" onClick={() => setEditMode(false)}>Cancel</button>
                            <button className={'bg-sky-800 py-2.5 px-3 rounded text-white font-bold'} onClick={() => { saveData(formState) }}>Update</button>
                        </div> :
                            <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                                <button className={'py-2.5 px-3 rounded text-red-700'} onClick={(e) => deleteData(e, selectedData)}>Delete</button>
                                <button className="py-2.5 px-3 bg-slate-100 font-bold rounded-md" onClick={() => closeModal()}>Close</button>
                            </div>}
                    </div>
                </div>
            </div>
        </div>
    )
}