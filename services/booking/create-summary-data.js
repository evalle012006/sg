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

const calculateDaysBreakdown = async (startDateStr, numberOfNights) => {
  const startDate = startDateStr.split(' - ')[0].split('/').reverse().join('-');

  const dates = startDateStr.split(' - ');
  const holidays = await getNSWHolidaysV2(dates[0], dates[1]);
  
  let breakdown = {
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: holidays.length || 0
  };

  for (let i = 0; i < numberOfNights; i++) {
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

const calculateRoomCosts = (rooms, nights) => {
  const roomCosts = {
    roomUpgrade: { perNight: 0, total: 0 },
    additionalRoom: { perNight: 0, total: 0 }
  };

  if (rooms && rooms.length > 0) {
    // First room is considered the upgrade
    roomCosts.roomUpgrade.perNight = rooms[0].price || 0;
    roomCosts.roomUpgrade.total = roomCosts.roomUpgrade.perNight * nights;

    // Additional rooms
    if (rooms.length > 1) {
      const additionalRoomsPerNight = rooms
        .slice(1)
        .reduce((total, room) => total + (room.price || 0), 0);
      
      roomCosts.additionalRoom.perNight = additionalRoomsPerNight;
      roomCosts.additionalRoom.total = additionalRoomsPerNight * nights;
    }
  }

  return roomCosts;
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
      // Helper object for question matching - use question key if available, fallback to question text
      const questionObj = { question, question_key: questionKey };
      
      // UPDATED: Use question key for funding check
      if (questionHasKey(questionObj, QUESTION_KEYS.FUNDING_SOURCE) ||
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
      // NEW: Capture NDIS funding type
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_FUNDING_OPTIONS) ||
               questionMatches(questionObj, 'Please select from one of the following NDIS funding options', QUESTION_KEYS.NDIS_FUNDING_OPTIONS)) {
          summaryOfStayData.ndisFundingType = answer;
      }
      // UPDATED: Use question keys for participant numbers
      else if (questionHasKey(questionObj, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) ||
               questionHasKey(questionObj, QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER) ||
               questionMatches(questionObj, 'NDIS Participant Number', QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) || 
               questionMatches(questionObj, 'icare Participant Number', QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER)) {
          summaryOfStayData.participantNumber = answer;
      } 
      // UPDATED: Use question key for check-in/out dates
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
      // UPDATED: Use question key for check-in date
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_IN_DATE) ||
               questionMatches(questionObj, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
          const checkIn = moment(answer, ['YYYY-MM-DD', 'DD/MM/YYYY']);
          summaryOfStayData.checkinDate = checkIn.format('DD/MM/YYYY');
      } 
      // UPDATED: Use question key for check-out date
      else if (questionHasKey(questionObj, QUESTION_KEYS.CHECK_OUT_DATE) ||
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
              // Try to get check-in date from qaPairs
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
      // UPDATED: Use question keys for accommodation packages (Wellness)
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
      // UPDATED: Use question key for accommodation packages (NDIS)
      else if (questionType !== 'package-selection' && 
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
                questionMatches(questionObj, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL)) &&
               (answer?.toLowerCase().includes('ndis') || answer?.toLowerCase().includes('ndia'))) {
              summaryOfStayData.ndisPackage = answer;
              summaryOfStayData.packageType = serializePackage(answer);
      } 
      // NEW: Handle package-selection type answers
      else if (questionType === 'package-selection' && 
               (questionHasKey(questionObj, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
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

// UPDATED: createSummaryData method with package resolution support
export const createSummaryData = async (booking) => {
    let summaryOfStay = { guestName: null, guestEmail: null, rooms: [], data: [], agreement_tc: null, signature: null };

    // UPDATED: Process Q&A pairs using question keys where possible
    summaryOfStay.data = booking.Sections.reduce((data, section) => {
        section.QaPairs.forEach(pair => {
            // Get question text from either the pair itself or the related Question object
            const question = pair.question || pair.Question?.question;
            const answer = pair.answer;
            const questionKey = pair.Question?.question_key;
            const questionType = pair.question_type;
            
            // Generate summary data with question key support
            data = generateSummaryData(data, question, answer, questionType, section.QaPairs, questionKey);
        });
        return data;  // Important: return the accumulated data
    }, {});  // Important: provide initial value as empty object

    summaryOfStay.guestName = booking.Guest.first_name + ' ' + booking.Guest.last_name;
    summaryOfStay.guestEmail = booking.Guest.email;

    // Handle package resolution for package-selection types
    if (summaryOfStay.data.selectedPackageId && summaryOfStay.data.packageSelectionType === 'package-selection') {
        try {
            const response = await fetch(`/api/packages/${summaryOfStay.data.selectedPackageId}`);
            if (response.ok) {
                const result = await response.json();
                
                if (result.success && result.package) {
                    const packageData = result.package;
                    
                    if (packageData.name?.includes('Wellness')) {
                        summaryOfStay.data.packageType = serializePackage(packageData.name);
                        summaryOfStay.data.packageTypeAnswer = packageData.name;
                        summaryOfStay.data.packageCost = packageData.price;
                        summaryOfStay.data.isNDISFunder = false;
                    } else {
                        // Assume NDIS package
                        summaryOfStay.data.ndisPackage = packageData.name;
                        summaryOfStay.data.packageType = serializePackage(packageData.name);
                        summaryOfStay.data.packageCost = packageData.price;
                        summaryOfStay.data.isNDISFunder = true;
                    }
                    
                    // Store resolved package data for pricing calculations
                    summaryOfStay.data.resolvedPackageData = packageData;
                }
            }
        } catch (error) {
            console.error('Error resolving package selection:', error);
        }
    } else {
        // Use existing logic for non-package-selection types
        summaryOfStay.data.packageType = serializePackage(summaryOfStay.data.isNDISFunder ? summaryOfStay.data.ndisPackage : summaryOfStay.data.packageType);
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

    // Calculate room costs
    const roomCosts = calculateRoomCosts(summaryOfStay.rooms, summaryOfStay.data.nights);

    // Calculate total Additional Room and Upgrade Costs
    const totalOutOfPocket = roomCosts.roomUpgrade.total + roomCosts.additionalRoom.total || 0;

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