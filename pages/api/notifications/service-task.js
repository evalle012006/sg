import { Booking } from "../../../models";
import { BookingService } from "../../../services/booking/booking";
import moment from "moment";
import { NotificationService } from "../../../services/notification/notification";

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {

        const payload = req.body;

        const notificationService = new NotificationService();
        await notificationService.dispatchNotification(payload);
    }
    catch (e) {
        return res.status(400).json({ message: "Bad Request" });
    }

    return res.status(201).json({ success: true });
}
