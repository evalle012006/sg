import { Booking, Guest, QaPair, Question, Section } from '../../../models'
import { Op } from 'sequelize'

export default async function handler(req, res) {
    if (req.method === 'GET') {
        const bookings = await Booking.findAll({
            where: {
                deleted_at: null,
                [Op.or]: [
                    { complete: false },
                    { complete: null },
                ]
            },
            include: [
                {
                    model: Section,
                    include: [
                        {
                            model: QaPair,
                            where: {
                                question: {
                                    [Op.in]: [
                                        'Check In Date and Check Out Date',
                                        'Check In Date',
                                        'Check Out Date',
                                        'Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.',
                                        'Accommodation package options for Sargood Courses are:',
                                        'Which course?',
                                        'How will your stay be funded?',
                                    ]
                                }
                            }
                            // include: [Question],
                        },
                    ],
                },
                Guest,
            ],
            order: [["createdAt", "DESC"]],
        });
        return res.status(200).json(bookings)
    }
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });

}
