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

// Mirrors the server-side suggestAcronym() in pages/api/settings/flags.js,
// used here purely for the live preview as the admin types — the server
// is still the source of truth and re-derives this on save.
function suggestAcronym(label) {
    return String(label)
        .split(/[\s_-]+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(word => word[0].toUpperCase())
        .join('');
}

export default function ManageFlags() {
    const [selectedTab, setSelectedTab] = useState("guest-flags");
    const [guestFlags, setGuestFlags] = useState([]);
    const [bookingFlags, setBookingFlags] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    // Inline edit state — now covers label/acronym/color, not just value
    const [editingId, setEditingId] = useState(null);
    const [editLabel, setEditLabel] = useState('');
    const [editAcronym, setEditAcronym] = useState('');
    const [editColor, setEditColor] = useState('#6B7280');
    const [editAcronymTouched, setEditAcronymTouched] = useState(false);

    // Add modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [newFlagLabel, setNewFlagLabel] = useState('');
    const [newFlagAcronym, setNewFlagAcronym] = useState('');
    const [newFlagColor, setNewFlagColor] = useState('#6B7280');
    const [newFlagAcronymTouched, setNewFlagAcronymTouched] = useState(false);

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
        if (!newFlagLabel.trim()) {
            toast.error('Please enter a flag label');
            return;
        }

        const type = selectedTab === 'guest-flags' ? 'guest' : 'booking';

        try {
            const response = await fetch('/api/settings/flags', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    label: newFlagLabel.trim(),
                    acronym: newFlagAcronym.trim(), // empty => server auto-suggests
                    color: newFlagColor,
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Flag added successfully');
                setNewFlagLabel('');
                setNewFlagAcronym('');
                setNewFlagColor('#6B7280');
                setNewFlagAcronymTouched(false);
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
        setEditLabel(flag.label);
        setEditAcronym(flag.acronym);
        setEditColor(flag.color || '#6B7280');
        setEditAcronymTouched(true); // existing acronym is already a deliberate value
    };

    const handleCancelEdit = () => {
        setEditingId(null);
        setEditLabel('');
        setEditAcronym('');
        setEditColor('#6B7280');
        setEditAcronymTouched(false);
    };

    const handleSaveEdit = async (id) => {
        if (!editLabel.trim()) {
            toast.error('Flag label cannot be empty');
            return;
        }

        try {
            const response = await fetch('/api/settings/flags', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    id,
                    label: editLabel.trim(),
                    acronym: editAcronym.trim(),
                    color: editColor,
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success('Flag updated successfully');
                handleCancelEdit();
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
            key: 'label',
            label: 'FLAG',
            render: (value, row) => {
                if (editingId === row.id) {
                    return (
                        <div className="space-y-2 min-w-[220px]">
                            <TextField
                                value={editLabel}
                                onChange={(value) => {
                                    setEditLabel(value);
                                    if (!editAcronymTouched) {
                                        setEditAcronym(suggestAcronym(value));
                                    }
                                }}
                                placeholder="Enter flag label"
                                className="w-full"
                            />
                            <div className="text-xs text-gray-500">
                                value: {row.value}
                            </div>
                        </div>
                    );
                }
                return (
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-semibold flex-shrink-0"
                            style={{ backgroundColor: row.color || '#6B7280' }}
                            title={row.label}
                        >
                            {row.acronym}
                        </span>
                        <div>
                            <div className="font-medium text-gray-900">
                                {row.label}
                            </div>
                            <div className="text-sm text-gray-500">
                                {row.value}
                            </div>
                        </div>
                    </div>
                );
            }
        },
        {
            key: 'acronym',
            label: 'ACRONYM',
            render: (value, row) => {
                if (editingId === row.id) {
                    return (
                        <TextField
                            value={editAcronym}
                            onChange={(value) => {
                                setEditAcronymTouched(true);
                                setEditAcronym(value.toUpperCase());
                            }}
                            placeholder="e.g. CC"
                            className="w-24"
                        />
                    );
                }
                return <span className="text-sm text-gray-700">{row.acronym}</span>;
            }
        },
        {
            key: 'color',
            label: 'COLOR',
            render: (value, row) => {
                if (editingId === row.id) {
                    return (
                        <input
                            type="color"
                            value={editColor}
                            onChange={(e) => setEditColor(e.target.value)}
                            className="w-12 h-9 p-0 border border-gray-300 rounded cursor-pointer"
                            aria-label="Flag color"
                        />
                    );
                }
                return (
                    <div className="flex items-center gap-2">
                        <span
                            className="inline-block w-5 h-5 rounded-full border border-gray-300"
                            style={{ backgroundColor: row.color || '#6B7280' }}
                        />
                        <span className="text-xs text-gray-500">{row.color}</span>
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
    ], [editingId, editLabel, editAcronym, editColor, editAcronymTouched]);

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
                            setNewFlagLabel('');
                            setNewFlagAcronym('');
                            setNewFlagColor('#6B7280');
                            setNewFlagAcronymTouched(false);
                        }}
                        onConfirm={handleAddFlag}
                        title={`Add New ${currentTabLabel}`}
                        description="Enter a label, an acronym shown on badges, and a color. The acronym is suggested from the label but can be edited."
                        confirmLabel="Add Flag"
                        confirmColor="text-sargood-blue"
                        cancelLabel="Cancel"
                    >
                        <div className="space-y-4">
                            <TextField
                                label="Flag Label"
                                value={newFlagLabel}
                                onChange={(value) => {
                                    setNewFlagLabel(value);
                                    if (!newFlagAcronymTouched) {
                                        setNewFlagAcronym(suggestAcronym(value));
                                    }
                                }}
                                placeholder="e.g., Complex Care or Waiting Approval"
                            />
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <TextField
                                        label="Acronym"
                                        value={newFlagAcronym}
                                        onChange={(value) => {
                                            setNewFlagAcronymTouched(true);
                                            setNewFlagAcronym(value.toUpperCase());
                                        }}
                                        placeholder="e.g., CC"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium mb-2 text-gray-700">Color</label>
                                    <input
                                        type="color"
                                        value={newFlagColor}
                                        onChange={(e) => setNewFlagColor(e.target.value)}
                                        className="w-12 h-10 p-0 border border-gray-300 rounded cursor-pointer"
                                        aria-label="Flag color"
                                    />
                                </div>
                            </div>
                            {newFlagLabel && (
                                <div className="flex items-center gap-3 text-sm pt-2 border-t border-gray-100">
                                    <span className="text-gray-600">Preview:</span>
                                    <span
                                        className="inline-flex items-center justify-center w-7 h-7 rounded-full text-white text-[10px] font-semibold"
                                        style={{ backgroundColor: newFlagColor }}
                                    >
                                        {newFlagAcronym || suggestAcronym(newFlagLabel)}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                        {newFlagLabel}
                                    </span>
                                    <span className="text-gray-400">
                                        ({newFlagLabel.trim().toLowerCase().replace(/\s+/g, '-')})
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
                        description={`Are you sure you want to delete the flag "${selectedFlag.label}"? This action cannot be undone. This flag may be in use by existing guests or bookings, and will render with a default gray badge if so.`}
                        confirmLabel="Delete"
                        cancelLabel="Cancel"
                    />
                )}
            </div>
        </Layout>
    );
}