import { Course, Guest, CourseOffer, User } from '../../../../models'

export default async function handler(req, res) {
  const { method } = req;
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Offer ID is required'
    });
  }

  try {
    switch (method) {
      case 'GET':
        return await getCourseOffer(req, res);
      case 'PUT':
        return await updateCourseOffer(req, res);
      case 'PATCH':
        return await updateOfferStatus(req, res);
      case 'DELETE':
        return await deleteCourseOffer(req, res);
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

// Get a specific course offer
async function getCourseOffer(req, res) {
  const { id } = req.query;

  try {
    const offer = await CourseOffer.findByPk(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'description', 'start_date', 'end_date', 'min_start_date', 'min_end_date', 'duration_hours', 'ndis_sta_price', 'ndis_hsp_price', 'status']
        },
        {
          model: Guest,
          as: 'guest',
          attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number']
        },
        {
          model: User,
          as: 'offeredBy',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({
        error: 'Offer not found',
        message: 'The specified course offer does not exist'
      });
    }

    // Add computed fields
    const now = new Date();
    const minEndDate = new Date(offer.course.min_end_date);
    const courseStartDate = new Date(offer.course.start_date);
    const courseEndDate = new Date(offer.course.end_date);
    
    const offerData = {
      ...offer.toJSON(),
      isValid: offer.status === 'offered' && now <= minEndDate && now < courseStartDate && offer.course.status === 'active',
      bookingWindowOpen: now <= minEndDate,
      courseStarted: now >= courseStartDate,
      courseEnded: now >= courseEndDate,
      canBeAccepted: offer.status === 'offered' && now <= minEndDate && now < courseStartDate,
      canBeCompleted: offer.status === 'accepted' && now >= courseEndDate,
      // Available status transitions
      availableTransitions: getAvailableTransitions(offer, now, minEndDate, courseStartDate, courseEndDate)
    };

    return res.status(200).json({
      success: true,
      data: offerData
    });

  } catch (error) {
    console.error('Error fetching course offer:', error);
    throw error;
  }
}

// Helper function to determine available status transitions (for automated triggers)
function getAvailableTransitions(offer, now, minEndDate, courseStartDate, courseEndDate) {
  const transitions = [];
  
  switch (offer.status) {
    case 'offered':
      if (now <= minEndDate && now < courseStartDate) {
        transitions.push('accepted');
      }
      break;
      
    case 'accepted':
      if (now >= courseEndDate) {
        transitions.push('completed');
      }
      break;
      
    case 'completed':
      // No further transitions
      break;
  }
  
  return transitions;
}

// Update course offer (notes and course_id only - status managed by automated triggers)
async function updateCourseOffer(req, res) {
  const { id } = req.query;
  const { notes, course_id } = req.body;

  // Validate that at least one field is provided
  if (notes === undefined && course_id === undefined) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'At least one field (notes or course_id) is required for update'
    });
  }

  try {
    const offer = await CourseOffer.findByPk(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'start_date', 'end_date']
        },
        {
          model: Guest,
          as: 'guest',
          attributes: ['id', 'first_name', 'last_name', 'email']
        }
      ]
    });

    if (!offer) {
      return res.status(404).json({
        error: 'Offer not found',
        message: 'The specified course offer does not exist'
      });
    }

    // Validate course_id if provided
    if (course_id !== undefined) {
      const course = await Course.findByPk(course_id);
      if (!course) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'The specified course does not exist'
        });
      }
      
      // Optional: Check if course is active
      if (course.status !== 'active') {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Cannot assign offer to an inactive course'
        });
      }
    }

    // Prepare update data (status is NOT included - managed by triggers)
    const updateData = {};
    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (course_id !== undefined) {
      updateData.course_id = course_id;
    }

    // Update the offer
    await offer.update(updateData);

    // Fetch updated offer with associations
    const updatedOffer = await CourseOffer.findByPk(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'start_date', 'end_date', 'min_start_date', 'min_end_date', 'status']
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

    // Add computed fields
    const now = new Date();
    const minEndDate = new Date(updatedOffer.course.min_end_date);
    const courseStartDate = new Date(updatedOffer.course.start_date);
    const courseEndDate = new Date(updatedOffer.course.end_date);
    
    const offerData = {
      ...updatedOffer.toJSON(),
      isValid: updatedOffer.status === 'offered' && now <= minEndDate && now < courseStartDate && updatedOffer.course.status === 'active',
      bookingWindowOpen: now <= minEndDate,
      courseStarted: now >= courseStartDate,
      courseEnded: now >= courseEndDate,
      canBeAccepted: updatedOffer.status === 'offered' && now <= minEndDate && now < courseStartDate,
      canBeCompleted: updatedOffer.status === 'accepted' && now >= courseEndDate,
      availableTransitions: getAvailableTransitions(updatedOffer, now, minEndDate, courseStartDate, courseEndDate)
    };

    return res.status(200).json({
      success: true,
      message: 'Course offer updated successfully',
      data: offerData
    });

  } catch (error) {
    console.error('Error updating course offer:', error);
    
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

// Update offer status specifically (PATCH method - for automated triggers only)
async function updateOfferStatus(req, res) {
  const { id } = req.query;
  const { status, notes } = req.body;

  if (!status) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Status is required for status update'
    });
  }

  const validStatuses = ['offered', 'accepted', 'completed'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({
      error: 'Validation error',
      message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
    });
  }

  try {
    // Use the model's static method for status update with validation
    const updatedOffer = await CourseOffer.updateOfferStatus(id, status);

    // Update notes if provided
    if (notes !== undefined) {
      await updatedOffer.update({ notes });
    }

    // Fetch the complete updated offer
    const completeOffer = await CourseOffer.findByPk(id, {
      include: [
        {
          model: Course,
          as: 'course',
          attributes: ['id', 'title', 'start_date', 'end_date', 'min_start_date', 'min_end_date', 'status']
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

    // Add computed fields
    const now = new Date();
    const minEndDate = new Date(completeOffer.course.min_end_date);
    const courseStartDate = new Date(completeOffer.course.start_date);
    const courseEndDate = new Date(completeOffer.course.end_date);
    
    const offerData = {
      ...completeOffer.toJSON(),
      isValid: completeOffer.status === 'offered' && now <= minEndDate && now < courseStartDate && completeOffer.course.status === 'active',
      bookingWindowOpen: now <= minEndDate,
      courseStarted: now >= courseStartDate,
      courseEnded: now >= courseEndDate,
      canBeAccepted: completeOffer.status === 'offered' && now <= minEndDate && now < courseStartDate,
      canBeCompleted: completeOffer.status === 'accepted' && now >= courseEndDate,
      availableTransitions: getAvailableTransitions(completeOffer, now, minEndDate, courseStartDate, courseEndDate)
    };

    return res.status(200).json({
      success: true,
      message: `Course offer status updated to '${status}' successfully`,
      data: offerData
    });

  } catch (error) {
    console.error('Error updating offer status:', error);
    
    if (error.message.includes('Invalid status transition') || 
        error.message.includes('cannot be accepted') ||
        error.message.includes('cannot be marked as completed')) {
      return res.status(400).json({
        error: 'Status transition error',
        message: error.message
      });
    }

    if (error.message === 'Offer not found') {
      return res.status(404).json({
        error: 'Offer not found',
        message: 'The specified course offer does not exist'
      });
    }

    throw error;
  }
}

// Delete a course offer
async function deleteCourseOffer(req, res) {
  const { id } = req.query;

  try {
    const offer = await CourseOffer.findByPk(id);

    if (!offer) {
      return res.status(404).json({
        error: 'Offer not found',
        message: 'The specified course offer does not exist'
      });
    }

    // Check if offer can be deleted based on status
    if (offer.status === 'accepted') {
      return res.status(400).json({
        error: 'Cannot delete offer',
        message: 'Cannot delete an accepted offer. Please mark as completed or change status first.'
      });
    }

    // Hard delete the offer
    await offer.destroy();

    return res.status(200).json({
      success: true,
      message: 'Course offer deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting course offer:', error);
    throw error;
  }
}