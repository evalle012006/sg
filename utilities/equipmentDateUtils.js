// utilities/equipmentDateUtils.js
//
// Shared server-side utility for extracting stay dates from a loaded Booking,
// used by every equipment save path to validate and inject start_date/end_date.
//
// Works with two date sources, in priority order:
//   1. QaPairs on the booking's Sections (most accurate — guest-entered answers)
//   2. booking.preferred_arrival_date / preferred_departure_date (Booking model
//      fields, set by disseminateChanges when dates are saved)
//
// Returns: { checkInDate, checkOutDate, source, valid }
//
// Callers use `valid` to decide whether to block or warn.
// `source` is included in log output for diagnostics.

const moment = require('moment');
const { QUESTION_KEYS, findByQuestionKey } = require('../services/booking/question-helper');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate that a date string is a real, parseable YYYY-MM-DD date.
 */
function isValidDateString(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return false;
    if (!DATE_REGEX.test(dateStr.trim())) return false;
    return moment(dateStr.trim(), 'YYYY-MM-DD', true).isValid();
}

/**
 * Extract stay dates from a Booking instance that has been loaded with
 * its Sections → QaPairs association.
 *
 * @param {Object} booking  - Sequelize Booking instance or plain object.
 *                            Must have booking.Sections[].QaPairs[] if the
 *                            QaPair source is to be used.
 * @returns {{ checkInDate: string|null, checkOutDate: string|null, source: string, valid: boolean }}
 */
function extractStayDatesFromBooking(booking) {
    if (!booking) {
        return { checkInDate: null, checkOutDate: null, source: 'none', valid: false };
    }

    // ── Source 1: QaPairs ─────────────────────────────────────────────────────
    const sections = booking.Sections || booking.sections || [];
    if (sections.length > 0) {
        const allQaPairs = sections.flatMap(s => s.QaPairs || s.qaPairs || []);

        if (allQaPairs.length > 0) {
            // Try combined date question first (most common)
            const combinedQa = findByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
            if (combinedQa?.answer) {
                const parts = combinedQa.answer.split(' - ');
                if (parts.length === 2) {
                    const checkInDate  = parts[0].trim();
                    const checkOutDate = parts[1].trim();
                    if (isValidDateString(checkInDate) && isValidDateString(checkOutDate)) {
                        return { checkInDate, checkOutDate, source: 'qa_pair_combined', valid: true };
                    }
                }
            }

            // Fallback: separate check-in / check-out questions
            const checkInQa  = findByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_DATE);
            const checkOutQa = findByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
            if (checkInQa?.answer && checkOutQa?.answer) {
                const checkInDate  = checkInQa.answer.trim();
                const checkOutDate = checkOutQa.answer.trim();
                if (isValidDateString(checkInDate) && isValidDateString(checkOutDate)) {
                    return { checkInDate, checkOutDate, source: 'qa_pair_separate', valid: true };
                }
            }
        }
    }

    // ── Source 2: Booking model fields ────────────────────────────────────────
    // Set by BookingService.disseminateChanges when the dates page is saved.
    const arrivalRaw   = booking.preferred_arrival_date;
    const departureRaw = booking.preferred_departure_date;

    if (arrivalRaw && departureRaw) {
        const checkInDate  = moment(arrivalRaw).format('YYYY-MM-DD');
        const checkOutDate = moment(departureRaw).format('YYYY-MM-DD');
        if (isValidDateString(checkInDate) && isValidDateString(checkOutDate)) {
            return { checkInDate, checkOutDate, source: 'booking_model', valid: true };
        }
    }

    // ── No valid dates found ──────────────────────────────────────────────────
    return { checkInDate: null, checkOutDate: null, source: 'none', valid: false };
}

module.exports = { extractStayDatesFromBooking, isValidDateString };