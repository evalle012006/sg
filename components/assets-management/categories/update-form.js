import Input from "./../../ui/input";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
export function UpdateForm({ selectedCategory, closeModal, refreshCategories }) {

    const [formState, setFormState] = useState(selectedCategory);
    const [editMode, setEditMode] = useState(false);

    useEffect(() => {
        setFormState(selectedCategory);
    }, [selectedCategory]);

    useEffect(() => {
        const getAssetsCount = async () => {
            const response = await fetch('/api/equipments/categories/' + formState.id);
            const data = await response.json();

            if (response.ok) {
                setFormState(data);
            }
        }

        getAssetsCount();
    }, [formState.id]);


    const updateCategory = async () => {

        const response = await fetch('/api/equipments/categories/' + formState.id, {
            method: 'POST',
            body: JSON.stringify({ ...formState, name: _.lowerCase(formState.name.trim()).split(' ').join('_') }),
            headers: {
                'Content-Type': 'application/json'
            }
        });


        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong!');
        } else {
            toast.success("Succesfully updated.");
        }

        closeModal();
        refreshCategories();
    }

    const deleteCategory = async () => {
        const response = await fetch('/api/equipments/categories/' + formState.id, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            toast.success("Category removed.");
        }

        closeModal();
        refreshCategories();
    }

    return (
        <div className={`flex h-3/4 justify-center items-center`}>
            <div className="w-96 max-w-full h-auto bg-white drop-shadow-md  rounded-lg flex flex-col justify-center">
                <div className="py-10 px-8">
                    <Input inputClass={editMode ? '' : 'text-gray-500 bg-gray-100'} onFocus={() => setEditMode(true)} label="Category Name" onChange={(e) => setFormState({ ...formState, name: e.target.value })} value={formState.name} name="name" />
                </div>
                <div>
                    {editMode ? <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                        <button className="py-2.5 px-3" onClick={() => setEditMode(false)}>Cancel</button>
                        <button className={'bg-sky-800 py-2.5 px-3 rounded text-white font-bold'} onClick={() => {
                            updateCategory(formState);
                            setEditMode(false)
                        }}>Update</button>
                    </div> :
                        <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                            {formState.Equipment && formState.Equipment.length == 0 && <button className={'py-2.5 px-3 rounded text-red-700'} onClick={() => deleteCategory()}>Delete</button>}
                            <button className="py-2.5 px-3 bg-slate-100 font-bold rounded-md" onClick={() => closeModal()}>Close</button>
                        </div>}
                </div>
            </div>
        </div>
    )
}