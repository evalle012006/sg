/**
 * GET /api/email-triggers/[id]
 * Fetch a single email trigger by ID with template and question data
 */

import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';

export default async function handler(req, res) {
  const { id } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

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
 * Example Response:
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
 *         "created_at": "2025-10-01T09:00:00.000Z",
 *         "updated_at": "2025-10-01T09:00:00.000Z",
 *         "question": {
 *           "id": 5,
 *           "question": "How many guests are you expecting?",
 *           "question_key": "guest_count",
 *           "question_type": "select",
 *           "section_id": 1,
 *           "options": [
 *             { "label": "1-10 guests", "value": "1-10" },
 *             { "label": "11-25 guests", "value": "11-25" },
 *             { "label": "26-50 guests", "value": "26-50" }
 *           ]
 *         }
 *       },
 *       {
 *         "id": 2,
 *         "email_trigger_id": 1,
 *         "question_id": 8,
 *         "answer": "yes",
 *         "created_at": "2025-10-01T09:00:00.000Z",
 *         "updated_at": "2025-10-01T09:00:00.000Z",
 *         "question": {
 *           "id": 8,
 *           "question": "Will you need catering services?",
 *           "question_key": "need_catering",
 *           "question_type": "radio",
 *           "section_id": 1,
 *           "options": [
 *             { "label": "Yes", "value": "yes" },
 *             { "label": "No", "value": "no" }
 *           ]
 *         }
 *       }
 *     ]
 *   }
 * }
 */