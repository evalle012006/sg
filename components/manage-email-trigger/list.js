import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Search, Edit, Eye, Power, PowerOff, Trash2 } from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const ToggleButton = dynamic(() => import('../ui/toggle'));

function EmailTriggerList({ refreshData }) {
  const router = useRouter();
  const emailTriggerData = useSelector(state => state.emailTrigger.list);
  const [list, setList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);

  useEffect(() => {
    if (isFiltering) {
      setList(filteredData);
    } else {
      setList(emailTriggerData);
    }
  }, [isFiltering, filteredData, emailTriggerData]);

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.trim() === '') {
      setIsFiltering(false);
      return;
    }

    const filtered = emailTriggerData.filter(trigger =>
      trigger.recipient?.toLowerCase().includes(query) ||
      trigger.template_name?.toLowerCase().includes(query) ||
      trigger.type?.toLowerCase().includes(query)
    );

    setFilteredData(filtered);
    setIsFiltering(true);
  };

  const handleCreateNew = () => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'add', type: 'trigger', selectedTab: 'email-triggers' }
    });
  };

  const handleEdit = (trigger) => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'edit', id: trigger.id, type: 'trigger', selectedTab: 'email-triggers' }
    });
  };

  const handleView = (trigger) => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'view', id: trigger.id, type: 'trigger', selectedTab: 'email-triggers' }
    });
  };

  const handleToggleEnabled = async (trigger) => {
    try {
      const response = await fetch('/api/email-triggers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...trigger,
          enabled: !trigger.enabled
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update trigger');
      }

      toast.success('Email trigger updated successfully');
      refreshData();
    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error('Failed to update trigger');
    }
  };

  const handleDelete = async (trigger) => {
    if (!confirm(`Are you sure you want to delete the trigger for "${trigger.recipient}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/email-triggers/${trigger.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete trigger');
      }

      toast.success('Email trigger deleted successfully');
      refreshData();
    } catch (error) {
      console.error('Error deleting trigger:', error);
      toast.error('Failed to delete trigger');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'recipient',
        label: 'RECIPIENT',
        searchable: true,
        render: (value) => (
          <div className="font-medium text-gray-900">{value}</div>
        )
      },
      {
        key: 'template_name',
        label: 'EMAIL TEMPLATE',
        searchable: true,
        render: (value, row) => (
          <div>
            <div className="font-medium">{value}</div>
            {row.template && (
              <div className="text-xs text-gray-500">
                {row.template.subject}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'type',
        label: 'TYPE',
        searchable: true,
        render: (value) => {
          const colors = {
            highlights: 'bg-blue-100 text-blue-800',
            external: 'bg-green-100 text-green-800',
            internal: 'bg-purple-100 text-purple-800'
          };
          return (
            <span className={`px-2 py-1 rounded text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-800'}`}>
              {value}
            </span>
          );
        }
      },
      {
        key: 'trigger_questions',
        label: 'CONDITIONS',
        searchable: false,
        render: (value) => (
          <div className="text-sm text-gray-600">
            {value?.length || 0} condition{value?.length !== 1 ? 's' : ''}
          </div>
        )
      },
      {
        key: 'enabled',
        label: 'STATUS',
        searchable: false,
        render: (value, row) => (
          <ToggleButton
            checked={value}
            onChange={() => handleToggleEnabled(row)}
          />
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
                handleView(row);
              }}
              title="View Trigger"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#FFA5001A', color: '#FFA500' }}
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              title="Edit Trigger"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              title="Delete Trigger"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )
      }
    ],
    []
  );

  return (
    <div className="pb-16">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Triggers</h2>
            <p className="text-sm text-gray-600 mt-1">Configure automated email notifications</p>
          </div>
          
          <Button
            type="button"
            color="primary"
            size="medium"
            label="CREATE NEW TRIGGER"
            onClick={handleCreateNew}
            icon={<Plus className="w-4 h-4" />}
          />
        </div>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </span>
          <input
            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={handleSearch}
            placeholder="Search triggers..."
            type="text"
            value={searchQuery}
          />
        </div>
      </div>

      {/* Empty State */}
      {list.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Power className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No email triggers found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ? 'Try adjusting your search query' : 'Get started by creating your first email trigger'}
          </p>
          {!searchQuery && (
            <Button
              type="button"
              color="primary"
              size="medium"
              label="CREATE NEW TRIGGER"
              onClick={handleCreateNew}
              icon={<Plus className="w-4 h-4" />}
            />
          )}
        </div>
      )}

      {/* Table */}
      {list.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table 
            data={list}
            columns={columns}
            itemsPerPageOptions={[10, 15, 25, 50]}
            defaultItemsPerPage={15}
          />
        </div>
      )}
    </div>
  );
}

export default EmailTriggerList;