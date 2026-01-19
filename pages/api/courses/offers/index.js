import { Course, Guest, CourseOffer, User, Booking } from '../../../../models';
import { v4 as uuidv4 } from 'uuid';
import { Transaction, Op } from 'sequelize';
import StorageService from '../../../../services/storage/storage';
import sendMail from '../../../../utilities/mail';
import moment from 'moment';

const MAX_BULK_CREATE_SIZE = 100; // Limit bulk operations to prevent memory issues
const MAX_GUEST_SELECTION = 50; // Limit guest selection to prevent abuse

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await createCourseOffer(req, res);
      case 'GET':
        return await getCourseOffers(req, res);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          message: `Method ${method} is not supported`
        });
    }
  } catch (error) {
    console.error('Course offer API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}

// Create course offer(s) - supports both single and bulk creation with email notifications
async function createCourseOffer(req, res) {
  const {
    course_id,
    guest_id,    // Single guest (for edit mode)
    guest_ids,   // Multiple guests (for bulk creation)
    notes,
    offered_by,
    status = 'offered', // Default to 'offered' when creating offers
    send_email = true   // Option to disable email sending
  } = req.body;

  // Determine if this is a bulk operation
  const isBulkOperation = Array.isArray(guest_ids) && guest_ids.length > 0;
  const targetGuestIds = isBulkOperation ? guest_ids : [guest_id];

  // Validate required fields
  if (!course_id) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Course ID is required'
    });
  }

  if (!isBulkOperation && !guest_id) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Guest ID is required'
    });
  }

  if (isBulkOperation && (!guest_ids || guest_ids.length === 0)) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'At least one guest ID is required for bulk creation'
    });
  }

  // Validate status
  const validStatuses = ['available', 'offered', 'accepted', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  // Prevent abuse - limit bulk operations
  if (isBulkOperation && guest_ids.length > MAX_GUEST_SELECTION) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Cannot create offers for more than ${MAX_GUEST_SELECTION} guests at once`
    });
  }

  // Use database transaction for data integrity
  const transaction = await Course.sequelize.transaction();

  try {
    // Check if course exists and is active
    const course = await Course.findByPk(course_id, { transaction });
    
    if (!course || course.deleted_at) {
      await transaction.rollback();
      return res.status(404).json({
        error: 'Course not found',
        message: 'The specified course does not exist or has been deleted'
      });
    }

    if (course.status !== 'active') {
      await transaction.rollback();
      return res.status(400).json({
        error: 'Invalid course status',
        message: 'Course must be active to be offered to guests'
      });
    }

    // Check course timing for 'offered' status
    if (status === 'offered') {
      const now = new Date();
      const minEndDate = new Date(course.min_end_date);
      const courseStartDate = new Date(course.start_date);
      
      if (now > minEndDate) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Booking window closed',
          message: 'The booking window for this course has closed'
        });
      }

      if (now >= courseStartDate) {
        await transaction.rollback();
        return res.status(400).json({
          error: 'Course already started',
          message: 'Cannot offer courses that have already started'
        });
      }
    }

    // Validate all guests exist and are active
    const guests = await Guest.findAll({
      where: {
        id: targetGuestIds,
        active: true
      },
      attributes: ['id', 'first_name', 'last_name', 'email'],
      transaction
    });

    if (guests.length !== targetGuestIds.length) {
      await transaction.rollback();
      const foundIds = guests.map(g => g.id);
      const missingIds = targetGuestIds.filter(id => !foundIds.includes(id));
      return res.status(404).json({
        error: 'Invalid guests',
        message: `Some guests were not found or are inactive: ${missingIds.join(', ')}`
      });
    }

    // Check for existing active offers (exclude completed offers)
    const existingOffers = await CourseOffer.findAll({
      where: {
        course_id,
        guest_id: targetGuestIds,
        status: {
          [Op.notIn]: ['completed']
        }
      },
      attributes: ['guest_id', 'status'],
      include: [{
        model: Guest,
        as: 'guest',
        attributes: ['first_name', 'last_name']
      }],
      transaction
    });

    if (existingOffers.length > 0) {
      await transaction.rollback();
      const existingGuestIds = existingOffers.map(offer => offer.guest_id);
      const existingGuests = existingOffers.map(offer => 
        `${offer.guest.first_name} ${offer.guest.last_name} (${offer.status})`
      );
      
      return res.status(409).json({
        error: 'Duplicate offers',
        message: `The following guests already have active offers for this course: ${existingGuests.join(', ')}`
      });
    }

    // Prepare bulk insert data
    const offersToCreate = targetGuestIds.map(guestId => ({
      uuid: uuidv4(),
      course_id,
      guest_id: guestId,
      notes: notes || null,
      offered_by: offered_by || null,
      status: status,
      created_at: new Date(),
      updated_at: new Date()
    }));

    let createdOffers = [];

    if (isBulkOperation && offersToCreate.length > MAX_BULK_CREATE_SIZE) {
      // Process in chunks for very large operations
      const chunks = [];
      for (let i = 0; i < offersToCreate.length; i += MAX_BULK_CREATE_SIZE) {
        chunks.push(offersToCreate.slice(i, i + MAX_BULK_CREATE_SIZE));
      }

      for (const chunk of chunks) {
        const chunkResult = await CourseOffer.bulkCreate(chunk, {
          transaction,
          returning: true, // Get created records back
          validate: false  // Skip individual validations for performance
        });
        createdOffers.push(...chunkResult);
      }
    } else {
      // Single bulk create for smaller operations
      createdOffers = await CourseOffer.bulkCreate(offersToCreate, {
        transaction,
        returning: true,
        validate: false
      });
    }

    // Commit the transaction before sending emails
    await transaction.commit();

    // Send email notifications if requested and status is 'offered'
    let emailResults = { sent: 0, failed: 0, errors: [] };
    
    if (send_email && status === 'offered') {
      emailResults = await sendCourseOfferEmails(createdOffers, course, guests);
    }

    // For single offer, return detailed response with image URL
    if (!isBulkOperation) {
      const detailedOffer = await CourseOffer.findByPk(createdOffers[0].id, {
        include: [
          {
            model: Course,
            as: 'course',
            attributes: ['id', 'title', 'start_date', 'end_date', 'min_start_date', 'min_end_date', 'image_filename']
          },
          {
            model: Guest,
            as: 'guest',
            attributes: ['id', 'first_name', 'last_name', 'email']
          },
          {
            model: User,
            as: 'offeredBy',
            attributes: ['id', 'first_name', 'last_name', 'email']
          }
        ]
      });

      // Generate signed URL for course image
      if (detailedOffer.course.image_filename) {
        try {
          const storage = new StorageService({ bucketType: 'restricted' });
          detailedOffer.course.dataValues.imageUrl = await storage.getSignedUrl('courses/' + detailedOffer.course.image_filename);
        } catch (error) {
          console.error('Error generating signed URL for course image:', error);
          detailedOffer.course.dataValues.imageUrl = null;
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Course offer created successfully',
        data: detailedOffer,
        email_status: emailResults
      });
    }

    // For bulk operations, return summary
    return res.status(201).json({
      success: true,
      message: `Successfully created ${createdOffers.length} course offer(s) with status '${status}'`,
      data: {
        created_count: createdOffers.length,
        course_id,
        guest_count: targetGuestIds.length,
        status: status,
        offer_ids: createdOffers.map(offer => offer.id)
      },
      email_status: emailResults
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating course offer(s):', error);
    
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid data provided',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    throw error;
  }
}

// ✅ FIXED: Send course offer emails to guests with CORRECT field names
async function sendCourseOfferEmails(createdOffers, course, guests) {
  const storage = new StorageService({ bucketType: 'restricted' });
  const baseUrl = process.env.APP_URL || 'https://booking.sargoodoncollaroy.com.au';
  let emailResults = { sent: 0, failed: 0, errors: [] };

  // Generate course image URL if available
  let courseImageUrl = null;
  if (course.image_filename) {
    try {
      courseImageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
    } catch (error) {
      console.error('Error generating signed URL for course image:', error);
    }
  }

  // Create a map of guest_id to guest for easy lookup
  const guestMap = new Map(guests.map(guest => [guest.id, guest]));

  // Send emails for each offer
  for (const offer of createdOffers) {
    const guest = guestMap.get(offer.guest_id);
    
    if (!guest) {
      emailResults.failed++;
      emailResults.errors.push(`Guest not found for offer ${offer.id}`);
      continue;
    }

    try {
      // ✅ FIXED: Format dates consistently (DD MMMM YYYY format)
      const startDate = moment(course.min_start_date);
      const endDate = moment(course.min_end_date);
      
      const emailData = {
        // ✅ FIXED: Match template variable names exactly
        guest_name: guest.first_name,
        course_name: course.title,
        
        // ✅ FIXED: Provide course_dates as a single formatted range
        course_dates: `${startDate.format('D MMMM YYYY')} - ${endDate.format('D MMMM YYYY')}`,
        
        // ✅ FIXED: Add course_location (standard for all courses)
        course_location: 'Sargood on Collaroy',
        
        // ✅ FIXED: Add course_description
        course_description: course.description || '',
        
        // ✅ FIXED: Rename booking_deadline to response_deadline and use consistent format
        response_deadline: endDate.format('D MMMM YYYY'),
        
        // Optional fields
        duration_hours: course.duration_hours,
        notes: offer.notes || '',
        course_image_url: courseImageUrl,
        
        // ✅ FIXED: Add accept_link and decline_link (was missing decline_link)
        accept_link: `${baseUrl}/course-offers/${offer.uuid}/accept`,
        decline_link: `${baseUrl}/course-offers/${offer.uuid}/decline`,
        
        // Additional helper fields
        start_date: startDate.format('D MMMM YYYY'),
        end_date: endDate.format('D MMMM YYYY'),
        start_date_long: startDate.format('dddd, D MMMM YYYY'),
        end_date_long: endDate.format('dddd, D MMMM YYYY')
      };

      await sendMail(
        guest.email,
        'New Course Offer Available - Sargood on Collaroy',
        'course-offer-notification',
        emailData
      );

      emailResults.sent++;
      console.log(`✅ Course offer email sent successfully to ${guest.email} for course ${course.title}`);

    } catch (error) {
      emailResults.failed++;
      emailResults.errors.push(`Failed to send email to ${guest.email}: ${error.message}`);
      console.error(`❌ Error sending course offer email to ${guest.email}:`, error);
    }
  }

  return emailResults;
}

// UPDATED: Get course offers with booking support
async function getCourseOffers(req, res) {
  const { 
    course_id, 
    guest_id, 
    status,
    limit = 50,
    offset = 0,
    orderBy = 'created_at',
    orderDirection = 'DESC',
    include_invalid = 'false',
    include_booked = 'false', // NEW: Include courses already linked to bookings
    search = ''
  } = req.query;

  try {
    const whereClause = {};
    const includeClause = [
      {
        model: Course,
        as: 'course',
        attributes: ['id', 'title', 'start_date', 'end_date', 'min_start_date', 'min_end_date', 'status', 'image_filename', 'duration_hours', 'description']
      },
      {
        model: Guest,
        as: 'guest',
        attributes: ['id', 'first_name', 'last_name', 'email']
      },
      {
        model: User,
        as: 'offeredBy',
        attributes: ['id', 'first_name', 'last_name', 'email']
      },
      // NEW: Include booking information when available
      {
        model: Booking,
        as: 'booking',
        attributes: ['id', 'uuid', 'reference_id', 'type', 'status', 'complete'],
        required: false // LEFT JOIN - don't require a booking
      }
    ];
    
    if (course_id) whereClause.course_id = course_id;
    if (guest_id) whereClause.guest_id = guest_id;
    
    // NEW: Filter by booking status if requested
    if (include_booked === 'false') {
      // Only show offers not yet linked to bookings
      whereClause.booking_id = null;
    }
    // If include_booked === 'true', we show all offers (both linked and unlinked)
    
    // Filter by status
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      const validStatuses = ['available', 'offered', 'accepted', 'completed'];
      const filteredStatuses = statusArray.filter(s => validStatuses.includes(s));
      
      if (filteredStatuses.length > 0) {
        whereClause.status = filteredStatuses.length === 1 ? filteredStatuses[0] : { [Op.in]: filteredStatuses };
      }
    }

    // Add search functionality for guest names
    if (search.trim()) {
      includeClause[1].where = {
        [Op.or]: [
          {
            first_name: {
              [Op.iLike]: `%${search.trim()}%`
            }
          },
          {
            last_name: {
              [Op.iLike]: `%${search.trim()}%`
            }
          },
          {
            email: {
              [Op.iLike]: `%${search.trim()}%`
            }
          }
        ]
      };
    }

    // Set up ordering
    const validOrderFields = ['created_at', 'offered_at', 'status', 'updated_at'];
    const validDirections = ['ASC', 'DESC'];
    
    let orderClause = [['created_at', 'DESC']]; // default
    if (validOrderFields.includes(orderBy) && validDirections.includes(orderDirection.toUpperCase())) {
      orderClause = [[orderBy, orderDirection.toUpperCase()]];
    }

    const { count, rows: offers } = await CourseOffer.findAndCountAll({
      where: whereClause,
      include: includeClause,
      order: orderClause,
      limit: Math.min(parseInt(limit), 100), // Cap at 100 for performance
      offset: parseInt(offset),
      distinct: true // Important when using includes with potential duplicates
    });

    // Generate signed URLs for course images
    const storage = new StorageService({ bucketType: 'restricted' });
    for (const offer of offers) {
      if (offer.course && offer.course.image_filename) {
        try {
          offer.course.dataValues.imageUrl = await storage.getSignedUrl('courses/' + offer.course.image_filename);
        } catch (error) {
          console.error('Error generating signed URL for course image:', error);
          offer.course.dataValues.imageUrl = null;
        }
      } else if (offer.course) {
        offer.course.dataValues.imageUrl = null;
      }
    }

    // Filter out invalid offers if requested (legacy compatibility)
    let filteredOffers = offers;
    if (include_invalid !== 'true') {
      filteredOffers = offers.filter(offer => {
        const now = new Date();
        const minEndDate = new Date(offer.course.min_end_date);
        const courseStartDate = new Date(offer.course.start_date);
        
        // Only include offers where booking window is still open or already accepted/completed
        const validStatuses = ['accepted', 'completed'];
        return validStatuses.includes(offer.status) || 
               (offer.status === 'offered' && now <= minEndDate && now < courseStartDate && offer.course.status === 'active');
      });
    }

    // Add computed fields for display
    const processedOffers = filteredOffers.map(offer => {
      const now = new Date();
      const minEndDate = new Date(offer.course.min_end_date);
      const courseStartDate = new Date(offer.course.start_date);
      const courseEndDate = new Date(offer.course.end_date);
      
      return {
        ...offer.toJSON(),
        isValid: offer.status === 'offered' && now <= minEndDate && now < courseStartDate && offer.course.status === 'active',
        bookingWindowOpen: now <= minEndDate,
        courseStarted: now >= courseStartDate,
        courseEnded: now >= courseEndDate,
        canBeAccepted: offer.status === 'offered' && now <= minEndDate && now < courseStartDate,
        canBeCompleted: offer.status === 'accepted' && now >= courseEndDate,
        
        isLinkedToBooking: offer.booking_id !== null,
        canBookNow: offer.status === 'offered' && offer.booking_id === null && now <= minEndDate && now < courseStartDate && offer.course.status === 'active'
      };
    });

    return res.status(200).json({
      success: true,
      data: processedOffers,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: (parseInt(offset) + parseInt(limit)) < count
      },

      summary: {
        total_offers: processedOffers.length,
        available_to_book: processedOffers.filter(offer => offer.canBookNow).length,
        already_booked: processedOffers.filter(offer => offer.isLinkedToBooking).length,
        expired_offers: processedOffers.filter(offer => !offer.isValid && !offer.isLinkedToBooking).length
      }
    });

  } catch (error) {
    console.error('Error fetching course offers:', error);
    throw error;
  }
}