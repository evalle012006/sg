import { Booking, Guest } from "../../../../models";

export default async function handler(req, res) {

  const { uuid } = req.query;

  const bookings = await Guest.findOne({ where: { uuid }, include: Booking });
  
  return res.status(200).json(bookings);
}
