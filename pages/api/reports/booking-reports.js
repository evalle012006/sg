import { Booking, Guest, QaPair, Question, Room, Section } from './../../../models';
import { Op, Sequelize } from 'sequelize';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { 
            page = 1, 
            pageSize = 10, 
            startDate, 
            endDate
        } = req.query;

        const validPage = Math.max(1, parseInt(page));
        const validPageSize = Math.max(1, Math.min(100, parseInt(pageSize)));
        const offset = (validPage - 1) * validPageSize;

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

        const { count, rows: bookings } = await Booking.findAndCountAll({
            where: whereClause,
            include: [
                {
                    model: Section,
                    include: [QaPair],
                    separate: true,
                    order: [['order', 'ASC']]
                },
                Guest,
                Room
            ],
            order: [['createdAt', 'DESC']],
            limit: validPageSize,
            offset: offset,
            distinct: true,
            subQuery: false
        });

        const totalPages = Math.max(1, Math.ceil(count / validPageSize));
        
        const adjustedPage = Math.min(validPage, totalPages);

        return res.status(200).json({
            bookings,
            totalCount: count,
            currentPage: adjustedPage,
            totalPages,
            pageSize: validPageSize
        });

    } catch (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).json({ 
            message: 'Error fetching bookings', 
            error: error.message 
        });
    }
}