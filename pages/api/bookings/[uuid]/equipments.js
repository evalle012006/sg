import { Booking, Equipment, EquipmentCategory } from "../../../../models";
import sendMail from "../../../../utilities/mail";
const jwt = require('jsonwebtoken');

export default async function handler(req, res) {
    const { uuid } = req.query;

    const booking = await Booking.findOne({ where: { uuid }, include: [{ model: Equipment, include: EquipmentCategory }] });

    return res.status(200).json(booking ? booking.Equipment : []);
}