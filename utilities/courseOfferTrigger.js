// Helper functions for automated status triggers
import { CourseOffer, Course, Guest } from '../models';
import { Op } from 'sequelize';

/**
 * Automatically update offers to 'accepted' status
 * This would typically be called when a guest confirms their booking
 */
export async function markOfferAsAccepted(offerId, guestId = null) {
  try {
    const offer = await CourseOffer.findByPk(offerId, {
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    if (!offer) {
      throw new Error('Offer not found');
    }

    // Optional: Verify guest if provided
    if (guestId && offer.guest_id !== guestId) {
      throw new Error('Guest mismatch');
    }

    // Use the model's built-in validation
    const updatedOffer = await CourseOffer.updateOfferStatus(offerId, 'accepted');
    
    console.log(`Offer ${offerId} marked as accepted for guest ${offer.guest_id}`);
    return updatedOffer;
  } catch (error) {
    console.error('Error marking offer as accepted:', error);
    throw error;
  }
}

/**
 * Automatically update offers to 'completed' status
 * This would typically be called after a course ends
 */
export async function markOffersAsCompleted(courseId) {
  try {
    const offers = await CourseOffer.findAll({
      where: {
        course_id: courseId,
        status: 'accepted'
      },
      include: [{
        model: Course,
        as: 'course'
      }]
    });

    const results = [];
    
    for (const offer of offers) {
      try {
        const updatedOffer = await CourseOffer.updateOfferStatus(offer.id, 'completed');
        results.push({ success: true, offerId: offer.id, guestId: offer.guest_id });
        console.log(`Offer ${offer.id} marked as completed for guest ${offer.guest_id}`);
      } catch (error) {
        console.error(`Failed to complete offer ${offer.id}:`, error);
        results.push({ success: false, offerId: offer.id, error: error.message });
      }
    }

    return results;
  } catch (error) {
    console.error('Error marking offers as completed:', error);
    throw error;
  }
}

/**
 * Batch update offers based on course timing
 * This could be run as a scheduled job
 */
export async function updateOffersBasedOnTiming() {
  try {
    const now = new Date();
    
    // Find accepted offers where the course has ended
    const offersToComplete = await CourseOffer.findAll({
      where: {
        status: 'accepted'
      },
      include: [{
        model: Course,
        as: 'course',
        where: {
          end_date: {
            [Op.lte]: now
          }
        }
      }]
    });

    const completionResults = [];
    
    for (const offer of offersToComplete) {
      try {
        await CourseOffer.updateOfferStatus(offer.id, 'completed');
        completionResults.push({ 
          success: true, 
          offerId: offer.id, 
          courseId: offer.course_id,
          action: 'completed'
        });
      } catch (error) {
        completionResults.push({ 
          success: false, 
          offerId: offer.id, 
          error: error.message,
          action: 'completed'
        });
      }
    }

    return {
      completed: completionResults,
      summary: {
        totalProcessed: offersToComplete.length,
        successful: completionResults.filter(r => r.success).length,
        failed: completionResults.filter(r => !r.success).length
      }
    };
  } catch (error) {
    console.error('Error in batch status update:', error);
    throw error;
  }
}

/**
 * Get offers that need status updates
 * Useful for monitoring and manual review
 */
export async function getOffersNeedingStatusUpdate() {
  try {
    const now = new Date();
    
    // Find accepted offers where course has ended
    const offersToComplete = await CourseOffer.findAll({
      where: {
        status: 'accepted'
      },
      include: [{
        model: Course,
        as: 'course',
        where: {
          end_date: {
            [Op.lte]: now
          }
        }
      }, {
        model: Guest,
        as: 'guest',
        attributes: ['id', 'first_name', 'last_name', 'email']
      }]
    });

    return {
      offersToComplete: offersToComplete.map(offer => ({
        id: offer.id,
        courseId: offer.course_id,
        courseName: offer.course.title,
        guestId: offer.guest_id,
        guestName: `${offer.guest.first_name} ${offer.guest.last_name}`,
        guestEmail: offer.guest.email,
        courseEndDate: offer.course.end_date,
        daysOverdue: Math.floor((now - new Date(offer.course.end_date)) / (1000 * 60 * 60 * 24))
      }))
    };
  } catch (error) {
    console.error('Error getting offers needing status update:', error);
    throw error;
  }
}