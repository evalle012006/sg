'use strict';

/**
 * services/booking/guest-funding-profile-service.js
 *
 * Handles syncing confirmed iCare/NDIS booking funding data to the
 * guest_funding_profiles table, and providing that data back for
 * display on the guest profile (GuestProfileTab + AdminGuestProfile).
 */

const { GuestFundingProfile } = require('../../models');

// ─── Funder classification ────────────────────────────────────────────────────

const ICARE_FUNDER_VALUES = ['icare'];

/**
 * NDIS answer values — covers all management types.
 * Stored as lowercase slugs from the horizontal-card options.
 */
const NDIS_FUNDER_VALUES = [
    'ndis',
    'ndis-self-managed',
    'ndia-managed-portal',
    'ndis-plan-managed',
    // Label variants that may appear in legacy QaPairs
    'NDIS Self-Managed',
    'NDIA Managed (Portal)',
    'NDIA Managed',
    'NDIS Plan Managed',
];

const NON_FUNDED_VALUES = [
    'promotional-stay',
    'sargood-foundation',
    'royal-rehab-grant',
    'privately--self-funded',
    'privately-self-funded',
    'other-funder',
    'paraquad-sa',
];

/**
 * Resolve a raw funder answer to a normalised funder_type.
 * @param {string} rawAnswer
 * @returns {'icare'|'ndis'|null}
 */
const resolveFunderType = (rawAnswer) => {
    if (!rawAnswer) return null;
    const lower = String(rawAnswer).toLowerCase().trim();
    if (ICARE_FUNDER_VALUES.some(v => v.toLowerCase() === lower)) return 'icare';
    if (NDIS_FUNDER_VALUES.some(v => v.toLowerCase() === lower)) return 'ndis';
    return null;
};

const isIcareOrNdisFunder = (rawAnswer) => resolveFunderType(rawAnswer) !== null;

// ─── Question keys stored per funder type ────────────────────────────────────

/**
 * Funding-page question_keys to persist on the guest profile.
 *
 * Excludes:
 *  - ndis_only=1 / prefill=0 eligibility questions (booking-specific)
 *  - file-upload questions (no question_key)
 *  - promo-code
 *  - i-verify-all-the-information-above-is-true-and-updated
 *  - how-will-your-stay-be-funded (stored as funder_type column)
 */
const ICARE_QUESTION_KEYS = [
    'name-of-insurer',
    'email-address-of-insurer-where-invoice-will-be-sent',
    'phone-number-of-insurer',
    'billing-address-of-insurer',
    'billing-address-line-2',
    'city',
    'state',
    'postal-code',
    'icare-participant-number',
    'icare-coordinator-first-name',
    'icare-coordinator-last-name',
    'icare-coordinator-contact-number',
    'icare-coordinator-email-address',
    'icare-case-managers-first-name',
    'icare-case-managers-last-name',
    'icare-case-managers-email-address',
];

const NDIS_QUESTION_KEYS = [
    'please-select-from-one-of-the-following-ndis-funding-options',
    'ndis-ndia-participant-number',
    'your-ndis-ndia-plan-date-range',
    'ndis-ndia-support-coordinator-first-name',
    'ndis-ndia-support-coordinator-last-name',
    'ndis-ndia-support-coordinator-email-address',
    'ndis-ndia-support-coordinator-contact-number',
    'ndis-participant-number',
    'your-ndis-plan-date-range',
];

const getFundingQuestionKeys = (funderType) => {
    if (funderType === 'icare') return ICARE_QUESTION_KEYS;
    if (funderType === 'ndis') return NDIS_QUESTION_KEYS;
    return [];
};

// ─── Sync: confirmed booking → guest_funding_profiles ────────────────────────

/**
 * Called from update-status when a booking is confirmed.
 *
 * @param {object}  booking       Booking instance (must have .guest_id, .id)
 * @param {string}  rawFunder     Raw answer for QUESTION_KEYS.FUNDING_SOURCE
 * @param {Array}   [qaPairs]     Flat array of QaPair objects. Each must have
 *                                .question_key and .answer. Pass this when QaPairs
 *                                are nested under Sections (as in update-status.js).
 *                                Falls back to booking.QaPairs if omitted.
 * @param {object}  [transaction]
 * @returns {object|null}
 */
const syncFundingProfileFromBooking = async (booking, rawFunder, qaPairs = null, transaction = null) => {
    const funderType = resolveFunderType(rawFunder);

    if (!funderType) {
        console.log(`⏭️  [GuestFundingProfile] Skipping sync — funder "${rawFunder}" is not iCare/NDIS`);
        return null;
    }

    const relevantKeys = getFundingQuestionKeys(funderType);
    const pairs = qaPairs || booking.QaPairs || [];

    const fundingData = {};
    for (const qa of pairs) {
        // question_key is NOT a column on qa_pairs — must come from the
        // eager-loaded Question association. The booking fetch in update-status.js
        // must include: { model: QaPair, include: [Question] }
        const key = qa.Question?.question_key;
        if (key && relevantKeys.includes(key) && qa.answer != null && qa.answer !== '') {
            fundingData[key] = qa.answer;
        }
    }

    if (Object.keys(fundingData).length === 0) {
        console.log(`⚠️  [GuestFundingProfile] No funding data found in booking ${booking.id} for funder type "${funderType}"`);
        return null;
    }

    const opts = transaction ? { transaction } : {};

    const [profile, created] = await GuestFundingProfile.findOrCreate({
        where: { guest_id: booking.guest_id, funder_type: funderType },
        defaults: { funding_data: fundingData, source_booking_id: booking.id },
        ...opts,
    });

    if (!created) {
        await profile.update({ funding_data: fundingData, source_booking_id: booking.id }, opts);
    }

    console.log(`✅ [GuestFundingProfile] ${created ? 'Created' : 'Updated'} profile for guest ${booking.guest_id}, funder_type: ${funderType}, keys synced: ${Object.keys(fundingData).length}`);
    return profile;
};

// ─── Read: for profile API responses ─────────────────────────────────────────

/**
 * Returns `{ icare: {...} | null, ndis: {...} | null }` for a guest.
 * Used by both /api/my-profile/[id] and /api/guests/[uuid].
 *
 * @param {number} guestId
 * @returns {{ icare: object|null, ndis: object|null }}
 */
const getFundingProfilesForGuest = async (guestId) => {
    const profiles = await GuestFundingProfile.findAll({ where: { guest_id: guestId } });

    const result = { icare: null, ndis: null };
    for (const p of profiles) {
        result[p.funder_type] = {
            funder_type:       p.funder_type,
            funding_data:      p.funding_data || {},
            source_booking_id: p.source_booking_id,
            updated_at:        p.updated_at,
        };
    }
    return result;
};

module.exports = {
    resolveFunderType,
    isIcareOrNdisFunder,
    syncFundingProfileFromBooking,
    getFundingProfilesForGuest,
    ICARE_QUESTION_KEYS,
    NDIS_QUESTION_KEYS,
    ICARE_FUNDER_VALUES,
    NDIS_FUNDER_VALUES,
    NON_FUNDED_VALUES,
    getFundingQuestionKeys,
};