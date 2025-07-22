import { Booking } from "./../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;

    await Booking.update(req.body, { where: { uuid: uuid } });

    return res.status(200);
}