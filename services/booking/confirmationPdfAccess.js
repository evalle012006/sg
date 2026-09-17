import { Setting } from '../../models';
import { getFunder } from '../../utilities/common';

const SETTING_ATTRIBUTE = 'booking_confirmation_pdf_allowed_statuses';

// Client confirmed: NDIS bookings already have Summary of Stay, which is
// sufficient - Booking Confirmation should never be offered to them, to
// avoid the exact "two documents for one booking" confusion this feature
// caused before. Enforced here (server-side) as well as hidden in the UI,
// since a determined client could otherwise hit the API routes directly.
const EXCLUDED_FUNDER_KEYWORDS = ['ndis', 'ndia'];

/**
 * Returns the list of booking status names allowed to generate/email the
 * booking confirmation PDF. Empty array/null in DB is treated as "all
 * statuses allowed"; a non-empty array restricts to those status names.
 */
async function getAllowedStatuses() {
  const setting = await Setting.findOne({ where: { attribute: SETTING_ATTRIBUTE } });

  if (!setting || !setting.value) {
    return []; // no restriction configured -> allow all
  }

  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse booking_confirmation_pdf_allowed_statuses setting:', e);
    return [];
  }
}

/**
 * Extracts the status "name" from a booking's status field, which is stored
 * as a JSON string, e.g. '{"name":"booking_confirmed","label":"Booking Confirmed","color":"green"}'.
 * Falls back to booking.status_name if present.
 */
function getBookingStatusName(booking) {
  if (booking?.status_name) return booking.status_name;

  if (typeof booking?.status === 'string') {
    try {
      const parsed = JSON.parse(booking.status);
      return parsed?.name || null;
    } catch (e) {
      return null;
    }
  }

  return booking?.status?.name || null;
}

/**
 * Returns true if the given booking's current status is allowed to use the
 * confirmation PDF feature, given the configured restriction list.
 */
async function isBookingStatusAllowed(booking) {
  const allowedStatuses = await getAllowedStatuses();

  if (!allowedStatuses.length) return true; // no restriction -> available for all statuses

  const statusName = getBookingStatusName(booking);
  return !!statusName && allowedStatuses.includes(statusName);
}

/**
 * Returns true if the booking's funder is NDIS/NDIA - these bookings already
 * have Summary of Stay and should not be offered the generic Booking
 * Confirmation PDF (client decision, see comment above).
 */
function isNdisFunder(booking) {
  const funder = getFunder(booking?.Sections)?.toLowerCase();
  if (!funder) return false;
  return EXCLUDED_FUNDER_KEYWORDS.some(keyword => funder.includes(keyword));
}

/**
 * Combined check: booking confirmation PDF is allowed only if the booking
 * is not NDIS-funded AND its status is in the allowed-statuses list (or no
 * status restriction is configured). Use this in both API routes rather
 * than the two checks separately, so the funder exclusion can't be missed.
 */
async function isConfirmationPdfAllowed(booking) {
  if (isNdisFunder(booking)) return false;
  return isBookingStatusAllowed(booking);
}

export {
  SETTING_ATTRIBUTE,
  getAllowedStatuses,
  getBookingStatusName,
  isBookingStatusAllowed,
  isNdisFunder,
  isConfirmationPdfAllowed,
};