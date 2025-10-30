/**
 * BookingEmailDataService - OPTIMIZED VERSION
 * 
 * ✨ PERFORMANCE OPTIMIZATION:
 * - Methods now accept either booking ID or pre-fetched booking object
 * - Eliminates redundant database queries when processing multiple triggers
 * - Backward compatible - still works with booking IDs
 * 
 * Previous issue: For each trigger, booking data was fetched twice (evaluateTrigger + prepareEmailData)
 * Solution: Fetch once at top level, pass booking object through the chain
 */

import { Booking, Setting, Template, Page, Section, Question, Room, RoomType, Guest, EmailTrigger, QaPair } from "../../models";
import EmailService from "./emailService";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey, mapQuestionTextToKey } from "./question-helper";
import moment from "moment";

class BookingEmailDataService {
  
  /**
   * ✨ OPTIMIZED: Main method now accepts booking object OR booking ID
   * @param {object|string|number} bookingOrId - Booking object or booking ID
   */
  async prepareEmailData(bookingOrId, additionalData = {}, options = {}) {
    try {
      const {
        includeRawAnswers = false,
        includeSectionSpecific = true,
        formatDates = 'DD/MM/YYYY',
        includeMetadata = true
      } = options;

      // ✨ NEW: Check if we received a booking object or need to fetch it
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);
      
      if (!bookingData) {
        console.error(`Booking not found: ${bookingOrId}`);
        return null;
      }

      const emailData = {};

      if (includeMetadata) {
        this.addSystemMetadata(emailData, bookingData);
      }

      this.addGuestData(emailData, bookingData);
      this.addBookingDetails(emailData, bookingData, formatDates);
      this.addRoomData(emailData, bookingData);
      this.addPropertyData(emailData);
      await this.addQuestionAnswers(emailData, bookingData, includeSectionSpecific);
      this.addCalculatedFields(emailData, bookingData, formatDates);

      Object.assign(emailData, additionalData);

      if (includeRawAnswers) {
        emailData._raw_qa_pairs = bookingData.Sections
          ?.map(section => section.QaPairs || [])
          .flat()
          .filter(qa => qa != null) || [];
      }

      return emailData;

    } catch (error) {
      console.error('Error preparing email data:', error);
      throw error;
    }
  }

  /**
   * ✨ OPTIMIZED: Now accepts booking object OR booking ID
   * @param {object|string|number} bookingOrId - Booking object or booking ID
   */
  async evaluateTrigger(bookingOrId, trigger) {
    try {
      const triggerQuestions = trigger.triggerQuestions || [];

      if (triggerQuestions.length === 0) {
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
        .filter(qa => qa != null) || [];

      console.log(`📊 Booking has ${qaPairs.length} answered questions`);

      const evaluationResults = [];
      const matchedAnswers = {};

      for (const triggerQuestion of triggerQuestions) {
        const result = this.evaluateTriggerQuestion(
          triggerQuestion,
          qaPairs
        );
        
        evaluationResults.push(result);
        
        if (result.matched) {
          matchedAnswers[result.questionKey || result.questionText] = result.actualAnswer;
        }
      }

      const allMatched = evaluationResults.every(r => r.matched);
      
      const nonMatchReasons = evaluationResults
        .filter(r => !r.matched)
        .map(r => r.reason);

      return {
        shouldSend: allMatched,
        reason: allMatched 
          ? 'All trigger conditions matched' 
          : `Conditions not met: ${nonMatchReasons.join('; ')}`,
        matchedAnswers,
        evaluationDetails: evaluationResults
      };

    } catch (error) {
      console.error('Error evaluating trigger:', error);
      return {
        shouldSend: false,
        reason: `Error: ${error.message}`,
        matchedAnswers: {},
        evaluationDetails: []
      };
    }
  }

  /**
   * Evaluate a single trigger question
   */
  evaluateTriggerQuestion(triggerQuestion, qaPairs) {
    const question = triggerQuestion.question;
    const expectedAnswer = triggerQuestion.answer;
    
    if (!question) {
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
    
    console.log(`🔍 Looking for question: "${triggerQuestionText}" (key: ${triggerQuestionKey})`);
    
    let relevantQaPair;
    if (triggerQuestionKey) {
      relevantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
    } else {
      relevantQaPair = qaPairs.find(qa => 
        qa.question === triggerQuestionText || 
        qa.Question?.question === triggerQuestionText
      );
    }

    if (!relevantQaPair) {
      console.log(`   ❌ Question not found in booking`);
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
    console.log(`   ✅ Found! Answer: "${actualAnswer}"`);

    if (!actualAnswer) {
      return {
        matched: false,
        reason: `Question "${triggerQuestionText}" has no answer`,
        questionText: triggerQuestionText,
        questionKey: triggerQuestionKey,
        expectedAnswer,
        actualAnswer: null
      };
    }

    if (!expectedAnswer || expectedAnswer === '') {
      return {
        matched: true,
        reason: `Question "${triggerQuestionText}" has an answer (any value accepted)`,
        questionText: triggerQuestionText,
        questionKey: triggerQuestionKey,
        expectedAnswer: 'any',
        actualAnswer
      };
    }

    const matched = this.answersMatch(actualAnswer, expectedAnswer);

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
  **/
  answersMatch(actualAnswer, expectedAnswer) {
    const parseAnswer = (answer) => {
      if (Array.isArray(answer)) {
        return answer.map(a => String(a).trim().toLowerCase());
      }
      
      if (typeof answer === 'string') {
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
        
        return answer.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
      }
      
      return [String(answer).trim().toLowerCase()];
    };

    const actualValues = parseAnswer(actualAnswer);
    const expectedValues = parseAnswer(expectedAnswer);

    const hasAnyMatch = expectedValues.some(expected => 
      actualValues.some(actual => 
        actual === expected || 
        actual.includes(expected) || 
        expected.includes(actual)
      )
    );

    if (hasAnyMatch) {
      console.log(`   ✓ Partial match found: ${expectedValues.filter(exp => 
        actualValues.some(act => act.includes(exp) || exp.includes(act))
      ).join(', ')}`);
      return true;
    }

    const normalizedActual = actualValues.sort().join(',');
    const normalizedExpected = expectedValues.sort().join(',');
    
    if (normalizedActual === normalizedExpected) {
      console.log('   ✓ Exact match');
      return true;
    }

    console.log(`   ✗ No match: actual [${actualValues.join(', ')}] vs expected [${expectedValues.join(', ')}]`);
    return false;
  }

  /**
   * ✨ OPTIMIZED: Process email trigger with booking object
   * @param {object|string|number} bookingOrId - Booking object or booking ID
   */
  async processEmailTrigger(bookingOrId, trigger, additionalData = {}) {
    try {
      // ✨ OPTIMIZED: Fetch booking data ONCE here if needed
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);

      if (!bookingData) {
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

      // ✨ OPTIMIZED: Pass booking object to avoid refetching
      const evaluation = await this.evaluateTrigger(bookingData, trigger);
      
      if (!evaluation.shouldSend) {
        return {
          shouldSend: false,
          evaluation,
          trigger,
          emailData: null
        };
      }

      // ✨ OPTIMIZED: Pass booking object to avoid refetching
      const emailData = await this.prepareEmailData(bookingData, additionalData);
      
      return {
        shouldSend: true,
        evaluation,
        trigger,
        emailData
      };

    } catch (error) {
      console.error('Error processing email trigger:', error);
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
   * @param {object|string|number} bookingOrId - Booking object or booking ID
   */
  async sendWithTriggerEvaluation(bookingOrId, trigger, additionalData = {}) {
    try {
      // ✨ OPTIMIZED: Fetch booking data ONCE here if needed
      const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
        ? bookingOrId
        : await this.fetchBookingData(bookingOrId);

      if (!bookingData) {
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
      } else if (trigger.type === 'external') {
        const matchedAnswerKey = Object.keys(result.evaluation.matchedAnswers)[0];
        recipient = result.evaluation.matchedAnswers[matchedAnswerKey];
      } else {
        recipient = trigger.recipient;
      }

      if (!recipient) {
        return {
          sent: false,
          reason: 'No recipient found',
          recipient: null,
          evaluation: result.evaluation
        };
      }

      const templateId = trigger.email_template_id || trigger.template?.id;
      if (!templateId) {
        return {
          sent: false,
          reason: 'No email template configured',
          recipient: null,
          evaluation: result.evaluation
        };
      }

      // Queue email
      await this.queueEmail(recipient, templateId, result.emailData);

      return {
        sent: true,
        reason: 'Email queued successfully',
        recipient,
        evaluation: result.evaluation
      };

    } catch (error) {
      console.error('Error in sendWithTriggerEvaluation:', error);
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
    const { dispatchHttpTaskHandler } = require('../queues/dispatchHttpTask');
    
    await dispatchHttpTaskHandler('booking', { 
      type: 'sendTriggerEmail',
      payload: {
        recipient,
        templateId,
        emailData
      }
    });
    
    console.log(`📬 Email queued for ${recipient} with template ${templateId}`);
  }

  /**
   * Fetch booking data with ALL sections from ALL pages
   */
  async fetchBookingData(bookingId) {
    try {
      const whereClause = bookingId.includes('-') 
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
            required: false
          },
          {
            model: Room,
            include: [RoomType]
          }
        ]
      });

      if (!booking) {
        return null;
      }

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
          
          console.log(`📊 Loaded booking with ${template.Pages.length} pages from template`);
          console.log(`📊 Found ${allBookingSections.length} booking sections across all pages`);
          
          const totalQaPairs = allBookingSections.reduce((sum, section) => 
            sum + (section.QaPairs?.length || 0), 0
          );
          console.log(`📊 Total QaPairs loaded: ${totalQaPairs}`);
        }
      } else {
        if (booking && booking.Sections) {
          console.log(`📊 Loaded booking with ${booking.Sections.length} sections (no template)`);
          const totalQaPairs = booking.Sections.reduce((sum, section) => {
            return sum + (section.QaPairs?.length || 0);
          }, 0);
          console.log(`📊 Total QaPairs loaded: ${totalQaPairs}`);
        }
      }

      return booking;
    } catch (error) {
      console.error('Error fetching booking data:', error);
      throw error;
    }
  }

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
      emailData.room_count = 0;
    }
  }

  addPropertyData(emailData) {
    emailData.property_name = 'Sargood On Collaroy';
    emailData.property_address = '1 Pittwater Road, Collaroy, NSW 2097';
    emailData.property_phone = '(02) 9972 9999';
    emailData.property_email = 'info@sargoodoncollaroy.com.au';
    emailData.property_website = 'https://sargoodoncollaroy.com.au';
  }

  async addQuestionAnswers(emailData, bookingData, includeSectionSpecific) {
    const qaPairs = bookingData.Sections
      ?.map(section => section.QaPairs)
      .flat() || [];

    if (qaPairs.length === 0) {
      return;
    }

    const { EmailTemplateMappingService } = require('./EmailTemplateService');
    const MERGE_TAG_MAP = EmailTemplateMappingService.MERGE_TAG_MAP;

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

    qaPairs.forEach(qaPair => {
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      const sectionId = qaPair.section_id;
      const answer = qaPair.answer;
      
      if (!questionKey) return;

      if (!emailData[questionKey] && answer !== null && answer !== undefined) {
        emailData[questionKey] = this.formatAnswerForEmail(answer);
      }

      if (includeSectionSpecific && sectionId) {
        const sectionSpecificKey = `${questionKey}_s${sectionId}`;
        emailData[sectionSpecificKey] = this.formatAnswerForEmail(answer);
      }

      if (qaPair.Question?.question) {
        const textKey = this.sanitizeQuestionText(qaPair.Question.question);
        if (!emailData[textKey]) {
          emailData[textKey] = this.formatAnswerForEmail(answer);
        }
      }
    });
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