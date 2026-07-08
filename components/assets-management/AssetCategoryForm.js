// components/assets-management/AssetCategoryForm.js

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-toastify';
import _ from 'lodash';
import { Home, AlertTriangle } from 'lucide-react';
import dynamic from 'next/dynamic';

const Button    = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));

const DISPLAY_TYPE_OPTIONS = [
    { value: 'binary',               label: 'Yes / No (single item)' },
    { value: 'single_select',        label: 'Single choice (pick one)' },
    { value: 'multi_select',         label: 'Multi choice (pick many)' },
    { value: 'confirmation_single',  label: 'Confirm then pick one' },
    { value: 'confirmation_multi',   label: 'Confirm then pick many' },
    { value: 'special',              label: 'Special (custom renderer)' },
];

const DEFAULT_FORM = {
    name:         '',
    order:        '',
    display_type: 'binary',
    is_required:  false,
    custom_label: '',
};

export default function AssetCategoryForm({ mode, categoryId, onCancel, onSuccess }) {
    const isAdd  = mode === 'add';
    const isEdit = mode === 'edit';

    const [form, setForm]             = useState(DEFAULT_FORM);
    const [isLoading, setIsLoading]   = useState(false);
    const [isSaving, setIsSaving]     = useState(false);
    // All other categories — used for order conflict detection and next-order calc
    const [allCategories, setAllCategories] = useState([]);
    // The category that conflicts with the currently entered order (if any)
    const [orderConflict, setOrderConflict] = useState(null);

    // ── Fetch all categories once on mount ───────────────────────────────────
    const fetchAllCategories = useCallback(async () => {
        try {
            const res = await fetch('/api/equipments/categories');
            if (res.ok) setAllCategories(await res.json());
        } catch {
            // Non-fatal — order features degrade gracefully
        }
    }, []);

    useEffect(() => { fetchAllCategories(); }, [fetchAllCategories]);

    // ── Prefill order for add mode once we have all categories ───────────────
    useEffect(() => {
        if (!isAdd || allCategories.length === 0) return;
        // Only set if the user hasn't already typed a value
        if (form.order !== '') return;
        const maxOrder = Math.max(...allCategories.map(c => c.order ?? 0));
        setForm(prev => ({ ...prev, order: maxOrder + 1 }));
    }, [isAdd, allCategories]);

    // ── Load existing category for edit ──────────────────────────────────────
    useEffect(() => {
        if (!isEdit || !categoryId) return;
        (async () => {
            setIsLoading(true);
            try {
                const res = await fetch(`/api/equipments/categories/${categoryId}`);
                if (!res.ok) { toast.error('Failed to load category.'); onCancel?.(); return; }
                const data = await res.json();
                setForm({
                    name:         _.startCase(data.name?.replaceAll('_', ' ')) || '',
                    order:        data.order ?? 0,
                    display_type: data.display_type || 'binary',
                    is_required:  data.is_required ?? false,
                    custom_label: data.custom_label || '',
                });
            } catch {
                toast.error('Failed to load category.');
                onCancel?.();
            }
            setIsLoading(false);
        })();
    }, [isEdit, categoryId]);

    // ── Order conflict detection — runs whenever order or allCategories changes
    useEffect(() => {
        const parsedOrder = parseInt(form.order);
        if (isNaN(parsedOrder) || form.order === '') {
            setOrderConflict(null);
            return;
        }
        // Find another category (not the one being edited) with the same order
        const conflict = allCategories.find(c => {
            if (isEdit && c.id === categoryId) return false; // skip self
            return (c.order ?? 0) === parsedOrder;
        });
        setOrderConflict(conflict ?? null);
    }, [form.order, allCategories, isEdit, categoryId]);

    // ── Save ─────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!form.name?.trim()) {
            toast.error('Category name is required.');
            return;
        }
        if (form.order === '' || isNaN(parseInt(form.order))) {
            toast.error('Display order is required.');
            return;
        }

        setIsSaving(true);
        try {
            const payload = {
                name:                  _.lowerCase(form.name.trim()).split(' ').join('_'),
                order:                 parseInt(form.order),
                display_type:          form.display_type,
                is_required:           form.is_required,
                custom_label:          form.custom_label?.trim() || null,
                requires_confirmation: ['confirmation_single', 'confirmation_multi'].includes(form.display_type),
                ...(isEdit && categoryId ? { id: categoryId } : {})
            };

            // For add mode, use 'create' as the URL segment — the [id].js handler
            // ignores the URL id for POST (uses body id via upsert) so any valid
            // path segment works. An empty string would produce a trailing-slash
            // URL that Next.js dynamic routes don't match.
            const urlId = isEdit && categoryId ? categoryId : 'create';
            const res = await fetch(`/api/equipments/categories/${urlId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                toast.error(err.message || 'Failed to save category.');
                return;
            }

            toast.success(isAdd ? 'Category created successfully.' : 'Category updated successfully.');
            onSuccess?.();
        } catch (err) {
            console.error('[AssetCategoryForm] save error:', err);
            toast.error('Failed to save category. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };

    // ── Loading ───────────────────────────────────────────────────────────────
    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-gray-500">Loading category...</div>
            </div>
        );
    }

    // ── Form ──────────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-gray-50">

            {/* Header — identical structure to AssetEquipmentForm */}
            <div className="bg-white border-b px-6 py-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                        <Home className="w-4 h-4" />
                        <button onClick={onCancel} className="hover:text-blue-600 transition-colors">
                            ASSET CATEGORIES
                        </button>
                        <span>/</span>
                        <span className="font-medium">
                            {isAdd  && 'ADD CATEGORY'}
                            {isEdit && 'EDIT CATEGORY'}
                        </span>
                    </div>

                    <div className="flex items-center space-x-3">
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
                            label={isSaving ? 'SAVING...' : (isAdd ? 'CREATE CATEGORY' : 'UPDATE CATEGORY')}
                            onClick={handleSave}
                            disabled={isSaving}
                        />
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="p-6">
                <div className="max-w-3xl mx-auto space-y-6">

                    {/* Basic Information */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h3>
                        <div className="space-y-4">

                            <TextField
                                label="Category Name"
                                value={form.name}
                                onChange={(value) => setForm({ ...form, name: value })}
                                required
                                placeholder="e.g. Transfer Aids"
                            />

                            {/* Order field with conflict warning */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display Order <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    className={`w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 transition-colors ${
                                        orderConflict
                                            ? 'border-amber-400 focus:ring-amber-400 bg-amber-50'
                                            : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                    value={form.order}
                                    onChange={(e) => setForm({ ...form, order: e.target.value })}
                                    placeholder="0"
                                />

                                {/* Conflict warning — non-blocking, save is still allowed */}
                                {orderConflict && (
                                    <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <p className="text-sm text-amber-800">
                                            Order <strong>{form.order}</strong> is already used by{' '}
                                            <strong>
                                                {_.startCase(orderConflict.name?.replaceAll('_', ' '))}
                                            </strong>. You can still save — the display order in the list is managed by drag-and-drop and will not break, but duplicate order values may cause unexpected sorting.
                                        </p>
                                    </div>
                                )}

                                {/* Helper text when no conflict */}
                                {!orderConflict && (
                                    <p className="text-xs text-gray-500 mt-1">
                                        Controls the display order in the booking form. You can also reorder by dragging in the category list.
                                    </p>
                                )}
                            </div>

                        </div>
                    </div>

                    {/* Display Configuration */}
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">Display Configuration</h3>
                        <p className="text-sm text-gray-500 mb-4">
                            Controls how this category renders in the booking equipment form.
                        </p>
                        <div className="space-y-5">

                            {/* Display Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Display Type <span className="text-red-500">*</span>
                                </label>
                                <select
                                    className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    value={form.display_type}
                                    onChange={(e) => setForm({ ...form, display_type: e.target.value })}
                                >
                                    {DISPLAY_TYPE_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                                <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-gray-500">
                                    <span><strong>Yes / No</strong> — single-item category, guest picks yes or no</span>
                                    <span><strong>Single choice</strong> — pick one from a list (e.g. mattress type, sling)</span>
                                    <span><strong>Multi choice</strong> — pick many from a list (e.g. transfer aids)</span>
                                    <span><strong>Confirm → pick one/many</strong> — yes/no gate then item selection (e.g. shower commode)</span>
                                    <span><strong>Special</strong> — uses a custom renderer in code (e.g. infant care quantity spinner)</span>
                                </div>
                            </div>

                            {/* Required */}
                            <div className="flex items-start gap-3">
                                <input
                                    id="is_required"
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 text-blue-600 border-gray-300 rounded"
                                    checked={form.is_required}
                                    onChange={(e) => setForm({ ...form, is_required: e.target.checked })}
                                />
                                <div>
                                    <label htmlFor="is_required" className="text-sm font-medium text-gray-700 cursor-pointer">
                                        Required
                                    </label>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Guest must make a selection in this category before submitting.
                                    </p>
                                </div>
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
                                    value={form.custom_label}
                                    onChange={(e) => setForm({ ...form, custom_label: e.target.value })}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    The question shown to the guest. Leave blank to auto-generate from the category name.
                                </p>
                            </div>

                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}