import EmailDataParsingService from '../EmailDataParsingService';
import {
  Booking, Guest, Room, RoomType, FundingApproval,
  Section, QaPair, Question, EmailTrigger
} from '../../models';
import { dispatchHttpTaskHandler } from '../queues/dispatchHttpTask.js';
import { getPublicDir } from '../../lib/paths.js';
import fs from 'fs';
import path from 'path';
import AuditLogService from '../AuditLogService.js';

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

/**
 * BookingEmailDataService
 *
 * Responsible for:
 *   1. Fetching booking with all DIRECT associations (getFullBookingData)
 *   2. Delegating enrichment to EmailDataParsingService.enrichBookingData()
 *      to resolve indirect associations (Package, Course) from QaPair answers
 *   3. Evaluating booking_form / internal / external triggers
 *   4. Dispatching sendTriggerEmail tasks
 *
 * All merge tag parsing and enrich logic lives in EmailDataParsingService.
 *
 * ── Association map ──────────────────────────────────────────────────────────
 * Direct Booking associations (safe to include in findByPk):
 *   Guest              → Guest.fundingApprovals  ← FundingApproval belongs to Guest, NOT Booking
 *   Rooms              → RoomType
 *   Sections           → QaPairs → Question
 *
 * Indirect (resolved from QaPair answers by EmailDataParsingService):
 *   Package   (question_type = 'package-selection',  answer = package_id)
 *   Course    (question_type = 'horizontal-card', option_type = 'course', answer = course_id)
 */
class BookingEmailDataService {

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Fetch booking with all relations needed for email generation.
   *
   * ⚠️ FundingApproval is included nested under Guest (as 'fundingApprovals'),
   *    NOT as a direct Booking include — there is no Booking → FundingApproval
   *    association in models.
   *
   * After fetching, calls EmailDataParsingService.enrichBookingData() to
   * resolve and attach Package and Course from QaPair answers.
   *
   * @param {Number} bookingId
   * @returns {Object} Booking instance with all relations populated
   */
  static async getFullBookingData(bookingId) {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [
          {
            model: Guest,
            as: 'Guest',
            include: [
              // ⚠️ FundingApproval belongs to Guest, not Booking
              {
                model: FundingApproval,
                as: 'fundingApprovals'
              }
            ]
          },
          {
            model: Room,
            as: 'Rooms',
            include: [
              {
                model: RoomType,
                as: 'RoomType'
              }
            ]
          },
          {
            model: Section,
            as: 'Sections',
            include: [
              {
                model: QaPair,
                as: 'QaPairs',
                include: [
                  {
                    model: Question,
                    as: 'Question'
                  }
                ]
              }
            ]
          }
        ]
      });

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      // Resolve Package and Course from QaPair answers (no direct FK on Booking)
      const qaPairs = booking.Sections?.flatMap(s => s.QaPairs || []) || [];
      await EmailDataParsingService.enrichBookingData(booking, qaPairs);

      return booking;
    } catch (error) {
      console.error('Error fetching booking data:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIGGER EVALUATION
  // ═══════════════════════════════════════════════════════════════════════════

  static async sendWithTriggerEvaluation(trigger, bookingId, context = {}) {
    console.log(`\n  📋 Evaluating trigger #${trigger.id} [${trigger.type}] "${trigger.description}"`);

    const bookingData = await this.getFullBookingData(bookingId);
    if (!bookingData) {
      return { triggerId: trigger.id, sent: false, reason: 'Booking not found' };
    }

    // ── 1. booking_status condition ──────────────────────────────────────────
    const allowedStatuses = (trigger.trigger_conditions || {}).booking_status || [];
    if (allowedStatuses.length > 0) {
      // Status may be a JSON string '{"name":"ready_to_process",...}' or a plain string or an object
      let statusValue = bookingData.status;
      if (typeof statusValue === 'string' && statusValue.startsWith('{')) {
        try { statusValue = JSON.parse(statusValue); } catch (e) { /* leave as string */ }
      }
      const bookingStatusName = statusValue?.name ?? statusValue;

      if (!allowedStatuses.includes(bookingStatusName)) {
        console.log(`  ⏭️  Skipped #${trigger.id}: status '${bookingStatusName}' not in [${allowedStatuses.join(', ')}]`);
        return { triggerId: trigger.id, sent: false, reason: `booking_status '${bookingStatusName}' not in allowed list` };
      }
      console.log(`  ✅ Status check passed: '${bookingStatusName}'`);
    }

    // ── 2. triggerQuestions conditions ───────────────────────────────────────
    const triggerQuestions = trigger.triggerQuestions || trigger.trigger_questions || [];
    if (triggerQuestions.length > 0) {
      const qaPairs = bookingData.Sections?.flatMap(s => s.QaPairs || []) || [];
      console.log(`  🔍 Checking ${triggerQuestions.length} trigger question(s) against ${qaPairs.length} QA pair(s)`);

      for (const tq of triggerQuestions) {
        if (tq.answer === null || tq.answer === undefined) continue;

        const matchedQa = EmailDataParsingService.findQaPairWithFallback(qaPairs, tq);
        if (!matchedQa) {
          console.log(`  ⏭️  Skipped #${trigger.id}: question ${tq.question_id} not found`);
          return { triggerId: trigger.id, sent: false, reason: `Question ${tq.question_id} not found` };
        }

        if (!EmailDataParsingService.answersMatch(matchedQa.answer, tq.answer)) {
          console.log(`  ⏭️  Skipped #${trigger.id}: answer mismatch for question ${tq.question_id} (actual: "${matchedQa.answer}", expected: "${tq.answer}")`);
          return { triggerId: trigger.id, sent: false, reason: `Answer mismatch for question ${tq.question_id}` };
        }
        console.log(`  ✅ Question ${tq.question_id} matched`);
      }
    }

    // ── 3. Resolve recipient ─────────────────────────────────────────────────
    const recipient = await this._resolveRecipient(trigger, bookingData, context);
    if (!recipient) {
      return { triggerId: trigger.id, sent: false, reason: 'No recipient resolved' };
    }

    // ── 4. Build email data ──────────────────────────────────────────────────
    const emailData = EmailDataParsingService.parseAllData(bookingData);
    // emailData.logo_base64    = getLogoBase64();
    emailData.status_name    = context.booking_status || bookingData.status_name || null;
    emailData.booking_status = context.booking_status || bookingData.status || null;

    // ── 5. Dispatch ──────────────────────────────────────────────────────────
    await dispatchHttpTaskHandler(
      `${process.env.APP_URL}/api/bookings/service-task`,
      { type: 'sendTriggerEmail', payload: { trigger_id: trigger.id, booking_id: bookingId, recipient, email_data: emailData } }
    );

    await EmailTrigger.update(
      { last_triggered_at: new Date(), trigger_count: (trigger.trigger_count || 0) + 1 },
      { where: { id: trigger.id } }
    );

    console.log(`  ✅ Trigger #${trigger.id} dispatched → ${recipient}`);
    return { triggerId: trigger.id, sent: true, recipient };
  }

  static async _resolveRecipient(trigger, bookingData, context = {}) {
    const raw = trigger.recipient;

    if (raw?.startsWith('recipient_type:')) {
      const recipientType = raw.split(':')[1];
      try {
        const { default: EmailRecipientsService } = await import('../email/EmailRecipientsService.js');
        return await EmailRecipientsService.getRecipientsString(recipientType) || null;
      } catch (err) {
        console.error(`❌ Recipients lookup failed for '${raw}':`, err.message);
        return null;
      }
    }

    // For external triggers with no explicit recipient configured, resolve the
    // recipient from the trigger question of type 'email' — i.e. use the answer
    // the guest provided (e.g. "icare Coordinator Email Address") as the TO address.
    if (!raw && trigger.type === 'external') {
      const emailQuestion = (trigger.triggerQuestions || trigger.trigger_questions || [])
        .find(tq => tq.question?.type === 'email');

      if (emailQuestion) {
        const qaPairs = bookingData.Sections?.flatMap(s => s.QaPairs || []) || [];
        const matchedQa = qaPairs.find(qa => qa.question_id === emailQuestion.question_id);
        const resolvedEmail = matchedQa?.answer?.trim() || null;

        if (resolvedEmail) {
          console.log(`  📧 External trigger #${trigger.id}: recipient resolved from question ${emailQuestion.question_id} → ${resolvedEmail}`);
          return resolvedEmail;
        } else {
          console.warn(`  ⚠️  External trigger #${trigger.id}: email question ${emailQuestion.question_id} found but has no answer in QaPairs`);
          return null;
        }
      }
    }

    if (!raw || raw === 'guest_email') {
      return bookingData.Guest?.email || context.guest_email || null;
    }

    return raw;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════════════════════════════════

  static async logEmailSend(bookingData, emailInfo) {
  try {
    const {
      success, recipients, templateId, templateName,
      triggerType, triggerId, triggerName,
      error, reason, emailData,
    } = emailInfo;

    const recipientList = Array.isArray(recipients) ? recipients : (recipients ? [recipients] : []);

    const description = success
      ? recipientList.length === 1
        ? `Email sent to ${recipientList[0]}`
        : `Email sent to ${recipientList.length} recipients`
      : `Email send failed: ${reason || error || 'Unknown error'}`;

    const metadata = {
      email_template_id:   templateId,
      email_template_name: templateName,
      recipients:          recipientList,
      recipient_count:     recipientList.length,
      trigger_type:        triggerType,
      trigger_id:          triggerId,
      trigger_name:        triggerName,
      timestamp:           new Date(),
      success,
      error_message:       error  || null,
      failure_reason:      reason || null,
    };

    if (emailData?.subject) metadata.email_subject = emailData.subject;

    await AuditLogService.createAuditEntry({
      bookingId:   bookingData.id,
      userId:      null,
      guestId:     null,
      actionType:  success ? 'email_sent' : 'email_failed',
      userType:    'system',
      description,
      oldValue:    null,
      newValue:    { recipients: recipientList, template_id: templateId, trigger_id: triggerId },
      category:    'Email',
      metadata,
    });

    console.log(`✅ Email audit logged: ${description}`);
  } catch (auditError) {
    console.error('⚠️ Failed to log email audit (non-critical):', auditError.message);
  }
}

  // ═══════════════════════════════════════════════════════════════════════════
  // PARSING DELEGATES
  // ═══════════════════════════════════════════════════════════════════════════

  static parseBookingData(bookingData)          { return EmailDataParsingService.parseAllData(bookingData); }
  static async resolveEmailTemplate(t, d)       { return EmailDataParsingService.resolveTemplate(t, this.parseBookingData(d)); }
  static getAvailableTags(bookingData)          { return EmailDataParsingService.getAvailableTags(this.parseBookingData(bookingData)); }
  static parseGuest(guest)                      { return EmailDataParsingService.parseGuestData(guest); }
  static parseBooking(booking)                  { return EmailDataParsingService.parseBookingData(booking); }
  static parseCourse(course)                    { return EmailDataParsingService.parseCourseData(course); }
  static parsePackage(packageData)              { return EmailDataParsingService.parsePackageData(packageData); }
  static parsePromotion(promotion)              { return EmailDataParsingService.parsePromotionData(promotion); }
  static parseRoomType(roomType)                { return EmailDataParsingService.parseRoomTypeData(roomType); }
  static parseFundingApproval(fundingApproval)  { return EmailDataParsingService.parseFundingApprovalData(fundingApproval); }
  static parseProperty()                        { return EmailDataParsingService.parsePropertyData(); }

  // ─── Legacy ───────────────────────────────────────────────────────────────
  static async enrichBookingData(bookingId) {
    return this.parseBookingData(await this.getFullBookingData(bookingId));
  }
}

export default BookingEmailDataService;