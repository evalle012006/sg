/**
 * Email Trigger Service - OPTIMIZED VERSION
 * 
 * ✨ PERFORMANCE OPTIMIZATION:
 * - Fetches booking data ONCE at the top level
 * - Passes booking object to all trigger evaluations
 * - Eliminates N queries per trigger (where N = number of triggers)
 * 
 * Previous issue:
 * - For 5 triggers, booking was fetched 10 times (2x per trigger)
 * 
 * After optimization:
 * - For 5 triggers, booking is fetched 1 time total
 * - 90% reduction in database queries!
 */

import BookingEmailDataService from './BookingEmailDataService';
import { EmailTrigger, EmailTemplate, EmailTriggerQuestion, Question, Booking, Section, QaPair, Guest } from "../../models";
import { Op } from "sequelize";

class EmailTriggerService {

    /**
     * ✨ OPTIMIZED: Main method now fetches booking ONCE and passes to all triggers
     * 
     * Old flow (inefficient):
     * 1. For each trigger → fetch booking (in evaluateTrigger) → fetch booking again (in prepareEmailData)
     * 
     * New flow (optimized):
     * 1. Fetch booking once with all relations
     * 2. Pass booking object to all trigger evaluations
     * 3. No more redundant queries!
     */
    async evaluateAndSendTriggers(bookingOrId, options = {}) {
        try {
            const {
                triggerType = null,
                enabled = true,
                additionalData = {}
            } = options;

            // ✨ OPTIMIZATION: Fetch booking data ONCE at the top level
            let booking;
            if (typeof bookingOrId === 'object' && bookingOrId !== null) {
                // Already have the booking object
                booking = bookingOrId;
            } else {
                // Need to fetch it - do it once here
                console.log(`\n🔍 Fetching booking data for ${bookingOrId}...`);
                booking = await BookingEmailDataService.fetchBookingData(bookingOrId);
                
                if (!booking) {
                    console.error(`❌ Booking not found: ${bookingOrId}`);
                    return { 
                        total: 0, 
                        sent: 0, 
                        skipped: 0, 
                        failed: 0,
                        results: [],
                        queued: 0,
                        error: 'Booking not found'
                    };
                }
                
                console.log(`✅ Booking loaded: ${booking.uuid} (${booking.Sections?.length || 0} sections)`);
            }

            console.log(`\n📧 Evaluating email triggers for booking ${booking.uuid}...`);

            // Build query conditions
            const whereConditions = { enabled };
            if (triggerType) {
                whereConditions.type = triggerType;
            }

            // Load all triggers with associations
            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ]
            });

            if (triggers.length === 0) {
                console.log('⊘ No email triggers found');
                return { 
                    total: 0, 
                    sent: 0, 
                    skipped: 0, 
                    failed: 0,
                    results: [],
                    queued: 0
                };
            }

            console.log(`Found ${triggers.length} trigger(s) to evaluate`);
            console.log(`✨ OPTIMIZATION: Using pre-loaded booking data for all triggers (no redundant queries!)\n`);

            let sentCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            const detailedResults = [];

            // ✨ OPTIMIZATION: Process all triggers using the SAME booking object
            for (const trigger of triggers) {
                const triggerResult = {
                    triggerId: trigger.id,
                    triggerType: trigger.type,
                    recipient: trigger.recipient
                };

                try {
                    console.log(`\n📋 Evaluating trigger #${trigger.id} (${trigger.type})`);
                    
                    // ✨ PASS BOOKING OBJECT - no more fetching!
                    const result = await BookingEmailDataService.sendWithTriggerEvaluation(
                        booking,  // ← Pass booking object instead of ID
                        trigger,
                        additionalData
                    );

                    if (result.sent) {
                        console.log(`✅ Email queued for trigger #${trigger.id}`);
                        sentCount++;
                        triggerResult.status = 'sent';
                        triggerResult.recipient = result.recipient;
                        
                        await trigger.update({
                            trigger_count: (trigger.trigger_count || 0) + 1,
                            last_triggered_at: new Date()
                        });
                    } else {
                        console.log(`⊘ Skipped trigger #${trigger.id}: ${result.reason}`);
                        skippedCount++;
                        triggerResult.status = 'skipped';
                        triggerResult.reason = result.reason;
                    }

                    triggerResult.evaluation = result.evaluation;
                    detailedResults.push(triggerResult);

                } catch (error) {
                    console.error(`❌ Error processing trigger #${trigger.id}:`, error);
                    failedCount++;
                    triggerResult.status = 'failed';
                    triggerResult.error = error.message;
                    detailedResults.push(triggerResult);
                }
            }

            const summary = {
                total: triggers.length,
                sent: sentCount,
                queued: sentCount,
                skipped: skippedCount,
                failed: failedCount,
                results: detailedResults
            };

            console.log(`\n✓ Email trigger evaluation complete:`);
            console.log(`  - Total triggers: ${summary.total}`);
            console.log(`  - Emails sent: ${summary.sent}`);
            console.log(`  - Skipped: ${summary.skipped}`);
            console.log(`  - Failed: ${summary.failed}`);
            console.log(`  - DB queries saved: ~${triggers.length * 2} queries! 🚀\n`);

            return summary;

        } catch (error) {
            console.error('Error evaluating email triggers:', error);
            throw error;
        }
    }

    /**
     * Process internal triggers only
     */
    async processInternalTriggers(bookingOrId, additionalData = {}) {
        return await this.evaluateAndSendTriggers(bookingOrId, {
            triggerType: 'internal',
            additionalData
        });
    }

    /**
     * Process external triggers only
     */
    async processExternalTriggers(bookingOrId, additionalData = {}) {
        return await this.evaluateAndSendTriggers(bookingOrId, {
            triggerType: 'external',
            additionalData
        });
    }

    /**
     * ✨ OPTIMIZED: Process single trigger with optional pre-fetched booking
     */
    async processSingleTrigger(bookingOrId, triggerId, additionalData = {}) {
        try {
            // Fetch booking once if needed
            let booking;
            if (typeof bookingOrId === 'object' && bookingOrId !== null) {
                booking = bookingOrId;
            } else {
                booking = await BookingEmailDataService.fetchBookingData(bookingOrId);
                if (!booking) {
                    return {
                        sent: false,
                        reason: 'Booking not found'
                    };
                }
            }

            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ]
            });

            if (!trigger) {
                console.log(`Trigger ${triggerId} not found`);
                return {
                    sent: false,
                    reason: 'Trigger not found'
                };
            }

            // Pass booking object to avoid refetching
            const result = await BookingEmailDataService.sendWithTriggerEvaluation(
                booking,
                trigger,
                additionalData
            );

            return result;

        } catch (error) {
            console.error(`Error processing trigger ${triggerId}:`, error);
            throw error;
        }
    }

    /**
     * ✨ OPTIMIZED: Preview with pre-fetched booking
     */
    async previewTriggers(bookingOrId, triggerType = null) {
        try {
            // Fetch booking once
            let booking;
            if (typeof bookingOrId === 'object' && bookingOrId !== null) {
                booking = bookingOrId;
            } else {
                booking = await BookingEmailDataService.fetchBookingData(bookingOrId);
                if (!booking) {
                    return {
                        total: 0,
                        willSend: 0,
                        willSkip: 0,
                        details: [],
                        error: 'Booking not found'
                    };
                }
            }

            const whereConditions = { enabled: true };
            if (triggerType) {
                whereConditions.type = triggerType;
            }

            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ]
            });

            console.log(`\n🔍 Previewing email triggers for booking ${booking.uuid}`);
            console.log(`Found ${triggers.length} enabled trigger(s)\n`);

            const results = [];

            // Use pre-fetched booking for all triggers
            for (const trigger of triggers) {
                const result = await BookingEmailDataService.processEmailTrigger(
                    booking,  // ← Pass booking object
                    trigger
                );

                results.push({
                    trigger_id: trigger.id,
                    trigger_type: trigger.type,
                    should_send: result.shouldSend,
                    reason: result.evaluation.reason,
                    recipient: result.shouldSend ? 
                        this.determineRecipient(result) : null,
                    matched_answers: result.evaluation.matchedAnswers,
                    evaluation_details: result.evaluation.evaluationDetails
                });
            }

            const willSend = results.filter(r => r.should_send);
            const willSkip = results.filter(r => !r.should_send);

            console.log('\n📊 Preview Summary:');
            console.log('─'.repeat(50));
            console.log(`Total Triggers: ${triggers.length}`);
            console.log(`Will Send: ${willSend.length}`);
            console.log(`Will Skip: ${willSkip.length}`);

            if (willSend.length > 0) {
                console.log('\n✅ Triggers that will send:');
                willSend.forEach(r => {
                    console.log(`  - Trigger ${r.trigger_id} (${r.trigger_type}): ${r.recipient || 'no recipient'}`);
                });
            }

            if (willSkip.length > 0) {
                console.log('\n⊘ Triggers that will skip:');
                willSkip.forEach(r => {
                    console.log(`  - Trigger ${r.trigger_id} (${r.trigger_type}): ${r.reason}`);
                });
            }

            console.log('\n' + '─'.repeat(50));

            return {
                total: triggers.length,
                willSend: willSend.length,
                willSkip: willSkip.length,
                details: results
            };

        } catch (error) {
            console.error('Error previewing triggers:', error);
            throw error;
        }
    }

    /**
     * ✨ OPTIMIZED: Get detailed evaluation with pre-fetched booking
     */
    async getDetailedEvaluation(bookingOrId, triggerId) {
        try {
            // Fetch booking once
            let booking;
            if (typeof bookingOrId === 'object' && bookingOrId !== null) {
                booking = bookingOrId;
            } else {
                booking = await BookingEmailDataService.fetchBookingData(bookingOrId);
                if (!booking) {
                    return null;
                }
            }

            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ]
            });

            if (!trigger) {
                console.log('Trigger not found');
                return null;
            }

            // Pass booking object
            const evaluation = await BookingEmailDataService.evaluateTrigger(
                booking,
                trigger
            );

            console.log('\n📋 Detailed Trigger Evaluation:');
            console.log('─'.repeat(50));
            console.log(`Trigger ID: ${trigger.id}`);
            console.log(`Trigger Type: ${trigger.type}`);
            console.log(`Should Send: ${evaluation.shouldSend ? '✅ YES' : '❌ NO'}`);
            console.log(`Reason: ${evaluation.reason}`);
            
            if (trigger.triggerQuestions && trigger.triggerQuestions.length > 0) {
                console.log('\nTrigger Questions:');
                trigger.triggerQuestions.forEach((tq, index) => {
                    console.log(`  ${index + 1}. Question: ${tq.question.question}`);
                    console.log(`     Question Key: ${tq.question.question_key}`);
                    console.log(`     Expected Answer: ${tq.answer || 'any'}`);
                });
            }
            
            if (evaluation.evaluationDetails && evaluation.evaluationDetails.length > 0) {
                console.log('\nCondition Checks:');
                evaluation.evaluationDetails.forEach((detail, index) => {
                    console.log(`\n  ${index + 1}. ${detail.questionText}`);
                    console.log(`     Expected: "${detail.expectedAnswer || 'any'}"`);
                    console.log(`     Actual: "${detail.actualAnswer || 'not found'}"`);
                    console.log(`     Match: ${detail.matched ? '✅' : '❌'}`);
                    console.log(`     Reason: ${detail.reason}`);
                });
            }

            if (evaluation.matchedAnswers && Object.keys(evaluation.matchedAnswers).length > 0) {
                console.log('\nMatched Answers:');
                Object.entries(evaluation.matchedAnswers).forEach(([key, value]) => {
                    console.log(`  - ${key}: ${value}`);
                });
            }

            console.log('\n' + '─'.repeat(50));

            return {
                trigger,
                evaluation,
                will_send: evaluation.shouldSend,
                recipient: evaluation.shouldSend ? 
                    this.determineRecipientFromEvaluation(trigger, evaluation) : null
            };

        } catch (error) {
            console.error('Error getting detailed evaluation:', error);
            throw error;
        }
    }

    /**
     * ✨ OPTIMIZED: Test trigger with pre-fetched booking
     */
    async testTrigger(bookingOrId, triggerId) {
        try {
            // Fetch booking once
            let booking;
            if (typeof bookingOrId === 'object' && bookingOrId !== null) {
                booking = bookingOrId;
            } else {
                booking = await BookingEmailDataService.fetchBookingData(bookingOrId);
                if (!booking) {
                    return {
                        success: false,
                        error: 'Booking not found'
                    };
                }
            }

            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ]
            });

            if (!trigger) {
                return {
                    success: false,
                    error: 'Trigger not found'
                };
            }

            // Pass booking object
            const result = await BookingEmailDataService.processEmailTrigger(
                booking,
                trigger
            );

            const recipient = this.determineRecipient(result);

            return {
                success: true,
                trigger: {
                    id: trigger.id,
                    type: trigger.type,
                    questions: trigger.triggerQuestions.map(tq => ({
                        question: tq.question.question,
                        question_key: tq.question.question_key,
                        answer: tq.answer
                    }))
                },
                evaluation: result.evaluation,
                would_send: result.shouldSend && !result.error,
                recipient: result.shouldSend ? recipient : null,
                email_data_prepared: result.shouldSend,
                error: result.error
            };

        } catch (error) {
            console.error('Error testing trigger:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    determineRecipient(result) {
        const trigger = result.trigger;
        
        if (trigger.type === 'internal') {
            return trigger.recipient;
        }

        if (trigger.type === 'external' && result.evaluation.matchedAnswers) {
            const matchedAnswerKey = Object.keys(result.evaluation.matchedAnswers)[0];
            return result.evaluation.matchedAnswers[matchedAnswerKey];
        }

        return trigger.recipient;
    }

    determineRecipientFromEvaluation(trigger, evaluation) {
        if (trigger.type === 'internal') {
            return trigger.recipient;
        }

        if (trigger.type === 'external' && evaluation.matchedAnswers) {
            const matchedAnswerKey = Object.keys(evaluation.matchedAnswers)[0];
            return evaluation.matchedAnswers[matchedAnswerKey];
        }

        return trigger.recipient;
    }

    async sendEmail(recipient, templateId, emailData) {
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

    async getAllTriggers(filters = {}) {
        try {
            const whereConditions = {};
            
            if (filters.enabled !== undefined) {
                whereConditions.enabled = filters.enabled;
            }
            
            if (filters.type) {
                whereConditions.type = filters.type;
            }

            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ],
                order: [['type', 'ASC'], ['id', 'ASC']]
            });

            return triggers;

        } catch (error) {
            console.error('Error fetching triggers:', error);
            throw error;
        }
    }

    async getTriggersByType(type, enabledOnly = true) {
        try {
            const whereConditions = { type };
            
            if (enabledOnly) {
                whereConditions.enabled = true;
            }

            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [
                    { 
                        model: EmailTemplate, 
                        as: 'template',
                        required: false 
                    },
                    {
                        model: EmailTriggerQuestion,
                        as: 'triggerQuestions',
                        include: [{
                            model: Question,
                            as: 'question'
                        }]
                    }
                ],
                order: [['id', 'ASC']]
            });

            return triggers;

        } catch (error) {
            console.error(`Error fetching ${type} triggers:`, error);
            throw error;
        }
    }
}

export default new EmailTriggerService();
export { EmailTriggerService };