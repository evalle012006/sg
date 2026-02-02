import { EmailTemplate } from '../../models/index.js';
import handlebars from 'handlebars';
import sendMailWithHtml from '../../utilities/mailServiceHtml.js';
import SendEmail from '../../utilities/mail.js';
import { TEMPLATE_FALLBACK_MAP } from './templateFallbackMap.js';

/**
 * Register Handlebars helpers
 */
function registerHelpers() {
  // Date formatting
  handlebars.registerHelper('formatDate', function(date, format = 'DD/MM/YYYY') {
    if (!date) return '';
    const moment = require('moment');
    return moment(date).format(format);
  });

  // Conditional helpers
  handlebars.registerHelper('eq', (a, b) => a === b);
  handlebars.registerHelper('ne', (a, b) => a !== b);
  handlebars.registerHelper('gt', (a, b) => a > b);
  handlebars.registerHelper('lt', (a, b) => a < b);
  handlebars.registerHelper('gte', (a, b) => a >= b);
  handlebars.registerHelper('lte', (a, b) => a <= b);
  handlebars.registerHelper('or', function() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
  });
  handlebars.registerHelper('and', function() {
    return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
  });
  handlebars.registerHelper('not', (value) => !value);

  // String helpers
  handlebars.registerHelper('uppercase', str => str ? str.toUpperCase() : '');
  handlebars.registerHelper('lowercase', str => str ? str.toLowerCase() : '');
  handlebars.registerHelper('capitalize', function(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });
  handlebars.registerHelper('trim', str => str ? str.trim() : '');

  // Array helpers
  handlebars.registerHelper('length', arr => Array.isArray(arr) ? arr.length : 0);
  handlebars.registerHelper('isArray', value => Array.isArray(value));
  handlebars.registerHelper('join', (arr, separator = ', ') => 
    Array.isArray(arr) ? arr.join(separator) : arr
  );
  handlebars.registerHelper('isNotEmpty', function(value) {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object' && value !== null) return Object.keys(value).length > 0;
    return !!value;
  });

  // Object helpers
  handlebars.registerHelper('keys', obj => obj ? Object.keys(obj) : []);
  handlebars.registerHelper('values', obj => obj ? Object.values(obj) : []);

  // JSON parsing
  handlebars.registerHelper('parseJSON', function(str) {
    try {
      return typeof str === 'string' ? JSON.parse(str) : str;
    } catch (e) {
      return str;
    }
  });

  // Default value helper
  handlebars.registerHelper('default', (value, defaultValue) => value || defaultValue);

  // Type checking helpers
  handlebars.registerHelper('isString', value => typeof value === 'string');
  handlebars.registerHelper('isNumber', value => typeof value === 'number');
  handlebars.registerHelper('isObject', value => 
    typeof value === 'object' && value !== null && !Array.isArray(value)
  );

  // Math helpers
  handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  handlebars.registerHelper('subtract', (a, b) => Number(a) - Number(b));
  handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
  handlebars.registerHelper('divide', (a, b) => Number(a) / Number(b));
  
  // Index helper
  handlebars.registerHelper('inc', value => Number(value) + 1);
}

class EmailService {
  /**
   * Get template by ID or Code
   * @param {number|string} identifier - Template ID (number) or template_code (string)
   * @returns {Promise<EmailTemplate|null>}
   */
  static async getTemplate(identifier) {
    try {
      // Check if identifier is a number (ID) or string (code)
      if (typeof identifier === 'number') {
        return await EmailTemplate.findByPk(identifier);
      } else if (typeof identifier === 'string') {
        // Try to find by template_code first
        const template = await EmailTemplate.findOne({ 
          where: { template_code: identifier } 
        });
        
        if (template) {
          return template;
        }
        
        // Fallback: try parsing as number for backward compatibility
        const numId = parseInt(identifier);
        if (!isNaN(numId)) {
          return await EmailTemplate.findByPk(numId);
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching template:', error);
      return null;
    }
  }

  /**
   * Validate that all required variables are present in the data
   * @param {EmailTemplate} template - The template instance
   * @param {Object} data - The data object to validate
   * @throws {Error} If required variables are missing
   */
  static validateRequiredVariables(template, data) {
    if (!template.is_system || !template.required_variables || template.required_variables.length === 0) {
      return;
    }

    const missingVars = template.required_variables.filter(varName => {
      return !(varName in data);
    });

    if (missingVars.length > 0) {
      const descriptions = template.variable_description || {};
      const missingDetails = missingVars.map(v => 
        `${v} (${descriptions[v] || 'No description'})`
      ).join(', ');
      
      console.error(`❌ Template "${template.name}" validation failed:`);
      console.error(`   Missing variables: ${missingDetails}`);
      console.error(`   Provided data keys: ${Object.keys(data).join(', ')}`);
      
      throw new Error(
        `Template "${template.name}" is missing required variables: ${missingDetails}`
      );
    } else {
      console.log(`✅ Template "${template.name}" - All required variables present`);
    }
  }

  /**
   * Extract variables from a Handlebars template
   * @param {string} templateContent - The template content
   * @returns {Array<string>} Array of variable names
   */
  static extractTemplateVariables(templateContent) {
    const variableRegex = /\{\{([^}]+)\}\}/g;
    const variables = new Set();
    let match;

    while ((match = variableRegex.exec(templateContent)) !== null) {
      // Extract variable name (handle {{variable}} and {{#if variable}})
      const fullMatch = match[1].trim();
      const varName = fullMatch.split(/\s+/)[0].replace(/^[#/^]/, '');
      
      if (varName && !['if', 'each', 'unless', 'with', 'else', 'lookup'].includes(varName)) {
        variables.add(varName);
      }
    }

    return Array.from(variables);
  }

  /**
   * Send email using template ID or Code (no attachments)
   * @param {string} recipient - Email recipient
   * @param {number|string} templateIdentifier - Template ID or code
   * @param {Object} data - Template data
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result object
   */
  static async sendWithTemplate(recipient, templateIdentifier, data, options = {}) {
    const { useFallback = true } = options;
    
    try {
      registerHelpers();

      const template = await this.getTemplate(templateIdentifier);
      
      if (!template || !template.is_active) {
        if (useFallback) {
          return await this.sendWithFallback(recipient, templateIdentifier, data);
        }
        throw new Error(`Email template ${templateIdentifier} not found or inactive`);
      }

      // ✅ VALIDATE REQUIRED VARIABLES for system templates
      if (template.is_system) {
        this.validateRequiredVariables(template, data);
      }

      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      await sendMailWithHtml(recipient, subject, html);

      const templateInfo = template.template_code || template.name || templateIdentifier;
      console.log(`✓ Email sent to ${recipient} using template ${templateInfo}`);

      return {
        success: true,
        message: 'Email sent successfully',
        method: 'database',
        template_code: template.template_code,
        template_id: template.id
      };
      
    } catch (error) {
      console.error(`✗ Email error (template ${templateIdentifier}):`, error.message);
      
      if (useFallback && !options.isRetry) {
        console.log(`  ↻ Attempting fallback...`);
        return await this.sendWithFallback(recipient, templateIdentifier, data);
      }
      
      throw error;
    }
  }

  /**
   * Send email using template ID or Code WITH attachments
   * @param {string} recipient - Email recipient
   * @param {number|string} templateIdentifier - Template ID or code
   * @param {Object} data - Template data
   * @param {Array} attachments - Email attachments
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Result object
   */
  static async sendWithTemplateAndAttachments(recipient, templateIdentifier, data, attachments = [], options = {}) {
    const { useFallback = true } = options;
    
    try {
      registerHelpers();

      const template = await this.getTemplate(templateIdentifier);
      
      if (!template || !template.is_active) {
        if (useFallback) {
          return await this.sendWithFallbackAndAttachments(recipient, templateIdentifier, data, attachments);
        }
        throw new Error(`Email template ${templateIdentifier} not found or inactive`);
      }

      // ✅ VALIDATE REQUIRED VARIABLES for system templates
      if (template.is_system) {
        this.validateRequiredVariables(template, data);
      }

      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      await sendMailWithHtml(recipient, subject, html, attachments);

      const templateInfo = template.template_code || template.name || templateIdentifier;
      console.log(`✓ Email sent to ${recipient} with ${attachments.length} attachment(s) using template ${templateInfo}`);

      return {
        success: true,
        message: 'Email sent successfully',
        method: 'database',
        template_code: template.template_code,
        template_id: template.id
      };
      
    } catch (error) {
      console.error(`✗ Email error (template ${templateIdentifier}):`, error.message);
      
      if (useFallback && !options.isRetry) {
        console.log(`  ↻ Attempting fallback with attachments...`);
        return await this.sendWithFallbackAndAttachments(recipient, templateIdentifier, data, attachments);
      }
      
      throw error;
    }
  }

  /**
   * Fallback to physical HTML template (no attachments)
   */
  static async sendWithFallback(recipient, templateIdentifier, data) {
    try {
      // Determine template filename from identifier
      let templateFilename;
      
      if (typeof templateIdentifier === 'number') {
        templateFilename = TEMPLATE_FALLBACK_MAP[templateIdentifier];
      } else if (typeof templateIdentifier === 'string') {
        // If it's already a template code, use it directly
        templateFilename = templateIdentifier;
        
        // Or try to find it in the fallback map
        const numId = parseInt(templateIdentifier);
        if (!isNaN(numId) && TEMPLATE_FALLBACK_MAP[numId]) {
          templateFilename = TEMPLATE_FALLBACK_MAP[numId];
        }
      }
      
      if (!templateFilename) {
        throw new Error(`No fallback template mapping for identifier ${templateIdentifier}`);
      }
      
      console.log(`  ℹ️  Using fallback: ${templateFilename}.html`);
      
      const subject = this.generateFallbackSubject(templateFilename, data);
      await SendEmail(recipient, subject, templateFilename, data);
      
      console.log(`✓ Email sent using fallback template ${templateFilename}`);
      
      return {
        success: true,
        message: 'Email sent using fallback',
        method: 'fallback',
        template: templateFilename
      };
      
    } catch (fallbackError) {
      console.error(`✗ Fallback also failed:`, fallbackError.message);
      throw new Error(`Failed to send email: Database and fallback both failed`);
    }
  }

  /**
   * Fallback to physical HTML template WITH attachments
   */
  static async sendWithFallbackAndAttachments(recipient, templateIdentifier, data, attachments) {
    try {
      // Determine template filename from identifier
      let templateFilename;
      
      if (typeof templateIdentifier === 'number') {
        templateFilename = TEMPLATE_FALLBACK_MAP[templateIdentifier];
      } else if (typeof templateIdentifier === 'string') {
        templateFilename = templateIdentifier;
        
        const numId = parseInt(templateIdentifier);
        if (!isNaN(numId) && TEMPLATE_FALLBACK_MAP[numId]) {
          templateFilename = TEMPLATE_FALLBACK_MAP[numId];
        }
      }
      
      if (!templateFilename) {
        throw new Error(`No fallback template mapping for identifier ${templateIdentifier}`);
      }
      
      console.log(`  ℹ️  Using fallback: ${templateFilename}.html with ${attachments.length} attachment(s)`);
      
      const subject = this.generateFallbackSubject(templateFilename, data);
      await SendEmail(recipient, subject, templateFilename, data, attachments);
      
      console.log(`✓ Email sent using fallback template ${templateFilename} with attachments`);
      
      return {
        success: true,
        message: 'Email sent using fallback',
        method: 'fallback',
        template: templateFilename
      };
      
    } catch (fallbackError) {
      console.error(`✗ Fallback also failed:`, fallbackError.message);
      throw new Error(`Failed to send email: Database and fallback both failed`);
    }
  }

  /**
   * Generate fallback subject lines
   */
  static generateFallbackSubject(templateFilename, data) {
    const subjectMap = {
      'booking-summary': 'Summary of Your Stay - Sargood on Collaroy',
      'guest-profile-email': 'Your Guest Profile - Sargood on Collaroy',
      'guest-profile': 'Your Guest Profile - Sargood on Collaroy',
      'course-eoi-confirmation': 'Expression of Interest Received',
      'course-eoi-admin': 'New Course EOI Received',
      'course-eoi-accepted': 'Course Interest Accepted',
      'course-offer-accepted': 'Course Offer Accepted',
      'icare-nights-update': `iCare Funding Update - ${data.guest_name || 'Guest'}`,
      'password-reset': 'Reset Your Password',
      'email-verification': 'Verify Your Email Address',
      'welcome-email': 'Welcome to Sargood on Collaroy',
      'booking-approved': 'Sargood On Collaroy - Booking Enquiry',
      'booking-declined': 'Sargood On Collaroy - Booking Enquiry',
      'booking-confirmed': 'Sargood On Collaroy - Booking Confirmed',
      'booking-confirmed-admin': 'Sargood On Collaroy - Booking Confirmed',
      'booking-cancelled': 'Sargood On Collaroy - Booking Enquiry',
      'booking-cancelled-admin': 'Sargood On Collaroy - Booking Enquiry',
      'booking-guest-cancellation-request': 'Sargood On Collaroy - Cancellation Request',
      'booking-guest-cancellation-request-admin': 'Sargood On Collaroy - Cancellation Request'
    };
    
    return subjectMap[templateFilename] || 'Email Notification';
  }

  /**
   * Check if template exists and is active
   */
  static async isTemplateActive(templateIdentifier) {
    const template = await this.getTemplate(templateIdentifier);
    return template && template.is_active;
  }

  /**
   * Check if template is a system template
   */
  static async isSystemTemplate(templateIdentifier) {
    const template = await this.getTemplate(templateIdentifier);
    return template && template.is_system;
  }

  /**
   * Get template info (useful for debugging)
   */
  static async getTemplateInfo(templateIdentifier) {
    const template = await this.getTemplate(templateIdentifier);
    if (!template) {
      return null;
    }

    return {
      id: template.id,
      name: template.name,
      template_code: template.template_code,
      is_system: template.is_system,
      is_active: template.is_active,
      required_variables: template.required_variables,
      extracted_variables: template.extractVariables ? template.extractVariables() : []
    };
  }
}

export default EmailService;