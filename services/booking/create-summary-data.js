import moment from 'moment';
import { serializePackage } from '../../utilities/common';
import { QUESTION_KEYS, questionMatches, questionHasKey } from './question-helper';

export async function getNSWHolidaysV2(startDate, endDate) {
  const currentYear = new Date().getFullYear();
  const url = `https://date.nager.at/api/v3/PublicHolidays/${currentYear}/AU`;
  console.log("getNSWHolidaysV2 -> url", url, startDate, endDate)
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    const [startDay, startMonth] = startDate.split('/');
    const [endDay, endMonth] = endDate.split('/');
    
    const formattedStartDate = `${currentYear}-${startMonth.padStart(2, '0')}-${startDay.padStart(2, '0')}`;
    const formattedEndDate = `${currentYear}-${endMonth.padStart(2, '0')}-${endDay.padStart(2, '0')}`;

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
    throw new Error(`Failed to fetch holidays: ${error.message}`);
  }
}

export const calculateDaysBreakdown = async (startDateStr, numberOfNights, includeAllDays = false) => {
  // Validate inputs
  if (!startDateStr) {
    console.error('calculateDaysBreakdown: startDateStr is undefined');
    return {
      weekdays: 0,
      saturdays: 0,
      sundays: 0,
      publicHolidays: 0
    };
  }
  
  if (!numberOfNights || numberOfNights <= 0) {
    console.error('calculateDaysBreakdown: numberOfNights is invalid', numberOfNights);
    return {
      weekdays: 0,
      saturdays: 0,
      sundays: 0,
      publicHolidays: 0
    };
  }

  const startDate = startDateStr.split(' - ')[0].split('/').reverse().join('-');
  const dates = startDateStr.split(' - ');
  const holidays = await getNSWHolidaysV2(dates[0], dates[1]);
  
  let breakdown = {
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: holidays.length || 0
  };

  const daysToCount = includeAllDays ? numberOfNights + 1 : numberOfNights;

  for (let i = 0; i < daysToCount; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);
    
    const day = currentDate.getDay();
    if (day === 6) {
      breakdown.saturdays++;
    } else if (day === 0) {
      breakdown.sundays++;
    } else {
      breakdown.weekdays++;
    }
  }

  return breakdown;
};

// Helper to extract care analysis from Q&A pairs
const extractCareAnalysisData = (qaPairs) => {
  const careQuestion = qaPairs.find(pair => 
    pair.Question?.question_key === 'when-do-you-require-care'
  );
  
  if (!careQuestion || !careQuestion.answer) {
    return null;
  }
  
  try {
    const careData = typeof careQuestion.answer === 'string' 
      ? JSON.parse(careQuestion.answer) 
      : careQuestion.answer;
    
    if (!careData.careData || careData.careData.length === 0) {
      return null;
    }
    
    // Calculate care hours by time period across all days
    const sampleDay = { morning: 0, afternoon: 0, evening: 0 };
    let totalHoursPerDay = 0;
    
    // Aggregate care across all days
    const careByPeriod = {};
    careData.careData.forEach(daycare => {
      const period = (daycare.care || '').toLowerCase();
      const duration = parseFloat(daycare.values?.duration) || 0;
      
      if (!careByPeriod[period]) {
        careByPeriod[period] = duration;
      }
    });
    
    // Map to time periods
    Object.keys(careByPeriod).forEach(period => {
      const duration = careByPeriod[period];
      totalHoursPerDay += duration;
      
      if (period.includes('morning')) {
        sampleDay.morning = duration;
      } else if (period.includes('afternoon')) {
        sampleDay.afternoon = duration;
      } else if (period.includes('evening')) {
        sampleDay.evening = duration;
      }
    });
    
    console.log('📊 Extracted care analysis:', { totalHoursPerDay, sampleDay });
    
    return {
      requiresCare: true,
      totalHoursPerDay,
      sampleDay
    };
  } catch (error) {
    console.error('Error parsing care data:', error);
    return null;
  }
};

// Helper to extract course analysis from Q&A pairs
const extractCourseAnalysisData = (qaPairs) => {
  const courseQuestion = qaPairs.find(pair => 
    pair.Question?.question_key === 'have-you-been-offered-a-place-in-a-course-for-this-stay'
  );
  
  if (!courseQuestion) {
    return { hasCourse: false };
  }
  
  const hasCourse = courseQuestion.answer?.toLowerCase() === 'yes';
  
  console.log('🎓 Extracted course analysis:', { hasCourse });
  
  return {
    hasCourse,
    courseDay: 1 // Typically second day of stay
  };
};

const getCareHoursForTime = (careTime, careAnalysisData) => {
  if (!careAnalysisData?.sampleDay) return 0;
  
  const sampleDay = careAnalysisData.sampleDay;
  
  // If care_time is empty, return TOTAL care hours per day (all time periods)
  if (!careTime || careTime === '') {
    const totalHours = (sampleDay.morning || 0) + 
                       (sampleDay.afternoon || 0) + 
                       (sampleDay.evening || 0);
    return totalHours;
  }
  
  // Otherwise, return hours for specific time period
  switch (careTime.toLowerCase()) {
    case 'morning':
      return sampleDay.morning || 0;
    case 'afternoon':
      return sampleDay.afternoon || 0;
    case 'evening':
      return sampleDay.evening || 0;
    default:
      return 0;
  }
};

const getDaysForRateType = (rateType, daysBreakdown) => {
  if (!rateType || rateType === '') {
    return daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
  }
  
  switch (rateType) {
    case 'weekday':
      return daysBreakdown.weekdays;
    case 'saturday':
      return daysBreakdown.saturdays;
    case 'sunday':
      return daysBreakdown.sundays;
    case 'public_holiday':
    case 'publicHoliday':
      return daysBreakdown.publicHolidays;
    default:
      return 0;
  }
};

const calculateCareQuantity = (lineItem, careAnalysisData, daysBreakdown) => {
  const { rate_type, care_time } = lineItem;
  
  const careHoursPerDay = getCareHoursForTime(care_time, careAnalysisData);
  
  if (careHoursPerDay === 0) return 0;
  
  // Check if rate_type is specified
  if (!rate_type || rate_type === '') {
    // No rate_type specified = care applies to ALL days
    const totalDays = daysBreakdown.weekdays + daysBreakdown.saturdays + 
                     daysBreakdown.sundays + daysBreakdown.publicHolidays;
    return careHoursPerDay * totalDays;
  }
  
  // Rate-specific care
  const daysForType = getDaysForRateType(rate_type, daysBreakdown);
  
  if (daysForType === 0) return 0;
  
  return careHoursPerDay * daysForType;
};

const calculateApiQuantity = (lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown) => {
  const { line_item_type, rate_type, rate_category } = lineItem;
  
  switch (line_item_type) {
    case 'room':
      // Room line items use accommodation nights
      return daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
      
    case 'course':
      if (!courseAnalysisData?.hasCourse) return 0;
      return 6; // Standard course hours
      
    case 'care':
      if (!careAnalysisData?.requiresCare) return 0;
      return calculateCareQuantity(lineItem, careAnalysisData, careDaysBreakdown);
      
    default:
      if (rate_category === 'day') {
        const dayQty = getDaysForRateType(rate_type, daysBreakdown);
        return dayQty;
      } else if (rate_category === 'hour') {
        const daysForType = getDaysForRateType(rate_type, daysBreakdown);
        const hourQty = daysForType * 12;
        return hourQty;
      }
      return 0;
  }
};

const processApiPackageData = (packageData, daysBreakdown, careDaysBreakdown, nights, careAnalysisData, courseAnalysisData) => {
  console.log('🔍 processApiPackageData called with:', {
    lineItemsCount: packageData.ndis_line_items.length,
    daysBreakdown,
    careDaysBreakdown,
    careAnalysisData,
    courseAnalysisData
  });

  const processedRows = packageData.ndis_line_items
    .filter(lineItem => {
      // Filter out course line items when there's no course
      if (lineItem.line_item_type === 'course' && (!courseAnalysisData || !courseAnalysisData.hasCourse)) {
        console.log(`🎓 Filtering out course line item (no course in booking): "${lineItem.sta_package}"`);
        return false;
      }
      
      return true;
    })
    .map(lineItem => {
      const quantity = calculateApiQuantity(lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown);
      const rate = parseFloat(lineItem.price_per_night || 0);
      const total = rate * quantity;

      const rateCategoryLabel = lineItem.rate_category === 'hour' ? '/hour' : lineItem.rate_category === 'day' ? '/day' : '/night';
      const rateCategoryQtyLabel = lineItem.rate_category === 'hour' ? 'hrs' : lineItem.rate_category === 'day' ? 'days' : 'nights';

      const row = {
        // Template expects these specific property names
        package: lineItem.sta_package || lineItem.description || 'Package Item',
        lineItem: lineItem.line_item || lineItem.line_item_code || 'N/A',
        price: rate,
        nights: quantity, // Template uses "nights" for quantity
        subtotal: total, // Template uses "subtotal" for total
        
        // Keep these for internal use
        description: lineItem.sta_package || lineItem.description || 'Package Item',
        rate: rate,
        quantity: quantity,
        total: total,
        rateCategory: lineItem.rate_category || 'day',
        rateCategoryLabel: rateCategoryLabel,
        rateCategoryQtyLabel: rateCategoryQtyLabel,
        lineItemType: lineItem.line_item_type || '',
        rateType: lineItem.rate_type || 'BLANK'
      };

      console.log(`📊 Processed line item:`, {
        package: row.package,
        lineItem: row.lineItem,
        quantity,
        rate,
        total,
        lineItemType: lineItem.line_item_type,
        rateType: lineItem.rate_type,
        rateCategory: lineItem.rate_category
      });

      return row;
    });

  console.log(`📊 Processed ${processedRows.length} rows before filtering`);

  const filteredRows = processedRows.filter(row => row.quantity > 0);

  console.log(`✅ After filtering (quantity > 0): ${filteredRows.length} rows`);
  console.log('📊 Filtered rows:', filteredRows.map(r => ({
    package: r.package,
    quantity: r.nights,
    price: r.price,
    subtotal: r.subtotal
  })));

  const totalCost = filteredRows.reduce((sum, row) => sum + row.total, 0);
  
  console.log(`💰 Total cost: $${totalCost.toFixed(2)}`);
  
  return {
    details: filteredRows,
    totalCost: totalCost
  };
};

const getPricing = (option, packageData = null) => {
  if (packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0) {
    console.log('Using package line items for pricing:', packageData.ndis_line_items);
    return []; // API data will be processed separately
  }

  console.log('Using hardcoded pricing for option:', option);
  switch (option) {
    case 'SP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:2 Weekday", lineItem: "01_054_0115_1_1", price: 950.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Saturday", lineItem: "01_055_0115_1_1", price: 1100.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Sunday", lineItem: "01_056_0115_1_1", price: 1250.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday", lineItem: "01_057_0115_1_1", price: 1500.00, type: 'publicHoliday' }
      ];
    case 'CSP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:2 Weekday", lineItem: "01_054_0115_1_1", price: 1100.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Saturday", lineItem: "01_055_0115_1_1", price: 1400.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Sunday", lineItem: "01_056_0115_1_1", price: 1750.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday", lineItem: "01_057_0115_1_1", price: 2000.00, type: 'publicHoliday' }
      ];
    case 'HCSP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:1 Weekday", lineItem: "01_058_0115_1_1", price: 1740.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Saturday", lineItem: "01_059_0115_1_1", price: 1850.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Sunday", lineItem: "01_060_0115_1_1", price: 2000.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Public Holiday", lineItem: "01_061_0115_1_1", price: 2250.00, type: 'publicHoliday' }
      ];
    default:
      return [];
  }
};

const calculatePackageCosts = async (packageType, datesOfStay, nights, packageCost, packageData = null, careAnalysisData = null, courseAnalysisData = null) => {
  if (!datesOfStay) {
    console.error('calculatePackageCosts: datesOfStay is undefined');
    return {
      details: [],
      totalCost: 0
    };
  }
  
  if (!nights || nights <= 0) {
    console.error('calculatePackageCosts: nights is invalid', nights);
    return {
      details: [],
      totalCost: 0
    };
  }

  if (packageType.startsWith('W')) {
    const price = parseFloat(packageCost);
    return {
      totalCost: price * nights
    }
  }

  const breakdown = await calculateDaysBreakdown(datesOfStay, nights, false);
  const careDaysBreakdown = await calculateDaysBreakdown(datesOfStay, nights, true);
  
  console.log('📅 Breakdown calculated:', { breakdown, careDaysBreakdown });

  // Use API logic if package data has line items
  if (packageData?.ndis_line_items && packageData.ndis_line_items.length > 0) {
    console.log('📦 Using API package data with', packageData.ndis_line_items.length, 'line items');
    return processApiPackageData(packageData, breakdown, careDaysBreakdown, nights, careAnalysisData, courseAnalysisData);
  }
  
  const pricing = getPricing(packageType, packageData);
  
  const details = pricing.map((rate, index) => {
    const quantity = index === 0 ? breakdown.weekdays :
                    index === 1 ? breakdown.saturdays :
                    index === 2 ? breakdown.sundays :
                    breakdown.publicHolidays;
    
    return {
      package: rate.package,
      lineItem: rate.lineItem,
      price: rate.price,
      nights: quantity,
      subtotal: rate.price * quantity
    };
  });

  const totalCost = details.length > 0 ? details.reduce((sum, detail) => sum + detail.subtotal, 0) : 0;

  return {
    details,
    totalCost
  };
};

const calculateRoomCosts = (rooms, nights, packageData = null) => {
  const roomCosts = {
    roomUpgrade: { perNight: 0, total: 0 },
    additionalRoom: { perNight: 0, total: 0 },
    hspAccommodation: { perNight: 0, total: 0 }
  };

  if (!rooms || rooms.length === 0) {
    return roomCosts;
  }

  // Check if this is an HSP package
  const packageCode = packageData?.package_code || '';
  const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';

  if (isHSP) {
    // For HSP packages, all rooms use hsp_pricing
    const totalPerNight = rooms.reduce((sum, room) => {
      return sum + (room.hsp_pricing || room.price || 0);
    }, 0);
    
    roomCosts.hspAccommodation.perNight = totalPerNight;
    roomCosts.hspAccommodation.total = totalPerNight * nights;
  } else {
    // Standard room upgrade/additional room logic
    const nonStudioRooms = rooms.filter(room => room.type !== 'studio');
    
    if (nonStudioRooms.length > 0) {
      roomCosts.roomUpgrade.perNight = nonStudioRooms[0].price || 0;
      roomCosts.roomUpgrade.total = roomCosts.roomUpgrade.perNight * nights;
      
      if (nonStudioRooms.length > 1) {
        const additionalRoomsPerNight = nonStudioRooms
          .slice(1)
          .reduce((total, room) => total + (room.price || 0), 0);
        
        roomCosts.additionalRoom.perNight = additionalRoomsPerNight;
        roomCosts.additionalRoom.total = additionalRoomsPerNight * nights;
      }
    }
  }

  return roomCosts;
};

const getCheckInOutAnswer = (qaPairs) => {
    const checkInOutAnswers = [];
    
    qaPairs.forEach(qaPair => {
        if (questionHasKey(qaPair.Question, QUESTION_KEYS.CHECK_IN_DATE) ||
            questionMatches(qaPair, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
            checkInOutAnswers.push(qaPair.answer);
        }
    });
    
    return checkInOutAnswers;
};

export const generateSummaryData = (stayData, question, answer, questionType = null, qaPairs = [], questionKey = null) => {
  let summaryOfStayData = { ...stayData };
  
  if (answer) {
      const questionObj = { question, question_key: questionKey };
      
      if (questionHasKey(questionObj, QUESTION_KEYS.FUNDING_SOURCE) ||
          questionKey === 'how-will-your-stay-be-funded' ||
          questionMatches(questionObj, 'How will your stay be funded', QUESTION_KEYS.FUNDING_SOURCE)) {
          summaryOfStayData.funder = answer;
          if (answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia')) {
            summaryOfStayData.isNDISFunder = true;
          } else {
            summaryOfStayData.isNDISFunder = false;
            summaryOfStayData.ndisQuestions = [];
            summaryOfStayData.ndisPackage = '';
          }
      } 
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_FUNDING_OPTIONS) ||
               questionKey === 'please-select-from-one-of-the-following-ndis-funding-options' ||
               questionMatches(questionObj, 'Please select from one of the following NDIS funding options', QUESTION_KEYS.NDIS_FUNDING_OPTIONS)) {
          summaryOfStayData.ndisFundingType = answer;
      }
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) ||
               questionKey === 'ndis-ndia-participant-number' ||
               questionKey === 'icare-participant-number' ||
               questionMatches(questionObj, 'NDIS Participant Number', QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) || 
               questionMatches(questionObj, 'icare Participant Number', QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER)) {
          summaryOfStayData.participantNumber = answer;
      } 
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_OUT_DATE) ||
               questionMatches(questionObj, 'Check In Date and Check Out Date', QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
          const dates = answer.split(' - ');
          const checkIn = moment(dates[0], ['YYYY-MM-DD', 'DD/MM/YYYY']);
          const checkOut = moment(dates[1], ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
          if (checkIn.isValid() && checkOut.isValid()) {
              summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
          }
      } 
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_DATE) ||
               questionKey === 'check-in-date' ||
               questionMatches(questionObj, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
          const checkIn = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.checkinDate = checkIn.format('DD/MM/YYYY');
      } 
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_OUT_DATE) ||
               questionKey === 'check-out-date' ||
               questionMatches(questionObj, 'Check Out Date', QUESTION_KEYS.CHECK_OUT_DATE)) {
          const checkOut = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.checkoutDate = checkOut.format('DD/MM/YYYY');

          if (summaryOfStayData.checkinDate && checkOut.isValid()) {
              const checkIn = moment(summaryOfStayData.checkinDate, 'DD/MM/YYYY');
              if (checkIn.isValid()) {
                  summaryOfStayData.datesOfStay = summaryOfStayData.checkinDate + ' - ' + checkOut.format('DD/MM/YYYY');
                  summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
              }
          } else if (qaPairs && qaPairs.length > 0) {
              const checkInAnswers = getCheckInOutAnswer(qaPairs);
              if (checkInAnswers.length > 0 && checkOut.isValid()) {
                  const checkIn = moment(checkInAnswers[0], ['YYYY-MM-DD', 'DD/MM/YYYY']);
                  if (checkIn.isValid()) {
                      summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
                      summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
                  }
              }
          }
      } 
      else if (questionType !== 'package-selection' && 
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES) ||
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionMatches(questionObj, 'Accommodation package options for Sargood Courses', QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES)) && 
               answer?.includes('Wellness')) {
              summaryOfStayData.packageType = serializePackage(answer);
              summaryOfStayData.packageTypeAnswer = answer;
              if (answer.includes('Wellness & Support Package')) {
                summaryOfStayData.packageCost = 985;
              } else if (answer.includes('Wellness & High Support Package')) {
                  summaryOfStayData.packageCost = 1365;
              } else if (answer.includes('Wellness & Very High Support Package')) {
                  summaryOfStayData.packageCost = 1740;
              }
      } 
      else if (questionType !== 'package-selection' && 
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) &&
               (answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia'))) {
              summaryOfStayData.ndisPackage = answer;
              summaryOfStayData.packageType = serializePackage(answer);
      } 
      else if ((questionType === 'package-selection' || 
                questionKey?.startsWith('please-select-your-accommodation-and-assistance-package')) &&
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionKey?.includes('accommodation') && questionKey?.includes('package') ||
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL))) {
              summaryOfStayData.selectedPackageId = answer;
              summaryOfStayData.packageSelectionType = 'package-selection';
              summaryOfStayData.packageType = 'PACKAGE_SELECTION';
              summaryOfStayData.packageTypeAnswer = `Package ID: ${answer}`;
      } 
      else if (question.includes('Is Short-Term Accommodation including Respite a stated support in your plan?') ||
               question.includes('What is the purpose of this stay and how does it align with your plan goals? ') ||
               question.includes('How is this service value for money?') || 
               question == 'Please specify.' ||
               question.includes('Are you having a break from your informal support?') ||
               question.includes('Do you live alone?') ||
               question.includes('Are you travelling with any informal supports?') ||
               question.includes('Do you live in supported independent living (SIL)?') ||
               question.includes('Why do you require 1:1 support?'))
      {
          const ndisQuestions = summaryOfStayData?.ndisQuestions ? summaryOfStayData.ndisQuestions : [];
          const newQuestion = { question: question, answer: tryParseJSON(answer) };
          summaryOfStayData.ndisQuestions = [
              ...ndisQuestions.filter(q => q.question !== question),
              newQuestion
          ];
      }
  }

  return summaryOfStayData;
}

export const createSummaryData = async (booking, resolvedPackage = null) => {
    let summaryOfStay = { guestName: null, guestEmail: null, rooms: [], data: {}, agreement_tc: null, signature: null };

    // Extract care and course data from ALL Q&A pairs
    const allQaPairs = booking.Sections.flatMap(section => section.QaPairs || []);
    const careAnalysisData = extractCareAnalysisData(allQaPairs);
    const courseAnalysisData = extractCourseAnalysisData(allQaPairs);
    
    console.log('📊 Extracted analysis data:', {
      careAnalysisData,
      courseAnalysisData
    });

    // Process Q&A pairs
    summaryOfStay.data = booking.Sections.reduce((data, section) => {
        section.QaPairs.forEach(pair => {
            const question = pair.question || pair.Question?.question;
            const answer = pair.answer;
            const questionKey = pair.Question?.question_key;
            const questionType = pair.Question?.question_type;
            data = generateSummaryData(data, question, answer, questionType, section.QaPairs, questionKey);
        });
        return data;
    }, {});

    summaryOfStay.guestName = booking.Guest.first_name + ' ' + booking.Guest.last_name;
    summaryOfStay.guestEmail = booking.Guest.email;

    // Use resolved package if provided
    if (resolvedPackage && summaryOfStay.data.selectedPackageId) {
        console.log('✅ Using pre-resolved package:', resolvedPackage.name);
        
        if (resolvedPackage.name?.includes('Wellness')) {
            summaryOfStay.data.packageType = serializePackage(resolvedPackage.name);
            summaryOfStay.data.packageTypeAnswer = resolvedPackage.name;
            summaryOfStay.data.packageCost = resolvedPackage.price;
            summaryOfStay.data.isNDISFunder = false;
            summaryOfStay.data.packageCode = resolvedPackage.package_code;
        } else {
            // NDIS package
            summaryOfStay.data.ndisPackage = resolvedPackage.name;
            summaryOfStay.data.packageType = serializePackage(resolvedPackage.name);
            summaryOfStay.data.packageTypeAnswer = resolvedPackage.name;
            summaryOfStay.data.packageCost = resolvedPackage.price;
            summaryOfStay.data.isNDISFunder = true;
            summaryOfStay.data.packageCode = resolvedPackage.package_code;
        }
        
        // Store resolved package data AND analysis data
        summaryOfStay.data.resolvedPackageData = resolvedPackage;
    } else {
        summaryOfStay.data.packageType = serializePackage(
            summaryOfStay.data.isNDISFunder ? summaryOfStay.data.ndisPackage : summaryOfStay.data.packageType
        );
    }

    // Validate dates
    if (!summaryOfStay.data.datesOfStay) {
        console.error('❌ Missing datesOfStay');
        return {
            ...summaryOfStay,
            packageCosts: { details: [], totalCost: 0 },
            roomCosts: {
                roomUpgrade: { perNight: 0, total: 0 },
                additionalRoom: { perNight: 0, total: 0 },
                hspAccommodation: { perNight: 0, total: 0 }
            },
            totalOutOfPocket: 0
        };
    }

    // Calculate package costs WITH care and course data
    const packageCosts = await calculatePackageCosts(
        summaryOfStay.data.packageType,
        summaryOfStay.data.datesOfStay,
        summaryOfStay.data.nights,
        summaryOfStay.data.packageCost,
        summaryOfStay.data.resolvedPackageData,
        careAnalysisData,
        courseAnalysisData
    );

    console.log('📊 Package costs calculated:', {
        detailsCount: packageCosts.details?.length || 0,
        totalCost: packageCosts.totalCost
    });

    const selectedRooms = booking.Rooms.map((room, index) => {
        return { 
            room: room.label, 
            type: index === 0 ? room.RoomType.type : 'upgrade', 
            price: room.RoomType.price_per_night, 
            peak_rate: room.RoomType.peak_rate,
            hsp_pricing: room.RoomType.hsp_pricing
        };
    }).filter(room => room.type !== 'studio');

    summaryOfStay.rooms = selectedRooms;

    const roomCosts = calculateRoomCosts(
        summaryOfStay.rooms, 
        summaryOfStay.data.nights,
        summaryOfStay.data.resolvedPackageData
    );

    const isHSP = summaryOfStay.data.resolvedPackageData?.package_code === 'HOLIDAY_SUPPORT_PLUS' || 
                  summaryOfStay.data.resolvedPackageData?.package_code === 'HOLIDAY_SUPPORT';
    
    const totalOutOfPocket = isHSP 
        ? roomCosts.hspAccommodation.total 
        : (roomCosts.roomUpgrade.total + roomCosts.additionalRoom.total);

    summaryOfStay.signature = booking.signature;
    summaryOfStay.agreement_tc = booking.agreement_tc;

    return { ...summaryOfStay, packageCosts, roomCosts, totalOutOfPocket };
}

export const tryParseJSON = (str) => {
  if (typeof str !== 'string') return str;
  try {
    const parsed = JSON.parse(str);
    return parsed;
  } catch (e) {
    return str;
  }
};