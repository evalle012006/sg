import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import moment from 'moment';

const Layout = dynamic(() => import('../../components/layout'));
const Table = dynamic(() => import('../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const StatusBadge = dynamic(() => import('../../components/ui-v2/StatusBadge'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const PromotionForm = dynamic(() => import('../../components/promotions/PromotionForm'));

export default function ManagePromotions() {
    const router = useRouter();
    const { mode, id } = router.query;
    
    // Determine current view mode
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
    
    // Promotions state
    const [promotions, setPromotions] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedPromotion, setSelectedPromotion] = useState(null);

    // Load promotions on mount
    useEffect(() => {
        if (!isFormMode) {
            loadPromotions();
        }
    }, [isFormMode]);

    const loadPromotions = async () => {
        setIsListLoading(true);
        try {
            const response = await fetch('/api/promotions?includeArchived=true');
            if (!response.ok) {
                throw new Error('Failed to load promotions');
            }
            const result = await response.json();
            
            const promotionList = [];
            if (result.promotions && result.promotions.length > 0) {
                result.promotions.forEach(p => {
                    const temp = {
                        ...p,
                        dateRange: formatDateRange(p.start_date, p.end_date),
                        statusBadge: getStatusBadge(p.status)
                    };
                    promotionList.push(temp);
                });
            }
            
            setPromotions(promotionList);
        } catch (error) {
            console.error('Error loading promotions:', error);
            toast.error('Failed to load promotions. Please try again later.');
        }
        setIsListLoading(false);
    };

    const formatDateRange = (startDate, endDate) => {
        if (!startDate && !endDate) return 'No dates set';
        if (startDate && endDate) {
            return `${moment(startDate).format('DD MMM YYYY')} - ${moment(endDate).format('DD MMM YYYY')}`;
        }
        if (startDate) return `From ${moment(startDate).format('DD MMM YYYY')}`;
        if (endDate) return `Until ${moment(endDate).format('DD MMM YYYY')}`;
        return 'No dates set';
    };

    const getStatusBadge = (status) => {
        const statusConfig = {
            draft: { type: 'default', label: 'Draft' },
            published: { type: 'success', label: 'Published' },
            archived: { type: 'default', label: 'Archived' }
        };
        const config = statusConfig[status] || statusConfig.draft;
        return <div className='w-32'><StatusBadge type={config.type} label={config.label} size="small" /></div>;
    };

    // Navigation functions
    const showList = () => {
        router.push('/promotions', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/promotions?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (promotion) => {
        router.push(`/promotions?mode=edit&id=${promotion.id}`, undefined, { shallow: true });
    };

    const showViewForm = (promotion) => {
        router.push(`/promotions?mode=view&id=${promotion.id}`, undefined, { shallow: true });
    };

    const handleDeletePromotion = (promotion) => {
        setSelectedPromotion(promotion);
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (selectedPromotion) {
            setIsListLoading(true);
            try {
                const response = await fetch(`/api/promotions/${selectedPromotion.id}`, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });

                if (!response.ok) {
                    toast.error('Something went wrong. Please try again later.');
                } else {
                    toast.success('Promotion was successfully deleted.');
                    loadPromotions();
                }
            } catch (error) {
                console.error('Error deleting promotion:', error);
                toast.error('Failed to delete promotion.');
            }
            setIsListLoading(false);
            setShowDeleteDialog(false);
            setSelectedPromotion(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteDialog(false);
        setSelectedPromotion(null);
    };

    // Table columns
    const columns = useMemo(() => [
        {
            key: 'title',
            label: 'Title',
            searchable: true,
            render: (value) => (
                <div className="font-medium text-gray-900">{value}</div>
            )
        },
        {
            key: 'description',
            label: 'Description',
            searchable: true,
            render: (value) => (
                <div className="text-gray-600 text-sm line-clamp-2 max-w-md">
                    {value || '-'}
                </div>
            )
        },
        {
            key: 'dateRange',
            label: 'Date Range',
            searchable: false
        },
        {
            key: 'terms',
            label: 'Terms',
            searchable: true,
            render: (value) => (
                <div className="text-sm text-gray-600">{value || '-'}</div>
            )
        },
        {
            key: 'statusBadge',
            label: 'Status',
            searchable: false,
            width: '120px'
        },
        {
            key: 'actions',
            label: 'Actions',
            searchable: false,
            width: '140px',
            render: (value, row) => (
                <div className="flex gap-2">
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showViewForm(row);
                        }}
                        title="View Promotion"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#F59E0B1A', color: '#F59E0B' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showEditForm(row);
                        }}
                        title="Edit Promotion"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeletePromotion(row);
                        }}
                        title="Delete Promotion"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    // Show loading spinner for initial load
    if (!isFormMode && isListLoading && promotions.length === 0) {
        return (
            <Layout title="Promotion Management">
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Promotion Management">
            <div className="p-6">
                {/* FORM MODE */}
                {isFormMode && (
                    <PromotionForm
                        mode={mode}
                        promotionId={id}
                        onCancel={showList}
                        onSuccess={() => {
                            loadPromotions();
                            showList();
                        }}
                    />
                )}

                {/* LIST MODE */}
                {!isFormMode && (
                    <>
                        {/* Header */}
                        <div className="mb-6 flex justify-between items-center">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Promotions & Special Offers</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Manage promotional offers displayed to guests
                                </p>
                            </div>
                            <Button
                                type="button"
                                color="primary"
                                size="medium"
                                label="Add New Promotion"
                                onClick={showAddForm}
                            />
                        </div>

                        {/* Table */}
                        <div className="bg-white rounded-lg shadow">
                            <Table
                                columns={columns}
                                data={promotions}
                                onRowClick={showViewForm}
                                emptyMessage="No promotions found. Click 'Add New Promotion' to create one."
                                isLoading={isListLoading}
                            />
                        </div>
                    </>
                )}

                {/* Delete Confirmation Dialog */}
                {showDeleteDialog && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                            <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                Delete Promotion
                            </h3>
                            <p className="text-gray-600 mb-6">
                                Are you sure you want to delete &quot;{selectedPromotion?.title}&quot;? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <Button
                                    type="button"
                                    color="outline"
                                    size="medium"
                                    label="Cancel"
                                    onClick={cancelDelete}
                                />
                                <Button
                                    type="button"
                                    color="danger"
                                    size="medium"
                                    label="Delete"
                                    onClick={confirmDelete}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </Layout>
    );
}