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
  if (!startDateStr) {
    console.error('calculateDaysBreakdown: startDateStr is undefined');
    return { weekdays: 0, saturdays: 0, sundays: 0, publicHolidays: 0 };
  }
  
  if (!numberOfNights || numberOfNights <= 0) {
    console.error('calculateDaysBreakdown: numberOfNights is invalid', numberOfNights);
    return { weekdays: 0, saturdays: 0, sundays: 0, publicHolidays: 0 };
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

const parseDurationToHours = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  
  const normalized = durationStr.toLowerCase().trim();
  
  const hoursMatch = normalized.match(/^([\d.]+)\s*hours?$/);
  if (hoursMatch) {
    return parseFloat(hoursMatch[1]);
  }
  
  const minutesMatch = normalized.match(/^([\d.]+)\s*minutes?$/);
  if (minutesMatch) {
    return parseFloat(minutesMatch[1]) / 60;
  }
  
  const numericValue = parseFloat(normalized);
  if (!isNaN(numericValue)) {
    return numericValue;
  }
  
  return 0;
};

const getRateTypeForDay = (dayOfWeek) => {
  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';
  return 'weekday';
};

const generateStayDatesArray = (datesOfStay, nights) => {
  if (!datesOfStay) return [];
  
  const startDateStr = datesOfStay.split(' - ')[0];
  const startMoment = moment(startDateStr, 'DD/MM/YYYY');
  
  if (!startMoment.isValid()) return [];
  
  const dates = [];
  const totalDays = nights + 1;
  
  for (let i = 0; i < totalDays; i++) {
    const currentDate = startMoment.clone().add(i, 'days');
    dates.push({
      date: currentDate.format('DD/MM/YYYY'),
      dayOfWeek: currentDate.day(),
      rateType: getRateTypeForDay(currentDate.day()),
      isCheckIn: i === 0,
      isCheckOut: i === totalDays - 1,
      isMiddleDay: i > 0 && i < totalDays - 1
    });
  }
  
  return dates;
};

const extractCareAnalysisData = (qaPairs, datesOfStay = null, nights = 0) => {
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
    
    console.log('📊 Parsing care data:', {
      careVaries: careData.careVaries,
      careDataCount: careData.careData.length,
      datesOfStay,
      nights
    });
    
    const careByDateAndPeriod = {};
    careData.careData.forEach(item => {
      const date = item.date;
      const period = (item.care || '').toLowerCase();
      const duration = parseDurationToHours(item.values?.duration);
      const carers = item.values?.carers;
      
      if (carers === 'No care required' || duration === 0) {
        return;
      }
      
      if (!careByDateAndPeriod[date]) {
        careByDateAndPeriod[date] = { morning: 0, afternoon: 0, evening: 0 };
      }
      
      if (period === 'morning') {
        careByDateAndPeriod[date].morning = duration;
      } else if (period === 'afternoon') {
        careByDateAndPeriod[date].afternoon = duration;
      } else if (period === 'evening') {
        careByDateAndPeriod[date].evening = duration;
      }
    });
    
    const defaultValues = careData.defaultValues || {};
    const defaultCare = {
      morning: defaultValues.morning?.carers !== 'No care required' 
        ? parseDurationToHours(defaultValues.morning?.duration) : 0,
      afternoon: defaultValues.afternoon?.carers !== 'No care required' 
        ? parseDurationToHours(defaultValues.afternoon?.duration) : 0,
      evening: defaultValues.evening?.carers !== 'No care required' 
        ? parseDurationToHours(defaultValues.evening?.duration) : 0
    };
    
    const stayDates = generateStayDatesArray(datesOfStay, nights);
    
    if (stayDates.length === 0) {
      return null;
    }
    
    const dailyCareDetails = [];
    
    stayDates.forEach(dayInfo => {
      const { date, dayOfWeek, rateType, isCheckIn, isCheckOut, isMiddleDay } = dayInfo;
      
      const rawCare = careByDateAndPeriod[date] || { ...defaultCare };
      
      let applicableCare = { morning: 0, afternoon: 0, evening: 0 };
      
      if (isCheckIn) {
        applicableCare.evening = rawCare.evening || 0;
      } else if (isCheckOut) {
        applicableCare.morning = rawCare.morning || 0;
      } else {
        applicableCare.morning = rawCare.morning || 0;
        applicableCare.afternoon = rawCare.afternoon || 0;
        applicableCare.evening = rawCare.evening || 0;
      }
      
      const dayTotal = applicableCare.morning + applicableCare.afternoon + applicableCare.evening;
      
      dailyCareDetails.push({
        date,
        dayOfWeek,
        rateType,
        isCheckIn,
        isCheckOut,
        isMiddleDay,
        rawCare,
        applicableCare,
        dayTotal
      });
    });
    
    const totalCareHours = dailyCareDetails.reduce((sum, day) => sum + day.dayTotal, 0);
    const totalHoursPerDay = defaultCare.morning + defaultCare.afternoon + defaultCare.evening;
    
    return {
      requiresCare: true,
      totalHoursPerDay,
      totalCareHours,
      sampleDay: defaultCare,
      careVaries: careData.careVaries,
      dailyCareDetails,
      rawCareData: careData
    };
  } catch (error) {
    console.error('Error parsing care data:', error);
    return null;
  }
};

const extractCourseAnalysisData = (qaPairs) => {
  const courseQuestion = qaPairs.find(pair => 
    pair.Question?.question_key === 'have-you-been-offered-a-place-in-a-course-for-this-stay'
  );
  
  if (!courseQuestion) {
    return { hasCourse: false };
  }
  
  const hasCourse = typeof courseQuestion.answer === 'string' && courseQuestion.answer.toLowerCase() === 'yes';
  
  return { hasCourse, courseDay: 1 };
};

const getDaysForRateType = (rateType, daysBreakdown) => {
  if (!rateType || rateType === '') {
    return daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
  }
  
  switch (rateType) {
    case 'weekday': return daysBreakdown.weekdays;
    case 'saturday': return daysBreakdown.saturdays;
    case 'sunday': return daysBreakdown.sundays;
    case 'public_holiday':
    case 'publicHoliday': return daysBreakdown.publicHolidays;
    default: return 0;
  }
};

const calculateCareQuantity = (lineItem, careAnalysisData) => {
  const { rate_type, care_time } = lineItem;
  
  if (!careAnalysisData?.requiresCare || !careAnalysisData?.dailyCareDetails) {
    return 0;
  }
  
  const dailyDetails = careAnalysisData.dailyCareDetails;
  let totalHours = 0;
  
  const normalizedCareTime = (care_time || '').toLowerCase();
  const isMorning = normalizedCareTime === 'morning';
  const isAfternoon = normalizedCareTime === 'afternoon';
  const isEvening = normalizedCareTime === 'evening';
  const isDaytime = normalizedCareTime === 'daytime' || normalizedCareTime.includes('daytime');
  const isAllPeriods = !normalizedCareTime || normalizedCareTime === '';
  
  dailyDetails.forEach(dayDetail => {
    const { rateType: dayRateType, applicableCare } = dayDetail;
    
    if (rate_type && rate_type !== '' && dayRateType !== rate_type) {
      return;
    }
    
    let dayHours = 0;
    
    if (isAllPeriods) {
      dayHours = (applicableCare.morning || 0) + 
                 (applicableCare.afternoon || 0) + 
                 (applicableCare.evening || 0);
    } else if (isDaytime) {
      dayHours = applicableCare.afternoon || 0;
    } else if (isMorning) {
      dayHours = applicableCare.morning || 0;
    } else if (isAfternoon) {
      dayHours = applicableCare.afternoon || 0;
    } else if (isEvening) {
      dayHours = applicableCare.evening || 0;
    }
    
    totalHours += dayHours;
  });
  
  return totalHours;
};

const calculateGroupActivitiesQuantity = (lineItem, courseAnalysisData, datesOfStay, nights) => {
  const { rate_type } = lineItem;
  const stayDates = generateStayDatesArray(datesOfStay, nights);
  
  if (stayDates.length === 0) return 0;
  
  let totalHours = 0;
  
  stayDates.forEach((dayInfo, index) => {
    const { rateType: dayRateType, isCheckIn, isCheckOut } = dayInfo;
    
    if (rate_type && rate_type !== '' && dayRateType !== rate_type) {
      return;
    }
    
    const isCourseDay = courseAnalysisData?.hasCourse && index === 1;
    
    if (isCheckIn || isCheckOut) {
      totalHours += 6;
    } else if (isCourseDay) {
      totalHours += 6;
    } else {
      totalHours += 12;
    }
  });
  
  return totalHours;
};

const calculateApiQuantity = (lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown, datesOfStay, nights) => {
  const { line_item_type, rate_type, rate_category } = lineItem;
  
  switch (line_item_type) {
    case 'room':
      return nights;
    case 'group_activities':
      return calculateGroupActivitiesQuantity(lineItem, courseAnalysisData, datesOfStay, nights);
    case 'sleep_over':
      return nights;
    case 'course':
      if (!courseAnalysisData?.hasCourse) return 0;
      return 6;
    case 'care':
      if (!careAnalysisData?.requiresCare) return 0;
      return calculateCareQuantity(lineItem, careAnalysisData);
    default:
      if (rate_category === 'day') {
        return getDaysForRateType(rate_type, daysBreakdown);
      } else if (rate_category === 'hour') {
        return getDaysForRateType(rate_type, daysBreakdown) * 12;
      }
      return 0;
  }
};

const processApiPackageData = (packageData, daysBreakdown, careDaysBreakdown, nights, careAnalysisData, courseAnalysisData, datesOfStay) => {
  const processedRows = packageData.ndis_line_items
    .filter(lineItem => {
      if (lineItem.line_item_type === 'course' && (!courseAnalysisData || !courseAnalysisData.hasCourse)) {
        return false;
      }
      return true;
    })
    .map(lineItem => {
      const quantity = calculateApiQuantity(lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown, datesOfStay, nights);
      const rate = parseFloat(lineItem.price_per_night || 0);
      const total = rate * quantity;

      const rateCategoryLabel = lineItem.rate_category === 'hour' ? '/hour' : lineItem.rate_category === 'day' ? '/day' : '/night';
      const rateCategoryQtyLabel = lineItem.rate_category === 'hour' ? 'hrs' : lineItem.rate_category === 'day' ? 'days' : 'nights';

      return {
        package: lineItem.sta_package || lineItem.description || 'Package Item',
        lineItem: lineItem.line_item || lineItem.line_item_code || 'N/A',
        price: rate,
        nights: quantity,
        subtotal: total,
        description: lineItem.sta_package || lineItem.description || 'Package Item',
        rate: rate,
        quantity: quantity,
        total: total,
        rateCategory: lineItem.rate_category || 'day',
        rateCategoryLabel,
        rateCategoryQtyLabel,
        lineItemType: lineItem.line_item_type || '',
        rateType: lineItem.rate_type || 'BLANK',
        careTime: lineItem.care_time || ''
      };
    });

  const filteredRows = processedRows.filter(row => row.quantity > 0);
  const totalCost = filteredRows.reduce((sum, row) => sum + row.total, 0);
  
  return { details: filteredRows, totalCost };
};

const getPricing = (option, packageData = null) => {
  if (packageData?.ndis_line_items?.length > 0) return [];

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
  if (!datesOfStay || !nights || nights <= 0) {
    return { details: [], totalCost: 0 };
  }

  if (packageType.startsWith('W')) {
    return { totalCost: parseFloat(packageCost) * nights };
  }

  const breakdown = await calculateDaysBreakdown(datesOfStay, nights, false);
  const careDaysBreakdown = await calculateDaysBreakdown(datesOfStay, nights, true);

  if (packageData?.ndis_line_items?.length > 0) {
    return processApiPackageData(packageData, breakdown, careDaysBreakdown, nights, careAnalysisData, courseAnalysisData, datesOfStay);
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

  return { details, totalCost: details.reduce((sum, d) => sum + d.subtotal, 0) };
};

const calculateRoomCosts = (rooms, nights, packageData = null) => {
  const roomCosts = {
    roomUpgrade: { perNight: 0, total: 0 },
    additionalRoom: { perNight: 0, total: 0 },
    hspAccommodation: { perNight: 0, total: 0 }
  };

  if (!rooms?.length) return roomCosts;

  const packageCode = packageData?.package_code || '';
  const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';

  if (isHSP) {
    const totalPerNight = rooms.reduce((sum, room) => sum + (room.hsp_pricing || room.price || 0), 0);
    roomCosts.hspAccommodation = { perNight: totalPerNight, total: totalPerNight * nights };
  } else {
    const nonStudioRooms = rooms.filter(room => room.type !== 'studio');
    
    if (nonStudioRooms.length > 0) {
      roomCosts.roomUpgrade.perNight = nonStudioRooms[0].price || 0;
      roomCosts.roomUpgrade.total = roomCosts.roomUpgrade.perNight * nights;
      
      if (nonStudioRooms.length > 1) {
        const additionalPrice = nonStudioRooms.slice(1).reduce((total, room) => total + (room.price || 0), 0);
        roomCosts.additionalRoom = { perNight: additionalPrice, total: additionalPrice * nights };
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

export const generateSummaryData = (stayData, question, answer, questionType = null, qaPairs = [], questionKey = null, ndisOnly = false) => {
  let summaryOfStayData = { ...stayData };
  
  if (answer) {
    const questionObj = { question, question_key: questionKey };
    
    if (questionHasKey(questionObj, QUESTION_KEYS.FUNDING_SOURCE) ||
        questionKey === 'how-will-your-stay-be-funded' ||
        questionMatches(questionObj, 'How will your stay be funded', QUESTION_KEYS.FUNDING_SOURCE)) {
      summaryOfStayData.funder = answer;
      const answerStr = typeof answer === 'string' ? answer.toLowerCase() : '';
      summaryOfStayData.isNDISFunder = answerStr.includes('ndis') || answerStr.includes('ndia');
      if (!summaryOfStayData.isNDISFunder) {
        summaryOfStayData.ndisQuestions = [];
        summaryOfStayData.ndisPackage = '';
      }
    } 
    else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_FUNDING_OPTIONS) ||
             questionKey === 'please-select-from-one-of-the-following-ndis-funding-options') {
      summaryOfStayData.ndisFundingType = answer;
    }
    else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) ||
             questionKey === 'ndis-ndia-participant-number' ||
             questionKey === 'icare-participant-number') {
      summaryOfStayData.participantNumber = answer;
    } 
    else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
      if (typeof answer === 'string' && answer.includes(' - ')) {
        const dates = answer.split(' - ');
        const checkIn = moment(dates[0], ['YYYY-MM-DD', 'DD/MM/YYYY']);
        const checkOut = moment(dates[1], ['YYYY-MM-DD', 'DD/MM/YYYY']);
        summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
        if (checkIn.isValid() && checkOut.isValid()) {
          summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
        }
      }
    } 
    else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_DATE) || questionKey === 'check-in-date') {
      summaryOfStayData.checkinDate = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']).format('DD/MM/YYYY');
    } 
    else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_OUT_DATE) || questionKey === 'check-out-date') {
      const checkOut = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
      summaryOfStayData.checkoutDate = checkOut.format('DD/MM/YYYY');

      if (summaryOfStayData.checkinDate && checkOut.isValid()) {
        const checkIn = moment(summaryOfStayData.checkinDate, 'DD/MM/YYYY');
        if (checkIn.isValid()) {
          summaryOfStayData.datesOfStay = summaryOfStayData.checkinDate + ' - ' + checkOut.format('DD/MM/YYYY');
          summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
        }
      } else if (qaPairs?.length > 0) {
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
    else if (questionType !== 'package-selection' && typeof answer === 'string' && answer.includes('Wellness')) {
      summaryOfStayData.packageType = serializePackage(answer);
      summaryOfStayData.packageTypeAnswer = answer;
      if (answer.includes('Wellness & Support Package')) summaryOfStayData.packageCost = 985;
      else if (answer.includes('Wellness & High Support Package')) summaryOfStayData.packageCost = 1365;
      else if (answer.includes('Wellness & Very High Support Package')) summaryOfStayData.packageCost = 1740;
    } 
    else if (questionType !== 'package-selection' && typeof answer === 'string' && (answer.toLowerCase().includes('ndis') || answer.toLowerCase().includes('ndia'))) {
      summaryOfStayData.ndisPackage = answer;
      summaryOfStayData.packageType = serializePackage(answer);
    } 
    else if (questionType === 'package-selection' || questionKey?.startsWith('please-select-your-accommodation-and-assistance-package')) {
      summaryOfStayData.selectedPackageId = answer;
      summaryOfStayData.packageSelectionType = 'package-selection';
      summaryOfStayData.packageType = 'PACKAGE_SELECTION';
      summaryOfStayData.packageTypeAnswer = `Package ID: ${answer}`;
    } 
    // ✅ UPDATED: Check for NDIS question keys first, then fallback to text matching
    else if (
      ndisOnly ||
      // Check by question key first
      questionKey === QUESTION_KEYS.IS_STA_STATED_SUPPORT ||
      questionKey === QUESTION_KEYS.IS_STA_STATED_SUPPORT_IN_PLAN ||
      questionKey === QUESTION_KEYS.DO_YOU_LIVE_ALONE ||
      questionKey === QUESTION_KEYS.WE_ALSO_NEED_TO_KNOW ||
      questionKey === QUESTION_KEYS.DO_YOU_LIVE_IN_SIL ||
      questionKey === QUESTION_KEYS.ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS ||
      questionKey === QUESTION_KEYS.ARE_YOU_TRAVELLING_WITH_INFORMAL_SUPPORTS ||
      // Fallback to text matching for legacy questions without keys
      question.includes('Is Short-Term Accommodation including Respite a stated support in your plan?') ||
      question.includes('What is the purpose of this stay and how does it align with your plan goals?') ||
      question.includes('How is this service value for money?') || 
      question == 'Please specify.' ||
      question.includes('Do you live in supported independent living (SIL)?') ||
      question.includes('Do you live alone?') ||
      question.includes('Are you staying with any informal supports?') ||
      question.includes('Are you travelling with any informal supports?') ||
      question.includes('We also need to know at least one of the below factors applies to you')
    ) {
      const ndisQuestions = summaryOfStayData?.ndisQuestions || [];
      // ✅ Strip HTML tags from question text before storing
      const cleanQuestion = question.replace(/<[^>]*>/g, '');
      summaryOfStayData.ndisQuestions = [
        ...ndisQuestions.filter(q => q.question !== cleanQuestion),
        { question: cleanQuestion, answer: tryParseJSON(answer) }
      ];
    }
  }

  return summaryOfStayData;
}

export const createSummaryData = async (booking, resolvedPackage = null) => {
  let summaryOfStay = { guestName: null, guestEmail: null, rooms: [], data: {}, agreement_tc: null, signature: null };

  summaryOfStay.data = booking.Sections.reduce((data, section) => {
    section.QaPairs.forEach(pair => {
      const question = pair.question || pair.Question?.question;
      const answer = pair.answer;
      const questionKey = pair.Question?.question_key;
      const questionType = pair.Question?.question_type;
      const ndisOnlyQuestion = pair.Question?.ndis_only || false;
      data = generateSummaryData(data, question, answer, questionType, section.QaPairs, questionKey, ndisOnlyQuestion);
    });
    return data;
  }, {});

  const allQaPairs = booking.Sections.flatMap(section => section.QaPairs || []);
  
  const careAnalysisData = extractCareAnalysisData(allQaPairs, summaryOfStay.data.datesOfStay, summaryOfStay.data.nights);
  const courseAnalysisData = extractCourseAnalysisData(allQaPairs);

  summaryOfStay.guestName = booking.Guest.first_name + ' ' + booking.Guest.last_name;
  summaryOfStay.guestEmail = booking.Guest.email;

  if (resolvedPackage && summaryOfStay.data.selectedPackageId) {
    if (resolvedPackage.name?.includes('Wellness')) {
      summaryOfStay.data.packageType = serializePackage(resolvedPackage.name);
      summaryOfStay.data.packageTypeAnswer = resolvedPackage.name;
      summaryOfStay.data.packageCost = resolvedPackage.price;
      summaryOfStay.data.isNDISFunder = false;
    } else {
      summaryOfStay.data.ndisPackage = resolvedPackage.name;
      summaryOfStay.data.packageType = serializePackage(resolvedPackage.name);
      summaryOfStay.data.packageTypeAnswer = resolvedPackage.name;
      summaryOfStay.data.packageCost = resolvedPackage.price;
      summaryOfStay.data.isNDISFunder = true;
    }
    summaryOfStay.data.packageCode = resolvedPackage.package_code;
    summaryOfStay.data.resolvedPackageData = resolvedPackage;
  } else {
    summaryOfStay.data.packageType = serializePackage(
      summaryOfStay.data.isNDISFunder ? summaryOfStay.data.ndisPackage : summaryOfStay.data.packageType
    );
  }
  
  summaryOfStay.data.careAnalysis = careAnalysisData;
  summaryOfStay.data.courseAnalysis = courseAnalysisData;

  if (!summaryOfStay.data.datesOfStay) {
    return {
      ...summaryOfStay,
      packageCosts: { details: [], totalCost: 0 },
      roomCosts: { roomUpgrade: { perNight: 0, total: 0 }, additionalRoom: { perNight: 0, total: 0 }, hspAccommodation: { perNight: 0, total: 0 } },
      totalOutOfPocket: 0
    };
  }

  const packageCosts = await calculatePackageCosts(
    summaryOfStay.data.packageType,
    summaryOfStay.data.datesOfStay,
    summaryOfStay.data.nights,
    summaryOfStay.data.packageCost,
    summaryOfStay.data.resolvedPackageData,
    careAnalysisData,
    courseAnalysisData
  );

  const selectedRooms = booking.Rooms.map((room, index) => ({
    room: room.label, 
    type: index === 0 ? room.RoomType.type : 'upgrade', 
    price: room.RoomType.price_per_night, 
    peak_rate: room.RoomType.peak_rate,
    hsp_pricing: room.RoomType.hsp_pricing
  })).filter(room => room.type !== 'studio');

  summaryOfStay.rooms = selectedRooms;

  const roomCosts = calculateRoomCosts(summaryOfStay.rooms, summaryOfStay.data.nights, summaryOfStay.data.resolvedPackageData);

  const isHSP = summaryOfStay.data.resolvedPackageData?.package_code === 'HOLIDAY_SUPPORT_PLUS' || 
                summaryOfStay.data.resolvedPackageData?.package_code === 'HOLIDAY_SUPPORT';
  
  const totalOutOfPocket = isHSP ? roomCosts.hspAccommodation.total : (roomCosts.roomUpgrade.total + roomCosts.additionalRoom.total);

  summaryOfStay.signature = booking.signature;
  summaryOfStay.agreement_tc = booking.agreement_tc;

  return { ...summaryOfStay, packageCosts, roomCosts, totalOutOfPocket };
}

export const tryParseJSON = (str) => {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch (e) { return str; }
};