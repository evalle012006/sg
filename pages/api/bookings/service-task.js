import { Booking } from "../../../models";
import { BookingService } from "../../../services/booking/booking";
import moment from "moment";
import EmailTriggerService from "../../../services/booking/emailTriggerService";
import EmailService from '../../../services/booking/emailService';

export default async function handler(req, res) {

    // ✅ Allow local development tasks
    const isLocalTask = req.headers['x-local-task'] === 'true';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment || isLocalTask) {
        console.log('🏠 Processing local development task');
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { type, payload } = req.body;

    const bookingService = new BookingService();
    const booking = await Booking.findOne({ where: { id: payload.booking_id } });
    let bookingMetainfo = JSON.parse(booking.metainfo);
    switch (type) {
        case 'desseminateChanges':
            console.log('running background task: desseminateChanges');
            bookingService.disseminateChanges(booking, payload.data);
            break;
        case 'triggerEmails':
            console.log('running background task: triggerEmails');
            if (bookingMetainfo.triggered_emails) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const emailsTriggered = await bookingService.triggerEmails(booking);

            if (emailsTriggered) {
                bookingMetainfo.triggered_emails = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('emailsTriggered', booking);
            } else {
                console.log('emailsTriggered ERROR', emailsTriggered, payload);
                return res.status(400).json({ success: false, message: 'Error triggering emails' });
            }
            break;
        case 'triggerEmailsOnSubmit':
            console.log('running background task: triggerEmailsOnSubmit');
            if (bookingMetainfo.triggered_emails.on_submit) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const emailsTriggeredOnSubmit = await bookingService.triggerEmailsOnSubmit(booking);

            if (emailsTriggeredOnSubmit) {
                bookingMetainfo.triggered_emails.on_submit = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('emailsTriggeredOnSubmit', booking);
            } else {
                console.log('emailsTriggeredOnSubmit ERROR', emailsTriggeredOnSubmit, payload);
                return res.status(400).json({ success: false, message: 'Error triggering emails' });
            }
            break;
        case 'triggerEmailsOnBookingConfirmed':
            console.log('running background task: triggerEmailsOnBookingConfirmed');
            if (bookingMetainfo.triggered_emails.on_booking_confirmed) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const emailsTriggeredOnBookingConfirmed = await bookingService.triggerEmailsOnBookingConfirmed(booking);

            if (emailsTriggeredOnBookingConfirmed) {
                bookingMetainfo.triggered_emails.on_booking_confirmed = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('emailsTriggeredOnBookingConfirmed', booking);
            } else {
                console.log('emailsTriggeredOnBookingConfirmed ERROR', emailsTriggeredOnBookingConfirmed, payload);
                return res.status(400).json({ success: false, message: 'Error triggering emails' });
            }
            break;
        case 'generatePDFExport':
            console.log('running background task: generatePDFExport', booking.uuid);
            if (bookingMetainfo.pdf_export && moment().utc().isSameOrBefore(moment(booking.updatedAt).utc().add(30, 'seconds'))) {
                return res.status(200).json({ success: false, message: 'PDF already exported, try again in some time' });
            }

            const pdfExported = await bookingService.generatePDFExport(booking);

            if (pdfExported) {
                bookingMetainfo.pdf_export = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
            }
            break;
        case 'sendDatesOfStayEmail':
            console.log('running background task: sendDatesOfStayEmail');
            if (bookingMetainfo?.sendDatesOfStayEmail?.sent) {
                console.log('Dates of Stay Email already sent', bookingMetainfo?.sendDatesOfStayEmail);
                return res.status(200).json({ success: false, message: 'Dates of Stay Email already sent' });
            }

            if (booking.complete) {
                console.log('Booking is complete, not sending Dates of Stay Email');
                return res.status(200).json({ success: false, message: 'Booking is complete, not sending Dates of Stay Email' });
            }

            if (!bookingMetainfo.hasOwnProperty("sendDatesOfStayEmail")) {
                bookingMetainfo.sendDatesOfStayEmail = { sent: false };
            }

            const emailDateOfStay = await bookingService.sendEmailDateOfStay(booking);

            if (emailDateOfStay) {
                bookingMetainfo.sendDatesOfStayEmail.sent = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('sendDatesOfStayEmail', booking);
            } else {
                console.log('sendDatesOfStayEmail ERROR', emailDateOfStay, payload);
                return res.status(400).json({ success: false, message: 'Error triggering sendDatesOfStayEmail' });
            }
            break;
        case 'evaluateEmailTriggers': {
            console.log(`\n🔄 Processing email triggers for booking ${payload.booking_id}...`);
            
            const result = await EmailTriggerService.evaluateAndSendTriggers(
                payload.booking_id,
                {
                    enabled: true,  // ✅ Explicitly filter for enabled triggers only
                    context: payload.context || 'default'
                }
            );
            
            console.log(`✅ Email trigger evaluation complete: ${result.queued} queued, ${result.skipped} skipped`);
            
            return res.status(200).json({ 
                success: true, 
                result 
            });
        }
        
        case 'sendTriggerEmail': {
            console.log('📧 Sending trigger email...');
            console.log('   Recipient:', payload.recipient);
            console.log('   Template ID:', payload.templateId);
            
            try {
                const { recipient, templateId, emailData } = payload;
                
                if (!EmailService) {
                    throw new Error('EmailService not found - check import path');
                }
                
                console.log('   Sending email with EmailService.sendWithTemplate...');
                
                // EmailService.sendWithTemplate(recipient, templateIdentifier, data, options)
                await EmailService.sendWithTemplate(
                    recipient,
                    templateId,  // Can be template ID (number) or template_code (string)
                    emailData,
                    { useFallback: true }  // Enable fallback to physical templates if DB template fails
                );
                
                console.log('✅ Email sent successfully to', recipient);
                
                return res.status(200).json({ 
                    success: true,
                    message: `Email sent to ${recipient}`
                });
                
            } catch (error) {
                console.error('❌ Error sending trigger email:', error);
                console.error('   Error details:', {
                    message: error.message,
                    stack: error.stack
                });
                
                return res.status(500).json({ 
                    success: false, 
                    error: error.message 
                });
            }
        }
        default:
            break;

    }

    return res.status(201).json({ success: true });
}
