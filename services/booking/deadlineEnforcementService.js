// services/booking/deadlineEnforcementService.js

import { Op } from 'sequelize';
import moment from 'moment';
import { Booking, PaymentLink, Guest, Setting } from '../../models';
import EmailService from './emailService';
import { TEMPLATE_IDS } from './templateIds';
import { parseReminderSchedule } from '../../utilities/reminderSchedule';
import AuditLogService from '../AuditLogService';

const DEFAULT_REMINDER_SCHEDULE = '48h,24h';

async function getReminderSchedule() {
    const setting = await Setting.findOne({ where: { attribute: 'AOB_REMINDER_HOURS' } });
    return parseReminderSchedule(setting?.value || DEFAULT_REMINDER_SCHEDULE);
}

/**
 * Core scheduled check for AOB-24 (deadline enforcement) and AOB-25 (reminders).
 * Scans all approved-but-unpaid AOB bookings with a payment link on file and,
 * per booking: either cancels it (deadline passed) or sends any reminder
 * emails whose threshold has been crossed but not yet sent.
 *
 * Intended to be invoked by a scheduled process (cron, or an internal
 * token-protected API route triggered by cron), not by normal request
 * handlers — this does its own batch scan rather than acting on one booking.
 */
export async function runDeadlineEnforcementSweep() {
    const now = new Date();
    const schedule = await getReminderSchedule();

    const bookings = await Booking.findAll({
        where: {
            booking_type: 'accommodation_only',
            status_name: 'booking_confirmed',
            payment_status: { [Op.or]: [{ [Op.ne]: 'paid' }, { [Op.is]: null }] },
            deleted_at: null,
        },
        attributes: ['id', 'uuid', 'reference_id', 'status_name', 'preferred_arrival_date', 'guest_id'],
        include: [{ model: Guest, attributes: ['first_name', 'email'] }],
        order: [['submitted_at', 'ASC']], // batch by submission order, oldest first
    });

    console.log(`⏰ Deadline sweep: checking ${bookings.length} approved-unpaid AOB booking(s)`);

    let cancelledCount = 0;
    let reminderCount = 0;

    for (const booking of bookings) {
        const paymentLink = await PaymentLink.findOne({
            where: { booking_id: booking.id },
            order: [['created_at', 'DESC']],
        });

        // No link ever created for a confirmed AOB booking is an inconsistent
        // state (createPaymentLinkForBooking should have fired on approval) —
        // log it loudly rather than silently skip, since it likely means the
        // AOB-22 auto-send failed for this booking at some point.
        if (!paymentLink) {
            console.warn(`⚠️ Deadline sweep: booking ${booking.id} is confirmed+unpaid but has no PaymentLink on file — skipping`);
            continue;
        }

        // Already permanently resolved — nothing further to do for this booking.
        if (paymentLink.status === 'deadline_cancelled') {
            continue;
        }

        const deadline = new Date(paymentLink.expires_at);

        if (now >= deadline) {
            await cancelBookingForMissedDeadline(booking, paymentLink);
            cancelledCount++;
            continue;
        }

        // Not yet past deadline — check reminder thresholds.
        const remindersSent = paymentLink.reminders_sent || [];

        for (const { raw, offsetMs } of schedule) {
            const reminderFireTime = new Date(deadline.getTime() - offsetMs);
            const alreadySent = remindersSent.includes(raw);

            if (!alreadySent && now >= reminderFireTime) {
                await sendPaymentReminder(booking, paymentLink, raw);
                const updated = [...remindersSent, raw];
                await PaymentLink.update({ reminders_sent: updated }, { where: { id: paymentLink.id } });
                reminderCount++;
            }
        }
    }

    console.log(`⏰ Deadline sweep complete: ${cancelledCount} cancelled, ${reminderCount} reminder(s) sent`);
    return { checked: bookings.length, cancelled: cancelledCount, remindersSent: reminderCount };
}

async function cancelBookingForMissedDeadline(booking, paymentLink) {
    const cancelledStatus = {
        name: 'deadline_cancelled',
        label: 'Cancelled - Payment Not Received',
        color: 'red',
    };

    await Booking.update(
        { status: JSON.stringify(cancelledStatus), status_name: cancelledStatus.name },
        { where: { id: booking.id } }
    );

    // Terminal, non-regenerable — distinct from 'expired' (which /payment/[uuid].js
    // will transparently regenerate) and from 'cancelled' (link superseded by a resend).
    await PaymentLink.update(
        { status: 'deadline_cancelled' },
        { where: { id: paymentLink.id } }
    );

    console.log(`🚫 Auto-cancelled booking ${booking.id} — payment not received before deadline`);

    try {
        await AuditLogService.logStatusChange({
            bookingId: booking.id,
            userId: null,
            guestId: null,
            userType: 'system',
            oldStatus: 'booking_confirmed',
            newStatus: 'deadline_cancelled',
            reason: 'Automatically cancelled — payment not received within 48-hour deadline',
        });
    } catch (auditErr) {
        console.warn('⚠️ Audit log write failed (non-fatal):', auditErr.message);
    }

    if (booking.Guest?.email) {
        try {
            await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_DEADLINE_CANCELLED, {
                guest_name:  booking.Guest.first_name,
                booking_ref: booking.reference_id,
            });
            console.log(`📧 Deadline-cancellation email sent for booking ${booking.id}`);
        } catch (emailErr) {
            console.warn(`⚠️ Deadline-cancellation email failed (non-fatal):`, emailErr.message);
        }
    }
}

async function sendPaymentReminder(booking, paymentLink, thresholdLabel) {
    if (!booking.Guest?.email) {
        console.warn(`⚠️ Cannot send reminder for booking ${booking.id} — no guest email on file`);
        return;
    }

    const amount = `AUD ${(paymentLink.amount_cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const deadline = moment(paymentLink.expires_at).format('dddd D MMMM YYYY [at] h:mm A');
    const paymentUrl = `${process.env.APP_URL}/payment/${paymentLink.uuid}`;

    await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_PAYMENT_REMINDER, {
        guest_name:  booking.Guest.first_name,
        booking_ref: booking.reference_id,
        amount,
        deadline,
        payment_url: paymentUrl,
    });

    console.log(`📧 Reminder (${thresholdLabel}) sent for booking ${booking.id}`);
}