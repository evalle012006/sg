const { EmailTrigger, EmailTemplate } = require('../../models');
const EmailService = require('../emailService');
const { prepareBookingEmailData, checkTriggerConditions } = require('../../utilities/emailHelpers');

class EmailTriggerService {
  /**
   * Process all email triggers for a booking
   * @param {object} booking - Booking instance
   * @param {object} bookingData - Full booking data with relations
   * @returns {Promise<object>}
   */
  static async processTriggersForBooking(booking, bookingData) {
    try {
      // Get all enabled triggers
      const triggers = await EmailTrigger.findAll({
        where: { enabled: true },
        include: [{ model: EmailTemplate, as: 'template' }]
      });

      console.log(`Processing ${triggers.length} email triggers for booking ${booking.uuid}`);

      const results = {
        total: triggers.length,
        sent: 0,
        skipped: 0,
        failed: 0,
        details: []
      };

      // Extract Q&A pairs from booking
      const qaPairs = bookingData.Sections?.map(s => s.QaPairs).flat() || [];

      // Process each trigger
      for (const trigger of triggers) {
        try {
          // Check if trigger conditions are met
          const conditionsMet = checkTriggerConditions(trigger, qaPairs);

          if (!conditionsMet) {
            console.log(`⊘ Trigger ${trigger.id} conditions not met - skipping`);
            results.skipped++;
            results.details.push({
              trigger_id: trigger.id,
              recipient: trigger.recipient,
              status: 'skipped',
              reason: 'Conditions not met'
            });
            continue;
          }

          // Prepare email data
          const emailData = prepareBookingEmailData(booking, bookingData, trigger);

          // Send email
          if (trigger.email_template_id) {
            // Use new template system
            await EmailService.sendWithTemplate(
              trigger.recipient,
              trigger.email_template_id,
              emailData
            );

            // Update trigger statistics
            await trigger.increment('trigger_count');
            await trigger.update({ last_triggered_at: new Date() });
          } else {
            // Fall back to legacy system
            await EmailService.sendWithLegacyTemplate(
              trigger.recipient,
              'Sargood On Collaroy - New Booking',
              trigger.email_template,
              emailData
            );
          }

          console.log(`✓ Trigger ${trigger.id} processed successfully - sent to ${trigger.recipient}`);
          results.sent++;
          results.details.push({
            trigger_id: trigger.id,
            recipient: trigger.recipient,
            status: 'sent'
          });

        } catch (error) {
          console.error(`✗ Error processing trigger ${trigger.id}:`, error);
          results.failed++;
          results.details.push({
            trigger_id: trigger.id,
            recipient: trigger.recipient,
            status: 'failed',
            error: error.message
          });
        }
      }

      console.log(`Email trigger processing complete: ${results.sent} sent, ${results.skipped} skipped, ${results.failed} failed`);
      
      return results;
    } catch (error) {
      console.error('Error processing email triggers:', error);
      throw error;
    }
  }

  /**
   * Test a single trigger with sample data
   * @param {number} triggerId 
   * @param {object} sampleData 
   * @returns {Promise<object>}
   */
  static async testTrigger(triggerId, sampleData) {
    try {
      const trigger = await EmailTrigger.findByPk(triggerId, {
        include: [{ model: EmailTemplate, as: 'template' }]
      });

      if (!trigger) {
        throw new Error('Trigger not found');
      }

      if (!trigger.email_template_id) {
        throw new Error('Trigger must use new template system for testing');
      }

      // Preview the email
      const preview = await EmailService.previewTemplate(
        trigger.email_template_id,
        sampleData
      );

      return {
        success: true,
        trigger_id: triggerId,
        recipient: trigger.recipient,
        preview
      };
    } catch (error) {
      console.error('Error testing trigger:', error);
      throw error;
    }
  }
}

module.exports = EmailTriggerService;