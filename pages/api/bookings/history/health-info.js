import { Booking, Guest, QaPair, Section } from "../../../../models";

export default async function handler(req, res) {

    if (req.method === "POST") {
        const { uuid } = req.body;

        const guest = await Guest.findOne({ where: { uuid: uuid }, include: [Booking], order: [["createdAt", "DESC"]] });

        if (guest?.Bookings.length > 0) {

            const prevBooking = await Booking.findOne({ where: { id: guest.Bookings[0].id }, include: [{ model: Section, include: [QaPair] }] });

            let healthInfoQuestion;

            prevBooking.Sections.map(section => {
                const healthInfoQuestionExists = section.QaPairs.find(qaPair => qaPair.question == 'Do any of the following relate to you?');

                if (healthInfoQuestionExists) {
                    healthInfoQuestion = healthInfoQuestionExists;
                }
            })

            if (healthInfoQuestion) {
                const data = { info:  JSON.parse(healthInfoQuestion.answer), lastUpdated: healthInfoQuestion.updatedAt}
                return res.status(200).json(data);
            }

        }
        return res.status(404).json({ message: "No previous booking found" })

    }
    return res.status(405).json({ message: "Method not allowed" })
}
