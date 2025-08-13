import { findByQuestionKey, QUESTION_KEYS } from '../services/booking/question-helper';

/**
 * Extract course information from booking form data
 * Comprehensive analysis using multiple strategies to detect course participation
 * @param {Array} allQAPairs - All Q&A pairs from the entire booking form
 * @param {Object} formData - Additional form data
 * @returns {Object} Course analysis result
 */
export function extractCourseInformation(allQAPairs = [], formData = {}) {
  console.log('🎓 Starting comprehensive course analysis...');
  console.log('📊 Input data:', {
    qaPairsCount: allQAPairs?.length || 0,
    formDataKeys: Object.keys(formData || {}),
    allQADetails: allQAPairs?.map(qa => ({
      question: qa.question?.substring(0, 60) + '...',
      question_key: qa.question_key,
      answer: qa.answer,
      hasAnswer: !!qa.answer,
      hasQuestionObject: !!qa.Question
    }))
  });

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
      strategiesUsed: [],
      foundBy: null
    }
  };

  try {
    // Strategy 1: Look for specific question keys with multiple variations
    // console.log('🔍 Strategy 1: Looking for course questions by question key...');
    courseAnalysis.rawData.strategiesUsed.push('question-key-matching');
    
    let courseOfferQA = null;
    let whichCourseQA = null;
    
    // Extended list of possible question keys for course offer
    const courseOfferKeys = [
      'have-you-been-offered-a-place-in-a-course-for-this-stay',
      'course-offer',
      'course-participation',
      'offered-course',
      'course-offer-question',
      'have-you-been-offered-a-course'
    ];
    
    // Extended list of possible question keys for which course
    const whichCourseKeys = [
      'which-course',
      'course-selection',
      'selected-course',
      'course-name',
      'course-type',
      'what-course'
    ];
    
    // Search for course offer question
    for (const qa of allQAPairs) {
      const questionKey = qa.question_key || qa.Question?.question_key;
      if (questionKey && courseOfferKeys.includes(questionKey)) {
        courseOfferQA = qa;
        console.log('✅ Found course offer question by key:', questionKey, '→', qa.answer);
        courseAnalysis.rawData.foundBy = `question-key: ${questionKey}`;
        break;
      }
    }
    
    // Search for which course question
    for (const qa of allQAPairs) {
      const questionKey = qa.question_key || qa.Question?.question_key;
      if (questionKey && whichCourseKeys.includes(questionKey)) {
        whichCourseQA = qa;
        console.log('✅ Found which course question by key:', questionKey, '→', qa.answer);
        if (!courseAnalysis.rawData.foundBy) {
          courseAnalysis.rawData.foundBy = `question-key: ${questionKey}`;
        }
        break;
      }
    }

    // Process course offer answer
    if (courseOfferQA) {
      courseAnalysis.courseOfferAnswer = courseOfferQA.answer;
      const answer = courseOfferQA.answer?.toLowerCase() || '';
      courseAnalysis.courseOffered = answer.includes('yes') || answer.includes('true');
      console.log('✅ Processed course offer answer:', courseOfferQA.answer, '→ offered:', courseAnalysis.courseOffered);
    }

    // Process which course answer
    if (whichCourseQA) {
      courseAnalysis.whichCourseAnswer = whichCourseQA.answer;
      // Check if the answer indicates a real course selection
      if (whichCourseQA.answer && 
          whichCourseQA.answer !== '' && 
          whichCourseQA.answer !== '0' &&
          whichCourseQA.answer?.toLowerCase() !== 'no' &&
          whichCourseQA.answer?.toLowerCase() !== 'none' &&
          whichCourseQA.answer !== 'false') {
        
        courseAnalysis.courseId = whichCourseQA.answer;
        courseAnalysis.hasCourse = true;
        console.log('✅ Valid course selection found:', whichCourseQA.answer);
      }
    }

    // Strategy 2: Text pattern matching for course-related questions
    if (!courseAnalysis.hasCourse && allQAPairs && allQAPairs.length > 0) {
      // console.log('🔍 Strategy 2: Text pattern matching for course-related questions...');
      courseAnalysis.rawData.strategiesUsed.push('text-pattern-matching');
      
      const courseRelatedQA = allQAPairs.filter(qa => {
        const questionText = qa.question?.toLowerCase() || '';
        const hasAnswer = qa.answer && qa.answer !== '' && qa.answer !== '0';
        const isCourseRelated = questionText.includes('course') || 
                               questionText.includes('training') ||
                               questionText.includes('program') ||
                               questionText.includes('education');
        return isCourseRelated && hasAnswer;
      });

      courseAnalysis.rawData.courseRelatedQA = courseRelatedQA.map(qa => ({
        question: qa.question,
        answer: qa.answer,
        question_key: qa.question_key || qa.Question?.question_key,
        source: 'text-pattern'
      }));

      console.log('🎓 Found course-related Q&A pairs by text:', courseAnalysis.rawData.courseRelatedQA.length);

      // Look for course offer in text patterns if not found by key
      if (!courseAnalysis.courseOffered && !courseOfferQA) {
        const offerPatterns = ['offered', 'place', 'participate', 'enroll', 'join'];
        const offerQA = courseRelatedQA.find(qa => {
          const questionText = qa.question?.toLowerCase() || '';
          const hasOfferPattern = offerPatterns.some(pattern => questionText.includes(pattern));
          const hasPositiveAnswer = qa.answer?.toLowerCase().includes('yes');
          return hasOfferPattern && hasPositiveAnswer;
        });

        if (offerQA) {
          courseAnalysis.courseOfferAnswer = offerQA.answer;
          courseAnalysis.courseOffered = true;
          courseAnalysis.rawData.foundBy = 'text-pattern: course offer';
          console.log('✅ Found course offer by text pattern:', offerQA.question?.substring(0, 50), '→', offerQA.answer);
        }
      }

      // Look for course selection in text patterns if not found by key
      if (!courseAnalysis.hasCourse && !whichCourseQA) {
        const selectionPatterns = ['which', 'what', 'select', 'choose', 'type of'];
        const selectionQA = courseRelatedQA.find(qa => {
          const questionText = qa.question?.toLowerCase() || '';
          const hasSelectionPattern = selectionPatterns.some(pattern => questionText.includes(pattern));
          const hasValidAnswer = qa.answer && 
                                qa.answer !== '' && 
                                qa.answer !== '0' &&
                                qa.answer?.toLowerCase() !== 'no' &&
                                qa.answer?.toLowerCase() !== 'none';
          return hasSelectionPattern && hasValidAnswer;
        });

        if (selectionQA) {
          courseAnalysis.whichCourseAnswer = selectionQA.answer;
          courseAnalysis.courseId = selectionQA.answer;
          courseAnalysis.hasCourse = true;
          courseAnalysis.rawData.foundBy = 'text-pattern: course selection';
          console.log('✅ Found course selection by text pattern:', selectionQA.question?.substring(0, 50), '→', selectionQA.answer);
        }
      }
    }

    // Strategy 3: Check formData for explicit course information
    if (!courseAnalysis.hasCourse && formData) {
      // console.log('📋 Strategy 3: Checking formData for course information...');
      courseAnalysis.rawData.strategiesUsed.push('formdata-checking');
      
      // Check for explicit course properties
      if (formData.courseId || formData.selectedCourse) {
        courseAnalysis.courseId = formData.courseId || formData.selectedCourse;
        courseAnalysis.hasCourse = true;
        courseAnalysis.rawData.foundBy = 'formData: courseId/selectedCourse';
        console.log('✅ Found course in formData:', courseAnalysis.courseId);
      }

      // Check for boolean flags
      if (formData.hasCourse === true || formData.courseOffered === true) {
        courseAnalysis.hasCourse = true;
        courseAnalysis.courseOffered = formData.courseOffered;
        courseAnalysis.rawData.foundBy = 'formData: boolean flags';
        console.log('✅ Found course flags in formData');
      }

      // Check nested structures
      if (formData.booking && formData.booking.course) {
        courseAnalysis.courseId = formData.booking.course;
        courseAnalysis.hasCourse = true;
        courseAnalysis.rawData.foundBy = 'formData: booking.course';
        console.log('✅ Found course in formData.booking');
      }
    }

    // Strategy 4: Expanded keyword search with confidence scoring
    if (!courseAnalysis.hasCourse && allQAPairs && allQAPairs.length > 0) {
      // console.log('🔍 Strategy 4: Expanded keyword search with confidence scoring...');
      courseAnalysis.rawData.strategiesUsed.push('expanded-keyword-search');
      
      const expandedKeywords = [
        'course', 'training', 'program', 'education', 'workshop', 
        'seminar', 'class', 'lesson', 'curriculum', 'module'
      ];
      
      const expandedCourseSearch = allQAPairs.filter(qa => {
        const questionText = qa?.question?.toLowerCase() || '';
        const answerText = qa?.answer?.toLowerCase() || '';
        
        const hasKeyword = expandedKeywords.some(keyword => 
          questionText.includes(keyword) || answerText.includes(keyword)
        );
        
        return hasKeyword && qa.answer && qa.answer !== '';
      });
      
      // console.log('🔍 Expanded search found:', expandedCourseSearch.length, 'potential matches');
      
      // Score potential matches
      const scoredMatches = expandedCourseSearch.map(qa => {
        let confidence = 0;
        const questionText = qa.question?.toLowerCase() || '';
        const answerText = qa.answer?.toLowerCase() || '';
        
        // High confidence indicators
        if (questionText.includes('course') && questionText.includes('offered')) confidence += 10;
        if (questionText.includes('which course')) confidence += 10;
        if (answerText.includes('yes')) confidence += 5;
        if (qa.question_key && qa.question_key.includes('course')) confidence += 8;
        
        // Medium confidence indicators
        if (questionText.includes('course')) confidence += 3;
        if (questionText.includes('training') || questionText.includes('program')) confidence += 2;
        
        // Answer validation
        if (answerText !== 'no' && answerText !== 'none' && answerText !== '') confidence += 1;
        
        return { ...qa, confidence };
      });
      
      // Sort by confidence and take the best matches
      const bestMatches = scoredMatches
        .filter(match => match.confidence >= 5)
        .sort((a, b) => b.confidence - a.confidence);
      
      // console.log('🏆 Best confidence matches:', bestMatches.map(m => ({
      //   question: m.question?.substring(0, 50) + '...',
      //   answer: m.answer,
      //   confidence: m.confidence
      // })));
      
      if (bestMatches.length > 0) {
        const bestMatch = bestMatches[0];
        courseAnalysis.hasCourse = true;
        courseAnalysis.courseOffered = true;
        courseAnalysis.courseOfferAnswer = bestMatch.answer;
        courseAnalysis.rawData.foundBy = `expanded-search: confidence-${bestMatch.confidence}`;
        // console.log('✅ High-confidence course match found:', bestMatch.question?.substring(0, 60));
      }
    }

    // Strategy 5: Fallback - Check for any mention of courses in answers
    if (!courseAnalysis.hasCourse && allQAPairs && allQAPairs.length > 0) {
      // console.log('🔍 Strategy 5: Fallback - checking all answers for course mentions...');
      courseAnalysis.rawData.strategiesUsed.push('answer-mention-fallback');
      
      const courseMentions = allQAPairs.filter(qa => {
        const answerText = qa.answer?.toLowerCase() || '';
        return answerText.includes('course') && 
               answerText !== 'no' && 
               answerText !== 'none' &&
               answerText.length > 3; // Avoid false positives from short answers
      });
      
      if (courseMentions.length > 0) {
        // console.log('📝 Found course mentions in answers:', courseMentions.length);
        
        // Look for substantial course mentions (not just the word "course")
        const substantialMentions = courseMentions.filter(qa => {
          const answerText = qa.answer?.toLowerCase() || '';
          return answerText.length > 10 && // Substantial answer
                 (answerText.includes('yes') || 
                  answerText.match(/course\s+\w+/) || // "course [something]"
                  answerText.includes('training') ||
                  answerText.includes('program'));
        });
        
        if (substantialMentions.length > 0) {
          courseAnalysis.hasCourse = true;
          courseAnalysis.courseOffered = true;
          courseAnalysis.rawData.foundBy = 'answer-mentions: substantial';
          // console.log('✅ Substantial course mentions found');
        }
      }
    }

    // Final determination and validation
    if (courseAnalysis.courseOffered || courseAnalysis.courseId) {
      courseAnalysis.hasCourse = true;
    }

    // Validate course ID if present
    if (courseAnalysis.courseId) {
      const validCourseId = courseAnalysis.courseId.toString().trim();
      if (validCourseId && validCourseId !== '0' && validCourseId?.toLowerCase() !== 'no') {
        courseAnalysis.courseId = validCourseId;
        courseAnalysis.hasCourse = true;
      } else {
        courseAnalysis.courseId = null;
      }
    }

    // Final logging
    console.log('🎓 Course analysis complete:', {
      hasCourse: courseAnalysis.hasCourse,
      courseId: courseAnalysis.courseId,
      courseOffered: courseAnalysis.courseOffered,
      courseOfferAnswer: courseAnalysis.courseOfferAnswer,
      whichCourseAnswer: courseAnalysis.whichCourseAnswer,
      totalQAProcessed: allQAPairs?.length || 0,
      courseRelatedFound: courseAnalysis.rawData.courseRelatedQA.length,
      strategiesUsed: courseAnalysis.rawData.strategiesUsed,
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
  
  console.log('🎓 Analyzing course from booking data...');
  console.log('📊 Input sources:', {
    qaDataLength: qaData?.length || 0,
    allBookingDataSections: allBookingData?.sections?.length || 0,
    formDataKeys: Object.keys(formData || {}),
    preCollectedQAPairs: allQAPairs?.length || 0
  });
  
  // Collect all available QA pairs from different sources
  let collectedQAPairs = [...(allQAPairs || [])];
  
  // Add current page QA data
  if (qaData && qaData.length > 0) {
    // console.log('📊 Adding current page QA data:', qaData.length);
    collectedQAPairs.push(...qaData);
  }
  
  // Extract from allBookingData if available
  if (allBookingData && allBookingData.sections) {
    // console.log('📊 Extracting from allBookingData sections:', allBookingData.sections.length);
    for (const section of allBookingData.sections) {
      if (section.QaPairs && Array.isArray(section.QaPairs)) {
        // console.log(`📂 Adding ${section.QaPairs.length} QA pairs from section`);
        collectedQAPairs.push(...section.QaPairs);
      }
      // Also check Questions array for current answers
      if (section.Questions && Array.isArray(section.Questions)) {
        const answeredQuestions = section.Questions.filter(q => 
          q.answer !== null && q.answer !== undefined && q.answer !== ''
        ).map(q => ({
          question: q.question,
          answer: q.answer,
          question_key: q.question_key,
          Question: { question_key: q.question_key }
        }));
        
        if (answeredQuestions.length > 0) {
          // console.log(`📂 Adding ${answeredQuestions.length} answered questions from section`);
          collectedQAPairs.push(...answeredQuestions);
        }
      }
    }
  }
  
  // Extract from formData structure variations
  if (formData) {
    if (formData.sections && Array.isArray(formData.sections)) {
      // console.log('📊 Extracting from formData sections:', formData.sections.length);
      for (const section of formData.sections) {
        if (section.QaPairs && Array.isArray(section.QaPairs)) {
          // console.log(`📂 Adding ${section.QaPairs.length} QA pairs from formData section`);
          collectedQAPairs.push(...section.QaPairs);
        }
        
        // Also check Questions array
        if (section.Questions && Array.isArray(section.Questions)) {
          const answeredQuestions = section.Questions.filter(q => 
            q.answer !== null && q.answer !== undefined && q.answer !== ''
          ).map(q => ({
            question: q.question,
            answer: q.answer,
            question_key: q.question_key,
            Question: { question_key: q.question_key }
          }));
          
          if (answeredQuestions.length > 0) {
            // console.log(`📂 Adding ${answeredQuestions.length} answered questions from formData section`);
            collectedQAPairs.push(...answeredQuestions);
          }
        }
      }
    }
    
    if (formData.booking && formData.booking.sections) {
      // console.log('📊 Extracting from formData.booking sections:', formData.booking.sections.length);
      for (const section of formData.booking.sections) {
        if (section.QaPairs && Array.isArray(section.QaPairs)) {
          // console.log(`📂 Adding ${section.QaPairs.length} QA pairs from booking section`);
          collectedQAPairs.push(...section.QaPairs);
        }
      }
    }
  }
  
  // Remove duplicates based on question_key and question text
  const uniqueQAPairs = collectedQAPairs.filter((qa, index, self) => {
    const isDuplicate = self.findIndex(q => {
      // Check by question_key first
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
  
  // console.log(`📊 Collected ${uniqueQAPairs.length} unique QA pairs from ${collectedQAPairs.length} total`);
  // console.log('🔍 Sample of collected QA pairs:', uniqueQAPairs.slice(0, 5).map(qa => ({
  //   question: qa.question?.substring(0, 60) + '...',
  //   question_key: qa.question_key,
  //   answer: qa.answer,
  //   hasAnswer: !!qa.answer
  // })));
  
  return extractCourseInformation(uniqueQAPairs, formData);
}