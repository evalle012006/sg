/**
 * Email Trigger API - GET and DELETE by ID
 * GET /api/email-triggers/[id] - Fetch a single email trigger
 * DELETE /api/email-triggers/[id] - Delete an email trigger
 */

import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';

export default async function handler(req, res) {
  const { id } = req.query;

  // Validate ID
  if (!id || isNaN(parseInt(id))) {
    return res.status(400).json({ 
      success: false, 
      message: 'Invalid trigger ID' 
    });
  }

  // Route based on HTTP method
  switch (req.method) {
    case 'GET':
      return handleGet(req, res, id);
    case 'DELETE':
      return handleDelete(req, res, id);
    default:
      return res.status(405).json({ 
        success: false, 
        message: 'Method not allowed' 
      });
  }
}

/**
 * GET Handler - Fetch email trigger by ID with template and question data
 */
async function handleGet(req, res, id) {
  try {
    const trigger = await EmailTrigger.findByPk(id, {
      include: [
        {
          model: EmailTemplate,
          as: 'template'
        },
        {
          model: EmailTriggerQuestion,
          as: 'triggerQuestions',
          include: [
            {
              model: Question,
              as: 'question'
            }
          ]
        }
      ]
    });

    if (!trigger) {
      return res.status(404).json({
        success: false,
        message: 'Email trigger not found'
      });
    }

    return res.status(200).json({
      success: true,
      data: trigger
    });

  } catch (error) {
    console.error('Error fetching email trigger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch email trigger',
      error: error.message
    });
  }
}

/**
 * DELETE Handler - Delete email trigger and cascade to email_trigger_questions
 */
async function handleDelete(req, res, id) {
  try {
    // Find the trigger
    const trigger = await EmailTrigger.findByPk(parseInt(id));

    if (!trigger) {
      return res.status(404).json({ 
        success: false, 
        message: 'Email trigger not found' 
      });
    }

    // Check if trigger is active/enabled
    if (trigger.enabled) {
      return res.status(400).json({ 
        success: false, 
        error: 'Trigger is active',
        message: 'Cannot delete an active email trigger. Please disable it first before deleting.',
        trigger_enabled: true
      });
    }

    // Delete the trigger (cascade delete will handle email_trigger_questions)
    await trigger.destroy();

    // Log deletion for audit purposes
    console.log('Email trigger deleted:', {
      id: trigger.id,
      recipient: trigger.recipient,
      deleted_at: new Date().toISOString()
    });

    return res.status(200).json({ 
      success: true, 
      message: 'Email trigger deleted successfully' 
    });

  } catch (error) {
    console.error('Error deleting email trigger:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message || 'Internal server error' 
    });
  }
}

/**
 * Example GET Response:
 * 
 * {
 *   "success": true,
 *   "data": {
 *     "id": 1,
 *     "recipient": "events@company.com",
 *     "email_template_id": 1,
 *     "type": "highlights",
 *     "enabled": true,
 *     "trigger_count": 5,
 *     "last_triggered_at": "2025-10-20T10:30:00.000Z",
 *     "created_at": "2025-10-01T09:00:00.000Z",
 *     "updated_at": "2025-10-20T10:30:00.000Z",
 *     "template": {
 *       "id": 1,
 *       "name": "Event Inquiry Template",
 *       "subject": "New Event Request Received",
 *       "body": "..."
 *     },
 *     "triggerQuestions": [
 *       {
 *         "id": 1,
 *         "email_trigger_id": 1,
 *         "question_id": 5,
 *         "answer": "11-25",
 *         "question": {
 *           "id": 5,
 *           "question": "How many guests are you expecting?",
 *           "question_key": "guest_count",
 *           "question_type": "select",
 *           "section_id": 1,
 *           "options": [...]
 *         }
 *       }
 *     ]
 *   }
 * }
 * 
 * Example DELETE Responses:
 * 
 * Success:
 * {
 *   "success": true,
 *   "message": "Email trigger deleted successfully"
 * }
 * 
 * Error - Active trigger:
 * {
 *   "success": false,
 *   "error": "Trigger is active",
 *   "message": "Cannot delete an active email trigger. Please disable it first before deleting.",
 *   "trigger_enabled": true
 * }
 * 
 * Error - Not found:
 * {
 *   "success": false,
 *   "message": "Email trigger not found"
 * }
 */