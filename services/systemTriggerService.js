/**
 * System Trigger Service
 * 
 * Handles evaluation and execution of system-level email triggers.
 * System triggers fire based on application events (status changes, submissions, etc.)
 * rather than booking form question responses.
 */

import { EmailTrigger, EmailTemplate } from '../models';
import SystemTriggerDataProvider from './systemTriggerDataProvider.js';
import { getContext, validateContextConditions } from './triggerContextRegistry.js';
import EmailService from '../services/booking/emailService.js';

class SystemTriggerService {
  /**
   * Fire all triggers for a specific context
   * @param {string} context - The trigger context (e.g., 'booking_status_changed')
   * @param {Object} eventData - Event-specific data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Summary of triggers fired
   */
  static async fireTriggers(context, eventData, options = {}) {
    const { dryRun = false } = options;
    
    console.log(`\n🎯 Firing system triggers for context: ${context}`);
    console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);
    
    try {
      // 1. Get all enabled triggers for this context
      const triggers = await EmailTrigger.findAll({
        where: {
          trigger_context: context,
          enabled: true
        },
        include: [
          {
            model: EmailTemplate,
            as: 'template',
            required: true,
            where: {
              is_active: true
            }
          }
        ],
        order: [['priority', 'DESC']] // Higher priority first
      });
      
      if (triggers.length === 0) {
        console.log(`  ℹ️ No enabled triggers found for context: ${context}`);
        return {
          context,
          triggered: 0,
          skipped: 0,
          failed: 0,
          results: []
        };
      }
      
      console.log(`  Found ${triggers.length} trigger(s) to evaluate`);
      
      // 2. Get context data
      const contextData = await SystemTriggerDataProvider.getDataForContext(context, eventData);
      
      // 3. Evaluate and execute each trigger
      const results = [];
      let triggered = 0;
      let skipped = 0;
      let failed = 0;
      
      for (const trigger of triggers) {
        try {
          const result = await this.evaluateAndExecuteTrigger(trigger, contextData, { dryRun });
          results.push(result);
          
          if (result.executed) {
            triggered++;
          } else {
            skipped++;
          }
        } catch (error) {
          failed++;
          console.error(`  ✗ Trigger ${trigger.id} failed:`, error.message);
          results.push({
            trigger_id: trigger.id,
            executed: false,
            reason: `Error: ${error.message}`,
            error: error.message
          });
        }
      }
      
      console.log(`\n📊 System Trigger Summary:`);
      console.log(`  ✓ Triggered: ${triggered}`);
      console.log(`  ⊘ Skipped: ${skipped}`);
      console.log(`  ✗ Failed: ${failed}`);
      
      return {
        context,
        triggered,
        skipped,
        failed,
        results
      };
      
    } catch (error) {
      console.error(`Error firing triggers for context ${context}:`, error);
      throw error;
    }
  }

  /**
   * Evaluate a single trigger and execute if conditions match
   */
  static async evaluateAndExecuteTrigger(trigger, contextData, options = {}) {
    const { dryRun = false } = options;
    
    console.log(`\n  🔍 Evaluating trigger #${trigger.id}: ${trigger.description || 'No description'}`);
    
    // 1. Check context conditions
    const conditionsMatch = this.evaluateConditions(trigger.context_conditions, contextData);
    
    if (!conditionsMatch.match) {
      console.log(`    ⊘ Conditions not met: ${conditionsMatch.reason}`);
      return {
        trigger_id: trigger.id,
        executed: false,
        reason: conditionsMatch.reason,
        conditions_evaluated: conditionsMatch.details
      };
    }
    
    console.log(`    ✓ Conditions matched`);
    
    // 2. Determine recipient
    const recipient = await SystemTriggerDataProvider.determineRecipient(trigger, contextData);
    
    if (!recipient) {
      console.log(`    ⊘ No recipient determined`);
      return {
        trigger_id: trigger.id,
        executed: false,
        reason: 'No recipient',
      };
    }
    
    console.log(`    → Recipient: ${recipient}`);
    
    // 3. Prepare email data (apply custom data mappings if any)
    const emailData = this.applyDataMappings(contextData, trigger.data_mapping);
    
    // 4. Send email (unless dry run)
    if (dryRun) {
      console.log(`    🔬 DRY RUN - Would send email to ${recipient}`);
      return {
        trigger_id: trigger.id,
        executed: false,
        reason: 'Dry run mode',
        would_send_to: recipient,
        template_id: trigger.email_template_id,
        email_data: emailData
      };
    }
    
    // Actually send the email
    try {
      await EmailService.sendWithTemplate(
        recipient,
        trigger.email_template_id,
        emailData
      );
      
      // Update trigger statistics
      await trigger.update({
        last_triggered_at: new Date(),
        trigger_count: trigger.trigger_count + 1
      });
      
      console.log(`    ✓ Email sent successfully`);
      
      return {
        trigger_id: trigger.id,
        executed: true,
        recipient,
        template_id: trigger.email_template_id,
        conditions_matched: conditionsMatch.details
      };
      
    } catch (emailError) {
      console.error(`    ✗ Email send failed:`, emailError.message);
      throw emailError;
    }
  }

  /**
   * Evaluate trigger conditions against context data
   */
  static evaluateConditions(conditions, contextData) {
    // If no conditions, always match
    if (!conditions || Object.keys(conditions).length === 0) {
      return {
        match: true,
        reason: 'No conditions specified',
        details: {}
      };
    }
    
    const details = {};
    const mismatches = [];
    
    for (const [key, expectedValue] of Object.entries(conditions)) {
      const actualValue = contextData[key];
      details[key] = {
        expected: expectedValue,
        actual: actualValue
      };
      
      // Skip null/undefined conditions (means "any value")
      if (expectedValue === null || expectedValue === undefined) {
        details[key].matched = true;
        continue;
      }
      
      // Check for match
      if (Array.isArray(expectedValue)) {
        // Array condition - actual value must be in array
        const matched = expectedValue.includes(actualValue);
        details[key].matched = matched;
        if (!matched) {
          mismatches.push(`${key}: expected one of [${expectedValue.join(', ')}], got ${actualValue}`);
        }
      } else if (typeof expectedValue === 'object') {
        // Object condition - check nested properties
        const matched = this.deepEquals(expectedValue, actualValue);
        details[key].matched = matched;
        if (!matched) {
          mismatches.push(`${key}: object mismatch`);
        }
      } else {
        // Simple value comparison
        const matched = expectedValue === actualValue;
        details[key].matched = matched;
        if (!matched) {
          mismatches.push(`${key}: expected ${expectedValue}, got ${actualValue}`);
        }
      }
    }
    
    const allMatch = mismatches.length === 0;
    
    return {
      match: allMatch,
      reason: allMatch ? 'All conditions matched' : mismatches.join('; '),
      details
    };
  }

  /**
   * Apply custom data mappings to context data
   */
  static applyDataMappings(contextData, dataMappings) {
    if (!dataMappings || Object.keys(dataMappings).length === 0) {
      return contextData; // No custom mappings, use context data as-is
    }
    
    const result = { ...contextData };
    
    // Apply each mapping
    for (const [key, mapping] of Object.entries(dataMappings)) {
      try {
        // Simple template variable substitution
        // e.g., "${booking.Guest.first_name}" -> contextData.booking.Guest.first_name
        if (typeof mapping === 'string' && mapping.startsWith('${') && mapping.endsWith('}')) {
          const path = mapping.slice(2, -1);
          result[key] = this.resolveObjectPath(contextData, path);
        } else {
          result[key] = mapping;
        }
      } catch (error) {
        console.warn(`  ⚠️ Failed to apply mapping for ${key}:`, error.message);
      }
    }
    
    return result;
  }

  /**
   * Resolve object path (e.g., "booking.Guest.first_name")
   */
  static resolveObjectPath(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Deep equality check for objects
   */
  static deepEquals(obj1, obj2) {
    if (obj1 === obj2) return true;
    if (obj1 == null || obj2 == null) return false;
    if (typeof obj1 !== 'object' || typeof obj2 !== 'object') return obj1 === obj2;
    
    const keys1 = Object.keys(obj1);
    const keys2 = Object.keys(obj2);
    
    if (keys1.length !== keys2.length) return false;
    
    for (const key of keys1) {
      if (!keys2.includes(key)) return false;
      if (!this.deepEquals(obj1[key], obj2[key])) return false;
    }
    
    return true;
  }

  /**
   * Preview what triggers would fire for a given context and data
   */
  static async previewTriggers(context, eventData) {
    return await this.fireTriggers(context, eventData, { dryRun: true });
  }

  /**
   * Get all triggers for a specific context
   */
  static async getTriggersForContext(context) {
    return await EmailTrigger.findAll({
      where: {
        trigger_context: context
      },
      include: [
        {
          model: EmailTemplate,
          as: 'template'
        }
      ],
      order: [['priority', 'DESC']]
    });
  }

  /**
   * Create a new system trigger
   */
  static async createSystemTrigger(triggerData) {
    const {
      trigger_context,
      context_conditions,
      email_template_id,
      recipient,
      description,
      priority = 0,
      enabled = true,
      data_mapping = null
    } = triggerData;
    
    // Validate context exists
    const contextDef = getContext(trigger_context);
    if (!contextDef) {
      throw new Error(`Unknown trigger context: ${trigger_context}`);
    }
    
    // Validate conditions
    if (context_conditions) {
      const validation = validateContextConditions(trigger_context, context_conditions);
      if (!validation.valid) {
        throw new Error(`Invalid conditions: ${validation.errors.join(', ')}`);
      }
    }
    
    // Create trigger
    const trigger = await EmailTrigger.create({
      type: 'system',
      trigger_context,
      context_conditions,
      email_template_id,
      recipient,
      description,
      priority,
      enabled,
      data_mapping
    });
    
    return trigger;
  }

  /**
   * Update an existing system trigger
   */
  static async updateSystemTrigger(triggerId, updates) {
    const trigger = await EmailTrigger.findByPk(triggerId);
    
    if (!trigger) {
      throw new Error(`Trigger ${triggerId} not found`);
    }
    
    // If updating context, validate it
    if (updates.trigger_context) {
      const contextDef = getContext(updates.trigger_context);
      if (!contextDef) {
        throw new Error(`Unknown trigger context: ${updates.trigger_context}`);
      }
    }
    
    // If updating conditions, validate them
    if (updates.context_conditions) {
      const contextToValidate = updates.trigger_context || trigger.trigger_context;
      const validation = validateContextConditions(contextToValidate, updates.context_conditions);
      if (!validation.valid) {
        throw new Error(`Invalid conditions: ${validation.errors.join(', ')}`);
      }
    }
    
    await trigger.update(updates);
    return trigger;
  }
}

export default SystemTriggerService;