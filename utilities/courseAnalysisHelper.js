import { findByQuestionKey, QUESTION_KEYS } from '../services/booking/question-helper';

/**
 * Extract course information from booking form data
 * STRICT analysis - only checks specific course question keys
 * @param {Array} allQAPairs - All Q&A pairs from the entire booking form
 * @param {Object} formData - Additional form data
 * @returns {Object} Course analysis result
 */
export function extractCourseInformation(allQAPairs = [], formData = {}) {
  const courseAnalysis = {
    hasCourse: false,
    courseId: null,
    courseName: null,
    courseOffered: false,
    courseOfferAnswer: null,
    whichCourseAnswer: null,
    rawData: {
      allQAPairs: allQAPairs?.length || 0,
      courseRelatedQA: [],
      strategiesUsed: ['strict-question-key-only'],
      foundBy: null
    }
  };

  try {
    // ✅ STRICT STRATEGY: Only look for specific question keys
    console.log('🎓 Starting STRICT course analysis (question key only)...');
    
    let courseOfferQA = null;
    let whichCourseQA = null;
    
    // Search for the EXACT course offer question
    for (const qa of allQAPairs) {
      const questionKey = qa.question_key || qa.Question?.question_key;
      if (questionKey === 'have-you-been-offered-a-place-in-a-course-for-this-stay') {
        courseOfferQA = qa;
        console.log('✅ Found course offer question:', questionKey, '→', qa.answer);
        courseAnalysis.rawData.foundBy = `course-offer-key`;
        break;
      }
    }
    
    // Search for the EXACT which course question with option_type check
    for (const qa of allQAPairs) {
      const questionKey = qa.question_key || qa.Question?.question_key;
      const optionType = qa.option_type || qa.Question?.option_type;
      
      if (questionKey === 'which-course' && optionType === 'course') {
        whichCourseQA = qa;
        console.log('✅ Found which course question:', questionKey, '→', qa.answer);
        if (!courseAnalysis.rawData.foundBy) {
          courseAnalysis.rawData.foundBy = `which-course-key`;
        }
        break;
      }
    }

    // Process course offer answer - MUST be "Yes"
    if (courseOfferQA) {
      courseAnalysis.courseOfferAnswer = courseOfferQA.answer;
      const answerStr = safeAnswerToLowerCase(courseOfferQA.answer);
      courseAnalysis.courseOffered = answerStr === 'yes';
      console.log('📋 Course offer answer:', courseOfferQA.answer, '→ offered:', courseAnalysis.courseOffered);
    }

    // Process which course answer - MUST have valid content
    if (whichCourseQA) {
      courseAnalysis.whichCourseAnswer = whichCourseQA.answer;
      
      // Check if the answer indicates a real course selection
      if (hasAnswerContent(whichCourseQA.answer)) {
        const answerStr = safeAnswerToLowerCase(whichCourseQA.answer);
        
        // Make sure it's not a negative answer
        if (answerStr !== 'no' && answerStr !== 'none' && answerStr !== 'false') {
          courseAnalysis.courseId = safeAnswerToString(whichCourseQA.answer);
          courseAnalysis.hasCourse = true;
          console.log('✅ Valid course selection found:', whichCourseQA.answer);
        }
      }
    }

    // ✅ CRITICAL: hasCourse should ONLY be true if BOTH conditions are met:
    // 1. Course offer question answered "Yes"
    // 2. Which course question has a valid answer
    if (courseAnalysis.courseOffered && courseAnalysis.courseId) {
      courseAnalysis.hasCourse = true;
      console.log('✅ Both course conditions met - hasCourse = true');
    } else {
      courseAnalysis.hasCourse = false;
      console.log('❌ Course conditions not fully met:', {
        courseOffered: courseAnalysis.courseOffered,
        hasCourseId: !!courseAnalysis.courseId
      });
    }

    // Validate course ID if present
    if (courseAnalysis.courseId) {
      const validCourseId = safeAnswerToString(courseAnalysis.courseId).trim();
      if (validCourseId && validCourseId !== '0' && !isNegativeAnswer(validCourseId)) {
        courseAnalysis.courseId = validCourseId;
      } else {
        courseAnalysis.courseId = null;
        courseAnalysis.hasCourse = false;
      }
    }

    // Final logging
    console.log('🎓 STRICT Course analysis complete:', {
      hasCourse: courseAnalysis.hasCourse,
      courseId: courseAnalysis.courseId,
      courseOffered: courseAnalysis.courseOffered,
      courseOfferAnswer: courseAnalysis.courseOfferAnswer,
      whichCourseAnswer: courseAnalysis.whichCourseAnswer,
      foundBy: courseAnalysis.rawData.foundBy
    });

    return courseAnalysis;

  } catch (error) {
    console.error('❌ Error in course analysis:', error);
    return {
      ...courseAnalysis,
      error: error.message,
      hasCourse: false,
      rawData: {
        ...courseAnalysis.rawData,
        error: error.message
      }
    };
  }
}

/**
 * Create a course filter criteria object for package filtering
 * @param {Object} courseAnalysis - Result from extractCourseInformation
 * @returns {Object} Filter criteria for packages
 */
export function createCourseFilterCriteria(courseAnalysis) {
  return {
    has_course: courseAnalysis.hasCourse || false,
    course_id: courseAnalysis.courseId,
    course_offered: courseAnalysis.courseOffered || false,
    course_confidence: courseAnalysis.rawData?.foundBy || 'none'
  };
}

/**
 * Helper function to get course analysis from various data sources
 * This is the main function that should be called from components
 * @param {Object} options - Various data sources
 * @returns {Object} Course analysis result
 */
export function analyzeCourseFromBookingData({
  qaData = [],           // Current page QA data
  allBookingData = null, // Complete booking data with all sections
  formData = {},         // Form data object
  allQAPairs = []        // Pre-collected all QA pairs
} = {}) {
  
  console.log('🎓 Analyzing course from booking data (STRICT mode)...');
  
  // Collect all available QA pairs from different sources
  let collectedQAPairs = [...(allQAPairs || [])];
  
  // Add current page QA data
  if (qaData && qaData.length > 0) {
    collectedQAPairs.push(...qaData);
  }
  
  // Extract from allBookingData if available
  if (allBookingData && allBookingData.sections) {
    for (const section of allBookingData.sections) {
      if (section.QaPairs && Array.isArray(section.QaPairs)) {
        collectedQAPairs.push(...section.QaPairs);
      }
      
      // Also check Questions array for current answers
      if (section.Questions && Array.isArray(section.Questions)) {
        const answeredQuestions = section.Questions.filter(q => 
          hasAnswerContent(q.answer)
        ).map(q => ({
          question: q.question,
          answer: q.answer,
          question_key: q.question_key,
          option_type: q.option_type, // ✅ Include option_type
          Question: { 
            question_key: q.question_key,
            option_type: q.option_type
          }
        }));
        
        if (answeredQuestions.length > 0) {
          collectedQAPairs.push(...answeredQuestions);
        }
      }
    }
  }
  
  // Extract from formData structure variations
  if (formData) {
    if (formData.sections && Array.isArray(formData.sections)) {
      for (const section of formData.sections) {
        if (section.QaPairs && Array.isArray(section.QaPairs)) {
          collectedQAPairs.push(...section.QaPairs);
        }
        
        // Also check Questions array
        if (section.Questions && Array.isArray(section.Questions)) {
          const answeredQuestions = section.Questions.filter(q => 
            hasAnswerContent(q.answer)
          ).map(q => ({
            question: q.question,
            answer: q.answer,
            question_key: q.question_key,
            option_type: q.option_type, // ✅ Include option_type
            Question: { 
              question_key: q.question_key,
              option_type: q.option_type
            }
          }));
          
          if (answeredQuestions.length > 0) {
            collectedQAPairs.push(...answeredQuestions);
          }
        }
      }
    }
    
    if (formData.booking && formData.booking.sections) {
      for (const section of formData.booking.sections) {
        if (section.QaPairs && Array.isArray(section.QaPairs)) {
          collectedQAPairs.push(...section.QaPairs);
        }
      }
    }
  }
  
  // Remove duplicates based on question_key
  const uniqueQAPairs = collectedQAPairs.filter((qa, index, self) => {
    const isDuplicate = self.findIndex(q => {
      // Check by question_key
      if (qa.question_key && q.question_key) {
        return q.question_key === qa.question_key;
      }
      // Fallback to question text if no question_key
      if (qa.question && q.question) {
        return q.question === qa.question;
      }
      return false;
    }) !== index;
    
    return !isDuplicate;
  });
  
  console.log(`📊 Collected ${uniqueQAPairs.length} unique QA pairs for STRICT course analysis`);
  
  return extractCourseInformation(uniqueQAPairs, formData);
}

/**
 * Safely convert any answer value to a string for text processing
 * @param {*} answer - The answer value (can be string, null, undefined, array, object, number, boolean)
 * @returns {string} - Safe string representation
 */
function safeAnswerToString(answer) {
  if (answer === null || answer === undefined) {
    return '';
  }
  
  if (typeof answer === 'string') {
    return answer;
  }
  
  if (typeof answer === 'number' || typeof answer === 'boolean') {
    return String(answer);
  }
  
  if (Array.isArray(answer)) {
    return answer.length === 1 ? String(answer[0] || '') : answer.join(', ');
  }
  
  if (typeof answer === 'object') {
    if (answer.value !== undefined) return String(answer.value);
    if (answer.text !== undefined) return String(answer.text);
    if (answer.label !== undefined) return String(answer.label);
    if (answer.name !== undefined) return String(answer.name);
    
    const keys = Object.keys(answer);
    if (keys.length === 1) {
      return String(answer[keys[0]] || '');
    }
    
    try {
      return JSON.stringify(answer).replace(/[{}"\[\]]/g, '').replace(/[:,]/g, ' ').trim();
    } catch {
      return '';
    }
  }
  
  return String(answer);
}

/**
 * Safely get lowercase string from answer for comparison
 * @param {*} answer - The answer value
 * @returns {string} - Lowercase string
 */
function safeAnswerToLowerCase(answer) {
  return safeAnswerToString(answer).toLowerCase();
}

/**
 * Check if an answer represents a negative/no response
 * @param {*} answer - The answer value
 * @returns {boolean} - True if answer indicates no/negative
 */
function isNegativeAnswer(answer) {
  const answerStr = safeAnswerToLowerCase(answer);
  return ['no', 'false', '0', 'none', 'null', ''].includes(answerStr);
}

/**
 * Check if answer has meaningful content (not empty, null, or negative)
 * @param {*} answer - The answer value
 * @returns {boolean} - True if answer has content
 */
function hasAnswerContent(answer) {
  const answerStr = safeAnswerToString(answer).trim();
  return answerStr !== '' && 
         answerStr !== '0' && 
         !isNegativeAnswer(answer);
}