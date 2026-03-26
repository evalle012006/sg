import React, { useState, useEffect, useRef } from 'react';

/**
 * Multi-select dropdown for questions that allow multiple answers.
 *
 * Props:
 *   question  – question object (must have .options: [{ label, value? }])
 *   value     – comma-separated string of selected values
 *   onChange  – (commaSeparatedString: string) => void
 *   disabled  – bool
 */
const MultiSelectDropdown = ({ question, value, onChange, disabled }) => {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedValues = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];
  const options = question.options || [];
  const filtered = search.trim()
    ? options.filter(opt => opt.label?.toLowerCase().includes(search.toLowerCase()))
    : options;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(opt => selectedValues.includes(opt.value || opt.label));

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

  const toggleOption = optionValue => {
    const optValue = optionValue || '';
    const newValues = selectedValues.includes(optValue)
      ? selectedValues.filter(v => v !== optValue)
      : [...selectedValues, optValue];
    onChange(newValues.join(', '));
  };

  const handleSelectAll = () => {
    const filteredValues = filtered.map(opt => opt.value || opt.label);
    onChange([...new Set([...selectedValues, ...filteredValues])].join(', '));
  };

  const handleDeselectAll = () => {
    const filteredValues = filtered.map(opt => opt.value || opt.label);
    onChange(selectedValues.filter(v => !filteredValues.includes(v)).join(', '));
  };

  const handleClearAll = e => {
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
                    onClick={e => { e.stopPropagation(); toggleOption(val); }}
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
                placeholder="Search options..."
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={e => e.stopPropagation()}
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
                      ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
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

export default MultiSelectDropdown;