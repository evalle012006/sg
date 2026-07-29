import Stripe from 'stripe';
import { Op } from 'sequelize';
import { Booking, PaymentLink, StripeWebhookEvent, Guest } from '../../../models';
import AuditLogService from '../../../services/AuditLogService';
import moment from 'moment';
import EmailService from '../../../services/booking/emailService';
import { TEMPLATE_IDS } from '../../../services/booking/templateIds';
import { markPaymentLinkPaidAndNotify, markRefundSucceededAndNotify } from '../../../services/booking/paymentLinkService';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Next.js must not parse the body — Stripe needs the raw bytes to verify the signature
export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  const rawBody = Buffer.concat(chunks);
  const sig     = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('⚠️ Stripe webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ── AC4: idempotency guard — record every verified event exactly once. ──
  // Also doubles as the durable event log referenced in AC3: this table is
  // an audit trail of every Stripe event received, independent of the
  // per-booking BookingAuditLog entries created below.
  let created;
  try {
    const result = await StripeWebhookEvent.findOrCreate({
      where: { event_id: event.id },
      defaults: { event_type: event.type, processed_at: new Date() },
    });
    created = result[1];
  } catch (dedupErr) {
    // If the dedup check itself fails (e.g. DB hiccup), fail safe by
    // proceeding rather than silently dropping a legitimate event — but log
    // loudly, since this means idempotency isn't actually guaranteed for
    // this particular delivery.
    console.error('❌ Webhook dedup check failed — proceeding without idempotency guarantee for this event:', dedupErr.message, { eventId: event.id });
    created = true;
  }

  if (!created) {
    console.log(`⏭️ Webhook event ${event.id} already processed — skipping (duplicate delivery)`);
    return res.status(200).json({ received: true, duplicate: true });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const bookingId = parseInt(session.metadata?.booking_id);

        if (!bookingId) {
          console.error('❌ Stripe webhook: no booking_id in session metadata', { sessionId: session.id });
          break;
        }

        const { bookingAffected } = await markPaymentLinkPaidAndNotify({
          stripeSessionId:      session.id,
          stripePaymentIntent:  session.payment_intent,
          bookingId,
        });

        try {
          await AuditLogService.logStatusChange({
            bookingId,
            userId: null,
            guestId: null,
            userType: 'system',
            oldStatus: 'payment_pending',
            newStatus: 'payment_paid',
            metadata: { stripeEventId: event.id, paymentIntent: session.payment_intent, sessionId: session.id },
          });
        } catch (auditErr) {
          console.warn('⚠️ Audit log write failed (non-fatal):', auditErr.message);
        }

        break;
      }

      case 'checkout.session.expired': {
        const session = event.data.object;
        // Don't mark the PaymentLink itself as expired here — a dead Stripe
        // session just means the guest needs a new one, not that their
        // payment window (business deadline) is over. /payment/[uuid].js
        // handles session regeneration transparently; only the business
        // deadline check there should ever set status to 'expired'.
        console.log(`⏰ Stripe checkout session expired (session-level only, link stays pending): ${session.id}`);
        break;
      }

      case 'payment_intent.payment_failed': {
        const paymentIntent = event.data.object;
        let bookingId = parseInt(paymentIntent.metadata?.booking_id);
        
        if (!bookingId) {
          // Fallback: find the PaymentLink by matching payment_intent, or by
          // looking up the session that owns this PaymentIntent, since
          // metadata propagation from Session → PaymentIntent isn't always
          // guaranteed depending on how the session was created.
          const sessions = await stripe.checkout.sessions.list({ payment_intent: paymentIntent.id, limit: 1 });
          const session = sessions.data[0];
          bookingId = parseInt(session?.metadata?.booking_id);
        }

        if (!bookingId) {
          console.error('❌ payment_intent.payment_failed: no booking_id in metadata', { paymentIntentId: paymentIntent.id });
          break;
        }

        // Guard against downgrading a link that a later event has already
        // marked paid (out-of-order delivery protection).
        const [affected] = await PaymentLink.update(
          { status: 'failed' },
          { where: { booking_id: bookingId, status: { [Op.ne]: 'paid' } } }
        );

        const failureReason = paymentIntent.last_payment_error?.message || 'unknown';
        console.log(`💳 Payment failed for booking ${bookingId}: ${affected} link(s) marked failed. Reason: ${failureReason}`);

        try {
          await AuditLogService.logStatusChange({
            bookingId,
            userId: null,
            guestId: null,
            userType: 'system',
            oldStatus: 'payment_pending',
            newStatus: 'payment_failed',
            reason: failureReason,
            metadata: { stripeEventId: event.id, paymentIntentId: paymentIntent.id },
          });
        } catch (auditErr) {
          console.warn('⚠️ Audit log write failed (non-fatal):', auditErr.message);
        }

        break;
      }

      case 'charge.refunded': {
        const charge = event.data.object;
        const stripeRefundId = charge.refunds?.data?.[0]?.id; // most recent refund on this charge
        const bookingId = parseInt(charge.metadata?.booking_id);

        if (!stripeRefundId || !bookingId) {
          console.error('❌ charge.refunded: missing refund id or booking_id', { chargeId: charge.id });
          break;
        }

        await markRefundSucceededAndNotify({ stripeRefundId, bookingId });
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err) {
    console.error('❌ Webhook handler error:', err, { eventType: event.type, eventId: event.id });
    return res.status(500).json({ error: 'Webhook processing failed' });
  }

  // Always return 200 — Stripe retries on non-2xx
  return res.status(200).json({ received: true });
}