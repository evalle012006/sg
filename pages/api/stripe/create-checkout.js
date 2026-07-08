// pages/api/stripe/create-checkout.js
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]';
import { createPaymentLinkForBooking } from '../../../services/booking/paymentLinkService';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.type !== 'user') {
        return res.status(401).json({ error: 'Unauthorised' });
    }

    const { bookingUuid } = req.body;
    if (!bookingUuid) return res.status(400).json({ error: 'bookingUuid required' });

    try {
        const result = await createPaymentLinkForBooking(bookingUuid);
        return res.status(200).json(result);
    } catch (err) {
        return res.status(400).json({ error: err.message });
    }
}