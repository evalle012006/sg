const moment = require('moment');

// NSW holidays utility function for server
async function getNSWHolidaysV2(startDate, endDate) {
  const currentYear = new Date().getFullYear();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/AU`;
  
  try {
    // Use built-in fetch (available in Node.js 18+)
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Handle both DD/MM/YYYY and YYYY-MM-DD formats
    let formattedStartDate, formattedEndDate;
    
    if (startDate.includes('/')) {
      // DD/MM/YYYY format
      const [startDay, startMonth] = startDate.split('/');
      const [endDay, endMonth] = endDate.split('/');
      formattedStartDate = `${currentYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
      formattedEndDate = `${currentYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;
    } else {
      // YYYY-MM-DD format (from date inputs)
      formattedStartDate = startDate;
      formattedEndDate = endDate;
    }

    // Filter NSW holidays within the date range
    const holidays = data.filter(holiday => 
      (holiday.counties?.includes('AU-NSW') || holiday.counties == null) &&
      holiday.date >= formattedStartDate &&
      holiday.date <= formattedEndDate
    );

    return holidays.map(holiday => ({
      name: holiday.name,
      date: holiday.date,
      information: holiday.localName || null,
      type: holiday.types || null
    }));
  } catch (error) {
    console.warn('Failed to fetch holidays, proceeding without holiday data:', error);
    return [];
  }
}

// Calculate days breakdown for course dates
const calculateCourseDaysBreakdown = async (startDate, endDate) => {
  const start = moment(startDate);
  const end = moment(endDate);
  
  if (!start.isValid() || !end.isValid()) {
    throw new Error('Invalid dates provided');
  }

  // Get holidays for the date range
  const startDateStr = start.format('DD/MM/YYYY');
  const endDateStr = end.format('DD/MM/YYYY');
  
  const holidays = await getNSWHolidaysV2(startDateStr, endDateStr);
  const holidayDates = new Set(holidays.map(h => h.date));
  
  let breakdown = {
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0,
    totalDays: 0
  };

  // Iterate through each day in the range (inclusive)
  const current = start.clone();
  while (current.isSameOrBefore(end, 'day')) {
    const dateStr = current.format('YYYY-MM-DD');
    
    // Check if it's a public holiday first
    if (holidayDates.has(dateStr)) {
      breakdown.publicHolidays++;
    } else {
      // Otherwise categorize by day of week
      const dayOfWeek = current.day(); // 0 = Sunday, 6 = Saturday
      
      if (dayOfWeek === 6) {
        breakdown.saturdays++;
      } else if (dayOfWeek === 0) {
        breakdown.sundays++;
      } else {
        breakdown.weekdays++;
      }
    }
    
    breakdown.totalDays++;
    current.add(1, 'day');
  }

  return { breakdown, holidays };
};

// Calculate course costs based on rates and dates
const calculateCourseCosts = async (startDate, endDate, courseRates, category = 'holiday') => {
  try {
    const { breakdown, holidays } = await calculateCourseDaysBreakdown(startDate, endDate);
    
    // Filter rates by category (holiday or sta)
    const relevantRates = courseRates.filter(rate => rate.category === category);
    
    // Create a map for easy lookup - use the first rate found for each day_type
    const rateMap = {};
    relevantRates.forEach(rate => {
      if (!rateMap[rate.day_type] || rate.order < rateMap[rate.day_type].order) {
        rateMap[rate.day_type] = rate;
      }
    });

    const costDetails = [];
    let totalCost = 0;

    // Calculate costs for each day type
    const dayTypes = [
      { key: 'weekdays', type: 'weekday', label: 'Weekdays' },
      { key: 'saturdays', type: 'saturday', label: 'Saturdays' },
      { key: 'sundays', type: 'sunday', label: 'Sundays' },
      { key: 'publicHolidays', type: 'public_holiday', label: 'Public Holidays' }
    ];

    dayTypes.forEach(({ key, type, label }) => {
      const dayCount = breakdown[key];
      const rate = rateMap[type];
      
      if (dayCount > 0) {
        const rateValue = rate ? parseFloat(rate.rate) : 0;
        const subtotal = dayCount * rateValue;
        
        costDetails.push({
          dayType: label,
          packageName: rate?.package_name || `${label} Rate`,
          lineItem: rate?.line_item || null,
          rate: rateValue,
          days: dayCount,
          subtotal: subtotal
        });
        
        totalCost += subtotal;
      }
    });

    return {
      breakdown,
      holidays,
      costDetails,
      totalCost,
      category,
      ratesUsed: relevantRates // Include rates used for historical reference
    };
  } catch (error) {
    console.error('Error calculating course costs:', error);
    throw error;
  }
};

// Calculate and format course pricing for saving to database
const calculateCoursePrice = async (courseData, courseRates) => {
  if (!courseData.start_date || !courseData.end_date) {
    return {
      holiday_price: null,
      sta_price: null,
      price_calculated_at: null,
      rate_snapshot: null
    };
  }

  try {
    const [holidayCosts, staCosts] = await Promise.all([
      calculateCourseCosts(courseData.start_date, courseData.end_date, courseRates, 'holiday'),
      calculateCourseCosts(courseData.start_date, courseData.end_date, courseRates, 'sta')
    ]);

    // Create rate snapshot for historical reference
    const rateSnapshot = {
      calculated_at: new Date().toISOString(),
      holiday_rates: holidayCosts.ratesUsed,
      sta_rates: staCosts.ratesUsed,
      breakdown: holidayCosts.breakdown,
      holidays: holidayCosts.holidays
    };

    return {
      holiday_price: parseFloat(holidayCosts.totalCost.toFixed(2)),
      sta_price: parseFloat(staCosts.totalCost.toFixed(2)),
      price_calculated_at: new Date(),
      rate_snapshot: rateSnapshot
    };
  } catch (error) {
    console.error('Error calculating course price:', error);
    // Return null values but don't fail the save operation
    return {
      holiday_price: null,
      sta_price: null,
      price_calculated_at: new Date(),
      rate_snapshot: {
        calculated_at: new Date().toISOString(),
        error: error.message
      }
    };
  }
};

module.exports = {
  getNSWHolidaysV2,
  calculateCourseDaysBreakdown,
  calculateCourseCosts,
  calculateCoursePrice
};