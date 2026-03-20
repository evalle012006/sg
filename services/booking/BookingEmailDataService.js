/**
 * BookingEmailDataService - OPTIMIZED VERSION WITH FALLBACK
 * 
 * ✨ PERFORMANCE OPTIMIZATION + BACKWARD COMPATIBILITY:
 * - Methods accept either booking ID or pre-fetched booking object
 * - Fallback from question_id to question text matching (old system compatibility)
 * - Extensive logging for debugging
 * 
 * 🔧 UPDATED: answersMatch() now properly handles service-cards object format
 */

import { Booking, Setting, Template, Page, Section, Question, Room, RoomType, Guest, EmailTrigger, QaPair, Package, Course } from "../../models";
import { dispatchHttpTaskHandler } from "../queues/dispatchHttpTask";
import EmailService from "./emailService";
import { QUESTION_KEYS, getAnswerByQuestionKey, findByQuestionKey, mapQuestionTextToKey } from "./question-helper";
import moment from "moment";
import { EmailTemplateMappingService } from "./EmailTemplateService";
import AuditLogService from "../../services/AuditLogService";

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
      await this.enrichCourseData(emailData, qaPairs);
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
      const triggerConditions = trigger.trigger_conditions || null;

      console.log(`   Trigger Questions: ${triggerQuestions.length}`);
      console.log(`   Trigger Conditions: ${JSON.stringify(triggerConditions)}`);

      // Check booking status condition FIRST
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

      // Evaluate booking status condition
      if (triggerConditions?.booking_status?.length > 0) {
        let currentStatusName = null;
        try {
          const statusObj = typeof bookingData.status === 'string'
            ? JSON.parse(bookingData.status)
            : bookingData.status;
          currentStatusName = statusObj?.name;
        } catch (e) {
          currentStatusName = bookingData.status_name || null;
        }

        console.log(`   📋 Booking status: "${currentStatusName}"`);
        console.log(`   📋 Required statuses: [${triggerConditions.booking_status.join(', ')}]`);

        if (!currentStatusName || !triggerConditions.booking_status.includes(currentStatusName)) {
          console.log('   ❌ Booking status condition NOT met');
          return {
            shouldSend: false,
            reason: `Booking status "${currentStatusName}" not in required statuses [${triggerConditions.booking_status.join(', ')}]`,
            matchedAnswers: {},
            evaluationDetails: []
          };
        }
        console.log('   ✅ Booking status condition met');
      }

      // If no trigger questions, pass (status already checked above)
      if (triggerQuestions.length === 0) {
        console.log('   ⚠️ No question conditions specified - passing (status check already done)');
        return {
          shouldSend: true,
          reason: triggerConditions?.booking_status?.length 
            ? `Booking status condition met: ${bookingData.status_name || ''}` 
            : 'No trigger conditions specified',
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
    const questionType = question.question_type || question.type || null; // ✨ capture type

    console.log('   📋 Trigger question details:');
    console.log(`      ID: ${triggerQuestionId || 'N/A'}`);
    console.log(`      Key: ${triggerQuestionKey || 'N/A'}`);
    console.log(`      Type: ${questionType || 'N/A'}`);
    console.log(`      Text: "${triggerQuestionText?.substring(0, 60)}..."`);
    console.log(`      Expected Answer: "${expectedAnswer || 'any'}"`);

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
    // ✨ Prefer question type from the stored QaPair (most accurate), fall back to trigger question type
    const resolvedQuestionType = relevantQaPair.Question?.question_type
      || relevantQaPair.Question?.type
      || relevantQaPair.question_type
      || questionType;

    console.log(`   📌 Actual Answer: "${actualAnswer?.toString().substring(0, 100)}"`);
    console.log(`   📌 Resolved Question Type: ${resolvedQuestionType || 'unknown'}`);

    if (!actualAnswer && actualAnswer !== 0 && actualAnswer !== '0') {
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

    // ✨ Pass resolvedQuestionType so answersMatch can apply the right comparison logic
    const matched = this.answersMatch(actualAnswer, expectedAnswer, resolvedQuestionType);

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
   * 🔧 REWRITTEN: Compare answers with proper per-type handling.
   *
   * Answer formats from qa_pairs:
   *
   *  simple-checkbox   → "1" / "0"  — treat as boolean (1=true, 0=false)
   *                       Expected in trigger: true/false/"true"/"false"/1/0
   *
   *  radio             → plain string: "Yes", "No", "I enjoyed my previous stay"
   *  select            → plain string OR numeric string: "Male", "0", "1", "2"
   *  horizontal-card   → plain string: "icare", "ndis"
   *  package-selection → numeric string: "6"
   *  year              → numeric string: "2013"
   *  string/text/email/phone-number/date/file-upload → plain string, exact match
   *
   *  checkbox / checkbox-button → JSON array string: ["Manual Wheelchair","T5"]
   *                               Match if ANY expected value exactly equals ANY item
   *
   *  service-cards     → JSON object: { "slug": { selected: bool, subOptions: [] } }
   *                       Match if expected slug exists AND selected === true
   *
   * ⚠️  No partial/contains matching — causes false positives:
   *     "No" would contain-match "None of the Above", "1" would match inside "10"
   *
   * @param {string|number} actualAnswer  - raw answer stored in QaPair
   * @param {string|number} expectedAnswer - value configured on the trigger
   * @param {string|null}   questionType  - question_type from the Question record
   */
  answersMatch(actualAnswer, expectedAnswer, questionType = null) {
    console.log('      🔍 Comparing answers...');
    console.log(`         Type    : ${questionType || 'unknown'}`);
    console.log(`         Actual  : ${String(actualAnswer).substring(0, 120)}`);
    console.log(`         Expected: ${String(expectedAnswer).substring(0, 120)}`);

    if (actualAnswer === null || actualAnswer === undefined ||
        expectedAnswer === null || expectedAnswer === undefined) {
      console.log('      ✗ null/undefined operand');
      return false;
    }

    // ─── Helper: normalise expected into an array of trimmed strings ──────────
    // Only splits on comma for non-JSON values, to support multi-value trigger
    // conditions like "ndis,icare" while not splitting "B - Some sensation, no motor..."
    const splitExpected = (value) => {
      if (Array.isArray(value)) return value.map(v => String(v).trim());
      const str = String(value).trim();
      if (str.includes(',') && !str.startsWith('{') && !str.startsWith('[')) {
        return str.split(',').map(s => s.trim()).filter(Boolean);
      }
      return [str];
    };

    // ─── Helper: normalise a value to boolean ────────────────────────────────
    const toBoolean = (value) => {
      const str = String(value).trim().toLowerCase();
      if (str === '1' || str === 'true' || str === 'yes') return true;
      if (str === '0' || str === 'false' || str === 'no') return false;
      return null; // not a recognisable boolean
    };

    // ─── STEP 1: simple-checkbox — boolean comparison ────────────────────────
    // Stored as "1" (checked) or "0" (unchecked). Compare as boolean so a trigger
    // configured as true/"true"/1 all work, and "0" is never confused with a
    // select option that happens to be the string "0".
    if (questionType === 'simple-checkbox') {
      const actualBool = toBoolean(actualAnswer);
      const expectedBool = toBoolean(expectedAnswer);

      console.log('      ☑️  simple-checkbox format');
      console.log(`         Actual bool  : ${actualBool}`);
      console.log(`         Expected bool: ${expectedBool}`);

      if (actualBool === null || expectedBool === null) {
        console.log('      ✗ Could not parse as boolean');
        return false;
      }

      const matched = actualBool === expectedBool;
      console.log(`      ${matched ? '✓' : '✗'} Boolean match: ${matched}`);
      return matched;
    }

    // ─── STEP 2: Parse actualAnswer from JSON string if needed ───────────────
    let parsedActual = actualAnswer;
    if (typeof actualAnswer === 'string') {
      const trimmed = actualAnswer.trim();
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) ||
          (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        try {
          parsedActual = JSON.parse(trimmed);
        } catch (e) {
          // Not valid JSON — keep as plain string
        }
      }
    }

    // ─── STEP 3: service-cards object ────────────────────────────────────────
    // Format: { "service-slug": { selected: boolean, subOptions: [] } }
    // Rule: expected is the service slug; only matches when selected === true.
    //       A key that exists but has selected === false is a definitive non-match.
    if (typeof parsedActual === 'object' && parsedActual !== null && !Array.isArray(parsedActual)) {
      const entries = Object.entries(parsedActual);
      const isServiceMap = entries.length > 0 &&
        entries.some(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);

      if (isServiceMap) {
        console.log('      📦 service-cards format detected');

        const expectedKeys = splitExpected(expectedAnswer).map(k => k.toLowerCase());
        console.log(`         Expected service keys: [${expectedKeys.join(', ')}]`);

        for (const expectedKey of expectedKeys) {
          for (const [serviceKey, serviceValue] of entries) {
            if (serviceKey.toLowerCase().trim() === expectedKey) {
              if (serviceValue.selected === true) {
                console.log(`      ✓ Service "${serviceKey}" matched and is selected`);
                return true;
              } else {
                // Key found but not selected — stop, don't check other keys
                console.log(`      ✗ Service "${serviceKey}" matched but selected === false`);
                return false;
              }
            }
          }
        }

        console.log('      ✗ No matching service key found');
        return false;
      }

      // Non-service-map plain object (e.g. rooms) — not useful for trigger matching
      console.log('      ✗ Non-service-map object — unsupported for trigger matching');
      return false;
    }

    // ─── STEP 4: Array answer (checkbox, checkbox-button) ────────────────────
    // Format: ["Manual Wheelchair", "Power Wheelchair"] / ["T5"] / ["I understand"]
    // Rule: match if ANY expected value exactly equals ANY actual item (case-insensitive).
    if (Array.isArray(parsedActual)) {
      console.log('      📋 Array format detected');

      const actualItems = parsedActual.map(v => String(v).trim().toLowerCase());
      const expectedItems = splitExpected(expectedAnswer).map(e => e.toLowerCase());

      console.log(`         Actual items   : [${actualItems.join(', ')}]`);
      console.log(`         Expected items : [${expectedItems.join(', ')}]`);

      const matched = expectedItems.some(exp => actualItems.includes(exp));
      console.log(`      ${matched ? '✓' : '✗'} Array match: ${matched}`);
      return matched;
    }

    // ─── STEP 5: All remaining scalar types ──────────────────────────────────
    // Covers: radio, select, horizontal-card, string, text, email, phone-number,
    //         date, year, package-selection, file-upload
    //
    // select / multi-select may legitimately store "0" or "1" as option values
    // (e.g. "Number of children: 0") — these are plain strings, NOT booleans.
    // Exact case-insensitive match only. No partial/contains matching.
    const actualStr = String(parsedActual).trim().toLowerCase();
    const expectedItems = splitExpected(expectedAnswer).map(e => e.toLowerCase());

    console.log(`      🔤 Scalar format (${questionType || 'unknown type'})`);
    console.log(`         Actual  : "${actualStr}"`);
    console.log(`         Expected: [${expectedItems.join(', ')}]`);

    const matched = expectedItems.includes(actualStr);
    console.log(`      ${matched ? '✓' : '✗'} Scalar match: ${matched}`);
    return matched;
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

  async sendWithTriggerEvaluation(bookingOrId, trigger, additionalData = {}) {
    try {
      console.log('\n📧 Send with trigger evaluation...');
      console.log(`   Trigger ID: ${trigger.id}, Type: ${trigger.type}`);
      
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

      const result = await this.processEmailTrigger(bookingData, trigger, additionalData);

      if (!result.shouldSend) {
        console.log(`   ⊘ Will not send: ${result.evaluation.reason}`);
        
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: [],
          templateId: trigger.email_template_id || trigger.template?.id,
          templateName: trigger.name || `Trigger ${trigger.id}`,
          triggerType: trigger.type,
          triggerId: trigger.id,
          triggerName: trigger.name,
          reason: `Trigger conditions not met: ${result.evaluation.reason}`,
          emailData: null
        });

        return {
          sent: false,
          reason: result.evaluation.reason,
          recipient: null,
          evaluation: result.evaluation
        };
      }

      // ✅ Determine recipient(s) based on trigger type
      let recipients = [];
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      
      if (trigger.type === 'internal') {
        const recipientString = trigger.recipient;
        console.log(`   📬 Internal email to: ${recipientString}`);
        
        if (recipientString && recipientString.includes(',')) {
          recipients = recipientString.split(',').map(email => email.trim()).filter(email => email);
          console.log(`   📧 Split into ${recipients.length} recipients`);
        } else {
          recipients = recipientString ? [recipientString.trim()] : [];
        }
        
      } else if (trigger.type === 'external') {
        if (result.evaluation.matchedAnswers && Object.keys(result.evaluation.matchedAnswers).length > 0) {
          const matchedAnswerKey = Object.keys(result.evaluation.matchedAnswers)[0];
          const matchedAnswerValue = result.evaluation.matchedAnswers[matchedAnswerKey];
          
          console.log(`   🔍 Checking matched answer: "${matchedAnswerValue}"`);
          
          if (matchedAnswerValue) {
            if (matchedAnswerValue.includes(',')) {
              recipients = matchedAnswerValue.split(',').map(email => email.trim()).filter(email => email && emailRegex.test(email));
              if (recipients.length > 0) {
                console.log(`   📬 External email to ${recipients.length} coordinator(s): ${recipients.join(', ')}`);
              }
            } else if (emailRegex.test(matchedAnswerValue)) {
              recipients = [matchedAnswerValue.trim()];
              console.log(`   📬 External email to coordinator: ${matchedAnswerValue}`);
            } else {
              console.log(`   ⚠️ Matched answer is not a valid email: "${matchedAnswerValue}"`);
            }
          }
        }
        
        if (recipients.length === 0) {
          const guestEmail = result.emailData?.guest_email || result.emailData?.email;
          
          if (guestEmail && emailRegex.test(guestEmail)) {
            recipients = [guestEmail.trim()];
            console.log(`   🔄 Falling back to guest email: ${guestEmail}`);
          } else {
            console.log('   ❌ No valid guest email found in emailData');
            
            await this.logEmailSend(bookingData, {
              success: false,
              recipients: [],
              templateId: trigger.email_template_id || trigger.template?.id,
              templateName: trigger.name || `Trigger ${trigger.id}`,
              triggerType: trigger.type,
              triggerId: trigger.id,
              triggerName: trigger.name,
              reason: 'No recipient email found (neither coordinator nor guest)',
              emailData: result.emailData
            });

            return {
              sent: false,
              reason: 'No recipient email found (neither coordinator nor guest)',
              recipient: null,
              evaluation: result.evaluation
            };
          }
        }
        
      } else {
        const recipientString = trigger.recipient;
        if (recipientString && recipientString.includes(',')) {
          recipients = recipientString.split(',').map(email => email.trim()).filter(email => email);
        } else {
          recipients = recipientString ? [recipientString.trim()] : [];
        }
        console.log(`   📬 Email to: ${recipients.join(', ')}`);
      }

      // ✅ Validate all recipients
      const invalidRecipients = recipients.filter(email => !email || !emailRegex.test(email));
      
      if (invalidRecipients.length > 0) {
        console.log(`   ❌ Invalid recipient email address(es): ${invalidRecipients.join(', ')}`);
        
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: invalidRecipients,
          templateId: trigger.email_template_id || trigger.template?.id,
          templateName: trigger.name || `Trigger ${trigger.id}`,
          triggerType: trigger.type,
          triggerId: trigger.id,
          triggerName: trigger.name,
          reason: `Invalid recipient email: ${invalidRecipients.join(', ')}`,
          emailData: result.emailData
        });

        return {
          sent: false,
          reason: `Invalid recipient email: ${invalidRecipients.join(', ')}`,
          recipient: invalidRecipients.join(', '),
          evaluation: result.evaluation
        };
      }

      if (recipients.length === 0) {
        console.log('   ❌ No recipient found');
        
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: [],
          templateId: trigger.email_template_id || trigger.template?.id,
          templateName: trigger.name || `Trigger ${trigger.id}`,
          triggerType: trigger.type,
          triggerId: trigger.id,
          triggerName: trigger.name,
          reason: 'No recipient found',
          emailData: result.emailData
        });

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
        
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: recipients,
          templateId: null,
          templateName: trigger.name || `Trigger ${trigger.id}`,
          triggerType: trigger.type,
          triggerId: trigger.id,
          triggerName: trigger.name,
          reason: 'No email template configured',
          emailData: result.emailData
        });

        return {
          sent: false,
          reason: 'No email template configured',
          recipient: null,
          evaluation: result.evaluation
        };
      }

      // ✨ Send to each recipient with individual audit logging
      const sentResults = [];
      const triggerInfo = {
        id: trigger.id,
        name: trigger.name,
        type: trigger.type
      };

      for (const recipient of recipients) {
        console.log(`   📨 Queueing email to ${recipient} with template ${templateId}...`);
        
        try {
          await this.queueEmail(
            recipient, 
            templateId, 
            result.emailData, 
            bookingData, 
            triggerInfo
          );
          sentResults.push({ recipient, success: true });
          console.log(`   ✅ Queued for ${recipient}`);
        } catch (error) {
          console.error(`   ❌ Failed to queue email to ${recipient}:`, error);
          sentResults.push({ recipient, success: false, error: error.message });
        }
      }

      const successfulSends = sentResults.filter(r => r.success);
      const failedSends = sentResults.filter(r => !r.success);

      if (successfulSends.length === recipients.length) {
        console.log(`   ✅ Email queued successfully to all ${recipients.length} recipient(s)!`);
        return {
          sent: true,
          reason: `Email queued successfully to ${recipients.length} recipient(s)`,
          recipient: recipients.join(', '),
          evaluation: result.evaluation,
          sentResults
        };
      } else if (successfulSends.length > 0) {
        console.log(`   ⚠️ Partially sent: ${successfulSends.length}/${recipients.length} successful`);
        return {
          sent: true,
          reason: `Sent to ${successfulSends.length}/${recipients.length} recipients. Failed: ${failedSends.map(f => f.recipient).join(', ')}`,
          recipient: recipients.join(', '),
          evaluation: result.evaluation,
          sentResults
        };
      } else {
        console.log(`   ❌ All sends failed`);
        return {
          sent: false,
          reason: `Failed to send to all recipients: ${failedSends.map(f => f.error).join('; ')}`,
          recipient: recipients.join(', '),
          evaluation: result.evaluation,
          sentResults
        };
      }

    } catch (error) {
      console.error('❌ Error in sendWithTriggerEvaluation:', error);
      
      try {
        const bookingData = typeof bookingOrId === 'object' && bookingOrId !== null
          ? bookingOrId
          : await this.fetchBookingData(bookingOrId);

        if (bookingData) {
          await this.logEmailSend(bookingData, {
            success: false,
            recipients: [],
            templateId: trigger.email_template_id || trigger.template?.id,
            templateName: trigger.name || `Trigger ${trigger.id}`,
            triggerType: trigger.type,
            triggerId: trigger.id,
            triggerName: trigger.name,
            error: error.message,
            reason: `System error: ${error.message}`,
            emailData: null
          });
        }
      } catch (auditError) {
        console.error('Failed to log error audit:', auditError);
      }

      return {
        sent: false,
        reason: `Error: ${error.message}`,
        recipient: null,
        error: error.message
      };
    }
  }

  /**
   * Create audit log entry for email send
   */
  async logEmailSend(bookingData, emailInfo) {
    try {
      const {
        success,
        recipients,
        templateId,
        templateName,
        triggerType,
        triggerId,
        triggerName,
        error,
        reason,
        emailData
      } = emailInfo;

      // Build description based on success/failure
      let description = '';
      if (success) {
        if (recipients.length === 1) {
          description = `Email sent to ${recipients[0]}`;
        } else {
          description = `Email sent to ${recipients.length} recipients`;
        }
      } else {
        description = `Email send failed: ${reason || error || 'Unknown error'}`;
      }

      // Prepare metadata
      const metadata = {
        email_template_id: templateId,
        email_template_name: templateName,
        recipients: recipients,
        recipient_count: recipients.length,
        trigger_type: triggerType,
        trigger_id: triggerId,
        trigger_name: triggerName,
        timestamp: new Date(),
        success: success,
        error_message: error || null,
        failure_reason: reason || null
      };

      // Add email subject/preview if available
      if (emailData?.subject) {
        metadata.email_subject = emailData.subject;
      }

      await AuditLogService.createAuditEntry({
        bookingId: bookingData.id,
        userId: null, // System-generated email
        guestId: null,
        actionType: success ? 'email_sent' : 'email_failed',
        userType: 'system',
        description: description,
        oldValue: null,
        newValue: {
          recipients: recipients,
          template_id: templateId,
          trigger_id: triggerId
        },
        category: 'Email',
        metadata: metadata
      });

      console.log(`✅ Email audit logged: ${description}`);
    } catch (auditError) {
      console.error('Failed to log email audit:', auditError);
      // Don't throw - email audit logging failure shouldn't break email sending
    }
  }

  /**
   * Queue email using dispatchHttpTaskHandler
   */
  async queueEmail(recipient, templateId, emailData, bookingData = null, triggerInfo = null) {
    console.log('\n📤 Queueing email task...');
    console.log(`   Recipient: ${recipient}`);
    console.log(`   Template ID: ${templateId}`);
    
    try {
      await dispatchHttpTaskHandler('booking', { 
        type: 'sendTriggerEmail',
        payload: {
          recipient,
          templateId,
          emailData,
          booking_id: bookingData?.id || null,
          trigger_info: triggerInfo ? {
            id: triggerInfo.id,
            name: triggerInfo.name,
            type: triggerInfo.type
          } : null
        }
      });
      
      console.log('   ✅ Email task queued\n');

      if (bookingData) {
        await this.logEmailSend(bookingData, {
          success: true,
          recipients: [recipient],
          templateId: templateId,
          templateName: emailData?.template_name || `Template ${templateId}`,
          triggerType: triggerInfo?.type || 'manual',
          triggerId: triggerInfo?.id || null,
          triggerName: triggerInfo?.name || null,
          reason: 'Email queued successfully',
          emailData: emailData
        });
      }

      return true;
    } catch (error) {
      console.error('   ❌ Failed to queue email:', error);

      if (bookingData) {
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: [recipient],
          templateId: templateId,
          templateName: emailData?.template_name || `Template ${templateId}`,
          triggerType: triggerInfo?.type || 'manual',
          triggerId: triggerInfo?.id || null,
          triggerName: triggerInfo?.name || null,
          error: error.message,
          reason: 'Failed to queue email task',
          emailData: emailData
        });
      }

      throw error;
    }
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

  /**
   * ✨ NEW: Format answer as a display-safe string for simple {{tag}} Handlebars usage.
   * 
   * Unlike formatAnswerForEmail (which preserves arrays/objects for #each loops),
   * this always returns a string so {{tag}} never renders as [object Object].
   * 
   * Array of strings  → "Item 1, Item 2, Item 3"
   * Array of objects  → extracts label/name/value/text property, joins with ", "
   * Object            → JSON.stringify fallback
   * Primitive         → String(value)
   */
  formatAnswerForDisplay(answer) {
    if (answer === null || answer === undefined) {
      return '';
    }

    if (typeof answer === 'boolean') {
      return answer ? 'Yes' : 'No';
    }

    // Try to parse JSON strings first (answers stored as "[...]" or "{...}" in DB)
    let parsed = answer;
    if (typeof answer === 'string') {
      if ((answer.startsWith('[') && answer.endsWith(']')) ||
          (answer.startsWith('{') && answer.endsWith('}'))) {
        try {
          parsed = JSON.parse(answer);
        } catch (e) {
          // Not valid JSON - fall through to string handling below
        }
      }
    }

    // ✨ Handle service-selection object map: { "service-key": { selected: bool, subOptions: [] } }
    // This is the format used by checkbox-with-suboptions question types
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      
      // Detect if this is a service map (values have a "selected" property)
      const isServiceMap = entries.length > 0 && 
        entries.every(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);
      
      if (isServiceMap) {
        const selectedServices = entries
          .filter(([, v]) => v.selected === true)
          .map(([key, v]) => {
            // Convert slug key to readable label: "gym-at-sargood" → "Gym At Sargood"
            const label = key
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');
            
            // Append any selected sub-options if present
            if (Array.isArray(v.subOptions) && v.subOptions.length > 0) {
              const subLabels = v.subOptions.map(sub => {
                if (typeof sub === 'object' && sub !== null) {
                  return sub.label || sub.name || sub.value || JSON.stringify(sub);
                }
                return String(sub);
              });
              return `${label} (${subLabels.join(', ')})`;
            }
            
            return label;
          });
        
        return selectedServices.length > 0 ? selectedServices.join(', ') : 'None selected';
      }

      // Generic object: try common label properties, fall back to JSON
      return parsed.label || parsed.name || parsed.value || parsed.text || JSON.stringify(parsed);
    }

    // Flatten simple arrays to comma-joined string
    if (Array.isArray(parsed)) {
      return parsed.map(item => {
        if (item === null || item === undefined) return '';
        if (typeof item === 'object') {
          return item.label || item.name || item.value || item.text || JSON.stringify(item);
        }
        return String(item);
      }).filter(Boolean).join(', ');
    }

    // Plain string or number
    return String(parsed).trim();
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

    const MERGE_TAG_MAP = EmailTemplateMappingService.MERGE_TAG_MAP;

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

    qaPairs.forEach(qaPair => {
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      const sectionId = qaPair.section_id;
      const answer = qaPair.answer;
      
      if (!questionKey) return;

      const formattedAnswer = this.formatAnswerForEmail(answer);
      const displayValue = this.formatAnswerForDisplay(answer);

      // ✨ Calculate _raw data ONCE and reuse for both hyphenated and underscore versions
      let rawData = null;
      
      if (Array.isArray(formattedAnswer)) {
        rawData = formattedAnswer;
      } else if (typeof formattedAnswer === 'object' && formattedAnswer !== null) {
        // Check if it's a service map and create filtered array
        const entries = Object.entries(formattedAnswer);
        const isServiceMap = entries.length > 0 &&
          entries.every(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);
        
        if (isServiceMap) {
          rawData = entries
            .filter(([, v]) => v.selected === true)
            .map(([key, v]) => ({
              key,
              label: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              subOptions: (v.subOptions || []).map(subOpt => {
                // Convert slug to readable label
                if (typeof subOpt === 'string') {
                  return subOpt.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                }
                // If it's an object, use its label property
                return subOpt.label || subOpt.name || subOpt.value || String(subOpt);
              })
            }));
        } else {
          rawData = formattedAnswer;
        }
      }

      // Add answer by question_key (hyphenated version)
      if (!emailData[questionKey] && answer !== null && answer !== undefined) {
        emailData[questionKey] = displayValue;

        // Store _raw version if we have structured data
        if (rawData !== null) {
          emailData[`${questionKey}_raw`] = rawData;
        }
      }

      // ✅ Also store underscore version with SAME data
      if (questionKey.includes('-')) {
        const underscoreKey = questionKey.replace(/-/g, '_');
        if (!emailData[underscoreKey] && answer !== null && answer !== undefined) {
          emailData[underscoreKey] = displayValue;

          // ✅ Reuse the same rawData we calculated above
          if (rawData !== null) {
            emailData[`${underscoreKey}_raw`] = rawData;
          }
        }
      }

      // Add section-specific keys if needed
      if (includeSectionSpecific && sectionId) {
        const sectionSpecificKey = `${questionKey}_s${sectionId}`;
        emailData[sectionSpecificKey] = displayValue;

        if (questionKey.includes('-')) {
          const underscoreSectionKey = `${questionKey.replace(/-/g, '_')}_s${sectionId}`;
          emailData[underscoreSectionKey] = displayValue;
        }
      }

      // Add sanitized question text as key
      if (qaPair.Question?.question) {
        const textKey = this.sanitizeQuestionText(qaPair.Question.question);
        if (!emailData[textKey]) {
          emailData[textKey] = displayValue;
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

  /**
   * Enrich course data - resolve course IDs to course details
   * Similar to enrichPackageData but for courses
   */
  async enrichCourseData(emailData, qaPairs) {
    // Find all QA pairs that might contain course references
    const courseQaPairs = qaPairs.filter(qa => {
      const questionKey = qa.Question?.question_key || qa.question_key;
      const questionText = qa.Question?.question || qa.question || '';
      
      // Look for course-related questions
      return questionKey?.includes('course') || 
            questionText.toLowerCase().includes('course') ||
            questionText.toLowerCase().includes('which course');
    });

    for (const qaPair of courseQaPairs) {
      const answer = qaPair.answer;
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      
      // Check if answer is a numeric course ID
      if (answer && /^\d+$/.test(answer.toString().trim())) {
        try {
          const courseId = parseInt(answer);
          const courseData = await Course.findByPk(courseId, {
            attributes: [
              'id', 
              'title', 
              'description', 
              'start_date', 
              'end_date',
              'duration_hours',
              'min_start_date',
              'min_end_date'
            ]
          });
          
          if (courseData) {
            // Store both the ID and the enriched data
            if (questionKey) {
              emailData[`${questionKey}`] = answer; // Keep original ID
              emailData[`${questionKey}_name`] = courseData.title;
              emailData[`${questionKey}_title`] = courseData.title;
              emailData[`${questionKey}_id`] = courseData.id;
              
              // Also add underscore version
              const underscoreKey = questionKey.replace(/-/g, '_');
              emailData[`${underscoreKey}_name`] = courseData.title;
              emailData[`${underscoreKey}_title`] = courseData.title;
            }
            
            // Add to common aliases
            emailData['course_id'] = courseData.id;
            emailData['course_name'] = courseData.title;
            emailData['course_title'] = courseData.title;
            emailData['course_description'] = courseData.description;
            
            // Add dates if available
            if (courseData.start_date) {
              emailData['course_start_date'] = moment(courseData.start_date).format('DD-MM-YYYY');
              emailData['course_start_date_raw'] = courseData.start_date;
            }
            
            if (courseData.end_date) {
              emailData['course_end_date'] = moment(courseData.end_date).format('DD-MM-YYYY');
              emailData['course_end_date_raw'] = courseData.end_date;
            }
            
            console.log(`✅ Enriched course ${courseId} → "${courseData.title}"`);
          } else {
            console.warn(`⚠️ Course ID ${courseId} not found in database`);
          }
        } catch (error) {
          console.error('⚠️ Error enriching course data:', error);
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
      console.log('\n📧 Prepare and send email...');
      console.log(`   Booking: ${bookingId}`);
      console.log(`   Template: ${templateId}`);
      console.log(`   Recipient: ${recipient}`);

      const bookingData = typeof bookingId === 'object' && bookingId !== null
        ? bookingId
        : await this.fetchBookingData(bookingId);

      if (!bookingData) {
        console.error('❌ Booking not found');
        return false;
      }

      const emailData = await this.prepareEmailData(bookingData, additionalData, options);
      
      if (!emailData) {
        console.error('❌ Failed to prepare email data');
        
        await this.logEmailSend(bookingData, {
          success: false,
          recipients: [recipient],
          templateId: templateId,
          templateName: `Template ${templateId}`,
          triggerType: 'manual',
          triggerId: null,
          triggerName: 'Direct Send',
          reason: 'Failed to prepare email data',
          emailData: null
        });

        return false;
      }

      try {
        await EmailService.sendWithTemplate(recipient, templateId, emailData);
        
        console.log('   ✅ Email sent successfully');

        await this.logEmailSend(bookingData, {
          success: true,
          recipients: [recipient],
          templateId: templateId,
          templateName: emailData?.template_name || `Template ${templateId}`,
          triggerType: 'manual',
          triggerId: null,
          triggerName: 'Direct Send',
          reason: 'Email sent successfully',
          emailData: emailData
        });
        
        return true;
      } catch (sendError) {
        console.error('❌ Failed to send email:', sendError);

        await this.logEmailSend(bookingData, {
          success: false,
          recipients: [recipient],
          templateId: templateId,
          templateName: emailData?.template_name || `Template ${templateId}`,
          triggerType: 'manual',
          triggerId: null,
          triggerName: 'Direct Send',
          error: sendError.message,
          reason: 'Failed to send email',
          emailData: emailData
        });

        return false;
      }
    } catch (error) {
      console.error('❌ Error in prepareAndSendEmail:', error);
      return false;
    }
  }
}

const bookingEmailDataService = new BookingEmailDataService();
export default bookingEmailDataService;
export { BookingEmailDataService };