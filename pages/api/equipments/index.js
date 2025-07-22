import { Equipment, EquipmentCategory, Supplier } from "../../../models/";
import StorageService from "../../../services/storage/storage";

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });
    const { includeHidden } = req.query;

    const whereClause = includeHidden === "true"
        ? {}
        : { hidden: false };

    const equipments = await Equipment.findAll({
        where: whereClause,
        include: [EquipmentCategory, Supplier],
        order: [['created_at', 'DESC']],
        raw: true,
        nest: true
    });

    for (let i = 0; i < equipments.length; i++) {
        if (equipments[i].image_filename && !equipments[i].image_filename.includes("default-")) {
            const url = await storage.getSignedUrl('equipment-photo' + '/' + equipments[i].image_filename);
            equipments[i].image_url = url;
        }
    }

    return res.status(200).json(equipments);
}