import { Setting, Template, Page, Section, Question, Room, RoomType, Guest, EmailTrigger } from "../../models";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey, mapQuestionTextToKey } from "./question-helper";
import moment from "moment";

/**
 * Enhanced Generic Booking Email Data Service with Trigger Evaluation
 * 
 * This version includes:
 * 1. Automatic data preparation (all booking data)
 * 2. Trigger evaluation (check if booking matches trigger conditions)
 * 3. Conditional email sending based on trigger rules
 * 
 * Usage:
 *   // Simple usage (no trigger evaluation)
 *   const emailData = await BookingEmailDataService.prepareEmailData(bookingId);
 *   
 *   // With trigger evaluation
 *   const shouldSend = await BookingEmailDataService.evaluateTrigger(bookingId, trigger);
 *   if (shouldSend) {
 *     const emailData = await BookingEmailDataService.prepareEmailData(bookingId);
 *     await EmailService.sendWithTemplate(recipient, templateId, emailData);
 *   }
 *   
 *   // All-in-one: evaluate and send
 *   await BookingEmailDataService.processEmailTrigger(bookingId, trigger);
 */
class BookingEmailDataService {
  
  /**
   * Main method: Prepare complete email data from booking ID
   * (Same as before - no changes to this core functionality)
   */
  async prepareEmailData(bookingId, additionalData = {}, options = {}) {
    try {
      const {
        includeRawAnswers = false,
        includeSectionSpecific = true,
        formatDates = 'DD/MM/YYYY',
        includeMetadata = true
      } = options;

      const bookingData = await this.fetchBookingData(bookingId);
      
      if (!bookingData) {
        console.error(`Booking not found: ${bookingId}`);
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
          ?.map(section => section.QaPairs)
          .flat() || [];
      }

      return emailData;

    } catch (error) {
      console.error('Error preparing email data:', error);
      throw error;
    }
  }

  /**
   * NEW: Evaluate if a booking matches trigger conditions
   * 
   * @param {string} bookingId - Booking UUID or ID
   * @param {object} trigger - EmailTrigger object with trigger_questions
   * @returns {Promise<object>} - { shouldSend: boolean, reason: string, matchedAnswers: object }
   */
  async evaluateTrigger(bookingId, trigger) {
    try {
      // If no trigger questions specified, always send
      if (!trigger.trigger_questions || trigger.trigger_questions.length === 0) {
        return {
          shouldSend: true,
          reason: 'No trigger conditions specified',
          matchedAnswers: {}
        };
      }

      // Fetch booking data
      const bookingData = await this.fetchBookingData(bookingId);
      if (!bookingData) {
        return {
          shouldSend: false,
          reason: 'Booking not found',
          matchedAnswers: {}
        };
      }

      // Get Q&A pairs
      const qaPairs = bookingData.Sections?.map(section => section.QaPairs).flat() || [];

      // Evaluate each trigger question
      const evaluationResults = [];
      const matchedAnswers = {};

      for (const triggerQuestion of trigger.trigger_questions) {
        const result = this.evaluateTriggerQuestion(
          triggerQuestion,
          qaPairs
        );
        
        evaluationResults.push(result);
        
        if (result.matched) {
          matchedAnswers[result.questionKey || result.questionText] = result.actualAnswer;
        }
      }

      // Determine if email should be sent
      // Logic: ALL trigger questions must match (AND logic)
      const allMatched = evaluationResults.every(r => r.matched);
      
      // Get reasons for non-matches
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
        matchedAnswers: {}
      };
    }
  }

  /**
   * NEW: Evaluate a single trigger question
   * @private
   */
  evaluateTriggerQuestion(triggerQuestion, qaPairs) {
    const triggerQuestionText = triggerQuestion.question;
    const expectedAnswer = triggerQuestion.answer;
    
    // Try to map question text to question key
    const triggerQuestionKey = mapQuestionTextToKey(triggerQuestionText);
    
    // Find the relevant Q&A pair
    let relevantQaPair;
    if (triggerQuestionKey) {
      relevantQaPair = findByQuestionKey(qaPairs, triggerQuestionKey);
    } else {
      relevantQaPair = qaPairs.find(qa => 
        qa.question === triggerQuestionText || 
        qa.Question?.question === triggerQuestionText
      );
    }

    // If question not found in booking
    if (!relevantQaPair) {
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

    // If no answer provided in booking
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

    // If trigger doesn't specify an expected answer, just check if question exists with any answer
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

    // Compare actual answer with expected answer
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
   * NEW: Compare two answers (handles case-insensitive, trimming, etc.)
   * @private
   */
  answersMatch(actualAnswer, expectedAnswer) {
    // Convert both to strings for comparison
    const actual = String(actualAnswer).toLowerCase().trim();
    const expected = String(expectedAnswer).toLowerCase().trim();
    
    // Direct match
    if (actual === expected) {
      return true;
    }

    // Try parsing as JSON and comparing
    try {
      const actualParsed = JSON.parse(actualAnswer);
      const expectedParsed = JSON.parse(expectedAnswer);
      
      // If both are arrays, check if they have the same elements
      if (Array.isArray(actualParsed) && Array.isArray(expectedParsed)) {
        return JSON.stringify(actualParsed.sort()) === JSON.stringify(expectedParsed.sort());
      }
      
      // If both are objects, do deep comparison
      if (typeof actualParsed === 'object' && typeof expectedParsed === 'object') {
        return JSON.stringify(actualParsed) === JSON.stringify(expectedParsed);
      }
    } catch (e) {
      // Not JSON, continue with string comparison
    }

    return false;
  }

  /**
   * NEW: Process an email trigger (evaluate + prepare data + return result)
   * This combines evaluation and data preparation in one call
   * 
   * @param {string} bookingId - Booking UUID or ID
   * @param {object} trigger - EmailTrigger object
   * @param {object} additionalData - Additional data to include in email
   * @returns {Promise<object>} - { shouldSend, emailData, evaluation }
   */
  async processEmailTrigger(bookingId, trigger, additionalData = {}) {
    try {
      // First, evaluate trigger conditions
      const evaluation = await this.evaluateTrigger(bookingId, trigger);
      
      // If conditions not met, return early
      if (!evaluation.shouldSend) {
        return {
          shouldSend: false,
          emailData: null,
          evaluation,
          trigger
        };
      }

      // Prepare email data
      const emailData = await this.prepareEmailData(
        bookingId,
        {
          ...additionalData,
          // Add trigger-specific data
          _trigger_matched: true,
          _trigger_id: trigger.id,
          _matched_answers: evaluation.matchedAnswers
        }
      );

      return {
        shouldSend: true,
        emailData,
        evaluation,
        trigger
      };

    } catch (error) {
      console.error('Error processing email trigger:', error);
      return {
        shouldSend: false,
        emailData: null,
        evaluation: {
          shouldSend: false,
          reason: `Error: ${error.message}`
        },
        trigger
      };
    }
  }

  /**
   * NEW: Process multiple triggers for a booking
   * Returns results for all triggers, including which should send and which should not
   * 
   * @param {string} bookingId - Booking UUID or ID
   * @param {Array} triggers - Array of EmailTrigger objects
   * @param {object} additionalData - Additional data to include in emails
   * @returns {Promise<Array>} - Array of results for each trigger
   */
  async processMultipleTriggers(bookingId, triggers, additionalData = {}) {
    try {
      const results = [];

      for (const trigger of triggers) {
        const result = await this.processEmailTrigger(
          bookingId,
          trigger,
          additionalData
        );
        results.push(result);
      }

      return results;

    } catch (error) {
      console.error('Error processing multiple triggers:', error);
      throw error;
    }
  }

  /**
   * NEW: Send email with trigger evaluation
   * Only sends if trigger conditions are met
   * 
   * @param {string} bookingId - Booking UUID or ID
   * @param {object} trigger - EmailTrigger object
   * @param {object} additionalData - Additional data to include
   * @returns {Promise<object>} - { sent, reason, emailData }
   */
  async sendWithTriggerEvaluation(bookingId, trigger, additionalData = {}) {
    try {
      // Process trigger
      const result = await this.processEmailTrigger(bookingId, trigger, additionalData);

      if (!result.shouldSend) {
        console.log(`📧 Email not sent: ${result.evaluation.reason}`);
        return {
          sent: false,
          reason: result.evaluation.reason,
          emailData: null,
          evaluation: result.evaluation
        };
      }

      // Determine recipient
      let recipient = trigger.recipient;
      
      // Special case: If trigger type is 'funder', recipient comes from matched answer
      if (trigger.type === 'funder' && result.evaluation.matchedAnswers) {
        const matchedAnswerKey = Object.keys(result.evaluation.matchedAnswers)[0];
        recipient = result.evaluation.matchedAnswers[matchedAnswerKey];
      }

      if (!recipient) {
        console.log(`📧 Email not sent: No recipient specified`);
        return {
          sent: false,
          reason: 'No recipient specified',
          emailData: result.emailData,
          evaluation: result.evaluation
        };
      }

      // Send email
      const EmailService = require('./email').default;
      await EmailService.sendWithTemplate(
        recipient,
        trigger.email_template_id,
        result.emailData
      );

      console.log(`✅ Email sent to ${recipient}`);
      return {
        sent: true,
        reason: 'Email sent successfully',
        recipient,
        emailData: result.emailData,
        evaluation: result.evaluation
      };

    } catch (error) {
      console.error('Error sending email with trigger evaluation:', error);
      return {
        sent: false,
        reason: `Error: ${error.message}`,
        emailData: null
      };
    }
  }

  // ============================================
  // Private Helper Methods (same as before)
  // ============================================

  async fetchBookingData(bookingId) {
    const { Booking } = require("../../models");
    
    return await Booking.findOne({
      where: { 
        [require("sequelize").Op.or]: [
          { uuid: bookingId },
          { id: bookingId }
        ]
      },
      include: [
        {
          model: Section,
          include: [{ 
            model: require("../../models").QaPair, 
            include: ['Question'] 
          }]
        },
        {
          model: Room,
          include: [{ model: RoomType }]
        },
        Guest
      ]
    });
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
    emailData.booking_status = bookingData.status || '';
    emailData.booking_type = bookingData.type || '';
    emailData.late_arrival = bookingData.late_arrival || false;
    emailData.alternate_contact_name = bookingData.alternate_contact_name || '';
    emailData.alternate_contact_number = bookingData.alternate_contact_number || '';
    emailData.created_at = bookingData.createdAt 
      ? moment(bookingData.createdAt).format(dateFormat) 
      : '';
    emailData.updated_at = bookingData.updatedAt 
      ? moment(bookingData.updatedAt).format(dateFormat) 
      : '';
  }

  addRoomData(emailData, bookingData) {
    const rooms = bookingData.Rooms || [];
    
    if (rooms.length > 0) {
      const primaryRoom = rooms[0];
      
      emailData.room_id = primaryRoom.id;
      emailData.room_label = primaryRoom.label || '';
      emailData.room_checkin = primaryRoom.checkin 
        ? moment(primaryRoom.checkin).format('DD/MM/YYYY') 
        : '';
      emailData.room_checkout = primaryRoom.checkout 
        ? moment(primaryRoom.checkout).format('DD/MM/YYYY') 
        : '';
      emailData.arrival_time = primaryRoom.arrival_time || '';
      
      emailData.number_of_adults = primaryRoom.adults || 0;
      emailData.number_of_children = primaryRoom.children || 0;
      emailData.number_of_infants = primaryRoom.infants || 0;
      emailData.number_of_pets = primaryRoom.pets || 0;
      emailData.number_of_guests = primaryRoom.total_guests || 0;
      
      if (primaryRoom.RoomType) {
        emailData.room_type_id = primaryRoom.RoomType.id;
        emailData.room_type = primaryRoom.RoomType.name || '';
        emailData.room_type_name = primaryRoom.RoomType.name || '';
      }
      
      emailData.rooms = rooms.map(room => ({
        id: room.id,
        label: room.label,
        type: room.RoomType?.name || '',
        checkin: room.checkin,
        checkout: room.checkout,
        adults: room.adults,
        children: room.children,
        infants: room.infants,
        total_guests: room.total_guests
      }));
      
      emailData.room_count = rooms.length;
      
      const roomTypes = rooms
        .map(room => room.RoomType?.name)
        .filter(Boolean);
      emailData.room_types = roomTypes.join(', ');
    } else {
      emailData.number_of_adults = 0;
      emailData.number_of_children = 0;
      emailData.number_of_infants = 0;
      emailData.number_of_pets = 0;
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

      const EmailService = require('./email').default;
      await EmailService.sendWithTemplate(recipient, templateId, emailData);
      
      return true;
    } catch (error) {
      console.error('Error in prepareAndSendEmail:', error);
      return false;
    }
  }
}

// Export singleton instance
const bookingEmailDataService = new BookingEmailDataService();
export default bookingEmailDataService;
export { BookingEmailDataService };