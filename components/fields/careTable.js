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

/**
 * Format a Date object to YYYY-MM-DD string WITHOUT timezone conversion
 * This preserves the local date regardless of user's timezone
 */
const formatDateLocal = (date) => {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return null;
  }
  
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  
  return `${year}-${month}-${day}`;
};

/**
 * Create a new Date from year, month, day without timezone issues
 */
const createLocalDate = (year, month, day) => {
  return new Date(year, month - 1, day, 12, 0, 0); // Use noon to avoid DST edge cases
};

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
  
  let year, month, day;
  
  if (dateStr.includes('-')) {
    // YYYY-MM-DD format
    [year, month, day] = dateStr.split('-').map(Number);
  } else if (dateStr.includes('/')) {
    // DD/MM/YYYY format
    [day, month, year] = dateStr.split('/').map(Number);
  } else {
    console.error("Unknown date format:", dateStr);
    return null;
  }
  
  // Create date at noon local time to avoid timezone edge cases
  return new Date(year, month - 1, day, 12, 0, 0);
};

const generateDateRange = (startDate, endDate) => {
  if (!startDate || !endDate) {
    console.log("Missing start or end date:", startDate, endDate);
    return [];
  }
  
  const dates = [];
  const start = parseDateString(startDate);
  const end = parseDateString(endDate);
  
  if (!start || !end) {
    console.log("Failed to parse dates:", startDate, endDate);
    return [];
  }

  // Clone the start date
  const currentDate = new Date(start);

  while (currentDate <= end) {
    // Create a new date object for each day
    dates.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 12, 0, 0));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return dates;
};

const transformDataForSaving = (tableData, defaultValues = null, careVaries = false, dates = []) => {
  const result = {
    careData: [],
    defaultValues: defaultValues || {
      morning: { carers: '', time: '', duration: '' },
      afternoon: { carers: '', time: '', duration: '' },
      evening: { carers: '', time: '', duration: '' }
    },
    careVaries: careVaries
  };
  
  // Handle edge case: no dates provided
  if (!dates || dates.length === 0) {
    console.warn('⚠️ transformDataForSaving: No dates provided, saving all periods');
    // Fallback to old behavior if dates not available
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
        const carersToUse = !careVaries && defaultValues?.[period]?.carers 
          ? defaultValues[period].carers 
          : values.carers;
        
        if (carersToUse && carersToUse.trim() !== '' && !isNoCareRequired(carersToUse)) {
          let timeToSave = values.time;
          let durationToSave = values.duration;
          
          if (!careVaries && defaultValues?.[period]) {
            timeToSave = defaultValues[period].time || values.time;
            durationToSave = defaultValues[period].duration || values.duration;
          }
          
          result.careData.push({
            care: period,
            date: formattedDate,
            values: {
              carers: carersToUse,
              time: timeToSave,
              duration: durationToSave
            }
          });
        }
      });
    });
    return result;
  }
  
  // Determine first and last dates for filtering
  const firstDateStr = formatDateLocal(dates[0]);
  const lastDateStr = formatDateLocal(dates[dates.length - 1]);
  const isSameDayCheckInOut = dates.length === 1 && firstDateStr === lastDateStr;
  
  console.log('💾 transformDataForSaving - Check-in/out dates:', {
    firstDate: firstDateStr,
    lastDate: lastDateStr,
    totalDates: dates.length,
    isSameDayCheckInOut: isSameDayCheckInOut
  });
  
  Object.entries(tableData).forEach(([date, periods]) => {
    if (!date || date === 'undefined-undefined-undefined') return;
    
    let formattedDate;
    if (date.includes('-')) {
      const [year, month, day] = date.split('-');
      formattedDate = `${day}/${month}/${year}`;
    } else {
      formattedDate = date;
    }
    
    // Check if this is check-in or checkout date
    const isCheckInDate = date === firstDateStr;
    const isCheckOutDate = date === lastDateStr;
    
    Object.entries(periods).forEach(([period, values]) => {
      // ✅ EDGE CASE: Same-day check-in and checkout
      // Allow only afternoon care for same-day stays
      if (isSameDayCheckInOut) {
        if (period === 'morning' || period === 'evening') {
          console.log(`🚫 Same-day stay: Skipping ${period} care for ${formattedDate}`);
          return; // Only allow afternoon for same-day stays
        }
      } 
      // ✅ NORMAL CASE: Multi-day stays
      else {
        // Filter out morning care on check-in date
        if (isCheckInDate && period === 'morning') {
          console.log(`🚫 Skipping morning care for check-in date: ${formattedDate}`);
          return;
        }
        
        // Filter out evening care on checkout date
        if (isCheckOutDate && (period === 'evening' || period === 'afternoon')) {
          console.log(`🚫 Skipping afternoon and evening care for check-out date: ${formattedDate}`);
          return;
        }
      }
      
      // Determine the carers value to use
      const carersToUse = !careVaries && defaultValues?.[period]?.carers 
        ? defaultValues[period].carers 
        : values.carers;
      
      // Only include periods that require care
      if (carersToUse && carersToUse.trim() !== '' && !isNoCareRequired(carersToUse)) {
        
        let timeToSave = values.time;
        let durationToSave = values.duration;
        
        if (!careVaries && defaultValues?.[period]) {
          timeToSave = defaultValues[period].time || values.time;
          durationToSave = defaultValues[period].duration || values.duration;
        }
        
        result.careData.push({
          care: period,
          date: formattedDate,
          values: {
            carers: carersToUse,
            time: timeToSave,
            duration: durationToSave
          }
        });
      }
    });
  });
  
  console.log('💾 Saving care data structure:', {
    careDataLength: result.careData.length,
    hasDefaultValues: !!result.defaultValues,
    careVaries: result.careVaries,
    firstEntry: result.careData[0] || null,
    lastEntry: result.careData[result.careData.length - 1] || null,
    checkInDate: firstDateStr,
    checkOutDate: lastDateStr,
    isSameDayStay: isSameDayCheckInOut
  });
  
  return result;
};

const convertValueToTableData = (value = []) => {
  const tableData = {};
  let extractedDefaults = null;
  let extractedCareVaries = null;
  
  // ========== FIX: Parse JSON string if needed ==========
  let parsedValue = value;
  if (typeof value === 'string' && value.trim()) {
    try {
      parsedValue = JSON.parse(value);
      console.log('🔄 CareTable: Parsed JSON string value:', {
        hasDefaultValues: !!parsedValue?.defaultValues,
        careVaries: parsedValue?.careVaries,
        careDataLength: parsedValue?.careData?.length || 0
      });
    } catch (e) {
      console.error('❌ CareTable: Failed to parse value JSON string:', e);
      parsedValue = [];
    }
  }
  // ========== END FIX ==========
  
  let dataArray = [];
  if (parsedValue && typeof parsedValue === 'object' && !Array.isArray(parsedValue)) {
    dataArray = parsedValue.careData || [];
    extractedDefaults = parsedValue.defaultValues || null;
    extractedCareVaries = parsedValue.careVaries ?? null;
  } else if (Array.isArray(parsedValue)) {
    dataArray = parsedValue;
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
  
  const dateStr = formatDateLocal(date);
  const firstDateStr = formatDateLocal(dates[0]);
  const lastDateStr = formatDateLocal(dates[dates.length - 1]);
  
  // ✅ EDGE CASE: Same-day check-in and checkout
  const isSameDayCheckInOut = dates.length === 1 && firstDateStr === lastDateStr;
  if (isSameDayCheckInOut) {
    return ['afternoon']; // Only afternoon for same-day stays
  }
  
  // ✅ NORMAL CASES
  if (dateStr === firstDateStr) {
    return ['afternoon', 'evening']; // Check-in: no morning
  }
  
  if (dateStr === lastDateStr) {
    return ['morning']; // Checkout: no evening and afternoon
  }
  
  return ['morning', 'afternoon', 'evening']; // Middle days: all periods
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
      
      const dateObj = dates.find(d => formatDateLocal(d) === dateStr);
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

  // Generate expected dates using LOCAL date formatting (NOT toISOString!)
  const expectedDates = new Set();
  const startDate = parseDateString(currentStartDate);
  const endDate = parseDateString(currentEndDate);
  
  if (!startDate || !endDate) {
    return { hasMismatch: false, details: null };
  }
  
  const currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Use formatDateLocal instead of toISOString().split('T')[0]
    expectedDates.add(formatDateLocal(currentDate));
    currentDate.setDate(currentDate.getDate() + 1);
  }

  const hasOverlap = [...existingDates].some(date => expectedDates.has(date));
  
  if (!hasOverlap && existingDates.size > 0) {
    const existingDatesArray = [...existingDates].sort();
    const expectedDatesArray = [...expectedDates].sort();
    
    const formatDateRange = (dates) => {
      if (dates.length === 0) return '';
      if (dates.length === 1) {
        const d = parseDateString(dates[0]);
        return d ? d.toLocaleDateString('en-AU') : dates[0];
      }
      const startD = parseDateString(dates[0]);
      const endD = parseDateString(dates[dates.length - 1]);
      return `${startD?.toLocaleDateString('en-AU') || dates[0]} - ${endD?.toLocaleDateString('en-AU') || dates[dates.length - 1]}`;
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
  const parsedValue = React.useMemo(() => {
    if (typeof value === 'string' && value.trim()) {
      try {
        return JSON.parse(value);
      } catch (e) {
        console.error('❌ CareTable: Failed to parse value prop:', e);
        return [];
      }
    }
    return value;
  }, [value]);

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
  const [debug, setDebug] = useState({ attempted: false, error: null });
  
  const isInitialMount = useRef(true);
  const valueRef = useRef(value);
  const savedDataRef = useRef({});
  const dateInitializedRef = useRef(false);
  const savedDefaultsRef = useRef(null);
  const savedCareVariesRef = useRef(null);
  
  // Auto-save refs to prevent infinite loops
  const userHasInteractedRef = useRef(false);
  const lastSentDataRef = useRef(null);
  const autoSaveTimeoutRef = useRef(null);
  
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
      const datesKey = dates.map(d => formatDateLocal(d)).join('|');
      
      if (processedDatesRef.current.includes(datesKey)) {
        return;
      }
      
      processedDatesRef.current.push(datesKey);
      
      const initialData = {};
      dates.forEach(date => {
        const dateString = formatDateLocal(date);
        initialData[dateString] = {
          morning: { carers: '', time: '', duration: '' },
          afternoon: { carers: '', time: '', duration: '' },
          evening: { carers: '', time: '', duration: '' }
        };
      });
      
      if (isInitialMount.current) {
        // Use parsedValue instead of value!
        const { tableData: existingData, extractedDefaults, extractedCareVaries } = convertValueToTableData(parsedValue);
        
        // console.log('🔄 CareTable initialization:', {
        //   hasExistingData: Object.keys(existingData).length > 0,
        //   hasExtractedDefaults: !!extractedDefaults,
        //   extractedCareVaries,
        //   newDatesCount: Object.keys(initialData).length,
        //   extractedDefaults // Log the actual defaults
        // });
        
        // Always set defaults if we have them (for prefill scenarios)
        if (extractedDefaults) {
          // console.log('✅ Setting defaultValues from prefilled data:', extractedDefaults);
          setDefaultValues(extractedDefaults);
          savedDefaultsRef.current = JSON.parse(JSON.stringify(extractedDefaults));
        }
        
        // Always preserve careVaries setting from prefilled data
        if (extractedCareVaries !== null) {
          // console.log('✅ Setting careVaries from prefilled data:', extractedCareVaries);
          setCareVaries(extractedCareVaries);
          savedCareVariesRef.current = extractedCareVaries;
          if (extractedCareVaries === true) {
            setShowDetailedTable(true);
          }
        }
        
        // ========== PREFILL FIX ==========
        const hasPrefilledDefaults = extractedDefaults && hasAnyDefaultValues(extractedDefaults);
        
        if (hasPrefilledDefaults) {
          // console.log('🔄 PREFILL MODE: Applying defaultValues to all new dates');
          
          Object.keys(initialData).forEach(dateKey => {
            ['morning', 'afternoon', 'evening'].forEach(period => {
              const defaultForPeriod = extractedDefaults[period];
              if (defaultForPeriod) {
                initialData[dateKey][period] = {
                  carers: defaultForPeriod.carers || '',
                  time: defaultForPeriod.time || '',
                  duration: defaultForPeriod.duration || ''
                };
              }
            });
          });
          
          // console.log('✅ Prefilled care data for', Object.keys(initialData).length, 'dates');
        } else {
          // Legacy mode - match dates
          Object.keys(existingData).forEach(dateKey => {
            if (initialData[dateKey]) {
              initialData[dateKey] = {
                morning: { ...initialData[dateKey].morning, ...existingData[dateKey].morning },
                afternoon: { ...initialData[dateKey].afternoon, ...existingData[dateKey].afternoon },
                evening: { ...initialData[dateKey].evening, ...existingData[dateKey].evening }
              };
            }
          });
        }
        // ========== END PREFILL FIX ==========
        
        isInitialMount.current = false;
        valueRef.current = parsedValue; // Use parsedValue
        savedDataRef.current = JSON.parse(JSON.stringify(initialData));
        
        const initialTransformed = transformDataForSaving(
          initialData, 
          extractedDefaults || {
            morning: { carers: '', time: '', duration: '' },
            afternoon: { carers: '', time: '', duration: '' },
            evening: { carers: '', time: '', duration: '' }
          }, 
          extractedCareVaries,
          dates
        );
        lastSentDataRef.current = JSON.stringify(initialTransformed);
      }
      
      setTableData(initialData);
      setHasValues(hasAnyValues(initialData));
    
    } catch (err) {
      console.error("Error processing dates:", err);
      setDebug(prev => ({ ...prev, error: err.message }));
    }
  }, [dates, parsedValue]);
  
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

          // If careVaries is false, merge defaultValues into tableData
          if (extractedCareVaries === false && extractedDefaults) {
            Object.keys(newData).forEach(dateKey => {
              ['morning', 'afternoon', 'evening'].forEach(period => {
                const defaultForPeriod = extractedDefaults[period];
                if (defaultForPeriod) {
                  if (!newData[dateKey][period].time && defaultForPeriod.time) {
                    newData[dateKey][period].time = defaultForPeriod.time;
                  }
                  if (!newData[dateKey][period].duration && defaultForPeriod.duration) {
                    newData[dateKey][period].duration = defaultForPeriod.duration;
                  }
                  if (!newData[dateKey][period].carers && defaultForPeriod.carers) {
                    newData[dateKey][period].carers = defaultForPeriod.carers;
                  }
                }
              });
            });
            console.log('🔄 Merged defaultValues into tableData (careVaries=false)');
          }

          return newData;
        });
        
        savedDataRef.current = JSON.parse(JSON.stringify(existingData));
        
        // Update lastSentDataRef to match incoming data - prevents auto-saving unchanged data
        const incomingTransformed = transformDataForSaving(
          existingData,
          extractedDefaults || defaultValues,
          extractedCareVaries ?? careVaries,
          dates
        );
        lastSentDataRef.current = JSON.stringify(incomingTransformed);
      }
    }
  }, [value, dates]);

  // Detect prefilled data arriving after initial mount
  useEffect(() => {
      // Skip if this is the initial mount (handled by existing logic)
      if (isInitialMount.current) {
          return;
      }
      
      // Check if we received new prefilled data (value changed and has content)
      const newParsedValue = typeof value === 'string' && value.trim() 
          ? (() => { try { return JSON.parse(value); } catch { return value; } })()
          : value;
      
      const hasPrefilledData = newParsedValue && 
          (Array.isArray(newParsedValue.careData) ? newParsedValue.careData.length > 0 : false) &&
          newParsedValue.defaultValues &&
          hasAnyDefaultValues(newParsedValue.defaultValues);
      
      if (hasPrefilledData) {
          console.log('🔄 CareTable: Detected prefilled data after mount, marking as user-interacted');
          
          // ✅ Mark as user-interacted to enable auto-save
          userHasInteractedRef.current = true;
          
          // Extract and set the data
          const { tableData: existingData, extractedDefaults, extractedCareVaries } = 
              convertValueToTableData(newParsedValue);
          
          if (extractedDefaults) {
              console.log('✅ Setting defaultValues from prefilled data:', extractedDefaults);
              setDefaultValues(extractedDefaults);
              savedDefaultsRef.current = JSON.parse(JSON.stringify(extractedDefaults));
          }
          
          if (extractedCareVaries !== null) {
              console.log('✅ Setting careVaries from prefilled data:', extractedCareVaries);
              setCareVaries(extractedCareVaries);
              savedCareVariesRef.current = extractedCareVaries;
              if (extractedCareVaries === true) {
                  setShowDetailedTable(true);
              }
          }
          
          // Merge prefilled data into tableData
          if (Object.keys(existingData).length > 0) {
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
                  
                  // If careVaries is false, merge defaultValues into all dates
                  if (extractedCareVaries === false && extractedDefaults) {
                      Object.keys(newData).forEach(dateKey => {
                          ['morning', 'afternoon', 'evening'].forEach(period => {
                              const defaultForPeriod = extractedDefaults[period];
                              if (defaultForPeriod) {
                                  newData[dateKey][period] = {
                                      carers: defaultForPeriod.carers || newData[dateKey][period].carers,
                                      time: defaultForPeriod.time || newData[dateKey][period].time,
                                      duration: defaultForPeriod.duration || newData[dateKey][period].duration
                                  };
                              }
                          });
                      });
                      console.log('🔄 Merged defaultValues into tableData (careVaries=false) from prefilled data');
                  }
                  
                  return newData;
              });
          }
      }
  }, [value, isInitialMount.current]); // Depend on value changes after mount

  useEffect(() => {
    setHasValues(hasAnyValues(tableData));
    if (validationErrors) {
      setValidationErrors(null);
    }
  }, [tableData, defaultValues, careVaries]);

  useEffect(() => {
      // Also trigger auto-save if we have prefilled data (even without user interaction)
      const hasPrefilledData = hasAnyDefaultValues(defaultValues) || hasAnyValues(tableData);
      
      if (!userHasInteractedRef.current && !hasPrefilledData) {
          return;
      }
      
      if (!onChange) {
          return;
      }
      
      if (!hasAnyDefaultValues(defaultValues) && !hasAnyValues(tableData)) {
          return;
      }
      
      if (autoSaveTimeoutRef.current) {
          clearTimeout(autoSaveTimeoutRef.current);
      }
      
      autoSaveTimeoutRef.current = setTimeout(() => {
          const transformedData = transformDataForSaving(tableData, defaultValues, careVaries, dates);
          const transformedString = JSON.stringify(transformedData);
          
          if (transformedString === lastSentDataRef.current) {
              console.log('🔄 CareTable: Skipping auto-save - data unchanged');
              return;
          }
          
          let hasErrors = false;
          if (required && careVaries !== null) {
              const errors = validateAllFieldsFilled(tableData, dates, careVaries, defaultValues);
              hasErrors = errors.hasErrors;
              setValidationErrors(hasErrors ? errors : null);
          } else {
              setValidationErrors(null);
          }
          
          console.log('🔄 CareTable: Auto-saving changes', { 
              hasErrors,
              hasPrefilledData,
              userInteracted: userHasInteractedRef.current 
          });
          
          onChange(transformedData, hasErrors);
          lastSentDataRef.current = transformedString;
          
          savedDataRef.current = JSON.parse(JSON.stringify(tableData));
          savedDefaultsRef.current = JSON.parse(JSON.stringify(defaultValues));
          savedCareVariesRef.current = careVaries;
          
      }, 300);
      
      return () => {
          if (autoSaveTimeoutRef.current) {
              clearTimeout(autoSaveTimeoutRef.current);
          }
      };
  }, [tableData, defaultValues, careVaries, onChange, required, dates]);

  useEffect(() => {
    if (parsedValue && stayDates?.checkInDate && stayDates?.checkOutDate) {
      // Check if this is a prefill scenario (has defaultValues)
      const isPrefillMode = parsedValue?.defaultValues && hasAnyDefaultValues(parsedValue.defaultValues);
      
      if (isPrefillMode) {
        // console.log('🔄 Skipping date mismatch detection - prefill mode with defaults');
        setDateMismatch(null);
        return;
      }
      
      const mismatchResult = detectDateMismatch(parsedValue, stayDates.checkInDate, stayDates.checkOutDate);
      
      const newMismatch = mismatchResult.hasMismatch ? mismatchResult.details : null;
      
      if (JSON.stringify(newMismatch) !== JSON.stringify(dateMismatch)) {
        setDateMismatch(newMismatch);
        
        if (newMismatch && onChange && !parsedValue?.defaultValues) {
          onChange({ careData: [], defaultValues, careVaries: null }, true);
        }
      }
    }
  }, [parsedValue, stayDates?.checkInDate, stayDates?.checkOutDate, dateMismatch, onChange, defaultValues, careVaries]);

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
    // Mark that user has interacted - enables auto-save
    userHasInteractedRef.current = true;
    
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
    // Mark that user has interacted - enables auto-save
    userHasInteractedRef.current = true;
    
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
    // Mark that user has interacted - enables auto-save
    userHasInteractedRef.current = true;
    
    setCareVaries(varies);
    
    // ✅ NEW: If there's a separate careVaries question, update it too
    // This ensures validation passes for the checkbox question
    if (onChange) {
        // Force an immediate onChange call to update the parent form
        const currentData = transformDataForSaving(tableData, defaultValues, varies, dates);
        onChange(currentData, false); // false = no errors
    }
    
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
  }, [defaultValues, tableData, onChange, dates]);

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date).replace(',', '');
  };

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
    const dateStr = formatDateLocal(date);
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

      {/* Daily Care Section */}
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
    </div>
  );
}