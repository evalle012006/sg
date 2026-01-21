import { useEffect, useMemo, useState } from "react";
import _ from "lodash";
import { useDispatch } from "react-redux";
import { assetCategoriesActions } from "../../store/assetCategoriesSlice";
import { UppercaseFirstLetter } from "../../utilities/common";
import dynamic from "next/dynamic";
import { toast } from 'react-toastify';
import { DragDropContext, Droppable, Draggable } from 'react-beautiful-dnd';
import { 
  Edit,
  Plus,
  GripVertical
} from 'lucide-react';

import { UpdateForm } from "./../../components/assets-management/categories/update-form";
import { AddCategory } from "./../../components/assets-management/categories/add-category"

const Layout = dynamic(() => import('../../components/layout'));
const Button = dynamic(() => import('./../../components/ui-v2/Button'));

export default function CategoryManagement() {
  const dispatch = useDispatch();
  const [categories, setCategories] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState();
  const [isDragging, setIsDragging] = useState(false);

  const editCategory = (category) => {
    if (isDragging) return; // Prevent edit during drag
    
    setSelectedCategory({ 
      ...category, 
      name: _.startCase(category.name),
      order: category.order || 0
    });
    setShowViewModal(true)
  }

  const fetchCategories = async () => {
    const response = await fetch("/api/equipments/categories", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    let categoriesData = [];
    
    // Sort by order before mapping
    const sortedData = _.sortBy(data, ['order', 'name']);
    
    sortedData.map(c => {
      const categoryName = UppercaseFirstLetter(c.name.replaceAll("_", " "));
      categoriesData.push({
        ...c,
        label: categoryName,
        value: categoryName,
        id: c.id,
        order: c.order || 0
      });
    });
    
    setCategories(categoriesData);
    dispatch(assetCategoriesActions.setList(categoriesData));
  };

  const onDragStart = () => {
    setIsDragging(true);
  };

  const onDragEnd = async (result) => {
    setIsDragging(false);
    
    if (!result.destination) return;
    
    const startIndex = result.source.index;
    const endIndex = result.destination.index;
    
    if (startIndex === endIndex) return;
    
    // Reorder the array
    const reorderedList = Array.from(categories);
    const [removed] = reorderedList.splice(startIndex, 1);
    reorderedList.splice(endIndex, 0, removed);
    
    // Update order numbers sequentially for ALL items
    const updatedItems = reorderedList.map((item, index) => ({
      ...item,
      order: index
    }));
    
    // Update local state immediately
    setCategories(updatedItems);
    dispatch(assetCategoriesActions.setList(updatedItems));
    
    // Prepare data for API
    const orderUpdates = updatedItems.map((item, index) => ({
      id: item.id,
      order: index
    }));
    
    // Send to API
    try {
      const response = await fetch('/api/equipments/categories/reorder', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderUpdates),
      });
      
      if (response.ok) {
        toast.success('Category order updated successfully');
      } else {
        toast.error('Failed to update category order');
        fetchCategories();
      }
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Failed to update category order');
      fetchCategories();
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  return (
    <Layout title="Asset Category Management">
      <div className='container mx-auto px-4 py-8'>
        {/* CREATE MODAL */}
        {showCreateModal &&
          <div className="z-50 w-3/4 h-3/4 absolute">
            <AddCategory closeModal={() => setShowCreateModal(false)} refreshCategories={() => fetchCategories()} />
          </div>}

        {/* VIEW AND EDIT MODAL */}
        {showViewModal &&
          <div className="z-50 w-3/4 h-3/4 absolute">
            <UpdateForm selectedCategory={selectedCategory} closeModal={() => setShowViewModal(false)} refreshCategories={() => fetchCategories()} />
          </div>}

        <div className="pt-6">
          {/* New Category Button */}
          <div className="flex justify-end mb-6">
            <Button
              color="secondary"
              size="medium"
              label="New Category"
              onClick={() => setShowCreateModal(true)}
              withIcon={true}
              iconName="custom"
              iconSvg={<Plus />}
            />
          </div>

          {/* Simple Drag and Drop List - No Pagination */}
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
                                  } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
                                  onClick={() => !isDragging && editCategory(category)}
                                >
                                  <td className="px-4 py-4 text-sm w-12">
                                    <div
                                      {...provided.dragHandleProps}
                                      className="cursor-grab hover:cursor-grabbing p-2"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <GripVertical className="w-4 h-4 text-gray-400" />
                                    </div>
                                  </td>
                                  <td className="px-4 py-4 text-sm">
                                    <span className="font-medium text-gray-900">{category.order}</span>
                                  </td>
                                  <td className="px-4 py-4 text-sm">
                                    <span className="font-medium text-gray-900">{_.startCase(category.name)}</span>
                                  </td>
                                  <td className="px-4 py-4 text-sm">
                                    <button 
                                      title="Edit Category" 
                                      className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                                      style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!isDragging) {
                                          editCategory(category);
                                        }
                                      }}
                                    >
                                      <Edit className="w-4 h-4" />
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
                <p className="text-gray-500">Click on the button below to create a new category.</p>
                <div className="mt-5">
                  <Button
                    color="secondary"
                    size="medium"
                    label="New Category"
                    onClick={() => setShowCreateModal(true)}
                    withIcon={true}
                    iconName="custom"
                    iconSvg={<Plus />}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}