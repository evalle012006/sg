import { Booking, QaPair, Section } from "../../../models"
import { dispatchHttpTaskHandler } from "../../../services/queues/dispatchHttpTask";
import { getCheckInOutAnswer } from "../../../utilities/common";

export default async function handler(req, res) {
    const { bookingId } = req.body;

    if (req.method === "POST") {
        if (!bookingId) {
            return res.status(201).json({ success: true });
        }

        const booking = await Booking.findOne({
            where: { uuid: bookingId },
            include: [{ model: Section, include: [{ model: QaPair }] }]
        });

        if (booking) {
            let metainfo = booking.metainfo ? JSON.parse(booking.metainfo) : {};

            if (!metainfo || typeof metainfo !== 'object') {
                metainfo = {};
            }

            if (!metainfo.hasOwnProperty("sendDatesOfStayEmail")) {
                metainfo.sendDatesOfStayEmail = { sent: false };
            }
            
            if (!metainfo.sendDatesOfStayEmail.sent) {
                const qaPairs = booking.Sections.map(section => section.QaPairs).flat();
                let checkInOutAnswer = qaPairs.find(qa => qa.question == 'Check In Date and Check Out Date')?.answer;
                if (!checkInOutAnswer) {
                  checkInOutAnswer = getCheckInOutAnswer(qaPairs);
                }
              
                if (checkInOutAnswer) {
                  dispatchHttpTaskHandler('booking', { type: 'sendDatesOfStayEmail', payload: { booking_id: booking.id } });
                }
            }

            return res.status(201).json({ success: true });
        }

        return res.status(400);
    }
}