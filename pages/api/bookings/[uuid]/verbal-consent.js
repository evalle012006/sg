import { Booking } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { verbalConsent } = req.body;

    await Booking.update({ verbal_consent: verbalConsent }, { where: { uuid: uuid } });

    return res.status(200).end();
}