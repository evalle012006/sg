import { Op } from "sequelize";
import { Booking, BookingEquipment, Equipment, Guest } from "../../../models";
import moment from 'moment';

export default async function handler(req, res) {
    const data = [];
    const bookingGuest = await Booking.findAll({
        where: {
            deleted_at: null,
            [Op.or]: [
                { status: { [Op.notLike]: '%cancelled%' } },
            ]
        },
        include: [Guest]
    });

    const localizeDate = new Date().toLocaleDateString({}, { timeZone: 'Australia/Hobart' });
    const currentDate = moment(localizeDate);

    if (bookingGuest) {
        bookingGuest.map(booking => {
            let b = { ...booking.dataValues };
            if (b.preferred_arrival_date) {
                if (moment(currentDate).isSameOrBefore(b.preferred_arrival_date)) {
                    data.push({ ...b });
                }
            }
        });
    }

    return res.status(200).json({ data: data });
}
