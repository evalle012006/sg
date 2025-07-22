import { Booking } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { label } = req.body;

    await Booking.update({ label: label }, { where: { uuid: uuid } });

    return res.status(200).end();
}