import React from 'react';

const Progress = ({ value = 0, className = '' }) => {
  return (
    <div className={`w-full h-4 bg-gray-200 rounded-full ${className}`}>
      <div
        className="h-full bg-blue-500 rounded-full transition-all duration-300"
        style={{ width: `${value}%` }}
      />
    </div>
  );
};

export default Progress;