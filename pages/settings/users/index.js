import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { Eye, Edit, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';

const Layout = dynamic(() => import('../../../components/layout'));
const Table = dynamic(() => import('../../../components/ui-v2/Table'));
const Button = dynamic(() => import('../../../components/ui-v2/Button'));
const Spinner = dynamic(() => import('../../../components/ui/spinner'));
const UserForm = dynamic(() => import('../../../components/users/UserForm'));

export default function UsersPage() {
    const router = useRouter();
    const { mode, id } = router.query;
    
    // Determine current view mode
    const isFormMode = mode === 'add' || mode === 'edit' || mode === 'view';
    
    // Users state
    const [users, setUsers] = useState([]);
    const [isListLoading, setIsListLoading] = useState(false);

    // Load users on mount and when returning from form
    useEffect(() => {
        if (!isFormMode) {
            loadUsers();
        }
    }, [isFormMode]);

    const loadUsers = async () => {
        setIsListLoading(true);
        try {
            const response = await fetch('/api/users');
            if (response.ok) {
                const data = await response.json();
                setUsers(data.users || []);
            } else {
                toast.error('Failed to load users');
            }
        } catch (error) {
            console.error('Error loading users:', error);
            toast.error('Failed to load users');
        }
        setIsListLoading(false);
    };

    // Navigation functions
    const showList = () => {
        router.push('/settings/users', undefined, { shallow: true });
    };

    const showAddForm = () => {
        router.push('/settings/users?mode=add', undefined, { shallow: true });
    };

    const showEditForm = (user) => {
        router.push(`/settings/users?mode=edit&id=${user.uuid}`, undefined, { shallow: true });
    };

    const showViewForm = (user) => {
        router.push(`/settings/users?mode=view&id=${user.uuid}`, undefined, { shallow: true });
    };

    // Form callbacks
    const handleFormCancel = () => {
        showList();
    };

    const handleFormSuccess = (result) => {
        if (result && result.action === 'edit' && result.id) {
            // Stay in edit mode for the same user
            showEditForm({ uuid: result.id });
        } else {
            // Return to list and refresh
            showList();
        }
    };

    // Table columns configuration
    const columns = useMemo(() => [
        {
            key: 'name',
            label: 'NAME',
            searchable: true,
            render: (value, row) => (
                <div className="flex items-center">
                    <div className="h-10 w-10 flex-shrink-0">
                        <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                                {row.first_name?.[0]}{row.last_name?.[0]}
                            </span>
                        </div>
                    </div>
                    <div className="ml-4">
                        <div className="font-medium text-gray-900">
                            {row.first_name} {row.last_name}
                        </div>
                    </div>
                </div>
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
                <span className="text-gray-600">{value || '-'}</span>
            )
        },
        {
            key: 'role_name',
            label: 'ROLE',
            searchable: true,
            render: (value, row) => {
                const roleName = row.Roles && row.Roles.length > 0 ? row.Roles[0].name : 'No Role';
                return (
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {roleName}
                    </span>
                );
            }
        },
        {
            key: 'email_verified',
            label: 'STATUS',
            searchable: false,
            render: (value) => (
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                    value ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                }`}>
                    {value ? 'Verified' : 'Unverified'}
                </span>
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
                        style={{ backgroundColor: '#10B9811A', color: '#10B981' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showViewForm(row);
                        }}
                        title="View User"
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
                        title="Edit User"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    // Show loading spinner for initial load
    if (!isFormMode && isListLoading && users.length === 0) {
        return (
            <Layout title="User Management">
                <div className='h-screen flex items-center justify-center'>
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="User Management">
            <div className="p-6">
                {/* LIST VIEW (when not in form mode) */}
                {!isFormMode && (
                    <>
                        {/* Header with Add Button */}
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Users</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Manage system users and their roles
                                </p>
                            </div>
                            <Button
                                color="primary"
                                size="medium"
                                label="ADD NEW USER"
                                onClick={showAddForm}
                            />
                        </div>

                        {/* Users Table */}
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                            <Table
                                columns={columns}
                                data={users}
                                isLoading={isListLoading}
                                searchPlaceholder="Search users..."
                                emptyMessage="No users found"
                                onRowClick={showViewForm}
                            />
                        </div>
                    </>
                )}

                {/* FORM VIEW (when in add/edit/view mode) */}
                {isFormMode && (
                    <UserForm
                        mode={mode}
                        userId={id}
                        onCancel={handleFormCancel}
                        onSuccess={handleFormSuccess}
                    />
                )}
            </div>
        </Layout>
    );
}