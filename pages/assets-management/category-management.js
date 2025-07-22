import { useEffect, useMemo, useState } from "react";
import _ from "lodash";
import { useDispatch } from "react-redux";
import { assetCategoriesActions } from "../../store/assetCategoriesSlice";
import { UppercaseFirstLetter } from "../../utilities/common";
import dynamic from "next/dynamic";
import { 
  Edit,
  Plus
} from 'lucide-react';

import { UpdateForm } from "./../../components/assets-management/categories/update-form";
import { AddCategory } from "./../../components/assets-management/categories/add-category"

const Layout = dynamic(() => import('../../components/layout'));
const Table = dynamic(() => import('./../../components/ui-v2/Table'));
const Button = dynamic(() => import('./../../components/ui-v2/Button'));

export default function CategoryManagement() {
  const dispatch = useDispatch();
  const [categories, setCategories] = useState([]);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState();

  const editCategory = (category) => {
    setSelectedCategory({ ...category, name: _.startCase(category.name) });
    setShowViewModal(true)
  }

  // Updated columns to match new Table component pattern
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'ASSET CATEGORY',
      searchable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">{_.startCase(value)}</span>
      )
    },
    {
      key: 'actions',
      label: 'ACTION',
      searchable: false,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <button 
            title="Edit Category" 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
            onClick={(e) => {
              e.stopPropagation();
              editCategory(row);
            }}
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  const fetchCategories = async () => {
    const response = await fetch("/api/equipments/categories", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    const data = await response.json();
    let categoriesData = [];
    data.map(c => {
      const categoryName = UppercaseFirstLetter(c.name.replaceAll("_", " "));
      categoriesData.push({
        ...c,
        label: categoryName,
        value: categoryName,
        id: c.id
      });
    });
    setCategories(categoriesData);
    dispatch(assetCategoriesActions.setList(categoriesData));
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
          {/* New Category Button - using new Button component */}
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

          {/* Table - using new Table component */}
          {categories.length > 0 ? (
            <Table 
              data={categories} 
              columns={columns}
              itemsPerPageOptions={[10, 15, 25, 50]}
              defaultItemsPerPage={15}
            />
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