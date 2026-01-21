/**
 * Calculate total care hours from booking care data
 * @param {Array|Object} careData - Array of care schedule objects OR full object with careData/defaultValues
 * @returns {Object} Care analysis with total hours and breakdown
 */
export function calculateCareHours(careData) {
  // console.log('📊 calculateCareHours received:', {
  //   isArray: Array.isArray(careData),
  //   isObject: typeof careData === 'object' && !Array.isArray(careData),
  //   hasDefaultValues: careData?.defaultValues !== undefined,
  //   hasCareVaries: careData?.careVaries !== undefined
  // });
  
  let dataToProcess = careData;
  let defaultValues = null;
  let careVaries = true;
  
  // Handle nested structure from CareTable: { careData: [...], defaultValues: {...}, careVaries: false }
  if (careData && typeof careData === 'object' && !Array.isArray(careData)) {
    if (careData.careData !== undefined) {
      dataToProcess = careData.careData;
      defaultValues = careData.defaultValues || null;
      careVaries = careData.careVaries !== false; // Default to true if not specified
      
      console.log('📊 Extracted from nested structure:', {
        careDataLength: Array.isArray(dataToProcess) ? dataToProcess.length : 0,
        hasDefaultValues: !!defaultValues,
        careVaries: careVaries,
        defaultValuesPeriods: defaultValues ? Object.keys(defaultValues) : []
      });
    }
  }
  
  // If no data to process, return early
  if (!dataToProcess || !Array.isArray(dataToProcess) || dataToProcess.length === 0) {
    console.log('📊 No care data entries to process');
    return {
      totalHoursPerDay: 0,
      dailyBreakdown: {},
      carePattern: 'no-care',
      recommendedPackages: ['WS'],
      analysis: 'No care requirements specified'
    };
  }

  // Group care by date to calculate daily totals
  const dailyCare = {};
  
  dataToProcess.forEach(entry => {
    const { date, values, care } = entry;
    
    if (!dailyCare[date]) {
      dailyCare[date] = {
        morning: 0,
        afternoon: 0,
        evening: 0,
        total: 0
      };
    }
    
    // ========== THE KEY FIX ==========
    // Determine the duration to use:
    // 1. If careVaries is false AND entry.values.duration is empty,
    //    use the duration from defaultValues for this period
    // 2. Otherwise use entry.values.duration
    let durationToUse = values?.duration;
    
    if (!careVaries && defaultValues && (!durationToUse || durationToUse === '')) {
      // Look up duration from defaultValues for this care period (morning/afternoon/evening)
      const defaultForPeriod = defaultValues[care];
      if (defaultForPeriod?.duration) {
        durationToUse = defaultForPeriod.duration;
        console.log(`📊 Using default duration for ${care}: ${durationToUse}`);
      }
    }
    // ========== END KEY FIX ==========
    
    // Convert duration to hours
    const hours = parseDurationToHours(durationToUse);
    dailyCare[date][care] = hours;
    dailyCare[date].total += hours;
  });

  // Calculate average daily care hours
  const dates = Object.keys(dailyCare);
  const totalHoursPerDay = dates.length > 0 
    ? dates.reduce((sum, date) => sum + dailyCare[date].total, 0) / dates.length
    : 0;

  // console.log('📊 Care hours calculated:', {
  //   totalHoursPerDay,
  //   datesProcessed: dates.length,
  //   usedDefaults: !careVaries && !!defaultValues,
  //   sampleDayTotal: dates.length > 0 ? dailyCare[dates[0]].total : 0
  // });

  // Analyze care pattern
  const carePattern = determineCarePattern(totalHoursPerDay, dailyCare);
  
  // Get recommended packages based on care hours
  const recommendedPackages = getRecommendedPackages(totalHoursPerDay, carePattern);

  return {
    totalHoursPerDay: Math.round(totalHoursPerDay * 100) / 100,
    dailyBreakdown: dailyCare,
    carePattern,
    recommendedPackages,
    analysis: generateCareAnalysis(totalHoursPerDay, carePattern, dates.length),
    sampleDay: dates.length > 0 ? dailyCare[dates[0]] : null,
    usedDefaults: !careVaries && !!defaultValues  // Flag to indicate defaults were used
  };
}

/**
 * Parse duration string to hours
 * @param {string} duration - Duration like "15 minutes", "3.5 hours", "1.5 hours"
 * @returns {number} Hours as decimal
 */
function parseDurationToHours(duration) {
  if (!duration || typeof duration !== 'string') return 0;
  
  const durationLower = duration.toLowerCase().trim();
  
  // Handle minutes
  if (durationLower.includes('minute')) {
    const minutes = parseFloat(durationLower.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
    return minutes / 60;
  }
  
  // Handle hours (including "1.5 hours")
  if (durationLower.includes('hour')) {
    return parseFloat(durationLower.match(/(\d+(?:\.\d+)?)/)?.[1] || 0);
  }
  
  // Try to parse as number (assume hours)
  const numericValue = parseFloat(durationLower);
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Determine care pattern based on hours and distribution
 * @param {number} totalHours - Total daily care hours
 * @param {Object} dailyCare - Daily care breakdown
 * @returns {string} Care pattern identifier
 */
function determineCarePattern(totalHours, dailyCare) {
  if (totalHours === 0) return 'no-care';
  if (totalHours <= 2) return 'minimal-care';
  if (totalHours <= 6) return 'moderate-care';
  if (totalHours <= 12) return 'high-care';
  return 'intensive-care';
}

/**
 * Get recommended packages based on care requirements
 * @param {number} totalHours - Total daily care hours
 * @param {string} carePattern - Care pattern identifier
 * @returns {Array} Array of recommended package codes
 */
function getRecommendedPackages(totalHours, carePattern) {
  const recommendations = [];
  
  // Non-NDIS packages
  if (totalHours === 0) {
    recommendations.push('WS'); // Wellness & Support - No care
  } else if (totalHours <= 6) {
    recommendations.push('WHS', 'WHSP'); // Wellness & High Support - 6 or less hours
  } else {
    recommendations.push('WVHS', 'WVHSP'); // Wellness & Very High Support - More than 6 hours
  }
  
  // NDIS packages
  if (totalHours === 0) {
    recommendations.push('NDIS_SP', 'HOLIDAY_SUPPORT'); // NDIS Support Package - No care
  } else if (totalHours <= 6) {
    recommendations.push('NDIS_CSP'); // NDIS Care Support Package - 6 hours or less
  } else {
    recommendations.push('HCSP'); // High Care Support Package - More than 6 hours
  }
  
  return recommendations;
}

/**
 * Generate human-readable care analysis
 * @param {number} totalHours - Total daily care hours
 * @param {string} carePattern - Care pattern identifier
 * @param {number} daysCount - Number of days in the schedule
 * @returns {string} Analysis text
 */
function generateCareAnalysis(totalHours, carePattern, daysCount) {
  const patterns = {
    'no-care': 'No care assistance required',
    'minimal-care': 'Minimal care assistance needed (up to 2 hours daily)',
    'moderate-care': 'Moderate care assistance required (2-6 hours daily)',
    'high-care': 'High level care assistance needed (6-12 hours daily)',
    'intensive-care': 'Intensive care assistance required (12+ hours daily)'
  };
  
  const baseAnalysis = patterns[carePattern] || 'Care requirements analysis unavailable';
  const scheduleInfo = daysCount > 0 ? ` over ${daysCount} day${daysCount > 1 ? 's' : ''}` : '';
  
  return `${baseAnalysis}${scheduleInfo}. Average ${totalHours} hours per day.`;
}

/**
 * Create filter criteria object for dynamic package filtering
 * @param {Array} careData - Care schedule data
 * @returns {Object} Filter criteria for package filtering API
 */
export function createPackageFilterCriteria(careData) {
  const analysis = calculateCareHours(careData);
  
  return {
    care_hours: Math.ceil(analysis.totalHoursPerDay), // Round up for safety
    care_pattern: analysis.carePattern,
    recommended_packages: analysis.recommendedPackages,
    filter_explanation: analysis.analysis
  };
}

/**
 * Format care schedule for display
 * @param {Array} careData - Care schedule data
 * @returns {Object} Formatted schedule for UI display
 */
export function formatCareScheduleForDisplay(careData) {
  const analysis = calculateCareHours(careData);
  
  if (!analysis.sampleDay) {
    return {
      summary: 'No care schedule specified',
      dailyTotal: 0,
      breakdown: []
    };
  }
  
  const breakdown = [
    {
      period: 'Morning',
      hours: analysis.sampleDay.morning,
      description: analysis.sampleDay.morning > 0 ? `${analysis.sampleDay.morning} hours care` : 'No care'
    },
    {
      period: 'Afternoon', 
      hours: analysis.sampleDay.afternoon,
      description: analysis.sampleDay.afternoon > 0 ? `${analysis.sampleDay.afternoon} hours care` : 'No care'
    },
    {
      period: 'Evening',
      hours: analysis.sampleDay.evening, 
      description: analysis.sampleDay.evening > 0 ? `${analysis.sampleDay.evening} hours care` : 'No care'
    }
  ];
  
  return {
    summary: `${analysis.totalHoursPerDay} hours daily care (${analysis.carePattern})`,
    dailyTotal: analysis.totalHoursPerDay,
    breakdown,
    recommendedPackages: analysis.recommendedPackages,
    analysis: analysis.analysis
  };
}