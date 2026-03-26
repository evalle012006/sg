import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';
import { TRIGGER_CONTEXTS, getAllTriggerContexts } from '../../services/triggerContextRegistryClient';
import TriggerEventSearchDropdown from '../emails/TriggerEventSearchDropdown';
import ContextConditionsSelector from '../emails/ContextConditionsModal';
import RecipientSelector from '../emails/RecipientSelector';
import EmailTemplateSearchDropdown from '../emails/EmailTemplateSearchDropdown';
import QuestionSearchDropdown from '../emails/QuestionSearchDropdown';
import MultiSelectDropdown from '../emails/MultiSelectDropdown';

const EmailTriggerForm = ({ onSuccess, onCancel }) => {
  const router = useRouter();
  const { id: triggerId, mode } = router.query;
  const isEditMode = mode === 'edit' && triggerId;
  const isViewMode = mode === 'view' && triggerId;

  const [formData, setFormData] = useState({
    trigger_source: 'booking_form',
    type: 'internal',
    trigger_questions: [],
    trigger_conditions: null,
    trigger_context: null,
    context_conditions: {},
    data_mapping: null,
    priority: 5,
    description: '',
    recipient: '',
    subject: '',
    enabled: true,
    email_template_id: null,
  });

  const [templates, setTemplates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [bookingStatuses, setBookingStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggerData, setTriggerData] = useState(null);

  const [triggerContexts, setTriggerContexts] = useState([]);
  const [triggerContextsByEntity, setTriggerContextsByEntity] = useState({});

  useEffect(() => {
    const allContexts = getAllTriggerContexts();
    setTriggerContexts(allContexts);
    setTriggerContextsByEntity(TRIGGER_CONTEXTS);
  }, []);

  useEffect(() => { fetchTemplatesAndQuestions(); }, []);

  useEffect(() => {
    if ((isEditMode || isViewMode) && triggerId) fetchTriggerData(triggerId);
  }, [triggerId, mode]);

  useEffect(() => {
    if (triggerData && questions.length > 0) populateFormFromTrigger(triggerData);
  }, [triggerData, questions]);

  // ─── Data fetching ────────────────────────────────────────────────────────

  const fetchTemplatesAndQuestions = async () => {
    try {
      setLoading(true);

      const templatesRes = await fetch('/api/email-templates');
      if (!templatesRes.ok) throw new Error('Failed to fetch templates');
      const templatesResult = await templatesRes.json();
      const templatesData = templatesResult.success ? templatesResult.data : templatesResult;
      setTemplates(templatesData.filter(t => t.is_active));

      const questionsRes = await fetch('/api/booking-templates/questions?include_options=true');
      if (!questionsRes.ok) throw new Error('Failed to fetch questions');
      const questionsResult = await questionsRes.json();
      setQuestions(questionsResult.questions || []);

      const statusRes = await fetch('/api/settings/booking-statuses');
      const statusData = await statusRes.json();
      setBookingStatuses(
        statusData
          .map(s => { try { return JSON.parse(s.value); } catch { return null; } })
          .filter(Boolean)
      );

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load templates or questions');
      setLoading(false);
    }
  };

  const fetchTriggerData = async id => {
    try {
      const res = await fetch(`/api/email-triggers/${id}`);
      if (!res.ok) throw new Error('Failed to fetch trigger data');
      const result = await res.json();
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

  // ─── Populate form from existing trigger (edit / view) ───────────────────

  const populateFormFromTrigger = trigger => {
    const triggerSource = trigger.type === 'system' ? 'system_event' : 'booking_form';

    let convertedQuestions = [];
    if (triggerSource === 'booking_form') {
      if (trigger.triggerQuestions && trigger.triggerQuestions.length > 0) {
        convertedQuestions = trigger.triggerQuestions.map(tq => ({
          question_text: tq.question?.question || '',
          question_id: tq.question_id,
          question_key: tq.question?.question_key || '',
          answer: tq.answer || '',
        }));
      } else {
        // Legacy: trigger_questions was a JSON column
        let legacyQuestions = trigger.trigger_questions || [];
        if (typeof legacyQuestions === 'string') {
          try { legacyQuestions = JSON.parse(legacyQuestions); } catch { legacyQuestions = []; }
        }
        convertedQuestions = legacyQuestions.map(tq => {
          let matchingQuestion = null;
          if (tq.question_key)
            matchingQuestion = questions.find(q => q.question_key === tq.question_key);
          if (!matchingQuestion && tq.question)
            matchingQuestion = questions.find(
              q => q.question.toLowerCase().trim() === tq.question.toLowerCase().trim()
            );
          return {
            question_text: tq.question,
            question_id: matchingQuestion ? matchingQuestion.id : null,
            question_key: tq.question_key,
            answer: Array.isArray(tq.answer) ? tq.answer.join(', ') : tq.answer || '',
          };
        });
      }
    }

    setFormData({
      trigger_source: triggerSource,
      type: trigger.type || 'internal',
      trigger_questions: convertedQuestions,
      trigger_conditions: trigger.trigger_conditions || null,
      trigger_context: trigger.trigger_context || null,
      context_conditions: trigger.context_conditions || {},
      data_mapping: trigger.data_mapping || null,
      priority: trigger.priority || 5,
      description: trigger.description || '',
      recipient: trigger.recipient || '',
      subject: trigger.template?.subject || '',
      enabled: trigger.enabled !== undefined ? trigger.enabled : true,
      email_template_id: trigger.email_template_id || null,
    });
  };

  // ─── Trigger question helpers ─────────────────────────────────────────────

  const getQuestionById = questionId =>
    questions.find(q => q.id === parseInt(questionId));

  const isQuestionSelected = questionId =>
    formData.trigger_questions.some(tq => tq.question_id === parseInt(questionId));

  const addTriggerQuestion = () => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: [
        ...prev.trigger_questions,
        { question_id: null, question_text: '', answer: '', question_key: null },
      ],
    }));
  };

  const removeTriggerQuestion = index => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: prev.trigger_questions.filter((_, i) => i !== index),
    }));
  };

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
          answer: '',
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, trigger_questions: updated };
    });
  };

  // ─── Answer input renderer ────────────────────────────────────────────────

  const isMultiSelectQuestion = question => {
    if (!question) return false;
    const questionType = question.question_type || question.type;
    if (['checkbox', 'service-cards', 'multi-select', 'checkbox-button'].includes(questionType))
      return true;
    if (
      question.question_key?.includes('service') ||
      question.display_label?.toLowerCase().includes('service')
    )
      return true;
    return false;
  };

  const renderAnswerInput = (question, value, onChange) => {
    if (!question) {
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Select a question first"
          className="w-full p-2 border rounded bg-gray-100"
          disabled
        />
      );
    }

    const questionType = question.question_type || question.type;

    if (isMultiSelectQuestion(question)) {
      return (
        <div className="space-y-2">
          <MultiSelectDropdown
            question={question}
            value={value}
            onChange={onChange}
            disabled={isViewMode}
          />
          <p className="text-xs text-gray-500">
            💡 Select one or more options. The trigger will fire if the guest selects any of these.
          </p>
        </div>
      );
    }

    switch (questionType) {
      case 'select':
      case 'radio':
        return (
          <select
            value={value}
            onChange={e => onChange(e.target.value)}
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

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder="Enter expected answer (leave empty to trigger on any response)"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
          />
        );
    }
  };

  // ─── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.email_template_id) {
      toast.error('Please select an email template');
      return;
    }

    if (formData.trigger_source === 'booking_form') {
      if (
        formData.trigger_questions.length === 0 &&
        !formData.trigger_conditions?.booking_status?.length
      ) {
        toast.error('Please add at least one trigger question or select a booking status condition');
        return;
      }

      for (let i = 0; i < formData.trigger_questions.length; i++) {
        const tq = formData.trigger_questions[i];
        if (!tq.question_id) {
          toast.error(`Please select a question for trigger #${i + 1}`);
          return;
        }
        const question = getQuestionById(tq.question_id);
        if (['select', 'radio'].includes(question?.question_type) && !tq.answer) {
          toast.error(`Please select an answer for trigger #${i + 1}`);
          return;
        }
      }
    } else {
      if (!formData.trigger_context) {
        toast.error('Please select a trigger event');
        return;
      }
      if (!formData.description?.trim()) {
        toast.error('Please enter a description for this system trigger');
        return;
      }
    }

    if (formData.type === 'internal' || formData.type === 'highlights') {
      if (!formData.recipient?.trim()) {
        toast.error('Please add at least one recipient email');
        return;
      }
      if (!formData.recipient.startsWith('recipient_type:')) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const invalidEmails = formData.recipient
          .split(',')
          .map(e => e.trim())
          .filter(email => !emailRegex.test(email));
        if (invalidEmails.length > 0) {
          toast.error(`Invalid email address(es): ${invalidEmails.join(', ')}`);
          return;
        }
      }
    }

    try {
      setSaving(true);

      const requestBody = {
        recipient: formData.recipient.trim(),
        email_template_id: formData.email_template_id,
        type: formData.trigger_source === 'system_event' ? 'system' : formData.type,
        enabled: formData.enabled,
        description: formData.description || null,
        priority: formData.priority || 5,
      };

      if (formData.trigger_source === 'booking_form') {
        requestBody.trigger_questions = formData.trigger_questions.map(tq => {
          const question = getQuestionById(tq.question_id);
          return {
            question_id: tq.question_id,
            question: question?.question || tq.question_text,
            question_key: question?.question_key || tq.question_key,
            question_type: question?.question_type || question?.type,
            answer: tq.answer,
            section_id: question?.section_id,
            options: question?.options || [],
          };
        });
        requestBody.trigger_conditions = formData.trigger_conditions || null;
      } else {
        requestBody.trigger_context = formData.trigger_context;
        requestBody.context_conditions = formData.context_conditions;
        requestBody.data_mapping = formData.data_mapping || null;
      }

      if (isEditMode) requestBody.id = parseInt(triggerId);

      const endpoint = isEditMode
        ? '/api/email-triggers/update'
        : '/api/email-triggers/create';

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && Array.isArray(result.errors))
          throw new Error(result.errors.join(', '));
        throw new Error(result.message || 'Failed to save trigger');
      }

      toast.success(`Email trigger ${isEditMode ? 'updated' : 'created'} successfully`);
      if (result.success && result.data && isEditMode) setTriggerData(result.data);
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving trigger:', error);
      toast.error(error.message || 'Failed to save trigger');
    } finally {
      setSaving(false);
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        <span className="ml-3 text-gray-600">Loading...</span>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">

      {/* ── Header ── */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="ml-3">
            <h4 className="text-sm font-semibold text-blue-900">
              {isViewMode
                ? 'Viewing Email Trigger'
                : isEditMode
                  ? 'Editing Email Trigger'
                  : 'Create New Email Trigger'}
            </h4>
            <p className="text-sm text-blue-700 mt-1">
              {questions.length > 0
                ? `${questions.length} questions available from booking template`
                : 'Configure when and how automated emails are sent'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Trigger Source ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Trigger Source *{' '}
          <span className="text-xs text-gray-500">(What triggers this email?)</span>
        </label>
        <div className="grid grid-cols-2 gap-3">
          {[
            {
              value: 'booking_form',
              type: 'internal',
              color: 'blue',
              icon: '📋',
              label: 'Booking Form',
              desc: 'Fires based on guest answers to booking questions',
            },
            {
              value: 'system_event',
              type: 'system',
              color: 'orange',
              icon: '🔧',
              label: 'System Event',
              desc: 'Fires when specific code events occur (bookings, courses, etc.)',
            },
          ].map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() =>
                setFormData(prev => ({ ...prev, trigger_source: opt.value, type: opt.type }))
              }
              disabled={isViewMode}
              className={`p-4 border-2 rounded-lg transition-all text-left
                ${formData.trigger_source === opt.value
                  ? `border-${opt.color}-500 bg-${opt.color}-50`
                  : `border-gray-200 hover:border-${opt.color}-300`}
                ${isViewMode ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5
                    ${formData.trigger_source === opt.value
                      ? `border-${opt.color}-500 bg-${opt.color}-500`
                      : 'border-gray-300'}`}
                >
                  {formData.trigger_source === opt.value && (
                    <div className="w-2.5 h-2.5 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{opt.icon} {opt.label}</p>
                  <p className="text-xs text-gray-500 mt-1">{opt.desc}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Email Template ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Email Template *{' '}
          <span className="text-xs text-gray-500">(Which email to send)</span>
        </label>
        <EmailTemplateSearchDropdown
          templates={templates}
          value={formData.email_template_id}
          onChange={templateId =>
            setFormData(prev => ({ ...prev, email_template_id: templateId }))
          }
          disabled={isViewMode}
        />
      </div>

      {/* ════════════════════════════════════════════
          BOOKING FORM BRANCH
      ════════════════════════════════════════════ */}
      {formData.trigger_source === 'booking_form' && (
        <>
          {/* Trigger Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Type *
            </label>
            <select
              value={formData.type}
              onChange={e => setFormData(prev => ({ ...prev, type: e.target.value }))}
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              disabled={isViewMode}
            >
              <option value="internal">Internal (Fixed Recipients)</option>
              <option value="external">External (Answer-based Recipient)</option> {/* Need to add validation that it should have a question type email in the selected trigger question */}
              <option value="highlights">Highlights (Fixed Recipients)</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {formData.type === 'internal' && 'Send to specified email addresses'}
              {formData.type === 'external' &&
                "Recipient email is taken from the guest's answer (e.g. coordinator email)"}
              {formData.type === 'highlights' &&
                'Send a summary of matched trigger answers to specified recipients'}
            </p>
          </div>

          {/* Recipient — shown for internal & highlights */}
          {(formData.type === 'internal' || formData.type === 'highlights') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recipient *
              </label>
              <RecipientSelector
                value={formData.recipient}
                onChange={value => setFormData(prev => ({ ...prev, recipient: value }))}
                disabled={isViewMode}
                triggerType={formData.type}
              />
            </div>
          )}

          {/* Trigger Questions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Trigger Questions *{' '}
                <span className="text-xs text-gray-500">
                  (trigger fires when ALL conditions are met)
                </span>
              </label>
              {!isViewMode && (
                <button
                  type="button"
                  onClick={addTriggerQuestion}
                  className="px-3 py-1.5 bg-blue-500 text-white text-sm rounded hover:bg-blue-600 transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M12 4v16m8-8H4" />
                  </svg>
                  + Add Question
                </button>
              )}
            </div>

            {formData.trigger_questions.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center">
                <svg className="w-8 h-8 text-gray-300 mx-auto mb-2" fill="none"
                  stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm text-gray-500">No trigger questions added yet</p>
                {!isViewMode && (
                  <p className="text-xs text-gray-400 mt-1">
                    Click &quot;+ Add Question&quot; to add a condition, or use only booking
                    status conditions below
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {formData.trigger_questions.map((tq, index) => {
                  const question = getQuestionById(tq.question_id);
                  return (
                    <div key={index} className="border rounded-lg p-4 bg-gray-50 relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">
                          Trigger #{index + 1}
                        </span>
                        {!isViewMode && (
                          <button
                            type="button"
                            onClick={() => removeTriggerQuestion(index)}
                            className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
                            title="Remove condition"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor"
                              viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {/* Question selector */}
                      <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Select Question
                        </label>
                        <QuestionSearchDropdown
                          questions={questions}
                          value={tq.question_id}
                          onChange={value =>
                            updateTriggerQuestion(index, 'question_id', value)
                          }
                          isQuestionSelected={isQuestionSelected}
                          currentQuestionId={tq.question_id}
                          disabled={isViewMode}
                        />
                        {question && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded">
                              Type: {question.question_type || question.type}
                            </span>
                            {question.page_title && (
                              <span className="text-xs text-gray-400">{question.page_title}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Expected answer */}
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Expected Answer{' '}
                          {['select', 'radio'].includes(question?.question_type) && (
                            <span className="text-red-500">*</span>
                          )}
                        </label>
                        {renderAnswerInput(
                          question,
                          tq.answer,
                          value => updateTriggerQuestion(index, 'answer', value)
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Booking Status Conditions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-gray-700">
                Booking Status Conditions{' '}
                <span className="text-xs text-gray-500">
                  (optional — trigger only fires for these statuses)
                </span>
              </label>
            </div>
            <div className="border rounded p-3 bg-gray-50">
              <p className="text-xs text-gray-500 mb-2">
                If none selected, trigger fires for all booking statuses
              </p>
              <div className="flex flex-wrap gap-2">
                {bookingStatuses.map(status => {
                  const selected = (
                    formData.trigger_conditions?.booking_status || []
                  ).includes(status.name);
                  return (
                    <button
                      key={status.name}
                      type="button"
                      disabled={isViewMode}
                      onClick={() => {
                        const current = formData.trigger_conditions?.booking_status || [];
                        const updated = selected
                          ? current.filter(s => s !== status.name)
                          : [...current, status.name];
                        setFormData(prev => ({
                          ...prev,
                          trigger_conditions: updated.length > 0
                            ? { ...prev.trigger_conditions, booking_status: updated }
                            : null,
                        }));
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                        ${selected
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'}
                        ${isViewMode ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      {status.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════
          SYSTEM EVENT BRANCH
      ════════════════════════════════════════════ */}
      {formData.trigger_source === 'system_event' && (
        <>
          {/* Trigger Event */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Trigger Event *{' '}
              <span className="text-xs text-gray-500">(When should this fire?)</span>
            </label>
            <TriggerEventSearchDropdown
              events={triggerContexts}
              eventsByEntity={triggerContextsByEntity}
              value={formData.trigger_context}
              onChange={value =>
                setFormData(prev => ({ ...prev, trigger_context: value }))
              }
              disabled={isViewMode}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description *{' '}
              <span className="text-xs text-gray-500">(What does this trigger do?)</span>
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={e =>
                setFormData(prev => ({ ...prev, description: e.target.value }))
              }
              placeholder="e.g., Send iCare nights allocation notification"
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              disabled={isViewMode}
              required
            />
          </div>

          {/* Recipient */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recipient *
            </label>
            <RecipientSelector
              value={formData.recipient}
              onChange={value => setFormData(prev => ({ ...prev, recipient: value }))}
              disabled={isViewMode}
              triggerType={formData.type}
            />
          </div>

          {/* Context Conditions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Context Conditions{' '}
              <span className="text-xs text-gray-500">(optional — additional filters)</span>
            </label>
            <ContextConditionsSelector
              triggerContext={formData.trigger_context}
              currentConditions={formData.context_conditions}
              onChange={conditions =>
                setFormData(prev => ({ ...prev, context_conditions: conditions }))
              }
              disabled={isViewMode}
            />
          </div>

          {/* Priority */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Priority{' '}
              <span className="text-xs text-gray-500">(1–10, lower = higher priority)</span>
            </label>
            <input
              type="number"
              min="1"
              max="10"
              value={formData.priority}
              onChange={e =>
                setFormData(prev => ({ ...prev, priority: parseInt(e.target.value) || 5 }))
              }
              className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
              disabled={isViewMode}
            />
          </div>
        </>
      )}

      {/* ── Enabled ── */}
      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="enabled"
          checked={formData.enabled}
          onChange={e => setFormData(prev => ({ ...prev, enabled: e.target.checked }))}
          disabled={isViewMode}
          className="w-4 h-4"
        />
        <label htmlFor="enabled" className="text-sm text-gray-700">
          Enabled (trigger will fire when conditions are met)
        </label>
      </div>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end space-x-3 pt-4 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
          disabled={saving}
        >
          {isViewMode ? 'Close' : 'Cancel'}
        </button>
        {!isViewMode && (
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={saving}
          >
            {saving ? 'Saving...' : isEditMode ? 'Update Trigger' : 'Create Trigger'}
          </button>
        )}
      </div>
    </form>
  );
};

export default EmailTriggerForm;