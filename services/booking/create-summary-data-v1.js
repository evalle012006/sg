import moment from 'moment';
import { serializePackage } from '../../utilities/common';

/**
 * LEGACY COMPATIBILITY VERSION
 * This version is designed to work with the old BookingRequestForm
 * while providing data structure compatible with the new SummaryOfStay component
 */

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

const getPricing = (option) => {
  switch (option) {
    case 'SP':
    case 'NDIS_SP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:2 Weekday", lineItem: "01_054_0115_1_1", price: 950.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Saturday", lineItem: "01_055_0115_1_1", price: 1100.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Sunday", lineItem: "01_056_0115_1_1", price: 1250.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday", lineItem: "01_057_0115_1_1", price: 1500.00, type: 'publicHoliday' }
      ];
    case 'CSP':
    case 'NDIS_CSP':
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

/**
 * Legacy package cost calculation
 * Maintains backwards compatibility with old BookingRequestForm
 */
const calculatePackageCosts = async (packageType, datesOfStay, nights, packageCost) => {
  if (!datesOfStay || !nights || nights <= 0) {
    return { 
      details: [], 
      totalCost: 0 
    };
  }

  // Wellness packages - simple flat rate
  if (packageType && packageType.startsWith('W')) {
    const price = parseFloat(packageCost || 0);
    return {
      details: [{
        package: `Wellness Package`,
        lineItem: 'WELLNESS',
        price: price,
        nights: nights,
        subtotal: price * nights,
        description: `Wellness Package - ${nights} nights`,
        rate: price,
        quantity: nights,
        total: price * nights,
        rateCategory: 'day',
        rateCategoryLabel: '/night',
        rateCategoryQtyLabel: 'nights',
        lineItemType: 'accommodation',
        rateType: 'weekday'
      }],
      totalCost: price * nights
    };
  }

  // NDIS packages - day-based calculation
  const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
  const pricing = getPricing(packageType);
  
  if (!pricing || pricing.length === 0) {
    console.warn('⚠️ No pricing found for package type:', packageType);
    return { 
      details: [], 
      totalCost: 0 
    };
  }

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
      subtotal: rate.price * quantity,
      // Additional fields for new SummaryOfStay compatibility
      description: rate.package,
      rate: rate.price,
      quantity: quantity,
      total: rate.price * quantity,
      rateCategory: 'day',
      rateCategoryLabel: '/day',
      rateCategoryQtyLabel: 'days',
      lineItemType: 'accommodation',
      rateType: rate.type
    };
  });

  const totalCost = details.reduce((sum, detail) => sum + detail.subtotal, 0);

  return {
    details,
    totalCost
  };
};

/**
 * Legacy room cost calculation
 * Maintains backwards compatibility with old BookingRequestForm
 */
const calculateRoomCosts = (rooms, nights) => {
  const roomCosts = {
    roomUpgrade: { perNight: 0, total: 0 },
    additionalRoom: { perNight: 0, total: 0 },
    hspAccommodation: { perNight: 0, total: 0 } // Added for new SummaryOfStay compatibility
  };

  if (!rooms || rooms.length === 0) {
    return roomCosts;
  }

  // Filter out studio rooms
  const nonStudioRooms = rooms.filter(room => room.type !== 'studio');

  if (nonStudioRooms.length > 0) {
    // First room is considered the upgrade
    roomCosts.roomUpgrade.perNight = nonStudioRooms[0].price || 0;
    roomCosts.roomUpgrade.total = roomCosts.roomUpgrade.perNight * nights;

    // Additional rooms
    if (nonStudioRooms.length > 1) {
      const additionalRoomsPerNight = nonStudioRooms
        .slice(1)
        .reduce((total, room) => total + (room.price || 0), 0);
      
      roomCosts.additionalRoom.perNight = additionalRoomsPerNight;
      roomCosts.additionalRoom.total = additionalRoomsPerNight * nights;
    }
  }

  return roomCosts;
};

/**
 * Generate summary data from booking sections
 * This maintains the old logic while providing fields needed by new SummaryOfStay
 */
const generateSummaryData = (stayData, question, answer) => {
  let summaryOfStayData = { ...stayData };
  
  if (answer) {
    if (question.includes('How will your stay be funded')) {
      summaryOfStayData.funder = answer;
      if (answer.includes('NDIS') || answer.includes('NDIA')) {
        summaryOfStayData.isNDISFunder = true;
        // Clear wellness package data when NDIS is selected
        summaryOfStayData.packageType = '';
        summaryOfStayData.packageTypeAnswer = '';
      } else {
        summaryOfStayData.isNDISFunder = false;
        summaryOfStayData.ndisQuestions = [];
        summaryOfStayData.ndisPackage = '';
      }
    } 
    else if (question.includes('NDIS Participant Number') || question.includes('icare Participant Number')) {
      summaryOfStayData.participantNumber = answer;
    } 
    else if (question.includes('Check In Date and Check Out Date')) {
      const dates = answer.split(' - ');
      const checkIn = moment(dates[0]);
      const checkOut = moment(dates[1]);
      summaryOfStayData.datesOfStay = checkIn.format('DD/MM/YYYY') + ' - ' + checkOut.format('DD/MM/YYYY');
      if (checkIn.isValid() && checkOut.isValid()) {
        summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
      }
    } 
    else if (question.includes('Check In Date')) {
      summaryOfStayData.checkinDate = moment(answer).format('DD/MM/YYYY');
    } 
    else if (question.includes('Check Out Date')) {
      const checkOut = moment(answer);
      if (summaryOfStayData?.checkinDate && checkOut) {
        summaryOfStayData.datesOfStay = summaryOfStayData.checkinDate + ' - ' + checkOut.format('DD/MM/YYYY');
        const checkIn = moment(summaryOfStayData.checkinDate, 'DD/MM/YYYY');
        if (checkIn.isValid() && checkOut.isValid()) {
          summaryOfStayData.nights = checkOut.diff(checkIn, 'days');
        }
      }
    } 
    else if ((question.includes('Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.')
        || question.includes('Accommodation package options for Sargood Courses')) && answer.includes('Wellness')) {
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
    else if (question.includes('Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.')
        && (answer.includes('NDIS') || answer.includes('NDIA'))) {
      summaryOfStayData.ndisPackage = answer;
      summaryOfStayData.packageType = serializePackage(answer);
    } 
    else if (question.includes('Is Short-Term Accommodation including Respite a stated support in your plan?')
        || question.includes('What is the purpose of this stay and how does it align with your plan goals? ')
        || question.includes('How is this service value for money?') 
        || question === 'Please specify.'
        || question.includes('Are you having a break from your informal support?')
        || question.includes('Do you live alone?')
        || question.includes('Are you travelling with any informal supports?')
        || question.includes('Do you live in supported independent living (SIL)?')
        || question.includes('Why do you require 1:1 support?')) {
      const ndisQuestions = summaryOfStayData?.ndisQuestions ? summaryOfStayData.ndisQuestions : [];
      const newQuestion = { question: question, answer: tryParseJSON(answer) };
      summaryOfStayData.ndisQuestions = [
        ...ndisQuestions.filter(q => q.question !== question),
        newQuestion
      ];
    }
  }

  return summaryOfStayData;
};

/**
 * LEGACY createSummaryData function
 * Maintains backwards compatibility with old BookingRequestForm structure
 * while providing data format expected by new SummaryOfStay component
 */
export const createSummaryData = async (booking) => {
  console.log('🔄 Legacy createSummaryData called with booking:', booking?.uuid);
  
  let summaryOfStay = { 
    uuid: booking?.uuid,
    guestName: null, 
    guestEmail: null, 
    rooms: [], 
    data: {}, 
    agreement_tc: null, 
    signature: null,
    verbal_consent: null
  };

  // Process booking sections to extract data
  if (booking?.Sections) {
    summaryOfStay.data = booking.Sections.reduce((data, section) => {
      if (section.QaPairs) {
        section.QaPairs.forEach(pair => {
          const question = pair.question || pair.Question?.question;
          const answer = pair.answer;
          if (question && answer) {
            data = generateSummaryData(data, question, answer);
          }
        });
      }
      return data;
    }, {});
  }

  // Set guest information
  if (booking?.Guest) {
    summaryOfStay.guestName = `${booking.Guest.first_name} ${booking.Guest.last_name}`;
    summaryOfStay.guestEmail = booking.Guest.email;
  }

  // Determine final package type
  if (summaryOfStay.data.isNDISFunder) {
    summaryOfStay.data.packageType = serializePackage(summaryOfStay.data.ndisPackage);
    summaryOfStay.data.packageCode = summaryOfStay.data.packageType;
  } else {
    summaryOfStay.data.packageType = summaryOfStay.data.packageTypeAnswer;
    summaryOfStay.data.packageCode = serializePackage(summaryOfStay.data.packageTypeAnswer);
  }

  // Ensure we have dates and nights for calculations
  if (!summaryOfStay.data.datesOfStay || !summaryOfStay.data.nights) {
    console.warn('⚠️ Missing dates or nights data');
    return {
      ...summaryOfStay,
      packageCosts: { details: [], totalCost: 0 },
      roomCosts: { 
        roomUpgrade: { perNight: 0, total: 0 }, 
        additionalRoom: { perNight: 0, total: 0 },
        hspAccommodation: { perNight: 0, total: 0 }
      },
      totalOutOfPocket: 0,
      // Add empty fields expected by new SummaryOfStay
      careAnalysisData: null,
      courseAnalysisData: null,
      resolvedPackageData: null
    };
  }

  // Calculate package costs
  const packageCosts = await calculatePackageCosts(
    summaryOfStay.data.packageType,
    summaryOfStay.data.datesOfStay,
    summaryOfStay.data.nights,
    summaryOfStay.data.packageCost
  );

  // Process rooms
  const selectedRooms = (booking?.Rooms || [])
    .map((room, index) => ({
      room: room.label,
      name: room.label,
      type: index === 0 ? (room.RoomType?.type || 'studio') : 'upgrade',
      price: room.RoomType?.price_per_night || 0,
      price_per_night: room.RoomType?.price_per_night || 0,
      peak_rate: room.RoomType?.peak_rate || 0,
      hsp_pricing: room.RoomType?.hsp_pricing || 0
    }))
    .filter(room => room.type !== 'studio');

  summaryOfStay.rooms = selectedRooms;

  // Calculate room costs
  const roomCosts = calculateRoomCosts(
    summaryOfStay.rooms, 
    summaryOfStay.data.nights
  );

  // Calculate total out of pocket
  const totalOutOfPocket = roomCosts.roomUpgrade.total + roomCosts.additionalRoom.total;

  // Set signature and agreement data
  summaryOfStay.signature = booking.signature || null;
  summaryOfStay.agreement_tc = booking.agreement_tc || null;
  summaryOfStay.verbal_consent = booking.verbal_consent || null;

  // Add empty fields expected by new SummaryOfStay component
  // These will be null/empty in legacy mode but prevent errors
  summaryOfStay.data.careAnalysis = null;
  summaryOfStay.data.courseAnalysis = null;
  summaryOfStay.data.resolvedPackageData = null;

  const finalSummary = { 
    ...summaryOfStay, 
    packageCosts, 
    roomCosts, 
    totalOutOfPocket,
    // Additional compatibility fields
    careAnalysisData: null,
    courseAnalysisData: null,
    resolvedPackageData: null
  };

  console.log('✅ Legacy summary data created:', {
    hasPackageCosts: !!packageCosts,
    packageTotal: packageCosts.totalCost,
    hasRoomCosts: !!roomCosts,
    totalOutOfPocket
  });

  return finalSummary;
};

/**
 * Helper function to parse JSON strings safely
 */
export const tryParseJSON = (str) => {
  if (typeof str !== 'string') return str;
  try {
    return JSON.parse(str);
  } catch (e) {
    return str;
  }
};