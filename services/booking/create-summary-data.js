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
    throw new Error(`Failed to fetch holidays: ${error.message}`);
  }
}

export const calculateDaysBreakdown = async (startDateStr, numberOfNights, includeAllDays = false) => {
  console.log("calculateDaysBreakdown -> ", startDateStr, numberOfNights, includeAllDays)
  // ✅ Validate inputs
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

const getPricing = (option, packageData = null) => {
  // PRIORITY 1: If we have resolved package data with ndis_line_items, use that
  if (packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0) {
    console.log('Using package line items for pricing:', packageData.ndis_line_items);
    
    // Map the line items to the expected format
    const lineItems = packageData.ndis_line_items.map(lineItem => ({
      package: lineItem.description || lineItem.name || lineItem.package_name,
      lineItem: lineItem.line_item_code || lineItem.code || lineItem.lineItem,
      price: parseFloat(lineItem.price_per_night || lineItem.price || lineItem.cost || 0),
      type: determineLineItemType(lineItem)
    }));
    
    // Ensure we have all 4 types (weekday, saturday, sunday, publicHoliday)
    // If not, pad with default values
    const requiredTypes = ['weekday', 'saturday', 'sunday', 'publicHoliday'];
    const existingTypes = lineItems.map(item => item.type);
    
    requiredTypes.forEach(requiredType => {
      if (!existingTypes.includes(requiredType)) {
        // Find a similar line item to use as base price
        const baseItem = lineItems[0] || { package: 'STA Package', lineItem: '', price: 0 };
        lineItems.push({
          package: `${baseItem.package} - ${requiredType}`,
          lineItem: baseItem.lineItem,
          price: baseItem.price,
          type: requiredType
        });
      }
    });
    
    // Sort to ensure consistent order: weekday, saturday, sunday, publicHoliday
    const sortOrder = { 'weekday': 0, 'saturday': 1, 'sunday': 2, 'publicHoliday': 3 };
    lineItems.sort((a, b) => (sortOrder[a.type] || 999) - (sortOrder[b.type] || 999));
    
    return lineItems;
  }

  // PRIORITY 2: Fallback to hardcoded pricing based on option
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

// Helper function to determine line item type from the line item data
const determineLineItemType = (lineItem) => {
  const description = (lineItem.description || lineItem.name || lineItem.package_name || '').toLowerCase();
  const code = (lineItem.line_item_code || lineItem.code || lineItem.lineItem || '').toLowerCase();
  
  // Check both description and code for type indicators
  const fullText = `${description} ${code}`.toLowerCase();
  
  if (fullText.includes('public') || fullText.includes('holiday')) {
    return 'publicHoliday';
  } else if (fullText.includes('sunday')) {
    return 'sunday';
  } else if (fullText.includes('saturday') || fullText.includes('weekend')) {
    return 'saturday';
  } else if (fullText.includes('weekday') || fullText.includes('monday') || fullText.includes('tuesday') || 
             fullText.includes('wednesday') || fullText.includes('thursday') || fullText.includes('friday')) {
    return 'weekday';
  }
  
  // If no specific day type found, default to weekday for the first item, then increment
  // This is a fallback - ideally the line items should have clear day type indicators
  return 'weekday';
};

const calculatePackageCosts = async (packageType, datesOfStay, nights, packageCost, packageData = null) => {
  if (packageType.startsWith('W')) {
    const price = parseFloat(packageCost);
    return {
      totalCost: price * nights
    }
  }

  const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
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

// Helper function to check if an answer is a check-in/out answer from Q&A pairs
const getCheckInOutAnswer = (qaPairs) => {
    const checkInOutAnswers = [];
    
    qaPairs.forEach(qaPair => {
        // Check using question key first, then fallback to question text
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
      
      // Funding source
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
      // NDIS funding type
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_FUNDING_OPTIONS) ||
               questionKey === 'please-select-from-one-of-the-following-ndis-funding-options' ||
               questionMatches(questionObj, 'Please select from one of the following NDIS funding options', QUESTION_KEYS.NDIS_FUNDING_OPTIONS)) {
          summaryOfStayData.ndisFundingType = answer;
      }
      // ✅ FIX: Participant numbers - add exact key match
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) ||
               questionKey === 'ndis-ndia-participant-number' || // ✅ ADD THIS
               questionKey === 'icare-participant-number' ||
               questionMatches(questionObj, 'NDIS Participant Number', QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) || 
               questionMatches(questionObj, 'icare Participant Number', QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER)) {
          summaryOfStayData.participantNumber = answer;
      } 
      // Check-in and check-out dates combined
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
      // ✅ FIX: Check-in date - add exact key match
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_DATE) ||
               questionKey === 'check-in-date' || // ✅ ADD THIS
               questionMatches(questionObj, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
          const checkIn = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.checkinDate = checkIn.format('DD/MM/YYYY');
      } 
      // ✅ FIX: Check-out date - add exact key match
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_OUT_DATE) ||
               questionKey === 'check-out-date' || // ✅ ADD THIS
               questionMatches(questionObj, 'Check Out Date', QUESTION_KEYS.CHECK_OUT_DATE)) {
          const checkOut = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.checkoutDate = checkOut.format('DD/MM/YYYY');

          // If we have both dates, calculate the date range and nights
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
      // Wellness packages (non-package-selection)
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
      // NDIS packages (non-package-selection)
      else if (questionType !== 'package-selection' && 
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) &&
               (answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia'))) {
              summaryOfStayData.ndisPackage = answer;
              summaryOfStayData.packageType = serializePackage(answer);
      } 
      // ✅ FIX: Package selection - add exact key match
      else if ((questionType === 'package-selection' || 
                questionKey?.startsWith('please-select-your-accommodation-and-assistance-package')) && // ✅ ADD THIS
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionKey?.includes('accommodation') && questionKey?.includes('package') || // ✅ ADD THIS
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL))) {
              // For package-selection, answer is the package ID
              summaryOfStayData.selectedPackageId = answer;
              summaryOfStayData.packageSelectionType = 'package-selection';
              
              // Set a placeholder that will be resolved later
              summaryOfStayData.packageType = 'PACKAGE_SELECTION';
              summaryOfStayData.packageTypeAnswer = `Package ID: ${answer}`;
      }
      // UPDATED: NDIS-specific questions - using question keys where available
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

    // ✅ NEW: Use resolved package if provided
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
        
        // Store resolved package data for pricing calculations
        summaryOfStay.data.resolvedPackageData = resolvedPackage;
    } else {
        // Use existing logic for non-package-selection types
        summaryOfStay.data.packageType = serializePackage(
            summaryOfStay.data.isNDISFunder ? summaryOfStay.data.ndisPackage : summaryOfStay.data.packageType
        );
    }

    // Calculate package costs with resolved package data if available
    const packageCosts = await calculatePackageCosts(
        summaryOfStay.data.packageType,
        summaryOfStay.data.datesOfStay,
        summaryOfStay.data.nights,
        summaryOfStay.data.packageCost,
        summaryOfStay.data.resolvedPackageData
    );

    const selectedRooms = booking.Rooms.map((room, index) => {
        return { 
            room: room.label, 
            type: index === 0 ? room.RoomType.type : 'upgrade', 
            price: room.RoomType.price_per_night, 
            peak_rate: room.RoomType.peak_rate 
        };
    }).filter(room => room.type !== 'studio');

    summaryOfStay.rooms = selectedRooms;

    // Calculate room costs WITH package data for HSP handling
    const roomCosts = calculateRoomCosts(
        summaryOfStay.rooms, 
        summaryOfStay.data.nights,
        summaryOfStay.data.resolvedPackageData // Pass package data
    );

    // Calculate total out of pocket (including HSP logic)
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