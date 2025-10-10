import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { Home, Mail, Plus, AlertCircle, Trash2, Settings, HelpCircle } from 'lucide-react';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));
const Spinner = dynamic(() => import('../ui/spinner'));

const EmailTriggerForm = ({ mode, triggerId, onCancel, onSuccess }) => {
  const isAddMode = mode === 'add';
  const isEditMode = mode === 'edit';
  const isViewMode = mode === 'view';
  
  const [formData, setFormData] = useState({
    recipient: '',
    email_template_id: '',
    type: 'highlights',
    enabled: true,
    trigger_questions: []
  });
  
  const [templates, setTemplates] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  
  // Validation states
  const [fieldErrors, setFieldErrors] = useState({});
  const [validationAttempted, setValidationAttempted] = useState(false);

  // Trigger type options
  const triggerTypes = [
    { label: 'Booking Highlights', value: 'highlights' },
    { label: 'External Recipient', value: 'external' },
    { label: 'Internal Recipient', value: 'internal' }
  ];

  useEffect(() => {
    fetchTemplates();
    fetchQuestions();
    
    if (triggerId && !isAddMode) {
      fetchTrigger();
    }
  }, [triggerId, isAddMode]);

  const fetchTrigger = async () => {
    try {
      setIsPageLoading(true);
      const response = await fetch(`/api/email-triggers/${triggerId}`);
      if (response.ok) {
        const data = await response.json();
        setFormData({
          recipient: data.recipient || '',
          email_template_id: data.email_template_id || '',
          type: data.type || 'highlights',
          enabled: data.enabled !== undefined ? data.enabled : true,
          trigger_questions: data.trigger_questions || []
        });
      }
    } catch (error) {
      console.error('Error fetching trigger:', error);
      toast.error('Failed to load trigger');
    } finally {
      setIsPageLoading(false);
    }
  };

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/email-templates?active=true');
      const data = await response.json();
      if (data.success) {
        const templateOptions = data.data.map(t => ({
          label: `${t.name} - ${t.subject}`,
          value: t.id,
          template: t
        }));
        setTemplates(templateOptions);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  };

  const fetchQuestions = async () => {
    try {
      const response = await fetch('/api/questions');
      if (response.ok) {
        const data = await response.json();
        const questionOptions = data.map(q => ({
          label: q.question,
          value: q.id,
          question_key: q.question_key,
          question: q.question
        }));
        setAvailableQuestions(questionOptions);
      }
    } catch (error) {
      console.error('Error fetching questions:', error);
    }
  };

  const validateForm = () => {
    const errors = {};

    if (!formData.recipient || !formData.recipient.trim()) {
      errors.recipient = 'Recipient email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipient)) {
      errors.recipient = 'Please enter a valid email address';
    }

    if (!formData.email_template_id) {
      errors.email_template_id = 'Email template is required';
    }

    if (formData.trigger_questions.length === 0) {
      errors.trigger_questions = 'At least one trigger condition is required';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddTriggerQuestion = () => {
    if (!selectedQuestion) {
      toast.error('Please select a question');
      return;
    }

    const question = availableQuestions.find(q => q.value === selectedQuestion);
    
    const exists = formData.trigger_questions.some(
      q => q.question === question.question
    );

    if (exists) {
      toast.error('This question is already added');
      return;
    }

    setFormData({
      ...formData,
      trigger_questions: [
        ...formData.trigger_questions,
        {
          question: question.question,
          question_key: question.question_key,
          answer: ''
        }
      ]
    });

    setSelectedQuestion('');
    
    if (fieldErrors.trigger_questions) {
      const newErrors = { ...fieldErrors };
      delete newErrors.trigger_questions;
      setFieldErrors(newErrors);
    }
  };

  const handleRemoveTriggerQuestion = (index) => {
    const updated = formData.trigger_questions.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      trigger_questions: updated
    });
  };

  const handleTriggerQuestionAnswerChange = (index, answer) => {
    const updated = [...formData.trigger_questions];
    updated[index].answer = answer;
    setFormData({
      ...formData,
      trigger_questions: updated
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setValidationAttempted(true);

    if (!validateForm()) {
      toast.error('Please fix the validation errors');
      return;
    }

    setIsLoading(true);

    try {
      const url = isEditMode
        ? '/api/email-triggers/update'
        : '/api/email-triggers/create';

      const payload = isEditMode
        ? { ...formData, id: triggerId }
        : formData;

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error('Failed to save email trigger');
      }

      toast.success('Email trigger saved successfully');
      onSuccess();
    } catch (error) {
      console.error('Error saving trigger:', error);
      toast.error('Failed to save email trigger');
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  // View Mode
  if (isViewMode) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Home className="w-4 h-4" />
              <button 
                onClick={onCancel}
                className="hover:text-blue-600 transition-colors"
              >
                EMAIL TRIGGERS
              </button>
              <span>/</span>
              <span className="font-medium">VIEW TRIGGER</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Title Section */}
              <div className="px-6 py-4 border-b border-gray-200" style={{ background: '#F1F3F6' }}>
                <h3 className="text-lg font-semibold text-gray-900">Email Trigger Details</h3>
              </div>

              {/* Details */}
              <div className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-700">Recipient Email</label>
                    <div className="mt-1 text-base text-gray-900">{formData.recipient}</div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Type</label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        formData.type === 'highlights' ? 'bg-blue-100 text-blue-800' :
                        formData.type === 'external' ? 'bg-green-100 text-green-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {formData.type}
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Email Template</label>
                    <div className="mt-1 text-base text-gray-900">
                      {templates.find(t => t.value === formData.email_template_id)?.label || 'N/A'}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-700">Status</label>
                    <div className="mt-1">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        formData.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      }`}>
                        {formData.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Trigger Conditions */}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-3 block">Trigger Conditions</label>
                  <div className="space-y-2">
                    {formData.trigger_questions.map((tq, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-4">
                        <div className="text-sm font-medium text-gray-900">{tq.question}</div>
                        {tq.answer && (
                          <div className="text-sm text-gray-600 mt-1">
                            Required Answer: <span className="font-medium">{tq.answer}</span>
                          </div>
                        )}
                        {!tq.answer && (
                          <div className="text-sm text-gray-500 mt-1 italic">Any answer will trigger</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 pt-4">
                  <Button
                    type="button"
                    color="secondary"
                    size="large"
                    label="BACK"
                    onClick={onCancel}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Edit/Add Mode - Form
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Home className="w-4 h-4" />
            <button 
              onClick={onCancel}
              className="hover:text-blue-600 transition-colors"
            >
              EMAIL TRIGGERS
            </button>
            <span>/</span>
            <span className="font-medium">
              {isAddMode && 'ADD TRIGGER'}
              {isEditMode && 'EDIT TRIGGER'}
            </span>
          </div>
        </div>
      </div>

      {/* Validation Summary */}
      {validationAttempted && Object.keys(fieldErrors).length > 0 && (
        <div className="mx-6 mt-4 bg-red-50 border-l-4 border-red-400 p-4 rounded">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-3" />
            <div>
              <h3 className="text-sm font-medium text-red-800">
                Please fix the following errors:
              </h3>
              <ul className="mt-2 text-sm text-red-700 list-disc pl-5 space-y-1">
                {Object.entries(fieldErrors).map(([field, error]) => (
                  <li key={field}>{error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column - Main Configuration (2/3 width) */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Mail className="w-5 h-5 mr-2 text-blue-600" />
                  Basic Information
                </h3>
                
                <div className="space-y-4">
                  <TextField
                    label="Recipient Email"
                    value={formData.recipient}
                    onChange={(value) => setFormData({ ...formData, recipient: value })}
                    placeholder="recipient@example.com"
                    type="email"
                    required
                    size="medium"
                    error={validationAttempted ? fieldErrors.recipient : ''}
                    disabled={isViewMode}
                  />

                  <Select
                    label="Email Template"
                    value={formData.email_template_id}
                    onChange={(value) => setFormData({ ...formData, email_template_id: value })}
                    options={templates}
                    placeholder="Select a template"
                    required
                    size="medium"
                    error={validationAttempted ? fieldErrors.email_template_id : ''}
                    disabled={isViewMode}
                  />

                  <Select
                    label="Trigger Type"
                    value={formData.type}
                    onChange={(value) => setFormData({ ...formData, type: value })}
                    options={triggerTypes}
                    size="medium"
                    disabled={isViewMode}
                  />
                </div>
              </div>

              {/* Trigger Conditions Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Settings className="w-5 h-5 mr-2 text-blue-600" />
                  Trigger Conditions
                </h3>

                {!isViewMode && (
                  <div className="mb-4 flex gap-3">
                    <div className="flex-1">
                      <Select
                        value={selectedQuestion}
                        onChange={setSelectedQuestion}
                        options={availableQuestions}
                        placeholder="Select a question to add..."
                        size="medium"
                      />
                    </div>
                    <Button
                      type="button"
                      color="secondary"
                      size="medium"
                      label="ADD"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={handleAddTriggerQuestion}
                    />
                  </div>
                )}

                {validationAttempted && fieldErrors.trigger_questions && (
                  <div className="mb-4 text-sm text-red-600">
                    {fieldErrors.trigger_questions}
                  </div>
                )}

                <div className="space-y-3">
                  {formData.trigger_questions.map((tq, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">{tq.question}</div>
                          {tq.question_key && (
                            <div className="text-xs text-gray-500 mt-1">Key: {tq.question_key}</div>
                          )}
                        </div>
                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={() => handleRemoveTriggerQuestion(index)}
                            className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <TextField
                        placeholder="Required answer (leave empty for any answer)"
                        value={tq.answer}
                        onChange={(value) => handleTriggerQuestionAnswerChange(index, value)}
                        size="small"
                        disabled={isViewMode}
                      />
                    </div>
                  ))}

                  {formData.trigger_questions.length === 0 && (
                    <div className="text-sm text-gray-500 text-center py-4">
                      No trigger conditions added yet
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Settings & Actions (1/3 width) */}
            <div className="space-y-6">
              {/* Status Section */}
              <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Enable Trigger</span>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                    disabled={isViewMode}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      formData.enabled ? 'bg-blue-600' : 'bg-gray-200'
                    } ${isViewMode ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                        formData.enabled ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Help Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                <h3 className="text-sm font-semibold text-blue-900 mb-3 flex items-center">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  How It Works
                </h3>
                <ul className="text-xs text-blue-800 space-y-2">
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 mr-2"></span>
                    <span>Add questions that must be answered to trigger this email</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 mr-2"></span>
                    <span>Specify required answers or leave empty to trigger on any answer</span>
                  </li>
                  <li className="flex items-start">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1 mr-2"></span>
                    <span>All conditions must match for the email to be sent</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              {!isViewMode && (
                <div className="space-y-3">
                  <Button
                    type="submit"
                    color="primary"
                    size="large"
                    label={isLoading ? 'SAVING...' : 'SAVE TRIGGER'}
                    disabled={isLoading}
                    className="w-full"
                  />
                  <Button
                    type="button"
                    color="secondary"
                    size="large"
                    label="CANCEL"
                    onClick={onCancel}
                    disabled={isLoading}
                    className="w-full"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default EmailTriggerForm;