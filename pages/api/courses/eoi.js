import { Course, Guest, CourseEOI } from '../../../models';
import SendEmail from '../../../utilities/mail';

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

        // Send notification email to admin
        try {
            const adminEmail = process.env.ADMIN_EMAIL || 'bookings@sargoodoncollaroy.com';
            
            await SendEmail(
                adminEmail,
                `New Course EOI: ${guest_name}`,
                'course-eoi-admin',
                {
                    eoiId: eoiRecord.id,
                    guestName: guest_name,
                    guestEmail: guest_email,
                    guestPhone: guest_phone,
                    fundingType: funding_type || 'Not specified',
                    hasSCI: has_sci === 'yes' || has_sci === true ? 'Yes' : 'No',
                    sciLevels: sciLevels || 'Not specified',
                    courseNames: courseNames,
                    isCompletingForOther: completing_for === 'other',
                    supportName: support_name,
                    supportEmail: support_email,
                    supportPhone: support_phone,
                    supportRole: support_role,
                    comments: comments,
                    submittedAt: new Date(submitted_at || Date.now()).toLocaleString('en-AU', {
                        dateStyle: 'full',
                        timeStyle: 'short'
                    })
                }
            );
            console.log('✅ Admin notification email sent');
        } catch (emailError) {
            console.error('Failed to send EOI notification email:', emailError);
            // Don't fail the request if email fails
        }

        // Send confirmation email to guest
        try {
            await SendEmail(
                guest_email,
                'Your Course Interest Has Been Received - Sargood on Collaroy',
                'course-eoi-confirmation',
                {
                    guestName: guest_name,
                    courseNames: courseNames
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