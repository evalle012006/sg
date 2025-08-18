import { Guest, Course, CourseOffer } from '../../../../models';
import { Op } from 'sequelize';
import StorageService from '../../../../services/storage/storage';
import moment from 'moment';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const storage = new StorageService({ bucketType: 'restricted' });

    const { uuid, checkInDate, checkOutDate } = req.query;

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

        // Transform offers with enhanced data including validation
        const transformedOffers = await Promise.all(courseOffers.map(async offer => {
            const course = offer.course;
            
            // Date validation logic
            let dateValid = true;
            let dateValidationMessage = null;

            if (checkInDate && checkOutDate && course.min_start_date && course.min_end_date) {
                try {
                    const checkIn = new Date(checkInDate);
                    const checkOut = new Date(checkOutDate);
                    const minStartDate = new Date(course.min_start_date);
                    const minEndDate = new Date(course.min_end_date);
                    const courseStartDate = new Date(course.start_date);
                    const courseEndDate = new Date(course.end_date);
                    
                    // Set all times to start of day for accurate comparison
                    [checkIn, checkOut, minStartDate, minEndDate, courseStartDate, courseEndDate].forEach(date => {
                        date.setHours(0, 0, 0, 0);
                    });
                    
                    // CORRECTED LOGIC:
                    // 1. Guest can check in any time from min start date up to course start date
                    // 2. Guest must stay until course ends or longer
                    // 3. Guest must not check out before the minimum end date
                    
                    const canCheckIn = checkIn >= minStartDate && checkIn <= courseStartDate;
                    const staysUntilCourseEnds = checkOut >= courseEndDate;
                    const staysMinimumPeriod = checkOut >= minEndDate;
                    
                    dateValid = canCheckIn && staysUntilCourseEnds && staysMinimumPeriod;
                    
                    if (!dateValid) {
                        const minStartFormatted = moment.utc(minStartDate).format('D MMM YYYY');
                        const minEndFormatted = moment.utc(minEndDate).format('D MMM YYYY');
                        const courseStartFormatted = moment.utc(courseStartDate).format('D MMM YYYY');
                        const courseEndFormatted = moment.utc(courseEndDate).format('D MMM YYYY');
                        
                        if (!canCheckIn) {
                            dateValidationMessage = `Check-in must be between ${minStartFormatted} and ${courseStartFormatted} for ${course.title}.`;
                        } else if (!staysUntilCourseEnds) {
                            dateValidationMessage = `You must stay until course ends on ${courseEndFormatted} for ${course.title}.`;
                        } else if (!staysMinimumPeriod) {
                            dateValidationMessage = `Minimum stay until ${minEndFormatted} required for ${course.title}.`;
                        }
                    }
                } catch (error) {
                    console.error('Error validating dates for course:', course.title, error);
                    dateValid = false;
                    dateValidationMessage = 'Error validating course dates';
                }
            }
            
            // Build image URL if image exists
            let courseImageUrl = null;
            if (course.image_filename) {
                console.log('Generating signed URL for course image:', course.image_filename);
                try {
                    courseImageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
                } catch (error) {
                    console.error('Error generating signed URL for course image:', error);
                    courseImageUrl = null; // Fallback if URL generation fails
                }

                console.log('Course image URL generated:', courseImageUrl);
            }
            
            return {
                id: offer.id,
                courseId: offer.course_id,
                courseName: course.title,
                courseDescription: course.description || '',
                courseImage: course.image_filename || null,
                courseImageUrl: courseImageUrl,
                minStartDate: course.min_start_date,
                minEndDate: course.min_end_date,
                offerStatus: offer.status,
                // Enhanced validation data
                dateValid: dateValid,
                dateValidationMessage: dateValidationMessage,
                // Additional course details
                courseDuration: course.duration_hours || null,
                courseStartDate: course.start_date || null,
                courseEndDate: course.end_date || null,
                // Offer-specific data
                offeredAt: offer.offered_at
            };
        }));

        // Sort by date validity (valid courses first) and then by offer date
        transformedOffers.sort((a, b) => {
            // First sort by date validity (valid courses first)
            if (a.dateValid && !b.dateValid) return -1;
            if (!a.dateValid && b.dateValid) return 1;
            
            // Then sort by offered date (most recent first)
            return new Date(b.offeredAt) - new Date(a.offeredAt);
        });

        // Create summary for debugging/logging
        const summary = {
            total: transformedOffers.length,
            validDates: transformedOffers.filter(offer => offer.dateValid).length,
            invalidDates: transformedOffers.filter(offer => !offer.dateValid).length,
            withImages: transformedOffers.filter(offer => offer.courseImageUrl).length,
            withoutImages: transformedOffers.filter(offer => !offer.courseImageUrl).length
        };

        console.log(`Course offers for guest ${uuid}:`, summary);

        return res.status(200).json({
            success: true,
            courseOffers: transformedOffers,
            summary: summary, // Include summary for debugging (remove in production if needed)
            dateValidationPerformed: !!(checkInDate && checkOutDate)
        });

    } catch (error) {
        console.error('Error fetching course offers:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Internal server error'
        });
    }
}