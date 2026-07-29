import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]';
import { Booking } from '../../../../models';
import { createFullRefundForBooking } from '../../../../services/booking/paymentLinkService';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const session = await getServerSession(req, res, authOptions);
    if (!session || session.user.type !== 'user') {
        return res.status(401).json({ error: 'Unauthorised' });
    }

    const { uuid } = req.query;
    const { reason } = req.body;

    const booking = await Booking.findOne({ where: { uuid }, attributes: ['id'] });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });

    try {
        const refund = await createFullRefundForBooking({
            bookingId: booking.id,
            initiatedByUserId: session.user.id,
            reason,
        });
        return res.status(200).json({ success: true, refundId: refund.stripe_refund_id, status: refund.status });
    } catch (err) {
        console.error('❌ Refund creation failed:', err.message);
        return res.status(400).json({ error: err.message });
    }
}