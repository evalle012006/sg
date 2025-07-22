import { Op } from "sequelize";
import { Booking, BookingEquipment, Equipment, Guest } from "../../../models/";

export default async function handler(req, res) {
    const { assetId } = req.query;

    const bookingEquipments = await Equipment.findAll({
        where: { id: assetId },
        include: [{
            model: Booking,
            where: {
                deleted_at: null,
                [Op.or]: [
                    { status: { [Op.notLike]: '%cancelled%' } },
                ]
            },
            include: [Guest]
        }]
    });

    return res.status(200).json({ data: bookingEquipments });
}
