import { CourseEOI, CourseOffer, Course, Guest } from '../../../../../models';
// import SendEmail from '../../../../utilities/mail';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import sendMail from '../../../../../utilities/mail';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'EOI ID is required'
        });
    }

    try {
        // Find the EOI
        const eoi = await CourseEOI.findByPk(id, {
            include: [
                {
                    model: Guest,
                    as: 'guest',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ]
        });

        if (!eoi) {
            return res.status(404).json({
                success: false,
                message: 'EOI not found'
            });
        }

        // Check if already processed
        if (eoi.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `EOI has already been ${eoi.status}`
            });
        }

        // Parse selected courses
        const selectedCourses = JSON.parse(eoi.selected_courses || '[]');

        if (selectedCourses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'No courses selected in this EOI'
            });
        }

        // Get course details
        const courses = await Course.findAll({
            where: {
                id: selectedCourses
            },
            attributes: ['id', 'title', 'start_date', 'end_date']
        });

        if (courses.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No valid courses found'
            });
        }

        // Create course offers for each selected course
        const createdOffers = [];
        for (const course of courses) {
            // Check if offer already exists for this guest and course
            const existingOffer = await CourseOffer.findOne({
                where: {
                    course_id: course.id,
                    guest_id: eoi.guest_id || null
                }
            });

            if (!existingOffer) {
                const offer = await CourseOffer.create({
                    uuid: uuidv4(),
                    course_id: course.id,
                    guest_id: eoi.guest_id || null,
                    status: 'offered',
                    notes: `Created from EOI submission on ${moment(eoi.submitted_at).format('DD/MM/YYYY')}`,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                createdOffers.push({
                    ...offer.toJSON(),
                    course
                });
            }
        }

        // Update EOI status
        await eoi.update({
            status: 'accepted',
            contacted_at: new Date()
        });

        // Send acceptance email to guest
        try {
            const courseNames = courses.map(c => c.title).join(', ');
            sendMail(
                eoi.guest_email,
                'Your Course Interest Has Been Accepted - Sargood on Collaroy',
                'course-eoi-accepted',
                {
                    guest_name: eoi.guest_name,
                    course_names: courseNames,
                    offers_count: createdOffers.length
                }
            );
            console.log('✅ EOI acceptance email sent to:', eoi.guest_email);
        } catch (emailError) {
            console.error('Failed to send EOI acceptance email:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(200).json({
            success: true,
            message: `EOI accepted and ${createdOffers.length} course offer(s) created`,
            data: {
                eoi: eoi,
                offers: createdOffers
            }
        });

    } catch (error) {
        console.error('Error accepting EOI:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to accept EOI',
            error: error.message
        });
    }
}