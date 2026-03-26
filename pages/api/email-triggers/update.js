import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';
import { sequelize } from '../../../models';

// Sentinel values that are valid recipients but not email addresses
// 'guest_email' -> resolved at send time to booking.Guest.email
// 'user_email'  -> resolved at send time to context.user_email (user_account_created)
const RECIPIENT_SENTINELS = ['guest_email', 'user_email'];

const getInvalidEmails = (value) => {
  if (!value) return [];
  if (value.startsWith('recipient_type:')) return [];
  if (RECIPIENT_SENTINELS.includes(value.trim())) return [];
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return value.split(',').map(e => e.trim()).filter(e => e && !emailRegex.test(e));
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
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
      trigger_conditions = null,
      trigger_context = null,
      context_conditions = null,
      data_mapping = null,
      priority = 5,
      description = null
    } = req.body;

    const errors = [];

    if (!id) errors.push('Trigger ID is required for update');

    const existingTrigger = await EmailTrigger.findOne({ where: { id }, transaction });
    if (!existingTrigger) {
      await transaction.rollback();
      return res.status(404).json({ success: false, message: 'Email trigger not found' });
    }

    const isSystemTrigger = type === 'system';

    const isOnlyTogglingEnabled =
      enabled !== existingTrigger.enabled &&
      recipient === existingTrigger.recipient &&
      email_template_id === existingTrigger.email_template_id &&
      type === existingTrigger.type;

    if (!isOnlyTogglingEnabled) {
      const validTypes = ['highlights', 'external', 'internal', 'system'];
      if (!validTypes.includes(type)) {
        errors.push('Type must be one of: ' + validTypes.join(', '));
      }

      if (isSystemTrigger) {
        if (recipient && recipient.trim()) {
          const invalid = getInvalidEmails(recipient);
          if (invalid.length > 0) errors.push('Invalid recipient value(s): ' + invalid.join(', '));
        }
      } else if (type !== 'external') {
        if (!recipient || !recipient.trim()) {
          errors.push('Recipient is required');
        } else {
          const invalid = getInvalidEmails(recipient);
          if (invalid.length > 0) errors.push('Invalid recipient value(s): ' + invalid.join(', '));
        }
      }

      if (!email_template_id) {
        errors.push('Email template ID is required');
      } else {
        const template = await EmailTemplate.findOne({ where: { id: email_template_id } });
        if (!template) errors.push('Email template not found');
      }

      if (isSystemTrigger) {
        if (!trigger_context) errors.push('System triggers require a trigger_context');
      } else {
        if (!Array.isArray(trigger_questions) || trigger_questions.length === 0) {
          if (!trigger_conditions?.booking_status?.length) {
            errors.push('At least one trigger question or booking status condition is required');
          }
        }

        const questionIds = [];
        for (let i = 0; i < trigger_questions.length; i++) {
          const tq = trigger_questions[i];
          if (!tq.question_id) { errors.push('Trigger question ' + (i+1) + ' is missing question_id'); continue; }
          questionIds.push(tq.question_id);

          const question = await Question.findByPk(tq.question_id);
          if (!question) { errors.push('Question with ID ' + tq.question_id + ' not found'); continue; }

          const questionType = question.question_type || question.type;

          if (['select', 'radio'].includes(questionType) && !tq.answer) {
            errors.push('Question "' + question.question + '" requires an answer');
          }
          if (['select', 'radio'].includes(questionType) && tq.answer) {
            const validValues = (question.options || []).flatMap(opt => [opt.value, opt.label].filter(v => v !== null && v !== undefined).map(v => String(v).trim()));
            if (!validValues.includes(String(tq.answer))) {
              errors.push('Invalid answer "' + tq.answer + '" for "' + question.question + '". Valid: ' + validValues.join(', '));
            }
          }
          if (['checkbox', 'service-cards', 'multi-select'].includes(questionType) && tq.answer) {
            const validValues = (question.options || []).flatMap(opt => [opt.value, opt.label].filter(v => v !== null && v !== undefined).map(v => String(v).trim()));
            const selected = tq.answer.split(',').map(v => v.trim()).filter(Boolean);
            const invalid = selected.filter(val => !validValues.includes(String(val)));
            if (invalid.length > 0) {
              errors.push('Invalid answer(s) for "' + question.question + '": ' + invalid.join(', '));
            }
          }
        }

        if (new Set(questionIds).size !== questionIds.length) {
          errors.push('Duplicate question IDs are not allowed');
        }
      }
    }

    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    const updateData = {
      recipient: recipient?.trim() || null,
      email_template_id,
      type,
      enabled,
      priority: priority || 5,
      description: description || null
    };

    if (isSystemTrigger) {
      updateData.trigger_context = trigger_context;
      updateData.context_conditions = context_conditions || null;
      updateData.data_mapping = data_mapping || null;
      updateData.trigger_conditions = null;
      updateData.trigger_questions = null;
    } else {
      updateData.trigger_conditions = trigger_conditions || null;
      updateData.trigger_questions = null;
      updateData.trigger_context = null;
      updateData.context_conditions = null;
      updateData.data_mapping = null;
    }

    await existingTrigger.update(updateData, { transaction });

    if (!isSystemTrigger && !isOnlyTogglingEnabled && trigger_questions.length > 0) {
      await EmailTriggerQuestion.destroy({ where: { email_trigger_id: id }, transaction });
      await EmailTriggerQuestion.bulkCreate(
        trigger_questions.map(tq => ({ email_trigger_id: id, question_id: tq.question_id, answer: tq.answer || null })),
        { transaction }
      );
    }

    await transaction.commit();

    const updatedTrigger = await EmailTrigger.findByPk(id, {
      include: [
        { model: EmailTemplate, as: 'template', attributes: ['id', 'name', 'subject'] },
        { model: EmailTriggerQuestion, as: 'triggerQuestions', include: [{ model: Question, as: 'question' }] }
      ]
    });

    console.log('Email trigger updated:', { id: updatedTrigger.id, type: updatedTrigger.type, recipient: updatedTrigger.recipient, enabled: updatedTrigger.enabled });

    return res.status(200).json({ success: true, message: 'Email trigger updated successfully', data: updatedTrigger });

  } catch (error) {
    await transaction.rollback();
    console.error('Error updating email trigger:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
}