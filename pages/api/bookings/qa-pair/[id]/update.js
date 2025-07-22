import { QaPair } from "./../../../../../models";

export default async function handler(req, res) {
    const { id } = req.query;

    await QaPair.update(req.body, { where: { id: id } });

    return res.status(200);
}