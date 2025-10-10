import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Plus, Search, Edit, Eye, Power, PowerOff, Mail, FileText, Trash2 } from 'lucide-react';

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
      template.description?.toLowerCase().includes(query)
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

      toast.success('Email template updated successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to update template');
    }
  };

  const handleDelete = async (template) => {
    if (!confirm(`Are you sure you want to delete the template "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/email-templates/${template.id}`, {
        method: 'DELETE'
      });

      if (!response.ok) {
        throw new Error('Failed to delete template');
      }

      toast.success('Email template deleted successfully');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Failed to delete template');
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
            <div className="font-medium text-gray-900">{value}</div>
            {row.description && (
              <div className="text-xs text-gray-500">{row.description}</div>
            )}
          </div>
        )
      },
      {
        key: 'subject',
        label: 'SUBJECT',
        searchable: true,
        render: (value) => (
          <div className="text-sm text-gray-700">{value}</div>
        )
      },
      {
        key: 'is_active',
        label: 'STATUS',
        searchable: false,
        render: (value) => (
          <StatusBadge 
            type={value ? 'success' : 'neutral'}
            label={value ? 'Active' : 'Inactive'}
          />
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
              title="Edit Template"
            >
              <Edit className="w-4 h-4" />
            </button>
            <button 
              className={`p-2 rounded transition-colors duration-150 hover:opacity-80 ${
                row.is_active 
                  ? 'bg-red-100 text-red-600' 
                  : 'bg-green-100 text-green-600'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                handleToggleActive(row);
              }}
              title={row.is_active ? 'Deactivate' : 'Activate'}
            >
              {row.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
            </button>
            <button 
              className="p-2 rounded transition-colors duration-150 hover:opacity-80"
              style={{ backgroundColor: '#00467F1A', color: '#00467F' }}
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row);
              }}
              title="Delete Template"
            >
              <Trash2 className="w-4 h-4" />
            </button>
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
    </div>
  );
}

export default EmailTemplateList;