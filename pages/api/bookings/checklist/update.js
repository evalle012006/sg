import { Booking, ChecklistAction } from "./../../../../models";

export default async function handler(req, res) {
    const { id, status } = req.body;

    await ChecklistAction.update({ status: status }, { where: { id: id } });

    return res.status(200).end();
}