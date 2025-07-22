import { EquipmentCategory } from "../../../../models";

export default async function handler(req, res) {

    const equipmentCategories = await EquipmentCategory.findAll({ order: [['created_at', 'DESC']] });
    return res.status(200).json(equipmentCategories);
}