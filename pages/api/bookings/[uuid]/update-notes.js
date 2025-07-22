import { Booking } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { notes } = req.body;

    await Booking.update({ notes: notes }, { where: { uuid: uuid } });

    return res.status(200).end();
}