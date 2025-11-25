import { useState } from "react";
import Input from "./../../ui/input";
import { toast } from "react-toastify";
import _ from "lodash";

export function UpdateForm({ selectedCategory, closeModal, refreshCategories }) {
    const [formState, setFormState] = useState({ 
        name: selectedCategory.name || '',
        order: selectedCategory.order ?? '' // Use nullish coalescing instead of ||
    });

    const updateCategory = async () => {
        const response = await fetch('/api/equipments/categories/' + selectedCategory.id, {
            method: 'POST',
            body: JSON.stringify({ 
                ...formState, 
                name: _.lowerCase(formState.name.trim()).split(' ').join('_'),
                order: formState.order === '' ? 0 : parseInt(formState.order)
            }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong!');
        } else {
            toast.success("Successfully updated.");
        }

        closeModal();
        refreshCategories();
    }

    return (
        <div className={`flex h-3/4 justify-center items-center`}>
            <div className="w-96 max-w-full h-auto bg-white drop-shadow-md rounded-lg flex flex-col justify-center">
                <div className="py-10 px-8 space-y-4">
                    <Input 
                        label="Category Name" 
                        onChange={(e) => setFormState({ ...formState, name: e.target.value })} 
                        value={formState.name} 
                        name="name" 
                    />
                    <Input 
                        label="Display Order" 
                        type="number"
                        onChange={(e) => setFormState({ ...formState, order: e.target.value })} 
                        value={formState.order} 
                        name="order"
                        placeholder="Please Input Display Order"
                        min="0"
                    />
                </div>
                <div className={'flex justify-end space-x-3 mb-6 mr-8'}>
                    <button className="py-2.5 px-3" onClick={() => closeModal()}>Cancel</button>
                    <button 
                        className={'bg-sky-800 py-2.5 px-3 rounded text-white font-bold'} 
                        onClick={() => updateCategory()}
                    >
                        Update
                    </button>
                </div>
            </div>
        </div>
    )
}