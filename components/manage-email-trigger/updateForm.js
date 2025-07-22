import React, { useEffect } from "react";

import dynamic from 'next/dynamic';
const Input = dynamic(() => import('../ui/input'));

export function EmailTriggerUpdateForm({ selectedData, closeModal, saveData }) {
    const [editMode, setEditMode] = React.useState(false);
    const [formState, setFormState] = React.useState(selectedData);

    const handleCancel = () => {
        setEditMode(false);
        closeModal && closeModal();
    }

    return (
        <div className="fixed inset-0 bg-black/30 z-50" onClick={closeModal}>
            <div className="flex items-center justify-center h-screen">
                <div className="w-96 max-w-full h-auto bg-white drop-shadow-md  rounded-lg flex flex-col justify-center" onClick={(e) => e.stopPropagation()}>
                    <div className="py-10 px-8">
                        <div>
                            <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Email'} onChange={(e) => setFormState({ ...formState, recipient: e.target.value })} value={formState.recipient} name={'recipient'} />
                        </div>
                    </div>
                    <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                            <button className="py-2.5 px-3" onClick={handleCancel}>Cancel</button>
                            <button className={'bg-sky-800 py-2.5 px-3 rounded text-white font-bold'} onClick={() => { saveData(formState) }}>Update</button>
                    </div>
                </div>
            </div>
        </div>
    )
}