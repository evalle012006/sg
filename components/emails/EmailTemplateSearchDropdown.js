import React, { useState, useEffect, useRef } from 'react';
import { Mail, Search, X, ChevronDown } from 'lucide-react';

/**
 * Searchable Email Template Dropdown
 * 
 * Similar to QuestionSearchDropdown but for email templates
 * Handles large lists with search and filtering
 */
const EmailTemplateSearchDropdown = ({ 
  templates = [], 
  value, 
  onChange, 
  disabled = false,
  placeholder = "-- Select an email template --"
}) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedTemplate = templates.find(t => t.id === parseInt(value));

  const filtered = search.trim()
    ? templates.filter(t =>
        t.name?.toLowerCase().includes(search.toLowerCase()) ||
        t.template_code?.toLowerCase().includes(search.toLowerCase()) ||
        t.subject?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : templates;

  // Group templates by type or category
  const groupedTemplates = filtered.reduce((acc, template) => {
    const category = getTemplateCategory(template);
    if (!acc[category]) acc[category] = [];
    acc[category].push(template);
    return acc;
  }, {});

  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (template) => {
    onChange(template.id);
    setSearch('');
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange(null);
    setSearch('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  function getTemplateCategory(template) {
    const name = template.name?.toLowerCase() || '';
    const code = template.template_code?.toLowerCase() || '';
    
    if (name.includes('booking') || code.includes('booking')) return 'Bookings';
    if (name.includes('course') || code.includes('course')) return 'Courses';
    if (name.includes('service') || code.includes('service')) return 'Services';
    if (name.includes('account') || name.includes('password') || name.includes('reset')) return 'Authentication';
    if (name.includes('icare') || name.includes('funding')) return 'Funding';
    if (name.includes('guest') || name.includes('profile')) return 'Guest';
    if (name.includes('internal') || name.includes('migrated')) return 'Internal/System';
    
    return 'Other';
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        onClick={handleOpen}
        className={`w-full p-2 border rounded flex items-center justify-between cursor-pointer transition-colors
          ${open ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <span className={`truncate ${selectedTemplate ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}`}>
            {selectedTemplate ? selectedTemplate.name : placeholder}
          </span>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {selectedTemplate && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
              title="Clear selection"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </div>
      </div>

      {/* Subject line preview */}
      {selectedTemplate && (
        <p className="text-xs text-gray-600 mt-1">
          Subject: {selectedTemplate.subject}
        </p>
      )}

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search Input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 px-0.5">
              {filtered.length} of {templates.length} templates
            </p>
          </div>

          {/* Template List */}
          <div className="max-h-96 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-3 text-sm text-gray-500 text-center italic">
                No templates match &quot;{search}&quot;
              </div>
            ) : (
              Object.entries(groupedTemplates).map(([category, categoryTemplates]) => (
                <div key={category} className="border-b border-gray-100 last:border-b-0">
                  {/* Category Header */}
                  <div className="px-3 py-1.5 bg-gray-50 border-b border-gray-100">
                    <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      {category}
                    </span>
                    <span className="ml-2 text-xs text-gray-400">
                      ({categoryTemplates.length})
                    </span>
                  </div>
                  
                  {/* Templates in Category */}
                  {categoryTemplates.map(template => {
                    const isSelected = template.id === parseInt(value);
                    
                    return (
                      <div
                        key={template.id}
                        onClick={() => handleSelect(template)}
                        className={`px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-b-0
                          ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`font-medium text-sm leading-snug ${isSelected ? 'text-blue-900' : 'text-gray-900'}`}>
                                {template.name}
                              </span>
                              {!template.is_active && (
                                <span className="px-1.5 py-0.5 bg-gray-200 text-gray-600 text-xs rounded">
                                  Inactive
                                </span>
                              )}
                              {template.is_system && (
                                <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                                  System
                                </span>
                              )}
                            </div>
                            <div className="flex flex-col gap-0.5 mt-1">
                              {template.subject && (
                                <span className="text-xs text-gray-500">
                                  📧 {template.subject}
                                </span>
                              )}
                              {template.template_code && (
                                <span className="text-xs text-gray-400 font-mono">
                                  {template.template_code}
                                </span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateSearchDropdown;