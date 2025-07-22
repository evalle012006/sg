import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { supplierActions } from '../../store/supplierTypeSlice';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { 
  Edit,
  Trash2,
  Plus
} from 'lucide-react';

const Layout = dynamic(() => import('../../components/layout'));
const Table = dynamic(() => import('../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));

export default function SupplierManagementPage() {
  const dispatch = useDispatch();
  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [mode, setMode] = useState('');

  // Updated columns to match new Table component pattern
  const columns = useMemo(() => [
    {
      key: 'name',
      label: 'SUPPLIER NAME',
      searchable: true,
      render: (value) => (
        <span className="font-medium text-gray-900">{value}</span>
      )
    },
    {
      key: 'email',
      label: 'EMAIL',
      searchable: true,
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'phone_number',
      label: 'PHONE NUMBER',
      searchable: true,
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'address',
      label: 'ADDRESS',
      searchable: true,
      render: (value) => (
        <span className="text-gray-600">{value}</span>
      )
    },
    {
      key: 'actions',
      label: 'ACTION',
      searchable: false,
      render: (value, row) => (
        <div className="flex items-center space-x-2">
          <button 
            title="Edit Supplier" 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
            onClick={(e) => {
              e.stopPropagation();
              onClickEdit(row);
            }}
          >
            <Edit className="w-4 h-4" />
          </button>
          
          <button 
            title="Delete Supplier" 
            className="p-2 rounded transition-colors duration-150 hover:opacity-80"
            style={{ backgroundColor: '#dc26261A', color: '#dc2626' }}
            onClick={(e) => {
              e.stopPropagation();
              onClickDelete(row);
            }}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ], []);

  const onClickEdit = (supplier) => {
    setSelectedSupplier(supplier);
    setMode('edit');
    setShowModal(true);
  };

  const onClickDelete = (supplier) => {
    setSelectedSupplier(supplier);
    setMode('delete');
    setShowModal(true);
  };

  const handleCreate = () => {
    setShowCreateModal(true);
  };

  const handleUpdate = async () => {
    try {
      const response = await fetch(`/api/supplier/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(selectedSupplier),
      });

      if (response.ok) {
        setShowModal(false);
        fetchData();
        toast.success("Supplier updated successfully.");
      } else {
        toast.error("Failed to update supplier. Please try again.");
      }
    } catch (error) {
      toast.error("Sorry, something went wrong. Please try again.");
    }
  };

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/supplier/${selectedSupplier.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setShowModal(false);
        fetchData();
        toast.success("Supplier deleted successfully.");
      } else {
        toast.error("Failed to delete supplier. Please try again.");
      }
    } catch (error) {
      toast.error("Sorry, something went wrong. Please try again.");
    }
  };

  const fetchData = async () => {
    try {
      const response = await fetch("/api/supplier");

      if (response.ok) {
        const data = await response.json();

        const suppliersData = data.map(s => ({
          ...s,
          label: s.name,
          value: s.name
        }));
        
        dispatch(supplierActions.setList(suppliersData));
        setSuppliers(suppliersData);
        setIsLoading(false);
      }
    } catch (error) {
      setIsLoading(false);
      toast.error("Failed to load suppliers.");
    }
  };

  useEffect(() => {
    let mounted = true;

    mounted && fetchData();

    return () => {
      mounted = false;
    };
  }, []);

  if (isLoading) {
    return (
      <div className='h-screen flex items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <Layout title="Supplier Management">
      <div className='container mx-auto px-4 py-8'>
        {/* Add Supplier Button */}
        <div className="flex justify-end mb-6">
          <Button
            color="secondary"
            size="medium"
            label="Add Supplier"
            onClick={handleCreate}
            withIcon={true}
            iconName="custom"
            iconSvg={<Plus />}
          />
        </div>

        {/* Suppliers Table */}
        {suppliers.length > 0 ? (
          <Table 
            data={suppliers} 
            columns={columns}
            itemsPerPageOptions={[10, 15, 25, 50]}
            defaultItemsPerPage={15}
          />
        ) : (
          <div className="flex justify-center items-center h-96">
            <div className="text-center">
              <h1 className="text-2xl font-bold">No suppliers found</h1>
              <p className="text-gray-500">Click on the button below to add a new supplier.</p>
              <div className="mt-5">
                <Button
                  color="secondary"
                  size="medium"
                  label="Add Supplier"
                  onClick={handleCreate}
                  withIcon={true}
                  iconName="custom"
                  iconSvg={<Plus />}
                />
              </div>
            </div>
          </div>
        )}

        {/* Edit/Delete Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowModal(false)}>
            <div className="flex items-center justify-center h-screen">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[400px]" onClick={(e) => e.stopPropagation()}>
                <div className="text-center">
                  {mode === 'edit' ? (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Edit Supplier</h3>
                      <div className="space-y-4 text-left">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Supplier Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedSupplier?.name || ''}
                            onChange={(e) => setSelectedSupplier({...selectedSupplier, name: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email
                          </label>
                          <input
                            type="email"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedSupplier?.email || ''}
                            onChange={(e) => setSelectedSupplier({...selectedSupplier, email: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Phone Number
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={selectedSupplier?.phone_number || ''}
                            onChange={(e) => setSelectedSupplier({...selectedSupplier, phone_number: e.target.value})}
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Address
                          </label>
                          <textarea
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                            rows="3"
                            value={selectedSupplier?.address || ''}
                            onChange={(e) => setSelectedSupplier({...selectedSupplier, address: e.target.value})}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Delete Supplier</h3>
                      <p className="text-gray-600 mb-6">
                        Are you sure you want to delete &quot;{selectedSupplier?.name}&quot;? This action cannot be undone.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex justify-end space-x-4 mt-6">
                    <button 
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      onClick={() => setShowModal(false)}
                    >
                      Cancel
                    </button>
                    <button 
                      className={`px-4 py-2 text-white rounded-md ${
                        mode === 'edit' 
                          ? 'bg-blue-600 hover:bg-blue-700' 
                          : 'bg-red-600 hover:bg-red-700'
                      }`}
                      onClick={mode === 'edit' ? handleUpdate : handleDelete}
                    >
                      {mode === 'edit' ? 'Update' : 'Delete'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Modal - You would replace this with your existing create component */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/30 z-50" onClick={() => setShowCreateModal(false)}>
            <div className="flex items-center justify-center h-screen">
              <div className="bg-white rounded-xl shadow-lg p-6 min-w-[400px]" onClick={(e) => e.stopPropagation()}>
                <div className="text-center">
                  <h3 className="text-lg font-semibold mb-4">Add New Supplier</h3>
                  <p className="text-gray-600">
                    Replace this with your existing supplier creation component.
                  </p>
                  <div className="flex justify-end space-x-4 mt-6">
                    <button 
                      className="px-4 py-2 text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      onClick={() => setShowCreateModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}