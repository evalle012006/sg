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

// Helper function to convert time string to minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let totalMinutes = hours * 60 + (minutes || 0);
  
  if (period.toLowerCase() === 'pm' && hours !== 12) {
    totalMinutes += 12 * 60; // Add 12 hours for PM (except 12 PM)
  } else if (period.toLowerCase() === 'am' && hours === 12) {
    totalMinutes -= 12 * 60; // Subtract 12 hours for 12 AM (midnight)
  }
  
  return totalMinutes;
};

// Helper function to convert duration string to minutes
const durationToMinutes = (durationStr) => {
  if (!durationStr) return 0;
  
  const parts = durationStr.split(' ');
  const value = parseFloat(parts[0]);
  
  if (durationStr.includes('hour')) {
    return value * 60;
  } else if (durationStr.includes('minute')) {
    return value;
  }
  
  return 0;
};

// Helper function to check if evening period extends beyond midnight
const validateEveningTime = (timeStr, durationStr) => {
  if (!timeStr || !durationStr) return true; // If either is empty, don't validate
  
  const startMinutes = timeToMinutes(timeStr);
  const durationMinutes = durationToMinutes(durationStr);
  const endMinutes = startMinutes + durationMinutes;
  
  // Midnight is 24 * 60 = 1440 minutes
  const midnightMinutes = 24 * 60;
  
  return endMinutes <= midnightMinutes;
};

// Helper function to format end time for display
const formatEndTime = (timeStr, durationStr) => {
  if (!timeStr || !durationStr) return '';
  
  const startMinutes = timeToMinutes(timeStr);
  const durationMinutes = durationToMinutes(durationStr);
  const endMinutes = startMinutes + durationMinutes;
  
  const endHours = Math.floor(endMinutes / 60);
  const endMins = endMinutes % 60;
  
  if (endHours >= 24) {
    const nextDayHours = endHours - 24;
    const period = nextDayHours === 0 ? '12:00 am' : nextDayHours < 12 ? `${nextDayHours}:${endMins.toString().padStart(2, '0')} am` : `${nextDayHours - 12}:${endMins.toString().padStart(2, '0')} pm`;
    return `${period} (+1 day)`;
  } else if (endHours === 0) {
    return `12:${endMins.toString().padStart(2, '0')} am`;
  } else if (endHours < 12) {
    return `${endHours}:${endMins.toString().padStart(2, '0')} am`;
  } else if (endHours === 12) {
    return `12:${endMins.toString().padStart(2, '0')} pm`;
  } else {
    return `${endHours - 12}:${endMins.toString().padStart(2, '0')} pm`;
  }
};

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
      // Only include periods that have carers selected (non-empty care periods)
      if (values.carers && values.carers.trim() !== '') {
        result.push({
          care: period,
          date: formattedDate,
          values: {
            carers: values.carers,
            time: values.time,
            duration: values.duration
          }
        });
      }
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

// UPDATED: Enhanced validation logic with evening time validation
const validateAllFieldsFilled = (tableData) => {
  const errors = {
    hasErrors: false,
    dates: {},
    eveningTimeErrors: [] // Store specific evening time extension errors for detailed messaging
  };
  
  for (const date in tableData) {
    const dateErrors = {
      morning: { carers: false, time: false, duration: false },
      afternoon: { carers: false, time: false, duration: false },
      evening: { carers: false, time: false, duration: false, eveningTimeExtension: false }
    };
    
    let hasDateErrors = false;
    
    for (const period in tableData[date]) {
      const values = tableData[date][period];
      
      // Only validate if carers is selected (non-empty care period)
      if (values.carers && values.carers.trim() !== '') {
        // If carers is selected, then time and duration must also be filled
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
        
        // Additional validation for evening period - check if time + duration extends beyond midnight
        if (period === 'evening' && values.time && values.duration) {
          if (!validateEveningTime(values.time, values.duration)) {
            dateErrors[period].eveningTimeExtension = true;
            hasDateErrors = true;
            errors.hasErrors = true;
            
            // Store detailed error info for messaging
            const endTime = formatEndTime(values.time, values.duration);
            errors.eveningTimeErrors.push({
              date,
              startTime: values.time,
              duration: values.duration,
              endTime
            });
          }
        }
      }
      // If carers is empty, we don't validate time and duration (allowing empty periods)
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

  // UPDATED: Enhanced handleChange with smart clearing for evening conflicts
  const handleChange = useCallback((date, period, field, value) => {
    if (autoPopulate) {
      setTableData(prev => {
        const newData = { ...prev };
        Object.keys(newData).forEach(dateStr => {
          if (field === 'carers' && (!value || value.trim() === '')) {
            // If carers is being cleared, also clear time and duration
            newData[dateStr] = {
              ...newData[dateStr],
              [period]: {
                carers: '',
                time: '',
                duration: ''
              }
            };
          } else {
            // Update the field
            newData[dateStr] = {
              ...newData[dateStr],
              [period]: {
                ...newData[dateStr][period],
                [field]: value
              }
            };
            
            // For evening period, check if the combination would be invalid and clear conflicting field
            if (period === 'evening' && value && field !== 'carers') {
              const currentValues = newData[dateStr][period];
              const currentTime = field === 'time' ? value : currentValues.time;
              const currentDuration = field === 'duration' ? value : currentValues.duration;
              
              // If both time and duration are set, check if they're valid together
              if (currentTime && currentDuration) {
                if (!validateEveningTime(currentTime, currentDuration)) {
                  // Clear the OTHER field (not the one being set)
                  if (field === 'time') {
                    newData[dateStr][period].duration = '';
                  } else if (field === 'duration') {
                    newData[dateStr][period].time = '';
                  }
                }
              }
            }
          }
        });
        return newData;
      });
    } else {
      setTableData(prev => {
        const newData = { ...prev };
        
        if (field === 'carers' && (!value || value.trim() === '')) {
          // If carers is being cleared, also clear time and duration for this specific date/period
          newData[date] = {
            ...newData[date],
            [period]: {
              carers: '',
              time: '',
              duration: ''
            }
          };
        } else {
          // Update the field
          newData[date] = {
            ...newData[date],
            [period]: {
              ...newData[date][period],
              [field]: value
            }
          };
          
          // For evening period, check if the combination would be invalid and clear conflicting field
          if (period === 'evening' && value && field !== 'carers') {
            const currentValues = newData[date][period];
            const currentTime = field === 'time' ? value : currentValues.time;
            const currentDuration = field === 'duration' ? value : currentValues.duration;
            
            // If both time and duration are set, check if they're valid together
            if (currentTime && currentDuration) {
              if (!validateEveningTime(currentTime, currentDuration)) {
                // Clear the OTHER field (not the one being set)
                if (field === 'time') {
                  newData[date][period].duration = '';
                } else if (field === 'duration') {
                  newData[date][period].time = '';
                }
              }
            }
          }
        }
        
        return newData;
      });
    }
  }, [autoPopulate]);

  // UPDATED: Enhanced handleDefaultChange with smart clearing for evening conflicts
  const handleDefaultChange = useCallback((period, field, value) => {
    setDefaultValues(prev => {
      const newValues = { ...prev };
      
      // Update the changed field
      newValues[period] = {
        ...newValues[period],
        [field]: value
      };
      
      // For evening period, check if the combination would be invalid and clear conflicting field
      if (period === 'evening' && value) {
        const currentTime = field === 'time' ? value : newValues[period].time;
        const currentDuration = field === 'duration' ? value : newValues[period].duration;
        
        // If both time and duration are set, check if they're valid together
        if (currentTime && currentDuration) {
          if (!validateEveningTime(currentTime, currentDuration)) {
            // Clear the OTHER field (not the one being set)
            if (field === 'time') {
              newValues[period].duration = '';
            } else if (field === 'duration') {
              newValues[period].time = '';
            }
          }
        }
      }
      
      return newValues;
    });
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

  // Helper function to get filtered time options for evening period
  const getFilteredTimeOptions = (period, currentDuration, isDefault = false) => {
    if (period !== 'evening' || !currentDuration) {
      return TIME_OPTIONS[period];
    }
    
    const durationMinutes = durationToMinutes(currentDuration);
    const midnightMinutes = 24 * 60;
    
    return TIME_OPTIONS[period].filter(timeOption => {
      const timeMinutes = timeToMinutes(timeOption);
      return (timeMinutes + durationMinutes) <= midnightMinutes;
    });
  };

  // Helper function to get filtered duration options for evening period
  const getFilteredDurationOptions = (period, currentTime, isDefault = false) => {
    if (period !== 'evening' || !currentTime) {
      return DURATION_OPTIONS;
    }
    
    const timeMinutes = timeToMinutes(currentTime);
    const midnightMinutes = 24 * 60;
    const availableMinutes = midnightMinutes - timeMinutes;
    
    return DURATION_OPTIONS.filter(durationOption => {
      const durationMinutes = durationToMinutes(durationOption);
      return durationMinutes <= availableMinutes;
    });
  };

  const renderDefaultSelect = (period, field, options) => {
    // Get current values for this period to enable smart filtering
    const currentValues = defaultValues[period];
    let filteredOptions = options;
    
    // Apply smart filtering for evening period
    if (period === 'evening') {
      if (field === 'time') {
        filteredOptions = getFilteredTimeOptions(period, currentValues.duration, true);
      } else if (field === 'duration') {
        filteredOptions = getFilteredDurationOptions(period, currentValues.time, true);
      }
    }
    
    return (
      <select
        className="w-full p-1 text-sm border rounded"
        value={defaultValues[period][field]}
        onChange={(e) => handleDefaultChange(period, field, e.target.value)}
      >
        <option value="">Select</option>
        {filteredOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    );
  };

  // UPDATED: Enhanced renderSelect with smart option filtering and evening time validation
  const renderSelect = (date, period, field, options) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasError = validationErrors?.dates?.[dateStr]?.[period]?.[field];
    const hasEveningTimeError = validationErrors?.dates?.[dateStr]?.[period]?.eveningTimeExtension;
    
    // Show error styling if there's a field error OR if it's evening period and there's a time extension error
    const showError = hasError || (period === 'evening' && hasEveningTimeError && (field === 'time' || field === 'duration'));
    
    // Get current values for this cell
    const currentValues = tableData[dateStr]?.[period];
    const showEveningPreview = period === 'evening' && currentValues?.time && currentValues?.duration;
    const endTime = showEveningPreview ? formatEndTime(currentValues.time, currentValues.duration) : '';
    const isValidEveningTime = showEveningPreview ? validateEveningTime(currentValues.time, currentValues.duration) : true;
    
    // Apply smart filtering for evening period
    let filteredOptions = options;
    if (period === 'evening') {
      if (field === 'time') {
        filteredOptions = getFilteredTimeOptions(period, currentValues?.duration);
      } else if (field === 'duration') {
        filteredOptions = getFilteredDurationOptions(period, currentValues?.time);
      }
    }
    
    return (
      <div className="relative">
        <select
          className={`w-full p-1 text-sm border rounded ${showError ? 'border-red-500 bg-red-50' : ''}`}
          value={tableData[dateStr]?.[period]?.[field] || ''}
          onChange={(e) => handleChange(dateStr, period, field, e.target.value)}
          title={showError && period === 'evening' && hasEveningTimeError ? 
            `Care period extends beyond midnight. Ends at: ${endTime}` : ''}
        >
          <option value="">Select</option>
          {filteredOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        
        {/* Evening time preview and validation indicator */}
        {period === 'evening' && field === 'duration' && showEveningPreview && (
          <div className={`text-xs mt-1 px-1 ${isValidEveningTime ? 'text-green-600' : 'text-red-600'}`}>
            Ends: {endTime} {!isValidEveningTime && '⚠️'}
          </div>
        )}
      </div>
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
      
      {/* UPDATED: Enhanced validation error messages with specific evening time errors */}
      {validationErrors && validationErrors.hasErrors && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm space-y-2" role="alert">
          <div>
            <strong className="font-bold">Validation Errors:</strong>
          </div>
          
          {/* General validation errors */}
          <div>
            <span className="block sm:inline">Please complete the Time and Duration for periods where you&apos;ve selected Carers.</span>
          </div>
          
          {/* Specific evening time validation errors (should be rare now with filtering) */}
          {validationErrors.eveningTimeErrors && validationErrors.eveningTimeErrors.length > 0 && (
            <div className="border-t pt-2 mt-2">
              <strong className="font-bold text-red-800">Evening Care Conflicts:</strong>
              <ul className="list-disc list-inside mt-1 space-y-1">
                {validationErrors.eveningTimeErrors.map((error, index) => {
                  const formattedDate = new Date(error.date).toLocaleDateString('en-AU', {
                    weekday: 'short', day: 'numeric', month: 'short'
                  });
                  return (
                    <li key={index} className="text-sm">
                      <strong>{formattedDate}:</strong> Please adjust the evening care schedule - it extends past midnight.
                    </li>
                  );
                })}
              </ul>
              <p className="text-xs mt-2 text-red-600">
                💡 <em>Try selecting a different time or shorter duration. Available options are automatically filtered.</em>
              </p>
            </div>
          )}
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
              <td className="border p-2 text-sm">
                <div className="flex items-center justify-between">
                  <span>Evening</span>
                  <span className="text-xs text-gray-500 italic">ends by 12 AM</span>
                </div>
              </td>
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
                <div className="flex items-center justify-between">
                  <span>Evening</span>
                  <span className="text-xs font-normal text-gray-600 italic">
                    ⏰ Options filtered to end by 12:00 AM
                  </span>
                </div>
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