import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { 
  Home, Save, Info, Eye, Code, Edit3, Bold, Italic, Underline, 
  AlignLeft, AlignCenter, AlignRight, List, ListOrdered, Link2, 
  Image as ImageIcon, Type, Palette, Minus, ChevronDown
} from 'lucide-react';

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
  const [viewMode, setViewMode] = useState('editor'); // 'editor', 'preview', 'code'
  const [showLinkDialog, setShowLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');

  // Merge tags grouped by category
  const mergeTagsGrouped = {
    'Guest Information': [
      { label: 'Guest Name', value: '{{guest_name}}' },
      { label: 'Guest Email', value: '{{guest_email}}' },
      { label: 'Guest Phone', value: '{{guest_phone}}' },
      { label: 'Guest Address', value: '{{guest_address}}' },
    ],
    'Booking Details': [
      { label: 'Booking Reference', value: '{{booking_reference}}' },
      { label: 'Check-in Date', value: '{{checkin_date}}' },
      { label: 'Check-out Date', value: '{{checkout_date}}' },
      { label: 'Number of Guests', value: '{{number_of_guests}}' },
      { label: 'Number of Nights', value: '{{number_of_nights}}' },
    ],
    'Property Information': [
      { label: 'Property Name', value: '{{property_name}}' },
      { label: 'Property Address', value: '{{property_address}}' },
      { label: 'Property Phone', value: '{{property_phone}}' },
      { label: 'Property Email', value: '{{property_email}}' },
    ]
  };

  const commonColors = [
    '#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
    '#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
  ];

  useEffect(() => {
    if (templateId && !isAddMode) {
      fetchTemplate();
    } else {
      // Start with empty content for new templates
      setContent('');
      setIsPageLoading(false);
    }
  }, [templateId, isAddMode]);

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

  const applyColor = (color) => {
    execCommand('foreColor', color);
    setShowColorPicker(false);
  };

  const updateContent = () => {
    if (editorRef.current) {
      setContent(editorRef.current.innerHTML);
    }
  };

  useEffect(() => {
    // Set initial content when loading an existing template
    if (editorRef.current && content) {
      // Only update if the editor is empty or content is different
      if (editorRef.current.innerHTML !== content) {
        editorRef.current.innerHTML = content;
      }
    }
  }, []);

  // Separate effect for when content changes from fetch
  useEffect(() => {
    if (editorRef.current && content && !isAddMode) {
      editorRef.current.innerHTML = content;
    }
  }, [templateData]);

  const handleEditorFocus = () => {
    if (editorRef.current && editorRef.current.innerHTML.trim() === '') {
      editorRef.current.innerHTML = '';
    }
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
              
              {Object.entries(mergeTagsGrouped).map(([category, tags]) => (
                <div key={category} className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-2 uppercase tracking-wider">
                    {category}
                  </h4>
                  <div className="space-y-1">
                    {tags.map((tag) => (
                      <button
                        key={tag.value}
                        onClick={() => insertMergeTag(tag.value)}
                        className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-blue-50 rounded-lg transition-colors group"
                      >
                        <div className="font-medium text-gray-900 group-hover:text-blue-600">
                          {tag.label}
                        </div>
                        <div className="text-xs text-gray-500 font-mono mt-0.5">
                          {tag.value}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
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
                    setContent(e.target.value);
                    if (editorRef.current) {
                      editorRef.current.innerHTML = e.target.value;
                    }
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
          {viewMode === 'editor' && 'Use the toolbar to format text and click merge tag buttons to insert dynamic content.'}
          {viewMode === 'preview' && 'Preview shows how your email will look to recipients. Switch to Editor to make changes.'}
          {viewMode === 'code' && 'Edit the raw HTML code. Changes will be reflected in the editor view.'}
        </p>
      </div>
    </div>
  );
};

export default EmailTemplateBuilder;