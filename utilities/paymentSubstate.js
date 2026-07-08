import { BOOKING_FUND_TYPES } from '../components/constants';

/**
 * Returns the AOB payment sub-state for a booking, or null if not applicable
 * (not AOB, not confirmed, or already paid via non-AOB path).
 * This is the single source of truth for "paid" / "awaiting" / "link_not_sent" —
 * both the display label (getDisplayStatus) and the list filter predicate
 * must derive from this, not reimplement the branching independently.
 */
export const getPaymentSubstate = (booking) => {
  if (booking.booking_type !== BOOKING_FUND_TYPES.AOB) return null;

  const status = typeof booking.status === 'string' ? JSON.parse(booking.status) : booking.status;
  if (status?.name !== 'booking_confirmed') return null;

  if (booking.payment_status === 'paid') return 'paid';

  const latestLink = booking.PaymentLinks?.[0];
  if (!latestLink || !latestLink.sent_at) return 'link_not_sent';

  return 'awaiting';
};