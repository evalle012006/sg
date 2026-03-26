/**
 * Email Trigger Context Registry
 *
 * ── Flag options ─────────────────────────────────────────────────────────────
 * Guest flags and booking flags come from the `settings` table and can change
 * at any time. They are NOT hardcoded here.
 *
 * Server-side:  buildTriggerContextsFromDB()   — queries Setting model
 * Client-side:  GET /api/settings/trigger-contexts  — returns enriched JSON
 *
 * `TRIGGER_CONTEXTS` (static export) has empty flag option arrays and is safe
 * for structural inspection only. Do not use it where the flag option lists
 * matter (e.g. the condition editor UI).
 */

import { Setting } from "../models";

// ─── Shared constants ─────────────────────────────────────────────────────────

export const BOOKING_STATUS_OPTIONS = [
  'pending_approval',
  'ready_to_process',
  'in_progress',
  'booking_confirmed',
  'booking_cancelled',
  'guest_cancelled',
  'on_hold',
  'booking_amended',
];

const BOOKING_STATUS_CONDITION = {
  key: 'booking_status',
  label: 'Booking Status',
  type: 'multi-select',
  options: BOOKING_STATUS_OPTIONS,
  description: 'Only fire if the related booking is currently in one of these statuses (leave empty for all)',
};

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Build the full TRIGGER_CONTEXTS map with real flag option arrays injected.
 *
 * @param {string[]} guestFlagOptions    Values from settings (attribute = 'guest_flag')
 * @param {string[]} bookingFlagOptions  Values from settings (attribute = 'booking_flag')
 * @returns {Object} Full trigger contexts map
 */
export function buildTriggerContexts(guestFlagOptions = [], bookingFlagOptions = []) {
  const guestFlagCondition = {
    key: 'flag_value',
    label: 'Flag',
    type: 'multi-select',
    options: guestFlagOptions,
    description: 'Only fire for specific flag(s) — leave empty to fire for any flag',
  };

  const bookingFlagCondition = {
    key: 'flag_value',
    label: 'Flag',
    type: 'multi-select',
    options: bookingFlagOptions,
    description: 'Only fire for specific flag(s) — leave empty to fire for any flag',
  };

  return {

    // ==================== BOOKINGS ====================
    bookings: {
      label: 'Bookings',
      icon: '📅',
      events: [
        {
          value: 'booking_status_changed',
          label: 'Booking Status Changed',
          description: 'Fires when booking status changes — use "Booking Status Conditions" to filter which statuses trigger this',
          availableConditions: [
            { key: 'status_from', label: 'Status From', type: 'select', options: BOOKING_STATUS_OPTIONS },
            { key: 'status_to', label: 'Status To', type: 'select', options: BOOKING_STATUS_OPTIONS },
            {
              key: 'booking_status',
              label: 'Current Booking Status',
              type: 'multi-select',
              options: BOOKING_STATUS_OPTIONS,
              description: 'Trigger only fires if booking is currently in one of these statuses (leave empty for all)',
            },
            { key: 'cancelled_by', label: 'Cancelled By', type: 'select', options: ['admin', 'guest', 'system'] },
            { key: 'is_first_time_guest', label: 'First Time Guest', type: 'boolean' },
            { key: 'is_returning_guest', label: 'Returning Guest', type: 'boolean' },
            { key: 'amendment_type', label: 'Amendment Type', type: 'select', options: ['dates', 'guests', 'package', 'room', 'services', 'other'] },
          ],
          sampleData: {
            booking_id: 123,
            booking_reference: 'BK-2024-001',
            status_from: 'pending_approval',
            status_to: 'booking_confirmed',
            is_first_time_guest: true,
            is_returning_guest: false,
            cancelled_by: null,
            guest_email: 'guest@example.com',
          },
        },
        {
          value: 'booking_flag_added',
          label: 'Booking Flag Added',
          description: 'Fires when a flag is added to a booking',
          availableConditions: [bookingFlagCondition, BOOKING_STATUS_CONDITION],
          sampleData: {
            booking_id: 123,
            flag_value: 'foundation_stay',
            booking_status: 'in_progress',
            guest_email: 'guest@example.com',
          },
        },
      ],
    },

    // ==================== GUESTS ====================
    guests: {
      label: 'Guests',
      icon: '👤',
      events: [
        {
          value: 'account_created',
          label: 'Account Created',
          description: 'Fires when a new guest account is created',
          availableConditions: [],
          sampleData: { guest_id: 456, guest_name: 'John Doe', guest_email: 'john@example.com' },
        },
        {
          value: 'password_reset_requested',
          label: 'Password Reset Requested',
          description: 'Fires when guest requests a password reset',
          availableConditions: [],
          sampleData: { guest_id: 456, guest_email: 'john@example.com', reset_token: 'abc123xyz' },
        },
        {
          value: 'email_verification_requested',
          label: 'Email Verification Requested',
          description: 'Fires when email verification is requested',
          availableConditions: [],
          sampleData: { guest_id: 456, guest_email: 'john@example.com', verification_token: 'verify123' },
        },
        {
          value: 'guest_profile_updated',
          label: 'Guest Profile Updated',
          description: 'Fires when guest updates their profile',
          availableConditions: [
            { key: 'update_type', label: 'Update Type', type: 'select', options: ['personal_info', 'contact_info', 'medical_info', 'preferences'] },
          ],
          sampleData: { guest_id: 456, guest_name: 'John Doe', update_type: 'personal_info' },
        },
        {
          value: 'guest_flag_added',
          label: 'Guest Flag Added',
          description: 'Fires when a flag is added to a guest profile',
          availableConditions: [guestFlagCondition],
          sampleData: { guest_id: 456, guest_name: 'John Doe', flag_value: 'complex-care' },
        },
      ],
    },

    // ==================== COURSES ====================
    courses: {
      label: 'Courses',
      icon: '🎓',
      events: [
        {
          value: 'course_eoi_submitted',
          label: 'Course EOI Submitted',
          description: 'Fires when guest submits expression of interest for a course',
          availableConditions: [
            { key: 'course_type', label: 'Course Type', type: 'select', options: ['physical', 'psychological', 'recreational', 'educational'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { guest_id: 456, guest_email: 'john@example.com', course_id: 789, course_name: 'Adaptive Yoga', booking_status: 'booking_confirmed' },
        },
        {
          value: 'course_eoi_accepted',
          label: 'Course EOI Accepted',
          description: 'Fires when EOI is accepted by admin',
          availableConditions: [BOOKING_STATUS_CONDITION],
          sampleData: { guest_id: 456, guest_email: 'john@example.com', course_id: 789, course_name: 'Adaptive Yoga', booking_status: 'booking_confirmed' },
        },
        {
          value: 'course_offer_sent',
          label: 'Course Offer Sent',
          description: 'Fires when a course offer is sent to guest',
          availableConditions: [
            { key: 'offer_type', label: 'Offer Type', type: 'select', options: ['full_enrollment', 'waitlist', 'conditional'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { guest_id: 456, guest_email: 'john@example.com', course_id: 789, course_name: 'Adaptive Yoga', offer_type: 'full_enrollment', booking_status: 'booking_confirmed' },
        },
        {
          value: 'course_enrollment_confirmed',
          label: 'Course Enrollment Confirmed',
          description: 'Fires when guest confirms enrollment',
          availableConditions: [BOOKING_STATUS_CONDITION],
          sampleData: { guest_id: 456, course_id: 789, course_name: 'Adaptive Yoga', booking_status: 'booking_confirmed' },
        },
        {
          value: 'course_cancelled',
          label: 'Course Cancelled',
          description: 'Fires when a course is cancelled by admin',
          availableConditions: [
            { key: 'cancellation_reason', label: 'Cancellation Reason', type: 'select', options: ['low_enrollment', 'instructor_unavailable', 'facility_issue', 'other'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { course_id: 789, course_name: 'Adaptive Yoga', cancellation_reason: 'low_enrollment', booking_status: 'booking_confirmed' },
        },
      ],
    },

    // ==================== FUNDING ====================
    funding: {
      label: 'Funding',
      icon: '💰',
      events: [
        {
          value: 'icare_funding_updated',
          label: 'iCare Funding Updated',
          description: 'Fires when iCare funding allocation changes',
          availableConditions: [
            { key: 'update_type', label: 'Update Type', type: 'select', options: ['allocation', 'no_charge_cancellation', 'full_charge_cancellation', 'adjustment'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { booking_id: 123, guest_email: 'guest@example.com', icare_nights_allocated: 14, update_type: 'allocation', booking_status: 'booking_confirmed' },
        },
        {
          value: 'ndis_plan_updated',
          label: 'NDIS Plan Updated',
          description: 'Fires when NDIS plan details are updated',
          availableConditions: [
            { key: 'update_type', label: 'Update Type', type: 'select', options: ['plan_approved', 'plan_renewed', 'budget_adjusted', 'coordinator_changed'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { guest_id: 456, ndis_number: 'NDIS-123456', update_type: 'plan_approved', booking_status: 'booking_confirmed' },
        },
        {
          value: 'funding_approval_received',
          label: 'Funding Approval Received',
          description: 'Fires when funding approval is received from any source',
          availableConditions: [
            { key: 'funding_source', label: 'Funding Source', type: 'select', options: ['icare', 'ndis', 'dva', 'private', 'grant'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { booking_id: 123, funding_source: 'ndis', approved_amount: 5000, booking_status: 'in_progress' },
        },
      ],
    },

    // ==================== ROOMS ====================
    rooms: {
      label: 'Rooms',
      icon: '🏠',
      events: [
        {
          value: 'room_assigned',
          label: 'Room Assigned',
          description: 'Fires when a room is assigned to a booking',
          availableConditions: [
            { key: 'room_type', label: 'Room Type', type: 'select', options: ['accessible', 'standard', 'family', 'premium'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { booking_id: 123, room_number: '101', room_type: 'accessible', booking_status: 'booking_confirmed' },
        },
        {
          value: 'room_availability_alert',
          label: 'Room Availability Alert',
          description: 'Fires when a room becomes available or unavailable',
          availableConditions: [
            { key: 'availability_status', label: 'Availability Status', type: 'select', options: ['available', 'unavailable', 'maintenance'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { room_number: '101', availability_status: 'available', booking_status: 'in_progress' },
        },
      ],
    },

    // ==================== EQUIPMENT ====================
    equipment: {
      label: 'Equipment',
      icon: '🛠️',
      events: [
        {
          value: 'equipment_requested',
          label: 'Equipment Requested',
          description: 'Fires when a guest requests equipment',
          availableConditions: [
            { key: 'equipment_type', label: 'Equipment Type', type: 'select', options: ['mobility', 'medical', 'assistive', 'recreational'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { booking_id: 123, equipment_type: 'mobility', equipment_name: 'Wheelchair', booking_status: 'booking_confirmed' },
        },
        {
          value: 'equipment_allocated',
          label: 'Equipment Allocated',
          description: 'Fires when equipment is allocated to a booking',
          availableConditions: [BOOKING_STATUS_CONDITION],
          sampleData: { booking_id: 123, equipment_name: 'Wheelchair', allocation_date: '2024-03-15', booking_status: 'booking_confirmed' },
        },
        {
          value: 'equipment_maintenance_due',
          label: 'Equipment Maintenance Due',
          description: 'Fires when equipment maintenance is due',
          availableConditions: [
            { key: 'maintenance_type', label: 'Maintenance Type', type: 'select', options: ['routine', 'safety', 'repair', 'inspection'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { equipment_id: 999, equipment_name: 'Hoist', maintenance_type: 'safety', due_date: '2024-03-20', booking_status: null },
        },
      ],
    },

    // ==================== PROMOTIONS ====================
    promotions: {
      label: 'Promotions',
      icon: '🎁',
      events: [
        {
          value: 'promotion_code_applied',
          label: 'Promotion Code Applied',
          description: 'Fires when a promotion code is applied to a booking',
          availableConditions: [
            { key: 'promotion_type', label: 'Promotion Type', type: 'select', options: ['percentage', 'fixed_amount', 'free_service', 'upgrade'] },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { booking_id: 123, promotion_code: 'SUMMER2024', discount_amount: 100, booking_status: 'in_progress' },
        },
        {
          value: 'promotion_expiring_soon',
          label: 'Promotion Expiring Soon',
          description: 'Fires when a promotion is about to expire',
          availableConditions: [
            { key: 'days_until_expiry', label: 'Days Until Expiry', type: 'number' },
            BOOKING_STATUS_CONDITION,
          ],
          sampleData: { promotion_code: 'SUMMER2024', expiry_date: '2024-03-31', days_until_expiry: 7, booking_status: null },
        },
      ],
    },

    // ==================== USERS (Staff/Admin accounts) ====================
    users: {
      label: 'Users',
      icon: '🧑‍💼',
      events: [
        {
          value: 'user_account_created',
          label: 'User Account Created',
          description: 'Fires when a new staff/admin user account is created — sends email verification link',
          availableConditions: [
            { key: 'role', label: 'Role', type: 'select', options: ['admin', 'staff', 'coordinator', 'manager'] },
          ],
          sampleData: {
            user_id: 10,
            username: 'Jane',
            user_email: 'jane@sargoodoncollaroy.com.au',
            confirmation_link: 'https://booking.sargoodoncollaroy.com.au/settings/users/TOKEN',
            role: 'staff',
          },
        },
      ],
    },

    // ==================== SYSTEM ====================
    system: {
      label: 'System/Admin',
      icon: '⚙️',
      events: [
        {
          value: 'admin_notification',
          label: 'Admin Notification',
          description: 'Fires for custom admin notifications',
          availableConditions: [
            { key: 'notification_type', label: 'Notification Type', type: 'select', options: ['urgent', 'info', 'warning', 'success'] },
          ],
          sampleData: { notification_type: 'urgent', message: 'System maintenance scheduled', recipient: 'admin@example.com' },
        },
        {
          value: 'report_generated',
          label: 'Report Generated',
          description: 'Fires when an automated report is generated',
          availableConditions: [
            { key: 'report_type', label: 'Report Type', type: 'select', options: ['occupancy', 'financial', 'guest_feedback', 'operational'] },
          ],
          sampleData: { report_type: 'occupancy', report_period: '2024-03', generated_at: '2024-03-01' },
        },
      ],
    },
  };
}

// ─── Server-side DB loader ────────────────────────────────────────────────────

/**
 * Fetch guest_flag and booking_flag values from the settings table.
 * SERVER-SIDE ONLY — requires Sequelize.
 */
export async function fetchFlagOptionsFromDB() {
  try {
    // Lazy import to avoid issues in client-side bundles
    const flags = await Setting.findAll({
      where: { attribute: ['guest_flag', 'booking_flag'] },
      order: [['attribute', 'ASC'], ['value', 'ASC']],
      attributes: ['attribute', 'value'],
    });
    return {
      guestFlagOptions:   flags.filter(f => f.attribute === 'guest_flag').map(f => f.value),
      bookingFlagOptions: flags.filter(f => f.attribute === 'booking_flag').map(f => f.value),
    };
  } catch (err) {
    console.error('⚠️ fetchFlagOptionsFromDB failed, returning empty flag lists:', err.message);
    return { guestFlagOptions: [], bookingFlagOptions: [] };
  }
}

/**
 * Build contexts with live DB flag options in one call.
 * SERVER-SIDE ONLY.
 */
export async function buildTriggerContextsFromDB() {
  const { guestFlagOptions, bookingFlagOptions } = await fetchFlagOptionsFromDB();
  return buildTriggerContexts(guestFlagOptions, bookingFlagOptions);
}

// ─── Static export (structure only, empty flag options) ──────────────────────

/** Structural reference only — flag option arrays are empty. */
export const TRIGGER_CONTEXTS = buildTriggerContexts([], []);

// ─── Utility helpers (accept optional contexts for enriched usage) ────────────

export function getAllTriggerContexts(contexts = TRIGGER_CONTEXTS) {
  const all = [];
  Object.entries(contexts).forEach(([entityKey, entity]) => {
    entity.events.forEach(event => {
      all.push({ ...event, entity: entityKey, entityLabel: entity.label, entityIcon: entity.icon });
    });
  });
  return all;
}

export function getTriggerContextByValue(value, contexts = TRIGGER_CONTEXTS) {
  return getAllTriggerContexts(contexts).find(c => c.value === value) || null;
}

export function getAvailableConditions(triggerContext, contexts = TRIGGER_CONTEXTS) {
  return getTriggerContextByValue(triggerContext, contexts)?.availableConditions || [];
}

export function getSampleDataForContext(triggerContext, contexts = TRIGGER_CONTEXTS) {
  return getTriggerContextByValue(triggerContext, contexts)?.sampleData || {};
}

export function getTriggerContextsByEntity(contexts = TRIGGER_CONTEXTS) {
  return contexts;
}

export function contextSupportsBookingStatus(triggerContext, contexts = TRIGGER_CONTEXTS) {
  return getAvailableConditions(triggerContext, contexts).some(c => c.key === 'booking_status');
}

export default TRIGGER_CONTEXTS;