import React from 'react';

export default function ToggleButton({ status, disabled = false, title, onChange }) {
  const handleToggle = (e) => {
    e.preventDefault();
    if (!disabled && onChange) {
      onChange(!status);
    }
  };

  return (
    <label
      htmlFor="default-toggle"
      className={`inline-flex relative items-center ${
        disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
      }`}
      title={title}
      onClick={handleToggle}
    >
      <input
        type="checkbox"
        checked={status}
        id="default-toggle"
        className="sr-only peer"
        disabled={disabled}
        readOnly
      />
      <div
        className={`w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 ${
          status ? 'bg-seafoam' : ''
        }`}
      ></div>
    </label>
  );
}