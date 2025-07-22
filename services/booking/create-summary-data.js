import moment from 'moment';
import { serializePackage } from '../../utilities/common';
import { QUESTION_KEYS, questionMatches } from './question-helper';

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
    
    // const holidayData = await checkNSWPublicHoliday(currentDate);
    
    // if (holidayData?.isHoliday) {
    //   breakdown.publicHolidays++;
    // } else {
      const day = currentDate.getDay();
      if (day === 6) {
        breakdown.saturdays++;
      } else if (day === 0) {
        breakdown.sundays++;
      } else {
        breakdown.weekdays++;
      }
    // }
  }

  return breakdown;
};

const getPricing = (option) => {
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

const calculatePackageCosts = async (packageType, datesOfStay, nights, packageCost) => {
  if (packageType.startsWith('W')) {
    const price = parseFloat(packageCost);
    return {
      totalCost: price * nights
    }
  }

  const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
  const pricing = getPricing(packageType);
  
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

// REFACTORED: generateSummaryData method with question keys
const generateSummaryData = (stayData, question, answer) => {
  let summaryOfStayData = { ...stayData };
  if (answer) {
      // UPDATED: Use question key for funding check
      if (questionMatches(question, 'How will your stay be funded', QUESTION_KEYS.FUNDING_SOURCE)) {
          summaryOfStayData.funder = answer;
          if (answer.includes('NDIS') || answer.includes('NDIA')) {
            summaryOfStayData.isNDISFunder = true;
            summaryOfStayData.packageType = '';
            summaryOfStayData.packageTypeAnswer = '';
          } else {
            summaryOfStayData.isNDISFunder = false;
            summaryOfStayData.ndisQuestions = [];
            summaryOfStayData.ndisPackage = '';
          }
      } 
      // UPDATED: Use question keys for participant numbers
      else if (questionMatches(question, 'NDIS Participant Number', QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) || 
               questionMatches(question, 'icare Participant Number', QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER)) {
          summaryOfStayData.participantNumber = answer;
      } 
      // UPDATED: Use question key for check-in/out dates
      else if (questionMatches(question, 'Check In Date and Check Out Date', QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
          const dates = answer.split(' - ');
          const checkIn = moment(dates[0]);
          const checkOut = moment(dates[1]);
          summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
          if (checkIn.isValid() && checkOut.isValid()) {
              summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
          }
      } 
      // UPDATED: Use question key for check-in date
      else if (questionMatches(question, 'Check In Date', QUESTION_KEYS.CHECK_IN_DATE)) {
          summaryOfStayData.checkinDate = moment(answer).format('DD/MM/YYYY');
      } 
      // UPDATED: Use question key for check-out date
      else if (questionMatches(question, 'Check Out Date', QUESTION_KEYS.CHECK_OUT_DATE)) {
          const checkOut = moment(answer);
          if (summaryOfStayData?.checkinDate && checkOut) {
              summaryOfStayData.datesOfStay = summaryOfStayData.checkinDate + ' - ' + checkOut.format('DD/MM/YYYY');
              const checkIn = moment(summaryOfStayData.checkinDate, 'YYYY-MM-DD');
              if (checkIn.isValid() && checkOut.isValid()) {
                summaryOfStayData.nights = checkOut.diff(moment(summaryOfStayData.checkinDate, 'DD/MM/YYYY'), 'days');
              }
          }
      } 
      // UPDATED: Use question keys for accommodation packages (Wellness)
      else if ((questionMatches(question, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) ||
               questionMatches(question, 'Accommodation package options for Sargood Courses', QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES)) && 
               answer.includes('Wellness')) {
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
      else if (questionMatches(question, 'Please select your accommodation and assistance package below', QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) &&
               (answer.includes('NDIS') || answer.includes('NDIA'))) {
              summaryOfStayData.ndisPackage = answer;
              summaryOfStayData.packageType = serializePackage(answer);
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

// REFACTORED: createSummaryData method using question keys
export const createSummaryData = async (booking) => {
    let summaryOfStay = { guestName: null, guestEmail: null, rooms: [], data: [], agreement_tc: null, signature: null };

    // UPDATED: Process Q&A pairs using question keys where possible
    summaryOfStay.data = booking.Sections.reduce((data, section) => {
        section.QaPairs.forEach(pair => {
            // Get question text from either the pair itself or the related Question object
            const question = pair.question || pair.Question?.question;
            const answer = pair.answer;
            
            // Generate summary data with question key support
            data = generateSummaryData(data, question, answer);
        });
        return data;  // Important: return the accumulated data
    }, {});  // Important: provide initial value as empty object

    summaryOfStay.guestName = booking.Guest.first_name + ' ' + booking.Guest.last_name;
    summaryOfStay.guestEmail = booking.Guest.email;

    summaryOfStay.data.packageType = serializePackage(summaryOfStay.data.isNDISFunder ? summaryOfStay.data.ndisPackage : summaryOfStay.data.packageType);

    // Calculate package costs
    const packageCosts = await calculatePackageCosts(
        summaryOfStay.data.packageType,
        summaryOfStay.data.datesOfStay,
        summaryOfStay.data.nights,
        summaryOfStay.data.packageCost,
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