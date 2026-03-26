/**
 * triggerContextRegistryClient.js
 *
 * Client-safe version of the trigger context registry.
 * NO Sequelize / DB imports — safe to bundle in the browser.
 *
 * Flag option arrays are empty here. The API endpoint
 * GET /api/settings/trigger-contexts returns the enriched
 * version with real flag options from the DB.
 */

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

export const TRIGGER_CONTEXTS = {
  bookings: {
    label: 'Bookings', icon: '📅',
    events: [
      {
        value: 'booking_status_changed',
        label: 'Booking Status Changed',
        description: 'Fires when booking status changes',
        availableConditions: [
          { key: 'status_from', label: 'Status From', type: 'select', options: BOOKING_STATUS_OPTIONS },
          { key: 'status_to', label: 'Status To', type: 'select', options: BOOKING_STATUS_OPTIONS },
          { key: 'booking_status', label: 'Current Booking Status', type: 'multi-select', options: BOOKING_STATUS_OPTIONS },
          { key: 'cancelled_by', label: 'Cancelled By', type: 'select', options: ['admin', 'guest', 'system'] },
          { key: 'is_first_time_guest', label: 'First Time Guest', type: 'boolean' },
          { key: 'amendment_type', label: 'Amendment Type', type: 'select', options: ['dates', 'guests', 'package', 'room', 'services', 'other'] },
        ],
      },
      {
        value: 'booking_flag_added',
        label: 'Booking Flag Added',
        description: 'Fires when a flag is added to a booking',
        availableConditions: [
          { key: 'flag_value', label: 'Flag', type: 'multi-select', options: [] }, // populated at runtime via API
          BOOKING_STATUS_CONDITION,
        ],
      },
    ],
  },
  guests: {
    label: 'Guests', icon: '👤',
    events: [
      { value: 'account_created', label: 'Account Created', description: 'Fires when a new guest account is created', availableConditions: [] },
      { value: 'password_reset_requested', label: 'Password Reset Requested', description: 'Fires when guest requests a password reset', availableConditions: [] },
      { value: 'email_verification_requested', label: 'Email Verification Requested', description: 'Fires when email verification is requested', availableConditions: [] },
      { value: 'guest_profile_updated', label: 'Guest Profile Updated', description: 'Fires when guest updates their profile', availableConditions: [
        { key: 'update_type', label: 'Update Type', type: 'select', options: ['personal_info', 'contact_info', 'medical_info', 'preferences'] },
      ]},
      {
        value: 'guest_flag_added',
        label: 'Guest Flag Added',
        description: 'Fires when a flag is added to a guest profile',
        availableConditions: [
          { key: 'flag_value', label: 'Flag', type: 'multi-select', options: [] }, // populated at runtime via API
        ],
      },
    ],
  },
  courses: {
    label: 'Courses', icon: '🎓',
    events: [
      { value: 'course_eoi_submitted', label: 'Course EOI Submitted', description: 'Fires when guest submits expression of interest', availableConditions: [{ key: 'course_type', label: 'Course Type', type: 'select', options: ['physical', 'psychological', 'recreational', 'educational'] }, BOOKING_STATUS_CONDITION] },
      { value: 'course_eoi_accepted', label: 'Course EOI Accepted', description: 'Fires when EOI is accepted by admin', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'course_offer_sent', label: 'Course Offer Sent', description: 'Fires when a course offer is sent to guest', availableConditions: [{ key: 'offer_type', label: 'Offer Type', type: 'select', options: ['full_enrollment', 'waitlist', 'conditional'] }, BOOKING_STATUS_CONDITION] },
      { value: 'course_enrollment_confirmed', label: 'Course Enrollment Confirmed', description: 'Fires when guest confirms enrollment', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'course_cancelled', label: 'Course Cancelled', description: 'Fires when a course is cancelled', availableConditions: [BOOKING_STATUS_CONDITION] },
    ],
  },
  funding: {
    label: 'Funding', icon: '💰',
    events: [
      { value: 'icare_funding_updated', label: 'iCare Funding Updated', description: 'Fires when iCare funding allocation changes', availableConditions: [{ key: 'update_type', label: 'Update Type', type: 'select', options: ['allocation', 'no_charge_cancellation', 'full_charge_cancellation', 'adjustment'] }, BOOKING_STATUS_CONDITION] },
      { value: 'ndis_plan_updated', label: 'NDIS Plan Updated', description: 'Fires when NDIS plan details are updated', availableConditions: [{ key: 'update_type', label: 'Update Type', type: 'select', options: ['plan_approved', 'plan_renewed', 'budget_adjusted', 'coordinator_changed'] }, BOOKING_STATUS_CONDITION] },
      { value: 'funding_approval_received', label: 'Funding Approval Received', description: 'Fires when funding approval is received', availableConditions: [{ key: 'funding_source', label: 'Funding Source', type: 'select', options: ['icare', 'ndis', 'dva', 'private', 'grant'] }, BOOKING_STATUS_CONDITION] },
    ],
  },
  rooms: {
    label: 'Rooms', icon: '🏠',
    events: [
      { value: 'room_assigned', label: 'Room Assigned', description: 'Fires when a room is assigned to a booking', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'room_availability_alert', label: 'Room Availability Alert', description: 'Fires when a room becomes available or unavailable', availableConditions: [BOOKING_STATUS_CONDITION] },
    ],
  },
  equipment: {
    label: 'Equipment', icon: '🛠️',
    events: [
      { value: 'equipment_requested', label: 'Equipment Requested', description: 'Fires when a guest requests equipment', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'equipment_allocated', label: 'Equipment Allocated', description: 'Fires when equipment is allocated to a booking', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'equipment_maintenance_due', label: 'Equipment Maintenance Due', description: 'Fires when equipment maintenance is due', availableConditions: [BOOKING_STATUS_CONDITION] },
    ],
  },
  promotions: {
    label: 'Promotions', icon: '🎁',
    events: [
      { value: 'promotion_code_applied', label: 'Promotion Code Applied', description: 'Fires when a promotion code is applied', availableConditions: [BOOKING_STATUS_CONDITION] },
      { value: 'promotion_expiring_soon', label: 'Promotion Expiring Soon', description: 'Fires when a promotion is about to expire', availableConditions: [{ key: 'days_until_expiry', label: 'Days Until Expiry', type: 'number' }] },
    ],
  },
  users: {
    label: 'Users', icon: '🧑‍💼',
    events: [
      { value: 'user_account_created', label: 'User Account Created', description: 'Fires when a new staff/admin user account is created', availableConditions: [{ key: 'role', label: 'Role', type: 'select', options: ['admin', 'staff', 'coordinator', 'manager'] }] },
    ],
  },
};

export function getAllTriggerContexts() {
  const all = [];
  Object.entries(TRIGGER_CONTEXTS).forEach(([entityKey, entity]) => {
    entity.events.forEach(event => {
      all.push({ ...event, entity: entityKey, entityLabel: entity.label, entityIcon: entity.icon });
    });
  });
  return all;
}

export function getTriggerContextByValue(value) {
  return getAllTriggerContexts().find(c => c.value === value) || null;
}

export function getAvailableConditions(triggerContext) {
  return getTriggerContextByValue(triggerContext)?.availableConditions || [];
}

export function getTriggerContextsByEntity() {
  return TRIGGER_CONTEXTS;
}

export default TRIGGER_CONTEXTS;