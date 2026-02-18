/**
 * Create Email Trigger API
 * POST /api/email-triggers/create
 * 
 * Creates a new email trigger with question ID references
 */

import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  try {
    const {
      recipient,
      email_template_id,
      type = 'highlights',
      enabled = true,
      trigger_questions = [],
      trigger_conditions = null 
    } = req.body;

    // Validation
    const errors = [];

    // Validate recipient email if not external type
    if (type !== 'external') {
      if (!recipient || !recipient.trim()) {
        errors.push('Recipient email is required');
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const emails = recipient.split(',').map(e => e.trim());
        const invalidEmails = emails.filter(email => !emailRegex.test(email));
        
        if (invalidEmails.length > 0) {
          errors.push(`Invalid email format for recipient: ${invalidEmails.join(', ')}`);
        }
      }
    }

    // Validate email template
    if (!email_template_id) {
      errors.push('Email template ID is required');
    } else {
      const template = await EmailTemplate.findOne({ 
        where: { id: email_template_id } 
      });
      
      if (!template) {
        errors.push('Email template not found');
      }
    }

    // Validate type
    const validTypes = ['highlights', 'external', 'internal'];
    if (!validTypes.includes(type)) {
      errors.push(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // Only require trigger_questions if no status conditions are set
    if (!Array.isArray(trigger_questions) || trigger_questions.length === 0) {
      if (!trigger_conditions?.booking_status?.length) {
        errors.push('At least one trigger question or booking status condition is required');
      }
    }

    // Validate each trigger question and check if questions exist
    const questionIds = [];
    for (let i = 0; i < trigger_questions.length; i++) {
      const tq = trigger_questions[i];
      
      if (!tq.question_id) {
        errors.push(`Trigger question ${i + 1} is missing question_id`);
        continue;
      }

      questionIds.push(tq.question_id);

      // Verify question exists
      const question = await Question.findByPk(tq.question_id);
      if (!question) {
        errors.push(`Question with ID ${tq.question_id} not found`);
        continue;
      }

      // For select and radio types, answer should not be empty
      if ((question.question_type === 'select' || question.question_type === 'radio') && !tq.answer) {
        errors.push(`Question "${question.question}" (ID: ${tq.question_id}) requires an answer to be selected`);
      }

      // Validate answer is one of the valid options for select/radio
      if ((question.question_type === 'select' || question.question_type === 'radio') && tq.answer) {
        const options = question.options || [];
        const validValues = options.map(opt => opt.value);
        if (!validValues.includes(tq.answer)) {
          errors.push(`Invalid answer "${tq.answer}" for question "${question.question}". Valid options: ${validValues.join(', ')}`);
        }
      }
    }

    // Check for duplicate question IDs
    const uniqueQuestionIds = new Set(questionIds);
    if (uniqueQuestionIds.size !== questionIds.length) {
      errors.push('Duplicate question IDs are not allowed');
    }

    // Return validation errors if any
    if (errors.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors 
      });
    }

    // Create the email trigger
    const emailTrigger = await EmailTrigger.create({
      recipient: recipient.trim(),
      email_template_id: email_template_id,
      type: type,
      enabled: enabled,
      trigger_count: 0,
      trigger_conditions: trigger_conditions || null 
    });

    // Create the trigger question associations
    const triggerQuestionRecords = trigger_questions.map(tq => ({
      email_trigger_id: emailTrigger.id,
      question_id: tq.question_id,
      answer: tq.answer || null
    }));

    await EmailTriggerQuestion.bulkCreate(triggerQuestionRecords);

    // Fetch the complete trigger with all associations
    const completeTrigger = await EmailTrigger.findByPk(emailTrigger.id, {
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject']
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

    // Log the creation for audit purposes
    console.log('Email trigger created:', {
      id: completeTrigger.id,
      recipient: completeTrigger.recipient,
      questions_count: trigger_questions.length
    });

    return res.status(201).json({ 
      success: true,
      message: 'Email trigger created successfully',
      data: completeTrigger
    });

  } catch (error) {
    console.error('Error creating email trigger:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
}

/**
 * Example Request Body:
 * 
 * {
 *   "recipient": "events@company.com",
 *   "email_template_id": 1,
 *   "type": "highlights",
 *   "enabled": true,
 *   "trigger_questions": [
 *     {
 *       "question_id": 5,
 *       "answer": "11-25"
 *     },
 *     {
 *       "question_id": 8,
 *       "answer": "yes"
 *     }
 *   ]
 * }
 * 
 * Response includes full question details:
 * {
 *   "success": true,
 *   "message": "Email trigger created successfully",
 *   "data": {
 *     "id": 1,
 *     "recipient": "events@company.com",
 *     "email_template_id": 1,
 *     "type": "highlights",
 *     "enabled": true,
 *     "template": {
 *       "id": 1,
 *       "name": "Event Inquiry",
 *       "subject": "New Event Request"
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
 *           "options": [...]
 *         }
 *       }
 *     ]
 *   }
 * }
 */