import { Booking, BookingEquipment, QaPair, Section, } from "../../../models";
import { EquipmentService } from "./../../../services/equipment/equipment"
export default async function handler(req, res) {
    const { equipments, bookingId } = req.body;
    const equipmentService = new EquipmentService();
    if (req.method === 'POST') {
        let newEquipments = [];

        const bookingEquipments = await BookingEquipment.findAll({
            where: {
                booking_id: bookingId
            }
        });

        for (let i = 0; i < equipments.length; i++) {
            const equipment = equipments[i];
            if (!equipment.hidden) {
                const availablilityStatus = await equipmentService.checkAvailability(equipment.id, bookingId);

                const bookingEquipment = bookingEquipments.find(be => be.equipment_id == equipment.id && be.booking_id == bookingId);
                newEquipments.push({ ...equipment, available: availablilityStatus, start_date: bookingEquipment.start_date, end_date: bookingEquipment.end_date });
            }
        }

        return res.status(200).json(newEquipments);

    }

    return res.status(405).json({ message: 'Method not allowed' });
}