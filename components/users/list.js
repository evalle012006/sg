import React, { useMemo, useState } from 'react';
import { UpdateForm } from "./update-form";
import { 
    Edit
} from 'lucide-react';

import dynamic from 'next/dynamic';
const Table = dynamic(() => import('../ui-v2/Table'));

function TeamMemberList(props) {

    const [modalIsVisible, setModalIsVisible] = useState(false);
    const [selectedData, setSelectedData] = useState({});

    function showUpateModalHandler(data) {
        setSelectedData(data);
        setModalIsVisible(prev => !prev);
    }

    // Updated columns configuration similar to BookingTemplateList
    const columns = useMemo(() => [
        {
            key: 'name',
            label: 'NAME',
            searchable: true,
            render: (value, row) => (
                <span className="font-medium text-gray-900">
                    {row.first_name + " " + row.last_name}
                </span>
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
            key: 'role_name',
            label: 'ROLE',
            searchable: true,
            render: (value, row) => (
                <span className="text-gray-600">
                    {row.Roles && row.Roles.length > 0 ? row.Roles[0].name : 'No Role'}
                </span>
            )
        },
        {
            key: 'actions',
            label: 'ACTION',
            searchable: false,
            render: (value, row) => (
                <div className="flex items-center space-x-2">
                    <button 
                        title="Edit User" 
                        className="p-2 rounded transition-colors duration-150 hover:opacity-80"
                        style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
                        onClick={(e) => {
                            e.stopPropagation();
                            showUpateModalHandler(row);
                        }}
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                </div>
            )
        }
    ], []);

    const data = useMemo(
        () => props.data,
        [props.data]
    );

    return (
        <div className='pb-16 pt-4'>
            <div className={`z-50 w-3/4 h-3/4 absolute ${modalIsVisible ? null : 'hidden'}`}>
                <UpdateForm selectedData={selectedData} closeModal={() => setModalIsVisible(false)} fetchUsers={props.fetchUsers} />
            </div>



            {/* Table */}
            {data && data.length > 0 ? (
                <Table 
                    data={data} 
                    columns={columns}
                    itemsPerPageOptions={[10, 15, 25, 50]}
                    defaultItemsPerPage={15}
                />
            ) : (
                <div className="flex justify-center items-center h-96">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold">No team members found</h1>
                        <p className="text-gray-500">
                            No team members to display at this time.
                        </p>
                    </div>
                </div>
            )}
        </div>
    )
}

export default TeamMemberList