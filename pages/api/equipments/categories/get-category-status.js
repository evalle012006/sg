import { EquipmentCategory } from "../../../../models";
import { EquipmentService } from "../../../../services/equipment/equipment";

export default async function handler(req, res) {

    const equipmentService = new EquipmentService();

    if (req.method === 'POST') {
        const { start_date, end_date } = req.body;

        const equipmentCategories = await equipmentService.getEquipmentCategoryStatus(start_date, end_date);

        return res.status(200).json(equipmentCategories);
    }

    return res.status(403).json({ message: 'Method not allowed' });

}