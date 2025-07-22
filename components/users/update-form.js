import React, { useEffect } from "react";
import Image from "next/image";

import dynamic from 'next/dynamic';
const Input = dynamic(() => import('../ui/input'));

export function UpdateForm({ selectedData, closeModal, fetchUsers }) {

    const [formState, setFormState] = React.useState(selectedData);
    const [editMode, setEditMode] = React.useState(false);
    const [roles, setRoles] = React.useState([{ name: 'Select' }]);

    useEffect(() => {
        fetchUserRoles();

    }, []);

    useEffect(() => {
        setFormState({ ...selectedData, role: selectedData.Roles && selectedData.Roles.length > 0 ? selectedData.Roles[0].name : 'Select' });
    }, [selectedData]);

    const fetchUserRoles = async () => {
        const response = await fetch('/api/users/user-roles');
        const data = await response.json();
        setRoles([...roles, ...data]);
    }

    const updateUserData = async () => {

        const response = await fetch('/api/users/' + formState.uuid, {
            method: 'POST',
            body: JSON.stringify(formState),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        // TODO - update this function to confirm deletion using a modal

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong!');
        }

        closeModal();
        fetchUsers();
    }

    const deleteUserData = async () => {
        const response = await fetch('/api/users/' + formState.uuid, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        closeModal();
        fetchUsers();
    }

    const handleProfileError = (e) => {
        e.target.onError = null;
        e.target.src = "/profile-placeholder.png";
    }

    const Dropdown = ({ options, onChange }) => {
        return (<>
            <label className="block text-slate-700 text-sm font-medium ml-1 mb-2 flex justify-between">Role</label>
            <select className="py-3 px-4 block w-full border-2 border-gray-200 rounded-md text-sm focus:outline-blue-300 focus:ring-blue-100 shadow-sm mb-2"
                onChange={onChange}
                value={formState.role}>
                {options.map((option, index) => (
                    <option key={index} value={option.name}>
                        {option.name}
                    </option>
                ))}
            </select>
        </>
        );
    }

    return (
        <div className={`flex h-3/4 justify-center items-center`}>
            <div className="w-96 max-w-full h-auto bg-white drop-shadow-md  rounded-lg flex flex-col justify-center">
                <div className="py-10 px-8">
                    <span className="text-lg font-bold">Edit User Details</span>
                    <div className="flex justify-center mt-4">
                        <div className="rounded-full w-28 h-28 relative">
                            <Image className="rounded-full" alt="User profile image" src={selectedData.profileUrl} onError={handleProfileError} layout="fill" objectFit="cover" />
                        </div>
                    </div>
                    <div>
                        <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'First name'} onChange={(e) => setFormState({ ...formState, first_name: e.target.value })} value={formState.first_name} name={'firstname'} />
                        <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Last name'} onChange={(e) => setFormState({ ...formState, last_name: e.target.value })} value={formState.last_name} name={'lastname'} />
                        <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Email'} onChange={(e) => setFormState({ ...formState, email: e.target.value })} value={formState.email} name={'email'} status={<span className={`${selectedData.email_verified ? "text-green-600" : "text-red-600"}`}>{selectedData.email_verified ? 'Verified' : 'Unverified'}</span>} />
                        <Dropdown options={roles} onChange={(e) => {
                            setFormState({ ...formState, role: e.target.value });
                            setEditMode(true)
                        }} />
                        <Input inputClass={'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label={'Position'} name={'position'} />
                    </div>
                </div>
                <div>
                    {editMode ? <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                        <button className="py-2.5 px-3" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className={'bg-sky-800 py-2.5 px-3 rounded text-white font-bold'} onClick={() => {
                            updateUserData(formState);
                            setEditMode(false)
                        }}>Update</button>
                    </div> :
                        <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                            <button className={'py-2.5 px-3 rounded text-red-700'} onClick={() => deleteUserData()}>Delete</button>
                            <button className="py-2.5 px-3 bg-slate-100 font-bold rounded-md" onClick={() => closeModal()}>Close</button>
                        </div>}
                </div>
            </div>
        </div>
    )
}