import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Search, Edit, Power, PowerOff, TrendingUp, Mail } from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const EmailTriggerForm = dynamic(() => import('../manage-email-trigger/EmailTriggerForm'))

function EmailTriggerList({ refreshData }) {
  const emailTriggerData = useSelector(state => state.emailTrigger.list);
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTrigger, setSelectedTrigger] = useState(null);
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
    setSelectedTrigger(null);
    setShowModal(true);
  };

  const handleEdit = (trigger) => {
    setSelectedTrigger(trigger);
    setShowModal(true);
  };

  const handleSave = async (formData) => {
    try {
      const url = selectedTrigger
        ? '/api/email-triggers/update'
        : '/api/email-triggers/create';

      const method = 'POST';
      const payload = selectedTrigger
        ? { ...formData, id: selectedTrigger.id }
        : formData;

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save email trigger');
      }

      toast.success('Email trigger saved successfully');
      setShowModal(false);
      setSelectedTrigger(null);
      refreshData();
    } catch (error) {
      console.error('Error saving trigger:', error);
      throw error;
    }
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

      toast.success(`Email trigger ${trigger.enabled ? 'disabled' : 'enabled'} successfully`);
      refreshData();
    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error('Failed to update trigger');
    }
  };

  const columns = useMemo(
    () => [
      {
        Header: 'Recipient',
        accessor: 'recipient',
        Cell: ({ value }) => (
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="font-medium text-gray-900">{value}</span>
          </div>
        )
      },
      {
        Header: 'Email Template',
        accessor: 'template_name',
        Cell: ({ row: { original } }) => (
          <div>
            <div className="font-medium text-gray-900">{original.template_name}</div>
            {original.template && (
              <div className="text-xs text-gray-500 mt-0.5">
                {original.template.subject}
              </div>
            )}
          </div>
        )
      },
      {
        Header: 'Type',
        accessor: 'type',
        Cell: ({ value }) => {
          const config = {
            highlights: { color: 'info', label: 'Highlights' },
            external: { color: 'success', label: 'External' },
            internal: { color: 'warning', label: 'Internal' }
          };
          const typeConfig = config[value] || { color: 'default', label: value };
          
          return (
            <StatusBadge
              status={typeConfig.color}
              label={typeConfig.label}
            />
          );
        }
      },
      {
        Header: 'Trigger Conditions',
        accessor: 'trigger_questions',
        Cell: ({ value }) => (
          <div className="space-y-1.5 max-w-md">
            {value && value.length > 0 ? (
              value.slice(0, 2).map((question, index) => (
                <div key={index} className="bg-gray-50 rounded px-2 py-1 text-xs border border-gray-200">
                  <p className="font-medium text-gray-700 truncate">
                    {index + 1}. {question.question}
                  </p>
                  {question.answer && (
                    <p className="text-gray-500 mt-0.5">
                      Answer: <span className="font-medium">{question.answer}</span>
                    </p>
                  )}
                </div>
              ))
            ) : (
              <span className="text-gray-400 text-xs italic">No conditions</span>
            )}
            {value && value.length > 2 && (
              <p className="text-xs text-blue-600">
                +{value.length - 2} more condition{value.length - 2 > 1 ? 's' : ''}
              </p>
            )}
          </div>
        )
      },
      {
        Header: 'Statistics',
        accessor: 'trigger_count',
        Cell: ({ row: { original } }) => (
          <div className="flex items-center space-x-2">
            <TrendingUp className="w-4 h-4 text-gray-400" />
            <div className="text-sm">
              <div className="font-medium text-gray-900">
                {original.trigger_count || 0} sent
              </div>
              {original.last_triggered_at && (
                <div className="text-xs text-gray-500">
                  Last: {new Date(original.last_triggered_at).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>
        )
      },
      {
        Header: 'Status',
        accessor: 'enabled',
        Cell: ({ row: { original } }) => (
          <button
            onClick={() => handleToggleEnabled(original)}
            className="group flex items-center space-x-2"
            title={original.enabled ? 'Click to disable' : 'Click to enable'}
          >
            {original.enabled ? (
              <>
                <Power className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                <StatusBadge status="success" label="Active" />
              </>
            ) : (
              <>
                <PowerOff className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                <StatusBadge status="default" label="Inactive" />
              </>
            )}
          </button>
        )
      },
      {
        Header: 'Action',
        accessor: 'action',
        Cell: ({ row: { original } }) => (
          <button
            onClick={() => handleEdit(original)}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Edit Trigger"
          >
            <Edit className="w-5 h-5" />
          </button>
        )
      }
    ],
    [refreshData]
  );

  return (
    <div className="pb-16">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Triggers</h2>
            <p className="text-sm text-gray-600 mt-1">Manage automated email notifications</p>
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

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table columns={columns} data={list} />
      </div>

      {/* Modal */}
      {showModal && (
        <EmailTriggerForm
          trigger={selectedTrigger}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setSelectedTrigger(null);
          }}
        />
      )}
    </div>
  );
}

export default EmailTriggerList;