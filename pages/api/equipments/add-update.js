import { Equipment } from "../../../models";

export default async function handler(req, res) {
    const equipment = req.body;

    const [data, created] = await Equipment.upsert({
        ...equipment
    });

    return res.status(200).json({ success: true,  equipment: data});
}
