import { Booking } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { signature, agreement_tc} = req.body;

    await Booking.update({ signature: signature, agreement_tc: agreement_tc }, { where: { uuid: uuid } });

    return res.status(200).end();
}