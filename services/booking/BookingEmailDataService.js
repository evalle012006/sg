/**
 * BookingEmailDataService - OPTIMIZED VERSION WITH FALLBACK
 * 
 * ✨ PERFORMANCE OPTIMIZATION + BACKWARD COMPATIBILITY:
 * - Methods accept either booking ID or pre-fetched booking object
 * - Fallback from question_id to question text matching (old system compatibility)
 * - Extensive logging for debugging
 */

import { Booking, Setting, Template, Page, Section, Question, Room, RoomType, Guest, EmailTrigger, QaPair, Package } from "../../models";
import { dispatchHttpTaskHandler } from "../queues/dispatchHttpTask";
import EmailService from "./emailService";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey, mapQuestionTextToKey } from "./question-helper";
import moment from "moment";
import { EmailTemplateMappingService } from "./EmailTemplateService";
const fs = require('fs').promises;
const path = require('path');

class BookingEmailDataService {
  
  /**
   * ✨ NEW: Find QaPair with fallback from question_id to question text matching
   */
  findQaPairWithFallback(qaPairs, triggerQuestion) {
    console.log('\n🔍 Finding QaPair with fallback...');
    
    const question = triggerQuestion.question;
    const questionId = question?.id || triggerQuestion.question_id;
    const questionText = question?.question || triggerQuestion.question_text;
    const questionKey = question?.question_key;
    
    console.log('   Searching for:', {
      questionId,
      questionKey,
      questionText: questionText?.substring(0, 50) + '...'
    });
    
    let qaPair = null;
    
    // STEP 1: Try to find by question_id (new system)
    if (questionId) {
      console.log('   📌 Step 1: Trying question_id match...');
      qaPair = qaPairs.find(qa => qa.question_id === questionId);
      
      if (qaPair) {
        console.log('   ✅ Found by question_id:', questionId);
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      } else {
        console.log('   ⚠️ No match by question_id:', questionId);
      }
    }
    
    // STEP 2: Try to find by question_key (if available)
    if (questionKey) {
      console.log('   📌 Step 2: Trying question_key match...');
      qaPair = findByQuestionKey(qaPairs, questionKey);
      
      if (qaPair) {
        console.log('   ✅ Fallback: Found by question_key:', questionKey);
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      } else {
        console.log('   ⚠️ No match by question_key:', questionKey);
      }
    }
    
    // STEP 3: Fallback to question text matching (old system)
    if (questionText) {
      console.log('   📌 Step 3: Trying exact question text match...');
      
      // Try exact match on qa.question
      qaPair = qaPairs.find(qa => qa.question === questionText);
      
      if (qaPair) {
        console.log('   ✅ Fallback: Found by exact question text');
        console.log('      Question:', questionText.substring(0, 50) + '...');
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      }
      
      // Try exact match on qa.Question?.question (nested)
      qaPair = qaPairs.find(qa => qa.Question?.question === questionText);
      
      if (qaPair) {
        console.log('   ✅ Fallback: Found by nested Question.question text');
        console.log('      Question:', questionText.substring(0, 50) + '...');
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      }
      
      console.log('   📌 Step 4: Trying case-insensitive question text match...');
      
      // Try case-insensitive match
      const questionTextLower = questionText.toLowerCase().trim();
      qaPair = qaPairs.find(qa => 
        qa.question?.toLowerCase().trim() === questionTextLower ||
        qa.Question?.question?.toLowerCase().trim() === questionTextLower
      );
      
      if (qaPair) {
        console.log('   ✅ Fallback: Found by case-insensitive question text');
        console.log('      Question:', questionText.substring(0, 50) + '...');
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      } else {
        console.log('   ⚠️ No match by case-insensitive text');
      }
      
      // STEP 5: Try partial match (contains)
      console.log('   📌 Step 5: Trying partial question text match...');
      qaPair = qaPairs.find(qa => {
        const qaQuestion = qa.question || qa.Question?.question || '';
        return qaQuestion.toLowerCase().includes(questionTextLower) ||
               questionTextLower.includes(qaQuestion.toLowerCase());
      });
      
      if (qaPair) {
        console.log('   ✅ Fallback: Found by partial question text match');
        console.log('      Matched question:', (qaPair.question || qaPair.Question?.question)?.substring(0, 50) + '...');
        console.log('      Answer:', qaPair.answer?.substring(0, 100));
        return qaPair;
      } else {
        console.log('   ⚠️ No match by partial text');
      }
    }
    
    console.log('   ❌ No QaPair found after all fallback attempts');
    console.log('   Available QaPairs:', qaPairs.length);
    
    return null;
  }

  /**
   * ✨ OPTIMIZED: Main method now accepts booking object OR booking ID
   */
  async prepareEmailData(bookingOrId, additionalData = {}, options = {}) {
    try {
      console.log('\n📊 Preparing email data...');
      
      const {
        includeRawAnswers = false,
        includeSectionSpecific = true,
        formatDates = 'DD/MM/YYYY',
        includeMetadata = true
      } = options;

      // ✨ Check if we received a booking object or need to fetch it
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);
      
      if (!bookingData) {
        console.error(`❌ Booking not found: ${bookingOrId}`);
        return null;
      }

      console.log(`✅ Processing booking ${bookingData.uuid || bookingData.id}`);

      const emailData = {};

      if (includeMetadata) {
        this.addSystemMetadata(emailData, bookingData);
      }

      this.addGuestData(emailData, bookingData);
      this.addBookingDetails(emailData, bookingData, formatDates);
      this.addRoomData(emailData, bookingData);
      this.addPropertyData(emailData);
      
      const qaPairs = bookingData.Sections
        ?.map(section => section.QaPairs || [])
        .flat()
        .filter(qa => qa != null) || [];
      
      await this.addQuestionAnswers(emailData, bookingData, includeSectionSpecific);
      await this.enrichPackageData(emailData, qaPairs);
      this.addCalculatedFields(emailData, bookingData, formatDates);
      
      // ✅ Parse health info for email templates
      const healthData = this.parseHealthInfoForEmail(qaPairs);
      if (healthData.healthInfo) {
        emailData.healthInfo = healthData.healthInfo;
      }
      if (healthData.affirmed_questions) {
        emailData.affirmed_questions = healthData.affirmed_questions;
      }
      
      // ✅ Parse foundation stay data
      const foundationData = this.parseFoundationStayData(qaPairs, emailData);
      Object.assign(emailData, foundationData);
      
      // ✅ NEW: Parse coordinator/funder information
      const coordinatorData = this.parseCoordinatorInfo(qaPairs, emailData);
      Object.assign(emailData, coordinatorData);
      
      // ✅ NEW: Parse booking highlights if trigger questions provided
      if (additionalData.triggerQuestions) {
        const highlights = this.parseBookingHighlights(qaPairs, additionalData.triggerQuestions);
        if (highlights) {
          emailData.booking_highlights = highlights;
        }
      }
      
      // ✅ NEW: Parse specific question answer if provided
      if (additionalData.questionKey || additionalData.questionText) {
        const specificAnswer = this.parseSpecificQuestionAnswer(
          qaPairs, 
          additionalData.questionKey,
          additionalData.questionText
        );
        Object.assign(emailData, specificAnswer);
      }

      Object.assign(emailData, additionalData);

      if (includeRawAnswers) {
        emailData._raw_qa_pairs = qaPairs;
      }

      console.log(`✅ Email data prepared with ${Object.keys(emailData).length} fields`);

      return emailData;

    } catch (error) {
      console.error('❌ Error preparing email data:', error);
      throw error;
    }
  }

  /**
   * ✨ OPTIMIZED: Now accepts booking object OR booking ID
   */
  async evaluateTrigger(bookingOrId, trigger) {
    try {
      console.log('\n🎯 Evaluating email trigger...');
      console.log(`   Trigger ID: ${trigger.id}`);
      console.log(`   Trigger Type: ${trigger.type}`);
      
      const triggerQuestions = trigger.triggerQuestions || [];
      console.log(`   Trigger Questions: ${triggerQuestions.length}`);

      if (triggerQuestions.length === 0) {
        console.log('   ⚠️ No trigger conditions specified - auto-pass');
        return {
          shouldSend: true,
          reason: 'No trigger conditions specified',
          matchedAnswers: {},
          evaluationDetails: []
        };
      }

      // ✨ OPTIMIZED: Use existing booking data if provided
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);

      if (!bookingData) {
        console.log('   ❌ Booking not found');
        return {
          shouldSend: false,
          reason: 'Booking not found',
          matchedAnswers: {},
          evaluationDetails: []
        };
      }

      const qaPairs = bookingData.Sections
        ?.map(section => section.QaPairs || [])
        .flat()
        .filter(qa => qa != null && qa.answer) || [];

      console.log(`   📊 Booking has ${qaPairs.length} answered questions`);

      const evaluationResults = [];
      const matchedAnswers = {};

      for (let i = 0; i < triggerQuestions.length; i++) {
        const triggerQuestion = triggerQuestions[i];
        console.log(`\n   📝 Evaluating trigger question ${i + 1}/${triggerQuestions.length}`);
        
        const result = this.evaluateTriggerQuestion(
          triggerQuestion,
          qaPairs
        );
        
        evaluationResults.push(result);
        
        if (result.matched) {
          matchedAnswers[result.questionKey || result.questionText] = result.actualAnswer;
          console.log(`   ✅ Condition ${i + 1} matched`);
        } else {
          console.log(`   ❌ Condition ${i + 1} NOT matched: ${result.reason}`);
        }
      }

      const allMatched = evaluationResults.every(r => r.matched);
      
      const nonMatchReasons = evaluationResults
        .filter(r => !r.matched)
        .map(r => r.reason);

      console.log(`\n   📊 Final evaluation: ${allMatched ? '✅ PASS' : '❌ FAIL'}`);
      if (!allMatched) {
        console.log(`   Reasons: ${nonMatchReasons.join('; ')}`);
      }

      return {
        shouldSend: allMatched,
        reason: allMatched 
          ? 'All trigger conditions matched' 
          : `Conditions not met: ${nonMatchReasons.join('; ')}`,
        matchedAnswers,
        evaluationDetails: evaluationResults
      };

    } catch (error) {
      console.error('❌ Error evaluating trigger:', error);
      return {
        shouldSend: false,
        reason: `Error: ${error.message}`,
        matchedAnswers: {},
        evaluationDetails: []
      };
    }
  }

  /**
   * ✨ UPDATED: Evaluate a single trigger question WITH FALLBACK
   */
  evaluateTriggerQuestion(triggerQuestion, qaPairs) {
    console.log('\n   🔎 Evaluating trigger question...');
    
    const question = triggerQuestion.question;
    const expectedAnswer = triggerQuestion.answer;
    
    if (!question) {
      console.log('   ❌ Question data missing from trigger');
      return {
        matched: false,
        reason: 'Question data missing from trigger',
        questionText: 'Unknown',
        questionKey: null,
        expectedAnswer,
        actualAnswer: null
      };
    }

    const triggerQuestionText = question.question;
    const triggerQuestionKey = question.question_key;
    const triggerQuestionId = question.id;
    
    console.log('   📋 Trigger question details:');
    console.log(`      ID: ${triggerQuestionId || 'N/A'}`);
    console.log(`      Key: ${triggerQuestionKey || 'N/A'}`);
    console.log(`      Text: "${triggerQuestionText?.substring(0, 60)}..."`);
    console.log(`      Expected Answer: "${expectedAnswer || 'any'}"`);
    
    // ✨ USE FALLBACK METHOD
    const relevantQaPair = this.findQaPairWithFallback(qaPairs, triggerQuestion);

    if (!relevantQaPair) {
      console.log('   ❌ Question not found in booking (tried all fallback methods)');
      return {
        matched: false,
        reason: `Question "${triggerQuestionText}" not found in booking`,
        questionText: triggerQuestionText,
        questionKey: triggerQuestionKey,
        expectedAnswer,
        actualAnswer: null
      };
    }

    const actualAnswer = relevantQaPair.answer;
    console.log(`   📌 Actual Answer: "${actualAnswer?.toString().substring(0, 100)}"`);

    if (!actualAnswer) {
      console.log('   ❌ Question has no answer');
      return {
        matched: false,
        reason: `Question "${triggerQuestionText}" has no answer`,
        questionText: triggerQuestionText,
        questionKey: triggerQuestionKey,
        expectedAnswer,
        actualAnswer: null
      };
    }

    // If no specific answer is expected, just check if question is answered
    if (!expectedAnswer || expectedAnswer === '' || expectedAnswer === null) {
      console.log('   ✅ No specific answer expected - question is answered');
      return {
        matched: true,
        reason: `Question "${triggerQuestionText}" has an answer (any value accepted)`,
        questionText: triggerQuestionText,
        questionKey: triggerQuestionKey,
        expectedAnswer: 'any',
        actualAnswer
      };
    }

    // Compare answers
    const matched = this.answersMatch(actualAnswer, expectedAnswer);

    if (matched) {
      console.log('   ✅ Answer matched!');
    } else {
      console.log('   ❌ Answer did not match');
    }

    return {
      matched,
      reason: matched 
        ? `Answer matches: "${actualAnswer}" == "${expectedAnswer}"`
        : `Answer mismatch: "${actualAnswer}" != "${expectedAnswer}"`,
      questionText: triggerQuestionText,
      questionKey: triggerQuestionKey,
      expectedAnswer,
      actualAnswer
    };
  }

  /**
   * Compare answers (handles strings, arrays, booleans)
   */
  answersMatch(actualAnswer, expectedAnswer) {
    console.log('      🔍 Comparing answers...');
    
    const parseAnswer = (answer) => {
      if (Array.isArray(answer)) {
        return answer.map(a => String(a).trim().toLowerCase());
      }
      
      if (typeof answer === 'string') {
        // Try to parse JSON arrays
        if (answer.startsWith('[') && answer.endsWith(']')) {
          try {
            const parsed = JSON.parse(answer);
            if (Array.isArray(parsed)) {
              return parsed.map(a => String(a).trim().toLowerCase());
            }
          } catch (e) {
            // Not valid JSON, treat as comma-separated string
          }
        }
        
        // Handle comma-separated values
        if (answer.includes(',')) {
          return answer.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
        }
        
        return [answer.trim().toLowerCase()];
      }
      
      return [String(answer).trim().toLowerCase()];
    };

    const actualValues = parseAnswer(actualAnswer);
    const expectedValues = parseAnswer(expectedAnswer);

    console.log(`      Actual values: [${actualValues.join(', ')}]`);
    console.log(`      Expected values: [${expectedValues.join(', ')}]`);

    // Check for partial matches (contains)
    const hasAnyMatch = expectedValues.some(expected => 
      actualValues.some(actual => 
        actual === expected || 
        actual.includes(expected) || 
        expected.includes(actual)
      )
    );

    if (hasAnyMatch) {
      const matchedValues = expectedValues.filter(exp => 
        actualValues.some(act => act.includes(exp) || exp.includes(act))
      );
      console.log(`      ✓ Partial match found: ${matchedValues.join(', ')}`);
      return true;
    }

    // Check for exact match (all values match)
    const normalizedActual = actualValues.sort().join(',');
    const normalizedExpected = expectedValues.sort().join(',');
    
    if (normalizedActual === normalizedExpected) {
      console.log('      ✓ Exact match');
      return true;
    }

    console.log('      ✗ No match found');
    return false;
  }

  /**
   * ✨ OPTIMIZED: Process email trigger with booking object
   */
  async processEmailTrigger(bookingOrId, trigger, additionalData = {}) {
    try {
      console.log('\n🔄 Processing email trigger...');
      console.log(`   Trigger ID: ${trigger.id}, Type: ${trigger.type}`);
      
      // ✨ OPTIMIZED: Fetch booking data ONCE here if needed
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);

      if (!bookingData) {
        console.log('   ❌ Booking not found');
        return {
          shouldSend: false,
          evaluation: {
            shouldSend: false,
            reason: 'Booking not found'
          },
          trigger,
          emailData: null
        };
      }

      console.log(`   📋 Booking: ${bookingData.uuid}`);

      // ✨ OPTIMIZED: Pass booking object to avoid refetching
      const evaluation = await this.evaluateTrigger(bookingData, trigger);
      
      if (!evaluation.shouldSend) {
        console.log(`   ⊘ Trigger evaluation failed: ${evaluation.reason}`);
        return {
          shouldSend: false,
          evaluation,
          trigger,
          emailData: null
        };
      }

      console.log('   ✅ Trigger evaluation passed - preparing email data...');

      // ✨ OPTIMIZED: Pass booking object to avoid refetching
      const emailData = await this.prepareEmailData(bookingData, additionalData);
      
      console.log('   ✅ Email data prepared successfully');
      
      return {
        shouldSend: true,
        evaluation,
        trigger,
        emailData
      };

    } catch (error) {
      console.error('❌ Error processing email trigger:', error);
      return {
        shouldSend: false,
        evaluation: {
          shouldSend: false,
          reason: `Error: ${error.message}`
        },
        trigger,
        emailData: null,
        error: error.message
      };
    }
  }

  /**
   * ✨ OPTIMIZED: Evaluate and send with booking object
   */
  async sendWithTriggerEvaluation(bookingOrId, trigger, additionalData = {}) {
    try {
      console.log('\n📧 Send with trigger evaluation...');
      console.log(`   Trigger ID: ${trigger.id}, Type: ${trigger.type}`);
      
      // ✨ OPTIMIZED: Fetch booking data ONCE here if needed
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);

      if (!bookingData) {
        console.log('   ❌ Booking not found');
        return {
          sent: false,
          reason: 'Booking not found',
          recipient: null,
          evaluation: null
        };
      }

      // ✨ OPTIMIZED: Pass booking object to processEmailTrigger
      const result = await this.processEmailTrigger(bookingData, trigger, additionalData);

      if (!result.shouldSend) {
        console.log(`   ⊘ Will not send: ${result.evaluation.reason}`);
        return {
          sent: false,
          reason: result.evaluation.reason,
          recipient: null,
          evaluation: result.evaluation
        };
      }

      // Determine recipient
      let recipient;
      if (trigger.type === 'internal') {
        recipient = trigger.recipient;
        console.log(`   📬 Internal email to: ${recipient}`);
      } else if (trigger.type === 'external') {
        const matchedAnswerKey = Object.keys(result.evaluation.matchedAnswers)[0];
        recipient = result.evaluation.matchedAnswers[matchedAnswerKey];
        console.log(`   📬 External email to: ${recipient} (from answer)`);
      } else {
        recipient = trigger.recipient;
        console.log(`   📬 Email to: ${recipient}`);
      }

      if (!recipient) {
        console.log('   ❌ No recipient found');
        return {
          sent: false,
          reason: 'No recipient found',
          recipient: null,
          evaluation: result.evaluation
        };
      }

      const templateId = trigger.email_template_id || trigger.template?.id;
      if (!templateId) {
        console.log('   ❌ No email template configured');
        return {
          sent: false,
          reason: 'No email template configured',
          recipient: null,
          evaluation: result.evaluation
        };
      }

      console.log(`   📨 Queueing email to ${recipient} with template ${templateId}...`);

      // Queue email
      await this.queueEmail(recipient, templateId, result.emailData);

      console.log('   ✅ Email queued successfully!');

      return {
        sent: true,
        reason: 'Email queued successfully',
        recipient,
        evaluation: result.evaluation
      };

    } catch (error) {
      console.error('❌ Error in sendWithTriggerEvaluation:', error);
      return {
        sent: false,
        reason: `Error: ${error.message}`,
        recipient: null,
        error: error.message
      };
    }
  }

  /**
   * Queue email using dispatchHttpTaskHandler
   */
  async queueEmail(recipient, templateId, emailData) {
    console.log('\n📤 Queueing email task...');
    console.log(`   Recipient: ${recipient}`);
    console.log(`   Template ID: ${templateId}`);
    
    await dispatchHttpTaskHandler('booking', { 
      type: 'sendTriggerEmail',
      payload: {
        recipient,
        templateId,
        emailData
      }
    });
    
    console.log('   ✅ Email task queued\n');
  }

  /**
   * Fetch booking data with ALL sections from ALL pages
   */
  async fetchBookingData(bookingId) {
    try {
      console.log(`\n🔍 Fetching booking data for: ${bookingId}`);
      
      const whereClause = bookingId.toString().includes('-') 
        ? { uuid: bookingId }
        : { id: bookingId };

      const booking = await Booking.findOne({
        where: whereClause,
        include: [
          Guest,
          {
            model: Section,
            where: {
              model_type: 'booking'
            },
            required: false,
            include: [{
              model: QaPair,
              include: [Question]
            }]
          },
          {
            model: Room,
            include: [RoomType]
          }
        ]
      });

      if (!booking) {
        console.log('   ❌ Booking not found');
        return null;
      }

      console.log(`   ✅ Booking found: ${booking.uuid}`);
      console.log(`   📊 Initial sections loaded: ${booking.Sections?.length || 0}`);

      // Get template to load ALL sections from ALL pages
      let templateId = null;
      if (booking.Sections && booking.Sections.length > 0) {
        const firstSection = booking.Sections[0];
        if (firstSection.orig_section_id) {
          const origSection = await Section.findByPk(firstSection.orig_section_id);
          if (origSection && origSection.model_type === 'page') {
            const page = await Page.findByPk(origSection.model_id);
            if (page) {
              templateId = page.template_id;
            }
          }
        }
      }

      if (templateId) {
        console.log(`   🔍 Loading all sections from template ${templateId}...`);
        
        const template = await Template.findOne({
          where: { id: templateId },
          include: [{
            model: Page,
            include: [{
              model: Section
            }]
          }]
        });

        if (template) {
          const origSectionIds = [];
          template.Pages.forEach(page => {
            page.Sections.forEach(section => {
              origSectionIds.push(section.id);
            });
          });

          console.log(`   📋 Template has ${template.Pages.length} pages`);
          console.log(`   📋 Total template sections: ${origSectionIds.length}`);

          const allBookingSections = await Section.findAll({
            where: {
              model_type: 'booking',
              model_id: booking.id,
              orig_section_id: origSectionIds
            },
            include: [
              {
                model: QaPair,
                include: [Question]
              }
            ],
            order: [['order', 'ASC']]
          });

          booking.Sections = allBookingSections;
          
          const totalQaPairs = allBookingSections.reduce((sum, section) => 
            sum + (section.QaPairs?.length || 0), 0
          );
          
          console.log(`   ✅ Loaded ${allBookingSections.length} sections across all pages`);
          console.log(`   ✅ Total QaPairs: ${totalQaPairs}`);
        }
      } else {
        const totalQaPairs = booking.Sections?.reduce((sum, section) => 
          sum + (section.QaPairs?.length || 0), 0) || 0;
        console.log(`   ℹ️  No template found - using ${booking.Sections?.length || 0} sections`);
        console.log(`   📊 Total QaPairs: ${totalQaPairs}`);
      }

      return booking;
    } catch (error) {
      console.error('❌ Error fetching booking data:', error);
      throw error;
    }
  }

  // ... rest of the helper methods (addSystemMetadata, addGuestData, etc.) remain the same ...
  
  addSystemMetadata(emailData, bookingData) {
    emailData._booking_id = bookingData.id;
    emailData._booking_uuid = bookingData.uuid;
    emailData._generated_at = new Date().toISOString();
    emailData._booking_status = bookingData.status;
    emailData._booking_type = bookingData.type;
  }

  addGuestData(emailData, bookingData) {
    const guest = bookingData.Guest;
    
    if (guest) {
      emailData.guest_id = guest.id;
      emailData.guest_name = `${guest.first_name || ''} ${guest.last_name || ''}`.trim();
      emailData.guest_first_name = guest.first_name || '';
      emailData.guest_last_name = guest.last_name || '';
      emailData.guest_email = guest.email || '';
      emailData.guest_phone = guest.phone_number || '';
      emailData.guest_mobile = guest.phone_number || '';
      emailData.guest_address = guest.address || '';
      emailData.guest_created_at = guest.createdAt;
    }
  }

  addBookingDetails(emailData, bookingData, dateFormat) {
    emailData.booking_reference = bookingData.reference_id || bookingData.uuid || '';
    emailData.booking_uuid = bookingData.uuid || '';
    emailData.booking_id = bookingData.id;
    emailData.booking_type = bookingData.type || '';
    emailData.booking_status = bookingData.status || '';
    emailData.booking_status_name = bookingData.status_name || '';
    
    if (bookingData.createdAt) {
      emailData.booking_created_at = moment(bookingData.createdAt).format(dateFormat);
      emailData.booking_created_at_long = moment(bookingData.createdAt).format('dddd, MMMM D, YYYY');
    }
    
    if (bookingData.updatedAt) {
      emailData.booking_updated_at = moment(bookingData.updatedAt).format(dateFormat);
    }
  }

  addRoomData(emailData, bookingData) {
    if (bookingData.Rooms && bookingData.Rooms.length > 0) {
      emailData.room_count = bookingData.Rooms.length;
      emailData.rooms = bookingData.Rooms.map(room => ({
        room_number: room.room_number || '',
        room_type: room.RoomType?.name || '',
        room_type_description: room.RoomType?.description || '',
        number_of_adults: room.number_of_adults || 0,
        number_of_children: room.number_of_children || 0,
        number_of_infants: room.number_of_infants || 0
      }));

      const firstRoom = bookingData.Rooms[0];
      emailData.room_number = firstRoom.room_number || '';
      emailData.room_type = firstRoom.RoomType?.name || '';
      emailData.room_type_description = firstRoom.RoomType?.description || '';
      emailData.number_of_adults = firstRoom.number_of_adults || 0;
      emailData.number_of_children = firstRoom.number_of_children || 0;
      emailData.number_of_infants = firstRoom.number_of_infants || 0;
      
      const totalAdults = bookingData.Rooms.reduce((sum, room) => sum + (room.number_of_adults || 0), 0);
      const totalChildren = bookingData.Rooms.reduce((sum, room) => sum + (room.number_of_children || 0), 0);
      const totalInfants = bookingData.Rooms.reduce((sum, room) => sum + (room.number_of_infants || 0), 0);
      
      emailData.total_adults = totalAdults;
      emailData.total_children = totalChildren;
      emailData.total_infants = totalInfants;
      emailData.total_guests = totalAdults + totalChildren + totalInfants;
    } else {
      emailData.room_count = 0;
      emailData.number_of_adults = 0;
      emailData.number_of_children = 0;
      emailData.number_of_infants = 0;
      emailData.number_of_guests = 0;
      emailData.rooms = [];
    }
  }

  async addPropertyData(emailData) {
    try {
      const logoPath = path.join(process.env.APP_ROOT || process.cwd(), 'public', 'sargood-logo-full.svg');
      const logoBuffer = await fs.readFile(logoPath);
      const logoBase64 = logoBuffer.toString('base64');
      
      emailData.logo_base64 = `data:image/svg+xml;base64,${logoBase64}`;
      emailData.logo_url = `${process.env.APP_URL}/sargood-logo-full.svg`;
      
      emailData.property_name = 'Sargood on Collaroy';
      emailData.property_address = '1 Brissenden Avenue, Collaroy NSW 2097, Australia';
      emailData.property_phone = '02 8597 0600';
      emailData.property_email = 'info@sargoodoncollaroy.com.au';
    } catch (error) {
      console.error('⚠️ Error loading logo:', error);
      emailData.logo_url = '';
    }
  }

  async addQuestionAnswers(emailData, bookingData, includeSectionSpecific) {
    const qaPairs = bookingData.Sections
      ?.map(section => section.QaPairs)
      .flat() || [];

    if (qaPairs.length === 0) {
      return;
    }

    // ✅ This will now work because we're importing the CLASS
    const MERGE_TAG_MAP = EmailTemplateMappingService.MERGE_TAG_MAP;

    // Check if MERGE_TAG_MAP exists (defensive programming)
    if (MERGE_TAG_MAP && typeof MERGE_TAG_MAP === 'object') {
      Object.entries(MERGE_TAG_MAP).forEach(([questionKey, mergeTag]) => {
        if (questionKey === 'property_name' || questionKey === 'property_address' || 
            questionKey === 'property_phone' || questionKey === 'property_email') {
          return;
        }
        
        const answer = getAnswerByQuestionKey(qaPairs, questionKey);
        if (answer !== null && answer !== undefined) {
          emailData[mergeTag] = this.formatAnswerForEmail(answer);
        }
      });
    }

    // ✅ Process all QaPairs regardless of MERGE_TAG_MAP
    qaPairs.forEach(qaPair => {
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      const sectionId = qaPair.section_id;
      const answer = qaPair.answer;
      
      if (!questionKey) return;

      // Add answer by question_key
      if (!emailData[questionKey] && answer !== null && answer !== undefined) {
        emailData[questionKey] = this.formatAnswerForEmail(answer);
      }

      // Add section-specific keys if needed
      if (includeSectionSpecific && sectionId) {
        const sectionSpecificKey = `${questionKey}_s${sectionId}`;
        emailData[sectionSpecificKey] = this.formatAnswerForEmail(answer);
      }

      // Add sanitized question text as key
      if (qaPair.Question?.question) {
        const textKey = this.sanitizeQuestionText(qaPair.Question.question);
        if (!emailData[textKey]) {
          emailData[textKey] = this.formatAnswerForEmail(answer);
        }
      }
    });
  }

  async enrichPackageData(emailData, qaPairs) {
    const packageQaPairs = qaPairs.filter(qa => 
      qa.Question?.question_type === 'package-selection' || 
      qa.Question?.type === 'package-selection' ||
      qa.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
      qa.question_key === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL
    );

    for (const qaPair of packageQaPairs) {
      const answer = qaPair.answer;
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      
      if (answer && /^\d+$/.test(answer.toString().trim())) {
        try {
          const packageId = parseInt(answer);
          const packageData = await Package.findByPk(packageId, {
            attributes: ['id', 'name', 'package_code', 'funder', 'price', 'description']
          });
          
          if (packageData) {
            emailData[`${questionKey}`] = answer;
            emailData[`${questionKey}_name`] = packageData.name;
            emailData['package_id'] = packageData.id;
            emailData['package_name'] = packageData.name;
            emailData['package_code'] = packageData.package_code;
            emailData['package_price'] = packageData.price;
            emailData['package_funder'] = packageData.funder;
          }
        } catch (error) {
          console.error('⚠️ Error enriching package data:', error);
        }
      }
    }
  }

  addCalculatedFields(emailData, bookingData, dateFormat) {
    const qaPairs = bookingData.Sections
      ?.map(section => section.QaPairs)
      .flat() || [];

    const checkInOutAnswer = this.getCheckInOutAnswerByKeys(qaPairs);
    if (checkInOutAnswer?.length === 2) {
      const checkinMoment = moment(checkInOutAnswer[0]);
      const checkoutMoment = moment(checkInOutAnswer[1]);
      
      emailData.checkin_date = checkinMoment.format(dateFormat);
      emailData.checkout_date = checkoutMoment.format(dateFormat);
      emailData.checkin_checkout_date = `${emailData.checkin_date} - ${emailData.checkout_date}`;
      
      const nights = checkoutMoment.diff(checkinMoment, 'days');
      emailData.number_of_nights = nights;
      emailData.stay_duration = `${nights} ${nights === 1 ? 'night' : 'nights'}`;
      
      emailData.checkin_date_long = checkinMoment.format('dddd, MMMM D, YYYY');
      emailData.checkout_date_long = checkoutMoment.format('dddd, MMMM D, YYYY');
      emailData.checkin_day = checkinMoment.format('dddd');
      emailData.checkout_day = checkoutMoment.format('dddd');
    }

    if (!emailData.number_of_guests) {
      const adults = parseInt(emailData.number_of_adults || 0);
      const children = parseInt(emailData.number_of_children || 0);
      const infants = parseInt(emailData.number_of_infants || 0);
      const pets = parseInt(emailData.number_of_pets || 0);
      emailData.number_of_guests = adults + children + infants + pets;
    }

    const guestParts = [];
    if (emailData.number_of_adults > 0) {
      guestParts.push(`${emailData.number_of_adults} ${emailData.number_of_adults === 1 ? 'adult' : 'adults'}`);
    }
    if (emailData.number_of_children > 0) {
      guestParts.push(`${emailData.number_of_children} ${emailData.number_of_children === 1 ? 'child' : 'children'}`);
    }
    if (emailData.number_of_infants > 0) {
      guestParts.push(`${emailData.number_of_infants} ${emailData.number_of_infants === 1 ? 'infant' : 'infants'}`);
    }
    emailData.guest_summary = guestParts.join(', ') || 'No guests specified';

    emailData.current_date = moment().format(dateFormat);
    emailData.current_date_long = moment().format('dddd, MMMM D, YYYY');
    emailData.current_time = moment().format('h:mm A');
    emailData.current_datetime = moment().format('DD/MM/YYYY h:mm A');
  }

  getCheckInOutAnswerByKeys(qaPairs) {
    const combinedAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
    if (combinedAnswer) {
      const answerArr = combinedAnswer.split(' - ');
      if (answerArr?.length > 1) {
        return answerArr;
      }
    }
    
    const checkInAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_IN_DATE);
    const checkOutAnswer = getAnswerByQuestionKey(qaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
    
    if (checkInAnswer && checkOutAnswer) {
      return [checkInAnswer, checkOutAnswer];
    }
    
    return null;
  }

  formatAnswerForEmail(answer) {
    if (typeof answer === 'object' && answer !== null) {
      return answer;
    }
    
    if (answer === null || answer === undefined) {
      return '';
    }

    if (typeof answer === 'boolean') {
      return answer ? 'Yes' : 'No';
    }
    
    if (typeof answer === 'string') {
      if ((answer.startsWith('[') && answer.endsWith(']')) || 
          (answer.startsWith('{') && answer.endsWith('}'))) {
        try {
          const parsed = JSON.parse(answer);
          if (Array.isArray(parsed) || typeof parsed === 'object') {
            return parsed;
          }
        } catch (e) {
          // Not valid JSON, continue as string
        }
      }
      
      return answer.trim();
    }
    
    return String(answer);
  }

  /**
   * Parse health-related answers for email templates
   */
  parseHealthInfoForEmail(qaPairs) {
    const healthQuestionKeys = [
      'do-any-of-the-following-relate-to-you',
      'is-there-anything-about-your-mental-health-that-you-would-like-to-tell-us-so-we-can-better-support',
      'do-you-have-difficulty-swallowing',
      'are-you-currently-an-inpatient-at-a-hospital-or-a-rehabilitation-facility'
    ];
    
    const healthInfo = [];
    const affirmedQuestions = [];
    
    qaPairs.forEach(qaPair => {
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      const answer = qaPair.answer;
      const question = qaPair.Question?.question || qaPair.question;
      
      if (!questionKey || !answer) return;
      
      // Check if this is a health-related question
      if (healthQuestionKeys.includes(questionKey)) {
        // Parse the answer
        let answerArray = [];
        
        if (typeof answer === 'string') {
          // Try to parse JSON array
          if (answer.startsWith('[') && answer.endsWith(']')) {
            try {
              answerArray = JSON.parse(answer);
            } catch (e) {
              // If not valid JSON, treat as comma-separated
              answerArray = answer.split(',').map(a => a.trim()).filter(a => a);
            }
          } else if (answer.toLowerCase() === 'yes') {
            // For yes/no questions, add the question itself
            affirmedQuestions.push(question);
          } else if (answer.includes(',')) {
            // Comma-separated values
            answerArray = answer.split(',').map(a => a.trim()).filter(a => a);
          } else {
            // Single value
            answerArray = [answer];
          }
        } else if (Array.isArray(answer)) {
          answerArray = answer;
        }
        
        // Add to healthInfo (only if not "None of the Above" or "No")
        answerArray.forEach(item => {
          const normalized = String(item).toLowerCase().trim();
          if (normalized && 
              normalized !== 'none of the above' && 
              normalized !== 'no' &&
              normalized !== 'none') {
            healthInfo.push(String(item).trim());
          }
        });
      }
    });
    
    return {
      healthInfo: healthInfo.length > 0 ? healthInfo : null,
      affirmed_questions: affirmedQuestions.length > 0 ? affirmedQuestions : null
    };
  }

  /**
   * Parse foundation/travel grant related answers for email templates
   */
  parseFoundationStayData(qaPairs, emailData) {
    const foundationData = {};
    
    // Map date fields
    foundationData.arrivalDate = emailData.checkin_date || '';
    foundationData.departureDate = emailData.checkout_date || '';
    foundationData.nights_stay = emailData.number_of_nights || '';
    foundationData.dob = emailData.guest_dob || '';
    foundationData.package = emailData.package_name || '';
    foundationData.funder = emailData.funding_source || '';
    
    // Find specific questions
    const questionMappings = [
      {
        keys: ['why-are-you-applying-for-financial-assistance', 'please-tell-us-why-you-are-applying-for-financial-assistance'],
        targetField: 'applying_assistance'
      },
      {
        keys: ['what-goals-are-you-looking-to-achieve-by-staying-at-sargood-on-collaroy'],
        targetField: 'goals1'
      },
      {
        keys: ['why-are-you-applying-for-a-travel-grant', 'please-tell-us-why-you-are-applying-for-a-travel-grant'],
        targetField: 'why_grant'
      },
      {
        keys: ['what-goals-are-you-looking-to-achieve-at-sargood-on-collaroy', 'what-are-your-goals-for-staying-at-sargood'],
        targetField: 'goals2'
      },
      {
        keys: ['approx-how-much-funding-within-500-are-you-applying-for', 'how-much-funding-are-you-applying-for'],
        targetField: 'how_much'
      }
    ];
    
    questionMappings.forEach(mapping => {
      for (const key of mapping.keys) {
        const answer = getAnswerByQuestionKey(qaPairs, key);
        if (answer && answer !== 'null' && answer !== null) {
          foundationData[mapping.targetField] = this.formatAnswerForEmail(answer);
          break; // Stop after first match
        }
      }
    });
    
    // Set a default message
    foundationData.message = 'A guest has applied for financial assistance through the Sargood Foundation';
    
    return foundationData;
  }

  /**
 * Parse coordinator/funder contact information
 */
parseCoordinatorInfo(qaPairs, emailData) {
  const coordinatorData = {};
  
  // Find coordinator name
  const coordinatorNameKeys = [
    'icare-coordinator-name',
    'ndis-support-coordinator-name',
    'plan-management-company-name'
  ];
  
  for (const key of coordinatorNameKeys) {
    const answer = getAnswerByQuestionKey(qaPairs, key);
    if (answer && answer !== 'null' && answer !== null) {
      coordinatorData.coordinator_name = this.formatAnswerForEmail(answer);
      break;
    }
  }
  
  // Find NDIS/iCare number
  const numberKeys = [
    'ndis-number',
    'icare-number',
    'icare-claim-number'
  ];
  
  for (const key of numberKeys) {
    const answer = getAnswerByQuestionKey(qaPairs, key);
    if (answer && answer !== 'null' && answer !== null) {
      coordinatorData.icare_or_ndis_number = this.formatAnswerForEmail(answer);
      break;
    }
  }
  
  // Find reason for stay
  const reasonKeys = [
    'reason-for-stay',
    'what-goals-are-you-looking-to-achieve-by-staying-at-sargood-on-collaroy'
  ];
  
  for (const key of reasonKeys) {
    const answer = getAnswerByQuestionKey(qaPairs, key);
    if (answer && answer !== 'null' && answer !== null) {
      coordinatorData.reason_for_stay = this.formatAnswerForEmail(answer);
      break;
    }
  }
  
  // Add package_type as alias for package_name
  if (emailData.package_name) {
    coordinatorData.package_type = emailData.package_name;
  }
  
  return coordinatorData;
}

/**
 * Parse booking highlights from trigger questions
 * This is used for the highlights template to show specific Q&A pairs
 */
parseBookingHighlights(qaPairs, triggerQuestions) {
  const highlights = [];
  
  if (!triggerQuestions || triggerQuestions.length === 0) {
    return null;
  }
  
  triggerQuestions.forEach(triggerQuestion => {
    const question = triggerQuestion.question;
    
    if (!question) return;
    
    // Use fallback to find the QaPair
    const qaPair = this.findQaPairWithFallback(qaPairs, triggerQuestion);
    
    if (qaPair && qaPair.answer) {
      highlights.push({
        question: question.question || triggerQuestion.question_text || 'Question',
        answer: this.formatAnswerForEmail(qaPair.answer)
      });
    }
  });
  
  return highlights.length > 0 ? highlights : null;
}

/**
 * Parse specific question answer for internal booking notifications
 * This extracts the answered question for templates like "Guest answered Yes to X"
 */
parseSpecificQuestionAnswer(qaPairs, questionKey, questionText) {
  const result = {
    selected_yes_no_answer: null,
    question: null,
    selected_list_answer: null,
    selected_clinical_nurse_consultation_services: null
  };
  
  // Try to find by question key first, then by text
  let qaPair = null;
  
  if (questionKey) {
    qaPair = findByQuestionKey(qaPairs, questionKey);
  }
  
  if (!qaPair && questionText) {
    qaPair = qaPairs.find(qa => {
      const qaQuestion = qa.question || qa.Question?.question || '';
      return qaQuestion.toLowerCase().includes(questionText.toLowerCase()) ||
             questionText.toLowerCase().includes(qaQuestion.toLowerCase());
    });
  }
  
  if (!qaPair) {
    return result;
  }
  
  // Set the question text
  result.question = qaPair.Question?.question || qaPair.question || questionText || '';
  
  const answer = qaPair.answer;
  const questionType = qaPair.Question?.question_type || qaPair.Question?.type;
  
  // Parse answer based on type
  if (questionType === 'radio' || questionType === 'yes-no') {
    result.selected_yes_no_answer = this.formatAnswerForEmail(answer);
  } else if (questionType === 'checkbox' || Array.isArray(answer)) {
    // Parse array answer
    let answerArray = [];
    
    if (typeof answer === 'string') {
      if (answer.startsWith('[') && answer.endsWith(']')) {
        try {
          answerArray = JSON.parse(answer);
        } catch (e) {
          answerArray = answer.split(',').map(a => a.trim()).filter(a => a);
        }
      } else if (answer.includes(',')) {
        answerArray = answer.split(',').map(a => a.trim()).filter(a => a);
      } else {
        answerArray = [answer];
      }
    } else if (Array.isArray(answer)) {
      answerArray = answer;
    }
    
    result.selected_list_answer = answerArray;
    
    // Check if this is clinical nurse consultation services
    const questionLower = result.question.toLowerCase();
    if (questionLower.includes('clinical nurse') || 
        questionLower.includes('nurse consultation') ||
        questionKey === 'clinical-nurse-consultation-services') {
      result.selected_clinical_nurse_consultation_services = answerArray;
    }
  }
  
  return result;
}

  sanitizeQuestionText(questionText) {
    return questionText
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .substring(0, 100);
  }

  async getAvailableTagsPreview(bookingId) {
    try {
      const emailData = await this.prepareEmailData(bookingId, {}, { 
        includeMetadata: true,
        includeRawAnswers: false 
      });
      
      if (!emailData) {
        return null;
      }

      const preview = {
        system: {},
        guest: {},
        booking: {},
        rooms: {},
        property: {},
        questions: {},
        calculated: {}
      };

      Object.entries(emailData).forEach(([key, value]) => {
        if (key.startsWith('_')) {
          preview.system[key] = value;
        } else if (key.startsWith('guest_')) {
          preview.guest[key] = value;
        } else if (key.startsWith('booking_') || key === 'booking_reference') {
          preview.booking[key] = value;
        } else if (key.startsWith('room_') || key === 'number_of_adults' || 
                   key === 'number_of_children' || key === 'number_of_infants') {
          preview.rooms[key] = value;
        } else if (key.startsWith('property_')) {
          preview.property[key] = value;
        } else if (key.includes('_date') || key.includes('_time') || 
                   key === 'number_of_nights' || key === 'guest_summary') {
          preview.calculated[key] = value;
        } else {
          preview.questions[key] = value;
        }
      });

      return preview;
    } catch (error) {
      console.error('Error getting tags preview:', error);
      return null;
    }
  }

  async batchPrepareEmailData(bookingIds, additionalData = {}, options = {}) {
    try {
      const results = await Promise.allSettled(
        bookingIds.map(bookingId => 
          this.prepareEmailData(bookingId, additionalData, options)
        )
      );

      return results.map((result, index) => ({
        bookingId: bookingIds[index],
        success: result.status === 'fulfilled',
        data: result.status === 'fulfilled' ? result.value : null,
        error: result.status === 'rejected' ? result.reason : null
      }));
    } catch (error) {
      console.error('Error in batch prepare:', error);
      throw error;
    }
  }

  async prepareAndSendEmail(bookingId, templateId, recipient, additionalData = {}, options = {}) {
    try {
      const emailData = await this.prepareEmailData(bookingId, additionalData, options);
      
      if (!emailData) {
        console.error('Failed to prepare email data');
        return false;
      }

      await EmailService.sendWithTemplate(recipient, templateId, emailData);
      
      return true;
    } catch (error) {
      console.error('Error in prepareAndSendEmail:', error);
      return false;
    }
  }
}

const bookingEmailDataService = new BookingEmailDataService();
export default bookingEmailDataService;
export { BookingEmailDataService };