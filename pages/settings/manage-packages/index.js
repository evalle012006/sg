import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

const Layout = dynamic(() => import('../../../components/layout'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const PackageForm = dynamic(() => import('../../../components/manage-package/PackageForm'));

export default function ManagePackages() {
    const router = useRouter();
    const { mode, id } = router.query;
    
    // Determine current view mode
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
    
    // List state
    const [packages, setPackages] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);

    // Load packages list
    const loadPackages = async () => {
        setIsListLoading(true);
        try {
            const response = await fetch('/api/packages/');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const result = await response.json();
            
            const packageList = [];
            const responseData = result.packages || result;
            
            if (Array.isArray(responseData)) {
                responseData.forEach(pkg => {
                    let temp = { ...pkg };
                    
                    // Format pricing based on funder type
                    if (temp.funder === 'NDIS') {
                        if (temp.ndis_line_items && temp.ndis_line_items.length > 0) {
                            // Calculate total from line items or show count
                            const totalPrice = temp.ndis_line_items.reduce((sum, item) => sum + (parseFloat(item.price_per_night) || 0), 0);
                            temp.formattedPrice = `${temp.ndis_line_items.length} items (Total: $${totalPrice.toFixed(2)})`;
                        } else {
                            temp.formattedPrice = 'NDIS Package';
                        }
                    } else {
                        temp.formattedPrice = temp.price ? `$${parseFloat(temp.price).toFixed(2)}` : '$0.00';
                    }
                    
                    packageList.push(temp);
                });
            }
            
            setPackages(packageList);
        } catch (error) {
            console.error('Error loading packages:', error);
            toast.error('Failed to load packages. Please try again later.');
        }
        setIsListLoading(false);
    };

    // Load packages when in list mode
    useEffect(() => {
        if (!isFormMode) {
            loadPackages();
        }
    }, [isFormMode]);

    // Navigation functions
    const showList = () => {
        router.push('/manage-packages', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/manage-packages?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (pkg) => {
        router.push(`/manage-packages?mode=edit&id=${pkg.id}`, undefined, { shallow: true });
    };

    const showViewForm = (pkg) => {
        router.push(`/manage-packages?mode=view&id=${pkg.id}`, undefined, { shallow: true });
    };

    const handleDeletePackage = (pkg) => {
        setSelectedPackage(pkg);
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (selectedPackage) {
            setIsListLoading(true);
            try {
                const response = await fetch(`/api/packages/${selectedPackage.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (response.status === 500) {
                    const data = await response.json();
                    if (data.error && data.message.includes('Cannot delete')) {
                        toast.error('This package cannot be deleted as it may have associated bookings.');
                    } else {
                        toast.error('Something went wrong. Please try again later.');
                    }
                } else if (!response.ok) {
                    toast.error('Something went wrong. Please try again later.');
                } else {
                    toast.success('Package was successfully deleted.');
                    setTimeout(() => {
                        loadPackages();
                    }, 1000);
                }
            } catch (error) {
                console.error('Error deleting package:', error);
                toast.error('Failed to delete package. Please try again later.');
            }
            setIsListLoading(false);
        }
        setShowDeleteDialog(false);
        setSelectedPackage(null);
    };

    // Form callbacks
    const handleFormCancel = () => {
        showList();
    };

    const handleFormSuccess = (result) => {
        if (result && result.action === 'edit' && result.id) {
            // Switch to edit mode for the same package
            showEditForm({ id: result.id });
        } else {
            // Return to list and refresh
            showList();
        }
    };

    // Configure columns for the table
    const columns = useMemo(() => [
        {
            key: 'name',
            label: 'PACKAGE NAME',
            searchable: true,
            render: (value, row) => (
                <span className="font-medium text-gray-900">
                    {value || row.package_name || row.title || 'Untitled Package'}
                </span>
            )
        },
        {
            key: 'package_code',
            label: 'PACKAGE CODE',
            searchable: true,
            render: (value) => (
                <span className="text-gray-700 font-mono">
                    {value || 'N/A'}
                </span>
            )
        },
        {
            key: 'funder',
            label: 'FUNDER',
            searchable: true,
            render: (value, row) => (
                <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">
                        {value || 'N/A'}
                    </span>
                    {value === 'NDIS' && row.ndis_package_type && (
                        <span className="text-xs text-gray-500 uppercase">
                            {row.ndis_package_type}
                        </span>
                    )}
                </div>
            )
        },
        {
            key: 'formattedPrice',
            label: 'PRICING',
            searchable: true,
            render: (value, row) => (
                <div className="flex flex-col">
                    <span className="text-gray-700 font-medium">
                        {value || (row.price ? `$${parseFloat(row.price).toFixed(2)}` : '$0.00')}
                    </span>
                    {row.funder === 'NDIS' && row.ndis_line_items && row.ndis_line_items.length > 0 && (
                        <div className="mt-1">
                            <button 
                                className="text-xs text-blue-600 hover:text-blue-800 underline"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    showViewForm(row);
                                }}
                            >
                                View Details
                            </button>
                        </div>
                    )}
                </div>
            )
        },
        {
            key: 'actions',
            label: 'ACTION',
            searchable: false,
            render: (value, row) => (
                <div className="flex items-center space-x-2">
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showViewForm(row);
                        }}
                        title="View Package"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showEditForm(row);
                        }}
                        title="Edit Package"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePackage(row);
                        }}
                        title="Delete Package"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    // Show loading spinner for initial load
    if (!isFormMode && isListLoading && packages.length === 0) {
        return (
            <Layout title="Package Management">
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Package Management">
            <div className="p-6">
                {/* LIST VIEW */}
                {!isFormMode && (
                    <>
                        <div className="flex justify-end items-center mb-6">
                            <Button
                                color="primary"
                                size="medium"
                                label="+ ADD PACKAGE"
                                onClick={showAddForm}
                                className="font-semibold"
                            />
                        </div>

                        <Table 
                            data={packages} 
                            columns={columns}
                            itemsPerPageOptions={[10, 15, 25, 50]}
                            defaultItemsPerPage={15}
                        />

                        {/* Delete Confirmation Dialog */}
                        {showDeleteDialog && (
                            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        Delete Package
                                    </h3>
                                    <p className="text-gray-600 mb-6">
                                        Are you sure you want to delete &quot;{selectedPackage?.name}&quot;? This action cannot be undone.
                                    </p>
                                    <div className="flex justify-end space-x-3">
                                        <Button
                                            color="outline"
                                            size="medium"
                                            label="Cancel"
                                            onClick={() => {
                                                setShowDeleteDialog(false);
                                                setSelectedPackage(null);
                                            }}
                                        />
                                        <Button
                                            color="secondary"
                                            size="medium"
                                            label="Delete"
                                            onClick={confirmDelete}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* FORM VIEW */}
                {isFormMode && (
                    <PackageForm
                        mode={mode}
                        packageId={id}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                )}
            </div>
        </Layout>
    );
}