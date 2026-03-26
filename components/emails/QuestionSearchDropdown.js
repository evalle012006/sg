import React, { useState, useEffect, useRef } from 'react';

/**
 * Searchable dropdown for selecting a booking template question.
 *
 * Props:
 *   questions          – full list of question objects
 *   value              – currently selected question id (int or null)
 *   onChange           – (questionId: int|null) => void
 *   isQuestionSelected – (questionId: int) => bool  — used to grey out already-used questions
 *   currentQuestionId  – the question id of the row this dropdown belongs to (exempts itself from "already used")
 *   disabled           – bool
 */
const QuestionSearchDropdown = ({
  questions,
  value,
  onChange,
  isQuestionSelected,
  currentQuestionId,
  disabled,
}) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedQuestion = questions.find(q => q.id === parseInt(value));

  const filtered = search.trim()
    ? questions.filter(
        q =>
          q.display_label?.toLowerCase().includes(search.toLowerCase()) ||
          q.question?.toLowerCase().includes(search.toLowerCase()) ||
          q.page_title?.toLowerCase().includes(search.toLowerCase())
      )
    : questions;

  useEffect(() => {
    const handler = e => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = question => {
    onChange(question.id);
    setSearch('');
    setOpen(false);
  };

  const handleClear = e => {
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
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          <div className="p-2 border-b border-gray-100 bg-gray-50">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 111 11a6 6 0 0116 0z"
                />
              </svg>
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search questions..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={e => e.stopPropagation()}
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
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {q.page_title && <span className="text-xs text-gray-400">{q.page_title}</span>}
                      {q.question_type && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                          {q.question_type}
                        </span>
                      )}
                      {alreadyUsed && <span className="text-xs text-orange-500">already used</span>}
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

export default QuestionSearchDropdown;