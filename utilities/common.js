import moment from 'moment';
import { QUESTION_KEYS } from '../services/booking/question-helper';

/**
 * Get first letters from a string (for abbreviations)
 */
export const getFirstLetters = (str, separator = ' ') => {
  if (!str) return '';
  return str
    .split(separator)
    .map(word => word.charAt(0).toUpperCase())
    .join('');
};

export const omitAttribute = (obj, ...props) => {
    const result = { ...obj };
    props.forEach(prop => {
        delete result[prop];
    });
    return result;
}

export const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes'

    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']

    const i = Math.floor(Math.log(bytes) / Math.log(k))

    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const UppercaseFirstLetter = (str) => {
    if (!str) {
        return;
    }
    const arr = str.split(" ");

    for (var i = 0; i < arr.length; i++) {
        arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].slice(1);

    }

    return arr ? arr.join(" ") : '';
}

export const validateDate = (value) => {
    let error;

    const date = moment(value);

    if (!date.isValid()) {
        error = 'Invalid date entered';
    }

    return error;
}

export const generateMonthsArray = () => {
    const currentDate = new Date();
    const monthsArray = [];

    for (let i = 0; i <= 12; i++) {
        let year = currentDate.getFullYear();
        let month = currentDate.getMonth() - i;

        if (month < 0) {
            year -= 1;
            month += 12;
        }

        monthsArray.unshift(new Date(year, month, 1));
    }

    return monthsArray;
}

export const checkFileSize = (size, limitInBytes = 5120000) => {
    let msg;
    const fileSizeMb = formatBytes(size, 0);
    const limitInMb = formatBytes(limitInBytes, 0);
    if (size > limitInBytes) {
        msg = `The file is too large. Please select a file smaller than ${limitInMb}.`;
    }

    return msg;
}

export const serializePackage = (packageType) => {
  if (!packageType) return '';
  if (packageType.includes("Wellness & Very High Support Package")) {
    return "WVHS";
  } else if (packageType.includes("Wellness & High Support Package")) {
    return "WHS";
  } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
    return "WS";
  } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
    return "SP"
  } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
    return "CSP"
  } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
    return "HCSP"
  } else {
    return '';
  }
}

export const getFunder = (sections) => {
  if (!sections || sections.length === 0) return null;
  
  let funder = null;
  
  sections.forEach(section => {
    // Check QaPairs structure (most common)
    if (section.QaPairs && section.QaPairs.length > 0) {
      const funderQaPair = section.QaPairs.find(qaPair => {
        const question = qaPair.Question;
        const qKey = qaPair.question_key || question?.question_key;
        const questionText = qaPair.question || question?.question;
        
        // Priority 1: Check by question_key (most reliable)
        if (qKey === QUESTION_KEYS.FUNDING_SOURCE) {
          return true;
        }
        
        // Priority 2: Check by specific question_key variants
        if (qKey === 'how-will-your-stay-be-funded') {
          return true;
        }
        
        // Priority 3: Fallback to question text (for backward compatibility)
        if (questionText === 'How will your stay be funded?') {
          return true;
        }
        
        // Priority 4: Partial text match (most flexible)
        if (questionText && questionText.toLowerCase().includes('how will your stay be funded')) {
          return true;
        }
        
        return false;
      });
      
      if (funderQaPair && funderQaPair.answer) {
        funder = funderQaPair.answer;
      }
    }
    // Check Questions structure (alternative format)
    else if (section?.Questions?.length > 0) {
      const funderQuestion = section.Questions.find(question => {
        const qKey = question.question_key;
        const questionText = question.question;
        
        // Priority 1: Check by question_key (most reliable)
        if (qKey === QUESTION_KEYS.FUNDING_SOURCE) {
          return true;
        }
        
        // Priority 2: Check by specific question_key variants
        if (qKey === 'how-will-your-stay-be-funded') {
          return true;
        }
        
        // Priority 3: Fallback to question text (for backward compatibility)
        if (questionText === 'How will your stay be funded?') {
          return true;
        }
        
        // Priority 4: Partial text match (most flexible)
        if (questionText && questionText.toLowerCase().includes('how will your stay be funded')) {
          return true;
        }
        
        return false;
      });
      
      if (funderQuestion && funderQuestion.fromQa && funderQuestion.answer) {
        funder = funderQuestion.answer;
      }
    }
  });

  return funder;
};

export const getCheckInOutAnswer = (qaPairs = []) => {
  if (qaPairs.length > 0) {
    const checkInAnswer = qaPairs.find(qa => qa.question == 'Check In Date')?.answer;
    const checkOutAnswer = qaPairs.find(qa => qa.question == 'Check Out Date')?.answer;
    if (checkInAnswer && checkOutAnswer) {
        return [ checkInAnswer, checkOutAnswer ];
    }
  }

  return null;
}

export const validatePhoneNumber = (val) => {
  if (!val) return false;
  const validPhoneNumber = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/;
  return String(val || '').match(validPhoneNumber);
}

export const validateEmail = (val) => {
    if (!val) return false;
    const validEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    return val.match(validEmail);
}


export const isJsonString = (str) => {
  try {
    JSON.parse(str);
  } catch (e) {
    return false;
  }
  return true;
}

// Add this helper function near the top of the component (after the field type arrays)
export const stripHtmlIfPlainText = (html) => {
    if (!html) return '';
    
    // Check if the HTML only contains paragraph tags with no formatting
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    
    // Get the text content
    const textContent = tempDiv.textContent || tempDiv.innerText || '';
    
    // Check if the HTML is just a simple paragraph wrap with no other formatting
    const isSimpleParagraph = /^<p>(.*?)<\/p>$/i.test(html.trim()) && 
                              !/<[^>]+(style|class|strong|em|u|br|span|div|ul|ol|li|h[1-6])/i.test(html);
    
    // If it's just plain text wrapped in a single <p> tag, return the text content
    if (isSimpleParagraph) {
        return textContent;
    }
    
    // Otherwise, keep the HTML formatting
    return html;
};

export const ensureArrayAnswer = (answer, questionType) => {
    // Question types that should have array answers
    const arrayTypes = [
        'multi-select', 
        'checkbox', 
        'checkbox-button',
        'service-cards',
        'service-cards-multi'
    ];
    
    if (!arrayTypes.includes(questionType)) {
        return answer;
    }
    
    // If answer is null/undefined, return empty array
    if (answer === null || answer === undefined) {
        return [];
    }
    
    // If already an array, return as-is
    if (Array.isArray(answer)) {
        return answer;
    }
    
    // If it's a string that looks like JSON, try to parse it
    if (typeof answer === 'string') {
        if (answer.startsWith('[') || answer.startsWith('{')) {
            try {
                const parsed = JSON.parse(answer);
                return Array.isArray(parsed) ? parsed : [];
            } catch (e) {
                console.warn('Failed to parse answer as JSON:', answer);
                return [];
            }
        }
        // If it's just a plain string, wrap it in an array
        return answer ? [answer] : [];
    }
    
    // For objects, return as-is (might be service-cards format)
    if (typeof answer === 'object') {
        return answer;
    }
    
    // Default: empty array
    return [];
};

/**
 * Check if a booking is actually cancelled (not just requested)
 * @param {Object|string} status - The booking status object or JSON string
 * @returns {boolean}
 */
export const isBookingCancelled = (status) => {
  try {
    const statusObj = typeof status === 'string' ? JSON.parse(status) : status;
    
    // Only return true for ACTUAL cancellation statuses, not "cancellation_requested"
    return statusObj && (
      statusObj.name === 'booking_cancelled' || 
      statusObj.name === 'guest_cancelled'
    );
  } catch (error) {
    console.error('Error parsing booking status:', error);
    return false;
  }
};

/**
 * Get the cancellation type (Full Charge or No Charge) for a cancelled booking
 * Priority order:
 * 1. Check booking.cancellation_type field (new permanent record)
 * 2. Check BookingApprovalUsage records (fallback for old bookings)
 * @param {Object} booking - The booking object
 * @returns {string|null} - 'Full Charge', 'No Charge', or null
 */
export const getCancellationType = (booking) => {
  try {
    // First check if booking status is actually cancelled (not just requested)
    if (!booking || !booking.status) {
      return null;
    }
    
    const statusObj = typeof booking.status === 'string' 
      ? JSON.parse(booking.status) 
      : booking.status;
    
    // Only proceed if booking is actually cancelled
    if (statusObj.name !== 'booking_cancelled' && statusObj.name !== 'guest_cancelled') {
      return null;
    }
    
    // ✅ PRIORITY 1: Check the cancellation_type field (most reliable - permanent record)
    if (booking.cancellation_type) {
      return booking.cancellation_type === 'full_charge' ? 'Full Charge' : 'No Charge';
    }
    
    // ✅ PRIORITY 2: Fallback to BookingApprovalUsage records (for old bookings before field was added)
    if (booking.approvalUsages && booking.approvalUsages.length > 0) {
      // Check the status of the usage records
      // 'cancelled' status = No Charge (nights returned)
      // 'charged' status = Full Charge (nights kept as penalty)
      const hasCancelledUsage = booking.approvalUsages.some(
        usage => usage.status === 'cancelled'
      );
      const hasChargedUsage = booking.approvalUsages.some(
        usage => usage.status === 'charged'
      );
      
      // Determine cancellation type based on usage records
      if (hasChargedUsage) {
        return 'Full Charge';
      } else if (hasCancelledUsage) {
        return 'No Charge';
      }
    }
    
    // ✅ If booking is cancelled but we can't determine type (e.g., NDIS booking without the new field)
    // Return null - this will hide the badge rather than showing incorrect info
    return null;
    
  } catch (error) {
    console.error('Error determining cancellation type:', error);
    return null;
  }
};

export /**
 * Helper to parse and clean sci_type_level from database
 * Handles: "\"C7\"" -> ['C7'], "C5,T12" -> ['C5', 'T12'], ['C7'] -> ['C7']
 */
const parseSciTypeLevel = (value) => {
  if (!value) return [];
  
  // Already an array
  if (Array.isArray(value)) {
    return value.map(v => String(v).trim()).filter(Boolean);
  }
  
  // String value - needs parsing
  if (typeof value === 'string') {
    try {
      // Try JSON parsing first (handles "\"C7\"" or "[\"C7\"]")
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.map(v => String(v).trim()).filter(Boolean);
      }
      return [String(parsed).trim()].filter(Boolean);
    } catch {
      // Not valid JSON - clean quotes manually and split by comma
      const cleaned = value
        .replace(/^["'\s]+|["'\s]+$/g, '') // Remove outer quotes/whitespace
        .replace(/\\"/g, '"')               // Unescape quotes
        .replace(/^["']|["']$/g, '');       // Remove quotes again
      
      return cleaned
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean);
    }
  }
  
  return [];
};

export const isCheckInDatePassed = (booking) => {
    if (!booking.preferred_arrival_date) return false;
    return moment(booking.preferred_arrival_date).isSameOrBefore(moment(), 'day');
};

export const isBookingInPast = (booking) => {
    // Use check_out_date first, fallback to preferred_departure_date
    const checkoutDate = booking.check_out_date || booking.preferred_departure_date;
    
    if (!checkoutDate) {
        console.log('⚠️ No checkout date found for booking');
        return false; // If no date, allow amendments
    }
    
    return moment(checkoutDate).isBefore(moment(), 'day');
};

export const canEditBooking = (booking) => {
    const bookingInPast = isBookingInPast(booking);
    const status = JSON.parse(booking.status);
    const isCancelled = status.name === 'booking_cancelled' || status.name === 'guest_cancelled';
    
    // Can edit if:
    // 1. Not cancelled AND
    // 2. Not in the past (guests cannot edit past bookings)
    return !isCancelled && !bookingInPast;
};

export const stripSimpleParagraphTags = (text) => {
    if (!text) return text;
    // Remove wrapping <p>...</p> only if those are the sole HTML tags present
    const stripped = text.replace(/^<p>\s*/i, '').replace(/\s*<\/p>$/i, '').trim();
    if (!/<[a-z][\s\S]*>/i.test(stripped)) {
        return stripped;
    }
    return text; // Has other HTML — leave it untouched
};