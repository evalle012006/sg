// services/email/EmailRecipientsService.js
import { Setting } from '../../models';

/**
 * Email Recipients Service
 * Manages fetching email recipients from settings table with caching
 */
class EmailRecipientsService {
  constructor() {
    this.cache = {
      email_eoi_recipients: null,
      email_admin_recipients: null,
      email_info_recipients: null
    };
    this.cacheTimestamp = null;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Check if cache is still valid
   */
  isCacheValid() {
    if (!this.cacheTimestamp) return false;
    const now = Date.now();
    return (now - this.cacheTimestamp) < this.CACHE_TTL;
  }

  /**
   * Clear the cache (useful for testing or manual refresh)
   */
  clearCache() {
    this.cache = {
      email_eoi_recipients: null,
      email_admin_recipients: null,
      email_info_recipients: null
    };
    this.cacheTimestamp = null;
  }

  /**
   * Load all email recipients from settings
   * @returns {Promise<Object>} Object with eoi, admin, and info recipients
   */
  async loadAllRecipients() {
    try {
      const settings = await Setting.findAll({
        where: {
          attribute: ['email_eoi_recipients', 'email_admin_recipients', 'email_info_recipients']
        }
      });

      const recipients = {
        email_eoi_recipients: [],
        email_admin_recipients: [],
        email_info_recipients: []
      };

      settings.forEach(setting => {
        if (setting.value) {
          // Split comma-separated emails and clean them
          const emails = setting.value
            .split(',')
            .map(email => email.trim())
            .filter(email => email.length > 0);
          
          recipients[setting.attribute] = emails;
        }
      });

      // Update cache
      this.cache = recipients;
      this.cacheTimestamp = Date.now();

      return recipients;
    } catch (error) {
      console.error('Error loading email recipients from settings:', error);
      // Return empty arrays on error
      return {
        email_eoi_recipients: [],
        email_admin_recipients: [],
        email_info_recipients: []
      };
    }
  }

  /**
   * Get EOI email recipients
   * @param {boolean} useCache - Whether to use cached value (default: true)
   * @returns {Promise<string[]>} Array of email addresses
   */
  async getEOIRecipients(useCache = true) {
    if (useCache && this.isCacheValid() && this.cache.email_eoi_recipients) {
      return this.cache.email_eoi_recipients;
    }

    const recipients = await this.loadAllRecipients();
    return recipients.email_eoi_recipients || [];
  }

  /**
   * Get Admin email recipients
   * Falls back to ADMIN_EMAIL env variable if no settings found
   * @param {boolean} useCache - Whether to use cached value (default: true)
   * @returns {Promise<string[]>} Array of email addresses
   */
  async getAdminRecipients(useCache = true) {
    if (useCache && this.isCacheValid() && this.cache.email_admin_recipients) {
      return this.cache.email_admin_recipients;
    }

    const recipients = await this.loadAllRecipients();
    const adminRecipients = recipients.email_admin_recipients || [];

    // Fallback to env variable if no settings configured
    if (adminRecipients.length === 0 && process.env.ADMIN_EMAIL) {
      return [process.env.ADMIN_EMAIL];
    }

    return adminRecipients;
  }

  /**
   * Get Info email recipients
   * Falls back to INFO_EMAIL env variable if no settings found
   * @param {boolean} useCache - Whether to use cached value (default: true)
   * @returns {Promise<string[]>} Array of email addresses
   */
  async getInfoRecipients(useCache = true) {
    if (useCache && this.isCacheValid() && this.cache.email_info_recipients) {
      return this.cache.email_info_recipients;
    }

    const recipients = await this.loadAllRecipients();
    const infoRecipients = recipients.email_info_recipients || [];

    // Fallback to env variable if no settings configured
    if (infoRecipients.length === 0 && process.env.INFO_EMAIL) {
      return [process.env.INFO_EMAIL];
    }

    return infoRecipients;
  }

  /**
   * Get recipients as comma-separated string (for email TO field)
   * @param {'eoi'|'admin'|'info'} type - Type of recipients
   * @param {boolean} useCache - Whether to use cached value (default: true)
   * @returns {Promise<string>} Comma-separated email addresses
   */
  async getRecipientsString(type, useCache = true) {
    let recipients = [];

    switch (type) {
      case 'eoi':
        recipients = await this.getEOIRecipients(useCache);
        break;
      case 'admin':
        recipients = await this.getAdminRecipients(useCache);
        break;
      case 'info':
        recipients = await this.getInfoRecipients(useCache);
        break;
      default:
        throw new Error(`Invalid recipient type: ${type}`);
    }

    return recipients.join(', ');
  }

  /**
   * Validate that recipients exist for a given type
   * @param {'eoi'|'admin'|'info'} type - Type of recipients
   * @returns {Promise<boolean>} True if recipients exist
   */
  async hasRecipients(type) {
    const recipients = await this.getRecipientsString(type);
    return recipients.length > 0;
  }

  /**
   * Get all recipients at once
   * @param {boolean} useCache - Whether to use cached value (default: true)
   * @returns {Promise<Object>} Object with all recipient types
   */
  async getAllRecipients(useCache = true) {
    if (useCache && this.isCacheValid()) {
      return { ...this.cache };
    }

    return await this.loadAllRecipients();
  }
}

// Export singleton instance
export default new EmailRecipientsService();