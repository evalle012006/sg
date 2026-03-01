import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Edit, Eye, Trash2 } from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const ConfirmDialog = dynamic(() => import('../ui-v2/ConfirmDialog'));

// Inline Toggle Component
const Toggle = ({ checked, onChange, disabled = false }) => {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      className={`
        relative inline-flex h-6 w-11 items-center rounded-full
        transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 
        focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed
        ${checked ? 'bg-blue-600' : 'bg-gray-300'}
      `}
    >
      <span
        className={`
          inline-block h-4 w-4 transform rounded-full bg-white shadow-lg
          transition-transform duration-200 ease-in-out
          ${checked ? 'translate-x-6' : 'translate-x-1'}
        `}
      />
    </button>
  );
};

function EmailTriggerList({ refreshData }) {
  const router = useRouter();
  const emailTriggerData = useSelector(state => state.emailTrigger.list);
  const [list, setList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: '',
    confirmText: 'Confirm',
    onConfirm: null
  });
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    const sortByEnabled = (data) => {
      if (!Array.isArray(data)) return data;
      return [...data].sort((a, b) => {
        if (a.enabled === b.enabled) return 0;
        return a.enabled ? -1 : 1;
      });
    };

    if (isFiltering) {
      setList(sortByEnabled(filteredData));
    } else {
      setList(sortByEnabled(emailTriggerData));
    }
  }, [isFiltering, filteredData, emailTriggerData]);

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

  const handleToggleEnabled = (trigger) => {
    const isEnabling = !trigger.enabled;
    
    setConfirmDialog({
      isOpen: true,
      type: isEnabling ? 'success' : 'warning',
      title: `${isEnabling ? 'Enable' : 'Disable'} Email Trigger?`,
      message: isEnabling 
        ? `This trigger will start sending emails when conditions are met.\n\nRecipient: ${trigger.recipient}`
        : `This trigger will stop sending emails when conditions are met. You can re-enable it at any time.\n\nRecipient: ${trigger.recipient}`,
      confirmText: isEnabling ? 'Enable' : 'Disable',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const response = await fetch('/api/email-triggers/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: trigger.id,
              enabled: isEnabling,
              recipient: trigger.recipient,
              email_template_id: trigger.email_template_id,
              type: trigger.type,
              trigger_conditions: trigger.trigger_conditions,
              trigger_questions: (trigger.triggerQuestions || []).map(tq => ({
                question_id: tq.question_id,
                question: tq.question?.question || '',
                question_key: tq.question?.question_key || '',
                question_type: tq.question?.type || '',
                answer: tq.answer || '',
                section_id: tq.question?.section_id,
                options: tq.question?.options || []
              }))
            })
          });

          const responseData = await response.json();

          if (!response.ok || !responseData.success) {
            throw new Error(responseData.errors?.join(', ') || responseData.message || 'Failed to update trigger');
          }

          toast.success(`Email trigger ${isEnabling ? 'enabled' : 'disabled'} successfully`);
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          refreshData();

        } catch (error) {
          console.error('Error toggling trigger:', error);
          toast.error(error.message || 'Failed to update trigger');
        } finally {
          setIsProcessing(false);
        }
      }
    });
  };

  const handleDelete = (trigger) => {
    // Check if trigger is active/enabled
    if (trigger.enabled) {
      setConfirmDialog({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Delete Active Trigger',
        message: `This email trigger is currently active and cannot be deleted.\n\nPlease disable the trigger first before attempting to delete it.\n\nRecipient: ${trigger.recipient}\nTemplate: ${trigger.template?.name || 'N/A'}`,
        confirmText: 'OK',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      });
      return;
    }

    // Trigger is disabled, proceed with deletion confirmation
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: 'Delete Email Trigger?',
      message: `Are you sure you want to delete this email trigger? This action cannot be undone.\n\nRecipient: ${trigger.recipient}\nTemplate: ${trigger.template?.name || 'N/A'}`,
      confirmText: 'Delete',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const response = await fetch(`/api/email-triggers/${trigger.id}`, {
            method: 'DELETE'
          });

          const data = await response.json();

          if (!response.ok) {
            // Handle specific error cases
            if (data.trigger_enabled) {
              throw new Error('Cannot delete an active trigger. Please disable it first.');
            }
            throw new Error(data.message || 'Failed to delete trigger');
          }

          toast.success('Email trigger deleted successfully');
          setConfirmDialog({ ...confirmDialog, isOpen: false });
          refreshData();
        } catch (error) {
          console.error('Error deleting trigger:', error);
          toast.error(error.message || 'Failed to delete trigger');
        } finally {
          setIsProcessing(false);
        }
      }
    });
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
        render: (value, row) => {
          // Use triggerQuestions (relational) if available, otherwise fall back to old JSON field
          let qCount = 0;
          
          if (row.triggerQuestions && Array.isArray(row.triggerQuestions)) {
            qCount = row.triggerQuestions.length;
          } else {
            let parsedQuestions = value;
            if (typeof value === 'string') {
              try { parsedQuestions = JSON.parse(value); } catch { parsedQuestions = []; }
            }
            qCount = Array.isArray(parsedQuestions) ? parsedQuestions.length : 0;
          }
          
          return (
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                {qCount} {qCount === 1 ? 'condition' : 'conditions'}
              </span>
            </div>
          );
        }
      },
      {
        key: 'enabled',
        label: 'STATUS',
        searchable: false,
        render: (value, row) => (
          <div className="flex items-center gap-3">
            <Toggle
              checked={value}
              onChange={(e) => {
                e.stopPropagation();
                handleToggleEnabled(row);
              }}
              disabled={isProcessing}
            />
            <span className={`text-sm font-medium ${value ? 'text-green-600' : 'text-gray-500'}`}>
              {value ? 'Active' : 'Disabled'}
            </span>
          </div>
        )
      },
      {
        key: 'actions',
        label: 'ACTIONS',
        searchable: false,
        render: (value, row) => (
          <div className="flex items-center gap-2">
            <button 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#3B82F61A', color: '#3B82F6' }}
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
              style={{ backgroundColor: '#DC26261A', color: '#DC2626' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              title="Delete Trigger"
              disabled={row.enabled}
            >
              <Trash2 className={`w-4 h-4 ${row.enabled ? 'opacity-50' : ''}`} />
            </button>
          </div>
        )
      }
    ],
    [isProcessing]
  );

  return (
    <div className="pb-16">
      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        onConfirm={confirmDialog.onConfirm}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        type={confirmDialog.type}
        isLoading={isProcessing}
      />

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

      {/* Empty State */}
      {list.length === 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
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