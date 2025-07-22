import { BookingEquipment } from "../../../models";

export default async function handler(req, res) {
    if (req.method === 'POST') {
        const bookingEquipment = req.body;

        await BookingEquipment.update({
            ...bookingEquipment
        }, {
            where: {
                booking_id: bookingEquipment.booking_id,
                equipment_id: bookingEquipment.equipment_id
            },
        });

        return res.status(200).json({ success: true });

    }

    return res.status(405).json({ message: 'Method not allowed' });
}