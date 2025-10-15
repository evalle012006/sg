// // Helper functions for the new email trigger system

// const handlebars = require('handlebars');
// const moment = require('moment');

// /**
//  * Register common Handlebars helpers for email templates
//  */
// function registerHandlebarsHelpers() {
//   // Date formatting
//   handlebars.registerHelper('formatDate', function(date, format = 'DD/MM/YYYY') {
//     if (!date) return '';
//     return moment(date).format(format);
//   });

//   // Conditional helpers
//   handlebars.registerHelper('eq', function(a, b) {
//     return a === b;
//   });

//   handlebars.registerHelper('ne', function(a, b) {
//     return a !== b;
//   });

//   handlebars.registerHelper('or', function() {
//     return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
//   });

//   handlebars.registerHelper('and', function() {
//     return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
//   });

//   // Array/List helpers
//   handlebars.registerHelper('each', function(context, options) {
//     let ret = '';
//     if (Array.isArray(context)) {
//       for (let i = 0; i < context.length; i++) {
//         ret += options.fn(context[i]);
//       }
//     }
//     return ret;
//   });

//   handlebars.registerHelper('length', function(array) {
//     return Array.isArray(array) ? array.length : 0;
//   });

//   // String helpers
//   handlebars.registerHelper('uppercase', function(str) {
//     return str ? str.toUpperCase() : '';
//   });

//   handlebars.registerHelper('lowercase', function(str) {
//     return str ? str.toLowerCase() : '';
//   });

//   handlebars.registerHelper('capitalize', function(str) {
//     if (!str) return '';
//     return str.charAt(0).toUpperCase() + str.slice(1);
//   });

//   // Default value helper
//   handlebars.registerHelper('default', function(value, defaultValue) {
//     return value || defaultValue;
//   });
// }

// /**
//  * Prepare email data from booking information
//  */
// function prepareBookingEmailData(booking, bookingData, emailTrigger) {
//   const qaPairs = bookingData.Sections?.map(s => s.QaPairs).flat() || [];
//   const guest = bookingData.Guest;

//   const emailData = {
//     // Guest information
//     guest_name: guest ? `${guest.first_name} ${guest.last_name}` : '',
//     guest_first_name: guest?.first_name || '',
//     guest_last_name: guest?.last_name || '',
//     guest_email: guest?.email || '',
//     guest_phone: guest?.phone_number || '',
//     guest_dob: guest?.dob ? moment(guest.dob).format('DD/MM/YYYY') : '',
    
//     // Booking information
//     booking_id: booking.id,
//     booking_uuid: booking.uuid,
//     booking_status: booking.status,
//     alternate_contact_name: booking.alternate_contact_name || '',
//     alternate_contact_number: booking.alternate_contact_number || '',
    
//     // Dates
//     created_at: moment(booking.created_at).format('DD/MM/YYYY HH:mm'),
//     updated_at: moment(booking.updated_at).format('DD/MM/YYYY HH:mm'),
    
//     // URL for viewing booking
//     booking_url: `${process.env.NEXT_PUBLIC_APP_URL}/bookings/${booking.uuid}`,
    
//     // Room information
//     room: bookingData.Room ? {
//       name: bookingData.Room.name,
//       type: bookingData.Room.RoomType?.name || ''
//     } : null
//   };

//   // Extract check-in/out dates
//   const checkInOutAnswer = getCheckInOutAnswerByKeys(qaPairs);
//   if (checkInOutAnswer?.length === 2) {
//     emailData.check_in_date = moment(checkInOutAnswer[0]).format('DD/MM/YYYY');
//     emailData.check_out_date = moment(checkInOutAnswer[1]).format('DD/MM/YYYY');
//     emailData.stay_duration = moment(checkInOutAnswer[1]).diff(moment(checkInOutAnswer[0]), 'days');
//   }

//   // Extract funder information
//   emailData.funder = getFunder(bookingData.Sections);

//   // Process trigger-specific data
//   if (emailTrigger.trigger_questions) {
//     emailData.trigger_data = emailTrigger.trigger_questions.map(tq => {
//       const qa = qaPairs.find(qa => 
//         qa.question === tq.question || 
//         qa.Question?.question_key === tq.question_key
//       );
      
//       return {
//         question: tq.question,
//         answer: qa?.answer || 'Not answered',
//         matched: qa?.answer === tq.answer
//       };
//     });
//   }

//   // Add all Q&A pairs for comprehensive access
//   emailData.all_questions = qaPairs.map(qa => ({
//     question: qa.question,
//     answer: qa.answer,
//     question_key: qa.Question?.question_key
//   }));

//   return emailData;
// }

// /**
//  * Check if trigger conditions are met
//  */
// function checkTriggerConditions(emailTrigger, qaPairs) {
//   if (!emailTrigger.trigger_questions || emailTrigger.trigger_questions.length === 0) {
//     return false;
//   }

//   // All trigger questions must match (AND logic)
//   return emailTrigger.trigger_questions.every(triggerQuestion => {
//     const matchingQaPair = qaPairs.find(qa => {
//       // Try matching by question key first
//       if (triggerQuestion.question_key && qa.Question?.question_key) {
//         return qa.Question.question_key === triggerQuestion.question_key;
//       }
//       // Fallback to question text matching
//       return qa.question === triggerQuestion.question;
//     });

//     if (!matchingQaPair) {
//       return false;
//     }

//     // If no specific answer required, just check if question is answered
//     if (!triggerQuestion.answer) {
//       return matchingQaPair.answer != null && matchingQaPair.answer !== '';
//     }

//     // Check if answer matches (case-insensitive)
//     const actualAnswer = String(matchingQaPair.answer).toLowerCase().trim();
//     const expectedAnswer = String(triggerQuestion.answer).toLowerCase().trim();
    
//     return actualAnswer === expectedAnswer;
//   });
// }

// /**
//  * Get check-in/out dates from Q&A pairs
//  */
// function getCheckInOutAnswerByKeys(qaPairs) {
//   const QUESTION_KEYS = {
//     CHECK_IN_OUT_DATE: 'accommodation-dates',
//     CHECK_IN_DATE: 'check-in-date',
//     CHECK_OUT_DATE: 'check-out-date'
//   };

//   // Try combined date field first
//   const combinedDateQa = qaPairs.find(qa => 
//     qa.Question?.question_key === QUESTION_KEYS.CHECK_IN_OUT_DATE
//   );
  
//   if (combinedDateQa && combinedDateQa.answer) {
//     const dates = combinedDateQa.answer.split(' - ');
//     if (dates.length === 2) {
//       return dates;
//     }
//   }

//   // Try separate date fields
//   const checkInQa = qaPairs.find(qa => 
//     qa.Question?.question_key === QUESTION_KEYS.CHECK_IN_DATE
//   );
//   const checkOutQa = qaPairs.find(qa => 
//     qa.Question?.question_key === QUESTION_KEYS.CHECK_OUT_DATE
//   );

//   if (checkInQa?.answer && checkOutQa?.answer) {
//     return [checkInQa.answer, checkOutQa.answer];
//   }

//   return null;
// }

// /**
//  * Extract funder information from booking sections
//  */
// function getFunder(sections) {
//   if (!sections || !Array.isArray(sections)) {
//     return 'Not specified';
//   }

//   for (const section of sections) {
//     if (!section.QaPairs) continue;

//     // Look for NDIS funding
//     const ndisQuestion = section.QaPairs.find(qa => 
//       qa.Question?.question_key === 'ndis-funded' ||
//       qa.question?.toLowerCase().includes('ndis')
//     );

//     if (ndisQuestion && ndisQuestion.answer === 'Yes') {
//       return 'NDIS';
//     }

//     // Look for other funding sources
//     const fundingQuestion = section.QaPairs.find(qa =>
//       qa.Question?.question_key === 'funding-source' ||
//       qa.question?.toLowerCase().includes('funding')
//     );

//     if (fundingQuestion?.answer) {
//       return fundingQuestion.answer;
//     }
//   }

//   return 'Self-funded';
// }

// /**
//  * Validate email template before saving
//  */
// function validateEmailTemplate(template) {
//   const errors = [];

//   if (!template.name || template.name.trim().length < 3) {
//     errors.push('Template name must be at least 3 characters');
//   }

//   if (!template.subject || template.subject.trim().length === 0) {
//     errors.push('Email subject is required');
//   }

//   if (!template.html_content || template.html_content.trim().length === 0) {
//     errors.push('Email content is required');
//   }

//   // Check for potential XSS issues
//   const dangerousPatterns = [
//     /<script/i,
//     /javascript:/i,
//     /onerror=/i,
//     /onload=/i
//   ];

//   for (const pattern of dangerousPatterns) {
//     if (pattern.test(template.html_content)) {
//       errors.push('Template contains potentially dangerous content');
//       break;
//     }
//   }

//   return {
//     isValid: errors.length === 0,
//     errors
//   };
// }

// /**
//  * Generate preview data for testing templates
//  */
// function generatePreviewData() {
//   return {
//     guest_name: 'John Smith',
//     guest_first_name: 'John',
//     guest_last_name: 'Smith',
//     guest_email: 'john.smith@example.com',
//     guest_phone: '0412 345 678',
//     guest_dob: '15/06/1985',
//     booking_id: 12345,
//     booking_uuid: 'abc123-def456',
//     booking_status: 'pending',
//     check_in_date: '15/12/2024',
//     check_out_date: '20/12/2024',
//     stay_duration: 5,
//     funder: 'NDIS',
//     alternate_contact_name: 'Jane Smith',
//     alternate_contact_number: '0423 456 789',
//     booking_url: 'https://example.com/bookings/abc123-def456',
//     room: {
//       name: 'Room 101',
//       type: 'Accessible Suite'
//     },
//     trigger_data: [
//       {
//         question: 'Do you require wheelchair access?',
//         answer: 'Yes',
//         matched: true
//       }
//     ],
//     all_questions: [
//       { question: 'Do you require wheelchair access?', answer: 'Yes' },
//       { question: 'Any dietary requirements?', answer: 'Vegetarian' },
//       { question: 'Any allergies?', answer: 'None' }
//     ],
//     booking_highlights: [
//       { question: 'Mobility assistance required', answer: 'Yes' },
//       { question: 'Accessible bathroom needed', answer: 'Yes' }
//     ]
//   };
// }

// /**
//  * Log email trigger event for analytics
//  */
// async function logEmailTriggerEvent(triggerId, recipient, status, error = null) {
//   try {
//     console.log({
//       timestamp: new Date(),
//       trigger_id: triggerId,
//       recipient,
//       status,
//       error
//     });
    
//     // Optional: Save to database for analytics
//     // await EmailLog.create({ trigger_id: triggerId, recipient, status, error });
//   } catch (err) {
//     console.error('Failed to log email event:', err);
//   }
// }

// /**
//  * Updated Email Service for template rendering
//  */
// const EmailService = require('./emailService');
// const SendEmail = require('./mail');

// /**
//  * Send email using new template system or fall back to legacy
//  */
// async function sendEmailWithTrigger(emailTrigger, emailData) {
//   try {
//     registerHandlebarsHelpers();

//     if (emailTrigger.email_template_id) {
//       // Use new template system
//       await EmailService.sendWithTemplate(
//         emailTrigger.recipient,
//         emailTrigger.email_template_id,
//         emailData
//       );

//       // Update trigger stats
//       await emailTrigger.increment('trigger_count');
//       await emailTrigger.update({ last_triggered_at: new Date() });
      
//       await logEmailTriggerEvent(emailTrigger.id, emailTrigger.recipient, 'success');
//     } else {
//       // Fall back to legacy system
//       await SendEmail(
//         emailTrigger.recipient,
//         'Sargood On Collaroy - New Booking',
//         emailTrigger.email_template,
//         emailData
//       );
      
//       await logEmailTriggerEvent(emailTrigger.id, emailTrigger.recipient, 'success_legacy');
//     }
//   } catch (error) {
//     console.error('Error sending email with trigger:', error);
//     await logEmailTriggerEvent(emailTrigger.id, emailTrigger.recipient, 'error', error.message);
//     throw error;
//   }
// }

// module.exports = {
//   registerHandlebarsHelpers,
//   prepareBookingEmailData,
//   checkTriggerConditions,
//   getCheckInOutAnswerByKeys,
//   getFunder,
//   validateEmailTemplate,
//   generatePreviewData,
//   logEmailTriggerEvent
// };