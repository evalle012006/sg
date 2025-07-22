import { processAnswer } from '../../../lib/report-utils';
import { Booking, Guest, QaPair, Room, Section } from '../../../models';
import { Op } from 'sequelize';
import moment from 'moment';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const { startDate, endDate } = req.query;

    try {
        let whereClause = {
            deleted_at: null,
            [Op.or]: [
                { complete: true },
                { type: 'Enquiry' },
            ]
        };

        if (startDate && endDate) {
            whereClause.createdAt = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        }

        const bookings = await Booking.findAll({
            where: whereClause,
            include: [
                {
                    model: Section,
                    include: [QaPair],
                    order: [['order', 'ASC']]
                },
                Guest,
                Room
            ],
            order: [['createdAt', 'DESC']],
            raw: false
        });

        const processedBookings = bookings.map(booking => {
            const plainBooking = booking.get({ plain: true });
            
            const baseData = {
                BOOKING: plainBooking.reference_id || '',
                GUEST: plainBooking.Guest ? 
                    `${plainBooking.Guest.first_name || ''} ${plainBooking.Guest.last_name || ''}`.trim() : '',
                GUEST_EMAIL: plainBooking.Guest?.email || '',
                GUEST_PHONE: plainBooking.Guest?.phone_number || '',
                BOOKING_TYPE: plainBooking.type || '',
                CREATED: plainBooking.createdAt ? 
                    moment(plainBooking.createdAt).format('DD-MM-YYYY') : '',
                STATUS: processAnswer(plainBooking.status),
                ELIGIBILITY: processAnswer(plainBooking.eligibility),
                ROOM: plainBooking.Rooms?.length ? 
                    plainBooking.Rooms.map(r => r.label || '').join(', ') : '',
                ARRIVAL_DATE: plainBooking.preferred_arrival_date ? 
                    moment(plainBooking.preferred_arrival_date).format('DD-MM-YYYY') : '',
                DEPARTURE_DATE: plainBooking.preferred_departure_date ? 
                    moment(plainBooking.preferred_departure_date).format('DD-MM-YYYY') : ''
            };

            if (plainBooking.Sections && Array.isArray(plainBooking.Sections)) {
                const sortedSections = [...plainBooking.Sections].sort((a, b) => 
                    (a.order || 0) - (b.order || 0)
                );

                sortedSections.forEach(section => {
                    if (section.QaPairs && Array.isArray(section.QaPairs)) {
                        const sortedQaPairs = [...section.QaPairs].sort((a, b) => 
                            (a.id || 0) - (b.id || 0)
                        );

                        sortedQaPairs.forEach(qa => {
                            if (qa && qa.question) {
                                baseData[qa.question] = processAnswer(qa.answer, qa.question_type);
                            }
                        });
                    }
                });
            }

            return baseData;
        });

        return res.status(200).json({
            success: true,
            data: processedBookings
        });

    } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Error generating export',
            error: error.message 
        });
    }
}