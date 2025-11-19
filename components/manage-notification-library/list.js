import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { useDispatch, useSelector } from 'react-redux';
import { handleResponse } from '../../utilities/api/responseHandler';
import { NotificationLibraryUpdateForm } from './updateForm';
import { Edit } from 'lucide-react';
import dynamic from 'next/dynamic';

const Table = dynamic(() => import('../ui-v2/Table'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));

const NotificationLibraryList = ({ dataList, refreshData }) => {
    const [list, setList] = useState([]);
    const [selectedData, setSelectedData] = useState({});
    const [showUpdateModal, setShowUpdateModal] = useState(false);

    const handleSave = async (data) => {
        if (data) {
            const response = await fetch('/api/notification-library/update', {
                method: 'POST',
                body: JSON.stringify(data),
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const resp = await handleResponse(response);

            if (resp.success) {
                toast.success("Changes successfully saved.");
            }

            onClose();
        }
    }

    function showUpdateModalHandler(data) {
        setSelectedData(data);
        setShowUpdateModal(true);
    }

    const onClose = () => {
        refreshData();
        setSelectedData({});
        setShowUpdateModal(false);
    }

    const toggleNotificationEnabled = async (data) => {
        const response = await fetch('/api/notification-library/update', {
            method: 'POST',
            body: JSON.stringify({ ...data, enabled: !data.enabled }),
            headers: {
                'Content-Type': 'application/json'
            }
        });

        const resp = await handleResponse(response);

        if (resp.success) {
            toast.success("Status updated successfully.");
        }

        refreshData();
    }

    const columns = useMemo(() => [
        {
            key: 'name',
            label: 'TITLE',
            searchable: true,
            render: (value) => (
                <span className="font-medium text-gray-900">{value}</span>
            )
        },
        {
            key: 'notification_to',
            label: 'RECIPIENT',
            searchable: true,
            render: (value) => (
                <span className="text-gray-600">{value}</span>
            )
        },
        {
            key: 'enabled',
            label: 'STATUS',
            searchable: false,
            render: (value, row) => (
                <div 
                    className="cursor-pointer inline-block"
                    onClick={() => toggleNotificationEnabled(row)}
                >
                    <StatusBadge 
                        status={value ? 'active' : 'inactive'} 
                        label={value ? 'Active' : 'Inactive'}
                    />
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
                            showUpdateModalHandler(row);
                        }}
                        title="Edit Notification"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    useEffect(() => {
        console.log('Data List Updated:', dataList);
        setList(dataList || []);
    }, [dataList]);

    return (
        <div className='pb-16'>
            {/* Table Component */}
            <Table 
                columns={columns} 
                data={list}
            />

            {/* Update Modal */}
            {showUpdateModal && (
                <NotificationLibraryUpdateForm 
                    selectedData={selectedData} 
                    closeModal={onClose} 
                    saveData={handleSave} 
                />
            )}
        </div>
    )
}

export default NotificationLibraryList;