import { useEffect, useState } from "react";
import _ from "lodash";
import { useDispatch } from "react-redux";
import { assetCategoriesActions } from "../../store/assetCategoriesSlice";
import { UppercaseFirstLetter } from "../../utilities/common";
import dynamic from "next/dynamic";
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { useRouter } from "next/router";
import { Edit, Plus, GripVertical } from 'lucide-react';

const Layout     = dynamic(() => import('../../components/layout'));
const Button     = dynamic(() => import('./../../components/ui-v2/Button'));
const AssetCategoryForm = dynamic(() => import('./../../components/assets-management/AssetCategoryForm'));

const DISPLAY_TYPE_LABELS = {
    binary:               'Yes / No',
    single_select:        'Single choice',
    multi_select:         'Multi choice',
    confirmation_single:  'Confirm → pick one',
    confirmation_multi:   'Confirm → pick many',
    special:              'Special',
};

export default function CategoryManagement() {
    const router   = useRouter();
    const dispatch = useDispatch();
    const { mode, id } = router.query;

    const isFormMode = mode === 'add' || mode === 'edit';

    const [categories, setCategories]   = useState([]);
    const [isDragging, setIsDragging]   = useState(false);

    // ── Navigation helpers (mirrors assets-management pattern) ───────────────
    const showList = () => {
        router.push('/assets-management/category-management', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/assets-management/category-management?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (category) => {
        router.push(`/assets-management/category-management?mode=edit&id=${category.id}`, undefined, { shallow: true });
    };

    const handleFormCancel = () => showList();

    const handleFormSuccess = () => {
        showList();
        fetchCategories();
    };

    // ── Data ─────────────────────────────────────────────────────────────────
    const fetchCategories = async () => {
        const response = await fetch("/api/equipments/categories", {
            method: "GET",
            headers: { "Content-Type": "application/json" },
        });
        const data = await response.json();

        const sortedData = _.sortBy(data, ['order', 'name']);
        const categoriesData = sortedData.map(c => ({
            ...c,
            label: UppercaseFirstLetter(c.name.replaceAll("_", " ")),
            value: UppercaseFirstLetter(c.name.replaceAll("_", " ")),
            id:    c.id,
            order: c.order || 0
        }));

        setCategories(categoriesData);
        dispatch(assetCategoriesActions.setList(categoriesData));
    };

    useEffect(() => { fetchCategories(); }, []);

    // ── Drag and drop reorder ─────────────────────────────────────────────────
    const onDragStart = () => setIsDragging(true);

    const onDragEnd = async (result) => {
        setIsDragging(false);
        if (!result.destination) return;
        if (result.source.index === result.destination.index) return;

        const reordered = Array.from(categories);
        const [removed] = reordered.splice(result.source.index, 1);
        reordered.splice(result.destination.index, 0, removed);

        const updated = reordered.map((item, index) => ({ ...item, order: index }));
        setCategories(updated);
        dispatch(assetCategoriesActions.setList(updated));

        try {
            const response = await fetch('/api/equipments/categories/reorder', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updated.map((item, index) => ({ id: item.id, order: index }))),
            });
            if (response.ok) {
                toast.success('Category order updated successfully');
            } else {
                toast.error('Failed to update category order');
                fetchCategories();
            }
        } catch {
            toast.error('Failed to update category order');
            fetchCategories();
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <Layout title="Asset Category Management">
            <div className="container mx-auto px-4 py-8">

                {/* FORM VIEW */}
                {isFormMode ? (
                    <AssetCategoryForm
                        mode={mode}
                        categoryId={id ? parseInt(id) : null}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                ) : (

                /* LIST VIEW */
                <>
                    <div className="flex justify-end mb-6">
                        <Button
                            color="secondary"
                            size="medium"
                            label="New Category"
                            onClick={showAddForm}
                            withIcon={true}
                            iconName="custom"
                            iconSvg={<Plus />}
                        />
                    </div>

                    {categories.length > 0 ? (
                        <div className="w-full bg-white rounded-lg shadow-sm">
                            <DragDropContext onDragEnd={onDragEnd} onDragStart={onDragStart}>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr style={{ backgroundColor: '#ECECEC' }}>
                                                <th className="px-4 py-3 text-left w-12"></th>
                                                <th className="px-4 py-3 text-left">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">ORDER</div>
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">ASSET CATEGORY</div>
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">DISPLAY TYPE</div>
                                                </th>
                                                <th className="px-4 py-3 text-center">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">REQUIRED</div>
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">CUSTOM LABEL</div>
                                                </th>
                                                <th className="px-4 py-3 text-left">
                                                    <div className="text-gray-700 text-sm uppercase tracking-wider font-bold">ACTION</div>
                                                </th>
                                            </tr>
                                        </thead>
                                        <Droppable droppableId="categories">
                                            {(provided) => (
                                                <tbody
                                                    {...provided.droppableProps}
                                                    ref={provided.innerRef}
                                                    className="divide-y divide-gray-200"
                                                >
                                                    {categories.map((category, index) => (
                                                        <Draggable
                                                            key={category.id.toString()}
                                                            draggableId={category.id.toString()}
                                                            index={index}
                                                        >
                                                            {(provided, snapshot) => (
                                                                <tr
                                                                    ref={provided.innerRef}
                                                                    {...provided.draggableProps}
                                                                    className={`transition-colors duration-150 ${
                                                                        snapshot.isDragging
                                                                            ? 'bg-blue-50 shadow-md'
                                                                            : 'hover:bg-[#F2F5F9]'
                                                                    } ${isDragging ? 'cursor-grabbing' : ''}`}
                                                                >
                                                                    {/* Drag handle */}
                                                                    <td className="px-4 py-3" {...provided.dragHandleProps}>
                                                                        <GripVertical className="w-4 h-4 text-gray-400" />
                                                                    </td>

                                                                    {/* Order */}
                                                                    <td className="px-4 py-3 text-sm text-gray-600">
                                                                        {category.order}
                                                                    </td>

                                                                    {/* Name */}
                                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                                        {category.label}
                                                                    </td>

                                                                    {/* Display type */}
                                                                    <td className="px-4 py-3">
                                                                        {category.display_type ? (
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                                                                {DISPLAY_TYPE_LABELS[category.display_type] ?? category.display_type}
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-400">—</span>
                                                                        )}
                                                                    </td>

                                                                    {/* Required */}
                                                                    <td className="px-4 py-3 text-center">
                                                                        {category.is_required ? (
                                                                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">Yes</span>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-400">—</span>
                                                                        )}
                                                                    </td>

                                                                    {/* Custom label */}
                                                                    <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                                                                        {category.custom_label || <span className="text-gray-300">auto-generated</span>}
                                                                    </td>

                                                                    {/* Action */}
                                                                    <td className="px-4 py-3">
                                                                        <button
                                                                            onClick={() => showEditForm(category)}
                                                                            className="p-1.5 rounded hover:bg-gray-100 transition-colors"
                                                                            title="Edit category"
                                                                        >
                                                                            <Edit className="w-4 h-4 text-gray-500" />
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            )}
                                                        </Draggable>
                                                    ))}
                                                    {provided.placeholder}
                                                </tbody>
                                            )}
                                        </Droppable>
                                    </table>
                                </div>
                            </DragDropContext>
                        </div>
                    ) : (
                        <div className="flex justify-center items-center h-96">
                            <div className="text-center">
                                <h1 className="text-2xl font-bold">No categories found</h1>
                                <p className="text-gray-500 mb-5">Click the button below to add a new category.</p>
                                <Button
                                    color="secondary"
                                    size="medium"
                                    label="New Category"
                                    onClick={showAddForm}
                                    withIcon={true}
                                    iconName="custom"
                                    iconSvg={<Plus />}
                                />
                            </div>
                        </div>
                    )}
                </>
                )}
            </div>
        </Layout>
    );
}