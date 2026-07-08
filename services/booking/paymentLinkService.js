// services/booking/paymentLinkService.js
import Stripe from 'stripe';
import { v4 as uuidv4 } from 'uuid';
import { Booking, PaymentLink, Guest, Room, RoomType } from '../../models';
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
        await EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.AOB_PAYMENT_LINK, {
            guest_name:  booking.Guest.first_name,
            amount,
            payment_url: paymentUrl,
            deadline,
            booking_ref: booking.reference_id,
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