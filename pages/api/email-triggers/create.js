import { EmailTrigger, EmailTemplate, Question, EmailTriggerQuestion } from '../../../models';
import { sequelize } from '../../../models';

// ─── Sentinel values that are valid recipients but not email addresses ─────────
// 'guest_email'  → resolved at send time to booking.Guest.email
// 'user_email'   → resolved at send time to context.user_email (user_account_created)
const RECIPIENT_SENTINELS = ['guest_email', 'user_email'];

const isValidRecipientValue = (value) => {
  if (!value || !value.trim()) return false;
  if (value.startsWith('recipient_type:')) return true;
  if (RECIPIENT_SENTINELS.includes(value.trim())) return true;
  // Otherwise must be a valid email or comma-separated emails
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return value.split(',').map(e => e.trim()).every(e => emailRegex.test(e));
};

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
    const isSystemTrigger = type === 'system';

    // ── Type validation ────────────────────────────────────────────────────
    const validTypes = ['highlights', 'external', 'internal', 'system'];
    if (!validTypes.includes(type)) {
      errors.push(`Type must be one of: ${validTypes.join(', ')}`);
    }

    // ── Recipient validation ───────────────────────────────────────────────
    if (isSystemTrigger) {
      // System triggers: null/'' = no recipient (trigger will skip at runtime, which is valid to save)
      // 'guest_email', 'user_email', 'recipient_type:*', or literal email(s) are all valid
      if (recipient && recipient.trim()) {
        const invalidEmails = getInvalidEmails(recipient);
        if (invalidEmails.length > 0) {
          errors.push(`Invalid recipient value(s): ${invalidEmails.join(', ')}`);
        }
      }
    } else if (type !== 'external') {
      // Internal/highlights: recipient required
      if (!recipient || !recipient.trim()) {
        errors.push('Recipient is required');
      } else {
        const invalidEmails = getInvalidEmails(recipient);
        if (invalidEmails.length > 0) {
          errors.push(`Invalid recipient value(s): ${invalidEmails.join(', ')}`);
        }
      }
    }
    // External triggers: recipient is the guest by default, no validation needed

    // ── Email template validation ──────────────────────────────────────────
    if (!email_template_id) {
      errors.push('Email template ID is required');
    } else {
      const template = await EmailTemplate.findOne({ where: { id: email_template_id }, transaction });
      if (!template) errors.push('Email template not found');
    }

    // ── Trigger configuration validation ──────────────────────────────────
    if (isSystemTrigger) {
      if (!trigger_context) {
        errors.push('System triggers require a trigger_context');
      }
    } else {
      if (!Array.isArray(trigger_questions) || trigger_questions.length === 0) {
        if (!trigger_conditions?.booking_status?.length) {
          errors.push('At least one trigger question or booking status condition is required');
        }
      }

      const questionIds = [];
      for (let i = 0; i < trigger_questions.length; i++) {
        const tq = trigger_questions[i];

        if (!tq.question_id) {
          errors.push(`Trigger question ${i + 1} is missing question_id`);
          continue;
        }

        questionIds.push(tq.question_id);

        const question = await Question.findByPk(tq.question_id, { transaction });
        if (!question) {
          errors.push(`Question with ID ${tq.question_id} not found`);
          continue;
        }

        const questionType = question.question_type || question.type;

        if (['select', 'radio'].includes(questionType) && !tq.answer) {
          errors.push(`Question "${question.question}" (ID: ${tq.question_id}) requires an answer`);
        }

        if (['select', 'radio'].includes(questionType) && tq.answer) {
          const validValues = (question.options || []).flatMap(opt => [opt.value, opt.label].filter(v => v !== null && v !== undefined).map(v => String(v).trim()));
          if (!validValues.includes(String(tq.answer))) {
            errors.push(`Invalid answer "${tq.answer}" for question "${question.question}". Valid: ${validValues.join(', ')}`);
          }
        }

        if (['checkbox', 'service-cards', 'multi-select'].includes(questionType) && tq.answer) {
          const validValues = (question.options || []).flatMap(opt => [opt.value, opt.label].filter(v => v !== null && v !== undefined).map(v => String(v).trim()));
          const selectedValues = tq.answer.split(',').map(v => v.trim()).filter(Boolean);
          const invalidValues = selectedValues.filter(val => !validValues.includes(String(val)));
          if (invalidValues.length > 0) {
            errors.push(`Invalid answer(s) for "${question.question}": ${invalidValues.join(', ')}. Valid: ${validValues.join(', ')}`);
          }
        }
      }

      const uniqueIds = new Set(questionIds);
      if (uniqueIds.size !== questionIds.length) {
        errors.push('Duplicate question IDs are not allowed');
      }
    }

    if (errors.length > 0) {
      await transaction.rollback();
      return res.status(400).json({ success: false, message: 'Validation failed', errors });
    }

    // ── Build trigger data ─────────────────────────────────────────────────
    const triggerData = {
      recipient: recipient?.trim() || null,
      email_template_id,
      type,
      enabled,
      priority: priority || 5,
      description: description || null
    };

    if (isSystemTrigger) {
      triggerData.trigger_context = trigger_context;
      triggerData.context_conditions = context_conditions || null;
      triggerData.data_mapping = data_mapping || null;
      triggerData.trigger_conditions = null;
      triggerData.trigger_questions = null;
    } else {
      triggerData.trigger_conditions = trigger_conditions || null;
      triggerData.trigger_questions = null;
      triggerData.trigger_context = null;
      triggerData.context_conditions = null;
      triggerData.data_mapping = null;
    }

    const emailTrigger = await EmailTrigger.create(triggerData, { transaction });

    if (!isSystemTrigger && trigger_questions.length > 0) {
      await EmailTriggerQuestion.bulkCreate(
        trigger_questions.map(tq => ({
          email_trigger_id: emailTrigger.id,
          question_id: tq.question_id,
          answer: tq.answer || null
        })),
        { transaction }
      );
    }

    await transaction.commit();

    const createdTrigger = await EmailTrigger.findByPk(emailTrigger.id, {
      include: [
        { model: EmailTemplate, as: 'template', attributes: ['id', 'name', 'subject'] },
        { model: EmailTriggerQuestion, as: 'triggerQuestions', include: [{ model: Question, as: 'question' }] }
      ]
    });

    console.log('Email trigger created:', {
      id: createdTrigger.id,
      type: createdTrigger.type,
      recipient: createdTrigger.recipient,
      trigger_context: createdTrigger.trigger_context,
      questions_count: trigger_questions.length
    });

    return res.status(201).json({
      success: true,
      message: 'Email trigger created successfully',
      data: createdTrigger
    });

  } catch (error) {
    await transaction.rollback();
    console.error('Error creating email trigger:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
}