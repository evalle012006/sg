// components/EmailTemplateList.jsx
import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Search, Edit, Eye, Power, PowerOff, Mail, FileText, Trash2, Lock, Shield, AlertCircle } from 'lucide-react';

const Table = dynamic(() => import('../ui-v2/Table'));
const Button = dynamic(() => import('../ui-v2/Button'));
const StatusBadge = dynamic(() => import('../ui-v2/StatusBadge'));

function EmailTemplateList() {
  const router = useRouter();
  const [templates, setTemplates] = useState([]);
  const [list, setList] = useState([]);
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
      template.description?.toLowerCase().includes(query) ||
      template.template_code?.toLowerCase().includes(query)
    );

    setFilteredData(filtered);
    setIsFiltering(true);
  };

  const handleCreateNew = () => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'add', type: 'template', selectedTab: 'email-templates' }
    });
  };

  const handleEdit = (template) => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'edit', id: template.id, type: 'template', selectedTab: 'email-templates' }
    });
  };

  const handleView = (template) => {
    router.push({
      pathname: router.pathname,
      query: { mode: 'view', id: template.id, type: 'template', selectedTab: 'email-templates' }
    });
  };

  const handleToggleActive = async (template) => {
    // ✅ PROTECTION: Prevent deactivating system templates
    if (template.is_system && template.is_active) {
      toast.error(
        <div>
          <strong className="block mb-1">Cannot Deactivate System Template</strong>
          <p className="text-sm">This template is required by the system and cannot be deactivated.</p>
        </div>,
        { autoClose: 5000 }
      );
      return;
    }

    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...template,
          is_active: !template.is_active
        })
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (result.is_system) {
          toast.error(
            <div>
              <strong className="block mb-1">{result.error || 'Cannot Modify System Template'}</strong>
              <p className="text-sm">{result.message}</p>
            </div>,
            { autoClose: 6000 }
          );
        } else {
          throw new Error(result.message || 'Failed to update template');
        }
        return;
      }

      toast.success('Email template updated successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error(error.message || 'Failed to update template');
    }
  };

  const handleDelete = async (template) => {
    // ✅ PROTECTION: Prevent deletion of system templates
    if (template.is_system) {
      toast.error(
        <div>
          <strong className="block mb-1">Cannot Delete System Template</strong>
          <p className="text-sm">
            This template (<code className="px-1 py-0.5 bg-red-100 rounded font-mono text-xs">{template.template_code}</code>) is required by the system and cannot be deleted.
          </p>
          <p className="text-sm mt-2">You can only modify its appearance while preserving required variables.</p>
        </div>,
        { autoClose: 7000 }
      );
      return;
    }

    if (!confirm(`Are you sure you want to delete "${template.name}"?\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE'
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (result.error === 'Template in use') {
          toast.error(
            <div>
              <strong className="block mb-1">Cannot Delete Template</strong>
              <p className="text-sm">{result.message}</p>
              <p className="text-sm mt-2">Please remove or reassign the triggers first.</p>
            </div>,
            { autoClose: 7000 }
          );
        } else if (result.is_system) {
          toast.error(result.message || 'Cannot delete system template');
        } else {
          throw new Error(result.message || 'Failed to delete template');
        }
        return;
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
          <div>
            <div className="font-medium text-gray-900 flex items-center gap-2 flex-wrap">
              <span>{value}</span>
              {row.is_system && (
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
                  <Lock className="w-3 h-3 mr-1" />
                  System
                </span>
              )}
            </div>
            {row.template_code && (
              <div className="text-xs text-gray-500 mt-1">
                Code: <code className="px-1 py-0.5 bg-gray-100 rounded font-mono">{row.template_code}</code>
              </div>
            )}
            {row.description && (
              <div className="text-xs text-gray-600 mt-1.5 line-clamp-2">
                {row.description}
              </div>
            )}
          </div>
        )
      },
      {
        key: 'subject',
        label: 'SUBJECT',
        searchable: true,
        render: (value) => (
          <div className="text-sm text-gray-700 max-w-md">
            <div className="line-clamp-2">{value}</div>
          </div>
        )
      },
      {
        key: 'required_variables',
        label: 'REQUIRED VARS',
        searchable: false,
        render: (value, row) => {
          if (!row.is_system || !value || value.length === 0) {
            return <span className="text-xs text-gray-400">-</span>;
          }
          
          return (
            <div className="text-xs">
              <div className="font-medium text-gray-700 mb-1.5 flex items-center gap-1">
                <AlertCircle className="w-3 h-3 text-yellow-600" />
                {value.length} required
              </div>
              <div className="space-y-0.5">
                {value.slice(0, 2).map((varName, idx) => (
                  <div key={idx} className="font-mono text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded">
                    {`{{${varName}}}`}
                  </div>
                ))}
                {value.length > 2 && (
                  <div className="text-gray-500 italic pt-0.5">
                    +{value.length - 2} more
                  </div>
                )}
              </div>
            </div>
          );
        }
      },
      {
        key: 'is_active',
        label: 'STATUS',
        searchable: false,
        render: (value, row) => (
          <div className="flex flex-col gap-1">
            <StatusBadge 
              type={value ? 'success' : 'neutral'}
              label={value ? 'Active' : 'Inactive'}
            />
            {row.is_system && value && (
              <span className="text-xs text-yellow-700 flex items-center gap-1">
                <Lock className="w-3 h-3" />
                Required
              </span>
            )}
          </div>
        )
      },
      {
        key: 'updated_at',
        label: 'LAST UPDATED',
        searchable: false,
        render: (value) => (
          <div className="text-sm text-gray-600">
            {value ? new Date(value).toLocaleDateString() : 'N/A'}
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
                handleView(row);
              }}
              title="View Template"
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
              title={row.is_system ? "Edit Appearance (System Template)" : "Edit Template"}
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              className={`p-2 rounded transition-colors duration-150 ${
                row.is_system && row.is_active
                  ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400'
                  : row.is_active 
                    ? 'bg-red-100 text-red-600 hover:opacity-80' 
                    : 'bg-green-100 text-green-600 hover:opacity-80'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActive(row);
              }}
              disabled={row.is_system && row.is_active}
              title={
                row.is_system && row.is_active 
                  ? 'System templates cannot be deactivated'
                  : row.is_active 
                    ? 'Deactivate' 
                    : 'Activate'
              }
            >
              {row.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
            <button 
              className={`p-2 rounded transition-colors duration-150 ${
                row.is_system 
                  ? 'opacity-40 cursor-not-allowed bg-gray-100 text-gray-400' 
                  : 'hover:opacity-80'
              }`}
              style={!row.is_system ? { backgroundColor: '#00467F1A', color: '#00467F' } : {}}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              disabled={row.is_system}
              title={row.is_system ? "System templates cannot be deleted" : "Delete Template"}
            >
              {row.is_system ? <Lock className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        )
      }
    ],
    []
  );

  // Count system templates
  const systemTemplateCount = templates.filter(t => t.is_system).length;

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
            <p className="text-sm text-gray-600 mt-1">
              Create and manage email templates
              {systemTemplateCount > 0 && (
                <span className="ml-2 text-yellow-700">
                  • {systemTemplateCount} system template{systemTemplateCount !== 1 ? 's' : ''} protected
                </span>
              )}
            </p>
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

      {/* System Templates Info Banner */}
      {systemTemplateCount > 0 && (
        <div className="mb-6 bg-blue-50 border-l-4 border-blue-400 rounded-r-lg overflow-hidden">
          <div className="p-4">
            <div className="flex items-start">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5 mr-3 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-blue-900 mb-1">
                  System Template Protection
                </h3>
                <p className="text-sm text-blue-800 leading-relaxed">
                  Templates marked with <Lock className="w-3 h-3 inline mx-0.5" /> are system-critical and cannot be deleted or deactivated.
                  You can modify their appearance, but required variables (shown in the table) must be preserved for the system to function correctly.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-5 w-5 text-gray-400" />
          </span>
          <input
            className="w-full bg-white border border-gray-300 rounded-lg py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            onChange={handleSearch}
            placeholder="Search templates by name, subject, code..."
            type="text"
            value={searchQuery}
          />
        </div>
      </div>

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
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
          <Table 
            data={list}
            columns={columns}
            itemsPerPageOptions={[10, 15, 25, 50]}
            defaultItemsPerPage={15}
          />
        </div>
      )}

      {/* Footer Info */}
      {list.length > 0 && (
        <div className="mt-4 text-xs text-gray-500 text-center">
          Showing {list.length} template{list.length !== 1 ? 's' : ''}
          {systemTemplateCount > 0 && (
            <span className="ml-2">
              • {systemTemplateCount} system-protected
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default EmailTemplateList;