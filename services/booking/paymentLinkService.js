// services/booking/paymentLinkService.js
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { Op } from 'sequelize';
import { Booking, PaymentLink, Guest, Room, RoomType, Refund } from '../../models';
import EmailService from './emailService';
import { TEMPLATE_IDS } from './templateIds';
import moment from 'moment';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Creates a new Stripe Checkout session for a booking's given payment link UUID
 * and amount. Does NOT touch the database — callers are responsible for
 * persisting the returned session id against the correct PaymentLink row.
 * Shared by: initial link creation (admin/auto-trigger) and guest-facing
 * session regeneration when a previously-issued session has expired.
 */
async function createStripeCheckoutSession({ booking, paymentLinkUuid, totalCents, nights, businessDeadline }) {
    const appUrl = process.env.APP_URL;
    const stripeExpiresAt = moment().add(23, 'hours').toDate();

    return stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer_email: booking.Guest?.email,
        line_items: [{
            quantity: 1,
            price_data: {
                currency: 'aud',
                unit_amount: totalCents,
                product_data: {
                    name: `Sargood on Collaroy — ${nights} night${nights > 1 ? 's' : ''} accommodation`,
                    description: booking.preferred_arrival_date && booking.preferred_departure_date
                        ? `${moment(booking.preferred_arrival_date).format('DD MMM YYYY')} – ${moment(booking.preferred_departure_date).format('DD MMM YYYY')}`
                        : undefined,
                },
            },
        }],
        success_url: `${appUrl}/payment/${paymentLinkUuid}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${appUrl}/payment/${paymentLinkUuid}?cancelled=true`,
        expires_at:  Math.floor(stripeExpiresAt.getTime() / 1000),
        metadata: { booking_uuid: booking.uuid, booking_id: String(booking.id) },
        payment_intent_data: {
           metadata: { booking_uuid: booking.uuid, booking_id: String(booking.id) },
       },
    });
}

export async function createPaymentLinkForBooking(bookingUuid) {
    console.log(`\n💳 PaymentLinkService: creating payment link for booking ${bookingUuid}`);

    const booking = await Booking.findOne({
        where: { uuid: bookingUuid, booking_type: 'accommodation_only' },
        attributes: ['id', 'uuid', 'reference_id', 'status_name', 'preferred_arrival_date', 'preferred_departure_date', 'guest_id'],
        include: [{ model: Guest }, { model: Room, include: [RoomType] }],
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.status_name !== 'booking_confirmed') {
        throw new Error('Booking must be confirmed before payment can be requested');
    }

    await PaymentLink.update(
        { status: 'cancelled' },
        { where: { booking_id: booking.id, status: 'pending' } }
    );
    console.log(`💳 PaymentLinkService: cancelled existing pending payment links for booking ${bookingUuid}`);

    const nights = booking.preferred_departure_date && booking.preferred_arrival_date
        ? moment(booking.preferred_departure_date).diff(moment(booking.preferred_arrival_date), 'days')
        : 0;
    if (nights <= 0) throw new Error('Cannot calculate nights from booking dates');

    const totalCents = booking.Rooms.reduce((sum, room) => {
        const rate = room.RoomType?.price_per_night || 0;
        return sum + Math.round(rate * 100) * nights;
    }, 0);
    if (totalCents <= 0) throw new Error('Calculated total is zero — check room rates');

    console.log(`💳 PaymentLinkService: calculated total for booking ${bookingUuid} is ${totalCents} cents`);

    const businessDeadline = moment(booking.preferred_arrival_date).subtract(48, 'hours').toDate();
    if (new Date() > businessDeadline) {
        throw new Error('Check-in is less than 48 hours away — cannot issue payment link');
    }
    console.log(`💳 PaymentLinkService: payment link deadline for booking ${bookingUuid} is ${businessDeadline.toISOString()}`);

    const appUrl = process.env.APP_URL;
    const paymentLinkUuid = uuidv4();

    const checkoutSession = await createStripeCheckoutSession({
        booking, paymentLinkUuid, totalCents, nights, businessDeadline,
    });

    const paymentLink = await PaymentLink.create({
        uuid:              paymentLinkUuid,
        booking_id:        booking.id,
        stripe_session_id: checkoutSession.id,
        amount_cents:      totalCents,
        currency:          'aud',
        status:            'pending',
        expires_at:        businessDeadline,
        sent_at:           null,
    });

    const paymentUrl = `${appUrl}/payment/${paymentLink.uuid}`;
    const amount = `AUD ${(totalCents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const deadline = moment(businessDeadline).format('dddd D MMMM YYYY [at] h:mm A');

    console.log(`💳 PaymentLinkService: sending payment link email for booking ${bookingUuid}`);

    try {
        const hoursUntilDeadline = moment(businessDeadline).diff(moment(), 'hours');
        const isUrgent = hoursUntilDeadline < 48; // deadline is already less than a full 48h window away

        await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_PAYMENT_LINK, {
            guest_name:  booking.Guest.first_name,
            amount,
            payment_url: paymentUrl,
            deadline,
            booking_ref: booking.reference_id,
            is_urgent:   isUrgent,
        });
        await PaymentLink.update({ sent_at: new Date() }, { where: { uuid: paymentLink.uuid } });
        console.log(`💳 PaymentLinkService: payment link email sent for booking ${booking.reference_id}`);
    } catch (emailErr) {
        console.warn(`⚠️ AOB_PAYMENT_LINK email failed for booking ${booking.reference_id} — link created but not sent:`, emailErr.message);
        await PaymentLink.update({ sent_at: new Date() }, { where: { uuid: paymentLink.uuid } }).catch(() => {});
    }

    return {
        paymentLinkUuid:  paymentLink.uuid,
        stripeSessionUrl: checkoutSession.url,
        amountCents:      totalCents,
        expiresAt:        businessDeadline.toISOString(),
    };
}

/**
 * Regenerates a Stripe Checkout session for an existing, still-valid PaymentLink
 * whose Stripe session has expired. Reuses the same PaymentLink uuid/business
 * deadline — the guest's original email link keeps working. Called by the
 * guest-facing payment page, not the admin flow.
 */
export async function regenerateStripeSessionForPaymentLink(paymentLink) {
    const booking = await Booking.findOne({
        where: { id: paymentLink.booking_id },
        attributes: ['id', 'uuid', 'reference_id', 'status_name', 'preferred_arrival_date', 'preferred_departure_date'],
        include: [{ model: Guest }, { model: Room, include: [RoomType] }],
    });

    if (!booking) throw new Error('Booking not found');

    const nights = booking.preferred_departure_date && booking.preferred_arrival_date
        ? moment(booking.preferred_departure_date).diff(moment(booking.preferred_arrival_date), 'days')
        : 0;
    if (nights <= 0) throw new Error('Cannot calculate nights from booking dates');

    const totalCents = paymentLink.amount_cents; // keep the originally-quoted amount, don't recalculate against current rates

    const checkoutSession = await createStripeCheckoutSession({
        booking,
        paymentLinkUuid: paymentLink.uuid,
        totalCents,
        nights,
        businessDeadline: paymentLink.expires_at,
    });

    await PaymentLink.update(
        { stripe_session_id: checkoutSession.id },
        { where: { uuid: paymentLink.uuid } }
    );

    return checkoutSession;
}

/**
 * Marks a PaymentLink + Booking as paid and sends the guest their payment
 * receipt email. Idempotent-safe: only sends the receipt if this call is
 * the one that actually flips payment_status (guarded by the same
 * "not already paid" condition used everywhere else in this codebase for
 * this exact purpose), so calling this twice for the same booking — once
 * from the webhook, once from a guest-triggered reconciliation check —
 * only ever sends one receipt.
 *
 * Shared by: webhook.js's checkout.session.completed handler, and
 * payment-link/[uuid].js's self-healing reconciliation fallback.
 *
 * @param {object} params
 * @param {string} params.stripeSessionId
 * @param {string} params.stripePaymentIntent
 * @param {number} params.bookingId
 * @returns {Promise<{ bookingAffected: number }>}
 */
export async function markPaymentLinkPaidAndNotify({ stripeSessionId, stripePaymentIntent, bookingId }) {
    await PaymentLink.update(
        {
            status:                'paid',
            paid_at:               new Date(),
            stripe_payment_intent: stripePaymentIntent,
        },
        { where: { stripe_session_id: stripeSessionId } }
    );

    const [bookingAffected] = await Booking.update(
        {
            payment_status:        'paid',
            stripe_payment_intent: stripePaymentIntent,
        },
        { where: { id: bookingId, payment_status: { [Op.or]: [{ [Op.ne]: 'paid' }, { [Op.is]: null }] } } }
    );

    if (bookingAffected === 0) {
        console.log(`ℹ️ markPaymentLinkPaidAndNotify: booking ${bookingId} already marked paid or not found — no receipt sent (session ${stripeSessionId})`);
        return { bookingAffected };
    }

    console.log(`✅ Payment confirmed for booking ${bookingId}, PI: ${stripePaymentIntent}`);

    try {
        const booking = await Booking.findOne({
            where: { id: bookingId },
            attributes: ['id', 'reference_id', 'preferred_arrival_date', 'preferred_departure_date'],
            include: [{ model: Guest, attributes: ['first_name', 'email'] }],
        });

        const paymentLink = await PaymentLink.findOne({
            where: { stripe_session_id: stripeSessionId },
            attributes: ['amount_cents', 'currency'],
        });

        if (booking?.Guest?.email && paymentLink) {
            const amount = `${(paymentLink.currency || 'aud').toUpperCase()} ${(paymentLink.amount_cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            const stayDates = booking.preferred_arrival_date && booking.preferred_departure_date
                ? `${moment(booking.preferred_arrival_date).format('DD MMM YYYY')} – ${moment(booking.preferred_departure_date).format('DD MMM YYYY')}`
                : null;

            await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_PAYMENT_RECEIPT, {
                guest_name:       booking.Guest.first_name,
                booking_ref:      booking.reference_id,
                stay_dates:       stayDates,
                amount,
                payment_intent:   stripePaymentIntent,
                guest_portal_url: `${process.env.APP_URL}/bookings`,
            });
            console.log(`📧 Payment receipt email sent for booking ${bookingId}`);
        } else {
            console.warn(`⚠️ Could not send payment receipt for booking ${bookingId} — missing guest email or payment link data`);
        }
    } catch (receiptErr) {
        console.warn(`⚠️ Payment receipt email failed (non-fatal):`, receiptErr.message);
    }

    return { bookingAffected };
}

/**
 * Creates a Stripe refund for a booking's full paid amount and records it
 * in the refunds table. Does NOT mark the refund as succeeded — that only
 * happens once the charge.refunded webhook confirms it (refunds aren't
 * always instant on Stripe's side). Returns the pending Refund row.
 */
export async function createFullRefundForBooking({ bookingId, initiatedByUserId, reason }) {
    const booking = await Booking.findOne({
        where: { id: bookingId },
        attributes: ['id', 'reference_id', 'payment_status', 'stripe_payment_intent'],
        include: [{ model: Guest, attributes: ['first_name', 'email'] }],
    });

    if (!booking) throw new Error('Booking not found');
    if (booking.payment_status !== 'paid') {
        throw new Error('Booking must be fully paid before it can be refunded');
    }
    if (!booking.stripe_payment_intent) {
        throw new Error('No Stripe payment intent on file for this booking');
    }

    const paymentLink = await PaymentLink.findOne({
        where: { booking_id: bookingId, status: 'paid' },
        order: [['paid_at', 'DESC']],
    });

    if (!paymentLink) throw new Error('No paid payment link found for this booking');

    const stripeRefund = await stripe.refunds.create({
        payment_intent: booking.stripe_payment_intent,
        amount: paymentLink.amount_cents, // always the exact amount that was paid, never recalculated
    });

    const refund = await Refund.create({
        booking_id:            booking.id,
        payment_link_id:       paymentLink.id,
        stripe_refund_id:      stripeRefund.id,
        stripe_payment_intent: booking.stripe_payment_intent,
        amount_cents:          paymentLink.amount_cents,
        currency:              paymentLink.currency,
        status:                'pending', // always start pending — markRefundSucceededAndNotify is the
                                           // single place that flips this, whether called synchronously
                                           // below or later via the charge.refunded webhook.
        reason:                reason || null,
        initiated_by_user_id:  initiatedByUserId || null,
    });

    console.log(`💸 Refund created for booking ${bookingId}: ${stripeRefund.id}, status: ${stripeRefund.status}`);

    // If Stripe already reports it as succeeded synchronously (common in test
    // mode), reconcile immediately rather than waiting for the webhook.
    if (stripeRefund.status === 'succeeded') {
        await markRefundSucceededAndNotify({ stripeRefundId: stripeRefund.id, bookingId: booking.id });
    }

    // Re-read the row so the returned object reflects whatever
    // markRefundSucceededAndNotify actually wrote, rather than the
    // pre-update in-memory state from Refund.create().
    await refund.reload();
    return refund;
}

/**
 * Marks a refund + booking/payment_link as refunded and notifies the guest.
 * Idempotent-safe via the same "not already refunded" guard pattern used
 * throughout this codebase. Called from both the synchronous create path
 * above (test-mode instant refunds) and the charge.refunded webhook.
 */
export async function markRefundSucceededAndNotify({ stripeRefundId, bookingId }) {
    const [refundAffected] = await Refund.update(
        { status: 'succeeded' },
        { where: { stripe_refund_id: stripeRefundId, status: { [Op.ne]: 'succeeded' } } }
    );

    if (refundAffected === 0) {
        console.log(`ℹ️ markRefundSucceededAndNotify: refund ${stripeRefundId} already marked succeeded — skipping`);
        return;
    }

    await PaymentLink.update(
        { status: 'refunded' },
        { where: { booking_id: bookingId, status: 'paid' } }
    );

    await Booking.update(
        { payment_status: 'refunded' },
        { where: { id: bookingId, payment_status: 'paid' } }
    );

    console.log(`✅ Refund confirmed for booking ${bookingId}`);

    try {
        const booking = await Booking.findOne({
            where: { id: bookingId },
            attributes: ['id', 'reference_id'],
            include: [{ model: Guest, attributes: ['first_name', 'email'] }],
        });

        const refund = await Refund.findOne({ where: { stripe_refund_id: stripeRefundId } });

        if (booking?.Guest?.email && refund) {
            const amount = `${(refund.currency || 'aud').toUpperCase()} ${(refund.amount_cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

            await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_REFUND_CONFIRMATION, {
                guest_name:  booking.Guest.first_name,
                booking_ref: booking.reference_id,
                amount,
                guest_portal_url: `${process.env.APP_URL}/bookings`,
            });
            console.log(`📧 Refund confirmation email sent for booking ${bookingId}`);
        }
    } catch (emailErr) {
        console.warn(`⚠️ Refund confirmation email failed (non-fatal):`, emailErr.message);
    }
}