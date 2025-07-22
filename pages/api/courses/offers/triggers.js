import { markOfferAsAccepted, markOffersAsCompleted, updateOffersBasedOnTiming, getOffersNeedingStatusUpdate } from '../../../../utilities/courseOfferTrigger';

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'POST':
        return await handleStatusTrigger(req, res);
      case 'GET':
        return await getStatusInfo(req, res);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          message: `Method ${method} is not supported`
        });
    }
  } catch (error) {
    console.error('Course offer trigger API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}

// Handle status trigger actions
async function handleStatusTrigger(req, res) {
  const { action, offerId, courseId, guestId } = req.body;

  if (!action) {
    return res.status(400).json({
      error: 'Validation error',
      message: 'Action is required'
    });
  }

  try {
    let result;

    switch (action) {
      case 'accept_offer':
        if (!offerId) {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Offer ID is required for accept_offer action'
          });
        }
        result = await markOfferAsAccepted(offerId, guestId);
        break;

      case 'complete_course_offers':
        if (!courseId) {
          return res.status(400).json({
            error: 'Validation error',
            message: 'Course ID is required for complete_course_offers action'
          });
        }
        result = await markOffersAsCompleted(courseId);
        break;

      case 'batch_update_timing':
        result = await updateOffersBasedOnTiming();
        break;

      default:
        return res.status(400).json({
          error: 'Invalid action',
          message: `Action '${action}' is not supported. Valid actions: accept_offer, complete_course_offers, batch_update_timing`
        });
    }

    return res.status(200).json({
      success: true,
      action,
      data: result,
      message: `Action '${action}' completed successfully`
    });

  } catch (error) {
    console.error(`Error executing action '${action}':`, error);
    return res.status(400).json({
      error: 'Action failed',
      message: error.message || `Failed to execute action '${action}'`
    });
  }
}

// Get information about offers needing status updates
async function getStatusInfo(req, res) {
  const { type } = req.query;

  try {
    let result;

    switch (type) {
      case 'pending_updates':
        result = await getOffersNeedingStatusUpdate();
        break;

      default:
        result = await getOffersNeedingStatusUpdate();
        break;
    }

    return res.status(200).json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error getting status info:', error);
    return res.status(500).json({
      error: 'Failed to get status info',
      message: error.message
    });
  }
}

/* 
Usage Examples:

1. Mark an offer as accepted (when guest confirms):
POST /api/courses/offers/triggers
{
  "action": "accept_offer",
  "offerId": 123,
  "guestId": 456 // optional for verification
}

2. Mark all accepted offers for a course as completed (when course ends):
POST /api/courses/offers/triggers
{
  "action": "complete_course_offers",
  "courseId": 789
}

3. Batch update all offers based on timing (scheduled job):
POST /api/courses/offers/triggers
{
  "action": "batch_update_timing"
}

4. Get offers that need status updates:
GET /api/courses/offers/triggers?type=pending_updates

*/