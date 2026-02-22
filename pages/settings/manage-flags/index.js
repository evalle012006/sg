// pages/settings/manage-flags/index.js
import React, { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Edit, Trash2, Check, X } from 'lucide-react';
import { toast } from 'react-toastify';
import _ from 'lodash';

const Layout = dynamic(() => import('../../../components/layout'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const TabButton = dynamic(() => import('../../../components/ui-v2/TabButton'));
const TextField = dynamic(() => import('../../../components/ui-v2/TextField'));
const Modal = dynamic(() => import('../../../components/ui/modal'));

export default function ManageFlags() {
    const [selectedTab, setSelectedTab] = useState("guest-flags");
    const [guestFlags, setGuestFlags] = useState([]);
    const [bookingFlags, setBookingFlags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFlagValue, setNewFlagValue] = useState('');
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedFlag, setSelectedFlag] = useState(null);

    // Tab configuration - matching courses module style
    const mainTabs = [
        { label: "GUEST FLAGS", fullLabel: "GUEST FLAGS" },
        { label: "BOOKING FLAGS", fullLabel: "BOOKING FLAGS" }
    ];

    const handleTabChange = (index) => {
        const tabNames = ["guest-flags", "booking-flags"];
        setSelectedTab(tabNames[index]);
        setEditingId(null); // Clear editing state when switching tabs
    };

    // Load flags on mount
    useEffect(() => {
        loadFlags();
    }, []);

    const loadFlags = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/settings/flags');
            if (response.ok) {
                const data = await response.json();
                setGuestFlags(data.guest_flags || []);
                setBookingFlags(data.booking_flags || []);
            } else {
                toast.error('Failed to load flags');
            }
        } catch (error) {
            console.error('Error loading flags:', error);
            toast.error('Failed to load flags');
        } finally {
            setIsLoading(false);
        }
    };

    const handleAddFlag = async () => {
        if (!newFlagValue.trim()) {
            toast.error('Please enter a flag value');
            return;
        }

        const attribute = selectedTab === 'guest-flags' ? 'guest_flag' : 'booking_flag';

        try {
            const response = await fetch('/api/settings/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attribute,
                    value: newFlagValue.trim().toLowerCase().replace(/\s+/g, '-')
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Flag added successfully');
                setNewFlagValue('');
                setShowAddModal(false);
                loadFlags();
            } else {
                toast.error(data.message || 'Failed to add flag');
            }
        } catch (error) {
            console.error('Error adding flag:', error);
            toast.error('Failed to add flag');
        }
    };

    const handleStartEdit = (flag) => {
        setEditingId(flag.id);
        setEditValue(flag.value);
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditValue('');
    };

    const handleSaveEdit = async (id) => {
        if (!editValue.trim()) {
            toast.error('Flag value cannot be empty');
            return;
        }

        try {
            const response = await fetch('/api/settings/flags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    value: editValue.trim().toLowerCase().replace(/\s+/g, '-')
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Flag updated successfully');
                setEditingId(null);
                setEditValue('');
                loadFlags();
            } else {
                toast.error(data.message || 'Failed to update flag');
            }
        } catch (error) {
            console.error('Error updating flag:', error);
            toast.error('Failed to update flag');
        }
    };

    const handleDeleteClick = (flag) => {
        setSelectedFlag(flag);
        setShowDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedFlag) return;

        try {
            const response = await fetch('/api/settings/flags', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selectedFlag.id })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Flag deleted successfully');
                setShowDeleteDialog(false);
                setSelectedFlag(null);
                loadFlags();
            } else {
                toast.error(data.message || 'Failed to delete flag');
            }
        } catch (error) {
            console.error('Error deleting flag:', error);
            toast.error('Failed to delete flag');
        }
    };

    // Table columns - using project's Table component format
    const columns = useMemo(() => [
        {
            key: 'value',
            label: 'FLAG VALUE',
            render: (value, row) => {
                if (editingId === row.id) {
                    return (
                        <TextField
                            value={editValue}
                            onChange={(value) => setEditValue(value)}
                            placeholder="Enter flag value"
                            className="w-full"
                        />
                    );
                }
                return (
                    <div>
                        <div className="font-medium text-gray-900">
                            {_.startCase(row.value)}
                        </div>
                        <div className="text-sm text-gray-500">
                            {row.value}
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'actions',
            label: 'ACTIONS',
            searchable: false,
            render: (value, row) => {
                if (editingId === row.id) {
                    return (
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleSaveEdit(row.id)}
                                className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded"
                                title="Save"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                onClick={handleCancelEdit}
                                className="p-2 text-gray-600 hover:text-gray-700 hover:bg-gray-50 rounded"
                                title="Cancel"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleStartEdit(row)}
                            className="p-2 text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded"
                            title="Edit"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(row)}
                            className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded"
                            title="Delete"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            }
        }
    ], [editingId, editValue]);

    const currentData = selectedTab === 'guest-flags' ? guestFlags : bookingFlags;
    const currentTabLabel = selectedTab === 'guest-flags' ? 'Guest Flag' : 'Booking Flag';

    return (
        <Layout title="Manage Flags">
            <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Manage Flags</h1>
                        <p className="text-gray-600">Manage guest and booking flags used throughout the system</p>
                    </div>
                    <Button
                        color="primary"
                        size="medium"
                        label={`+ ADD ${currentTabLabel.toUpperCase()}`}
                        onClick={() => setShowAddModal(true)}
                    />
                </div>

                {/* Tabs */}
                <div className="mb-6">
                    <TabButton
                        tabs={mainTabs}
                        activeTab={selectedTab === "guest-flags" ? 0 : 1}
                        onChange={handleTabChange}
                        type="outline"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        </div>
                    ) : (
                        <Table
                            columns={columns}
                            data={currentData}
                            itemsPerPageOptions={[10, 15, 25, 50]}
                            defaultItemsPerPage={15}
                        />
                    )}
                </div>

                {/* Add Modal */}
                {showAddModal && (
                    <Modal
                        show={showAddModal}
                        onClose={() => {
                            setShowAddModal(false);
                            setNewFlagValue('');
                        }}
                        onConfirm={handleAddFlag}
                        title={`Add New ${currentTabLabel}`}
                        description="Enter the flag value. It will be automatically formatted (lowercase with hyphens)."
                        confirmLabel="Add Flag"
                        confirmColor="text-sargood-blue"
                        cancelLabel="Cancel"
                    >
                        <div className="space-y-4">
                            <TextField
                                label="Flag Value"
                                value={newFlagValue}
                                onChange={(value) => setNewFlagValue(value)}
                                placeholder="e.g., complex-care or waiting-approval"
                            />
                            {newFlagValue && (
                                <div className="text-sm">
                                    <span className="text-gray-600">Preview: </span>
                                    <span className="font-medium text-gray-900">
                                        {newFlagValue.trim().toLowerCase().replace(/\s+/g, '-')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </Modal>
                )}

                {/* Delete Confirmation Dialog */}
                {showDeleteDialog && selectedFlag && (
                    <Modal
                        show={showDeleteDialog}
                        onClose={() => {
                            setShowDeleteDialog(false);
                            setSelectedFlag(null);
                        }}
                        onConfirm={handleConfirmDelete}
                        title="Delete Flag"
                        description={`Are you sure you want to delete the flag "${_.startCase(selectedFlag.value)}"? This action cannot be undone. This flag may be in use by existing guests or bookings.`}
                        confirmLabel="Delete"
                        cancelLabel="Cancel"
                    />
                )}
            </div>
        </Layout>
    );
}