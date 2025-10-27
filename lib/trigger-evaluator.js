/**
 * Email Trigger Evaluation Utility
 * 
 * Helper functions to check if a form submission matches email trigger conditions
 */

import { EmailTrigger, EmailTriggerQuestion, Question } from '../models';

/**
 * Check if a form submission matches any email triggers
 * 
 * @param {Object} formData - The submitted form data { question_key: answer }
 * @param {string} triggerType - The trigger type to check ('highlights', 'external', 'internal')
 * @returns {Promise<Array>} Array of matching triggers with their details
 */
export async function findMatchingTriggers(formData, triggerType = 'highlights') {
  try {
    // Get all enabled triggers of the specified type
    const triggers = await EmailTrigger.findAll({
      where: { 
        enabled: true,
        type: triggerType
      },
      include: [
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

    const matchingTriggers = [];

    // Check each trigger
    for (const trigger of triggers) {
      if (evaluateTrigger(trigger, formData)) {
        matchingTriggers.push(trigger);
      }
    }

    return matchingTriggers;

  } catch (error) {
    console.error('Error finding matching triggers:', error);
    throw error;
  }
}

/**
 * Evaluate if a single trigger matches the form data
 * 
 * @param {Object} trigger - The email trigger with triggerQuestions included
 * @param {Object} formData - The submitted form data
 * @returns {boolean} True if all trigger conditions are met
 */
export function evaluateTrigger(trigger, formData) {
  const triggerQuestions = trigger.triggerQuestions || [];

  // All trigger questions must match for the trigger to fire
  for (const tq of triggerQuestions) {
    const question = tq.question;
    const requiredAnswer = tq.answer;
    const questionKey = question.question_key;
    const submittedAnswer = formData[questionKey];

    // Check if the submitted answer matches the required answer
    if (!matchesAnswer(submittedAnswer, requiredAnswer, question.question_type)) {
      return false;
    }
  }

  return true;
}

/**
 * Check if a submitted answer matches the required answer
 * 
 * @param {*} submittedAnswer - The answer from the form submission
 * @param {*} requiredAnswer - The answer required by the trigger
 * @param {string} questionType - The type of question
 * @returns {boolean} True if answers match
 */
function matchesAnswer(submittedAnswer, requiredAnswer, questionType) {
  // Handle null/undefined
  if (submittedAnswer === null || submittedAnswer === undefined) {
    return false;
  }

  // For checkbox questions (which may have multiple values)
  if (questionType === 'checkbox') {
    const submittedArray = Array.isArray(submittedAnswer) ? submittedAnswer : [submittedAnswer];
    const requiredArray = Array.isArray(requiredAnswer) ? requiredAnswer : [requiredAnswer];
    
    // Check if all required values are present in submitted values
    return requiredArray.every(req => submittedArray.includes(req));
  }

  // For all other question types, do a string comparison
  const normalizedSubmitted = String(submittedAnswer).trim().toLowerCase();
  const normalizedRequired = String(requiredAnswer).trim().toLowerCase();

  return normalizedSubmitted === normalizedRequired;
}

/**
 * Trigger emails for matching triggers
 * 
 * @param {Object} formData - The submitted form data
 * @param {string} triggerType - The trigger type
 * @param {Function} emailSender - Function to send emails (receives trigger object)
 * @returns {Promise<Array>} Array of triggered email results
 */
export async function triggerMatchingEmails(formData, triggerType, emailSender) {
  try {
    const matchingTriggers = await findMatchingTriggers(formData, triggerType);
    
    const results = [];

    for (const trigger of matchingTriggers) {
      try {
        // Send the email
        await emailSender(trigger, formData);

        // Update trigger statistics
        await trigger.update({
          trigger_count: trigger.trigger_count + 1,
          last_triggered_at: new Date()
        });

        results.push({
          success: true,
          trigger_id: trigger.id,
          recipient: trigger.recipient
        });

        console.log(`Email trigger ${trigger.id} fired successfully to ${trigger.recipient}`);

      } catch (error) {
        console.error(`Failed to trigger email ${trigger.id}:`, error);
        results.push({
          success: false,
          trigger_id: trigger.id,
          recipient: trigger.recipient,
          error: error.message
        });
      }
    }

    return results;

  } catch (error) {
    console.error('Error triggering matching emails:', error);
    throw error;
  }
}

/**
 * Get all questions used by a specific trigger type
 * Useful for forms to know which questions might trigger emails
 * 
 * @param {string} triggerType - The trigger type
 * @returns {Promise<Array>} Array of unique questions
 */
export async function getQuestionsUsedInTriggers(triggerType = 'highlights') {
  try {
    const triggers = await EmailTrigger.findAll({
      where: { 
        enabled: true,
        type: triggerType
      },
      include: [
        {
          model: Question,
          as: 'questions',
          through: { attributes: [] } // Don't include junction table data
        }
      ]
    });

    // Collect unique questions
    const questionMap = new Map();
    
    triggers.forEach(trigger => {
      trigger.questions.forEach(question => {
        if (!questionMap.has(question.id)) {
          questionMap.set(question.id, question);
        }
      });
    });

    return Array.from(questionMap.values());

  } catch (error) {
    console.error('Error getting questions used in triggers:', error);
    throw error;
  }
}

// Example usage in a form submission handler:
/*
import { triggerMatchingEmails } from './utils/trigger-evaluator';
import { sendTriggerEmail } from './utils/email-sender';

export async function handleFormSubmission(req, res) {
  const formData = req.body;
  
  // Save form data to database...
  
  // Check and trigger matching emails
  const emailResults = await triggerMatchingEmails(
    formData,
    'highlights',
    async (trigger, formData) => {
      await sendTriggerEmail(trigger, formData);
    }
  );
  
  console.log(`Triggered ${emailResults.length} emails`);
  
  return res.json({ success: true, emails_sent: emailResults.length });
}
*/