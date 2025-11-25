const nodemailer = require('nodemailer');
const { Setting } = require('../models');
const { Op } = require('sequelize');

// Create a singleton transporter to reuse connections
let transporter = null;
let emailQueue = [];
let processing = false;
let maxConcurrent = 5;

// ✨ NEW: Rate limiting configuration
let rateLimitConfig = {
  enabled: true,
  delayBetweenEmails: 1000,      // 1 second between emails (safe for Mailtrap free tier)
  delayBetweenBatches: 2000,     // 2 seconds between batches
  maxRetriesOnRateLimit: 3       // Retry 3 times if rate limited
};

// ✨ NEW: Development mode (logs instead of sending)
let isDevelopmentMode = process.env.NODE_ENV === 'development' || process.env.MAIL_DEV_MODE === 'true';

/**
 * ✨ NEW: Set development mode
 * When enabled, emails are logged but not sent (useful for testing triggers)
 */
const setDevelopmentMode = (enabled) => {
  isDevelopmentMode = enabled;
  console.log(`📧 Mail service development mode: ${enabled ? 'ENABLED (emails will be logged, not sent)' : 'DISABLED'}`);
};

/**
 * ✨ NEW: Configure rate limiting
 */
const configureRateLimiting = (config) => {
  rateLimitConfig = { ...rateLimitConfig, ...config };
  console.log('⚙️ Rate limiting configured:', rateLimitConfig);
};

// Initialize the transporter
const initializeTransporter = async () => {
  if (transporter) return transporter;
  
  const mailSettings = await Setting.findAll({
    where: {
      attribute: {
        [Op.in]: ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_SENDER_EMAIL', 'MAIL_MAX_CONCURRENT_EMAILS']
      }
    }
  });

  let mailHost = process.env.MAIL_HOST;
  let mailPort = process.env.MAIL_PORT;
  let mailUsername = process.env.MAIL_USER;
  let mailPassword = process.env.MAIL_PASSWORD;
  let senderEmail = process.env.MAIL_SENDER_EMAIL;
  maxConcurrent = process.env.MAIL_MAX_CONCURRENT_EMAILS || 5;

  // Update mail settings from database if available
  mailSettings.forEach((setting) => {
    switch (setting.attribute) {
      case 'MAIL_HOST': mailHost = setting.value || mailHost; break;
      case 'MAIL_PORT': mailPort = setting.value || mailPort; break;
      case 'MAIL_USER': mailUsername = setting.value || mailUsername; break;
      case 'MAIL_PASSWORD': mailPassword = setting.value || mailPassword; break;
      case 'MAIL_SENDER_EMAIL': senderEmail = setting.value || senderEmail; break;
      case 'MAIL_MAX_CONCURRENT_EMAILS': maxConcurrent = setting.value || maxConcurrent; break;
    }
  });

  // ✨ UPDATED: Better connection pooling settings for rate limit compliance
  transporter = nodemailer.createTransport({
    host: mailHost,
    port: mailPort,
    secure: false,
    auth: {
      user: mailUsername,
      pass: mailPassword,
    },
    tls: {
      rejectUnauthorized: false
    },
    pool: true,
    maxConnections: 1,
    rateDelta: rateLimitConfig.delayBetweenEmails,
    rateLimit: 1,
  });
  
  return transporter;
};

/**
 * ✨ NEW: Sleep utility for delays
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * ✨ ENHANCED: Process the email queue with better rate limiting
 */
const processQueue = async () => {
  if (processing || emailQueue.length === 0) return;
  
  processing = true;
  
  try {
    console.log(`📬 Processing email queue (${emailQueue.length} emails pending)...`);
    
    // ✨ DEVELOPMENT MODE: Just log and resolve
    if (isDevelopmentMode) {
      console.log('\n🧪 DEVELOPMENT MODE - Emails will be logged, not sent:\n');
      
      while (emailQueue.length > 0) {
        const item = emailQueue.shift();
        
        console.log('─'.repeat(60));
        console.log('📧 EMAIL (DEV MODE - NOT SENT)');
        console.log('─'.repeat(60));
        console.log(`To: ${item.mailOptions.to}`);
        console.log(`From: ${item.mailOptions.from}`);
        console.log(`Subject: ${item.mailOptions.subject}`);
        console.log(`HTML Content Length: ${item.mailOptions.html?.length || 0} characters`);
        console.log('─'.repeat(60));
        console.log('✅ Logged successfully (not sent)\n');
        
        // Resolve the promise
        item.resolve({ 
          accepted: [item.mailOptions.to],
          rejected: [],
          messageId: 'dev-mode-' + Date.now(),
          devMode: true
        });
        
        // Small delay between logs to avoid console spam
        await sleep(100);
      }
      
      processing = false;
      return;
    }
    
    // ✨ PRODUCTION MODE: Send emails with rate limiting
    const transport = await initializeTransporter();
    
    // Process emails ONE AT A TIME with delays
    while (emailQueue.length > 0) {
      const item = emailQueue.shift();
      
      try {
        console.log(`📤 Sending email to ${item.mailOptions.to}...`);
        
        const result = await transport.sendMail(item.mailOptions);
        
        console.log(`✅ Email sent successfully to ${item.mailOptions.to}`);
        item.resolve(result);
        
        // ✨ IMPORTANT: Delay between emails to respect rate limits
        if (emailQueue.length > 0 && rateLimitConfig.enabled) {
          console.log(`⏳ Waiting ${rateLimitConfig.delayBetweenEmails}ms before next email...`);
          await sleep(rateLimitConfig.delayBetweenEmails);
        }
        
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimitError = error.message && (
          error.message.includes('Too many emails') ||
          error.message.includes('rate limit') ||
          error.message.includes('Concurrent connections limit exceeded')
        );
        
        if (isRateLimitError && item.retries < rateLimitConfig.maxRetriesOnRateLimit) {
          // Retry with exponential backoff
          item.retries = (item.retries || 0) + 1;
          const backoffDelay = rateLimitConfig.delayBetweenEmails * Math.pow(2, item.retries);
          
          console.log(`⚠️ Rate limit hit, retrying in ${backoffDelay}ms (attempt ${item.retries}/${rateLimitConfig.maxRetriesOnRateLimit})...`);
          
          // Put back in queue after delay
          setTimeout(() => {
            emailQueue.push(item);
            processQueue();
          }, backoffDelay);
          
        } else {
          // Permanent failure or max retries reached
          console.error(`❌ Failed to send email to ${item.mailOptions.to}:`, error.message);
          item.reject(error);
        }
      }
    }
    
    processing = false;
    console.log('✓ Email queue processing complete\n');
    
  } catch (error) {
    console.error('Error processing email queue:', error);
    processing = false;
  }
};

/**
 * Send mail with direct HTML content (no template file)
 * Uses connection pooling and rate limiting
 * 
 * ✨ ENHANCED: Now respects rate limits and supports dev mode
 * 
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - Direct HTML content
 * @param {Array} attachments - Optional array of attachment objects
 * @returns {Promise}
 */
const sendMailWithHtml = async (to, subject, html, attachments = []) => {
  // Initialize the transport if needed (but won't be used in dev mode)
  if (!isDevelopmentMode) {
    await initializeTransporter();
  }
  
  const senderEmail = process.env.MAIL_SENDER_EMAIL;
  
  const mailOptions = {
    from: senderEmail,
    to: to,
    subject: subject,
    html: html,
    attachments: attachments
  };

  // Create a promise that will be resolved when the email is sent (or logged in dev mode)
  return new Promise((resolve, reject) => {
    emailQueue.push({
      mailOptions,
      resolve,
      reject,
      retries: 0
    });
    
    // Start processing the queue if not already running
    processQueue();
  });
};

/**
 * ✨ NEW: Get queue status (useful for monitoring)
 */
const getQueueStatus = () => {
  return {
    queueLength: emailQueue.length,
    processing: processing,
    developmentMode: isDevelopmentMode,
    rateLimitConfig: rateLimitConfig
  };
};

/**
 * ✨ NEW: Clear the queue (useful for testing)
 */
const clearQueue = () => {
  const clearedCount = emailQueue.length;
  emailQueue = [];
  console.log(`🗑️ Cleared ${clearedCount} emails from queue`);
  return clearedCount;
};

module.exports = sendMailWithHtml;
module.exports.sendMailWithHtml = sendMailWithHtml;
module.exports.setDevelopmentMode = setDevelopmentMode;
module.exports.configureRateLimiting = configureRateLimiting;
module.exports.getQueueStatus = getQueueStatus;
module.exports.clearQueue = clearQueue;


// ✨ AUTO-INITIALIZE on first import
(function autoInit() {
  const isDevelopment = process.env.NODE_ENV === 'development';
  const devModeEnabled = process.env.MAIL_DEV_MODE === 'true';
  
  if (isDevelopment || devModeEnabled) {
    setDevelopmentMode(true);
    console.log('📧 Email dev mode: ENABLED (emails will be logged, not sent)');
  } else {
    setDevelopmentMode(false);
    console.log('📧 Email dev mode: DISABLED (emails will be sent)');
  }
  
  // Configure rate limiting from env
  const rateLimitConfig = {
    enabled: true,
    delayBetweenEmails: parseInt(process.env.MAIL_RATE_LIMIT_DELAY) || 1000,
    delayBetweenBatches: parseInt(process.env.MAIL_BATCH_DELAY) || 2000,
    maxRetriesOnRateLimit: parseInt(process.env.MAIL_MAX_RETRIES) || 3
  };
  
  configureRateLimiting(rateLimitConfig);
  console.log(`📧 Rate limit delay: ${rateLimitConfig.delayBetweenEmails}ms between emails`);
})();