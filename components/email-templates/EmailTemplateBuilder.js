import React, { useRef, useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import { X, Mail, Save, Info } from 'lucide-react';

const EmailEditor = dynamic(() => import('react-email-editor'), { ssr: false });
const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));

const EmailTemplateBuilder = ({ templateData, onSave, onClose }) => {
  const emailEditorRef = useRef(null);
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [nameError, setNameError] = useState('');
  const [subjectError, setSubjectError] = useState('');
  const [showMergeTags, setShowMergeTags] = useState(false);

  // Merge tags grouped by category
  const mergeTags = {
    guest: [
      { name: 'Guest Name', value: '{{guest_name}}' },
      { name: 'Guest Email', value: '{{guest_email}}' },
      { name: 'Guest Phone', value: '{{guest_phone}}' },
      { name: 'Guest Address', value: '{{guest_address}}' }
    ],
    booking: [
      { name: 'Booking Reference', value: '{{booking_reference}}' },
      { name: 'Check-in Date', value: '{{checkin_date}}' },
      { name: 'Check-out Date', value: '{{checkout_date}}' },
      { name: 'Number of Guests', value: '{{number_of_guests}}' },
      { name: 'Number of Nights', value: '{{number_of_nights}}' },
      { name: 'Room Type', value: '{{room_type}}' },
      { name: 'Total Amount', value: '{{total_amount}}' }
    ],
    property: [
      { name: 'Property Name', value: '{{property_name}}' },
      { name: 'Property Address', value: '{{property_address}}' },
      { name: 'Property Phone', value: '{{property_phone}}' },
      { name: 'Property Email', value: '{{property_email}}' }
    ],
    other: [
      { name: 'Current Date', value: '{{current_date}}' },
      { name: 'Current Time', value: '{{current_time}}' },
      { name: 'Booking URL', value: '{{booking_url}}' }
    ]
  };

  const groupedMergeTags = {
    'Guest Information': mergeTags.guest,
    'Booking Details': mergeTags.booking,
    'Property Information': mergeTags.property,
    'Other': mergeTags.other
  };

  // Flatten merge tags for email editor
  const flatMergeTags = Object.values(mergeTags).flat().map(tag => ({
    name: tag.name,
    value: tag.value,
    mergeTags: {}
  }));

  useEffect(() => {
    if (templateData) {
      setName(templateData.name || '');
      setSubject(templateData.subject || '');
      setDescription(templateData.description || '');
    }
  }, [templateData]);

  const exportHtml = () => {
    return new Promise((resolve) => {
      emailEditorRef.current?.editor?.exportHtml((data) => {
        const { design, html } = data;
        resolve({ design, html });
      });
    });
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

  const handleSave = async () => {
    if (!validateFields()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsLoading(true);

    try {
      const { design, html } = await exportHtml();
      
      const templatePayload = {
        name: name.trim(),
        subject: subject.trim(),
        description: description.trim(),
        html_content: html,
        json_design: design,
        is_active: templateData?.is_active !== undefined ? templateData.is_active : true
      };

      await onSave(templatePayload);
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Failed to save template');
    } finally {
      setIsLoading(false);
    }
  };

  const onReady = () => {
    // Load existing design if editing
    if (templateData?.json_design) {
      try {
        emailEditorRef.current?.editor?.loadDesign(templateData.json_design);
      } catch (error) {
        console.error('Error loading template design:', error);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl w-full h-full max-w-[95vw] max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {templateData ? 'Edit Email Template' : 'Create Email Template'}
              </h2>
              <p className="text-sm text-gray-500">Design your custom email template</p>
            </div>
          </div>
          
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
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Template Info Section */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Template Name */}
            <div>
              <TextField
                label="Template Name"
                value={name}
                onChange={setName}
                placeholder="e.g., New Booking Notification"
                required
                size="medium"
                error={nameError}
              />
            </div>

            {/* Email Subject */}
            <div>
              <TextField
                label="Email Subject"
                value={subject}
                onChange={setSubject}
                placeholder="e.g., New Booking Request from {{guest_name}}"
                required
                size="medium"
                error={subjectError}
              />
            </div>
          </div>

          {/* Description */}
          <div className="mt-4">
            <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
              Description <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of this template"
              className="block w-full px-3.5 py-2.5 text-base font-normal text-gray-700 bg-white border border-gray-300 rounded-lg shadow-sm transition ease-in-out focus:border-blue-400 focus:ring-2 focus:ring-blue-200 focus:outline-none"
              rows="2"
            />
          </div>
        </div>

        {/* Merge Tags Section */}
        <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
          <button
            type="button"
            onClick={() => setShowMergeTags(!showMergeTags)}
            className="flex items-center space-x-2 text-sm font-medium text-blue-900 hover:text-blue-700 transition-colors"
          >
            <Info className="w-4 h-4" />
            <span>Available Merge Tags</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showMergeTags ? 'rotate-180' : ''}`}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showMergeTags && (
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(groupedMergeTags).map(([category, tags]) => (
                <div key={category} className="bg-white rounded-lg p-3 border border-gray-200">
                  <h4 className="text-xs font-semibold text-gray-700 mb-2 uppercase">{category}</h4>
                  <div className="space-y-2">
                    {tags.map((tag, index) => (
                      <div key={index} className="flex flex-col">
                        <span className="text-xs font-medium text-gray-600">{tag.name}</span>
                        <code className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded mt-1 font-mono break-all">
                          {tag.value}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Email Editor */}
        <div className="flex-1 overflow-hidden">
          <EmailEditor
            ref={emailEditorRef}
            onReady={onReady}
            minHeight="100%"
            options={{
              mergeTags: flatMergeTags,
              features: {
                colorPicker: {
                  presets: ['#000000', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6']
                }
              },
              fonts: {
                showDefaultFonts: true
              }
            }}
          />
        </div>

        {/* Footer Help Text */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-600 flex items-center">
            <Info className="w-3 h-3 mr-1.5 flex-shrink-0" />
            Use merge tags like <code className="mx-1 px-2 py-0.5 bg-gray-200 rounded text-blue-600">{`{{guest_name}}`}</code> 
            to insert dynamic content from booking data. Drag and drop elements from the left panel to build your email.
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailTemplateBuilder;