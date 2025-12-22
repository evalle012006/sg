import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2, Plus, Bed, Bath, Users, DollarSign } from 'lucide-react';
import { toast } from 'react-toastify';
import { useDispatch } from 'react-redux';
import { roomTypeActions } from '../../../store/roomTypeSlice';

const Layout = dynamic(() => import('../../../components/layout'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const RoomForm = dynamic(() => import('../../../components/manage-room/RoomForm'));
const Modal = dynamic(() => import('../../../components/ui/modal'));

// Room type options for display
const ROOM_TYPE_OPTIONS = [
    { value: 'studio', label: 'Studio' },
    { value: 'ocean_view', label: 'Ocean View' },
    { value: 'suite', label: 'Suite' },
    { value: 'ocean_view_suite', label: 'Ocean View Suite' }
];

// SVG placeholder for rooms (bed icon with background)
const ROOM_PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="150" viewBox="0 0 200 150">
  <rect width="200" height="150" fill="#E8F4F8"/>
  <g transform="translate(60, 45)">
    <rect x="0" y="35" width="80" height="25" rx="3" fill="#94A3B8"/>
    <rect x="5" y="20" width="25" height="18" rx="4" fill="#CBD5E1"/>
    <rect x="50" y="20" width="25" height="18" rx="4" fill="#CBD5E1"/>
    <rect x="0" y="55" width="8" height="10" rx="1" fill="#64748B"/>
    <rect x="72" y="55" width="8" height="10" rx="1" fill="#64748B"/>
  </g>
</svg>
`)}`;

export default function ManageRoomSetup() {
    const router = useRouter();
    const dispatch = useDispatch();
    const { mode, id } = router.query;
    
    // Determine current view mode
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
    
    // Room state
    const [rooms, setRooms] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Load rooms on mount and when returning from form
    useEffect(() => {
        if (!isFormMode) {
            loadRooms();
        }
    }, [isFormMode]);

    const loadRooms = async () => {
        setIsListLoading(true);
        try {
            const response = await fetch('/api/manage-room');
            if (response.ok) {
                const data = await response.json();
                const roomTypes = data.map(room => ({
                    ...room.data,
                    image_url: room.image_url,
                    uploading: false
                })).sort((a, b) => a.id - b.id);
                
                setRooms(roomTypes);
                dispatch(roomTypeActions.setList(roomTypes));
            }
        } catch (error) {
            console.error('Error loading rooms:', error);
            toast.error('Failed to load rooms');
        }
        setIsListLoading(false);
    };

    // Navigation functions
    const showList = () => {
        router.push('/settings/manage-room', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/settings/manage-room?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (room) => {
        router.push(`/settings/manage-room?mode=edit&id=${room.id}`, undefined, { shallow: true });
    };

    const showViewForm = (room) => {
        router.push(`/settings/manage-room?mode=view&id=${room.id}`, undefined, { shallow: true });
    };

    // Delete handlers
    const handleDeleteRoom = (room) => {
        setSelectedRoom(room);
        setShowDeleteDialog(true);
    };

    const confirmDelete = async () => {
        if (selectedRoom) {
            setIsListLoading(true);
            try {
                const response = await fetch('/api/manage-room/delete/', {
                    method: 'DELETE',
                    body: JSON.stringify(selectedRoom)
                });
                
                if (response.ok) {
                    toast.success('Room was successfully deleted.');
                    loadRooms();
                } else {
                    toast.error('Failed to delete room.');
                }
            } catch (error) {
                console.error('Error deleting room:', error);
                toast.error('Failed to delete room.');
            }
            setIsListLoading(false);
            setShowDeleteDialog(false);
            setSelectedRoom(null);
        }
    };

    const cancelDelete = () => {
        setShowDeleteDialog(false);
        setSelectedRoom(null);
    };

    // Form handlers
    const handleFormCancel = () => {
        showList();
    };

    const handleFormSuccess = () => {
      setTimeout(() => {
        window.location.reload();
      }, 500);
    };

    // Format currency
    const formatCurrency = (value) => {
        if (value === null || value === undefined || value === 0) return '-';
        return `$${parseFloat(value).toFixed(2)}`;
    };

    // Table columns
    const columns = useMemo(() => [
        {
            key: 'image',
            label: 'IMAGE',
            searchable: false,
            render: (value, row) => (
                <div className="w-20 h-16 rounded overflow-hidden bg-gray-100">
                    <img 
                        src={row.image_url || ROOM_PLACEHOLDER_SVG} 
                        alt={row.name || 'Room'}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = ROOM_PLACEHOLDER_SVG;
                        }}
                    />
                </div>
            )
        },
        {
            key: 'name',
            label: 'ROOM NAME',
            searchable: true,
            render: (value, row) => (
                <div>
                    <div className="font-medium text-gray-900">{value}</div>
                    <div className="text-xs text-gray-500 mt-1">
                        Type: {ROOM_TYPE_OPTIONS.find(opt => opt.value === row.type)?.label || row.type || '-'}
                    </div>
                </div>
            )
        },
        {
            key: 'beds',
            label: 'BEDS',
            searchable: false,
            render: (value, row) => (
                <div className="text-sm text-gray-600">
                    <div>Ergo King: {row.ergonomic_king_beds || 0}</div>
                    <div>King Single: {row.king_single_beds || 0}</div>
                    <div>Queen Sofa: {row.queen_sofa_beds || 0}</div>
                </div>
            )
        },
        {
            key: 'rooms',
            label: 'ROOMS',
            searchable: false,
            render: (value, row) => (
                <div className="text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                        <Bed className="w-3 h-3" /> {row.bedrooms || 0} Bedroom{(row.bedrooms || 0) !== 1 ? 's' : ''}
                    </div>
                    <div className="flex items-center gap-1">
                        <Bath className="w-3 h-3" /> {row.bathrooms || 0} Bathroom{(row.bathrooms || 0) !== 1 ? 's' : ''}
                    </div>
                </div>
            )
        },
        {
            key: 'ocean_view',
            label: 'OCEAN VIEW',
            searchable: false,
            render: (value) => (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    value ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'
                }`}>
                    {value ? 'Yes' : 'No'}
                </span>
            )
        },
        {
            key: 'max_guests',
            label: 'MAX GUESTS',
            searchable: false,
            render: (value) => (
                <div className="flex items-center gap-1 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{value || 0}</span>
                </div>
            )
        },
        {
            key: 'pricing',
            label: 'PRICING (AUD)',
            searchable: false,
            render: (value, row) => (
                <div className="text-sm">
                    <div className="text-gray-900">
                        <span className="font-medium">Standard:</span> {formatCurrency(row.price_per_night)}
                    </div>
                    <div className="text-gray-600">
                        <span className="font-medium">Peak:</span> {formatCurrency(row.peak_rate)}
                    </div>
                    <div className="text-gray-600">
                        <span className="font-medium">HSP:</span> {formatCurrency(row.hsp_pricing)}
                    </div>
                </div>
            )
        },
        {
            key: 'actions',
            label: 'ACTIONS',
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
                        title="View Room"
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
                        title="Edit Room"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    {/* <button 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#EF44441A', color: '#EF4444' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(row);
                        }}
                        title="Delete Room"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button> */}
                </div>
            )
        }
    ], []);

    // Show loading spinner for initial load
    if (!isFormMode && isListLoading && rooms.length === 0) {
        return (
            <Layout title="Room Management">
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Room Management">
            <div className="p-6">
                {/* LIST VIEW */}
                {!isFormMode && (
                    <>
                        {/* Header with Add Button */}
                        <div className="flex justify-between items-center mb-6">
                            <h1 className="text-2xl font-semibold text-gray-900">Room Setup</h1>
                            <Button
                                type="button"
                                color="primary"
                                size="medium"
                                label="+ ADD NEW ROOM"
                                onClick={showAddForm}
                            />
                        </div>

                        {/* Room List Table */}
                        <div className="bg-white rounded-lg shadow">
                            {rooms.length === 0 && !isListLoading ? (
                                <div className="flex flex-col items-center justify-center py-16">
                                    <Bed className="w-16 h-16 text-gray-300 mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Rooms Found</h3>
                                    <p className="text-gray-500 mb-6">Get started by adding your first room type.</p>
                                    <Button
                                        type="button"
                                        color="primary"
                                        size="medium"
                                        label="+ ADD NEW ROOM"
                                        onClick={showAddForm}
                                    />
                                </div>
                            ) : (
                                <Table
                                    data={rooms}
                                    columns={columns}
                                    itemsPerPageOptions={[10, 15, 25, 50]}
                                    defaultItemsPerPage={15}
                                />
                            )}
                        </div>
                    </>
                )}

                {/* FORM VIEW */}
                {isFormMode && (
                    <RoomForm
                        mode={mode}
                        roomId={id}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                )}

                {/* Delete Confirmation Dialog */}
                {showDeleteDialog && (
                    <Modal
                        title="Delete Room?"
                        description={`Are you sure you want to delete "${selectedRoom?.name}"? This action cannot be undone.`}
                        onClose={cancelDelete}
                        onConfirm={confirmDelete}
                    />
                )}
            </div>
        </Layout>
    );
}