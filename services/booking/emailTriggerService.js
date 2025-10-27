/**
 * Email Trigger Service
 * 
 * Dedicated service for handling email triggers with automatic evaluation and data preparation.
 * 
 * TRIGGER TYPES (from database):
 * - 'internal': Emails sent to internal staff
 * - 'external': Emails sent to external recipients (coordinators, funders, etc.)
 * 
 * WHEN TRIGGERS ARE EVALUATED:
 * - During save-qa-pair API call (when answers are saved)
 * - On booking submission
 * - On booking confirmation
 * - On booking amendment
 * - Or manually via this service
 * 
 * HOW IT WORKS:
 * 1. User answers questions → save-qa-pair API is called
 * 2. Service checks email_triggers table for matching trigger_questions
 * 3. If booking answers match trigger conditions → email is sent
 * 4. Recipient depends on type:
 *    - internal: trigger.recipient (fixed email address)
 *    - external: answer value (e.g., coordinator email from booking answer)
 * 
 * Usage:
 *   import EmailTriggerService from './EmailTriggerService';
 *   
 *   // Called from save-qa-pair API
 *   await EmailTriggerService.evaluateAndSendTriggers(booking);
 *   
 *   // Or process specific type
 *   await EmailTriggerService.processInternalTriggers(booking);
 *   await EmailTriggerService.processExternalTriggers(booking);
 */

import BookingEmailDataService from './BookingEmailDataService-WithTriggers';
import { EmailTrigger, EmailTemplate } from "../../models";
import { Op } from "sequelize";

class EmailTriggerService {

    /**
     * Main method: Evaluate and send all email triggers for a booking
     * 
     * This is called from save-qa-pair API when booking answers are updated.
     * It checks all enabled triggers and sends emails where conditions are met.
     * 
     * @param {object} booking - Booking object with at least { id, uuid }
     * @param {object} options - Configuration options
     * @returns {Promise<object>} - Results summary
     */
    async evaluateAndSendTriggers(booking, options = {}) {
        try {
            const {
                triggerType = null,        // Optional: filter by type ('internal' or 'external')
                enabled = true,             // Only process enabled triggers
                additionalData = {}         // Additional data to include in emails
            } = options;

            console.log(`\n📧 Evaluating email triggers for booking ${booking.uuid}...`);

            // Build query conditions
            const whereConditions = { enabled };
            if (triggerType) {
                whereConditions.type = triggerType;
            }

            // Fetch all enabled triggers
            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (triggers.length === 0) {
                console.log('⊘ No email triggers found');
                return { 
                    total: 0, 
                    sent: 0, 
                    skipped: 0, 
                    failed: 0,
                    results: []
                };
            }

            console.log(`Found ${triggers.length} trigger(s) to evaluate`);

            // Evaluate all triggers with automatic condition checking
            const evaluationResults = await BookingEmailDataService.processMultipleTriggers(
                booking.uuid,
                triggers,
                additionalData
            );

            // Send emails where conditions are met
            let sentCount = 0;
            let skippedCount = 0;
            let failedCount = 0;
            const detailedResults = [];

            for (const result of evaluationResults) {
                const triggerResult = {
                    trigger_id: result.trigger.id,
                    trigger_type: result.trigger.type,
                    should_send: result.shouldSend,
                    evaluation: result.evaluation
                };

                // Skip if conditions not met
                if (!result.shouldSend) {
                    console.log(`⊘ Skipped trigger ${result.trigger.id} (${result.trigger.type}): ${result.evaluation.reason}`);
                    skippedCount++;
                    triggerResult.status = 'skipped';
                    triggerResult.reason = result.evaluation.reason;
                    detailedResults.push(triggerResult);
                    continue;
                }

                try {
                    // Determine recipient based on trigger type
                    const recipient = this.determineRecipient(result);

                    if (!recipient) {
                        console.log(`⊘ Skipped trigger ${result.trigger.id}: No recipient`);
                        skippedCount++;
                        triggerResult.status = 'skipped';
                        triggerResult.reason = 'No recipient';
                        detailedResults.push(triggerResult);
                        continue;
                    }

                    // Validate template exists
                    if (!result.trigger.email_template_id) {
                        console.log(`⊘ Skipped trigger ${result.trigger.id}: No email template`);
                        skippedCount++;
                        triggerResult.status = 'skipped';
                        triggerResult.reason = 'No email template';
                        detailedResults.push(triggerResult);
                        continue;
                    }

                    // Send email
                    await this.sendEmail(
                        recipient,
                        result.trigger.email_template_id,
                        result.emailData
                    );

                    console.log(`✅ Sent ${result.trigger.type} email for trigger ${result.trigger.id} to ${recipient}`);
                    sentCount++;
                    triggerResult.status = 'sent';
                    triggerResult.recipient = recipient;
                    detailedResults.push(triggerResult);

                } catch (error) {
                    console.error(`✗ Failed to send email for trigger ${result.trigger.id}:`, error);
                    failedCount++;
                    triggerResult.status = 'failed';
                    triggerResult.error = error.message;
                    detailedResults.push(triggerResult);
                }
            }

            const summary = {
                total: triggers.length,
                sent: sentCount,
                skipped: skippedCount,
                failed: failedCount,
                results: detailedResults
            };

            console.log(`\n✓ Email trigger evaluation complete:`);
            console.log(`  - Total triggers: ${summary.total}`);
            console.log(`  - Emails sent: ${summary.sent}`);
            console.log(`  - Skipped: ${summary.skipped}`);
            console.log(`  - Failed: ${summary.failed}\n`);

            return summary;

        } catch (error) {
            console.error('Error evaluating email triggers:', error);
            throw error;
        }
    }

    /**
     * Process internal triggers only
     * These send to internal staff (trigger.recipient contains fixed email address)
     * 
     * @param {object} booking - Booking object
     * @param {object} additionalData - Additional data for email
     * @returns {Promise<object>} - Results summary
     */
    async processInternalTriggers(booking, additionalData = {}) {
        return await this.evaluateAndSendTriggers(booking, {
            triggerType: 'internal',
            additionalData
        });
    }

    /**
     * Process external triggers only
     * These send to external recipients (recipient comes from booking answer)
     * Example: Coordinator email, funder email, etc.
     * 
     * @param {object} booking - Booking object
     * @param {object} additionalData - Additional data for email
     * @returns {Promise<object>} - Results summary
     */
    async processExternalTriggers(booking, additionalData = {}) {
        return await this.evaluateAndSendTriggers(booking, {
            triggerType: 'external',
            additionalData
        });
    }

    /**
     * Process a single trigger by ID
     * Useful for testing or manual trigger execution
     * 
     * @param {object} booking - Booking object
     * @param {number} triggerId - EmailTrigger ID
     * @param {object} additionalData - Additional data for email
     * @returns {Promise<object>} - Send result
     */
    async processSingleTrigger(booking, triggerId, additionalData = {}) {
        try {
            // Fetch trigger
            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (!trigger) {
                console.log(`Trigger ${triggerId} not found`);
                return {
                    sent: false,
                    reason: 'Trigger not found'
                };
            }

            // Use the automatic evaluation + send method
            const result = await BookingEmailDataService.sendWithTriggerEvaluation(
                booking.uuid,
                trigger,
                additionalData
            );

            return result;

        } catch (error) {
            console.error(`Error processing trigger ${triggerId}:`, error);
            return {
                sent: false,
                reason: error.message
            };
        }
    }

    /**
     * Evaluate a single trigger without sending
     * Useful for debugging and preview
     * 
     * @param {object} booking - Booking object
     * @param {number} triggerId - EmailTrigger ID
     * @returns {Promise<object>} - Evaluation result
     */
    async evaluateTrigger(booking, triggerId) {
        try {
            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (!trigger) {
                return {
                    shouldSend: false,
                    reason: 'Trigger not found'
                };
            }

            const evaluation = await BookingEmailDataService.evaluateTrigger(
                booking.uuid,
                trigger
            );

            return evaluation;

        } catch (error) {
            console.error(`Error evaluating trigger ${triggerId}:`, error);
            return {
                shouldSend: false,
                reason: error.message
            };
        }
    }

    /**
     * Preview all triggers for a booking
     * Shows which would send and which would be skipped WITHOUT actually sending
     * 
     * @param {object} booking - Booking object
     * @param {string} triggerType - Optional: filter by type ('internal' or 'external')
     * @returns {Promise<object>} - Preview summary
     */
    async previewTriggersForBooking(booking, triggerType = null) {
        try {
            console.log(`\n📋 Previewing email triggers for booking ${booking.uuid}...`);

            // Build query
            const whereConditions = { enabled: true };
            if (triggerType) {
                whereConditions.type = triggerType;
            }

            // Fetch triggers
            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (triggers.length === 0) {
                console.log('No triggers found');
                return {
                    total: 0,
                    willSend: 0,
                    willSkip: 0,
                    details: []
                };
            }

            // Evaluate all triggers (without sending)
            const results = await BookingEmailDataService.processMultipleTriggers(
                booking.uuid,
                triggers
            );

            // Categorize results
            const willSend = results.filter(r => r.shouldSend);
            const willSkip = results.filter(r => !r.shouldSend);

            const details = results.map(r => ({
                trigger_id: r.trigger.id,
                trigger_type: r.trigger.type,
                trigger_questions: r.trigger.trigger_questions,
                will_send: r.shouldSend,
                reason: r.evaluation.reason,
                recipient: r.shouldSend ? this.determineRecipient(r) : null,
                matched_answers: r.evaluation.matchedAnswers,
                evaluation_details: r.evaluation.evaluationDetails
            }));

            console.log('\n📊 Preview Summary:');
            console.log('─'.repeat(50));
            console.log(`Total Triggers: ${triggers.length}`);
            console.log(`Will Send: ${willSend.length}`);
            console.log(`Will Skip: ${willSkip.length}`);

            if (willSend.length > 0) {
                console.log('\n✅ Triggers that will send:');
                willSend.forEach(r => {
                    const recipient = this.determineRecipient(r);
                    console.log(`  - Trigger ${r.trigger.id} (${r.trigger.type}): ${recipient || 'no recipient'}`);
                });
            }

            if (willSkip.length > 0) {
                console.log('\n⊘ Triggers that will skip:');
                willSkip.forEach(r => {
                    console.log(`  - Trigger ${r.trigger.id} (${r.trigger.type}): ${r.evaluation.reason}`);
                });
            }

            console.log('\n' + '─'.repeat(50));

            return {
                total: triggers.length,
                willSend: willSend.length,
                willSkip: willSkip.length,
                details
            };

        } catch (error) {
            console.error('Error previewing triggers:', error);
            throw error;
        }
    }

    /**
     * Get detailed evaluation for specific trigger
     * Shows exactly why a trigger will or won't send
     * 
     * @param {object} booking - Booking object
     * @param {number} triggerId - EmailTrigger ID
     * @returns {Promise<object>} - Detailed evaluation
     */
    async getDetailedEvaluation(booking, triggerId) {
        try {
            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (!trigger) {
                console.log('Trigger not found');
                return null;
            }

            const evaluation = await BookingEmailDataService.evaluateTrigger(
                booking.uuid,
                trigger
            );

            console.log('\n📋 Detailed Trigger Evaluation:');
            console.log('─'.repeat(50));
            console.log(`Trigger ID: ${trigger.id}`);
            console.log(`Trigger Type: ${trigger.type}`);
            console.log(`Should Send: ${evaluation.shouldSend ? '✅ YES' : '❌ NO'}`);
            console.log(`Reason: ${evaluation.reason}`);
            
            if (trigger.trigger_questions && trigger.trigger_questions.length > 0) {
                console.log('\nTrigger Questions:');
                trigger.trigger_questions.forEach((tq, index) => {
                    console.log(`  ${index + 1}. Question: ${tq.question}`);
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
                recipient: evaluation.shouldSend ? this.determineRecipientFromEvaluation(trigger, evaluation) : null
            };

        } catch (error) {
            console.error('Error getting detailed evaluation:', error);
            throw error;
        }
    }

    /**
     * Test a trigger with a booking (dry run)
     * Evaluates and prepares data but doesn't actually send
     * 
     * @param {object} booking - Booking object
     * @param {number} triggerId - EmailTrigger ID
     * @returns {Promise<object>} - Test result
     */
    async testTrigger(booking, triggerId) {
        try {
            const trigger = await EmailTrigger.findOne({
                where: { id: triggerId },
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }]
            });

            if (!trigger) {
                return {
                    success: false,
                    error: 'Trigger not found'
                };
            }

            // Process trigger (evaluate + prepare data) without sending
            const result = await BookingEmailDataService.processEmailTrigger(
                booking.uuid,
                trigger
            );

            // Determine what would happen
            const recipient = this.determineRecipient(result);

            return {
                success: true,
                trigger: {
                    id: trigger.id,
                    type: trigger.type,
                    trigger_questions: trigger.trigger_questions
                },
                evaluation: result.evaluation,
                would_send: result.shouldSend && !!recipient,
                recipient: recipient,
                email_data_preview: {
                    guest_name: result.emailData?.guest_name,
                    booking_reference: result.emailData?.booking_reference,
                    total_fields: Object.keys(result.emailData || {}).length
                },
                template: {
                    id: trigger.email_template_id,
                    name: trigger.email_template?.name
                }
            };

        } catch (error) {
            console.error('Error testing trigger:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Determine recipient based on trigger type and evaluation result
     * 
     * INTERNAL triggers: Use trigger.recipient (fixed email address)
     * EXTERNAL triggers: Use matched answer value (e.g., coordinator email from booking)
     * 
     * @private
     */
    determineRecipient(result) {
        const trigger = result.trigger;
        const evaluation = result.evaluation;

        if (trigger.type === 'internal') {
            // Internal emails go to fixed recipient
            return trigger.recipient;
        }

        if (trigger.type === 'external') {
            // External emails go to recipient from booking answer
            // The first matched answer contains the email address
            if (evaluation.matchedAnswers && Object.keys(evaluation.matchedAnswers).length > 0) {
                const matchedAnswerKey = Object.keys(evaluation.matchedAnswers)[0];
                return evaluation.matchedAnswers[matchedAnswerKey];
            }
        }

        // Fallback to configured recipient
        return trigger.recipient;
    }

    /**
     * Determine recipient from evaluation (without full result object)
     * @private
     */
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

    /**
     * Queue email using dispatchHttpTaskHandler
     * This queues the email to be sent via Google Cloud Tasks
     * @private
     */
    async sendEmail(recipient, templateId, emailData) {
        const { dispatchHttpTaskHandler } = require('../queues/dispatchHttpTask');
        
        // Queue the email to be sent via service-task endpoint
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
     * Get all triggers (for admin/debugging)
     * 
     * @param {object} filters - Optional filters
     * @returns {Promise<Array>} - Array of triggers
     */
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
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }],
                order: [['type', 'ASC'], ['id', 'ASC']]
            });

            return triggers;

        } catch (error) {
            console.error('Error fetching triggers:', error);
            throw error;
        }
    }

    /**
     * Get triggers by type
     * 
     * @param {string} type - 'internal' or 'external'
     * @param {boolean} enabledOnly - Only get enabled triggers
     * @returns {Promise<Array>} - Array of triggers
     */
    async getTriggersByType(type, enabledOnly = true) {
        try {
            const whereConditions = { type };
            
            if (enabledOnly) {
                whereConditions.enabled = true;
            }

            const triggers = await EmailTrigger.findAll({
                where: whereConditions,
                include: [{ 
                    model: EmailTemplate, 
                    as: 'email_template',
                    required: false 
                }],
                order: [['id', 'ASC']]
            });

            return triggers;

        } catch (error) {
            console.error(`Error fetching ${type} triggers:`, error);
            throw error;
        }
    }
}

// Export singleton instance
const emailTriggerService = new EmailTriggerService();
export default emailTriggerService;
export { EmailTriggerService };