/**
 * EmailTriggerService
 *
 * Evaluates and dispatches email triggers for a given booking/guest/user event.
 *
 * ── Trigger types ────────────────────────────────────────────────────────────
 * type = 'system'            → evaluated here via _contextMatchesTrigger
 * type = 'internal' /
 *        'external' /
 *        'booking_form'      → delegated to BookingEmailDataService.sendWithTriggerEvaluation
 *
 * ── System trigger contexts supported ───────────────────────────────────────
 * Bookings:
 *   booking_status_changed        context.booking_status + status_to/status_from/is_first_time_guest/cancelled_by (all optional)
 *   booking_confirmed             context.booking_confirmed = true
 *   booking_cancelled             context.booking_cancelled = true; optional cancelled_by
 *   booking_flag_added            context.booking_flag_added = true; optional flag_value (multi)
 *
 * Guests:
 *   account_created               context.account_created = true (no conditions)
 *   password_reset_requested      context.password_reset_requested = true
 *   email_verification_requested  context.email_verification_requested = true
 *   guest_flag_added              context.guest_flag_added = true; optional flag_value (multi)
 *
 * Users (staff):
 *   user_account_created          context.user_account_created = true; optional role condition
 *
 * Courses:
 *   course_eoi_submitted / course_eoi_accepted / course_offer_sent /
 *   course_enrollment_confirmed / course_cancelled
 *
 * Funding:
 *   icare_funding_updated / ndis_plan_updated / funding_approval_received
 *
 * Rooms:     room_assigned / room_availability_alert
 * Equipment: equipment_requested / equipment_allocated / equipment_maintenance_due
 * Promotions: promotion_code_applied / promotion_expiring_soon
 *
 * ── Flag matching ────────────────────────────────────────────────────────────
 * Both booking_flag_added and guest_flag_added support a flag_value multi-select
 * condition. context_conditions.flag_value can be:
 *   - absent / empty → fire for ANY flag
 *   - string         → fire only when context.flag_value === that string
 *   - array          → fire when context.flag_value is included in the array
 *
 * ── User account emails ──────────────────────────────────────────────────────
 * user_account_created targets a staff User model, not a Guest. The recipient
 * is taken from context.user_email. No booking DB fetch is performed.
 */

import { EmailTrigger, EmailTemplate, EmailTriggerQuestion, Question } from '../../models';
import { dispatchHttpTaskHandler } from '../queues/dispatchHttpTask.js';
import BookingEmailDataService from './BookingEmailDataService.js';
import EmailDataParsingService from '../EmailDataParsingService.js';
import EmailRecipientsService from '../email/EmailRecipientsService.js';
import { getPublicDir } from '../../lib/paths.js';
import fs from 'fs';
import path from 'path';

// ─── Logo helper (cached) ─────────────────────────────────────────────────────
let _logoBase64Cache = null;
function getLogoBase64() {
  if (_logoBase64Cache) return _logoBase64Cache;
  try {
    const logoPath = path.join(getPublicDir(), 'sargood-logo.png');
    if (fs.existsSync(logoPath)) {
      _logoBase64Cache = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
    }
  } catch (e) {
    console.warn('⚠️ Could not load logo:', e.message);
  }
  return _logoBase64Cache;
}

// ─── Guest-only contexts (skip booking DB fetch) ──────────────────────────────
const GUEST_ONLY_CONTEXTS = new Set([
  'account_created',
  'password_reset_requested',
  'email_verification_requested',
  'guest_flag_added',
]);

// ─── User (staff) contexts (no booking, no guest model) ──────────────────────
const USER_ONLY_CONTEXTS = new Set([
  'user_account_created',
]);

class EmailTriggerService {

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════

  static async evaluateAndSendTriggers(bookingId, context = {}) {
    console.log(`\n🔍 EmailTriggerService: evaluating triggers for booking ${bookingId ?? '(none)'}`, context);

    const triggers = await this.getAllTriggers();
    console.log(`📋 Found ${triggers.length} enabled triggers`);

    const results = [];
    for (const trigger of triggers) {
      try {
        const result = await this.processSingleTrigger(trigger, bookingId, context);
        results.push(result);
      } catch (err) {
        console.error(`❌ Error processing trigger ${trigger.id}:`, err.message);
        results.push({ triggerId: trigger.id, success: false, error: err.message });
      }
    }

    const sent    = results.filter(r => r.sent).length;
    const skipped = results.filter(r => !r.sent && !r.error).length;
    const errored = results.filter(r => r.error).length;
    console.log(`✅ Done: ${sent} sent, ${skipped} skipped, ${errored} errors\n`);

    return results;
  }

  static async processSingleTrigger(trigger, bookingId, context = {}) {
    if (trigger.type !== 'system') {
      // Booking form triggers (internal/external) must only be evaluated from save-qa-pair,
      // never from a system event dispatch. Guard here as a safety net.
      console.warn(`⚠️  processSingleTrigger: skipping non-system trigger ${trigger.id} (type: ${trigger.type}) — booking form triggers belong in save-qa-pair`);
      return { triggerId: trigger.id, sent: false, reason: `Trigger type '${trigger.type}' not evaluated via system event dispatch` };
    }
    return await this._evaluateSystemTrigger(trigger, bookingId, context);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SYSTEM TRIGGER EVALUATION
  // ═══════════════════════════════════════════════════════════════════════════

  static async _evaluateSystemTrigger(trigger, bookingId, context) {
    const triggerContext    = trigger.trigger_context;
    const contextConditions = trigger.context_conditions || {};

    console.log(`  🔧 System trigger ${trigger.id} [${triggerContext}]: evaluating...`);

    const matchResult = this._contextMatchesTrigger(triggerContext, contextConditions, context);
    if (!matchResult.matches) {
      console.log(`  ⏭️  Skipped trigger ${trigger.id}: ${matchResult.reason}`);
      return { triggerId: trigger.id, sent: false, reason: matchResult.reason };
    }

    console.log(`  ✅ Matched trigger ${trigger.id}: ${matchResult.reason}`);

    // ── Enrich context with guest_email from the booking before recipient resolution ──
    // update-status and other system-event APIs only pass status/flag fields in context;
    // they don't include guest_email. We need it here so 'guest_email' recipient triggers
    // can resolve correctly without waiting for _buildSystemTriggerEmailData.
    const enrichedContext = { ...context };
    const isGuestOnly = GUEST_ONLY_CONTEXTS.has(triggerContext);
    const isUserOnly  = USER_ONLY_CONTEXTS.has(triggerContext);

    if (!enrichedContext.guest_email && !isGuestOnly && !isUserOnly && bookingId) {
      try {
        const booking = await BookingEmailDataService.getFullBookingData(bookingId);
        if (booking?.Guest?.email) {
          enrichedContext.guest_email = booking.Guest.email;
        }
      } catch (err) {
        console.warn(`  ⚠️  Could not pre-fetch guest_email for trigger ${trigger.id}:`, err.message);
      }
    }

    const recipient = await this._resolveRecipient(trigger, enrichedContext);
    if (!recipient) {
      console.warn(`  ⚠️  No recipient for trigger ${trigger.id} — skipping`);
      return { triggerId: trigger.id, sent: false, reason: 'No recipient resolved' };
    }

    const emailData = await this._buildSystemTriggerEmailData(trigger, bookingId, enrichedContext);

    await dispatchHttpTaskHandler(
      `${process.env.APP_URL}/api/bookings/service-task`,
      {
        type: 'sendTriggerEmail',
        payload: { trigger_id: trigger.id, booking_id: bookingId, recipient, email_data: emailData },
      }
    );

    await EmailTrigger.update(
      { last_triggered_at: new Date(), trigger_count: (trigger.trigger_count || 0) + 1 },
      { where: { id: trigger.id } }
    );

    return { triggerId: trigger.id, sent: true, recipient };
  }

    /**
     * evaluateAllTriggers
     *
     * Fires BOTH system triggers (evaluated inline via _contextMatchesTrigger)
     * AND booking form triggers (internal/external, evaluated via
     * BookingEmailDataService.sendWithTriggerEvaluation).
     *
     * Call this from update-status when a booking status changes, so that
     * booking form triggers scoped to e.g. booking_status: ['ready_to_process']
     * also fire alongside system triggers for the same event.
     *
     * @param {number} bookingId
     * @param {Object} context  - system trigger context (booking_status, etc.)
     */
    static async evaluateAllTriggers(bookingId, context = {}) {
        console.log(`\n🔍 EmailTriggerService: evaluating ALL triggers for booking ${bookingId}`, context);

        // ── 1. System triggers ────────────────────────────────────────────────────
        const systemResults = await this.evaluateAndSendTriggers(bookingId, context);

        // ── 2. Booking form triggers (internal + external) ────────────────────────
        // Pass booking_status from context so sendWithTriggerEvaluation can match
        // trigger_conditions.booking_status against the current status.
        const bookingFormResult = await this.evaluateBookingFormTriggers(bookingId, context.booking_status || 'default');

        return { system: systemResults, bookingForm: bookingFormResult };
    }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXT MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  static _contextMatchesTrigger(triggerContext, contextConditions, context) {
    const cc = contextConditions || {};

    // ── BOOKING EVENTS ─────────────────────────────────────────────────────

    if (triggerContext === 'booking_status_changed') {
      if (!context.booking_status) {
        return { matches: false, reason: 'No booking_status in context' };
      }

      // 1. booking_status[] — multi-select condition (e.g. ["guest_cancelled"])
      const allowed = cc.booking_status || [];
      if (allowed.length > 0 && !allowed.includes(context.booking_status)) {
        return { matches: false, reason: `booking_status '${context.booking_status}' not in [${allowed.join(', ')}]` };
      }

      // 2. status_to — the new status being transitioned TO
      //    Triggers scoped to "amendment_requested" or "eligible" must NOT fire on "guest_cancelled"
      if (cc.status_to && context.status_to !== cc.status_to) {
        return { matches: false, reason: `status_to '${context.status_to}' does not match required '${cc.status_to}'` };
      }

      // 3. status_from — the previous status being transitioned FROM
      if (cc.status_from && context.status_from !== cc.status_from) {
        return { matches: false, reason: `status_from '${context.status_from}' does not match required '${cc.status_from}'` };
      }

      // 4. is_first_time_guest — boolean guard
      if (cc.is_first_time_guest !== undefined && cc.is_first_time_guest !== null) {
        if (Boolean(context.is_first_time_guest) !== Boolean(cc.is_first_time_guest)) {
          return { matches: false, reason: `is_first_time_guest ${context.is_first_time_guest} does not match required ${cc.is_first_time_guest}` };
        }
      }

      // 5. cancelled_by — so admin-cancellation triggers don't fire on guest-cancellation and vice versa
      if (cc.cancelled_by && context.cancelled_by !== cc.cancelled_by) {
        return { matches: false, reason: `cancelled_by '${context.cancelled_by}' does not match required '${cc.cancelled_by}'` };
      }

      return { matches: true, reason: `booking_status_changed → ${context.booking_status}` };
    }

    if (triggerContext === 'booking_confirmed') {
      if (!context.booking_confirmed) {
        return { matches: false, reason: 'Not a booking_confirmed event' };
      }
      return { matches: true, reason: 'booking_confirmed fired' };
    }

    if (triggerContext === 'booking_cancelled') {
      if (!context.booking_cancelled) {
        return { matches: false, reason: 'Not a booking_cancelled event' };
      }
      if (cc.cancelled_by && context.cancelled_by !== cc.cancelled_by) {
        return {
          matches: false,
          reason: `cancelled_by '${context.cancelled_by}' does not match required '${cc.cancelled_by}'`,
        };
      }
      return { matches: true, reason: `booking_cancelled (cancelled_by: ${context.cancelled_by || 'any'})` };
    }

    if (triggerContext === 'booking_flag_added') {
      if (!context.booking_flag_added) {
        return { matches: false, reason: 'Not a booking_flag_added event' };
      }
      const flagResult = this._checkFlagCondition(cc, context);
      if (!flagResult.matches) return flagResult;
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `booking_flag_added: ${context.flag_value || 'any'}` };
    }

    if (triggerContext === 'booking_eligibility_changed') {
      if (!context.booking_eligibility) {
        return { matches: false, reason: 'No booking_eligibility in context' };
      }
      const allowed = cc.booking_eligibility || [];
      if (allowed.length > 0 && !allowed.includes(context.booking_eligibility)) {
        return { matches: false, reason: `booking_eligibility '${context.booking_eligibility}' not in [${allowed.join(', ')}]` };
      }
      return { matches: true, reason: `booking_eligibility_changed → ${context.booking_eligibility}` };
    }

    // ── GUEST EVENTS ───────────────────────────────────────────────────────

    if (triggerContext === 'account_created') {
      if (!context.account_created) {
        return { matches: false, reason: 'Not an account_created event' };
      }
      return { matches: true, reason: 'account_created fired' };
    }

    if (triggerContext === 'password_reset_requested') {
      if (!context.password_reset_requested) {
        return { matches: false, reason: 'Not a password_reset_requested event' };
      }
      return { matches: true, reason: 'password_reset_requested fired' };
    }

    if (triggerContext === 'email_verification_requested') {
      if (!context.email_verification_requested) {
        return { matches: false, reason: 'Not an email_verification_requested event' };
      }
      return { matches: true, reason: 'email_verification_requested fired' };
    }

    if (triggerContext === 'guest_flag_added') {
      if (!context.guest_flag_added) {
        return { matches: false, reason: 'Not a guest_flag_added event' };
      }
      const flagResult = this._checkFlagCondition(cc, context);
      if (!flagResult.matches) return flagResult;
      return { matches: true, reason: `guest_flag_added: ${context.flag_value || 'any'}` };
    }

    // ── USER (STAFF) EVENTS ────────────────────────────────────────────────

    /**
     * user_account_created
     * context: { user_account_created: true, user_email: '...', username: '...', confirmation_link: '...', role?: '...' }
     * context_conditions: { role?: string }
     *
     * Recipient is context.user_email (the staff member's own email).
     * Template 34 (Team Email Confirmation Link) uses {{username}} and {{confirmation_link}}.
     */
    if (triggerContext === 'user_account_created') {
      if (!context.user_account_created) {
        return { matches: false, reason: 'Not a user_account_created event' };
      }
      if (cc.role && context.role && cc.role !== context.role) {
        return { matches: false, reason: `role '${context.role}' does not match required '${cc.role}'` };
      }
      return { matches: true, reason: `user_account_created (role: ${context.role || 'any'})` };
    }

    // ── ICARE FUNDING ──────────────────────────────────────────────────────

    if (triggerContext === 'icare_funding_updated') {
      if (!context.icare_funding_updated) {
        return { matches: false, reason: 'Not an iCare funding event' };
      }
      if (cc.update_type && context.update_type !== cc.update_type) {
        return { matches: false, reason: `update_type '${context.update_type}' does not match '${cc.update_type}'` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `icare_funding_updated (update_type: ${context.update_type || 'any'})` };
    }

    // ── COURSE EVENTS ──────────────────────────────────────────────────────

    const COURSE_EVENTS = [
      'course_eoi_submitted',
      'course_eoi_accepted',
      'course_offer_sent',
      'course_enrollment_confirmed',
      'course_cancelled',
    ];
    if (COURSE_EVENTS.includes(triggerContext)) {
      if (!context[triggerContext]) {
        return { matches: false, reason: `Not a ${triggerContext} event` };
      }
      if (cc.course_type && context.course_type && cc.course_type !== context.course_type) {
        return { matches: false, reason: `course_type '${context.course_type}' does not match '${cc.course_type}'` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `${triggerContext} fired` };
    }

    // ── ROOM EVENTS ────────────────────────────────────────────────────────

    const ROOM_EVENTS = ['room_assigned', 'room_availability_alert'];
    if (ROOM_EVENTS.includes(triggerContext)) {
      if (!context[triggerContext]) {
        return { matches: false, reason: `Not a ${triggerContext} event` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `${triggerContext} fired` };
    }

    // ── EQUIPMENT EVENTS ───────────────────────────────────────────────────

    const EQUIPMENT_EVENTS = ['equipment_requested', 'equipment_allocated', 'equipment_maintenance_due'];
    if (EQUIPMENT_EVENTS.includes(triggerContext)) {
      if (!context[triggerContext]) {
        return { matches: false, reason: `Not a ${triggerContext} event` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `${triggerContext} fired` };
    }

    // ── PROMOTION EVENTS ───────────────────────────────────────────────────

    const PROMO_EVENTS = ['promotion_code_applied', 'promotion_expiring_soon'];
    if (PROMO_EVENTS.includes(triggerContext)) {
      if (!context[triggerContext]) {
        return { matches: false, reason: `Not a ${triggerContext} event` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `${triggerContext} fired` };
    }

    // ── FUNDING EVENTS (NDIS / general) ───────────────────────────────────

    const FUNDING_EVENTS = ['ndis_plan_updated', 'funding_approval_received'];
    if (FUNDING_EVENTS.includes(triggerContext)) {
      if (!context[triggerContext]) {
        return { matches: false, reason: `Not a ${triggerContext} event` };
      }
      const bsr = this._checkBookingStatusCondition(cc, context);
      if (!bsr.matches) return bsr;
      return { matches: true, reason: `${triggerContext} fired` };
    }

    return {
      matches: false,
      reason: `Unknown trigger_context '${triggerContext}' — no handler registered`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SHARED CONDITION CHECKERS
  // ═══════════════════════════════════════════════════════════════════════════

  static _checkBookingStatusCondition(contextConditions, context) {
    const allowed = contextConditions.booking_status || [];
    if (allowed.length === 0) return { matches: true, reason: 'No booking_status condition' };
    if (!context.booking_status) {
      return { matches: false, reason: 'booking_status condition set but no booking_status in context' };
    }
    if (!allowed.includes(context.booking_status)) {
      return { matches: false, reason: `booking_status '${context.booking_status}' not in [${allowed.join(', ')}]` };
    }
    return { matches: true, reason: `booking_status '${context.booking_status}' matched` };
  }

  /**
   * Flag matching for booking_flag_added / guest_flag_added.
   * context_conditions.flag_value: absent/[] → any; string → exact; array → inclusion.
   * context.flag_value is a single string (the flag just added).
   */
  static _checkFlagCondition(contextConditions, context) {
    const conditionValue = contextConditions.flag_value;
    const noCondition =
      !conditionValue ||
      (Array.isArray(conditionValue) && conditionValue.length === 0);

    if (noCondition) return { matches: true, reason: 'No flag_value condition (fires for any flag)' };

    if (!context.flag_value) {
      return { matches: false, reason: 'flag_value condition set but no flag_value in context' };
    }

    const flagInContext = String(context.flag_value).trim().toLowerCase();

    if (Array.isArray(conditionValue)) {
      const allowed = conditionValue.map(v => String(v).trim().toLowerCase());
      if (!allowed.includes(flagInContext)) {
        return { matches: false, reason: `flag_value '${context.flag_value}' not in [${allowed.join(', ')}]` };
      }
    } else {
      if (flagInContext !== String(conditionValue).trim().toLowerCase()) {
        return { matches: false, reason: `flag_value '${context.flag_value}' does not match '${conditionValue}'` };
      }
    }

    return { matches: true, reason: `flag_value '${context.flag_value}' matched` };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RECIPIENT RESOLUTION
  // ═══════════════════════════════════════════════════════════════════════════

  static async _resolveRecipient(trigger, context = {}) {
    const raw = trigger.recipient;

    // null or '' means no recipient was explicitly configured — skip the trigger.
    // Admins must explicitly choose "Guest Email" (stored as 'guest_email') or a
    // recipient_type / custom email for the trigger to fire.
    if (raw === null || raw === undefined || raw === '') {
      return null;
    }

    if (raw.startsWith('recipient_type:')) {
      const recipientType = raw.split(':')[1];
      try {
        const resolved = await EmailRecipientsService.getRecipientsString(recipientType);
        if (!resolved) console.warn(`⚠️ No recipients for type: ${recipientType}`);
        return resolved || null;
      } catch (err) {
        console.error(`❌ Recipients lookup failed '${recipientType}':`, err.message);
        return null;
      }
    }

    // 'guest_email' — explicitly selected Guest Email in the trigger editor
    if (raw === 'guest_email') {
      return context.guest_email || null;
    }

    // 'user_email' — user_account_created events; recipient is the staff user's own email
    if (raw === 'user_email') {
      return context.user_email || null;
    }

    // Raw email address or comma-separated list of custom emails
    return raw;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MERGE TAG DATA BUILDER
  // ═══════════════════════════════════════════════════════════════════════════

  static async _buildSystemTriggerEmailData(trigger, bookingId, context = {}) {
    const logoBase64 = getLogoBase64();
    const triggerContext = trigger.trigger_context;

    let parsedTags = {};
    let bookingUrl = null;

    const isGuestOnlyEvent = GUEST_ONLY_CONTEXTS.has(triggerContext);
    const isUserOnlyEvent  = USER_ONLY_CONTEXTS.has(triggerContext);

    if (!isGuestOnlyEvent && !isUserOnlyEvent && bookingId) {
      try {
        const booking = await BookingEmailDataService.getFullBookingData(bookingId);
        if (booking) {
          parsedTags = EmailDataParsingService.parseAllData(booking);
          bookingUrl = `${process.env.APP_URL}/bookings/${booking.uuid}`;
        }
      } catch (err) {
        console.warn(`⚠️ Could not fetch booking ${bookingId} for trigger ${trigger.id}:`, err.message);
      }
    }

    const systemExtras = {
      logo_base64:   logoBase64,
      template_name: trigger.template?.name || '',
      booking_url:   bookingUrl,
      booking_link:  bookingUrl,
    };

    const contextOverrides = { ...context };

    if (context.booking_status) {
      contextOverrides.status_name    = context.booking_status;
      contextOverrides.booking_status = context.booking_status;
    }
    if (context.flag_value) {
      contextOverrides.flag_value = context.flag_value;
      contextOverrides.flag_label = context.flag_value
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
    }
    // user_account_created: ensure template tags are available
    if (isUserOnlyEvent) {
      contextOverrides.username          = context.username          || context.user_email || '';
      contextOverrides.confirmation_link = context.confirmation_link || '';
      // Expose user_email as guest_email alias so any recipient-resolution fallback works
      contextOverrides.guest_email       = context.user_email        || '';
    }

    return { ...parsedTags, ...systemExtras, ...contextOverrides };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // DB HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static async getAllTriggers() {
    // ⚠️ evaluateAndSendTriggers is the SYSTEM trigger entry point only.
    // Booking form triggers (internal / external) are handled exclusively by
    // BookingEmailDataService.sendWithTriggerEvaluation called from save-qa-pair.
    return EmailTrigger.findAll({
      where: { enabled: true, type: 'system' },
      include: [{ model: EmailTemplate, as: 'template' }],
      order: [['priority', 'ASC'], ['id', 'ASC']],
    });
  }

  static async getTriggersByType(type) {
    return EmailTrigger.findAll({
      where: { type, enabled: true },
      include: [{ model: EmailTemplate, as: 'template' }],
      order: [['priority', 'ASC']],
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING FORM TRIGGER EVALUATION (called from evaluateEmailTriggers task)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Evaluate ALL booking form triggers (internal + external) for a booking.
   *
   * This is the ONLY method that should be called from the `evaluateEmailTriggers`
   * service-task, which is dispatched exclusively by save-qa-pair.
   *
   * System triggers must NOT be evaluated here — they are fired directly from
   * their respective API routes via evaluateAndSendTriggers().
   *
   * @param {number} bookingId
   * @param {string} context  optional context hint ('default' | 'on_submit' | 'on_booking_confirmed')
   */
  static async evaluateBookingFormTriggers(bookingId, context = 'default') {
    // Accept either a string hint (legacy: 'default'/'on_submit') or a full context object
    const contextObj = typeof context === 'string' ? { context } : context;

    console.log(`\n📋 EmailTriggerService.evaluateBookingFormTriggers: booking ${bookingId}`, contextObj);

    const triggers = await EmailTrigger.findAll({
        where: { enabled: true, type: ['internal', 'external'] },
        include: [
            { model: EmailTemplate, as: 'template', required: false },
            {
                model: EmailTriggerQuestion,
                as: 'triggerQuestions',
                required: false,
                include: [{ model: Question, as: 'question', required: false }]
            }
        ],
        order: [['priority', 'ASC'], ['id', 'ASC']],
    });

    console.log(`📋 Found ${triggers.length} enabled booking form triggers`);

    const results = await Promise.allSettled(
        triggers.map(t => BookingEmailDataService.sendWithTriggerEvaluation(t, bookingId, contextObj))
    );

    const sent    = results.filter(r => r.status === 'fulfilled' && r.value?.sent).length;
    const skipped = results.filter(r => r.status === 'fulfilled' && !r.value?.sent).length;
    const errored = results.filter(r => r.status === 'rejected').length;

    console.log(`✅ Booking form triggers done: ${sent} sent, ${skipped} skipped, ${errored} errors\n`);

    return { queued: sent, skipped, errored, total: triggers.length };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PASSTHROUGH HELPERS (kept for direct single-type use if needed)
  // ═══════════════════════════════════════════════════════════════════════════

  static async processInternalTriggers(bookingId, context = {}) {
    const triggers = await this.getTriggersByType('internal');
    return Promise.all(
      triggers.map(t => BookingEmailDataService.sendWithTriggerEvaluation(t, bookingId, context))
    );
  }

  static async processExternalTriggers(bookingId, context = {}) {
    const triggers = await this.getTriggersByType('external');
    return Promise.all(
      triggers.map(t => BookingEmailDataService.sendWithTriggerEvaluation(t, bookingId, context))
    );
  }
}

export default EmailTriggerService;