import { Guest, Course, CourseOffer } from '../../../../models';
import { Op } from 'sequelize';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { uuid } = req.query;

    if (!uuid) {
        return res.status(400).json({ message: 'Guest ID is required' });
    }

    try {
        const courseOffers = await CourseOffer.findAll({
            where: {
                guest_id: uuid,
                status: {
                    [Op.in]: ['offered', 'accepted']
                }
            },
            include: [{
                model: Course,
                as: 'course',
                where: {
                    status: 'active'
                },
                required: true
            }],
            order: [['offered_at', 'DESC']]
        });

        const transformedOffers = courseOffers.map(offer => ({
            id: offer.id,
            courseId: offer.course_id,
            courseName: offer.course.title,
            minStartDate: offer.course.min_start_date,
            minEndDate: offer.course.min_end_date,
            offerStatus: offer.status
        }));

        return res.status(200).json({
            success: true,
            courseOffers: transformedOffers
        });

    } catch (error) {
        console.error('Error fetching course offers:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error'
        });
    }
}