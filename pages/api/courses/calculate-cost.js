import { calculateCourseCosts } from '../../../utilities/courses';
const { CourseRate } = require('../../../models');


export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { start_date, end_date, category } = req.body;

            if (!start_date || !end_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Start date and end date are required'
                });
            }

            // Get course rates
            const rates = await CourseRate.findAll({
                where: category ? { category } : {},
                order: [
                    ['category', 'ASC'],
                    [sequelize.literal("FIELD(day_type, 'weekday', 'saturday', 'sunday', 'public_holiday')")],
                    ['order', 'ASC']
                ]
            });

            // Calculate costs for both categories if no specific category requested
            const categories = category ? [category] : ['holiday', 'sta'];
            const results = {};

            for (const cat of categories) {
                const categoryRates = rates.filter(r => r.category === cat);
                try {
                    const costs = await calculateCourseCosts(start_date, end_date, categoryRates, cat);
                    results[cat] = costs;
                } catch (error) {
                    console.error(`Error calculating costs for ${cat}:`, error);
                    results[cat] = {
                        totalCost: 0,
                        costDetails: [],
                        error: error.message
                    };
                }
            }

            res.status(200).json({
                success: true,
                data: results
            });
        } catch (error) {
            console.error('Error calculating course costs:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to calculate course costs',
                error: error.message
            });
        }
    } else {
        res.setHeader('Allow', ['POST']);
        res.status(405).json({
            success: false,
            message: `Method ${req.method} not allowed`
        });
    }
}