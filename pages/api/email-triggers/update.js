import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';
import { sequelize } from '../../../models';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed' 
    });
  }

  const transaction = await sequelize.transaction();

  try {
    const {
      id,
      recipient,
      email_template_id,
      type = 'highlights',
      enabled = true,
      trigger_questions = [],
      trigger_conditions = null 
    } = req.body;

    // Validation
    const errors = [];

    // Validate ID for update
    if (!id) {
      errors.push('Trigger ID is required for update');
    }

    // Check if trigger exists
    const existingTrigger = await EmailTrigger.findOne({ 
      where: { id },
      transaction 
    });
    
    if (!existingTrigger) {
      await transaction.rollback();
      return res.status(404).json({ 
        success: false, 
        message: 'Email trigger not found' 
      });
    }

    // ✅ CHECK: If only toggling enabled status, skip full validation
    const isOnlyTogglingEnabled = 
      enabled !== existingTrigger.enabled && 
      recipient === existingTrigger.recipient &&
      email_template_id === existingTrigger.email_template_id &&
      type === existingTrigger.type;

    if (!isOnlyTogglingEnabled) {
      // Full validation only when actually updating the trigger configuration

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

      // Validate each trigger question
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

        const questionType = question.question_type || question.type;

        // For single-select types, answer should not be empty
        if (['select', 'radio'].includes(questionType) && !tq.answer) {
          errors.push(`Question "${question.question}" (ID: ${tq.question_id}) requires an answer to be selected`);
        }

        // Validate answer for single-select
        if (['select', 'radio'].includes(questionType) && tq.answer) {
          const options = question.options || [];
          const validValues = options.map(opt => opt.value || opt.label);
          if (!validValues.includes(tq.answer)) {
            errors.push(`Invalid answer "${tq.answer}" for question "${question.question}". Valid options: ${validValues.join(', ')}`);
          }
        }

        // Validate answer for multi-select
        if (['checkbox', 'service-cards', 'multi-select'].includes(questionType) && tq.answer) {
          const options = question.options || [];
          const validValues = options.map(opt => opt.value || opt.label);
          const selectedValues = tq.answer.split(',').map(v => v.trim()).filter(Boolean);
          
          const invalidValues = selectedValues.filter(val => !validValues.includes(val));
          if (invalidValues.length > 0) {
            errors.push(`Invalid answer(s) for question "${question.question}": ${invalidValues.join(', ')}. Valid options: ${validValues.join(', ')}`);
          }
        }
      }

      // Check for duplicate question IDs
      const uniqueQuestionIds = new Set(questionIds);
      if (uniqueQuestionIds.size !== questionIds.length) {
        errors.push('Duplicate question IDs are not allowed');
      }
    }

    // Return validation errors if any
    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ 
        success: false, 
        message: 'Validation failed',
        errors: errors 
      });
    }

    // Update the email trigger
    await existingTrigger.update({
      recipient: recipient.trim(),
      email_template_id: email_template_id,
      type: type,
      enabled: enabled,
      trigger_conditions: trigger_conditions || null,
      trigger_questions: null  // Clear old JSON field
    }, { transaction });

    // Only update trigger questions if not just toggling enabled
    if (!isOnlyTogglingEnabled && trigger_questions.length > 0) {
      // Remove all existing trigger question associations
      await EmailTriggerQuestion.destroy({
        where: { email_trigger_id: id },
        transaction
      });

      // Create new trigger question associations
      const triggerQuestionRecords = trigger_questions.map(tq => ({
        email_trigger_id: id,
        question_id: tq.question_id,
        answer: tq.answer || null
      }));

      await EmailTriggerQuestion.bulkCreate(triggerQuestionRecords, { transaction });
    }

    // Commit the transaction
    await transaction.commit();

    // Fetch the updated trigger with all associations
    const updatedTrigger = await EmailTrigger.findByPk(id, {
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

    console.log('Email trigger updated:', {
      id: updatedTrigger.id,
      recipient: updatedTrigger.recipient,
      enabled: updatedTrigger.enabled,
      questions_count: trigger_questions.length
    });

    return res.status(200).json({ 
      success: true,
      message: 'Email trigger updated successfully',
      data: updatedTrigger
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error updating email trigger:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: error.message 
    });
  }
}