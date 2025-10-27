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
  const [questions, setQuestions] = useState([]);
  const [templateInfo, setTemplateInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggerData, setTriggerData] = useState(null);

  // Load questions and template on mount
  useEffect(() => {
    fetchQuestionsWithTemplate();
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
   * Fetch questions from the existing booking-templates API
   */
  const fetchQuestionsWithTemplate = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/booking-templates/questions?include_options=true');
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Failed to fetch questions');
      }

      console.log('Questions loaded:', result.questions?.length || 0);

      setQuestions(result.questions || []);
      setTemplateInfo({
        id: result.template_id,
        name: result.template_name,
        total: result.total
      });

      setLoading(false);
    } catch (error) {
      console.error('Error fetching questions:', error);
      toast.error(error.message || 'Failed to load questions');
      setLoading(false);
    }
  };

  /**
   * Populate form from existing trigger data
   * Converts from database format to component format
   */
  const populateFormFromTrigger = (trigger) => {
    console.log('Populating form with trigger:', trigger);
    console.log('Available questions:', questions.length);

    // Convert trigger_questions from { question: "text", answer: "value" } 
    // to { question_text: "text", answer: "value", question_id: null }
    const convertedQuestions = (trigger.trigger_questions || []).map(tq => {
      // Find matching question by text
      const matchingQuestion = questions.find(q => 
        q.question.toLowerCase().trim() === tq.question.toLowerCase().trim()
      );

      console.log('Question match:', {
        original: tq.question,
        matched: matchingQuestion ? 'YES - ID: ' + matchingQuestion.id : 'NO'
      });

      return {
        question_text: tq.question,
        question_id: matchingQuestion ? matchingQuestion.id : null,
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
        { question_id: null, question_text: '', answer: '' }
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
          answer: '' // Reset answer when question changes
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      
      return { ...prev, trigger_questions: updated };
    });
  };

  /**
   * Render answer input based on question type
   */
  const renderAnswerInput = (triggerQuestion, index) => {
    const question = getQuestionById(triggerQuestion.question_id);
    
    if (!question) {
      return (
        <input
          type="text"
          className="w-full p-2 border rounded bg-gray-50"
          placeholder="Select a question first"
          disabled
        />
      );
    }

    const { question_type, options } = question;
    const currentAnswer = triggerQuestion.answer;

    switch (question_type) {
      case 'select':
        return (
          <select
            value={currentAnswer}
            onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          >
            <option value="">-- Select Answer --</option>
            {options && options.map((opt, i) => (
              <option key={i} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {options && options.map((opt, i) => (
              <label key={i} className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name={`radio-${index}`}
                  value={opt.value}
                  checked={currentAnswer === opt.value}
                  onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
                  className="w-4 h-4"
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        // Parse current answer (can be array or comma-separated string)
        const selectedValues = Array.isArray(currentAnswer) 
          ? currentAnswer 
          : (currentAnswer ? currentAnswer.split(',').map(v => v.trim()) : []);

        const toggleCheckbox = (value) => {
          let newValues;
          if (selectedValues.includes(value)) {
            newValues = selectedValues.filter(v => v !== value);
          } else {
            newValues = [...selectedValues, value];
          }
          // Store as comma-separated string to match existing data format
          updateTriggerQuestion(index, 'answer', newValues.join(', '));
        };

        return (
          <div className="space-y-2">
            {options && options.map((opt, i) => {
              const isChecked = selectedValues.includes(opt.value);
              return (
                <label key={i} className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={isChecked}
                    onChange={() => toggleCheckbox(opt.value)}
                    className="w-4 h-4"
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        );

      case 'textarea':
        return (
          <textarea
            value={currentAnswer}
            onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            rows="3"
            placeholder="Enter expected answer (leave empty to trigger on any response)"
          />
        );

      case 'email':
        return (
          <input
            type="email"
            value={currentAnswer}
            onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Enter expected email (leave empty to trigger on any response)"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={currentAnswer}
            onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Enter expected number (leave empty to trigger on any response)"
          />
        );

      case 'text':
      default:
        return (
          <input
            type="text"
            value={currentAnswer}
            onChange={(e) => updateTriggerQuestion(index, 'answer', e.target.value)}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="Enter expected answer (leave empty to trigger on any response)"
          />
        );
    }
  };

  /**
   * Handle form submission
   * Converts component format back to database format and calls the appropriate API
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validation
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
      for (let email of emails) {
        if (email && !emailRegex.test(email)) {
          toast.error(`Invalid email: ${email}`);
          return;
        }
      }
    } else if (formData.type === 'external') {
      // For external, we need a question that contains email
      const hasEmailQuestion = formData.trigger_questions.some(tq => {
        const q = getQuestionById(tq.question_id);
        return q && (q.question_type === 'email' || q.question.toLowerCase().includes('email'));
      });
      
      if (!hasEmailQuestion) {
        toast.error('External triggers must include a question that contains an email address');
        return;
      }
    }

    try {
      setSaving(true);

      // Convert back to database format with all required fields
      const trigger_questions = formData.trigger_questions.map(tq => {
        const question = getQuestionById(tq.question_id);
        
        if (!question) {
          throw new Error(`Question with ID ${tq.question_id} not found`);
        }
        
        // Convert answer back to array if it's a comma-separated string for checkbox type
        let answer = tq.answer;
        if (question.question_type === 'checkbox' && typeof answer === 'string' && answer.includes(',')) {
          answer = answer.split(',').map(v => v.trim()).filter(v => v);
        }
        
        return {
          question: question.question,
          question_key: question.question_key || `question_${question.id}`,
          question_type: question.question_type,
          section_id: question.section_id,
          options: question.options || [],
          answer: answer || (question.question_type === 'select' || question.question_type === 'radio' ? '' : undefined)
        };
      });

      // Prepare the request body
      const requestBody = {
        recipient: formData.recipient.trim(),
        email_template_id: formData.email_template_id || templateInfo.id,
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
        <span className="ml-3 text-gray-600">Loading questions...</span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
      {/* Template Info Banner */}
      {templateInfo && (
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
                Using: {templateInfo.name} - {templateInfo.total} questions available
              </p>
            </div>
          </div>
        </div>
      )}

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
                        This question text doesn't match any current question. Please select the correct question.
                      </p>
                    </div>
                  )}
                </div>

                {/* Question Info */}
                {selectedQuestion && (
                  <div className="mb-3 flex items-center space-x-2">
                    <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                      Type: {selectedQuestion.question_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {selectedQuestion.page_title}
                    </span>
                  </div>
                )}

                {/* Answer Input */}
                <div>
                  <label className="block text-sm text-gray-600 mb-1">
                    Expected Answer {['select', 'radio'].includes(selectedQuestion?.question_type) ? '*' : '(Optional)'}
                  </label>
                  {renderAnswerInput(tq, index)}
                  {selectedQuestion && !['select', 'radio', 'checkbox'].includes(selectedQuestion.question_type) && (
                    <p className="text-xs text-gray-500 mt-1">
                      Leave empty to trigger when this question receives any answer
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {formData.trigger_questions.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No trigger questions added yet.</p>
              <p className="text-sm">Click "Add Question" to get started.</p>
            </div>
          )}
        </div>
      </div>

      {/* Recipients - Internal or Highlights */}
      {(formData.type === 'internal' || formData.type === 'highlights') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Recipient Emails *
          </label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData(prev => ({ ...prev, recipient: e.target.value }))}
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            placeholder="email@example.com or email1@example.com, email2@example.com"
            required
          />
          <p className="text-xs text-gray-500 mt-1">
            Enter one or more email addresses separated by commas
          </p>
        </div>
      )}

      {/* Recipients - External */}
      {formData.type === 'external' && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-700">
            <strong>External triggers</strong> send emails to an address provided in one of the trigger questions.
            Make sure one of your trigger questions asks for an email address.
          </p>
        </div>
      )}

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