const { CourseRate, sequelize } = require('../../../models');

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const rates = await CourseRate.findAll({
                order: [
                    ['category', 'ASC'],
                    [sequelize.literal("FIELD(day_type, 'weekday', 'saturday', 'sunday', 'public_holiday')")],
                    ['order', 'ASC']
                ]
            });

            res.status(200).json({
                success: true,
                data: rates
            });
        } catch (error) {
            console.error('Error fetching course rates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch course rates',
                error: error.message
            });
        }
    } else if (req.method === 'POST') {
        try {
            const { rates } = req.body;

            if (!Array.isArray(rates)) {
                return res.status(400).json({
                    success: false,
                    message: 'Rates must be provided as an array'
                });
            }

            // Validate each rate
            for (const rate of rates) {
                if (!rate.category || !['holiday', 'sta'].includes(rate.category)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid rate category. Must be "holiday" or "sta"'
                    });
                }

                if (!rate.day_type || !['weekday', 'saturday', 'sunday', 'public_holiday'].includes(rate.day_type)) {
                    return res.status(400).json({
                        success: false,
                        message: 'Invalid day type. Must be "weekday", "saturday", "sunday", or "public_holiday"'
                    });
                }

                if (!rate.package_name || rate.package_name.trim() === '') {
                    return res.status(400).json({
                        success: false,
                        message: 'Package name is required'
                    });
                }

                if (rate.rate === undefined || rate.rate === null || isNaN(parseFloat(rate.rate)) || parseFloat(rate.rate) < 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'Valid rate value is required'
                    });
                }
            }

            // Get all existing rate IDs to determine which ones to delete
            const existingRates = await CourseRate.findAll({
                attributes: ['id']
            });
            const existingIds = existingRates.map(r => r.id);
            const submittedIds = rates.filter(r => r.id).map(r => r.id);
            const idsToDelete = existingIds.filter(id => !submittedIds.includes(id));

            // Delete removed rates
            if (idsToDelete.length > 0) {
                await CourseRate.destroy({
                    where: {
                        id: idsToDelete
                    }
                });
            }

            // Update existing and create new rates
            const savedRates = [];
            for (const rate of rates) {
                const rateData = {
                    category: rate.category,
                    day_type: rate.day_type,
                    package_name: rate.package_name.trim(),
                    rate: parseFloat(rate.rate),
                    order: rate.order || 0
                };

                if (rate.id && !rate.id.toString().startsWith('temp_')) {
                    // Update existing rate
                    const [updatedCount] = await CourseRate.update(rateData, {
                        where: { id: rate.id },
                        returning: true
                    });
                    
                    if (updatedCount > 0) {
                        const updatedRate = await CourseRate.findByPk(rate.id);
                        savedRates.push(updatedRate);
                    }
                } else {
                    // Create new rate
                    const newRate = await CourseRate.create(rateData);
                    savedRates.push(newRate);
                }
            }

            res.status(200).json({
                success: true,
                message: 'Course rates saved successfully',
                data: savedRates
            });
        } catch (error) {
            console.error('Error saving course rates:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to save course rates',
                error: error.message
            });
        }
    } else {
        res.setHeader('Allow', ['GET', 'POST']);
        res.status(405).json({
            success: false,
            message: `Method ${req.method} not allowed`
        });
    }
}