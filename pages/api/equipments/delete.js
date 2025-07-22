import { BookingEquipment, Equipment } from "../../../models";

export default async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'DELETE') {

        await BookingEquipment.destroy({ where: { equipment_id: id } });
        await Equipment.destroy({ where: { id } });
        
        return res.status(200).json({ message: 'Equipment deleted successfully' });
    }
}