import { Course, Guest, CourseEOI } from '../../../models';
import moment from 'moment';
import EmailService from '../../../services/booking/emailService';
import EmailRecipientsService from '../../../services/email/EmailRecipientsService';
import { TEMPLATE_IDS } from '../../../services/booking/templateIds';
import EmailTriggerService from '../../../services/booking/emailTriggerService';

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

// ✅ UPDATED: Helper function to format course date preferences with new structure
function formatPreferredDates(courseDatePreferences, courses, selectedCourses) {
    if (!courseDatePreferences || Object.keys(courseDatePreferences).length === 0) {
        return 'Not specified';
    }

    try {
        const formattedDates = [];
        
        // Iterate in the same order as selected courses to maintain consistency
        for (const courseId of selectedCourses) {
            const preferences = courseDatePreferences[courseId];
            
            // ✅ Just show the dates without course name since it's already displayed separately
            if (preferences && preferences.arrival_date && preferences.departure_date) {
                const arrivalFormatted = moment(preferences.arrival_date).format('DD MMM YYYY');
                const departureFormatted = moment(preferences.departure_date).format('DD MMM YYYY');
                formattedDates.push(`${arrivalFormatted} - ${departureFormatted}`);
            }
        }
        
        return formattedDates.length > 0 ? formattedDates.join('\n') : 'Not specified';
    } catch (error) {
        console.error('Error formatting preferred dates:', error);
        return 'Not specified';
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

        // ✅ NEW: Validate date preferences are provided for all selected courses
        if (!course_date_preferences || Object.keys(course_date_preferences).length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please specify your preferred dates for each selected course'
            });
        }

        for (const courseId of selected_courses) {
            const datePrefs = course_date_preferences[courseId];
            if (!datePrefs || !datePrefs.arrival_date || !datePrefs.departure_date) {
                return res.status(400).json({
                    success: false,
                    message: 'Please specify arrival and departure dates for all selected courses'
                });
            }
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
            attributes: ['id', 'title', 'start_date', 'end_date', 'min_start_date', 'min_end_date']
        });

        const courseNames = courses.map(c => c.title).join(', ');

        // ✅ NEW: Validate dates are within the booking window
        // Note: All dates are handled in local Australian timezone since this is an AU-only app
        for (const courseId of selected_courses) {
            const course = courses.find(c => c.id === courseId);
            if (!course) continue;

            const datePrefs = course_date_preferences[courseId];
            
            // Force local timezone interpretation by adding time component
            const arrivalDate = new Date(datePrefs.arrival_date + 'T00:00:00');
            const departureDate = new Date(datePrefs.departure_date + 'T00:00:00');
            const minStartDate = new Date(moment(course.min_start_date).format('YYYY-MM-DD') + 'T00:00:00');
            const minEndDate = new Date(moment(course.min_end_date).format('YYYY-MM-DD') + 'T00:00:00');

            if (arrivalDate < minStartDate) {
                return res.status(400).json({
                    success: false,
                    message: `Arrival date for ${course.title} cannot be before ${moment(course.min_start_date).format('DD MMM YYYY')}`
                });
            }

            if (departureDate > minEndDate) {
                return res.status(400).json({
                    success: false,
                    message: `Departure date for ${course.title} cannot be after ${moment(course.min_end_date).format('DD MMM YYYY')}`
                });
            }

            if (departureDate <= arrivalDate) {
                return res.status(400).json({
                    success: false,
                    message: `Departure date must be after arrival date for ${course.title}`
                });
            }
        }

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

        // Send admin notification with ALL data properly formatted
        // try {
        //     const eoiRecipients = await EmailRecipientsService.getRecipientsString('eoi');
        //     if (!eoiRecipients) {
        //         console.warn('⚠️ No EOI recipients configured in settings');
        //     } else {
        //         const baseUrl = process.env.APP_URL || 'https://bookings.sargoodoncollaroy.com.au';
                
        //         // Format preferred dates for email display
        //         const formattedPreferredDates = formatPreferredDates(course_date_preferences, courses, selected_courses);
                
        //         await EmailService.sendWithTemplate(
        //             eoiRecipients,
        //             TEMPLATE_IDS.COURSE_EOI_ADMIN,
        //             {
        //                 // Guest details
        //                 guest_name: guest_name,
        //                 guest_email: guest_email,
        //                 guest_phone: guest_phone,
                        
        //                 // Course details
        //                 course_name: courseNames,
        //                 preferred_dates: formattedPreferredDates,
        //                 comments: comments || 'None provided',
                        
        //                 // Funding and eligibility
        //                 funding_type: funding_type || 'Not specified',
        //                 has_sci: has_sci === 'yes' || has_sci === true ? 'Yes' : 'No',
        //                 sci_levels: sciLevels || 'Not specified',
                        
        //                 // Completing for information
        //                 completing_for: completing_for === 'myself' ? 'Self' : 'Someone else',
        //                 is_completing_for_other: completing_for === 'other',
                        
        //                 // Support person details (only if completing for other)
        //                 support_name: support_name || '',
        //                 support_email: support_email || '',
        //                 support_phone: support_phone || '',
        //                 support_role: support_role || '',
                        
        //                 // Admin link and metadata
        //                 admin_link: `${baseUrl}/courses?selectedTab=eoi&eoiId=${eoiRecord.id}`,
        //                 submitted_at: moment(submitted_at || Date.now()).format('dddd, D MMMM YYYY [at] h:mm A')
        //             }
        //         );
        //         console.log('✅ Admin notification email sent to EOI recipients:', eoiRecipients);
        //     }
        // } catch (emailError) {
        //     console.error('Failed to send EOI notification email:', emailError);
        //     // Don't fail the request if email fails
        // }

        // Send guest confirmation using EmailService
        // try {
        //     await EmailService.sendWithTemplate(
        //         guest_email,
        //         TEMPLATE_IDS.COURSE_EOI_CONFIRMATION,
        //         {
        //             guest_name: guest_name,
        //             course_name: courseNames
        //         }
        //     );
        //     console.log('✅ Guest confirmation email sent');
        // } catch (emailError) {
        //     console.error('Failed to send EOI confirmation email:', emailError);
        //     // Don't fail the request if email fails
        // }

        // 🔔 Fire any configured system triggers for course_eoi_submitted
        await eoiSubmittedTriggerDispatch(eoiRecord, courseNames, courses);

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

async function eoiSubmittedTriggerDispatch(eoiRecord, courseNames, courses) {
  // 🔔 Fire any configured system triggers for course_eoi_submitted
  try {
    await EmailTriggerService.evaluateAndSendTriggers(null, {
      course_eoi_submitted: true,
      guest_email:          eoiRecord.guest_email,
      guest_name:           eoiRecord.guest_name,
      course_name:          courseNames,
      course_id:            courses[0]?.id,
      eoi_id:               eoiRecord.id,
    });
  } catch (triggerErr) {
    console.warn('⚠️ course_eoi_submitted trigger dispatch failed (non-fatal):', triggerErr.message);
  }
}