import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Search, Edit, Power, PowerOff, Mail, FileText, Trash2 } from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));
const EmailTemplateBuilder = dynamic(() => import('./EmailTemplateBuilder'));

function EmailTemplateList() {
  const [templates, setTemplates] = useState([]);
  const [list, setList] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFiltering, setIsFiltering] = useState(false);
  const [filteredData, setFilteredData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (isFiltering) {
      setList(filteredData);
    } else {
      setList(templates);
    }
  }, [isFiltering, filteredData, templates]);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/email-templates');
      const data = await response.json();
      
      if (data.success) {
        setTemplates(data.data);
        console.log('Templates loaded:', data.data); // Debug log
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to fetch email templates');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);

    if (query.trim() === '') {
      setIsFiltering(false);
      return;
    }

    const filtered = templates.filter(template =>
      template.name?.toLowerCase().includes(query) ||
      template.subject?.toLowerCase().includes(query) ||
      template.description?.toLowerCase().includes(query)
    );

    setFilteredData(filtered);
    setIsFiltering(true);
  };

  const handleCreateNew = () => {
    setSelectedTemplate(null);
    setShowModal(true);
  };

  const handleEdit = (template) => {
    setSelectedTemplate(template);
    setShowModal(true);
  };

  const handleSave = async (templateData) => {
    try {
      const url = selectedTemplate
        ? `/api/email-templates/${selectedTemplate.id}`
        : '/api/email-templates';

      const method = selectedTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateData)
      });

      if (!response.ok) {
        throw new Error('Failed to save email template');
      }

      toast.success('Email template saved successfully');
      setShowModal(false);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (error) {
      console.error('Error saving template:', error);
      throw error;
    }
  };

  const handleToggleActive = async (template) => {
    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          is_active: !template.is_active
        })
      });

      if (!response.ok) {
        throw new Error('Failed to update template');
      }

      toast.success(`Email template ${template.is_active ? 'deactivated' : 'activated'} successfully`);
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template');
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to delete template');
      }

      toast.success('Email template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.message || 'Failed to delete template');
    }
  };

  const columns = useMemo(
    () => [
      {
        key: 'name',
        label: 'TEMPLATE NAME',
        searchable: true,
        render: (value, row) => (
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <FileText className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{value || 'Untitled Template'}</div>
              {row.description && (
                <div className="text-xs text-gray-500 mt-0.5">
                  {row.description}
                </div>
              )}
            </div>
          </div>
        )
      },
      {
        key: 'subject',
        label: 'EMAIL SUBJECT',
        searchable: true,
        render: (value, row) => (
          <div className="flex items-center space-x-2">
            <Mail className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-700">{value || '-'}</span>
          </div>
        )
      },
      {
        key: 'template_type',
        label: 'TYPE',
        searchable: false,
        render: (value, row) => {
          const config = {
            custom: { type: 'primary', label: 'Custom' },
            system: { type: 'warning', label: 'System' },
            migrated: { type: 'neutral', label: 'Migrated' }
          };
          const typeConfig = config[value] || { type: 'neutral', label: value || 'Custom' };
          
          return (
            <StatusBadge
              type={typeConfig.type}
              label={typeConfig.label}
            />
          );
        }
      },
      {
        key: 'createdAt',
        label: 'CREATED',
        searchable: false,
        render: (value, row) => (
          <span className="text-sm text-gray-600">
            {value ? new Date(value).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric'
            }) : '-'}
          </span>
        )
      },
      {
        key: 'is_active',
        label: 'STATUS',
        searchable: false,
        render: (value, row) => (
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleToggleActive(row);
            }}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-lg transition-colors group hover:bg-gray-50"
            title={row.is_active ? 'Click to deactivate' : 'Click to activate'}
          >
            {row.is_active ? (
              <>
                <Power className="w-5 h-5 text-green-600 group-hover:text-green-700" />
                <StatusBadge type="success" label="Active" />
              </>
            ) : (
              <>
                <PowerOff className="w-5 h-5 text-gray-400 group-hover:text-gray-600" />
                <StatusBadge type="neutral" label="Inactive" />
              </>
            )}
          </button>
        )
      },
      {
        key: 'actions',
        label: 'ACTIONS',
        searchable: false,
        render: (value, row) => (
          <div className="flex items-center space-x-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row);
              }}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit Template"
            >
              <Edit className="w-5 h-5" />
            </button>
            {row.template_type !== 'system' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(row);
                }}
                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete Template"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
          </div>
        )
      }
    ],
    []
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="pb-16">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Email Templates</h2>
            <p className="text-sm text-gray-600 mt-1">Create and manage email templates</p>
          </div>
          
          <Button
            type="button"
            color="primary"
            size="medium"
            label="CREATE NEW TEMPLATE"
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
            placeholder="Search templates..."
            type="text"
            value={searchQuery}
          />
        </div>
      </div>

      {/* Debug Info - Remove after fixing */}
      {process.env.NODE_ENV === 'development' && (
        <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-sm">
            <strong>Debug:</strong> Templates count: {list.length} | 
            Filtering: {isFiltering.toString()} | 
            Loading: {isLoading.toString()}
          </p>
        </div>
      )}

      {/* Empty State */}
      {list.length === 0 && !isLoading && (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No email templates found</h3>
          <p className="text-gray-600 mb-6">
            {searchQuery ? 'Try adjusting your search query' : 'Get started by creating your first email template'}
          </p>
          {!searchQuery && (
            <Button
              type="button"
              color="primary"
              size="medium"
              label="CREATE NEW TEMPLATE"
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

      {/* Modal */}
      {showModal && (
        <EmailTemplateBuilder
          templateData={selectedTemplate}
          onSave={handleSave}
          onClose={() => {
            setShowModal(false);
            setSelectedTemplate(null);
          }}
        />
      )}
    </div>
  );
}

export default EmailTemplateList;