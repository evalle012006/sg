import { BookingService } from "../../../../services/booking/booking";


export default async function handler(req, res) {
    const { uuid } = req.query;

    const bookingService = new BookingService();

    const isComplete = await bookingService.isBookingComplete(uuid);
    console.log('isComplete', isComplete);
    return res.status(200).end();
}