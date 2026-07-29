import { getPaymentSubstate } from '../utilities/paymentSubstate';

export const getDisplayStatus = (booking) => {
  const status = JSON.parse(booking.status);
  const substate = getPaymentSubstate(booking);

  if (substate === 'paid')         return { name: status.name, label: 'Confirmed', color: status.color };
  if (substate === 'link_not_sent') return { name: status.name, label: 'Link Not Sent', color: 'gray' };
  if (substate === 'awaiting')       return { name: status.name, label: 'Awaiting Payment', color: 'orange' };
  if (substate === 'refunded') return { name: status.name, label: 'Refunded', color: 'gray' };

  return status;
};