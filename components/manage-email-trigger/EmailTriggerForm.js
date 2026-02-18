import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import { toast } from 'react-toastify';

/**
 * Searchable dropdown for selecting a question.
 * Replaces the plain <select> to make finding questions much easier.
 */
const QuestionSearchDropdown = ({ questions, value, onChange, isQuestionSelected, currentQuestionId, disabled }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Find the currently selected question label
  const selectedQuestion = questions.find(q => q.id === parseInt(value));

  // Filter questions based on search input
  const filtered = search.trim()
    ? questions.filter(q =>
        q.display_label?.toLowerCase().includes(search.toLowerCase()) ||
        q.question?.toLowerCase().includes(search.toLowerCase()) ||
        q.page_title?.toLowerCase().includes(search.toLowerCase())
      )
    : questions;

  // Close on outside click
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

  const handleSelect = (question) => {
    onChange(question.id);
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

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button — shows selected label or placeholder */}
      <div
        onClick={handleOpen}
        className={`w-full p-2 border rounded flex items-center justify-between cursor-pointer
          ${open ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      >
        <span className={selectedQuestion ? 'text-gray-900 text-sm' : 'text-gray-400 text-sm'}>
          {selectedQuestion ? selectedQuestion.display_label : '-- Select a question --'}
        </span>
        <div className="flex items-center space-x-1">
          {selectedQuestion && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
              title="Clear selection"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-1 px-0.5">
              {filtered.length} of {questions.length} questions
            </p>
          </div>

          {/* Question list */}
          <ul className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {filtered.length === 0 ? (
              <li className="p-3 text-sm text-gray-500 text-center italic">
                No questions match &quot;{search}&quot;
              </li>
            ) : (
              filtered.map(q => {
                const alreadyUsed = isQuestionSelected(q.id) && q.id !== parseInt(currentQuestionId);
                const isSelected = q.id === parseInt(value);

                return (
                  <li
                    key={q.id}
                    onClick={() => !alreadyUsed && handleSelect(q)}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors
                      ${isSelected ? 'bg-blue-50 text-blue-800' : ''}
                      ${alreadyUsed ? 'opacity-40 cursor-not-allowed bg-gray-50' : 'hover:bg-blue-50'}
                    `}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium leading-snug">{q.display_label}</span>
                      {isSelected && (
                        <svg className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {q.page_title && (
                        <span className="text-xs text-gray-400">{q.page_title}</span>
                      )}
                      {q.question_type && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {q.question_type}
                        </span>
                      )}
                      {alreadyUsed && (
                        <span className="text-xs text-orange-500">already used</span>
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Multi-select dropdown for questions that allow multiple answers
 */
const MultiSelectDropdown = ({ question, value, onChange, disabled }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  // Parse current selected values (comma-separated string to array)
  const selectedValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];

  // Filter options based on search
  const options = question.options || [];
  const filtered = search.trim()
    ? options.filter(opt =>
        opt.label?.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  // Check if all filtered options are selected
  const allFilteredSelected = filtered.length > 0 && 
    filtered.every(opt => selectedValues.includes(opt.value || opt.label));

  // Close on outside click
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

  const toggleOption = (optionValue) => {
    const optValue = optionValue || '';
    let newValues;
    
    if (selectedValues.includes(optValue)) {
      newValues = selectedValues.filter(v => v !== optValue);
    } else {
      newValues = [...selectedValues, optValue];
    }
    
    onChange(newValues.join(', '));
  };

  const handleSelectAll = () => {
    // Select all filtered options
    const filteredValues = filtered.map(opt => opt.value || opt.label);
    const newValues = [...new Set([...selectedValues, ...filteredValues])];
    onChange(newValues.join(', '));
  };

  const handleDeselectAll = () => {
    // Deselect all filtered options
    const filteredValues = filtered.map(opt => opt.value || opt.label);
    const newValues = selectedValues.filter(v => !filteredValues.includes(v));
    onChange(newValues.join(', '));
  };

  const handleClearAll = (e) => {
    e.stopPropagation();
    onChange('');
    setSearch('');
  };

  const handleOpen = () => {
    if (disabled) return;
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <div
        onClick={handleOpen}
        className={`w-full p-2 border rounded flex items-center justify-between cursor-pointer min-h-[42px]
          ${open ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 hover:border-blue-400'}
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-100' : 'bg-white'}`}
      >
        <div className="flex-1 flex flex-wrap gap-1">
          {selectedValues.length === 0 ? (
            <span className="text-gray-400 text-sm">-- Select options --</span>
          ) : (
            selectedValues.map((val, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm"
              >
                {val}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleOption(val);
                    }}
                    className="hover:text-blue-600"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))
          )}
        </div>
        <div className="flex items-center space-x-1 ml-2">
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className="text-gray-400 hover:text-red-500 transition-colors p-0.5 rounded"
              title="Clear all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z" />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search options..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="flex items-center justify-between mt-1.5">
              <p className="text-xs text-gray-400 px-0.5">
                {selectedValues.length} selected · {filtered.length} of {options.length} options
              </p>
              {filtered.length > 0 && (
                <button
                  type="button"
                  onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
                  className="text-xs font-medium text-blue-600 hover:text-blue-700 px-2 py-0.5 rounded hover:bg-blue-50 transition-colors"
                >
                  {allFilteredSelected ? 'Deselect All' : 'Select All'}
                </button>
              )}
            </div>
          </div>

          {/* Options list */}
          <ul className="max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="p-3 text-sm text-gray-500 text-center italic">
                No options match &quot;{search}&quot;
              </li>
            ) : (
              filtered.map((opt, idx) => {
                const optValue = opt.value || opt.label;
                const isSelected = selectedValues.includes(optValue);

                return (
                  <li
                    key={idx}
                    onClick={() => toggleOption(optValue)}
                    className={`px-3 py-2 text-sm cursor-pointer transition-colors flex items-center gap-2
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    `}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Handled by li onClick
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className={isSelected ? 'font-medium text-blue-900' : 'text-gray-700'}>
                      {opt.label}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const EmailTriggerForm = ({ onSuccess, onCancel }) => {
  const router = useRouter();
  const { id: triggerId, mode } = router.query;
  const isEditMode = mode === 'edit' && triggerId;
  const isViewMode = mode === 'view' && triggerId;

  // Form state
  const [formData, setFormData] = useState({
    type: 'internal',
    trigger_questions: [],
    trigger_conditions: null,
    recipient: '',
    subject: '',
    enabled: true,
    email_template_id: null
  });

  // UI state
  const [templates, setTemplates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [bookingStatuses, setBookingStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [triggerData, setTriggerData] = useState(null);

  // Fetch templates and questions on mount
  useEffect(() => {
    fetchTemplatesAndQuestions();
  }, []);

  // Fetch trigger data when in edit OR view mode
  useEffect(() => {
    if ((isEditMode || isViewMode) && triggerId) {
      fetchTriggerData(triggerId);
    }
  }, [triggerId, mode]);

  // Populate form when both trigger data and questions are loaded
  useEffect(() => {
    if (triggerData && questions.length > 0) {
      populateFormFromTrigger(triggerData);
    }
  }, [triggerData, questions]);

  const fetchTemplatesAndQuestions = async () => {
    try {
      setLoading(true);
      
      const templatesResponse = await fetch('/api/email-templates');
      if (!templatesResponse.ok) throw new Error('Failed to fetch templates');
      const templatesResult = await templatesResponse.json();
      const templatesData = templatesResult.success ? templatesResult.data : templatesResult;
      const activeTemplates = templatesData.filter(t => t.is_active);
      setTemplates(activeTemplates);

      const questionsResponse = await fetch('/api/booking-templates/questions?include_options=true');
      if (!questionsResponse.ok) throw new Error('Failed to fetch questions');
      const questionsResult = await questionsResponse.json();
      setQuestions(questionsResult.questions || []);

      const statusResponse = await fetch('/api/settings/booking-statuses');
      const statusData = await statusResponse.json();
      const parsedStatuses = statusData.map(s => {
        try { return JSON.parse(s.value); } catch { return null; }
      }).filter(Boolean);
      setBookingStatuses(parsedStatuses);

      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load templates or questions');
      setLoading(false);
    }
  };

  const fetchTriggerData = async (id) => {
    try {
      const response = await fetch(`/api/email-triggers/${id}`);
      if (!response.ok) throw new Error('Failed to fetch trigger data');
      const result = await response.json();
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

  const populateFormFromTrigger = (trigger) => {
    let convertedQuestions = [];

    if (trigger.triggerQuestions && trigger.triggerQuestions.length > 0) {
      convertedQuestions = trigger.triggerQuestions.map(tq => ({
        question_text: tq.question?.question || '',
        question_id: tq.question_id,
        question_key: tq.question?.question_key || '',
        answer: tq.answer || ''
      }));
    } else {
      let legacyQuestions = trigger.trigger_questions || [];
      if (typeof legacyQuestions === 'string') {
        try { legacyQuestions = JSON.parse(legacyQuestions); } catch { legacyQuestions = []; }
      }

      convertedQuestions = legacyQuestions.map(tq => {
        let matchingQuestion = null;
        if (tq.question_key) {
          matchingQuestion = questions.find(q => q.question_key === tq.question_key);
        }
        if (!matchingQuestion && tq.question) {
          matchingQuestion = questions.find(q =>
            q.question.toLowerCase().trim() === tq.question.toLowerCase().trim()
          );
        }
        return {
          question_text: tq.question,
          question_id: matchingQuestion ? matchingQuestion.id : null,
          question_key: tq.question_key,
          answer: Array.isArray(tq.answer) ? tq.answer.join(', ') : (tq.answer || '')
        };
      });
    }

    setFormData({
      type: trigger.type || 'internal',
      trigger_questions: convertedQuestions,
      trigger_conditions: trigger.trigger_conditions || null,
      recipient: trigger.recipient || '',
      subject: trigger.template?.subject || '',
      enabled: trigger.enabled !== undefined ? trigger.enabled : true,
      email_template_id: trigger.email_template_id || null
    });
  };

  const getQuestionById = (questionId) => {
    return questions.find(q => q.id === parseInt(questionId));
  };

  const isQuestionSelected = (questionId) => {
    return formData.trigger_questions.some(tq => tq.question_id === parseInt(questionId));
  };

  const addTriggerQuestion = () => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: [
        ...prev.trigger_questions,
        { question_id: null, question_text: '', answer: '', question_key: null }
      ]
    }));
  };

  const removeTriggerQuestion = (index) => {
    setFormData(prev => ({
      ...prev,
      trigger_questions: prev.trigger_questions.filter((_, i) => i !== index)
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
          answer: ''
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return { ...prev, trigger_questions: updated };
    });
  };

  const isMultiSelectQuestion = (question) => {
    if (!question) return false;
    
    const questionType = question.question_type || question.type;
    
    // Explicit multi-select types
    if (['checkbox', 'service-cards', 'multi-select'].includes(questionType)) {
      return true;
    }
    
    // Check if it's a service selection question (even if incorrectly marked as select/radio)
    if (question.question_key?.includes('service') || 
        question.display_label?.toLowerCase().includes('service')) {
      return true;
    }
    
    return false;
  };

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
    const isMultiSelect = isMultiSelectQuestion(question);

    // Handle multi-select questions with dropdown
    if (isMultiSelect) {
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

    // Handle single-select questions
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email_template_id) {
      toast.error('Please select an email template');
      return;
    }

    if (formData.trigger_questions.length === 0 && !formData.trigger_conditions?.booking_status?.length) {
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

    if (formData.type === 'internal' || formData.type === 'highlights') {
      if (!formData.recipient || !formData.recipient.trim()) {
        toast.error('Please add at least one recipient email');
        return;
      }
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

      const requestBody = {
        recipient: formData.recipient.trim(),
        email_template_id: formData.email_template_id,
        type: formData.type,
        enabled: formData.enabled,
        trigger_questions,
        trigger_conditions: formData.trigger_conditions || null,
      };

      if (isEditMode) requestBody.id = parseInt(triggerId);

      const endpoint = isEditMode ? '/api/email-triggers/update' : '/api/email-triggers/create';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();

      if (!response.ok) {
        if (result.errors && Array.isArray(result.errors)) {
          throw new Error(result.errors.join(', '));
        }
        throw new Error(result.message || 'Failed to save trigger');
      }

      toast.success(`Email trigger ${isEditMode ? 'updated' : 'created'} successfully`);

      // ✅ Refresh the form with the saved data
      if (result.success && result.data && isEditMode) {
        setTriggerData(result.data);
        // The useEffect will repopulate the form
      }

      if (onSuccess) onSuccess();
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
              {isViewMode ? 'Viewing Email Trigger' : isEditMode ? 'Editing Email Trigger' : 'Create New Email Trigger'}
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
            <option key={template.id} value={template.id}>{template.name}</option>
          ))}
        </select>
        {selectedTemplate && (
          <p className="text-xs text-gray-600 mt-1">Subject: {selectedTemplate.subject}</p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          Select which email template will be sent when this trigger fires
        </p>
      </div>

      {/* Trigger Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Trigger Type *</label>
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

      {/* Recipient Email */}
      {(formData.type === 'internal' || formData.type === 'highlights') && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Recipient Email(s) *</label>
          <input
            type="text"
            value={formData.recipient}
            onChange={(e) => setFormData(prev => ({ ...prev, recipient: e.target.value }))}
            placeholder="email@example.com or email1@example.com, email2@example.com"
            className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
            required
          />
          <p className="text-xs text-gray-500 mt-1">Enter one or more email addresses (comma-separated)</p>
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
          <label className="block text-sm font-medium text-gray-700">Trigger Questions *</label>
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
                    <span className="text-sm font-medium text-gray-700">Trigger #{index + 1}</span>
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

                  {/* Question Selection — searchable dropdown */}
                  <div className="mb-3">
                    <label className="block text-sm text-gray-600 mb-1">Select Question</label>
                    <QuestionSearchDropdown
                      questions={questions}
                      value={tq.question_id}
                      onChange={(questionId) => updateTriggerQuestion(index, 'question_id', questionId)}
                      isQuestionSelected={isQuestionSelected}
                      currentQuestionId={tq.question_id}
                      disabled={isViewMode}
                    />

                    {/* Unmatched legacy question warning */}
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

                  {/* Question type badge */}
                  {selectedQuestion && (
                    <div className="mb-3 flex items-center space-x-2">
                      <span className={`inline-block px-2 py-1 text-xs font-medium rounded ${
                        isMultiSelectQuestion(selectedQuestion) 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        Type: {isMultiSelectQuestion(selectedQuestion) ? 'Multi-Select' : (selectedQuestion.question_type || selectedQuestion.type)}
                      </span>
                      <span className="text-xs text-gray-500">{selectedQuestion.page_title}</span>
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

      {/* Booking Status Conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="block text-sm font-medium text-gray-700">
            Booking Status Conditions{' '}
            <span className="text-xs text-gray-500">(optional — trigger only fires for these statuses)</span>
          </label>
        </div>
        <div className="border rounded p-3 bg-gray-50">
          <p className="text-xs text-gray-500 mb-2">If none selected, trigger fires for all booking statuses</p>
          <div className="flex flex-wrap gap-2">
            {bookingStatuses.map(status => {
              const selected = (formData.trigger_conditions?.booking_status || []).includes(status.name);
              return (
                <button
                  key={status.name}
                  type="button"
                  onClick={() => {
                    const current = formData.trigger_conditions?.booking_status || [];
                    const updated = selected
                      ? current.filter(s => s !== status.name)
                      : [...current, status.name];
                    setFormData(prev => ({
                      ...prev,
                      trigger_conditions: updated.length > 0
                        ? { ...prev.trigger_conditions, booking_status: updated }
                        : null
                    }));
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
                    ${selected
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                    }`}
                >
                  {status.label}
                </button>
              );
            })}
          </div>
        </div>
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
          {isViewMode ? 'Close' : 'Cancel'}
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={saving || isViewMode}
        >
          {saving ? 'Saving...' : isEditMode ? 'Update Trigger' : 'Create Trigger'}
        </button>
      </div>
    </form>
  );
};

export default EmailTriggerForm;