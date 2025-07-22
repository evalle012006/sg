import { Equipment, EquipmentCategory } from "./../../../../models"

export default async function handler(req, res) {
    const { id } = req.query;

    if (req.method === 'GET') {
        const category = await EquipmentCategory.findOne({ where: { id }, include: [Equipment] });
        return res.status(200).json(category);
    }

    if (req.method === "POST") {
        const category = await EquipmentCategory.upsert(req.body);
        return res.status(201).json(category);
    }

    if (req.method === "DELETE") {
        const category = await EquipmentCategory.destroy({ where: { id } });
        return res.status(200).json({ message: 'Equipment Category deleted successfully' });
    }

    return req.status(405).json({ message: "Method not allowed" });
}

