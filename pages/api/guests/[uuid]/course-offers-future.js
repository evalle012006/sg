import { Course, CourseOffer } from '../../../../models';
import { Op } from 'sequelize';
import StorageService from '../../../../services/storage/storage';
import moment from 'moment';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const storage = new StorageService({ bucketType: 'restricted' });

    const { uuid } = req.query;

    if (!uuid) {
        return res.status(400).json({ message: 'Guest ID is required' });
    }

    try {
        const now = moment.utc().startOf('day');

        console.log('Fetching all future course offers for guest:', uuid, {
            currentDate: now.format('YYYY-MM-DD')
        });

        // Build course filter conditions - only get courses that haven't ended yet
        const courseWhereConditions = {
            status: 'active',
            // Course must not have ended yet
            end_date: {
                [Op.gte]: now.toDate()
            }
        };

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
                where: courseWhereConditions,
                required: true
            }],
            order: [['offered_at', 'DESC']]
        });

        console.log(`Found ${courseOffers.length} future course offers for guest ${uuid}`);

        // Transform offers with basic data (no date validation needed)
        const transformedOffers = await Promise.all(courseOffers.map(async offer => {
            const course = offer.course;
            
            // Build image URL if image exists
            let courseImageUrl = null;
            if (course.image_filename) {
                try {
                    courseImageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
                } catch (error) {
                    console.error('Error generating signed URL for course image:', error);
                    courseImageUrl = null;
                }
            }
            
            // Course pricing information
            const pricing = {
                holidayPrice: course.holiday_price ? parseFloat(course.holiday_price) : null,
                staPrice: course.sta_price ? parseFloat(course.sta_price) : null,
                priceCalculatedAt: course.price_calculated_at,
                hasPricing: !!(course.holiday_price || course.sta_price)
            };
            
            return {
                id: offer.id,
                courseId: offer.course_id,
                courseName: course.title,
                courseDescription: course.description || '',
                courseImage: course.image_filename || null,
                courseImageUrl: courseImageUrl,
                minStartDate: course.min_start_date,
                minEndDate: course.min_end_date,
                courseStartDate: course.start_date,
                courseEndDate: course.end_date,
                offerStatus: offer.status,
                courseDuration: course.duration_hours || null,
                offeredAt: offer.offered_at,
                pricing: pricing
            };
        }));

        // Sort by offer date (most recent first)
        transformedOffers.sort((a, b) => {
            return new Date(b.offeredAt) - new Date(a.offeredAt);
        });

        // Create summary
        const summary = {
            total: transformedOffers.length,
            withImages: transformedOffers.filter(offer => offer.courseImageUrl).length,
            withoutImages: transformedOffers.filter(offer => !offer.courseImageUrl).length,
            withPricing: transformedOffers.filter(offer => offer.pricing.hasPricing).length
        };

        console.log(`Future course offers summary for guest ${uuid}:`, summary);

        return res.status(200).json({
            success: true,
            courseOffers: transformedOffers,
            summary: summary,
            hasFutureOffers: transformedOffers.length > 0
        });

    } catch (error) {
        console.error('Error fetching future course offers:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error',
            hasFutureOffers: false
        });
    }
}