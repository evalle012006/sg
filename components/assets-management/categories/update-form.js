import { useState } from "react";
import Input from "./../../ui/input";
import { toast } from "react-toastify";
import _ from "lodash";

const DISPLAY_TYPE_OPTIONS = [
    { value: 'binary',               label: 'Yes / No (single item)' },
    { value: 'single_select',        label: 'Single choice (pick one)' },
    { value: 'multi_select',         label: 'Multi choice (pick many)' },
    { value: 'confirmation_single',  label: 'Confirm then pick one' },
    { value: 'confirmation_multi',   label: 'Confirm then pick many' },
    { value: 'special',              label: 'Special (custom renderer)' },
];

export function UpdateForm({ selectedCategory, closeModal, refreshCategories }) {
    const [formState, setFormState] = useState({
        name:                 selectedCategory.name || '',
        order:                selectedCategory.order ?? '',
        display_type:         selectedCategory.display_type || 'binary',
        is_required:          selectedCategory.is_required ?? false,
        custom_label:         selectedCategory.custom_label || '',
    });

    const updateCategory = async () => {
        const response = await fetch('/api/equipments/categories/' + selectedCategory.id, {
            method: 'POST',
            body: JSON.stringify({
                ...formState,
                name:         _.lowerCase(formState.name.trim()).split(' ').join('_'),
                order:        formState.order === '' ? 0 : parseInt(formState.order),
                is_required:  formState.is_required,
                custom_label: formState.custom_label?.trim() || null,
                // requires_confirmation is derived from display_type — keep in sync
                requires_confirmation: ['confirmation_single', 'confirmation_multi'].includes(formState.display_type),
            }),
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Something went wrong!');
        } else {
            toast.success("Successfully updated.");
        }

        closeModal();
        refreshCategories();
    };

    return (
        <div className="flex h-3/4 justify-center items-center">
            <div className="w-[480px] max-w-full h-auto bg-white drop-shadow-md rounded-lg flex flex-col justify-center">
                <div className="py-8 px-8 space-y-4">
                    <h2 className="text-lg font-semibold text-gray-800 mb-2">Edit Category</h2>

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

                    {/* Display Type */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Display Type <span className="text-red-500">*</span>
                        </label>
                        <select
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formState.display_type}
                            onChange={(e) => setFormState({ ...formState, display_type: e.target.value })}
                        >
                            {DISPLAY_TYPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                        <p className="text-xs text-gray-500 mt-1">
                            Controls how this category renders in the booking equipment form.
                        </p>
                    </div>

                    {/* Is Required */}
                    <div className="flex items-center gap-3">
                        <input
                            id="is_required_edit"
                            type="checkbox"
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded"
                            checked={formState.is_required}
                            onChange={(e) => setFormState({ ...formState, is_required: e.target.checked })}
                        />
                        <label htmlFor="is_required_edit" className="text-sm font-medium text-gray-700">
                            Required — guest must make a selection
                        </label>
                    </div>

                    {/* Custom Label */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Custom Question Label
                            <span className="text-gray-400 font-normal ml-1">(optional)</span>
                        </label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder={`e.g. "Will you be using our ceiling hoist?"`}
                            value={formState.custom_label}
                            onChange={(e) => setFormState({ ...formState, custom_label: e.target.value })}
                        />
                        <p className="text-xs text-gray-500 mt-1">
                            Leave blank to auto-generate from the category name.
                        </p>
                    </div>
                </div>

                <div className="flex justify-end space-x-3 mb-6 mr-8">
                    <button className="py-2.5 px-3 text-gray-600 hover:text-gray-800" onClick={closeModal}>
                        Cancel
                    </button>
                    <button
                        className="bg-sky-800 py-2.5 px-4 rounded text-white font-bold hover:bg-sky-900 transition-colors"
                        onClick={updateCategory}
                    >
                        Update
                    </button>
                </div>
            </div>
        </div>
    );
}