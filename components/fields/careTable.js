import React, { useCallback, useEffect, useState, useRef } from "react";

const TIME_OPTIONS = {
  morning: ['6:30 am', '7:30 am', '8:30 am', '9:30 am', '10:30 am', '11:30 am'],
  afternoon: ['12:30 pm', '1:30 pm', '2:30 pm', '3:30 pm', '4:30 pm', '5:30 pm'],
  evening: ['6:00 pm', '7:00 pm', '8:00 pm', '9:00 pm', '10:00 pm', '11:00 pm']
};

const CARER_OPTIONS = [
  'No care required',
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

// Helper function to check if care is not required
const isNoCareRequired = (carerValue) => {
  return carerValue === 'No care required';
};

// Helper function to convert time string to minutes since midnight
const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  
  const [time, period] = timeStr.split(' ');
  const [hours, minutes] = time.split(':').map(Number);
  
  let totalMinutes = hours * 60 + (minutes || 0);
  
  if (period.toLowerCase() === 'pm' && hours !== 12) {
    totalMinutes += 12 * 60;
  } else if (period.toLowerCase() === 'am' && hours === 12) {
    totalMinutes -= 12 * 60;
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
  if (!timeStr || !durationStr) return true;
  
  const startMinutes = timeToMinutes(timeStr);
  const durationMinutes = durationToMinutes(durationStr);
  const endMinutes = startMinutes + durationMinutes;
  
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
  
  if (dateStr.includes('-')) {
    const [year, month, day] = dateStr.split('-');
    return new Date(year, parseInt(month) - 1, day);
  }
  
  if (dateStr.includes('/')) {
    const [day, month, year] = dateStr.split('/');
    return new Date(year, parseInt(month) - 1, day);
  }
  
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

const transformDataForSaving = (tableData, defaultValues = null, careVaries = false) => {
  const result = {
    careData: [],
    defaultValues: defaultValues || {
      morning: { carers: '', time: '', duration: '' },
      afternoon: { carers: '', time: '', duration: '' },
      evening: { carers: '', time: '', duration: '' }
    },
    careVaries: careVaries
  };
  
  Object.entries(tableData).forEach(([date, periods]) => {
    if (!date || date === 'undefined-undefined-undefined') return;
    
    let formattedDate;
    if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      formattedDate = `${day}/${month}/${year}`;
    } else {
      formattedDate = date;
    }
    
    Object.entries(periods).forEach(([period, values]) => {
      // Only include periods that require care
      if (values.carers && values.carers.trim() !== '' && !isNoCareRequired(values.carers)) {
        result.careData.push({
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
  
  // ✅ CRITICAL: Ensure we always return the nested structure
  console.log('💾 Saving care data structure:', {
    careDataLength: result.careData.length,
    hasDefaultValues: !!result.defaultValues,
    careVaries: result.careVaries
  });
  
  return result;
};

const convertValueToTableData = (value = []) => {
  const tableData = {};
  let extractedDefaults = null;
  let extractedCareVaries = null;
  
  let dataArray = [];
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    dataArray = value.careData || [];
    extractedDefaults = value.defaultValues || null;
    extractedCareVaries = value.careVaries ?? null;
  } else if (Array.isArray(value)) {
    dataArray = value;
  }
  
  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return { tableData, extractedDefaults, extractedCareVaries };
  }
  
  dataArray.forEach(item => {
    if (!item.date || !item.care || !item.values) return;
    
    let dateString;
    
    if (item.date.includes('/')) {
      const [day, month, year] = item.date.split('/');
      dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } else if (item.date.includes('-')) {
      dateString = item.date;
    } else {
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
  
  return { tableData, extractedDefaults, extractedCareVaries };
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

// Helper to check if default values have any care requirements
const hasAnyDefaultValues = (defaultValues) => {
  for (const period in defaultValues) {
    const values = defaultValues[period];
    if (values.carers && !isNoCareRequired(values.carers)) {
      return true;
    }
  }
  return false;
};

const getActivePeriods = (date, dates) => {
  if (!date || !dates || dates.length === 0) {
    return ['morning', 'afternoon', 'evening'];
  }
  
  const dateStr = date.toISOString().split('T')[0];
  const firstDateStr = dates[0].toISOString().split('T')[0];
  const lastDateStr = dates[dates.length - 1].toISOString().split('T')[0];
  
  if (dateStr === firstDateStr) {
    return ['afternoon', 'evening'];
  }
  
  if (dateStr === lastDateStr) {
    return ['morning'];
  }
  
  return ['morning', 'afternoon', 'evening'];
};

const validateAllFieldsFilled = (tableData, dates, careVaries, defaultValues) => {
  const errors = {
    hasErrors: false,
    dates: {},
    eveningTimeErrors: [],
    defaultErrors: {
      morning: { carers: false, time: false, duration: false },
      afternoon: { carers: false, time: false, duration: false },
      evening: { carers: false, time: false, duration: false, eveningTimeExtension: false }
    }
  };
  
  // Validate default values
  let hasDefaultErrors = false;
  for (const period in defaultValues) {
    const values = defaultValues[period];
    
    // Skip validation if "No care required" is selected
    if (values.carers && !isNoCareRequired(values.carers)) {
      if (!values.time) {
        errors.defaultErrors[period].time = true;
        hasDefaultErrors = true;
        errors.hasErrors = true;
      }
      
      if (!values.duration) {
        errors.defaultErrors[period].duration = true;
        hasDefaultErrors = true;
        errors.hasErrors = true;
      }
      
      if (period === 'evening' && values.time && values.duration) {
        if (!validateEveningTime(values.time, values.duration)) {
          errors.defaultErrors[period].eveningTimeExtension = true;
          hasDefaultErrors = true;
          errors.hasErrors = true;
        }
      }
    }
  }
  
  // If care varies, also validate the full table
  if (careVaries) {
    for (const dateStr in tableData) {
      const dateErrors = {
        morning: { carers: false, time: false, duration: false },
        afternoon: { carers: false, time: false, duration: false },
        evening: { carers: false, time: false, duration: false, eveningTimeExtension: false }
      };
      
      let hasDateErrors = false;
      
      const dateObj = dates.find(d => d.toISOString().split('T')[0] === dateStr);
      const activePeriods = dateObj ? getActivePeriods(dateObj, dates) : ['morning', 'afternoon', 'evening'];
      
      for (const period in tableData[dateStr]) {
        if (!activePeriods.includes(period)) {
          continue;
        }
        
        const values = tableData[dateStr][period];
        
        // Skip validation if "No care required" is selected
        if (values.carers && !isNoCareRequired(values.carers)) {
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
          
          if (period === 'evening' && values.time && values.duration) {
            if (!validateEveningTime(values.time, values.duration)) {
              dateErrors[period].eveningTimeExtension = true;
              hasDateErrors = true;
              errors.hasErrors = true;
              
              const endTime = formatEndTime(values.time, values.duration);
              errors.eveningTimeErrors.push({
                date: dateStr,
                startTime: values.time,
                duration: values.duration,
                endTime
              });
            }
          }
        }
      }
      
      if (hasDateErrors) {
        errors.dates[dateStr] = dateErrors;
      }
    }
  }
  
  return errors;
};

const detectDateMismatch = (existingData = [], currentStartDate, currentEndDate) => {
  if (!existingData || !currentStartDate || !currentEndDate) {
    return { hasMismatch: false, details: null };
  }

  let dataToProcess = existingData;
  
  if (typeof existingData === 'object' && !Array.isArray(existingData)) {
    dataToProcess = existingData.careData || [];
  } else if (typeof existingData === 'string' && existingData.trim().startsWith('[')) {
    try {
      dataToProcess = JSON.parse(existingData);
    } catch (e) {
      console.error("Error parsing existingData JSON string:", e);
      return { hasMismatch: false, details: null };
    }
  }

  if (!Array.isArray(dataToProcess) || dataToProcess.length === 0) {
    return { hasMismatch: false, details: null };
  }

  const existingDates = new Set();
  dataToProcess.forEach(item => {
    if (item && item.date) {
      let normalizedDate;
      if (item.date.includes('/')) {
        const [day, month, year] = item.date.split('/');
        normalizedDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      } else {
        normalizedDate = item.date;
      }
      existingDates.add(normalizedDate);
    }
  });

  const expectedDates = new Set();
  const startDate = new Date(currentStartDate);
  const endDate = new Date(currentEndDate);
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    expectedDates.add(currentDate.toISOString().split('T')[0]);
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const hasOverlap = [...existingDates].some(date => expectedDates.has(date));
  
  if (!hasOverlap && existingDates.size > 0) {
    const existingDatesArray = [...existingDates].sort();
    const expectedDatesArray = [...expectedDates].sort();
    
    const formatDateRange = (dates) => {
      if (dates.length === 0) return '';
      if (dates.length === 1) return new Date(dates[0]).toLocaleDateString();
      return `${new Date(dates[0]).toLocaleDateString()} - ${new Date(dates[dates.length - 1]).toLocaleDateString()}`;
    };

    return {
      hasMismatch: true,
      details: {
        existingDateRange: formatDateRange(existingDatesArray),
        newDateRange: formatDateRange(expectedDatesArray),
        existingDatesCount: existingDates.size,
        newDatesCount: expectedDates.size
      }
    };
  }

  return { hasMismatch: false, details: null };
};

export default function CareTable({ 
  value = [], 
  onChange, 
  required = false,
  stayDates = { checkInDate: null, checkOutDate: null }
}) {
  const startDate = stayDates.checkInDate;
  const endDate = stayDates.checkOutDate;
  const [dates, setDates] = useState([]);
  const [tableData, setTableData] = useState({});
  const [defaultValues, setDefaultValues] = useState({
    morning: { carers: '', time: '', duration: '' },
    afternoon: { carers: '', time: '', duration: '' },
    evening: { carers: '', time: '', duration: '' }
  });
  const [careVaries, setCareVaries] = useState(null); // null = not answered, false = doesn't vary, true = varies
  const [showDetailedTable, setShowDetailedTable] = useState(false);
  const [validationErrors, setValidationErrors] = useState(null);
  const [hasValues, setHasValues] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [debug, setDebug] = useState({ attempted: false, error: null });
  const [isSaving, setIsSaving] = useState(false);
  const isInitialMount = useRef(true);
  const valueRef = useRef(value);
  const savedDataRef = useRef({});
  const dateInitializedRef = useRef(false);
  const savedDefaultsRef = useRef(null);
  const savedCareVariesRef = useRef(null);
  
  const [dateMismatch, setDateMismatch] = useState(null);
  const notificationSentRef = useRef(false);
  
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
  
  const processedDatesRef = useRef([]);
  useEffect(() => {
    if (!dates || dates.length === 0) return;
    
    try {
      const datesKey = dates.map(d => d.toISOString()).join('|');
      
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
        const { tableData: existingData, extractedDefaults, extractedCareVaries } = convertValueToTableData(value);
        
        if (extractedDefaults) {
          setDefaultValues(extractedDefaults);
          savedDefaultsRef.current = JSON.parse(JSON.stringify(extractedDefaults));
        }
        
        if (extractedCareVaries !== null) {
          setCareVaries(extractedCareVaries);
          savedCareVariesRef.current = extractedCareVaries;
          if (extractedCareVaries === true) {
            setShowDetailedTable(true);
          }
        }
        
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
  
  useEffect(() => {
    if (isInitialMount.current || value === valueRef.current) return;
    
    valueRef.current = value;
    
    if (dates.length > 0 && value) {
      const { tableData: existingData, extractedDefaults, extractedCareVaries } = convertValueToTableData(value);
      
      if (extractedDefaults && JSON.stringify(extractedDefaults) !== JSON.stringify(savedDefaultsRef.current)) {
        setDefaultValues(extractedDefaults);
        savedDefaultsRef.current = JSON.parse(JSON.stringify(extractedDefaults));
      }
      
      if (extractedCareVaries !== null && extractedCareVaries !== savedCareVariesRef.current) {
        setCareVaries(extractedCareVaries);
        savedCareVariesRef.current = extractedCareVaries;
        if (extractedCareVaries === true) {
          setShowDetailedTable(true);
        }
      }
      
      if (Array.isArray(existingData.careData) ? existingData.careData.length > 0 : Object.keys(existingData).length > 0) {
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
    }
  }, [value, dates]);

  useEffect(() => {
    setHasValues(hasAnyValues(tableData));
    if (validationErrors) {
      setValidationErrors(null);
    }
    
    if (!isInitialMount.current) {
      const currentDataString = JSON.stringify(tableData);
      const savedDataString = JSON.stringify(savedDataRef.current);
      const currentDefaultsString = JSON.stringify(defaultValues);
      const savedDefaultsString = JSON.stringify(savedDefaultsRef.current);
      const currentCareVaries = careVaries;
      const savedCareVaries = savedCareVariesRef.current;
      
      setHasUnsavedChanges(
        currentDataString !== savedDataString || 
        currentDefaultsString !== savedDefaultsString ||
        currentCareVaries !== savedCareVaries
      );
    }
  }, [tableData, defaultValues, careVaries]);

  useEffect(() => {
    if (value && stayDates?.checkInDate && stayDates?.checkOutDate) {
        const mismatchResult = detectDateMismatch(value, stayDates.checkInDate, stayDates.checkOutDate);
        
        const newMismatch = mismatchResult.hasMismatch ? mismatchResult.details : null;
        
        if (JSON.stringify(newMismatch) !== JSON.stringify(dateMismatch)) {
            setDateMismatch(newMismatch);
            
            if (newMismatch && onChange) {
                onChange({ careData: [], defaultValues, careVaries: null }, true);
            }
        }
    }
  }, [value, stayDates?.checkInDate, stayDates?.checkOutDate, dateMismatch, onChange, defaultValues, careVaries]);

  useEffect(() => {
    if (value && stayDates?.checkInDate && stayDates?.checkOutDate && dateMismatch) {
        const mismatchResult = detectDateMismatch(value, stayDates.checkInDate, stayDates.checkOutDate);
        
        if (!mismatchResult.hasMismatch) {
            setDateMismatch(null);
        }
    }
  }, [value, stayDates?.checkInDate, stayDates?.checkOutDate]);

  useEffect(() => {
    if (dateMismatch && onChange && !notificationSentRef.current) {
      onChange({ careData: [], defaultValues, careVaries: null }, true);
      notificationSentRef.current = true;
    } else if (!dateMismatch && notificationSentRef.current) {
      notificationSentRef.current = false;
    }
  }, [dateMismatch, onChange, defaultValues]);

  useEffect(() => {
    if (!dateInitializedRef.current && startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
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
    setTableData(prev => {
      const newData = { ...prev };
      
      if (field === 'carers') {
        if (!value || value.trim() === '' || isNoCareRequired(value)) {
          // Clear time and duration when carers is cleared or "No care required" is selected
          newData[date] = {
            ...newData[date],
            [period]: {
              carers: value,
              time: '',
              duration: ''
            }
          };
        } else {
          // Just update carers
          newData[date] = {
            ...newData[date],
            [period]: {
              ...newData[date][period],
              carers: value
            }
          };
        }
      } else {
        // Update other fields
        newData[date] = {
          ...newData[date],
          [period]: {
            ...newData[date][period],
            [field]: value
          }
        };
        
        if (period === 'evening' && value && field !== 'carers') {
          const currentValues = newData[date][period];
          const currentTime = field === 'time' ? value : currentValues.time;
          const currentDuration = field === 'duration' ? value : currentValues.duration;
          
          if (currentTime && currentDuration) {
            if (!validateEveningTime(currentTime, currentDuration)) {
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
  }, []);

  const handleDefaultChange = useCallback((period, field, value) => {
    setDefaultValues(prev => {
      const newValues = { ...prev };
      
      newValues[period] = {
        ...newValues[period],
        [field]: value
      };
      
      // Clear time and duration if "No care required" is selected
      if (field === 'carers' && isNoCareRequired(value)) {
        newValues[period].time = '';
        newValues[period].duration = '';
      }
      
      if (period === 'evening' && value && !isNoCareRequired(newValues[period].carers)) {
        const currentTime = field === 'time' ? value : newValues[period].time;
        const currentDuration = field === 'duration' ? value : newValues[period].duration;
        
        if (currentTime && currentDuration) {
          if (!validateEveningTime(currentTime, currentDuration)) {
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

  const handleCareVariesChange = useCallback((varies) => {
    setCareVaries(varies);
    
    if (varies === true) {
      // Apply defaults to all dates in the table
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
      setShowDetailedTable(true);
    } else if (varies === false) {
      // Apply defaults to all dates but don't show the table
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
      setShowDetailedTable(false);
    }
  }, [defaultValues]);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date).replace(',', '');
  };

  const handleSave = useCallback(() => {
    setIsSaving(true);
    
    try {
      let hasErrors = false;
      if (required) {
        const errors = validateAllFieldsFilled(tableData, dates, careVaries, defaultValues);

        if (errors.hasErrors) {
          hasErrors = true;
          setValidationErrors(errors);
          setIsSaving(false);
          return;
        }
      }
      
      setValidationErrors(null);
      
      const transformedData = transformDataForSaving(tableData, defaultValues, careVaries);
      
      if (onChange) {
        console.log('💾 CareTable: Calling onChange with care data, default values, and careVaries');
        onChange(transformedData, hasErrors);
      }
      
      savedDataRef.current = JSON.parse(JSON.stringify(tableData));
      savedDefaultsRef.current = JSON.parse(JSON.stringify(defaultValues));
      savedCareVariesRef.current = careVaries;
      setHasUnsavedChanges(false);
      
      console.log('✅ CareTable: Data and defaults preserved in state successfully');
      
    } catch (error) {
      console.error('❌ CareTable: Error during save:', error);
    } finally {
      setIsSaving(false);
    }
  }, [tableData, defaultValues, careVaries, onChange, required, dates]);

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
    const currentValues = defaultValues[period];
    const hasError = validationErrors?.defaultErrors?.[period]?.[field];
    const hasEveningTimeError = validationErrors?.defaultErrors?.[period]?.eveningTimeExtension;
    
    const showError = hasError || (period === 'evening' && hasEveningTimeError && (field === 'time' || field === 'duration'));
    
    let filteredOptions = options;
    
    // Disable time and duration fields if "No care required" is selected
    const isDisabled = field !== 'carers' && isNoCareRequired(currentValues.carers);
    
    if (period === 'evening' && !isDisabled) {
      if (field === 'time') {
        filteredOptions = getFilteredTimeOptions(period, currentValues.duration, true);
      } else if (field === 'duration') {
        filteredOptions = getFilteredDurationOptions(period, currentValues.time, true);
      }
    }
    
    return (
      <select
        className={`w-full p-1 text-sm border rounded ${
          showError ? 'border-red-500 bg-red-50' : ''
        } ${isDisabled ? 'bg-gray-100 text-gray-400' : ''}`}
        value={defaultValues[period][field]}
        onChange={(e) => handleDefaultChange(period, field, e.target.value)}
        disabled={isDisabled}
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

  const renderSelect = (date, period, field, options) => {
    const dateStr = date.toISOString().split('T')[0];
    const hasError = validationErrors?.dates?.[dateStr]?.[period]?.[field];
    const hasEveningTimeError = validationErrors?.dates?.[dateStr]?.[period]?.eveningTimeExtension;
    
    const showError = hasError || (period === 'evening' && hasEveningTimeError && (field === 'time' || field === 'duration'));
    
    const currentValues = tableData[dateStr]?.[period];
    const showEveningPreview = period === 'evening' && currentValues?.time && currentValues?.duration;
    const endTime = showEveningPreview ? formatEndTime(currentValues.time, currentValues.duration) : '';
    const isValidEveningTime = showEveningPreview ? validateEveningTime(currentValues.time, currentValues.duration) : true;
    
    // Disable time and duration fields if "No care required" is selected
    const isDisabled = field !== 'carers' && isNoCareRequired(currentValues?.carers);
    
    let filteredOptions = options;
    if (period === 'evening' && !isDisabled) {
      if (field === 'time') {
        filteredOptions = getFilteredTimeOptions(period, currentValues?.duration);
      } else if (field === 'duration') {
        filteredOptions = getFilteredDurationOptions(period, currentValues?.time);
      }
    }
    
    return (
      <div className="relative">
        <select
          className={`w-full p-1 text-sm border rounded ${
            showError ? 'border-red-500 bg-red-50' : ''
          } ${isDisabled ? 'bg-gray-100 text-gray-400' : ''}`}
          value={tableData[dateStr]?.[period]?.[field] || ''}
          onChange={(e) => handleChange(dateStr, period, field, e.target.value)}
          disabled={isDisabled}
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
        
        {period === 'evening' && field === 'duration' && showEveningPreview && (
          <div className={`text-xs mt-1 px-1 ${isValidEveningTime ? 'text-green-600' : 'text-red-600'}`}>
            Ends: {endTime} {!isValidEveningTime && '⚠️'}
          </div>
        )}
      </div>
    );
  };

  const forceInitializeDates = () => {
    try {
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

  if (dates.length === 0) {
    return (
      <div className="w-full p-4 text-center">
        <p className="text-gray-500">Loading date information...</p>
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
      {hasUnsavedChanges && (
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

      {dateMismatch && (
        <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded shadow-md mb-4" role="alert">
          <div className="flex items-start">
            <svg className="h-6 w-6 text-amber-500 mr-3 mt-0.5 flex-shrink-0" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              <p className="font-bold text-amber-800">Stay Dates Have Changed</p>
              <p className="text-sm mt-1 text-amber-700">
                Your care schedule was previously set for <span className="font-semibold">{dateMismatch.existingDateRange}</span>, 
                but your current stay is <span className="font-semibold">{dateMismatch.newDateRange}</span>.
              </p>
              <p className="text-sm mt-2 text-amber-700">
                <strong>Please set up your care schedule for your new dates below.</strong>
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isSaving && (
        <div className="bg-blue-100 border-l-4 border-blue-500 text-blue-700 p-4 rounded shadow-md mb-4" role="alert">
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500 mr-2"></div>
            <p className="font-bold">Processing care schedule...</p>
          </div>
        </div>
      )}
      
      {validationErrors && validationErrors.hasErrors && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative text-sm space-y-2" role="alert">
          <div>
            <strong className="font-bold">Validation Errors:</strong>
          </div>
          
          <div>
            <span className="block sm:inline">Please complete the Time and Duration for periods where you&apos;ve selected Carers (excluding &quot;No care required&quot;).</span>
          </div>
          
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

      {/* Daily Care Section (formerly "Set Default Care Schedule") */}
      <div className="flex flex-col border rounded-lg p-4 bg-gray-50">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Daily Care</h3>
        </div>
        <div className="mb-3 text-xs text-gray-600 bg-blue-50 p-2 rounded">
          <strong>Note:</strong> Check-in day includes afternoon & evening care only. Check-out day includes morning care only.
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

      {/* Question: Does your care vary from day to day? */}
      {hasAnyDefaultValues(defaultValues) && (
        <div className="flex flex-col border rounded-lg p-4 bg-white">
          <h3 className="text-base font-semibold mb-3">Does your care vary from day to day?</h3>
          <div className="flex gap-4">
            <button
              onClick={() => handleCareVariesChange(false)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                careVaries === false
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              No, my care is the same every day
            </button>
            <button
              onClick={() => handleCareVariesChange(true)}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                careVaries === true
                  ? 'bg-blue-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Yes, my care varies
            </button>
          </div>
        </div>
      )}

      {/* Detailed Daily Care Table - Only shown if care varies */}
      {showDetailedTable && careVaries === true && (
        <div className="space-y-3">
          <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
            <p className="text-sm text-blue-800">
              <strong>Please edit the care schedule for your stay.</strong> The table below has been pre-filled with your daily care information. You can adjust any day as needed.
            </p>
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
                <tr>
                  <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                    Morning <span className="text-xs font-normal text-gray-500">(Not on check-in day)</span>
                  </td>
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('morning') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('morning') ? (
                          renderSelect(date, 'morning', 'carers', CARER_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('morning') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('morning') ? (
                          renderSelect(date, 'morning', 'time', TIME_OPTIONS.morning)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('morning') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('morning') ? (
                          renderSelect(date, 'morning', 'duration', DURATION_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                    Afternoon <span className="text-xs font-normal text-gray-500">(Not on check-out day)</span>
                  </td>
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('afternoon') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('afternoon') ? (
                          renderSelect(date, 'afternoon', 'carers', CARER_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('afternoon') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('afternoon') ? (
                          renderSelect(date, 'afternoon', 'time', TIME_OPTIONS.afternoon)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('afternoon') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('afternoon') ? (
                          renderSelect(date, 'afternoon', 'duration', DURATION_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>

                <tr>
                  <td colSpan={dates.length + 1} className="border p-1 text-sm font-semibold bg-gray-50 sticky left-0">
                    <div className="flex items-center justify-between">
                      <span>Evening <span className="text-xs font-normal text-gray-500">(Not on check-out day)</span></span>
                      <span className="text-xs font-normal text-gray-600 italic">
                        ⏰ Options filtered to end by 12:00 AM
                      </span>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Carers</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('evening') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('evening') ? (
                          renderSelect(date, 'evening', 'carers', CARER_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Time</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('evening') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('evening') ? (
                          renderSelect(date, 'evening', 'time', TIME_OPTIONS.evening)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
                <tr>
                  <td className="border p-1 text-sm sticky left-0 bg-white">Duration</td>
                  {dates.map((date, index) => {
                    const activePeriods = getActivePeriods(date, dates);
                    return (
                      <td key={index} className={`border p-1 ${!activePeriods.includes('evening') ? 'bg-gray-100' : ''}`}>
                        {activePeriods.includes('evening') ? (
                          renderSelect(date, 'evening', 'duration', DURATION_OPTIONS)
                        ) : (
                          <div className="text-center text-xs text-gray-400">N/A</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
      
      {/* Save Button */}
      {(hasAnyDefaultValues(defaultValues) || hasValues) && hasUnsavedChanges && (
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