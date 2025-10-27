import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { 
  Home, Save, Info, Eye, Code, Edit3, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link2, 
  Image as ImageIcon, Type, Palette, Minus, ChevronDown, RefreshCw,
  X
} from 'lucide-react';
import TemplateHelperDocumentation from './TemplateHelperDocumentation';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Spinner = dynamic(() => import('../ui/spinner'));

const EmailTemplateBuilder = ({ mode, templateId, onCancel, onSuccess }) => {
  const isAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  
  const editorRef = useRef(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [content, setContent] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [showMergeTags, setShowMergeTags] = useState(false);
  const [templateData, setTemplateData] = useState(null);
  const [viewMode, setViewMode] = useState('editor');
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [showHelperMenu, setShowHelperMenu] = useState(false);
  const [selectedMergeTag, setSelectedMergeTag] = useState(null);
  const [showHelperModal, setShowHelperModal] = useState(false);
  
  const [mergeTagsGrouped, setMergeTagsGrouped] = useState({});
  const [isLoadingMergeTags, setIsLoadingMergeTags] = useState(true);
  const [mergeTagsError, setMergeTagsError] = useState(null);

  const commonColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  ];

  // NEW: Fetch dynamic merge tags on component mount
  useEffect(() => {
    fetchMergeTags();
  }, []);

  useEffect(() => {
    if (templateId && !isAddMode) {
      fetchTemplate();
    } else {
      setContent('');
      setIsPageLoading(false);
    }
  }, [templateId, isAddMode]);

  // NEW: Fetch dynamic merge tags from API
  const fetchMergeTags = async () => {
    try {
      setIsLoadingMergeTags(true);
      setMergeTagsError(null);
      
      const response = await fetch('/api/email-templates/merge-tags');
      
      if (!response.ok) {
        throw new Error('Failed to fetch merge tags');
      }
      
      const data = await response.json();
      
      if (data.success) {
        setMergeTagsGrouped(data.data);
      } else {
        throw new Error(data.message || 'Failed to load merge tags');
      }
    } catch (error) {
      console.error('Error fetching merge tags:', error);
      setMergeTagsError(error.message);
      toast.error('Failed to load merge tags. Using defaults.');
      
      // Fallback to basic merge tags if API fails
      setMergeTagsGrouped({
        'Guest Information': [
          { label: 'Guest Name', value: '{{guest_name}}', description: 'Full name of the guest' },
          { label: 'Guest Email', value: '{{guest_email}}', description: 'Guest email address' },
          { label: 'Guest Phone', value: '{{guest_phone}}', description: 'Guest phone number' },
        ],
        'Booking Details': [
          { label: 'Booking Reference', value: '{{booking_reference}}', description: 'Unique booking ID' },
          { label: 'Check-in Date', value: '{{checkin_date}}', description: 'Arrival date' },
          { label: 'Check-out Date', value: '{{checkout_date}}', description: 'Departure date' },
        ],
      });
    } finally {
      setIsLoadingMergeTags(false);
    }
  };

  const fetchTemplate = async () => {
    try {
      setIsPageLoading(true);
      const response = await fetch(`/api/email-templates/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const template = data.data;
          setTemplateData(template);
          setName(template.name || '');
          setSubject(template.subject || '');
          setDescription(template.description || '');
          setContent(template.html_content || '');
        }
      }
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Failed to load template');
    } finally {
      setIsPageLoading(false);
    }
  };

  const validateFields = () => {
    let isValid = true;

    if (!name.trim()) {
      setNameError('Template name is required');
      isValid = false;
    } else if (name.trim().length < 3) {
      setNameError('Template name must be at least 3 characters');
      isValid = false;
    } else {
      setNameError('');
    }

    if (!subject.trim()) {
      setSubjectError('Email subject is required');
      isValid = false;
    } else {
      setSubjectError('');
    }

    return isValid;
  };

  const insertMergeTag = (tagValue) => {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand('insertHTML', false, tagValue);
      updateContent();
    }
  };

  const execCommand = (command, value = null) => {
    if (editorRef.current && !isViewMode) {
      document.execCommand(command, false, value);
      editorRef.current.focus();
      updateContent();
    }
  };

  const insertLink = () => {
    if (!linkUrl || !linkText) {
      toast.error('Please enter both URL and link text');
      return;
    }
    
    const linkHtml = `<a href="${linkUrl}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
    execCommand('insertHTML', linkHtml);
    setShowLinkDialog(false);
    setLinkUrl('');
    setLinkText('');
  };

  const insertList = (tagName) => {
      const listTemplate = `{{#if (isNotEmpty ${tagName})}}
    <ul>
      {{#each ${tagName}}}
      <li>{{this}}</li>
      {{/each}}
    </ul>
    {{else}}
    <p>No items</p>
    {{/if}}`;
      
      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, listTemplate);
        updateContent();
      }
      setShowHelperMenu(false);
  };

  const insertTable = (tagName) => {
      const tableTemplate = `{{#if (isNotEmpty ${tagName})}}
    <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; width: 100%;">
      <thead>
        <tr style="background-color: #f0f0f0;">
          <th>Column 1</th>
          <th>Column 2</th>
          <th>Column 3</th>
        </tr>
      </thead>
      <tbody>
        {{#each ${tagName}}}
        <tr>
          <td>{{this.field1}}</td>
          <td>{{this.field2}}</td>
          <td>{{this.field3}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
    {{else}}
    <p>No data available</p>
    {{/if}}`;

      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, tableTemplate);
        updateContent();
      }
      setShowHelperMenu(false);
  };

  const insertConditional = (tagName) => {
      const conditionalTemplate = `{{#if ${tagName}}}
    <div>
      <p>${tagName}: {{${tagName}}}</p>
    </div>
    {{else}}
    <p>Not provided</p>
    {{/if}}`;

      if (editorRef.current) {
        editorRef.current.focus();
        document.execCommand('insertHTML', false, conditionalTemplate);
        updateContent();
      }
      setShowHelperMenu(false);
  };

  const applyColor = (color) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const handleMergeTagClick = (tag) => {
    setSelectedMergeTag(tag);
    setShowHelperMenu(true);
  };

  const insertSimpleMergeTag = (tag) => {
    insertMergeTag(tag.value);
    setShowHelperMenu(false);
  };

  const updateContent = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  useEffect(() => {
    if (editorRef.current && content) {
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, []);

  useEffect(() => {
    if (editorRef.current && content && !isAddMode) {
      editorRef.current.innerHTML = content;
    }
  }, [templateData]);

  // Sync editor content when switching back to editor view
  useEffect(() => {
    if (viewMode === 'editor' && editorRef.current && content) {
      // Only update if the content has actually changed to avoid cursor jumping
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, [viewMode, content]);

  // Update toolbar state based on cursor position
  const updateToolbarState = () => {
    if (!editorRef.current || isViewMode) return;

    try {
      setToolbarState({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        fontSize: document.queryCommandValue('fontSize') || '3'
      });
    } catch (error) {
      // Ignore errors when commands are not available
    }
  };

  // Add event listeners to track cursor/selection changes
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || isViewMode) return;

    const handleSelectionChange = () => {
      // Only update if the selection is within our editor
      const selection = window.getSelection();
      if (selection && selection.anchorNode) {
        const isInEditor = editor.contains(selection.anchorNode);
        if (isInEditor) {
          updateToolbarState();
        }
      }
    };

    // Listen for selection changes
    document.addEventListener('selectionchange', handleSelectionChange);
    // Also update on mouse up and key up within the editor
    editor.addEventListener('mouseup', updateToolbarState);
    editor.addEventListener('keyup', updateToolbarState);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      editor.removeEventListener('mouseup', updateToolbarState);
      editor.removeEventListener('keyup', updateToolbarState);
    };
  }, [isViewMode, viewMode]);

  const handleEditorFocus = () => {
    // Don't clear content on focus - only affects placeholder display via CSS
  };

  const handleSave = async () => {
    if (!validateFields()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsLoading(true);

    try {
      const html = content;
      
      const templatePayload = {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        html_content: html,
        json_design: { html },
        is_active: templateData?.is_active !== undefined ? templateData.is_active : true
      };

      const url = isEditMode
        ? `/api/email-templates/${templateId}`
        : '/api/email-templates';

      const method = isEditMode ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templatePayload)
      });

      if (!response.ok) {
        throw new Error('Failed to save template');
      }

      toast.success('Email template saved successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.message || 'Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const getPreviewContent = () => {
    return content;
  };

  if (isPageLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Home className="w-4 h-4" />
            <button 
              onClick={onCancel}
              className="hover:text-blue-600 transition-colors"
            >
              EMAIL TEMPLATES
            </button>
            <span>/</span>
            <span className="font-medium">
              {isAddMode && 'CREATE TEMPLATE'}
              {isEditMode && 'EDIT TEMPLATE'}
              {isViewMode && 'VIEW TEMPLATE'}
            </span>
          </div>
          
          {!isViewMode && (
            <div className="flex items-center gap-3">
              <Button
                type="button"
                color="primary"
                size="medium"
                label={isLoading ? 'Saving...' : 'Save Template'}
                onClick={handleSave}
                disabled={isLoading}
                icon={<Save className="w-4 h-4" />}
              />
              <Button
                type="button"
                color="secondary"
                size="medium"
                label="Cancel"
                onClick={onCancel}
                disabled={isLoading}
              />
            </div>
          )}
        </div>
      </div>

      {/* Template Details Section */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <TextField
            label="Template Name"
            value={name}
            onChange={(value) => setName(value)}
            placeholder="Enter template name"
            error={nameError}
            disabled={isViewMode}
            required
          />
          <TextField
            label="Email Subject"
            value={subject}
            onChange={(value) => setSubject(value)}
            placeholder="Enter email subject"
            error={subjectError}
            disabled={isViewMode}
            required
          />
          <TextField
            label="Description (Optional)"
            value={description}
            onChange={(value) => setDescription(value)}
            placeholder="Brief description"
            disabled={isViewMode}
          />
        </div>
      </div>

      {/* View Mode Switcher */}
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('editor')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'editor'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isViewMode}
            >
              <Edit3 className="w-4 h-4" />
              Editor
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                viewMode === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              disabled={isViewMode}
            >
              <Code className="w-4 h-4" />
              HTML
            </button>
          </div>

          {!isViewMode && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowMergeTags(!showMergeTags)}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors ${
                  showMergeTags
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Type className="w-4 h-4" />
                {showMergeTags ? 'Hide' : 'Show'} Merge Tags
              </button>
              <button
                onClick={fetchMergeTags}
                className="px-4 py-2 rounded-lg flex items-center gap-2 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                title="Refresh merge tags"
                disabled={isLoadingMergeTags}
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingMergeTags ? 'animate-spin' : ''}`} />
              </button>
              {/* Help/Documentation Button */}
              <div className="ml-auto px-2 border-l border-gray-200">
                  <button
                    onClick={() => setShowHelperModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                    title="View helper guide"
                  >
                    <svg 
                      className="w-5 h-5" 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                        strokeWidth={2} 
                        d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                      />
                    </svg>
                    <span>Help</span>
                  </button>
                </div>
              </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden flex">
        {/* Merge Tags Sidebar */}
        {showMergeTags && !isViewMode && (
          <div className="w-80 bg-white border-r overflow-y-auto flex-shrink-0">
            <div className="p-4">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Type className="w-5 h-5" />
                Merge Tags
              </h3>
              
              {isLoadingMergeTags && (
                <div className="flex items-center justify-center py-8">
                  <Spinner />
                  <span className="ml-2 text-sm text-gray-600">Loading merge tags...</span>
                </div>
              )}

              {mergeTagsError && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
                  <p className="text-sm text-yellow-800">
                    <Info className="w-4 h-4 inline mr-1" />
                    {mergeTagsError}
                  </p>
                </div>
              )}
              
              {!isLoadingMergeTags && Object.entries(mergeTagsGrouped).map(([category, tags]) => (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {tags.map((tag, index) => (
                      <button
                        onClick={() => handleMergeTagClick(tag)}
                        className="w-full text-left px-3 py-2 rounded hover:bg-gray-50 transition-colors"
                        title={tag.description}
                      >
                        <div className="font-medium text-sm text-gray-900">{tag.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{tag.value}</div>
                        {tag.description && (
                          <div className="text-xs text-gray-400 mt-0.5">{tag.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              {showHelperMenu && selectedMergeTag && (
                <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
                  <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          Insert: {selectedMergeTag.label}
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">{selectedMergeTag.value}</p>
                      </div>
                      <button
                        onClick={() => setShowHelperMenu(false)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>

                    <div className="space-y-3">
                      <button
                        onClick={() => insertSimpleMergeTag(selectedMergeTag)}
                        className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900">Simple Insert</div>
                        <div className="text-xs text-gray-500 mt-1">
                          Insert as: {selectedMergeTag.value}
                        </div>
                      </button>

                      <button
                        onClick={() => insertList(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                        className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 flex items-center">
                          <List className="w-4 h-4 mr-2" />
                          Insert as Bullet List
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Display array items as a formatted list
                        </div>
                      </button>

                      <button
                        onClick={() => insertTable(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                        className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                          Insert as Table
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Display array of objects as a table
                        </div>
                      </button>

                      <button
                        onClick={() => insertConditional(selectedMergeTag.value.replace(/{{|}}/g, ''))}
                        className="w-full text-left px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        <div className="font-medium text-sm text-gray-900 flex items-center">
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12M8 12h12m-12 5h12M3 7h.01M3 12h.01M3 17h.01" />
                          </svg>
                          Insert with Conditional
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Show only when data exists
                        </div>
                      </button>
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        💡 Tip: You can also edit these in Code View for full customization
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isLoadingMergeTags && Object.keys(mergeTagsGrouped).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Type className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No merge tags available</p>
                  <button
                    onClick={fetchMergeTags}
                    className="mt-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    Try reloading
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Editor Area */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {/* Toolbar */}
          {viewMode === 'editor' && !isViewMode && (
            <div className="bg-white border-b px-4 py-2 flex-shrink-0 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {/* Text Formatting */}
                <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('bold')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Bold"
                  >
                    <Bold className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('italic')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Italic"
                  >
                    <Italic className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('underline')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Underline"
                  >
                    <Underline className="w-4 h-4" />
                  </button>
                </div>

                {/* Font Size */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <select
                    onChange={(e) => execCommand('fontSize', e.target.value)}
                    className="text-sm border border-gray-300 rounded px-2 py-1"
                    defaultValue="3"
                  >
                    <option value="1">Small</option>
                    <option value="3">Normal</option>
                    <option value="5">Large</option>
                    <option value="7">Huge</option>
                  </select>
                </div>

                {/* Color */}
                <div className="relative px-2 border-r border-gray-200">
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-2 hover:bg-gray-100 rounded flex items-center gap-1"
                    title="Text Color"
                  >
                    <Palette className="w-4 h-4" />
                    <ChevronDown className="w-3 h-3" />
                  </button>
                  
                  {showColorPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-3 z-10">
                      <div className="grid grid-cols-10 gap-1 w-56">
                        {commonColors.map((color) => (
                          <button
                            key={color}
                            onClick={() => applyColor(color)}
                            className="w-6 h-6 rounded border border-gray-300 hover:scale-110 transition-transform"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                      <input
                        type="color"
                        value={selectedColor}
                        onChange={(e) => {
                          setSelectedColor(e.target.value);
                          applyColor(e.target.value);
                        }}
                        className="w-full mt-2 h-8 rounded border border-gray-300"
                      />
                    </div>
                  )}
                </div>

                {/* Alignment */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('justifyLeft')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Left"
                  >
                    <AlignLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyCenter')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Center"
                  >
                    <AlignCenter className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('justifyRight')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Align Right"
                  >
                    <AlignRight className="w-4 h-4" />
                  </button>
                </div>

                {/* Lists */}
                <div className="flex items-center gap-1 px-2 border-r border-gray-200">
                  <button
                    onClick={() => execCommand('insertUnorderedList')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Bullet List"
                  >
                    <List className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => execCommand('insertOrderedList')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Numbered List"
                  >
                    <ListOrdered className="w-4 h-4" />
                  </button>
                </div>

                {/* Link */}
                <div className="relative px-2 border-r border-gray-200">
                  <button
                    onClick={() => setShowLinkDialog(!showLinkDialog)}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Insert Link"
                  >
                    <Link2 className="w-4 h-4" />
                  </button>
                  
                  {showLinkDialog && (
                    <div className="absolute top-full left-0 mt-1 bg-white border border-gray-300 rounded-lg shadow-lg p-4 z-10 w-80">
                      <h4 className="font-medium mb-3">Insert Link</h4>
                      <input
                        type="text"
                        placeholder="Link text"
                        value={linkText}
                        onChange={(e) => setLinkText(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="url"
                        placeholder="https://example.com"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={insertLink}
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex-1"
                        >
                          Insert
                        </button>
                        <button
                          onClick={() => {
                            setShowLinkDialog(false);
                            setLinkUrl('');
                            setLinkText('');
                          }}
                          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Horizontal Rule */}
                <div className="px-2">
                  <button
                    onClick={() => execCommand('insertHorizontalRule')}
                    className="p-2 hover:bg-gray-100 rounded"
                    title="Horizontal Line"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Editor View */}
          {viewMode === 'editor' && (
            <div className="flex-1 overflow-auto bg-gray-50 p-6">
              <div className="max-w-4xl mx-auto bg-white border border-gray-300 rounded-lg shadow-sm min-h-full">
                <style>{`
                  .email-editor:empty:before {
                    content: 'Start writing your email template here...';
                    color: #999;
                    font-style: italic;
                  }
                  .email-editor:focus:before {
                    content: '';
                  }
                `}</style>
                <div
                  ref={editorRef}
                  contentEditable={!isViewMode}
                  onInput={updateContent}
                  onFocus={handleEditorFocus}
                  className="email-editor p-8 min-h-[500px] focus:outline-none"
                  dir="ltr"
                  style={{
                    fontFamily: 'Arial, Helvetica, sans-serif',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    color: '#333'
                  }}
                />
              </div>
            </div>
          )}

          {/* Preview View */}
          {viewMode === 'preview' && (
            <div className="flex-1 overflow-auto bg-gray-50 p-6">
              <div className="max-w-4xl mx-auto">
                <div className="bg-gray-100 rounded-lg p-6 mb-6">
                  <div className="bg-white rounded shadow-sm p-4 mb-2">
                    <p className="text-sm text-gray-600 mb-1"><strong>Subject:</strong></p>
                    <p className="text-lg font-semibold text-gray-900">{subject || 'No subject'}</p>
                  </div>
                </div>
                
                <div className="bg-white border border-gray-300 rounded-lg shadow-sm p-8">
                  <div 
                    dangerouslySetInnerHTML={{ __html: getPreviewContent() }}
                    style={{ 
                      fontFamily: 'Arial, Helvetica, sans-serif',
                      fontSize: '14px',
                      lineHeight: '1.6',
                      color: '#333'
                    }}
                  />
                </div>
                
                <div className="mt-6 text-center text-sm text-gray-500">
                  <Info className="w-4 h-4 inline mr-1" />
                  This is how your email will appear to recipients
                </div>
              </div>
            </div>
          )}

          {/* Code View */}
          {viewMode === 'code' && (
            <div className="flex-1 p-4 bg-gray-50 overflow-auto">
              <div className="max-w-4xl mx-auto">
                <textarea
                  value={content}
                  onChange={(e) => {
                    const newContent = e.target.value;
                    setContent(newContent);
                    // Don't update editor ref immediately - wait until switching back to editor view
                  }}
                  className="w-full h-[600px] p-4 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none bg-white"
                  placeholder="HTML code will appear here..."
                  disabled={isViewMode}
                  style={{ fontFamily: 'Monaco, Courier, monospace' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex-shrink-0">
        <p className="text-xs text-gray-600 flex items-center max-w-7xl mx-auto">
          <Info className="w-3 h-3 mr-1.5 flex-shrink-0" />
          {viewMode === 'editor' && 'Use the toolbar to format text and click merge tag buttons to insert dynamic content from bookings.'}
          {viewMode === 'preview' && 'Preview shows how your email will look to recipients. Merge tags will be replaced with actual booking data when sent.'}
          {viewMode === 'code' && 'Edit the raw HTML code. Changes will be reflected in the editor view.'}
        </p>
      </div>

      {/* Helper Documentation Modal */}
      {showHelperModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            {/* Background overlay */}
            <div 
              className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
              onClick={() => setShowHelperModal(false)}
            />

            {/* Modal panel */}
            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
              {/* Header */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  Template Helper Guide
                </h3>
                <button
                  onClick={() => setShowHelperModal(false)}
                  className="text-gray-400 hover:text-gray-500 focus:outline-none"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="bg-white px-6 py-4 max-h-[70vh] overflow-y-auto">
                <TemplateHelperDocumentation />
              </div>

              {/* Footer */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex justify-end">
                <button
                  onClick={() => setShowHelperModal(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailTemplateBuilder;