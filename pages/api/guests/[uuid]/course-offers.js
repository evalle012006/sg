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
        // Parse guest check-in date if provided
        const guestCheckIn = checkInDate ? moment.utc(checkInDate, 'YYYY-MM-DD').startOf('day') : null;
        const now = moment.utc().startOf('day');

        // console.log('Fetching course offers for guest:', uuid, {
        //     checkInDate,
        //     checkOutDate,
        //     guestCheckInParsed: guestCheckIn?.format('YYYY-MM-DD'),
        //     currentDate: now.format('YYYY-MM-DD')
        // });

        // Build course filter conditions
        const courseWhereConditions = {
            status: 'active'
        };

        // FIXED: Filter out courses that have already ended relative to guest's check-in date
        if (guestCheckIn) {
            courseWhereConditions[Op.and] = [
                {
                    // Course must not have ended before guest's check-in date
                    // This prevents showing offers for courses that are already completed
                    [Op.or]: [
                        // Course ends on or after guest check-in (guest can participate)
                        { end_date: { [Op.gte]: guestCheckIn.toDate() } },
                        // Or booking window is still open (min_end_date >= guest check-in)
                        { min_end_date: { [Op.gte]: guestCheckIn.toDate() } }
                    ]
                }
            ];
        } else {
            // If no check-in date provided, still filter out courses that have already ended
            courseWhereConditions.end_date = {
                [Op.gte]: now.toDate()
            };
        }

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

        console.log(`Found ${courseOffers.length} active course offers for guest ${uuid}`);

        // Transform offers with enhanced data including validation and PRICING
        const transformedOffers = await Promise.all(courseOffers.map(async offer => {
            const course = offer.course;
            
            // Date validation logic - only run if both check-in and check-out dates provided
            let dateValid = true;
            let dateValidationMessage = null;
            let dateValidationSeverity = null; // NEW: Add severity level

            // ✅ NEW: Check if this is a historical booking (skip validation)
            const isHistoricalBooking = checkOutDate && moment.utc(checkOutDate, 'YYYY-MM-DD').startOf('day').isBefore(moment.utc().startOf('day'));

            if (isHistoricalBooking) {
                console.log(`⏭️ Skipping validation for historical booking (checkout: ${checkOutDate} is in the past)`);
                dateValid = true;
                dateValidationSeverity = null;
                dateValidationMessage = null;
            } else if (checkInDate && checkOutDate && course.min_start_date && course.min_end_date) {
                try {
                    // Use moment to parse all dates consistently in UTC, then convert to date-only for comparison
                    const checkIn = moment.utc(checkInDate, 'YYYY-MM-DD').startOf('day');
                    const checkOut = moment.utc(checkOutDate, 'YYYY-MM-DD').startOf('day');
                    const minStartDate = moment.utc(course.min_start_date).startOf('day');
                    const minEndDate = moment.utc(course.min_end_date).startOf('day');
                    const courseStartDate = moment.utc(course.start_date).startOf('day');
                    const courseEndDate = moment.utc(course.end_date).startOf('day');
                    
                    console.log(`Validating dates for course "${course.title}":`, {
                        guestCheckIn: checkIn.format('YYYY-MM-DD'),
                        guestCheckOut: checkOut.format('YYYY-MM-DD'),
                        courseStart: courseStartDate.format('YYYY-MM-DD'),
                        courseEnd: courseEndDate.format('YYYY-MM-DD'),
                        minStart: minStartDate.format('YYYY-MM-DD'),
                        minEnd: minEndDate.format('YYYY-MM-DD')
                    });
                    
                    // IMPROVED VALIDATION LOGIC:
                    // 1. Guest must check in on or before course start date
                    const checkInOnTime = checkIn.isSameOrBefore(courseStartDate);
                    
                    // 2. Guest must stay until minimum end date (minimum stay requirement)
                    const meetsMinimumStay = checkOut.isSameOrAfter(minEndDate);
                    
                    // 3. Guest should ideally stay until course ends (warning if not)
                    const staysUntilCourseEnds = checkOut.isSameOrAfter(courseEndDate);
                    
                    // Determine severity and message
                    if (!checkInOnTime) {
                        // ERROR: Check-in too late - cannot participate
                        dateValid = false;
                        dateValidationSeverity = 'error';
                        const courseStartFormatted = courseStartDate.format('D MMM YYYY');
                        dateValidationMessage = `Check-in must be on or before ${courseStartFormatted} to participate in ${course.title}.`;
                    } else if (!meetsMinimumStay) {
                        // ERROR: Stay too short - doesn't meet minimum requirement
                        dateValid = false;
                        dateValidationSeverity = 'error';
                        const minEndFormatted = minEndDate.format('D MMM YYYY');
                        const checkOutFormatted = checkOut.format('D MMM YYYY');
                        dateValidationMessage = `Your stay ends on ${checkOutFormatted}, but minimum stay until ${minEndFormatted} is required for ${course.title}.`;
                    } else if (!staysUntilCourseEnds) {
                        // WARNING: Meets minimum stay but leaves before course ends
                        dateValid = true; // ✅ Still valid, just a warning
                        dateValidationSeverity = 'warning';
                        const courseEndFormatted = courseEndDate.format('D MMM YYYY');
                        const checkOutFormatted = checkOut.format('D MMM YYYY');
                        dateValidationMessage = `Your stay ends on ${checkOutFormatted}, but ${course.title} runs until ${courseEndFormatted}. You may need to extend your checkout date to complete the course.`;
                    } else {
                        // All checks passed
                        dateValid = true;
                        dateValidationSeverity = null;
                        dateValidationMessage = null;
                    }

                    console.log(`Date validation result for "${course.title}":`, {
                        dateValid,
                        severity: dateValidationSeverity,
                        checkInOnTime,
                        meetsMinimumStay,
                        staysUntilCourseEnds,
                        message: dateValidationMessage
                    });
                    
                } catch (error) {
                    console.error('Error validating dates for course:', course.title, error);
                    dateValid = false;
                    dateValidationSeverity = 'error';
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

                console.log('Course image URL generated:', courseImageUrl ? 'Success' : 'Failed');
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
                offerStatus: offer.status,
                // Enhanced validation data
                dateValid: dateValid,
                dateValidationSeverity: dateValidationSeverity, 
                dateValidationMessage: dateValidationMessage,
                // Additional course details
                courseDuration: course.duration_hours || null,
                courseStartDate: course.start_date || null,
                courseEndDate: course.end_date || null,
                // Offer-specific data
                offeredAt: offer.offered_at,
                // Pricing information
                pricing: pricing
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
            withoutImages: transformedOffers.filter(offer => !offer.courseImageUrl).length,
            withPricing: transformedOffers.filter(offer => offer.pricing.hasPricing).length
        };

        // console.log(`Course offers for guest ${uuid}:`, summary);

        return res.status(200).json({
            success: true,
            courseOffers: transformedOffers,
            summary: summary,
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