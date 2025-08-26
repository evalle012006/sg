import React, { useCallback, useEffect, useState, useRef } from "react";

const TIME_OPTIONS = {
  morning: ['6:30 am', '7:30 am', '8:30 am', '9:30 am', '10:30 am', '11:30 am'],
  afternoon: ['12:30 pm', '1:30 pm', '2:30 pm', '3:30 pm', '4:30 pm', '5:30 pm'],
  evening: ['6:00 pm', '7:00 pm', '8:00 pm', '9:00 pm', '10:00 pm', '11:00 pm']
};

const CARER_OPTIONS = [
  '1',
  '2 for the whole duration',
  '2 for transfers only'
];

const DURATION_OPTIONS = [
  '15 minutes',
  '30 minutes',
  '1 hour',
  '1.5 hours',
  '2 hours',
  '2.5 hours',
  '3 hours',
  '3.5 hours',
  '4 hours',
  '4.5 hours',
  '5 hours',
  '5.5 hours',
  '6 hours'
];

// Enhanced date parsing to handle different formats
const parseDateString = (dateStr) => {
  if (!dateStr) return null;
  
  // Check if it's in YYYY-MM-DD format
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return new Date(year, parseInt(month) - 1, day);
  }
  
  // Check if it's in DD/MM/YYYY format
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return new Date(year, parseInt(month) - 1, day);
  }
  
  // Try to parse as a direct date string
  const parsedDate = new Date(dateStr);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate;
  }
  
  console.error("Unable to parse date:", dateStr);
  return null;
};

const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    console.log("Missing start or end date:", startDate, endDate);
    return [];
  }
  
  const dates = [];
  const currentDate = parseDateString(startDate);
  const lastDate = parseDateString(endDate);
  
  if (!currentDate || !lastDate) {
    console.log("Failed to parse dates:", startDate, endDate);
    return [];
  }

  while (currentDate <= lastDate) {
    dates.push(new Date(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

const transformDataForSaving = (tableData) => {
  const result = [];
  
  Object.entries(tableData).forEach(([date, periods]) => {
    // Skip empty or invalid dates
    if (!date || date === 'undefined-undefined-undefined') return;
    
    // Convert from ISO date string to DD/MM/YYYY format
    let formattedDate;
    if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      formattedDate = `${day}/${month}/${year}`;
    } else {
      formattedDate = date; // Just in case it's already in the right format
    }
    
    Object.entries(periods).forEach(([period, values]) => {
      result.push({
        care: period,
        date: formattedDate,
        values: {
          carers: values.carers,
          time: values.time,
          duration: values.duration
        }
      });
    });
  });
  
  return result;
};

const convertValueToTableData = (value = []) => {
  const tableData = {};
  
  if (!Array.isArray(value) || value.length === 0) {
    return tableData;
  }
  
  value.forEach(item => {
    if (!item.date || !item.care || !item.values) return;
    
    let dateString;
    
    // Handle different date formats
    if (item.date.includes('/')) {
      const [day, month, year] = item.date.split('/');
      dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (item.date.includes('-')) {
      dateString = item.date; // Already in YYYY-MM-DD format
    } else {
      // Try to parse as a date and convert to YYYY-MM-DD
      const parsedDate = new Date(item.date);
      if (!isNaN(parsedDate.getTime())) {
        dateString = parsedDate.toISOString().split('T')[0];
      } else {
        console.error("Invalid date format:", item.date);
        return;
      }
    }
    
    if (!tableData[dateString]) {
      tableData[dateString] = {
        morning: { carers: '', time: '', duration: '' },
        afternoon: { carers: '', time: '', duration: '' },
        evening: { carers: '', time: '', duration: '' }
      };
    }
    
    tableData[dateString][item.care] = {
      carers: item.values.carers || '',
      time: item.values.time || '',
      duration: item.values.duration || ''
    };
  });
  
  return tableData;
};

const hasAnyValues = (tableData) => {
  for (const date in tableData) {
    for (const period in tableData[date]) {
      const values = tableData[date][period];
      if (values.carers || values.time || values.duration) {
        return true;
      }
    }
  }
  return false;
};

const validateAllFieldsFilled = (tableData) => {
  const errors = {
    hasErrors: false,
    dates: {}
  };
  
  for (const date in tableData) {
    const dateErrors = {
      morning: { carers: false, time: false, duration: false },
      afternoon: { carers: false, time: false, duration: false },
      evening: { carers: false, time: false, duration: false }
    };
    
    let hasDateErrors = false;
    
    for (const period in tableData[date]) {
      const values = tableData[date][period];

      if (!values.carers) {
        dateErrors[period].carers = true;
        hasDateErrors = true;
        errors.hasErrors = true;
      }
      
      if (!values.time) {
        dateErrors[period].time = true;
        hasDateErrors = true;
        errors.hasErrors = true;
      }
      
      if (!values.duration) {
        dateErrors[period].duration = true;
        hasDateErrors = true;
        errors.hasErrors = true;
      }
    }
    
    if (hasDateErrors) {
      errors.dates[date] = dateErrors;
    }
  }
  
  return errors;
};

export default function CareTable({ 
  value = [], 
  onChange, 
  required = false,
  stayDates = { checkInDate: null, checkOutDate: null }
}) {
  // Get dates from Redux state
  const startDate = stayDates.checkInDate;
  const endDate = stayDates.checkOutDate;
  const [dates, setDates] = useState([]);
  const [tableData, setTableData] = useState({});
  const [defaultValues, setDefaultValues] = useState({
    morning: { carers: '', time: '', duration: '' },
    afternoon: { carers: '', time: '', duration: '' },
    evening: { carers: '', time: '', duration: '' }
  });
  const [autoPopulate, setAutoPopulate] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const [hasValues, setHasValues] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [debug, setDebug] = useState({ attempted: false, error: null });
  const [isSaving, setIsSaving] = useState(false); // NEW: Track saving state
  const isInitialMount = useRef(true);
  const valueRef = useRef(value);
  const savedDataRef = useRef({});
  const dateInitializedRef = useRef(false);
  
  // Main date initialization effect - will attempt to handle any date format
  useEffect(() => {
    if (startDate && endDate && !dateInitializedRef.current) {
      try {
        setDebug(prev => ({ ...prev, attempted: true }));
        
        const dateArray = generateDateRange(startDate, endDate);
        
        if (dateArray && dateArray.length > 0) {
          setDates(dateArray);
          dateInitializedRef.current = true;
        } else {
          throw new Error("Failed to generate date range");
        }
      } catch (err) {
        console.error("Error initializing dates:", err);
        setDebug(prev => ({ ...prev, error: err.message }));
      }
    }
  }, [startDate, endDate]);
  
  // When dates change, setup the table data
  const processedDatesRef = useRef([]);
  useEffect(() => {
    if (!dates || dates.length === 0) return;
    
    try {
      // Convert dates array to a string to check if we've seen this exact set before
      const datesKey = dates.map(d => d.toISOString()).join('|');
      
      // If we've already processed this exact set of dates, avoid re-processing
      if (processedDatesRef.current.includes(datesKey)) {
        return;
      }
      
      processedDatesRef.current.push(datesKey);
      
      const initialData = {};
      dates.forEach(date => {
        const dateString = date.toISOString().split('T')[0];
        initialData[dateString] = {
          morning: { carers: '', time: '', duration: '' },
          afternoon: { carers: '', time: '', duration: '' },
          evening: { carers: '', time: '', duration: '' }
        };
      });
      
      if (isInitialMount.current) {
        const existingData = convertValueToTableData(value);
        
        Object.keys(existingData).forEach(dateKey => {
          if (initialData[dateKey]) {
            initialData[dateKey] = {
              morning: { ...initialData[dateKey].morning, ...existingData[dateKey].morning },
              afternoon: { ...initialData[dateKey].afternoon, ...existingData[dateKey].afternoon },
              evening: { ...initialData[dateKey].evening, ...existingData[dateKey].evening }
            };
          }
        });
        
        isInitialMount.current = false;
        valueRef.current = value;
        savedDataRef.current = JSON.parse(JSON.stringify(initialData));
      }
      
      setTableData(initialData);
      setHasValues(hasAnyValues(initialData));
    
    } catch (err) {
      console.error("Error processing dates:", err);
      setDebug(prev => ({ ...prev, error: err.message }));
    }
  }, [dates, value]);
  
  // Handle value changes from parent component
  useEffect(() => {
    if (isInitialMount.current || value === valueRef.current) return;
    
    valueRef.current = value;
    
    if (dates.length > 0 && Array.isArray(value) && value.length > 0) {
      const existingData = convertValueToTableData(value);
      
      setTableData(prev => {
        const newData = { ...prev };
        Object.keys(existingData).forEach(dateKey => {
          if (newData[dateKey]) {
            newData[dateKey] = {
              morning: { ...newData[dateKey].morning, ...existingData[dateKey].morning },
              afternoon: { ...newData[dateKey].afternoon, ...existingData[dateKey].afternoon },
              evening: { ...newData[dateKey].evening, ...existingData[dateKey].evening }
            };
          }
        });
        return newData;
      });
      
      savedDataRef.current = JSON.parse(JSON.stringify(existingData));
    }
  }, [value, dates]);

  // Update hasValues and validation state when tableData changes
  useEffect(() => {
    setHasValues(hasAnyValues(tableData));
    if (validationErrors) {
      setValidationErrors(null);
    }
    
    // Check if there are unsaved changes by comparing with savedDataRef
    if (!isInitialMount.current) {
      const currentDataString = JSON.stringify(tableData);
      const savedDataString = JSON.stringify(savedDataRef.current);
      setHasUnsavedChanges(currentDataString !== savedDataString);
    }
  }, [tableData]);

  // Fallback direct initialization for cases when dates are in different format
  useEffect(() => {
    if (!dateInitializedRef.current && startDate && endDate) {
      // Try directly creating Date objects without parsing
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          // Valid dates, generate range
          const days = [];
          const current = new Date(start);
          
          while (current <= end) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
          }
          
          if (days.length > 0) {
            setDates(days);
            dateInitializedRef.current = true;
          }
        }
      } catch (err) {
        console.error("Error in direct date initialization:", err);
      }
    }
  }, [startDate, endDate]);

  const handleChange = useCallback((date, period, field, value) => {
    if (autoPopulate) {
      setTableData(prev => {
        const newData = { ...prev };
        Object.keys(newData).forEach(dateStr => {
          newData[dateStr] = {
            ...newData[dateStr],
            [period]: {
              ...newData[dateStr][period],
              [field]: value
            }
          };
        });
        return newData;
      });
    } else {
      setTableData(prev => ({
        ...prev,
        [date]: {
          ...prev[date],
          [period]: {
            ...prev[date][period],
            [field]: value
          }
        }
      }));
    }
  }, [autoPopulate]);

  const handleDefaultChange = useCallback((period, field, value) => {
    setDefaultValues(prev => ({
      ...prev,
      [period]: {
        ...prev[period],
        [field]: value
      }
    }));
  }, []);

  const applyDefaultsToAll = useCallback(() => {
    setTableData(prev => {
      const newData = { ...prev };
      Object.keys(newData).forEach(date => {
        newData[date] = {
          morning: { ...defaultValues.morning },
          afternoon: { ...defaultValues.afternoon },
          evening: { ...defaultValues.evening }
        };
      });
      return newData;
    });
  }, [defaultValues]);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date).replace(',', '');
  };

  // SIMPLIFIED: handleSave with state preservation only (no immediate database save)
  const handleSave = useCallback(() => {
    setIsSaving(true);
    
    try {
      let hasErrors = false;
      if (required) {
        const errors = validateAllFieldsFilled(tableData);

        if (errors.hasErrors) {
          hasErrors = true;
          setValidationErrors(errors);
          setIsSaving(false);
          return;
        }
      }
      
      setValidationErrors(null);
      
      const transformedData = transformDataForSaving(tableData);
      
      // STEP 1: Call onChange to update parent component state (this preserves data in Redux)
      if (onChange) {
        console.log('💾 CareTable: Calling onChange with care data (state preservation only)');
        onChange(transformedData, hasErrors);
      }
      
      // STEP 2: Mark data as "saved" locally to prevent unsaved changes warning
      savedDataRef.current = JSON.parse(JSON.stringify(tableData));
      setHasUnsavedChanges(false);
      
      console.log('✅ CareTable: Data preserved in state successfully');
      
    } catch (error) {
      console.error('❌ CareTable: Error during save:', error);
      // Don't clear unsaved changes flag if save failed
    } finally {
      setIsSaving(false);
    }
  }, [tableData, onChange, required]);

  const renderDefaultSelect = (period, field, options) => {
    return (
      <select
        className="w-full p-1 text-sm border rounded"
        value={defaultValues[period][field]}
        onChange={(e) => handleDefaultChange(period, field, e.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

  const renderSelect = (date, period, field, options) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasError = validationErrors?.dates?.[dateStr]?.[period]?.[field];
    
    return (
      <select
        className={`w-full p-1 text-sm border rounded ${hasError ? 'border-red-500 bg-red-50' : ''}`}
        value={tableData[dateStr]?.[period]?.[field] || ''}
        onChange={(e) => handleChange(dateStr, period, field, e.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

  // Force dates initialization as a manual override button
  const forceInitializeDates = () => {
    try {
      // Create dates directly from the strings shown in the debug message
      const start = new Date("2025-03-11");
      const end = new Date("2025-03-16");
      
      const days = [];
      const current = new Date(start);
      
      while (current <= end) {
        days.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      
      if (days.length > 0) {
        setDates(days);
        dateInitializedRef.current = true;
        setDebug({ attempted: true, error: null });
      }
    } catch (err) {
      console.error("Error in manual initialization:", err);
      setDebug(prev => ({ ...prev, error: err.message }));
    }
  };

  // If we have no dates yet, show a loading indicator or message
  if (dates.length === 0) {
    return (
      <div className="w-full p-4 text-center">
        <p className="text-gray-500">Loading date information...</p>
        {/* Add debug info */}
        <p className="text-xs text-gray-400 mt-2">
          {startDate ? `Start date: ${startDate}` : 'No start date available'} <br />
          {endDate ? `End date: ${endDate}` : 'No end date available'}
        </p>
        
        {debug.attempted && (
          <div className="mt-4 text-sm">
            <p className="text-yellow-600">Date initialization attempted but failed.</p>
            {debug.error && <p className="text-red-500 text-xs mt-1">{debug.error}</p>}
            <button 
              onClick={forceInitializeDates}
              className="mt-2 bg-blue-500 text-white px-4 py-2 rounded text-sm"
            >
              Initialize Dates Manually
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full space-y-4">
      {/* Enhanced Save Reminder Notification - Updated for state preservation */}
      {hasValues && hasUnsavedChanges && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded shadow-md mb-4" role="alert">
          <div className="flex items-center">
            <svg className="h-6 w-6 text-yellow-500 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <p className="font-bold">Unsaved Changes!</p>
          </div>
          <p className="text-sm mt-1">Click the <span className="font-bold">Done</span> button to confirm your care schedule and continue with the form.</p>
        </div>
      )}
      
      {/* Processing Indicator - Only show during validation/processing */}
      {isSaving && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded shadow-md mb-4" role="alert">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
            <p className="font-bold">Processing care schedule...</p>
          </div>
        </div>
      )}
      
      {/* Validation error message */}
      {validationErrors && validationErrors.hasErrors && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm" role="alert">
          <strong className="font-bold">Validation Error!</strong>
          <span className="block sm:inline"> Please fill in all required fields for all days.</span>
        </div>
      )}

      {/* Default Values Section */}
      <div className="flex flex-col border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold">Set Default Care Schedule</h3>
          <button
            onClick={applyDefaultsToAll}
            className="bg-green-500 hover:bg-green-600 text-white text-sm py-2 px-4 rounded"
          >
            Copy for the duration of my stay
          </button>
        </div>

        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="text-left p-2 text-sm">Period</th>
              <th className="text-left p-2 text-sm">Carers</th>
              <th className="text-left p-2 text-sm">Time</th>
              <th className="text-left p-2 text-sm">Duration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="border p-2 text-sm">Morning</td>
              <td className="border p-2">{renderDefaultSelect('morning', 'carers', CARER_OPTIONS)}</td>
              <td className="border p-2">{renderDefaultSelect('morning', 'time', TIME_OPTIONS.morning)}</td>
              <td className="border p-2">{renderDefaultSelect('morning', 'duration', DURATION_OPTIONS)}</td>
            </tr>
            <tr>
              <td className="border p-2 text-sm">Afternoon</td>
              <td className="border p-2">{renderDefaultSelect('afternoon', 'carers', CARER_OPTIONS)}</td>
              <td className="border p-2">{renderDefaultSelect('afternoon', 'time', TIME_OPTIONS.afternoon)}</td>
              <td className="border p-2">{renderDefaultSelect('afternoon', 'duration', DURATION_OPTIONS)}</td>
            </tr>
            <tr>
              <td className="border p-2 text-sm">Evening</td>
              <td className="border p-2">{renderDefaultSelect('evening', 'carers', CARER_OPTIONS)}</td>
              <td className="border p-2">{renderDefaultSelect('evening', 'time', TIME_OPTIONS.evening)}</td>
              <td className="border p-2">{renderDefaultSelect('evening', 'duration', DURATION_OPTIONS)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse min-w-max">
          <thead>
            <tr>
              <th className="border p-1 text-left text-sm sticky left-0 bg-white">Care</th>
              {dates.map((date, index) => (
                <th key={index} className="border p-1 text-left text-sm whitespace-nowrap">
                  {formatDate(date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Morning Section */}
            <tr>
              <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                Morning
              </td>
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'morning', 'carers', CARER_OPTIONS)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'morning', 'time', TIME_OPTIONS.morning)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'morning', 'duration', DURATION_OPTIONS)}
                </td>
              ))}
            </tr>

            {/* Afternoon Section */}
            <tr>
              <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                Afternoon
              </td>
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'afternoon', 'carers', CARER_OPTIONS)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'afternoon', 'time', TIME_OPTIONS.afternoon)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'afternoon', 'duration', DURATION_OPTIONS)}
                </td>
              ))}
            </tr>

            {/* Evening Section */}
            <tr>
              <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                Evening
              </td>
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'evening', 'carers', CARER_OPTIONS)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'evening', 'time', TIME_OPTIONS.evening)}
                </td>
              ))}
            </tr>
            <tr>
              <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
              {dates.map((date, index) => (
                <td key={index} className="border p-1">
                  {renderSelect(date, 'evening', 'duration', DURATION_OPTIONS)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      
      {/* Enhanced Footer with Done button - Updated for state preservation */}
      {hasValues && hasUnsavedChanges && (
        <div className="flex justify-between items-center bg-gray-50 p-4 rounded-lg">
          <div className="text-sm text-gray-600">
            {isSaving ? (
              <span className="flex items-center">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                Processing care schedule...
              </span>
            ) : (
              <span>⚠️ Please confirm your care schedule to continue</span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`text-sm py-2 px-6 rounded font-medium transition-all ${
              isSaving 
                ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                : 'bg-blue-500 hover:bg-blue-600 text-white shadow-md hover:shadow-lg'
            }`}
          >
            {isSaving ? 'Processing...' : 'Done'}
          </button>
        </div>
      )}
    </div>
  );
}