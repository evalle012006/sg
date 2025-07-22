import { Booking } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { checklist_notes } = req.body;

    await Booking.update({ checklist_notes: checklist_notes }, { where: { uuid: uuid } });

    return res.status(200).end();
}