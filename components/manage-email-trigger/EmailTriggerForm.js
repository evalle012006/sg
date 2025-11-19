import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

const EmailTriggerForm = ({ onSuccess, onCancel }) => {
  const router = useRouter();
  const { id: triggerId, mode } = router.query;
  const isEditMode = mode === 'edit' && triggerId;

  // Form state
  const [formData, setFormData] = useState({
    type: 'internal',
    trigger_questions: [],
    recipient: '',
    subject: '',
    enabled: true,
    email_template_id: null
  });

  // UI state
  const [templates, setTemplates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggerData, setTriggerData] = useState(null);

  // Fetch templates and questions on mount
  useEffect(() => {
    fetchTemplatesAndQuestions();
  }, []);

  // Fetch trigger data when in edit mode
  useEffect(() => {
    if (isEditMode && triggerId) {
      fetchTriggerData(triggerId);
    }
  }, [isEditMode, triggerId]);

  // Populate form when both trigger data and questions are loaded
  useEffect(() => {
    if (triggerData && questions.length > 0) {
      populateFormFromTrigger(triggerData);
    }
  }, [triggerData, questions]);

  /**
   * Fetch both templates and questions
   * Questions come from booking template (not email template specific)
   * Templates are just for choosing which email to send
   */
  const fetchTemplatesAndQuestions = async () => {
    try {
      setLoading(true);
      
      // Fetch email templates
      const templatesResponse = await fetch('/api/email-templates');
      if (!templatesResponse.ok) {
        throw new Error('Failed to fetch templates');
      }
      const templatesResult = await templatesResponse.json();
      console.log('Templates loaded:', templatesResult);

      // Check if it's wrapped in { success, data } or just an array
      const templatesData = templatesResult.success ? templatesResult.data : templatesResult;
      
      // Filter to only active templates
      const activeTemplates = templatesData.filter(t => t.is_active);
      setTemplates(activeTemplates);

      // Fetch questions from booking template (not email template specific)
      const questionsResponse = await fetch('/api/booking-templates/questions?include_options=true');
      if (!questionsResponse.ok) {
        throw new Error('Failed to fetch questions');
      }
      const questionsResult = await questionsResponse.json();
      console.log('Questions loaded:', questionsResult.questions?.length || 0);

      setQuestions(questionsResult.questions || []);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load templates or questions');
      setLoading(false);
    }
  };

  /**
   * Fetch trigger data by ID
   */
  const fetchTriggerData = async (id) => {
    try {
      console.log('Fetching trigger data for ID:', id);
      
      const response = await fetch(`/api/email-triggers/${id}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch trigger data');
      }

      const result = await response.json();
      console.log('Trigger data loaded:', result);

      if (result.success && result.data) {
        setTriggerData(result.data);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (error) {
      console.error('Error fetching trigger:', error);
      toast.error('Failed to load trigger data');
    }
  };

  /**
   * Populate form from existing trigger data
   */
  const populateFormFromTrigger = (trigger) => {
    console.log('Populating form with trigger:', trigger);
    console.log('Available questions:', questions.length);

    // Convert trigger_questions from database format to component format
    const convertedQuestions = (trigger.trigger_questions || []).map(tq => {
      // Find matching question by question_key (more reliable than text matching)
      let matchingQuestion = null;
      
      if (tq.question_key) {
        matchingQuestion = questions.find(q => q.question_key === tq.question_key);
      }
      
      // Fallback to text matching if question_key match fails
      if (!matchingQuestion && tq.question) {
        matchingQuestion = questions.find(q => 
          q.question.toLowerCase().trim() === tq.question.toLowerCase().trim()
        );
      }

      console.log('Question match:', {
        original: tq.question,
        question_key: tq.question_key,
        matched: matchingQuestion ? 'YES - ID: ' + matchingQuestion.id : 'NO'
      });

      return {
        question_text: tq.question,
        question_id: matchingQuestion ? matchingQuestion.id : null,
        question_key: tq.question_key,
        answer: Array.isArray(tq.answer) ? tq.answer.join(', ') : (tq.answer || '')
      };
    });

    const newFormData = {
      type: trigger.type || 'internal',
      trigger_questions: convertedQuestions,
      recipient: trigger.recipient || '',
      subject: trigger.template?.subject || '',
      enabled: trigger.enabled !== undefined ? trigger.enabled : true,
      email_template_id: trigger.email_template_id || null
    };

    console.log('Form data set:', newFormData);
    setFormData(newFormData);
  };

  /**
   * Get question by ID
   */
  const getQuestionById = (questionId) => {
    return questions.find(q => q.id === parseInt(questionId));
  };

  /**
   * Check if question is already selected
   */
  const isQuestionSelected = (questionId) => {
    return formData.trigger_questions.some(tq => tq.question_id === parseInt(questionId));
  };

  /**
   * Add a new trigger question
   */
  const addTriggerQuestion = () => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: [
        ...prev.trigger_questions,
        { question_id: null, question_text: '', answer: '', question_key: null }
      ]
    }));
  };

  /**
   * Remove a trigger question
   */
  const removeTriggerQuestion = (index) => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: prev.trigger_questions.filter((_, i) => i !== index)
    }));
  };

  /**
   * Update trigger question field
   */
  const updateTriggerQuestion = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.trigger_questions];
      
      if (field === 'question_id') {
        const question = getQuestionById(value);
        updated[index] = {
          ...updated[index],
          question_id: value,
          question_text: question ? question.question : '',
          question_key: question ? question.question_key : null,
          answer: '' // Reset answer when question changes
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value
        };
      }
      
      return { ...prev, trigger_questions: updated };
    });
  };

  /**
   * Render answer input based on question type
   */
  const renderAnswerInput = (question, value, onChange) => {
    if (!question) {
      return (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Select a question first"
          className="w-full p-2 border rounded bg-gray-100"
          disabled
        />
      );
    }

    const questionType = question.question_type || question.type;

    switch (questionType) {
      case 'select':
      case 'radio':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Select an answer --</option>
            {(question.options || []).map((opt, idx) => (
              <option key={idx} value={opt.value || opt.label}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            <p className="text-xs text-gray-600 mb-2">
              Select one or more options (comma-separated values):
            </p>
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="e.g., option1, option2"
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            />
            <div className="text-xs text-gray-500">
              Available options: {(question.options || []).map(opt => opt.label).join(', ')}
            </div>
          </div>
        );

      case 'text':
      case 'textarea':
      case 'email':
      case 'tel':
      case 'number':
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Enter expected answer (leave empty to trigger on any response)"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!formData.email_template_id) {
      toast.error('Please select an email template');
      return;
    }

    if (formData.trigger_questions.length === 0) {
      toast.error('Please add at least one trigger question');
      return;
    }

    // Validate all trigger questions
    for (let i = 0; i < formData.trigger_questions.length; i++) {
      const tq = formData.trigger_questions[i];
      if (!tq.question_id) {
        toast.error(`Please select a question for trigger #${i + 1}`);
        return;
      }

      const question = getQuestionById(tq.question_id);
      // Require answer for select and radio types
      if (['select', 'radio'].includes(question?.question_type) && !tq.answer) {
        toast.error(`Please select an answer for trigger #${i + 1}`);
        return;
      }
    }

    if (formData.type === 'internal' || formData.type === 'highlights') {
      if (!formData.recipient || !formData.recipient.trim()) {
        toast.error('Please add at least one recipient email');
        return;
      }
      // Validate emails (can be comma-separated)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const emails = formData.recipient.split(',').map(e => e.trim());
      const invalidEmails = emails.filter(email => !emailRegex.test(email));
      
      if (invalidEmails.length > 0) {
        toast.error(`Invalid email address(es): ${invalidEmails.join(', ')}`);
        return;
      }
    }

    try {
      setSaving(true);

      // Convert trigger_questions to database format
      const trigger_questions = formData.trigger_questions.map(tq => {
        const question = getQuestionById(tq.question_id);
        return {
          question_id: tq.question_id,
          question: question?.question || tq.question_text,
          question_key: question?.question_key || tq.question_key,
          question_type: question?.question_type || question?.type,
          answer: tq.answer,
          section_id: question?.section_id,
          options: question?.options || []
        };
      });

      // Prepare the request body
      const requestBody = {
        recipient: formData.recipient.trim(),
        email_template_id: formData.email_template_id,
        type: formData.type,
        enabled: formData.enabled,
        trigger_questions: trigger_questions
      };

      // Add ID for update
      if (isEditMode) {
        requestBody.id = parseInt(triggerId);
      }

      console.log('Saving trigger:', requestBody);

      // Call the appropriate API endpoint
      const endpoint = isEditMode ? '/api/email-triggers/update' : '/api/email-triggers/create';
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        // Handle validation errors
        if (result.errors && Array.isArray(result.errors)) {
          const errorMessage = result.errors.join(', ');
          throw new Error(errorMessage);
        }
        throw new Error(result.message || 'Failed to save trigger');
      }

      console.log('API Response:', result);
      toast.success(`Email trigger ${isEditMode ? 'updated' : 'created'} successfully`);
      
      // Call the onSuccess callback
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error saving trigger:', error);
      toast.error(error.message || 'Failed to save trigger');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  // Get selected template info
  const selectedTemplate = templates.find(t => t.id === formData.email_template_id);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      {/* Header Info Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3">
            <h4 className="text-sm font-semibold text-blue-900">
              {isEditMode ? 'Editing Email Trigger' : 'Create New Email Trigger'}
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              {questions.length} questions available from booking template
            </p>
          </div>
        </div>
      </div>

      {/* Email Template Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Template * <span className="text-xs text-gray-500">(Which email to send)</span>
        </label>
        <select
          value={formData.email_template_id || ''}
          onChange={(e) => setFormData(prev => ({ ...prev, email_template_id: parseInt(e.target.value) || null }))}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          required
        >
          <option value="">-- Select an email template --</option>
          {templates.map(template => (
            <option key={template.id} value={template.id}>
              {template.name}
            </option>
          ))}
        </select>
        {selectedTemplate && (
          <p className="text-xs text-gray-600 mt-1">
            Subject: {selectedTemplate.subject}
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Select which email template will be sent when this trigger fires
        </p>
      </div>

      {/* Trigger Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Trigger Type *
        </label>
        <select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value }))}
          className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        >
          <option value="internal">Internal (Fixed Recipients)</option>
          <option value="external">External (Dynamic Recipient from Question)</option>
          <option value="highlights">Highlights</option>
        </select>
        <p className="text-xs text-gray-500 mt-1">
          {formData.type === 'internal' 
            ? 'Send to specified email addresses' 
            : formData.type === 'external'
            ? 'Send to email address from booking question'
            : 'Booking highlights summary'}
        </p>
      </div>

      {/* Recipient Email (for internal/highlights types) */}
      {(formData.type === 'internal' || formData.type === 'highlights') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Email(s) *
          </label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData(prev => ({ ...prev, recipient: e.target.value }))}
            placeholder="email@example.com or email1@example.com, email2@example.com"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter one or more email addresses (comma-separated)
          </p>
        </div>
      )}

      {/* External type note */}
      {formData.type === 'external' && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            ⚠️ For external triggers, the recipient email will be taken from the booking form. 
            Make sure one of your trigger questions asks for an email address.
          </p>
        </div>
      )}

      {/* Trigger Questions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Trigger Questions *
          </label>
          <button
            type="button"
            onClick={addTriggerQuestion}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            + Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div className="border rounded-lg p-4 bg-gray-50 text-center">
            <p className="text-gray-600">No questions available from booking template</p>
          </div>
        ) : (
          <div className="space-y-4">
            {formData.trigger_questions.map((tq, index) => {
              const selectedQuestion = getQuestionById(tq.question_id);
              
              return (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex items-start justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Trigger #{index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeTriggerQuestion(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  {/* Question Selection */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">Select Question</label>
                    <select
                      value={tq.question_id || ''}
                      onChange={(e) => updateTriggerQuestion(index, 'question_id', e.target.value)}
                      className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                      required
                    >
                      <option value="">-- Select a question --</option>
                      {questions.map(q => (
                        <option 
                          key={q.id} 
                          value={q.id}
                          disabled={isQuestionSelected(q.id) && tq.question_id !== q.id}
                        >
                          {q.display_label}
                        </option>
                      ))}
                    </select>
                    
                    {/* Show original question text if it couldn't be matched */}
                    {!tq.question_id && tq.question_text && (
                      <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                        <p className="font-medium text-yellow-800">⚠️ Original Question:</p>
                        <p className="text-yellow-700 mt-1">{tq.question_text}</p>
                        <p className="text-xs text-yellow-600 mt-1">
                          This question text doesn&apos;t match any current question. Please select the correct question.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Question Info */}
                  {selectedQuestion && (
                    <div className="mb-3 flex items-center space-x-2">
                      <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                        Type: {selectedQuestion.question_type || selectedQuestion.type}
                      </span>
                      <span className="text-xs text-gray-500">
                        {selectedQuestion.page_title}
                      </span>
                    </div>
                  )}

                  {/* Answer Input */}
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">
                      Expected Answer {['select', 'radio'].includes(selectedQuestion?.question_type) ? '*' : '(optional)'}
                    </label>
                    {renderAnswerInput(
                      selectedQuestion,
                      tq.answer,
                      (value) => updateTriggerQuestion(index, 'answer', value)
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Active Status */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={(e) => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
          className="w-4 h-4"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700">
          Enabled (trigger will fire when conditions are met)
        </label>
      </div>

      {/* Form Actions */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving}
        >
          {saving ? 'Saving...' : isEditMode ? 'Update Trigger' : 'Create Trigger'}
        </button>
      </div>
    </form>
  );
};

export default EmailTriggerForm;