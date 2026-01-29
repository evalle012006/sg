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
   * Send email using template ID (no attachments)
   */
  static async sendWithTemplate(recipient, templateId, data, options = {}) {
    const { useFallback = true } = options;
    
    try {
      registerHelpers();

      const template = await EmailTemplate.findByPk(templateId);
      
      if (!template || !template.is_active) {
        if (useFallback) {
          return await this.sendWithFallback(recipient, templateId, data);
        }
        throw new Error(`Email template ${templateId} not found or inactive`);
      }

      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      await sendMailWithHtml(recipient, subject, html);

      console.log(`✓ Email sent to ${recipient} using template ${templateId} (${template.name})`);

      return {
        success: true,
        message: 'Email sent successfully',
        method: 'database'
      };
      
    } catch (error) {
      console.error(`✗ Email error (template ${templateId}):`, error.message);
      
      if (useFallback && !options.isRetry) {
        console.log(`  ↻ Attempting fallback...`);
        return await this.sendWithFallback(recipient, templateId, data);
      }
      
      throw error;
    }
  }

  /**
   * Send email using template ID WITH attachments
   */
  static async sendWithTemplateAndAttachments(recipient, templateId, data, attachments = [], options = {}) {
    const { useFallback = true } = options;
    
    try {
      registerHelpers();

      const template = await EmailTemplate.findByPk(templateId);
      
      if (!template || !template.is_active) {
        if (useFallback) {
          return await this.sendWithFallbackAndAttachments(recipient, templateId, data, attachments);
        }
        throw new Error(`Email template ${templateId} not found or inactive`);
      }

      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      await sendMailWithHtml(recipient, subject, html, attachments);

      console.log(`✓ Email sent to ${recipient} with ${attachments.length} attachment(s) using template ${templateId}`);

      return {
        success: true,
        message: 'Email sent successfully',
        method: 'database'
      };
      
    } catch (error) {
      console.error(`✗ Email error (template ${templateId}):`, error.message);
      
      if (useFallback && !options.isRetry) {
        console.log(`  ↻ Attempting fallback with attachments...`);
        return await this.sendWithFallbackAndAttachments(recipient, templateId, data, attachments);
      }
      
      throw error;
    }
  }

  /**
   * Fallback to physical HTML template (no attachments)
   */
  static async sendWithFallback(recipient, templateId, data) {
    try {
      // ✅ CHANGED: Use the imported TEMPLATE_FALLBACK_MAP
      const templateFilename = TEMPLATE_FALLBACK_MAP[templateId];
      
      if (!templateFilename) {
        throw new Error(`No fallback template mapping for ID ${templateId}`);
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
  static async sendWithFallbackAndAttachments(recipient, templateId, data, attachments) {
    try {
      // ✅ CHANGED: Use the imported TEMPLATE_FALLBACK_MAP
      const templateFilename = TEMPLATE_FALLBACK_MAP[templateId];
      
      if (!templateFilename) {
        throw new Error(`No fallback template mapping for ID ${templateId}`);
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
      'booking-cancelled-admin': 'Sargood On Collaroy - Booking Enquiry'
    };
    
    return subjectMap[templateFilename] || 'Email Notification';
  }

  /**
   * Get template by ID
   */
  static async getTemplate(templateId) {
    return await EmailTemplate.findByPk(templateId);
  }

  /**
   * Check if template exists and is active
   */
  static async isTemplateActive(templateId) {
    const template = await EmailTemplate.findByPk(templateId);
    return template && template.is_active;
  }
}

export default EmailService;