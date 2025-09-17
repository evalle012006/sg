import React, { useState, useMemo, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2, Filter, List, Grid, Settings } from 'lucide-react';
import { toast } from 'react-toastify';

const Layout = dynamic(() => import('../../../components/layout'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const PackageForm = dynamic(() => import('../../../components/manage-package/PackageForm'));
const DynamicPackageFilter = dynamic(() => import('../../../components/manage-package/DynamicPackageFilter'));
const DynamicPackageDisplay = dynamic(() => import('../../../components/manage-package/DynamicPackageDisplay'));
const PackageRequirementsForm = dynamic(() => import('../../../components/manage-package/PackageRequirementsForm'));

export default function ManagePackages() {
    const router = useRouter();
    const { mode, id } = router.query;
    
    // Determine current view mode
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
    
    // List state
    const [packages, setPackages] = useState([]);
    const [filteredPackages, setFilteredPackages] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedPackage, setSelectedPackage] = useState(null);
    
    // New filtering state
    const [viewMode, setViewMode] = useState('table'); // 'table' | 'filtered'
    const [displayLayout, setDisplayLayout] = useState('grid'); // 'grid' | 'list'
    const [currentFilters, setCurrentFilters] = useState({});
    const [filterSummary, setFilterSummary] = useState('');
    
    // Requirements management state
    const [showRequirementsForm, setShowRequirementsForm] = useState(false);
    const [requirementsPackage, setRequirementsPackage] = useState(null);

    // Load packages list (original functionality)
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
                            const totalPrice = temp.ndis_line_items.reduce((sum, item) => sum + (parseFloat(item.price_per_night) || 0), 0);
                            temp.formattedPrice = `${temp.ndis_line_items.length} items (Total: AUD ${totalPrice.toFixed(2)})`;
                        } else {
                            temp.formattedPrice = 'NDIS Package';
                        }
                    } else {
                        temp.formattedPrice = temp.price ? `AUD ${parseFloat(temp.price).toFixed(2)}` : 'AUD 0.00';
                    }
                    
                    packageList.push(temp);
                });
            }
            
            setPackages(packageList);
            
            // If in table mode, also set filtered packages
            if (viewMode === 'table') {
                setFilteredPackages(packageList);
            }
            
        } catch (error) {
            console.error('Error loading packages:', error);
            toast.error('Failed to load packages. Please try again later.');
        }
        setIsListLoading(false);
    };

    // Handle dynamic filtering results
    const handleFilteredPackagesChange = useCallback((newPackages) => {
        setFilteredPackages(newPackages);
    }, []);

    // Handle filter changes
    const handleFiltersChange = useCallback((newFilters) => {
        setCurrentFilters(newFilters);
    }, []);

    // Load packages when in list mode
    useEffect(() => {
        if (!isFormMode && viewMode === 'table') {
            loadPackages();
        }
    }, [isFormMode, viewMode]);

    // Navigation functions
    const showList = () => {
        router.push('/settings/manage-packages', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/settings/manage-packages?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (pkg) => {
        router.push(`/settings/manage-packages?mode=edit&id=${pkg.id}`, undefined, { shallow: true });
    };

    const showViewForm = (pkg) => {
        router.push(`/settings/manage-packages?mode=view&id=${pkg.id}`, undefined, { shallow: true });
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
            showEditForm({ id: result.id });
        } else {
            showList();
        }
    };

    // Handle package selection from dynamic display
    const handlePackageSelect = useCallback((pkg) => {
        setSelectedPackage(pkg);
        // You could auto-open edit mode or show details
        // showEditForm(pkg);
    }, []);
    
    // Requirements management handlers
    const handleShowRequirements = useCallback((pkg) => {
        setRequirementsPackage(pkg);
        setShowRequirementsForm(true);
    }, []);
    
    const handleRequirementsSave = useCallback((savedRequirement) => {
        // Refresh the package list to show updated requirements
        if (viewMode === 'table') {
            loadPackages();
        } else {
            // Trigger refresh in dynamic filter
            setCurrentFilters(prev => ({ ...prev }));
        }
        setShowRequirementsForm(false);
        setRequirementsPackage(null);
        toast.success('Package requirements saved successfully!');
    }, [viewMode]);
    
    const handleRequirementsCancel = useCallback(() => {
        setShowRequirementsForm(false);
        setRequirementsPackage(null);
    }, []);

    // Configure columns for the table (original functionality)
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
                        {value || (row.price ? `AUD ${parseFloat(row.price).toFixed(2)}` : 'AUD $0.00')}
                    </span>
                </div>
            )
        },
        {
            key: 'actions',
            label: 'ACTIONS',
            render: (value, row) => (
                <div className="flex space-x-2">
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
                        style={{ backgroundColor: '#6B46C11A', color: '#6B46C1' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleShowRequirements(row);
                        }}
                        title="Manage Requirements"
                    >
                        <Settings className="w-4 h-4" />
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
            {isFormMode ? (
                /* Form Mode - Original functionality */
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    <PackageForm 
                        mode={mode}
                        packageId={id}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                </div>
            ) : (
                /* List Mode - Enhanced with filtering */
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header with controls */}
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Package Management</h1>
                            <p className="text-gray-600">Manage and filter accommodation packages</p>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* View Mode Toggle */}
                            <div className="flex bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                                        viewMode === 'table'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <List className="w-4 h-4 inline mr-1" />
                                    Table View
                                </button>
                                <button
                                    onClick={() => setViewMode('filtered')}
                                    className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                                        viewMode === 'filtered'
                                            ? 'bg-white text-gray-900 shadow-sm'
                                            : 'text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Filter className="w-4 h-4 inline mr-1" />
                                    Dynamic Filter
                                </button>
                            </div>

                            {/* Layout Toggle for Filtered View */}
                            {viewMode === 'filtered' && (
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        onClick={() => setDisplayLayout('grid')}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                                            displayLayout === 'grid'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <Grid className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => setDisplayLayout('list')}
                                        className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                                            displayLayout === 'list'
                                                ? 'bg-white text-gray-900 shadow-sm'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <List className="w-4 h-4" />
                                    </button>
                                </div>
                            )}

                            {/* Add Package Button */}
                            <button
                                onClick={showAddForm}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2"
                            >
                                <span className="text-lg">+</span>
                                Add Package
                            </button>
                        </div>
                    </div>

                    {/* Content based on view mode */}
                    {viewMode === 'table' ? (
                        /* Original Table View */
                        <div className="bg-white rounded-lg shadow">
                            <Table 
                                columns={columns}
                                data={packages}
                                loading={isListLoading}
                                emptyMessage="No packages found"
                                searchable
                                pagination
                            />
                        </div>
                    ) : (
                        /* Dynamic Filtered View */
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                            {/* Filters Sidebar */}
                            <div className="lg:col-span-1">
                                <div className="sticky top-4">
                                    <DynamicPackageFilter
                                        onPackagesChange={handleFilteredPackagesChange}
                                        onFiltersChange={handleFiltersChange}
                                        adminMode={true} // Enable admin-specific features
                                        showAdvancedFilters={true}
                                    />

                                    {/* Selected Package Actions */}
                                    {selectedPackage && (
                                        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                            <h3 className="text-sm font-medium text-blue-900 mb-2">
                                                Selected Package
                                            </h3>
                                            <div className="text-sm text-blue-800">
                                                <div className="font-medium">{selectedPackage.name}</div>
                                                <div className="text-blue-600 mt-1">
                                                    {selectedPackage.package_code} • {selectedPackage.formattedPrice}
                                                </div>
                                            </div>
                                            <div className="mt-3 space-y-2">
                                                <button
                                                    onClick={() => showViewForm(selectedPackage)}
                                                    className="w-full bg-gray-100 text-gray-800 py-2 px-3 rounded text-sm font-medium hover:bg-gray-200"
                                                >
                                                    View Details
                                                </button>
                                                <button
                                                    onClick={() => showEditForm(selectedPackage)}
                                                    className="w-full bg-blue-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-blue-700"
                                                >
                                                    Edit Package
                                                </button>
                                                <button
                                                    onClick={() => handleDeletePackage(selectedPackage)}
                                                    className="w-full bg-red-600 text-white py-2 px-3 rounded text-sm font-medium hover:bg-red-700"
                                                >
                                                    Delete Package
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Admin Stats */}
                                    <div className="mt-6 bg-gray-50 rounded-lg p-4">
                                        <h3 className="text-sm font-medium text-gray-900 mb-2">
                                            Package Statistics
                                        </h3>
                                        <div className="space-y-1 text-sm text-gray-600">
                                            <div>Total Packages: {packages.length}</div>
                                            <div>Filtered Results: {filteredPackages.length}</div>
                                            <div>NDIS Packages: {packages.filter(p => p.funder === 'NDIS').length}</div>
                                            <div>Non-NDIS Packages: {packages.filter(p => p.funder === 'Non-NDIS').length}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Package Display */}
                            <div className="lg:col-span-3">
                                <DynamicPackageDisplay
                                    packages={filteredPackages}
                                    loading={isListLoading}
                                    onPackageSelect={handlePackageSelect}
                                    onPackageEdit={showEditForm}
                                    onPackageDelete={handleDeletePackage}
                                    onPackageView={showViewForm}
                                    onPackageRequirements={handleShowRequirements}
                                    selectedPackage={selectedPackage}
                                    layout={displayLayout}
                                    showDetails={true}
                                    adminMode={true} // Show admin-specific features
                                />
                            </div>
                        </div>
                    )}

                    {/* Delete Confirmation Dialog */}
                    {showDeleteDialog && (
                        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
                            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
                                <div className="mt-3 text-center">
                                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                                        <Trash2 className="h-6 w-6 text-red-600" />
                                    </div>
                                    <h3 className="text-lg font-medium text-gray-900 mt-4">Delete Package</h3>
                                    <div className="mt-2 px-7 py-3">
                                        <p className="text-sm text-gray-500">
                                            Are you sure you want to delete &quot;{selectedPackage?.name}&quot;? 
                                            This action cannot be undone.
                                        </p>
                                    </div>
                                    <div className="items-center px-4 py-3">
                                        <button
                                            onClick={confirmDelete}
                                            className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-300"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => setShowDeleteDialog(false)}
                                            className="mt-3 px-4 py-2 bg-white text-gray-500 text-base font-medium rounded-md w-full shadow-sm border border-gray-300 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-gray-300"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
            {/* Package Requirements Form Modal */}
            <PackageRequirementsForm
                packageData={requirementsPackage}
                isOpen={showRequirementsForm}
                onSave={handleRequirementsSave}
                onCancel={handleRequirementsCancel}
            />
        </Layout>
    );
}