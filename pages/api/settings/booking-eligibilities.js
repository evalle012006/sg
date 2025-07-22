import { Setting } from '../../../models';

export default async function handler(request, response) {
    const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_eligibility' } });
    response.status(200).json(bookingStatuses);
}