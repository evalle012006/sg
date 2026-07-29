import Stripe from 'stripe';
import { PaymentLink, Booking, Guest, Room, RoomType } from '../../../../models';
import { markPaymentLinkPaidAndNotify, regenerateStripeSessionForPaymentLink } from '../../../../services/booking/paymentLinkService';
import { Op } from 'sequelize';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { uuid } = req.query;

  const link = await PaymentLink.findOne({
    where: { uuid },
    include: [{
      model: Booking,
      include: [
        { model: Room, include: [RoomType] },
        { model: Guest },
      ],
    }],
  });

  if (!link) {
    return res.status(404).json({ error: 'not_found', message: 'Payment link not found.' });
  }

  // ── AC4: booking cancelled takes priority over everything else ──────
  if (link.Booking && ['booking_cancelled', 'guest_cancelled'].includes(link.Booking.status_name)) {
    return res.status(200).json({
      status: 'booking_cancelled',
      message: 'This booking has been cancelled. If you believe this is an error, please contact Sargood on Collaroy at bookings@sargoodoncollaroy.com.au or call (02) 9971 0522.',
    });
  }

  // ── Business deadline expiry check ───────────────────────────────────
  if (link.status === 'pending' && new Date() > new Date(link.expires_at)) {
    await PaymentLink.update({ status: 'expired' }, { where: { uuid } });
    link.status = 'expired';
  }

  // ── Already paid ──────────────────────────────────────────────────────
  if (link.status === 'paid') {
    let receiptUrl = null;

    if (link.stripe_payment_intent) {
      try {
        const pi = await stripe.paymentIntents.retrieve(link.stripe_payment_intent, {
          expand: ['latest_charge'],
        });
        receiptUrl = pi.latest_charge?.receipt_url || null;
      } catch (err) {
        console.warn(`⚠️ Could not retrieve receipt for payment_intent ${link.stripe_payment_intent}:`, err.message);
      }
    }

    return res.status(200).json({
      status: 'paid',
      booking: {
        reference_id: link.Booking?.reference_id,
        check_in:     link.Booking?.preferred_arrival_date,
        check_out:    link.Booking?.preferred_departure_date,
        guest_name:   link.Booking?.Guest?.first_name,
      },
      amountCents: link.amount_cents,
      currency:    link.currency,
      receiptUrl,
    });
  }

  // ── Expired (business deadline) or cancelled link ────────────────────
  if (link.status === 'expired' || link.status === 'cancelled') {
    return res.status(200).json({
      status: link.status,
      message: 'This payment link has expired or is no longer valid. Please contact Sargood on Collaroy at bookings@sargoodoncollaroy.com.au or call (02) 9971 0522.',
    });
  }

  if (link.status === 'deadline_cancelled') {
    return res.status(200).json({
      status: 'deadline_cancelled',
      message: 'This booking was automatically cancelled because payment was not received before the deadline. Please contact Sargood on Collaroy at bookings@sargoodoncollaroy.com.au or call (02) 9971 0522 if you believe this is an error.',
    });
  }

  // ── Still within business deadline — check/regenerate Stripe session ──
  let session = await stripe.checkout.sessions.retrieve(link.stripe_session_id);

  if (session.payment_status === 'paid') {
    // Webhook missed or delayed — reconcile via the same path the webhook
    // itself uses, so a self-healed payment gets identical treatment
    // (DB update + guest receipt email) regardless of which mechanism
    // discovers it first.
    await markPaymentLinkPaidAndNotify({
      stripeSessionId:     link.stripe_session_id,
      stripePaymentIntent: session.payment_intent,
      bookingId:           link.booking_id,
    });

    console.log(`✅ payment-link/[uuid]: self-healed booking ${link.booking_id} via reconciliation (session ${link.stripe_session_id})`);

    const updatedLink = await PaymentLink.findOne({
      where: { uuid },
      include: [{ model: Booking, include: [{ model: Guest }] }],
    });

    let receiptUrl = null;
    try {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent, { expand: ['latest_charge'] });
      receiptUrl = pi.latest_charge?.receipt_url || null;
    } catch (err) {
      console.warn(`⚠️ Could not retrieve receipt for payment_intent ${session.payment_intent}:`, err.message);
    }

    return res.status(200).json({
      status: 'paid',
      booking: {
        reference_id: updatedLink.Booking?.reference_id,
        check_in:     updatedLink.Booking?.preferred_arrival_date,
        check_out:    updatedLink.Booking?.preferred_departure_date,
        guest_name:   updatedLink.Booking?.Guest?.first_name,
      },
      amountCents: updatedLink.amount_cents,
      currency:    updatedLink.currency,
      receiptUrl,
    });
  }

  if (session.status !== 'open') {
    // AC2: Stripe session itself is dead (expired/complete-without-pay) but
    // our business deadline hasn't passed — transparently issue a fresh
    // session behind the same link so the guest can retry without any
    // manual intervention or re-entering booking details.
    console.log(`💳 payment-link/[uuid]: Stripe session ${link.stripe_session_id} is ${session.status} — regenerating for link ${uuid}`);
    session = await regenerateStripeSessionForPaymentLink(link);
  }

  return res.status(200).json({
    status:    'pending',
    url:       session.url,
    amount:    link.amount_cents,
    currency:  link.currency,
    expiresAt: link.expires_at,
  });
}