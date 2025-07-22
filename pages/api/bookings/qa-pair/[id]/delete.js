import { QaPair } from "../../../../../models";

export default async function handler(req, res) {
    const { id } = req.query;

    await QaPair.destroy({ where: { id: id } });

    return res.status(200);
}