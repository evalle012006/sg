/**
 * Generate question key from question text using the same logic as populate-question-keys.js
 * @param {string} questionText - The question text
 * @returns {string} - Generated question key
 */
function generateQuestionKey(questionText) {
    if (!questionText || typeof questionText !== 'string') {
        return null;
    }

    let baseKey = questionText
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-+|-+$/g, '');

    if (baseKey.length > 100) {
        baseKey = baseKey.substring(0, 100).replace(/-[^-]*$/, '');
    }

    if (!baseKey) {
        baseKey = 'question';
    }

    return baseKey;
}

/**
 * Question key mappings for commonly used questions
 * Generated using the same logic as populate-question-keys.js
 */
const QUESTION_KEYS = {
    // Room and accommodation
    ROOM_SELECTION: 'room-selection',
    CHECK_IN_OUT_DATE: 'check-in-date-and-check-out-date',
    CHECK_IN_DATE: 'check-in-date',
    CHECK_OUT_DATE: 'check-out-date',
    LATE_ARRIVAL: 'do-you-need-to-check-in-after-5pm',
    ARRIVAL_TIME: 'expected-arrival-time-check-in-is-from-2pm',
    
    // Guest information
    INFANTS_COUNT: 'number-of-infants-2-years-staying',
    CHILDREN_COUNT: 'number-of-children-under-the-age-of-16-staying',
    ADULTS_COUNT: 'number-of-guests-over-the-age-of-16-including-person-with-the-spinal-cord-injury',
    ASSISTANCE_ANIMAL: 'will-you-be-bringing-an-assistance-animal-with-you-on-your-stay',
    
    // File uploads
    ICARE_APPROVAL_UPLOAD: 'please-upload-a-copy-of-your-icare-approval-or-notice-of-assessment-for-your-stay-at-sargood',
    APPROVAL_LETTER_UPLOAD: 'upload-approval-letter',
    CARE_PLAN_UPLOAD: 'if-you-have-a-care-plan-you-can-upload-here',
    ASSISTANCE_ANIMAL_CERT_1: 'please-upload-assistance-animal-certificate',
    ASSISTANCE_ANIMAL_CERT_2: 'please-upload-your-assistance-animal-certificate-here',
    ASSISTANCE_ANIMAL_CERT_3: 'please-upload-your-assistance-animals-certificate-here',
    
    // Funding and coordinators
    FUNDING_SOURCE: 'how-will-your-stay-be-funded',
    NDIS_COORDINATOR_EMAIL: 'ndis-support-coordinator-email-address',
    NDIS_COORDINATOR_FIRST_NAME: 'ndis-support-coordinator-first-name',
    NDIS_COORDINATOR_LAST_NAME: 'ndis-support-coordinator-last-name',
    NDIS_PARTICIPANT_NUMBER: 'ndis-participant-number',
    ICARE_COORDINATOR_EMAIL: 'icare-coordinator-email-address',
    ICARE_COORDINATOR_FIRST_NAME: 'icare-coordinator-first-name',
    ICARE_COORDINATOR_LAST_NAME: 'icare-coordinator-last-name',
    ICARE_PARTICIPANT_NUMBER: 'icare-participant-number',
    PLAN_MANAGEMENT_EMAIL: 'plan-management-company-email-address',
    PLAN_MANAGEMENT_NAME: 'plan-management-company-name',
    
    // Packages and courses
    ACCOMMODATION_PACKAGE_COURSES: 'accommodation-package-options-for-sargood-courses-are',
    // FIXED: Updated to match actual database value
    ACCOMMODATION_PACKAGE_FULL: 'please-select-your-accommodation-and-assistance-package-below-by-selecting-a-package-type-you-are',
    COURSE_SELECTION: 'which-course',
    GOALS_ACHIEVE: 'what-goals-are-you-looking-to-achieve-by-staying-at-sargood-on-collaroy',
    
    // Health information
    HEALTH_CONDITIONS: 'do-any-of-the-following-relate-to-you',
    DATE_OF_BIRTH: 'date-of-birth',
    
    // Financial assistance
    FINANCIAL_ASSISTANCE_REASON: 'why-are-you-applying-for-financial-assistance',
    TRAVEL_GRANT_APPLICATION: 'after-reading-the-above-terms-and-conditions-would-you-like-to-apply-for-a-travel-grant',
    TRAVEL_GRANT_REASON: 'why-are-yo-applying-for-a-travel-grant',
    FUNDING_AMOUNT_TRAVEL: 'approx-how-much-funding-within-500-are-you-applying-for-and-how-will-you-be-using-it-for-your-travel-to-and-from-sargood-on-collaroy',
    
    // Clinical services
    CLINICAL_NURSE_EDUCATION: 'accessing-clinical-nurse-education',
    CLINICAL_NURSE_CONSULTATION: 'clinical-nurse-consultation-services',
    
    // Additional question keys discovered during full refactor
    EQUIPMENT_ACKNOWLEDGEMENT: 'acknowledgement',  // Special equipment type

    // NDIS-specific question keys for package filtering
    IS_STA_STATED_SUPPORT: 'is-sta-a-stated-support-in-your-plan',
    DO_YOU_LIVE_ALONE: 'do-you-live-alone',
    DO_YOU_LIVE_IN_SIL: 'do-you-live-in-supported-independent-living-sil',
    ARE_YOU_STAYING_WITH_INFORMAL_SUPPORTS: 'are-you-staying-with-any-informal-supports',
    
    IS_STA_STATED_SUPPORT_IN_PLAN: 'is-short-term-accommodation-including-respite-a-stated-support-in-your-plan',
    ARE_YOU_TRAVELLING_WITH_INFORMAL_SUPPORTS: 'are-you-travelling-with-any-informal-supports',

    COURSE_OFFER_QUESTION: ['have-you-been-offered-a-place-in-a-course-for-this-stay'],
};

/**
 * Helper function to check if a question has a specific key
 * @param {Object} question - Question object
 * @param {string} questionKey - The question key to check
 * @returns {boolean} - True if question has the key
 */
function questionHasKey(question, questionKey) {
    return question && question.question_key === questionKey;
}

/**
 * Find Q&A pair by question key
 * UPDATED: Now handles cases where qaPairs don't have nested Question objects
 * by generating question keys from the question text as fallback
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} questionKey - The question key to search for
 * @returns {Object|null} - Found Q&A pair or null
 */
function findByQuestionKey(qaPairs, questionKey) {
    if (!Array.isArray(qaPairs) || !questionKey) {
        return null;
    }
    
    // First, try to find by nested Question.question_key
    const foundByNestedKey = qaPairs.find(qa => qa.Question?.question_key === questionKey);
    if (foundByNestedKey) {
        return foundByNestedKey;
    }
    
    // Fallback: If no nested Question object exists, generate question key from question text
    const foundByGeneratedKey = qaPairs.find(qa => {
        // Skip if this qa already has a Question object (already checked above)
        if (qa.Question?.question_key) {
            return false;
        }
        
        // Generate question key from the question text and compare
        if (qa.question && typeof qa.question === 'string') {
            const generatedKey = generateQuestionKey(qa.question);
            return generatedKey === questionKey;
        }
        
        return false;
    });
    
    return foundByGeneratedKey || null;
}

/**
 * Find Q&A pair by question key with fallback to question text
 * Useful during migration period when some questions might not have keys yet
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} questionKey - The question key to search for
 * @param {string} fallbackQuestionText - Fallback question text if key not found
 * @returns {Object|null} - Found Q&A pair or null
 */
function findByQuestionKeyWithFallback(qaPairs, questionKey, fallbackQuestionText) {
    if (!Array.isArray(qaPairs)) {
        return null;
    }
    
    // Try to find by question key first
    let qa = findByQuestionKey(qaPairs, questionKey);
    
    // Fallback to question text if key not found and fallback text provided
    if (!qa && fallbackQuestionText) {
        qa = qaPairs.find(q => q.question === fallbackQuestionText) || null;
    }
    
    return qa;
}

/**
 * Get answer by question key
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} questionKey - The question key to search for
 * @returns {string|null} - Answer value or null
 */
function getAnswerByQuestionKey(qaPairs, questionKey) {
    const qa = findByQuestionKey(qaPairs, questionKey);
    return qa ? qa.answer : null;
}

/**
 * Get answer by question key with fallback
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} questionKey - The question key to search for
 * @param {string} fallbackQuestionText - Fallback question text if key not found
 * @returns {string|null} - Answer value or null
 */
function getAnswerByQuestionKeyWithFallback(qaPairs, questionKey, fallbackQuestionText) {
    const qa = findByQuestionKeyWithFallback(qaPairs, questionKey, fallbackQuestionText);
    return qa ? qa.answer : null;
}

/**
 * Check if question contains specific text (useful for partial matches)
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} searchText - Text to search for in question
 * @returns {Object|null} - Found Q&A pair or null
 */
function findByQuestionText(qaPairs, searchText) {
    if (!Array.isArray(qaPairs) || !searchText) {
        return null;
    }
    
    return qaPairs.find(qa => qa.question && qa.question.includes(searchText)) || null;
}

/**
 * Find multiple Q&A pairs by question keys
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {Array} questionKeys - Array of question keys to search for
 * @returns {Array} - Array of found Q&A pairs
 */
function findMultipleByQuestionKeys(qaPairs, questionKeys) {
    if (!Array.isArray(qaPairs) || !Array.isArray(questionKeys)) {
        return [];
    }
    
    return questionKeys
        .map(key => findByQuestionKey(qaPairs, key))
        .filter(qa => qa !== null);
}

/**
 * Map question text to question key (for legacy compatibility)
 * @param {string} questionText - The original question text
 * @returns {string|null} - Corresponding question key or null
 */
function mapQuestionTextToKey(questionText) {
    const questionToKeyMap = {
        'NDIS Support Coordinator Email Address': QUESTION_KEYS.NDIS_COORDINATOR_EMAIL,
        'icare Coordinator Email Address': QUESTION_KEYS.ICARE_COORDINATOR_EMAIL,
        'Plan Management Company Email Address': QUESTION_KEYS.PLAN_MANAGEMENT_EMAIL,
        'Room Selection': QUESTION_KEYS.ROOM_SELECTION,
        'Check In Date and Check Out Date': QUESTION_KEYS.CHECK_IN_OUT_DATE,
        'Check In Date': QUESTION_KEYS.CHECK_IN_DATE,
        'Check Out Date': QUESTION_KEYS.CHECK_OUT_DATE,
        'Do you need to check in after 5PM?': QUESTION_KEYS.LATE_ARRIVAL,
        'Expected Arrival Time (Check In is from 2pm)': QUESTION_KEYS.ARRIVAL_TIME,
        'Number of Infants < 2 years staying.': QUESTION_KEYS.INFANTS_COUNT,
        'Number of children under the age of 16 staying.': QUESTION_KEYS.CHILDREN_COUNT,
        'Number of guests over the age of 16 (including person with the spinal cord injury)': QUESTION_KEYS.ADULTS_COUNT,
        'Will you be bringing an assistance animal with you on your stay?': QUESTION_KEYS.ASSISTANCE_ANIMAL,
        'How will your stay be funded?': QUESTION_KEYS.FUNDING_SOURCE,
        'Which course?': QUESTION_KEYS.COURSE_SELECTION,
        'What goals are you looking to achieve by staying at Sargood on Collaroy?': QUESTION_KEYS.GOALS_ACHIEVE,
        'Accommodation package options for Sargood Courses are:': QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES,
        'Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.': QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL,
        'Do any of the following relate to you?': QUESTION_KEYS.HEALTH_CONDITIONS,
        'Date of Birth': QUESTION_KEYS.DATE_OF_BIRTH,
        'After reading the above terms and conditions would you like to apply for a Travel Grant?': QUESTION_KEYS.TRAVEL_GRANT_APPLICATION,
        'Why are you applying for financial assistance?': QUESTION_KEYS.FINANCIAL_ASSISTANCE_REASON
    };
    
    return questionToKeyMap[questionText] || null;
}

/**
 * Find Q&A pair by question text and convert to question key lookup
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} questionText - The original question text
 * @returns {Object|null} - Found Q&A pair or null
 */
function findByQuestionTextUsingKey(qaPairs, questionText) {
    const questionKey = mapQuestionTextToKey(questionText);
    if (questionKey) {
        return findByQuestionKey(qaPairs, questionKey);
    }
    // Fallback to text search if no key mapping exists
    return findByQuestionText(qaPairs, questionText);
}

/**
 * Get coordinator information by email question key
 * @param {Array} qaPairs - Array of Q&A pairs
 * @param {string} emailQuestionKey - Question key for email field
 * @returns {Object} - Coordinator information
 */
function getCoordinatorInfo(qaPairs, emailQuestionKey) {
    const coordinatorInfo = {
        email: null,
        name: null,
        participantNumber: null
    };
    
    if (emailQuestionKey === QUESTION_KEYS.NDIS_COORDINATOR_EMAIL) {
        coordinatorInfo.email = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.NDIS_COORDINATOR_EMAIL);
        const firstName = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.NDIS_COORDINATOR_FIRST_NAME);
        const lastName = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.NDIS_COORDINATOR_LAST_NAME);
        coordinatorInfo.name = firstName && lastName ? `${firstName} ${lastName}` : null;
        coordinatorInfo.participantNumber = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER);
    } else if (emailQuestionKey === QUESTION_KEYS.ICARE_COORDINATOR_EMAIL) {
        coordinatorInfo.email = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ICARE_COORDINATOR_EMAIL);
        const firstName = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ICARE_COORDINATOR_FIRST_NAME);
        const lastName = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ICARE_COORDINATOR_LAST_NAME);
        coordinatorInfo.name = firstName && lastName ? `${firstName} ${lastName}` : null;
        coordinatorInfo.participantNumber = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER);
    } else if (emailQuestionKey === QUESTION_KEYS.PLAN_MANAGEMENT_EMAIL) {
        coordinatorInfo.email = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.PLAN_MANAGEMENT_EMAIL);
        coordinatorInfo.name = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.PLAN_MANAGEMENT_NAME);
        coordinatorInfo.participantNumber = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER);
    }
    
    return coordinatorInfo;
}

function questionMatches(question, searchText, questionKey = null) {
    if (questionKey && question.question_key === questionKey) {
        return true;
    }
    // Fallback to text search if no question key match
    return question.question && question.question.includes(searchText);
}

module.exports = {
    generateQuestionKey,
    QUESTION_KEYS,
    questionHasKey,
    findByQuestionKey,
    findByQuestionKeyWithFallback,
    getAnswerByQuestionKey,
    getAnswerByQuestionKeyWithFallback,
    findByQuestionText,
    findMultipleByQuestionKeys,
    mapQuestionTextToKey,
    findByQuestionTextUsingKey,
    getCoordinatorInfo,
    questionMatches
};