import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { Home, Save, Info, Eye, Code, Edit3 } from 'lucide-react';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Spinner = dynamic(() => import('../ui/spinner'));

const Editor = dynamic(
  () => import('@tinymce/tinymce-react').then(mod => mod.Editor),
  { ssr: false }
);

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

  useEffect(() => {
    if (templateId && !isAddMode) {
      fetchTemplate();
    } else {
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
      editorRef.current.insertContent(tagValue);
    }
  };

  const handleSave = async () => {
    if (!validateFields()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsLoading(true);

    try {
      const html = editorRef.current ? editorRef.current.getContent() : content;
      
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
    const currentContent = editorRef.current ? editorRef.current.getContent() : content;
    return currentContent;
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
                label={isLoading ? 'SAVING...' : 'SAVE TEMPLATE'}
                onClick={handleSave}
                disabled={isLoading}
                icon={<Save className="w-4 h-4" />}
              />
              <Button
                type="button"
                color="secondary"
                size="medium"
                label="CANCEL"
                onClick={onCancel}
                disabled={isLoading}
              />
            </div>
          )}
          {isViewMode && (
            <Button
              type="button"
              color="secondary"
              size="medium"
              label="BACK"
              onClick={onCancel}
            />
          )}
        </div>
      </div>

      {/* Form Fields */}
      <div className="bg-white border-b px-6 py-4 flex-shrink-0">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <TextField
              label="Template Name"
              value={name}
              onChange={setName}
              placeholder="Enter template name"
              required
              size="medium"
              error={nameError}
              disabled={isViewMode}
            />
          </div>
          <div>
            <TextField
              label="Email Subject"
              value={subject}
              onChange={setSubject}
              placeholder="Enter email subject"
              required
              size="medium"
              error={subjectError}
              disabled={isViewMode}
            />
          </div>
          <div>
            <TextField
              label="Description (Optional)"
              value={description}
              onChange={setDescription}
              placeholder="Brief description"
              size="medium"
              disabled={isViewMode}
            />
          </div>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="bg-white border-b px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('editor')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'editor'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              disabled={isViewMode}
            >
              <Edit3 className="w-4 h-4" />
              Editor
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'preview'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Eye className="w-4 h-4" />
              Preview
            </button>
            <button
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                viewMode === 'code'
                  ? 'bg-blue-100 text-blue-700 border border-blue-300'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
              disabled={isViewMode}
            >
              <Code className="w-4 h-4" />
              HTML Code
            </button>
          </div>
          
          <button
            type="button"
            onClick={() => setShowMergeTags(!showMergeTags)}
            className="flex items-center text-sm font-medium text-gray-700 hover:text-blue-600 transition-colors"
          >
            <Info className="w-4 h-4 mr-2" />
            {showMergeTags ? 'Hide' : 'Show'} Merge Tags
          </button>
        </div>

        {/* Merge Tags Section */}
        {showMergeTags && (
          <div className="mt-4 border-t pt-4">
            {Object.entries(mergeTagsGrouped).map(([category, tags]) => (
              <div key={category} className="mb-3">
                <h4 className="text-xs font-semibold text-gray-700 mb-2">{category}</h4>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag, index) => (
                    <button
                      key={index}
                      onClick={() => insertMergeTag(tag.value)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-300 rounded-lg text-xs hover:bg-blue-50 hover:border-blue-300 transition-colors"
                      disabled={isViewMode || viewMode !== 'editor'}
                    >
                      <span className="font-medium text-gray-700">{tag.label}</span>
                      <code className="text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded font-mono">
                        {tag.value}
                      </code>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 bg-white overflow-hidden" style={{ minHeight: 0 }}>
        {/* Editor View */}
        {viewMode === 'editor' && (
          <div className="h-full p-4">
            <Editor
              apiKey={process.env.NEXT_PUBLIC_TINYMCE_API_KEY || 'no-api-key'}
              onInit={(evt, editor) => editorRef.current = editor}
              initialValue={content}
              disabled={isViewMode}
              init={{
                height: '100%',
                menubar: true,
                plugins: [
                  'advlist', 'autolink', 'lists', 'link', 'image', 'charmap', 'preview',
                  'anchor', 'searchreplace', 'visualblocks', 'code', 'fullscreen',
                  'insertdatetime', 'media', 'table', 'help', 'wordcount', 'template'
                ],
                toolbar: 'undo redo | blocks fontsize | ' +
                  'bold italic forecolor backcolor | alignleft aligncenter ' +
                  'alignright alignjustify | bullist numlist outdent indent | ' +
                  'link image table | removeformat code preview | help',
                content_style: `
                  body { 
                    font-family: Arial, Helvetica, sans-serif; 
                    font-size: 14px;
                    padding: 20px;
                    max-width: 600px;
                    margin: 0 auto;
                  }
                  img { max-width: 100%; height: auto; }
                  table { border-collapse: collapse; width: 100%; }
                  td, th { border: 1px solid #ddd; padding: 8px; }
                `,
                branding: false,
                promotion: false,
              }}
              onEditorChange={(newContent) => setContent(newContent)}
            />
          </div>
        )}

        {/* Preview View */}
        {viewMode === 'preview' && (
          <div className="h-full overflow-auto">
            <div className="max-w-4xl mx-auto p-8">
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
          <div className="h-full p-4">
            <textarea
              value={editorRef.current ? editorRef.current.getContent() : content}
              onChange={(e) => {
                setContent(e.target.value);
                if (editorRef.current) {
                  editorRef.current.setContent(e.target.value);
                }
              }}
              className="w-full h-full p-4 font-mono text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="HTML code will appear here..."
              disabled={isViewMode}
              style={{ fontFamily: 'Monaco, Courier, monospace' }}
            />
          </div>
        )}
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