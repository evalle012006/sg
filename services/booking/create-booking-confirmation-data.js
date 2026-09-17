import moment from 'moment';
import fs from 'fs';
import path from 'path';
import { getFunder } from '../../utilities/common';
import { getBookingStatusName } from './confirmationPdfAccess';
import { getPublicDir } from '../../lib/paths';
import EmailDataParsingService from '../EmailDataParsingService';

const formatAUDate = (date) => (date ? moment(date).format('DD/MM/YYYY') : null);

// Cached logo, base64-embedded (same file/pattern as services/booking/emailService.js's
// getLogoBase64 - Puppeteer's page.setContent has no base URL to resolve a network path,
// so a plain file:// or relative <img src> will render broken; embedding avoids that).
let _cachedLogoBase64 = null;
function getLogoBase64() {
  if (_cachedLogoBase64) return _cachedLogoBase64;
  try {
    const logoPath = path.join(getPublicDir(), 'images/sargood-logo.png');
    const buffer = fs.readFileSync(logoPath);
    _cachedLogoBase64 = `data:image/png;base64,${buffer.toString('base64')}`;
  } catch (e) {
    console.error('Failed to load logo for booking confirmation PDF:', e);
    _cachedLogoBase64 = null;
  }
  return _cachedLogoBase64;
}

/**
 * Puppeteer's native headerTemplate/footerTemplate + a matching margin -
 * NOT the position:fixed CSS approach used elsewhere in this codebase.
 * Chromium reserves this margin on every printed page and repeats these
 * templates automatically, avoiding the overlap bug a single continuous
 * content flow gets into with a CSS-fixed footer (see booking-confirmation.html
 * header comment). Puppeteer header/footer templates only support inline
 * styles, no external stylesheet or class-based CSS.
 */
export function getBookingConfirmationPdfHeaderFooter() {
  const logo = getLogoBase64();

  // Native logo is 136x127px. Explicit width/height ATTRIBUTES (not just
  // CSS max-width/max-height) are required here - Chromium's header/footer
  // template renderer needs concrete dimensions to lay out a replaced
  // element; without them the image can silently fail to render at all,
  // unlike on a normal page where the browser reflows against intrinsic size.
  const headerTemplate = `
    <div style="width:100%; text-align:center; padding-top:14px;">
      ${logo ? `<img src="${logo}" width="59" height="55" style="object-fit:contain;" />` : ''}
    </div>
  `;

  const footerTemplate = `
    <div style="width:100%; font-size:9px; color:#6b7280; text-align:center; font-family:Arial, sans-serif; line-height:1.5; border-top:1px solid #e5e7eb; padding:8px 40px 0 40px;">
      <div style="font-weight:700; color:#374151; font-size:10px;">Sargood on Collaroy</div>
      <div>Phone: 02 8597 0600 &middot; Email: info@sargoodoncollaroy.com.au</div>
      <div>1 Brissenden Avenue, Collaroy NSW 2097, Australia</div>
    </div>
  `;

  // Must comfortably fit each template's rendered height or content will
  // render underneath them - sized generously above what these templates
  // actually need.
  const margin = {
    top: '115px',
    bottom: '90px',
    left: '0',
    right: '0',
  };

  return { headerTemplate, footerTemplate, margin };
}


// Parses a duration string like "2 hours" / "30 minutes" / "1.5" into hours.
// Same parsing rules as create-summary-data.js's parseDurationToHours, kept
// as a small standalone copy rather than importing that module - this stays
// a plain string parser with no coupling to NDIS day-rate/package logic.
function parseDurationToHours(durationStr) {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  const normalized = durationStr.toLowerCase().trim();

  const hoursMatch = normalized.match(/^([\d.]+)\s*hours?$/);
  if (hoursMatch) return parseFloat(hoursMatch[1]);

  const minutesMatch = normalized.match(/^([\d.]+)\s*minutes?$/);
  if (minutesMatch) return parseFloat(minutesMatch[1]) / 60;

  const numericValue = parseFloat(normalized);
  return isNaN(numericValue) ? 0 : numericValue;
}

/**
 * Sums requested care hours by period across the whole stay, from the raw
 * care-table QaPair answer. Matched by question_type/Question.type
 * ('care-table') - NOT question_key, which is null on this question in
 * real data (only some questions have a question_key set; care-table
 * doesn't). Deliberately NOT day-by-day or check-in/check-out-boundary
 * aware (that's create-summary-data.js's NDIS-specific business logic) -
 * this is just "how many hours did the guest request in total".
 */
function extractCareHours(qaPairs) {
  const careQuestion = qaPairs.find(pair => {
    const qType = pair.question_type || pair.Question?.type || '';
    return qType === 'care-table';
  });
  if (!careQuestion?.answer) return null;

  let careData;
  try {
    careData = typeof careQuestion.answer === 'string'
      ? JSON.parse(careQuestion.answer)
      : careQuestion.answer;
  } catch (e) {
    return null;
  }

  if (!careData?.careData?.length) return null;

  const totals = { morning: 0, afternoon: 0, evening: 0 };
  careData.careData.forEach(item => {
    const period = (item.care || '').toLowerCase();
    if (item.values?.carers === 'No care required') return;
    if (totals[period] === undefined) return;
    totals[period] += parseDurationToHours(item.values?.duration);
  });

  const totalHours = totals.morning + totals.afternoon + totals.evening;
  if (totalHours === 0) return null;

  const round = (n) => Math.round(n * 100) / 100;
  return {
    total_hours: round(totalHours),
    morning_hours: round(totals.morning),
    afternoon_hours: round(totals.afternoon),
    evening_hours: round(totals.evening),
  };
}

/**
 * Selected services from a 'service-cards' QaPair. Answer is a JSON object
 * keyed by option value -> { selected, subOptions: [subValue, ...] };
 * labels are looked up from Question.options (and each option's own
 * subOptions) since the answer only stores values, not display text.
 */
function extractServices(qaPairs) {
  const serviceQa = qaPairs.find(pair => {
    const qType = pair.question_type || pair.Question?.type || '';
    return qType === 'service-cards';
  });
  if (!serviceQa?.answer) return [];

  let answerObj;
  try {
    answerObj = typeof serviceQa.answer === 'string'
      ? JSON.parse(serviceQa.answer)
      : serviceQa.answer;
  } catch (e) {
    return [];
  }
  if (!answerObj || typeof answerObj !== 'object') return [];

  const options = serviceQa.Question?.options || [];
  const results = [];

  Object.entries(answerObj).forEach(([key, val]) => {
    if (!val?.selected) return;
    const option = options.find(o => o.value === key);
    const label = option?.label || key;

    let subLabels = [];
    if (Array.isArray(val.subOptions) && val.subOptions.length) {
      subLabels = val.subOptions.map(subValue => {
        const subOption = option?.subOptions?.find(so => so.value === subValue);
        return subOption?.label || subValue;
      }).filter(Boolean);
    }

    results.push({ label, sub_options: subLabels });
  });

  return results;
}

/**
 * Therapy/service goals from a 'goal-table' QaPair. Answer is a JSON array
 * of goal objects as entered - no rate/cost computation here, 'rate' below
 * is shown verbatim as the guest/staff entered it (e.g. "PT: $220"), not
 * calculated by this service.
 */
function extractGoals(qaPairs) {
  const goalQa = qaPairs.find(pair => {
    const qType = pair.question_type || pair.Question?.type || '';
    return qType === 'goal-table';
  });
  if (!goalQa?.answer) return [];

  let goals;
  try {
    goals = typeof goalQa.answer === 'string' ? JSON.parse(goalQa.answer) : goalQa.answer;
  } catch (e) {
    return [];
  }
  if (!Array.isArray(goals)) return [];

  return goals
    .map(g => ({
      goal: g.goal || null,
      service: g.service || null,
      expect: g.expect || null,
      funding: Array.isArray(g.funding) ? g.funding : [],
      rate: g.rate || null,
    }))
    .filter(g => g.goal || g.service);
}

/**
 * Builds the data object for the booking-confirmation.html template.
 *
 * Deliberately does NOT touch package COST, care day-rates, or NDIS-specific
 * question data - this is a lightweight confirmation document available to
 * every booking, not a replacement for the NDIS Summary of Stay. Package
 * *name* and requested care *hours* are safe to include (both resolved via
 * generic, non-pricing lookups) since neither carries rate/cost logic.
 *
 * Expects `booking` to be loaded with: Guest, Room (+ RoomType),
 * Sections (+ QaPairs + Question), Equipment, CourseOffer (+ Course).
 */
export async function createBookingConfirmationData(booking) {
  const guest = booking.Guest;
  const rooms = booking.Rooms || booking.Room || [];
  const roomList = Array.isArray(rooms) ? rooms : [rooms].filter(Boolean);

  // Prefer explicit Room check-in/check-out (set once a booking has rooms
  // assigned); fall back to the booking-level preferred dates for
  // enquiry-stage bookings that don't have rooms yet.
  const firstRoom = roomList[0];
  const checkinDate = firstRoom?.checkin || booking.preferred_arrival_date;
  const checkoutDate = firstRoom?.checkout || booking.preferred_departure_date;

  const nights = (checkinDate && checkoutDate)
    ? moment(checkoutDate).diff(moment(checkinDate), 'days')
    : null;

  const roomLabels = roomList
    .map(r => r?.RoomType?.name || r?.label)
    .filter(Boolean);

  const funder = getFunder(booking.Sections) || null;
  const statusName = getBookingStatusName(booking);

  // Package name only - no cost/rate resolution. See file header comment.
  const flatQaPairs = (booking.Sections || [])
    .flatMap(section => section.QaPairs || section.QaPair || []);
  await EmailDataParsingService.enrichPackageData(booking, flatQaPairs);
  const packageRecord = booking.getDataValue ? booking.getDataValue('Package') : booking.Package;
  const packageName = packageRecord?.name || null;

  // Courses can be attached to a booking two different ways:
  //  1. Via a CourseOffer record (EOI offer -> accepted flow)
  //  2. Via a direct QaPair answer on the booking form itself
  //     (type 'horizontal-card' / option_type 'course') - a completely
  //     separate mechanism, resolved generically the same way Package is.
  // Both need checking or a form-selected course silently goes missing.
  await EmailDataParsingService.enrichCourseData(booking, flatQaPairs);
  const formSelectedCourse = booking.getDataValue ? booking.getDataValue('Course') : booking.Course;

  // Equipment - direct belongsToMany association. Filtered: some rows in
  // this table are internal acknowledgement/checkbox records (type:
  // 'acknowledgement', hidden: true), not actual physical equipment -
  // e.g. "I verify all the information above is true and updated" was
  // showing up as an equipment list item before this filter.
  const equipmentList = (booking.Equipment || [])
    .filter(e => e && !e.hidden && e.type !== 'acknowledgement')
    .map(e => e?.name)
    .filter(Boolean);

  // Courses - CourseOffer -> Course, whatever is linked to this booking.
  const courseListFromOffers = (booking.CourseOffers || booking.courseOffers || [])
    .map(offer => ({
      title: offer?.course?.title || offer?.Course?.title || null,
      status: offer?.status || null,
    }))
    .filter(c => c.title);

  const courseList = [...courseListFromOffers];
  if (formSelectedCourse?.title && !courseList.some(c => c.title === formSelectedCourse.title)) {
    courseList.push({ title: formSelectedCourse.title, status: null });
  }

  const careHours = extractCareHours(flatQaPairs);
  const services = extractServices(flatQaPairs);
  const goals = extractGoals(flatQaPairs);

  return {
    logo_base64: getLogoBase64(),
    booking_reference: booking.reference_id || booking.uuid,
    generated_date: formatAUDate(new Date()),

    guest_name: guest ? `${guest.first_name || ''} ${guest.last_name || ''}`.trim() : '',
    guest_email: guest?.email || null,
    guest_phone: guest?.phone_number || null,

    checkin_date: formatAUDate(checkinDate),
    checkout_date: formatAUDate(checkoutDate),
    dates_of_stay: (checkinDate && checkoutDate)
      ? `${formatAUDate(checkinDate)} - ${formatAUDate(checkoutDate)}`
      : 'To be confirmed',
    nights,

    room_label: roomLabels.length ? roomLabels.join(', ') : 'To be confirmed',

    funder: funder ? funder.toUpperCase() : 'Not specified',

    status_label: (() => {
      try {
        return typeof booking.status === 'string' ? JSON.parse(booking.status)?.label : booking.status?.label;
      } catch (e) {
        return statusName;
      }
    })(),

    package_name: packageName, // omitted from template entirely if null
    equipment_list: equipmentList, // omitted from template entirely if empty
    course_list: courseList, // omitted from template entirely if empty
    care_hours: careHours, // omitted from template entirely if null (no care requested)
    services: services, // omitted from template entirely if empty
    goals: goals, // omitted from template entirely if empty
  };
}

export default createBookingConfirmationData;