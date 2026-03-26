import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Edit, Eye, Trash2, Code2 } from 'lucide-react';

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
        // System triggers first, then by enabled status
        if (a.type === 'system' && b.type !== 'system') return -1;
        if (a.type !== 'system' && b.type === 'system') return 1;
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

  const getRecipientLabel = (value) => {
    if (!value) return 'No recipient';
    if (value === 'guest_email') return { label: 'Guest Email', icon: '👤', isSpecial: true };
    if (value === 'user_email')            return { label: 'User Email',  icon: '🧑‍💼', isSpecial: true };
    if (value.startsWith('recipient_type:')) {
      const type = value.split(':')[1];
      const icons = { info: 'ℹ️', admin: '⚙️', eoi: '📝' };
      const labels = { info: 'Info Team', admin: 'Admin Team', eoi: 'EOI Team' };
      return { label: labels[type] || type, icon: icons[type] || '📬', isSpecial: true, isDynamic: true };
    }
    return { label: value, icon: '✉️', isSpecial: false };
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

  const handleToggleEnabled = (trigger) => {
    const isEnabling = !trigger.enabled;
    
    setConfirmDialog({
      isOpen: true,
      type: isEnabling ? 'success' : 'warning',
      title: `${isEnabling ? 'Enable' : 'Disable'} Email Trigger?`,
      message: isEnabling 
        ? `This trigger will start sending emails when conditions are met.\n\nRecipient: ${getRecipientLabel(trigger.recipient).label}`
        : `This trigger will stop sending emails when conditions are met. You can re-enable it at any time.\n\nRecipient: ${getRecipientLabel(trigger.recipient).label}`,
      confirmText: isEnabling ? 'Enable' : 'Disable',
      onConfirm: () => performToggle(trigger)
    });
  };

  const performToggle = async (trigger) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/email-triggers/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: trigger.id,
          enabled: !trigger.enabled,
          recipient: trigger.recipient,
          email_template_id: trigger.email_template_id,
          type: trigger.type,
          trigger_conditions: trigger.trigger_conditions,
          trigger_context: trigger.trigger_context,
          context_conditions: trigger.context_conditions,
          description: trigger.description,
          priority: trigger.priority,
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

      toast.success(`Email trigger ${!trigger.enabled ? 'enabled' : 'disabled'} successfully`);
      setConfirmDialog({ ...confirmDialog, isOpen: false });
      refreshData();

    } catch (error) {
      console.error('Error toggling trigger:', error);
      toast.error(error.message || 'Failed to update trigger');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = (trigger) => {
    // Check if trigger is active/enabled
    if (trigger.enabled) {
      setConfirmDialog({
        isOpen: true,
        type: 'warning',
        title: 'Cannot Delete Active Trigger',
        message: `This email trigger is currently active and cannot be deleted.\n\nPlease disable the trigger first before attempting to delete it.\n\nRecipient: ${getRecipientLabel(trigger.recipient).label}\nTemplate: ${trigger.template?.name || 'N/A'}`,
        confirmText: 'OK',
        onConfirm: () => {
          setConfirmDialog({ ...confirmDialog, isOpen: false });
        }
      });
      return;
    }

    // Trigger is disabled, proceed with deletion confirmation
    const triggerTypeLabel = trigger.type === 'system' ? 'system trigger' : 'email trigger';
    setConfirmDialog({
      isOpen: true,
      type: 'danger',
      title: `Delete ${triggerTypeLabel}?`,
      message: `Are you sure you want to delete this ${triggerTypeLabel}? This action cannot be undone.\n\n${trigger.description || `Recipient: ${getRecipientLabel(trigger.recipient).label}`}\nTemplate: ${trigger.template?.name || 'N/A'}`,
      confirmText: 'Delete',
      onConfirm: async () => {
        setIsProcessing(true);
        try {
          const response = await fetch(`/api/email-triggers/${trigger.id}`, {
            method: 'DELETE'
          });

          const data = await response.json();

          if (!response.ok) {
            if (data.trigger_enabled) {
              throw new Error('Cannot delete an active trigger. Please disable it first.');
            }
            throw new Error(data.message || 'Failed to delete trigger');
          }

          toast.success(`${triggerTypeLabel} deleted successfully`);
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

  // Helper function to get friendly trigger context name
  const getTriggerContextName = (context) => {
    const contextNames = {
      'booking_status_changed': 'Booking Status Changed',
      'booking_confirmed': 'Booking Confirmed',
      'booking_cancelled': 'Booking Cancelled',
      'booking_amended': 'Booking Amended',
      'icare_funding_updated': 'iCare Funding Updated',
      'course_eoi_submitted': 'Course EOI Submitted',
      'course_eoi_accepted': 'Course EOI Accepted',
      'course_offer_sent': 'Course Offer Sent',
      'account_created': 'Account Created',
      'password_reset_requested': 'Password Reset',
      'email_verification_requested': 'Email Verification',
      'guest_profile_updated': 'Profile Updated'
    };
    return contextNames[context] || context;
  };

  const columns = useMemo(
    () => [
      {
        key: 'type',
        label: 'TYPE',
        searchable: true,
        render: (value, row) => {
          const colors = {
            system: 'bg-orange-100 text-orange-800 border border-orange-300',
            highlights: 'bg-blue-100 text-blue-800',
            external: 'bg-green-100 text-green-800',
            internal: 'bg-purple-100 text-purple-800'
          };
          return (
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-xs font-medium ${colors[value] || 'bg-gray-100 text-gray-800'}`}>
                {value}
              </span>
              {value === 'system' && (
                <Code2 className="w-4 h-4 text-orange-600" title="System Trigger" />
              )}
            </div>
          );
        }
      },
      {
        key: 'description',
        label: 'DESCRIPTION',
        searchable: true,
        render: (value, row) => (
          <div>
            <div className="font-medium text-gray-900">
              {row.type === 'system' && row.description ? row.description : (row.recipient || 'N/A')}
            </div>
            {row.type === 'system' && row.trigger_context && (
              <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                  {getTriggerContextName(row.trigger_context)}
                </span>
                {row.context_conditions && Object.keys(row.context_conditions).length > 0 && (
                  <span className="text-gray-400">
                    · {Object.keys(row.context_conditions).length} condition{Object.keys(row.context_conditions).length > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'recipient',
        label: 'RECIPIENT',
        searchable: true,
        render: (value, row) => {
          const { label, icon, isSpecial, isDynamic } = getRecipientLabel(value);

          if (!value || value === 'guest_email' || value === 'user_email') {
            return (
              <span className="inline-flex items-center gap-1.5 text-sm text-gray-600">
                <span>{icon}</span>
                <span>{label}</span>
              </span>
            );
          }

          if (value.startsWith('recipient_type:')) {
            return (
              <div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700">
                  <span>{icon}</span>
                  <span>{label}</span>
                </span>
                <p className="text-xs text-gray-400 mt-0.5">Dynamic</p>
              </div>
            );
          }

          // Raw email address(es)
          return <div className="text-sm text-gray-900">{value}</div>;
        }
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
        key: 'trigger_questions',
        label: 'CONDITIONS',
        searchable: false,
        render: (value, row) => {
          // System triggers show trigger event + context conditions
          if (row.type === 'system') {
            const contextName = getTriggerContextName(row.trigger_context);
            const conditionCount = row.context_conditions 
              ? Object.keys(row.context_conditions).length 
              : 0;

            return (
              <div className="space-y-1">
                {/* Always show the trigger event */}
                <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                  {contextName}
                </div>
                
                {/* Show additional context conditions if present */}
                {conditionCount > 0 && (
                  <div className="text-xs text-gray-600">
                    + {conditionCount} condition{conditionCount > 1 ? 's' : ''}
                    <div className="mt-0.5 space-y-0.5">
                      {Object.entries(row.context_conditions).map(([key, value]) => (
                        <div key={key} className="font-mono text-xs bg-gray-50 px-1.5 py-0.5 rounded">
                          {key}={value}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Form-based triggers show question conditions
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
                {qCount} {qCount === 1 ? 'question' : 'questions'}
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
              title={row.enabled ? 'Disable trigger before deleting' : 'Delete Trigger'}
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

        {/* Info Banner */}
        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="ml-3">
              <p className="text-sm text-blue-800">
                <span className="font-medium">🔧 System Event Triggers</span> (orange badge with code icon) fire when specific code events occur (booking confirmed, course offered, etc).
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <span className="font-medium">📋 Booking Form Triggers</span> fire based on guest answers to booking questions.
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Both types can be created, edited, and deleted through this interface.
              </p>
            </div>
          </div>
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