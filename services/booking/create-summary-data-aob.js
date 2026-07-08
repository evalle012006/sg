/**
 * AOB Summary Data Builder
 *
 * Accommodation-Only Booking variant of create-summary-data.
 * No package costs, no care/course analysis, no NDIS/iCare concerns.
 * Total is simply: sum of selected room rates × nights.
 */

import moment from 'moment';
import { findByQuestionKeyWithFallback, QUESTION_KEYS } from './question-helper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

export const tryParseJSON = (str) => {
  if (typeof str !== 'string') return str;
  try { return JSON.parse(str); } catch { return str; }
};

/**
 * Extract check-in/check-out and night count from QaPairs.
 * Handles both the combined CHECK_IN_OUT_DATE key and the
 * separate CHECK_IN_DATE / CHECK_OUT_DATE keys used by the AOB template.
 */
const extractDates = (qaPairs) => {
  let checkinDate = null;
  let checkoutDate = null;

  for (const qa of qaPairs) {
    const key = qa.Question?.question_key;
    if (!key || !qa.answer) continue;

    if (key === QUESTION_KEYS.CHECK_IN_OUT_DATE) {
      const parts = qa.answer.split(' - ');
      if (parts.length === 2) {
        checkinDate = parts[0].trim();
        checkoutDate = parts[1].trim();
      }
      break;
    }
    if (key === QUESTION_KEYS.CHECK_IN_DATE) checkinDate = qa.answer.trim();
    if (key === QUESTION_KEYS.CHECK_OUT_DATE) checkoutDate = qa.answer.trim();
  }

  let datesOfStay = null;
  let nights = 0;

  if (checkinDate && checkoutDate) {
    const checkIn  = moment(checkinDate,  ['YYYY-MM-DD', 'DD/MM/YYYY']);
    const checkOut = moment(checkoutDate, ['YYYY-MM-DD', 'DD/MM/YYYY']);
    if (checkIn.isValid() && checkOut.isValid()) {
      datesOfStay = `${checkIn.format('DD/MM/YYYY')} - ${checkOut.format('DD/MM/YYYY')}`;
      nights = checkOut.diff(checkIn, 'days');
    }
  }

  return { checkinDate, checkoutDate, datesOfStay, nights };
};

// ─── Main builder ─────────────────────────────────────────────────────────────

/**
 * Build summary data for an accommodation-only booking.
 *
 * @param {object} booking  - Full booking object with Rooms, Sections, Guest
 * @returns {object}        - summaryData shaped for SummaryOfStayAOB
 */
export const createSummaryDataAOB = (booking) => {
  const allQaPairs = (booking.Sections || []).flatMap(s => s.QaPairs || []);

  // ── Dates ────────────────────────────────────────────────────────────────────
  const { checkinDate, checkoutDate, datesOfStay, nights } = extractDates(allQaPairs);

  // ── Rooms ────────────────────────────────────────────────────────────────────
  // All selected rooms contribute directly to the total — no package baseline,
  // no upgrade concept, no studio filtering.
  const rooms = (booking.Rooms || []).map(room => ({
    room:          room.label,
    name:          room.label,
    type:          room.RoomType?.type || 'studio',
    price:         room.RoomType?.price_per_night || 0,
    price_per_night: room.RoomType?.price_per_night || 0,
    peak_rate:     room.RoomType?.peak_rate || 0,
  }));

  // ── Pricing ──────────────────────────────────────────────────────────────────
  const totalPerNight = rooms.reduce((sum, r) => sum + r.price, 0);
  const totalAccommodation = totalPerNight * nights;

  // ── Guest ────────────────────────────────────────────────────────────────────
  const guestName  = booking.Guest
    ? `${booking.Guest.first_name} ${booking.Guest.last_name}`
    : null;
  const guestEmail = booking.Guest?.email || null;

  return {
    uuid:       booking.uuid,
    guestName,
    guestEmail,
    rooms,
    signature:  booking.signature  || null,
    agreement_tc: booking.agreement_tc || null,
    data: {
      checkinDate,
      checkoutDate,
      datesOfStay,
      nights,
    },
    pricing: {
      totalPerNight,
      totalAccommodation,
      nights,
    },
  };
};