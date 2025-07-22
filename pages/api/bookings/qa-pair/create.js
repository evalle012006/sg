import { QaPair } from "../../../../models";

export default async function handler(req, res) {
    const qaPair = await QaPair.create(req.body);

    res.json(qaPair);
}