import * as nodemailer from 'nodemailer';
import path from 'path';
import { Setting } from '../models';
import { Op } from 'sequelize';
import hbs from 'nodemailer-express-handlebars';

const options = {
  viewEngine: {
    extName: ".html",
    partialsDir: path.resolve('./templates/email'),
    defaultLayout: path.resolve('./templates/email/layout.html'),
  },
  viewPath: path.resolve('./templates/email'),
  extName: ".html",
};

// Create a singleton transporter to reuse connections
let transporter = null;
let emailQueue = [];
let processing = false;
let maxConcurrent = 5;

// Initialize the transporter
const initializeTransporter = async () => {
  if (transporter) return transporter;
  
  const mailSettings = await Setting.findAll({
    where: {
      attribute: {
        [Op.in]: ['MAIL_HOST', 'MAIL_PORT', 'MAIL_USER', 'MAIL_PASSWORD', 'MAIL_SENDER_EMAIL','MAIL_MAX_CONCURRENT_EMAILS']
      }
    }
  });

  let mailHost = process.env.MAIL_HOST;
  let mailPort = process.env.MAIL_PORT;
  let mailUsername = process.env.MAIL_USER;
  let mailPassword = process.env.MAIL_PASSWORD;
  let senderEmail = process.env.MAIL_SENDER_EMAIL;
  maxConcurrent = process.env.MAIL_MAX_CONCURRENT_EMAILS;

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
    maxConnections: maxConcurrent,
    rateDelta: 1000,
    rateLimit: 10,
  });

  transporter.use('compile', hbs(options));
  
  return transporter;
};

// Process the email queue
const processQueue = async () => {
  if (processing || emailQueue.length === 0) return;
  
  processing = true;
  
  try {
    const transport = await initializeTransporter();
    
    const batch = emailQueue.splice(0, maxConcurrent);
    
    // Send emails in parallel
    await Promise.all(batch.map(async (item) => {
      try {
        const result = await transport.sendMail(item.mailOptions);
        item.resolve(result);
      } catch (error) {
        // If we hit a rate limit, put the email back in the queue
        if (error.message && error.message.includes('Concurrent connections limit exceeded')) {
          console.log('Rate limit hit, requeueing email');
          emailQueue.push(item);
        } else {
          item.reject(error);
        }
      }
    }));
    
    // Allow some time before processing next batch to avoid rate limits
    setTimeout(() => {
      processing = false;
      processQueue();
    }, 1000);
  } catch (error) {
    console.error('Error processing email queue:', error);
    processing = false;
  }
};

/**
 * Send mail with rate limiting and connection pooling
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlFile - Name of the handlebars template file
 * @param {Object} htmlParams - Parameters for the handlebars template
 * @param {Array} attachments - Optional array of attachment objects
 * @returns {Promise}
 */
const sendMail = async (to, subject, htmlFile, htmlParams, attachments = []) => {
  // Initialize the transport if needed
  await initializeTransporter();
  
  const senderEmail = process.env.MAIL_SENDER_EMAIL;
  
  const mailOptions = {
    from: senderEmail,
    to: to,
    subject: subject,
    template: htmlFile,
    context: htmlParams,
    attachments: attachments
  };

  // Create a promise that will be resolved when the email is sent
  return new Promise((resolve, reject) => {
    emailQueue.push({
      mailOptions,
      resolve,
      reject
    });
    
    // Start processing the queue if not already running
    processQueue();
  });
};

export default sendMail;