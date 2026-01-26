import moment from 'moment';
import { QUESTION_KEYS } from '../services/booking/question-helper';


export const getFirstLetters = (str, delimiter = '-') => {
    if (str && typeof str === 'string') {
        // Split the string into words
        const words = str.split(delimiter);

        // Initialize an empty string to store the first letters
        let firstLetters = "";

        // Iterate through each word
        words.forEach(word => {
        // Extract the first letter of each word and concatenate it to the result
            firstLetters += word.charAt(0);
        });

        // Return the concatenated first letters
        return firstLetters.toUpperCase();
    }

    return str;
  }

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
    const validPhoneNumber = /^\(?(\d{3})\)?[- ]?(\d{3})[- ]?(\d{2,4})$/;
    return val.match(validPhoneNumber);
}

export const validateEmail = (val) => {
      const validEmail = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
      return val.match(validEmail);
}

/**
 * Get cancellation type from booking data
 * @param {Object} booking - The booking object with approvalUsages
 * @returns {string|null} - 'Full Charge', 'No Charge', or null
 */
export const getCancellationType = (booking) => {
  // If the API already provides it
  if (booking?.cancellationType) {
    return booking.cancellationType;
  }
  
  // Otherwise calculate it from approvalUsages
  if (!booking?.approvalUsages || booking.approvalUsages.length === 0) {
    return null; // No usage records (old bookings or not cancelled)
  }
  
  const usageStatuses = booking.approvalUsages.map(u => u.status);
  
  if (usageStatuses.includes('charged')) {
    return 'Full Charge';
  } else if (usageStatuses.includes('cancelled')) {
    return 'No Charge';
  }
  
  return null;
};

/**
 * Check if booking is cancelled
 * @param {Object} status - The booking status object
 * @returns {boolean}
 */
export const isBookingCancelled = (status) => {
  if (!status) return false;
  if (isJsonString(status)) {
    status = JSON.parse(status);
  }
  return status.name === 'booking_cancelled' || status.name === 'guest_cancelled';
};

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