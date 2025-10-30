const { EmailTemplate } = require('../../models');
const handlebars = require('handlebars');
const sendMailWithHtml = require('../../utilities/mailServiceHtml');

/**
 * Register Handlebars helpers for email templates
 * Enhanced with array/object formatting and conditional helpers
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
  handlebars.registerHelper('isEmpty', value => {
    if (!value) return true;
    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'object') return Object.keys(value).length === 0;
    return false;
  });
  handlebars.registerHelper('isNotEmpty', value => {
    if (!value) return false;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return Object.keys(value).length > 0;
    return true;
  });

  // Array formatting helpers
  handlebars.registerHelper('join', (arr, separator = ', ') => {
    if (!Array.isArray(arr)) return '';
    return arr.join(separator);
  });

  handlebars.registerHelper('first', arr => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr[0];
  });

  handlebars.registerHelper('last', arr => {
    if (!Array.isArray(arr) || arr.length === 0) return '';
    return arr[arr.length - 1];
  });

  // Object helpers
  handlebars.registerHelper('keys', obj => {
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.keys(obj);
  });

  handlebars.registerHelper('values', obj => {
    if (typeof obj !== 'object' || obj === null) return [];
    return Object.values(obj);
  });

  // JSON parse helper (for parsing stringified arrays/objects)
  handlebars.registerHelper('parseJSON', str => {
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
  handlebars.registerHelper('isObject', value => typeof value === 'object' && value !== null && !Array.isArray(value));

  // Math helpers
  handlebars.registerHelper('add', (a, b) => Number(a) + Number(b));
  handlebars.registerHelper('subtract', (a, b) => Number(a) - Number(b));
  handlebars.registerHelper('multiply', (a, b) => Number(a) * Number(b));
  handlebars.registerHelper('divide', (a, b) => Number(a) / Number(b));
  
  // Index helper for loops (to get 1-based index)
  handlebars.registerHelper('inc', value => Number(value) + 1);
}

class EmailService {
  /**
   * Send email using template ID
   * @param {string} recipient - Email recipient
   * @param {number} templateId - Email template ID
   * @param {object} data - Template data (merge tags)
   * @returns {Promise<object>}
   */
  static async sendWithTemplate(recipient, templateId, data) {
    try {
      // Register helpers if not already registered
      registerHelpers();

      // Fetch template
      const template = await EmailTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error(`Email template ${templateId} not found`);
      }

      if (!template.is_active) {
        throw new Error(`Email template ${templateId} is not active`);
      }

      // Compile handlebars template
      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      // Render with data
      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      // Send email using the new mailServiceHtml
      await sendMailWithHtml(recipient, subject, html);

      console.log(`✓ Email sent successfully to ${recipient} using template ${templateId}`);

      return {
        success: true,
        message: 'Email sent successfully'
      };
    } catch (error) {
      console.error('Email sending error:', error);
      throw error;
    }
  }
}

module.exports = EmailService;