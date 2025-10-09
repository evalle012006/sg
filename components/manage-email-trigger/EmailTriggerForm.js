import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { toast } from 'react-toastify';
import { X, Mail, Plus, AlertCircle, Trash2, Settings, HelpCircle } from 'lucide-react';

const Button = dynamic(() => import('../ui-v2/Button'));
const TextField = dynamic(() => import('../ui-v2/TextField'));
const Select = dynamic(() => import('../ui-v2/Select'));

const EmailTriggerForm = ({ trigger, onSave, onClose }) => {
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
    
    if (trigger) {
      setFormData({
        recipient: trigger.recipient || '',
        email_template_id: trigger.email_template_id || '',
        type: trigger.type || 'highlights',
        enabled: trigger.enabled !== undefined ? trigger.enabled : true,
        trigger_questions: trigger.trigger_questions || []
      });
    }
  }, [trigger]);

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
          answer: '' // Can be empty for "any answer" triggers
        }
      ]
    });

    setSelectedQuestion('');
    
    // Clear validation error if exists
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
      await onSave(formData);
      toast.success('Email trigger saved successfully');
    } catch (error) {
      toast.error('Failed to save email trigger');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-6">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Settings className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {trigger ? 'Edit Email Trigger' : 'Create Email Trigger'}
                </h2>
                <p className="text-sm text-gray-500">Configure email trigger conditions</p>
              </div>
            </div>
            
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Validation Summary */}
          {validationAttempted && Object.keys(fieldErrors).length > 0 && (
            <div className="mx-6 mt-4 bg-red-50 border-l-4 border-red-400 p-4">
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
                      {/* Recipient Email */}
                      <TextField
                        label="Recipient Email"
                        value={formData.recipient}
                        onChange={(value) => setFormData({ ...formData, recipient: value })}
                        placeholder="recipient@example.com"
                        type="email"
                        required
                        size="medium"
                        error={validationAttempted ? fieldErrors.recipient : ''}
                      />

                      {/* Email Template Selection */}
                      <Select
                        label="Email Template"
                        value={formData.email_template_id}
                        onChange={(value) => setFormData({ ...formData, email_template_id: value })}
                        options={templates}
                        placeholder="Select a template"
                        required
                        size="medium"
                        error={validationAttempted ? fieldErrors.email_template_id : ''}
                      />

                      {/* Trigger Type */}
                      <Select
                        label="Trigger Type"
                        value={formData.type}
                        onChange={(value) => setFormData({ ...formData, type: value })}
                        options={triggerTypes}
                        size="medium"
                      />
                    </div>
                  </div>

                  {/* Trigger Conditions Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                          <AlertCircle className="w-5 h-5 mr-2 text-blue-600" />
                          Trigger Conditions
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Define which questions must be answered for this trigger to fire
                        </p>
                      </div>
                    </div>

                    {/* Add Question Section */}
                    <div className="mb-4">
                      <label className="font-semibold form-label inline-block mb-1.5 text-slate-700">
                        Add Question Condition
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <Select
                            value={selectedQuestion}
                            onChange={setSelectedQuestion}
                            options={availableQuestions}
                            placeholder="Select a question to add"
                            size="medium"
                          />
                        </div>
                        <Button
                          type="button"
                          color="primary"
                          size="medium"
                          label="ADD"
                          onClick={handleAddTriggerQuestion}
                          icon={<Plus className="w-4 h-4" />}
                        />
                      </div>
                      {validationAttempted && fieldErrors.trigger_questions && (
                        <p className="mt-1.5 text-red-500 text-xs">{fieldErrors.trigger_questions}</p>
                      )}
                    </div>

                    {/* Questions List */}
                    {formData.trigger_questions.length > 0 ? (
                      <div className="space-y-3">
                        {formData.trigger_questions.map((tq, index) => (
                          <div
                            key={index}
                            className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                          >
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex-1">
                                <div className="flex items-start">
                                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-semibold mr-2 mt-0.5">
                                    {index + 1}
                                  </span>
                                  <div className="flex-1">
                                    <p className="font-medium text-sm text-gray-900">{tq.question}</p>
                                    {tq.question_key && (
                                      <p className="text-xs text-gray-500 mt-1">
                                        Key: <code className="bg-gray-200 px-1 py-0.5 rounded">{tq.question_key}</code>
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveTriggerQuestion(index)}
                                className="ml-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Remove condition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            
                            <div>
                              <TextField
                                label="Required Answer (leave empty for any answer)"
                                value={tq.answer || ''}
                                onChange={(value) => handleTriggerQuestionAnswerChange(index, value)}
                                placeholder="e.g., Yes, NDIS, etc."
                                size="medium"
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
                        <HelpCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                        <p className="text-sm text-gray-600">No trigger conditions added yet</p>
                        <p className="text-xs text-gray-500 mt-1">Add at least one question condition above</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column - Settings & Info (1/3 width) */}
                <div className="lg:col-span-1 space-y-6">
                  {/* Status Section */}
                  <div className="bg-white border border-gray-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Status</h3>
                    
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <p className="font-medium text-gray-900">Enable Trigger</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formData.enabled ? 'Trigger is active' : 'Trigger is inactive'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, enabled: !formData.enabled })}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          formData.enabled ? 'bg-blue-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            formData.enabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Help Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
                      <HelpCircle className="w-5 h-5 mr-2" />
                      How It Works
                    </h3>
                    <ul className="text-sm text-blue-800 space-y-2">
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 mr-2"></span>
                        <span>Add questions that must be answered to trigger this email</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 mr-2"></span>
                        <span>Specify required answers or leave empty to trigger on any answer</span>
                      </li>
                      <li className="flex items-start">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 mr-2"></span>
                        <span>All conditions must match for the email to be sent</span>
                      </li>
                    </ul>
                  </div>

                  {/* Action Buttons */}
                  <div className="sticky top-6 space-y-3">
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
                      onClick={onClose}
                      disabled={isLoading}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EmailTriggerForm;