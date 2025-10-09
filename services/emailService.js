const { EmailTemplate } = require('../models');
const SendEmail = require('../utilities/mail');
const handlebars = require('handlebars');

/**
 * Register Handlebars helpers for email templates
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
  handlebars.registerHelper('or', function() {
    return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
  });
  handlebars.registerHelper('and', function() {
    return Array.prototype.slice.call(arguments, 0, -1).every(Boolean);
  });

  // String helpers
  handlebars.registerHelper('uppercase', str => str ? str.toUpperCase() : '');
  handlebars.registerHelper('lowercase', str => str ? str.toLowerCase() : '');
  handlebars.registerHelper('capitalize', function(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  // Array helpers
  handlebars.registerHelper('length', arr => Array.isArray(arr) ? arr.length : 0);
  
  // Default value helper
  handlebars.registerHelper('default', (value, defaultValue) => value || defaultValue);
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

      // Send email using existing mail utility with direct HTML
      await SendEmail(recipient, subject, null, null, [], html);

      console.log(`✓ Email sent successfully to ${recipient} using template ${templateId}`);

      return {
        success: true,
        message: 'Email sent successfully',
        recipient,
        template_id: templateId
      };
    } catch (error) {
      console.error('Error sending email with template:', error);
      throw error;
    }
  }

  /**
   * Send email using legacy template system (for backward compatibility)
   * @param {string} recipient 
   * @param {string} subject 
   * @param {string} templateName 
   * @param {object} data 
   * @returns {Promise<object>}
   */
  static async sendWithLegacyTemplate(recipient, subject, templateName, data) {
    try {
      await SendEmail(recipient, subject, templateName, data);
      
      console.log(`✓ Email sent successfully to ${recipient} using legacy template ${templateName}`);
      
      return {
        success: true,
        message: 'Email sent successfully (legacy)',
        recipient,
        template_name: templateName
      };
    } catch (error) {
      console.error('Error sending email with legacy template:', error);
      throw error;
    }
  }

  /**
   * Preview template with sample data
   * @param {number} templateId 
   * @param {object} data 
   * @returns {Promise<object>}
   */
  static async previewTemplate(templateId, data) {
    try {
      registerHelpers();

      const template = await EmailTemplate.findByPk(templateId);
      
      if (!template) {
        throw new Error(`Email template ${templateId} not found`);
      }

      const compiledSubject = handlebars.compile(template.subject);
      const compiledHtml = handlebars.compile(template.html_content);

      const subject = compiledSubject(data);
      const html = compiledHtml(data);

      return {
        success: true,
        subject,
        html
      };
    } catch (error) {
      console.error('Error previewing template:', error);
      throw error;
    }
  }

  /**
   * Validate template syntax
   * @param {string} htmlContent 
   * @param {string} subject 
   * @returns {object}
   */
  static validateTemplate(htmlContent, subject) {
    const errors = [];

    try {
      // Try to compile subject
      handlebars.compile(subject);
    } catch (error) {
      errors.push({
        field: 'subject',
        message: `Invalid Handlebars syntax in subject: ${error.message}`
      });
    }

    try {
      // Try to compile HTML
      handlebars.compile(htmlContent);
    } catch (error) {
      errors.push({
        field: 'html_content',
        message: `Invalid Handlebars syntax in content: ${error.message}`
      });
    }

    // Check for unclosed tags
    const openTags = (htmlContent.match(/{{/g) || []).length;
    const closeTags = (htmlContent.match(/}}/g) || []).length;
    
    if (openTags !== closeTags) {
      errors.push({
        field: 'html_content',
        message: 'Unclosed Handlebars tags detected'
      });
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

module.exports = EmailService;