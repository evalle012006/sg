import { QaPair } from "../../../../../models";

export default async function handler(req, res) {
    const { id } = req.query;

    const qaPair = await QaPair.findByPk(id);

    if (qaPair) res.json(qaPair)

    return res.status(404).end();
}