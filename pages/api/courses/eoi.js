import { Course, Guest, CourseEOI } from '../../../models';
import SendEmail from '../../../utilities/mail';
import moment from 'moment';

export default async function handler(req, res) {
    const { method } = req;

    try {
        switch (method) {
            case 'GET':
                return await getEOIs(req, res);
            case 'POST':
                return await createEOI(req, res);
            case 'PUT':
                return await updateEOI(req, res);
            default:
                return res.status(405).json({ 
                    success: false, 
                    message: 'Method not allowed' 
                });
        }
    } catch (error) {
        console.error('Course EOI API error:', error);
        return res.status(500).json({
            success: false,
            message: 'An unexpected error occurred'
        });
    }
}

// GET: List all EOIs (for admin)
async function getEOIs(req, res) {
    const { status, guest_id, limit = 50, offset = 0 } = req.query;
    
    try {
        const where = {};
        if (status) where.status = status;
        if (guest_id) where.guest_id = guest_id;

        const eois = await CourseEOI.findAndCountAll({
            where,
            include: [
                {
                    model: Guest,
                    as: 'guest',
                    attributes: ['id', 'first_name', 'last_name', 'email'],
                    required: false
                }
            ],
            order: [['submitted_at', 'DESC']],
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        return res.status(200).json({
            success: true,
            data: eois.rows,
            total: eois.count,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

    } catch (error) {
        console.error('Error fetching EOIs:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch expressions of interest'
        });
    }
}

// POST: Create a new EOI
async function createEOI(req, res) {
    const {
        completing_for,
        has_sci,
        guest_name,
        guest_phone,
        guest_email,
        funding_type,
        support_name,
        support_phone,
        support_email,
        support_role,
        sci_level_cervical = [],
        sci_level_thoracic = [],
        sci_level_lumbar = [],
        sci_level_sacral = [],
        selected_courses,
        course_date_preferences,
        comments,
        guest_id,
        submitted_at
    } = req.body;

    try {
        // Validate required fields
        if (!guest_name || !guest_email || !guest_phone) {
            return res.status(400).json({
                success: false,
                message: 'Guest name, email, and phone are required'
            });
        }

        if (!selected_courses || selected_courses.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one course must be selected'
            });
        }

        // Combine SCI levels into a single string
        const sciLevels = [
            ...sci_level_cervical,
            ...sci_level_thoracic,
            ...sci_level_lumbar,
            ...sci_level_sacral
        ].join(', ');

        // Get course details for the selected courses
        const courses = await Course.findAll({
            where: {
                id: selected_courses
            },
            attributes: ['id', 'title', 'start_date', 'end_date']
        });

        const courseNames = courses.map(c => c.title).join(', ');

        // Create the EOI record
        const eoiRecord = await CourseEOI.create({
            guest_id: guest_id || null,
            guest_name,
            guest_email,
            guest_phone,
            funding_type,
            completing_for,
            has_sci: has_sci === 'yes' || has_sci === true,
            support_name: completing_for === 'other' ? support_name : null,
            support_phone: completing_for === 'other' ? support_phone : null,
            support_email: completing_for === 'other' ? support_email : null,
            support_role: completing_for === 'other' ? support_role : null,
            sci_levels: sciLevels,
            selected_courses: JSON.stringify(selected_courses),
            course_date_preferences: JSON.stringify(course_date_preferences || {}),
            comments,
            status: 'pending',
            submitted_at: submitted_at || new Date()
        });

        console.log('✅ Course EOI created:', {
            id: eoiRecord.id,
            guest_name,
            guest_email,
            courses: courseNames
        });

        // ✅ FIXED: Send notification email to admin with CORRECT field names
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'bookings@sargoodoncollaroy.com';
            const baseUrl = process.env.APP_URL || 'https://booking.sargoodoncollaroy.com.au';
            
            await SendEmail(
                adminEmail,
                `New Course EOI: ${guest_name}`,
                'course-eoi-admin',
                {
                    // ✅ FIXED: Match template variable names exactly
                    guest_name: guest_name,
                    guest_email: guest_email,
                    guest_phone: guest_phone,
                    funding_type: funding_type || 'Not specified',
                    has_sci: has_sci === 'yes' || has_sci === true ? 'Yes' : 'No',
                    sci_levels: sciLevels || 'Not specified',
                    course_name: courseNames,
                    is_completing_for_other: completing_for === 'other',
                    support_name: support_name,
                    support_email: support_email,
                    support_phone: support_phone,
                    support_role: support_role,
                    preferred_dates: course_date_preferences ? JSON.stringify(course_date_preferences) : 'Not specified',
                    comments: comments || 'None provided',
                    // ✅ FIXED: Add admin link with proper base URL
                    admin_link: `${baseUrl}/admin/course-eoi/${eoiRecord.id}`,
                    // ✅ FIXED: Standardized date format
                    submitted_at: moment(submitted_at || Date.now()).format('dddd, D MMMM YYYY [at] h:mm A')
                }
            );
            console.log('✅ Admin notification email sent');
        } catch (emailError) {
            console.error('Failed to send EOI notification email:', emailError);
            // Don't fail the request if email fails
        }

        // ✅ FIXED: Send confirmation email to guest with CORRECT field names
        try {
            await SendEmail(
                guest_email,
                'Your Course Interest Has Been Received - Sargood on Collaroy',
                'course-eoi-confirmation',
                {
                    // ✅ FIXED: Match template variable names exactly
                    guest_name: guest_name,
                    course_name: courseNames
                }
            );
            console.log('✅ Guest confirmation email sent');
        } catch (emailError) {
            console.error('Failed to send EOI confirmation email:', emailError);
            // Don't fail the request if email fails
        }

        return res.status(200).json({
            success: true,
            message: 'Expression of interest submitted successfully',
            data: {
                id: eoiRecord.id,
                courses: courseNames
            }
        });

    } catch (error) {
        console.error('Error submitting course EOI:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to submit expression of interest. Please try again.'
        });
    }
}

// PUT: Update EOI status (for admin)
async function updateEOI(req, res) {
    const { id, status, admin_notes, contacted_at } = req.body;

    try {
        if (!id) {
            return res.status(400).json({
                success: false,
                message: 'EOI ID is required'
            });
        }

        const eoi = await CourseEOI.findByPk(id);
        if (!eoi) {
            return res.status(404).json({
                success: false,
                message: 'EOI not found'
            });
        }

        const updates = {};
        if (status) updates.status = status;
        if (admin_notes !== undefined) updates.admin_notes = admin_notes;
        if (contacted_at) updates.contacted_at = contacted_at;

        await eoi.update(updates);

        return res.status(200).json({
            success: true,
            message: 'EOI updated successfully',
            data: eoi
        });

    } catch (error) {
        console.error('Error updating EOI:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to update EOI'
        });
    }
}