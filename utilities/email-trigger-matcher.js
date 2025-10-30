/**
 * Email Trigger Matching Utility
 * 
 * This utility handles the logic for checking if a booking request
 * matches the conditions defined in email triggers
 */

import { EmailTrigger, EmailTemplate } from '../../../models';

/**
 * Check all active triggers and send emails if conditions match
 * 
 * @param {Object} booking - The booking object with sections and QaPairs
 * @returns {Promise<Object>} - Result with sent emails count and details
 */
export async function checkAndSendEmailTriggers(booking) {
  try {
    // Get all active email triggers
    const triggers = await EmailTrigger.findAll({
      where: { enabled: true },
      include: [
        {
          model: EmailTemplate,
          as: 'template'
        }
      ],
      order: [['createdAt', 'ASC']]
    });

    console.log(`Found ${triggers.length} active email triggers to check`);

    const sentEmails = [];
    const failedEmails = [];

    // Check each trigger
    for (const trigger of triggers) {
      try {
        // Convert booking QaPairs to a flat answers object
        const bookingAnswers = extractAnswersFromBooking(booking);

        // Check if this trigger's conditions are met
        const shouldTrigger = checkTriggerConditions(
          trigger.trigger_questions, 
          bookingAnswers
        );

        if (shouldTrigger) {
          // Send the email
          await sendTriggerEmail(trigger, booking);

          // Update trigger statistics
          await trigger.update({
            trigger_count: (trigger.trigger_count || 0) + 1,
            last_triggered_at: new Date()
          });

          sentEmails.push({
            trigger_id: trigger.id,
            recipient: trigger.recipient,
            template_id: trigger.email_template_id,
            template_name: trigger.template?.name
          });

          console.log(`✓ Email trigger fired: ${trigger.id} -> ${trigger.recipient}`);
        } else {
          console.log(`✗ Trigger ${trigger.id} conditions not met`);
        }
      } catch (error) {
        console.error(`Error processing trigger ${trigger.id}:`, error);
        failedEmails.push({
          trigger_id: trigger.id,
          error: error.message
        });
      }
    }

    return {
      success: true,
      sent_count: sentEmails.length,
      sent_emails: sentEmails,
      failed_count: failedEmails.length,
      failed_emails: failedEmails
    };

  } catch (error) {
    console.error('Error checking email triggers:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Extract answers from booking sections into a flat object
 * 
 * @param {Object} booking - Booking with Sections containing QaPairs
 * @returns {Object} - Flat object with question_key: answer pairs
 */
function extractAnswersFromBooking(booking) {
  const answers = {};

  if (!booking.Sections || !Array.isArray(booking.Sections)) {
    return answers;
  }

  booking.Sections.forEach(section => {
    if (section.QaPairs && Array.isArray(section.QaPairs)) {
      section.QaPairs.forEach(qaPair => {
        // Use question_key from the Question model if available
        const questionKey = qaPair.Question?.question_key || qaPair.question_key;
        
        if (questionKey) {
          // Parse answer if it's a string but looks like JSON
          let answer = qaPair.answer;
          if (typeof answer === 'string') {
            try {
              // Try to parse as JSON (for checkbox arrays)
              answer = JSON.parse(answer);
            } catch (e) {
              // Keep as string if not valid JSON
              answer = qaPair.answer;
            }
          }
          
          answers[questionKey] = answer;
        }
      });
    }
  });

  return answers;
}

/**
 * Check if all trigger conditions are met
 * 
 * @param {Array} triggerQuestions - Array of trigger question conditions
 * @param {Object} bookingAnswers - User's answers from booking request
 * @returns {boolean} - True if all conditions match, false otherwise
 */
function checkTriggerConditions(triggerQuestions, bookingAnswers) {
  if (!Array.isArray(triggerQuestions) || triggerQuestions.length === 0) {
    return false;
  }

  // All conditions must be true (AND logic)
  for (const triggerQuestion of triggerQuestions) {
    const userAnswer = bookingAnswers[triggerQuestion.question_key];
    
    // If user didn't answer this question, condition not met
    if (userAnswer === undefined || userAnswer === null) {
      console.log(`  ✗ Question "${triggerQuestion.question_key}" not answered`);
      return false;
    }

    // Check condition based on question type
    const conditionMet = checkSingleCondition(
      triggerQuestion, 
      userAnswer
    );

    if (!conditionMet) {
      console.log(`  ✗ Condition not met for "${triggerQuestion.question_key}"`);
      return false;
    }
  }

  // All conditions passed
  console.log(`  ✓ All conditions met`);
  return true;
}

/**
 * Check if a single question condition is met
 * 
 * @param {Object} triggerQuestion - The trigger question condition
 * @param {*} userAnswer - The user's answer to this question
 * @returns {boolean} - True if condition is met, false otherwise
 */
function checkSingleCondition(triggerQuestion, userAnswer) {
  const { question_type, answer: triggerAnswer, multiple_answers } = triggerQuestion;

  switch (question_type) {
    case 'checkbox':
    case 'multi-select':
      return checkCheckboxCondition(triggerAnswer, multiple_answers, userAnswer);
      
    case 'select':
    case 'dropdown':
    case 'radio':
      return checkExactMatchCondition(triggerAnswer, userAnswer);
      
    case 'text':
    case 'textarea':
    case 'email':
    case 'number':
    case 'tel':
    case 'url':
    default:
      return checkTextCondition(triggerAnswer, userAnswer);
  }
}

/**
 * Check checkbox condition (multiple selection)
 * Condition is met if ANY of the trigger's selected values match the user's selection
 */
function checkCheckboxCondition(triggerAnswer, multiple_answers, userAnswer) {
  // Get trigger answers as array
  let triggerAnswers = multiple_answers || [];
  if (!triggerAnswers.length && triggerAnswer) {
    triggerAnswers = typeof triggerAnswer === 'string' 
      ? triggerAnswer.split(',').map(a => a.trim())
      : [triggerAnswer];
  }

  // Get user answers as array
  let userAnswers = [];
  if (Array.isArray(userAnswer)) {
    userAnswers = userAnswer;
  } else if (typeof userAnswer === 'string') {
    userAnswers = userAnswer.split(',').map(a => a.trim());
  } else {
    userAnswers = [String(userAnswer)];
  }

  // Check if ANY trigger answer is in user's answers
  return triggerAnswers.some(triggerAns => 
    userAnswers.some(userAns => 
      String(userAns).toLowerCase().trim() === String(triggerAns).toLowerCase().trim()
    )
  );
}

/**
 * Check exact match condition (select, radio)
 */
function checkExactMatchCondition(triggerAnswer, userAnswer) {
  // Convert both to strings for comparison
  const triggerStr = String(triggerAnswer).trim().toLowerCase();
  const userStr = String(userAnswer).trim().toLowerCase();
  
  return triggerStr === userStr;
}

/**
 * Check text-based condition
 * If trigger answer is empty, any answer matches (trigger on any response)
 * Otherwise, exact match required
 */
function checkTextCondition(triggerAnswer, userAnswer) {
  // If trigger answer is empty, any answer triggers
  if (!triggerAnswer || triggerAnswer.trim() === '') {
    return true;
  }

  // Otherwise, exact match required (case-insensitive)
  const triggerStr = String(triggerAnswer).trim().toLowerCase();
  const userStr = String(userAnswer).trim().toLowerCase();
  
  return triggerStr === userStr;
}

/**
 * Send trigger email
 * This is a placeholder - implement your actual email sending logic
 */
async function sendTriggerEmail(trigger, booking) {
  // TODO: Implement actual email sending
  // This should use your email service (SendGrid, AWS SES, etc.)
  
  console.log('Sending email:', {
    to: trigger.recipient,
    template: trigger.template?.name,
    booking_id: booking.id
  });

  // Example implementation:
  // const emailService = require('./email-service');
  // await emailService.send({
  //   to: trigger.recipient,
  //   template: trigger.template,
  //   data: {
  //     booking: booking,
  //     // Add any other data your template needs
  //   }
  // });
}

/**
 * Test function to verify trigger matching logic
 */
export function testTriggerMatching() {
  console.log('=== Testing Email Trigger Matching ===\n');

  // Test Case 1: Select question - exact match
  const trigger1 = {
    question_key: 'guest_count',
    question_type: 'select',
    answer: '26-50'
  };
  const answers1 = { guest_count: '26-50' };
  console.log('Test 1 (Select - Match):', checkSingleCondition(trigger1, answers1.guest_count));

  // Test Case 2: Checkbox - any match
  const trigger2 = {
    question_key: 'amenities',
    question_type: 'checkbox',
    answer: 'projector,whiteboard',
    multiple_answers: ['projector', 'whiteboard']
  };
  const answers2 = { amenities: ['projector', 'sound_system'] };
  console.log('Test 2 (Checkbox - Match):', checkSingleCondition(trigger2, answers2.amenities));

  // Test Case 3: Text - empty trigger answer (any answer)
  const trigger3 = {
    question_key: 'special_requests',
    question_type: 'text',
    answer: ''
  };
  const answers3 = { special_requests: 'Anything here' };
  console.log('Test 3 (Text - Any Answer):', checkSingleCondition(trigger3, answers3.special_requests));

  console.log('\n=== Test Complete ===');
}

export {
  checkTriggerConditions,
  checkSingleCondition,
  extractAnswersFromBooking
};