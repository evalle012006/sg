import { Booking, Guest, PaymentLink } from '../../../../models';
import { EmailService } from '../../../../services/EmailService';
import moment from 'moment';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { uuid } = req.query;
  const { paymentLinkUuid, amountCents, expiresAt } = req.body;

  const booking = await Booking.findOne({
    where: { uuid },
    include: [Guest],
  });

  if (!booking?.Guest?.email) {
    return res.status(400).json({ error: 'No guest email on booking' });
  }

  const paymentUrl = `${process.env.APP_URL}/payment/${paymentLinkUuid}`;
  const amount     = `AUD ${(amountCents / 100).toFixed(2)}`;
  const deadline   = moment(expiresAt).format('dddd D MMMM YYYY [at] h:mm A');

  // Send using existing EmailService infrastructure
  // Replace TEMPLATE_ID with whatever AOB payment email template you create
  await EmailService.sendWithTemplate(
    booking.Guest.email,
    'aob-payment-link',  // template name/id — create this in manage email templates
    {
      guest_name:   `${booking.Guest.first_name} ${booking.Guest.last_name}`,
      amount,
      payment_url:  paymentUrl,
      deadline,
      booking_ref:  booking.reference_id,
    }
  );

  // Mark link as sent
  await PaymentLink.update(
    { sent_at: new Date() },
    { where: { uuid: paymentLinkUuid } }
  );

  return res.status(200).json({ success: true });
}