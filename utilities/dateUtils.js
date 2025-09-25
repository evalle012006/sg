import { questionHasKey, QUESTION_KEYS } from '../services/booking/question-helper';

/**
 * Extract checkin and checkout dates from current page sections
 * Uses question_key first, falls back to question text
 * Used for cross-validation in DateField components
 */
export const getBookingDatesFromCurrentPage = (sections) => {
    let checkinDate = null;
    let checkoutDate = null;

    if (!sections || !Array.isArray(sections)) {
        return { checkinDate, checkoutDate };
    }

    for (const section of sections) {
        if (!section.Questions || !Array.isArray(section.Questions)) {
            continue;
        }

        for (const question of section.Questions) {
            if (!question.answer) continue;

            // Check for combined check-in/check-out date question using question_key first
            if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_OUT_DATE)) {
                const dates = question.answer.split(' - ');
                if (dates.length >= 2) {
                    checkinDate = dates[0].trim();
                    checkoutDate = dates[1].trim();
                }
            }
            // Fallback: Check for combined check-in/check-out date question using question text
            else if (question.question === 'Check In Date and Check Out Date') {
                const dates = question.answer.split(' - ');
                if (dates.length >= 2) {
                    checkinDate = dates[0].trim();
                    checkoutDate = dates[1].trim();
                }
            }
            // Check for separate check-in date question using question_key first
            else if (questionHasKey(question, QUESTION_KEYS.CHECK_IN_DATE)) {
                checkinDate = question.answer.trim();
            }
            // Fallback: Check for separate check-in date question using question text
            else if (question.question === 'Check In Date') {
                checkinDate = question.answer.trim();
            }
            // Check for separate check-out date question using question_key first
            else if (questionHasKey(question, QUESTION_KEYS.CHECK_OUT_DATE)) {
                checkoutDate = question.answer.trim();
            }
            // Fallback: Check for separate check-out date question using question text
            else if (question.question === 'Check Out Date') {
                checkoutDate = question.answer.trim();
            }
        }
    }

    return { checkinDate, checkoutDate };
};

/**
 * Get the cross-validation value for a booking date field
 * @param {string} fieldName - 'checkinDate' or 'checkoutDate' 
 * @param {Array} sections - Current page sections
 * @returns {string|null} - The other field's value for cross-validation
 */
export const getCrossValidationValue = (fieldName, sections) => {
    const { checkinDate, checkoutDate } = getBookingDatesFromCurrentPage(sections);
    
    if (fieldName === 'checkinDate') {
        return checkoutDate;
    } else if (fieldName === 'checkoutDate') {
        return checkinDate;
    }
    
    return null;
};