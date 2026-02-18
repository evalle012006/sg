import { Booking, Guest } from "../../../models";
import { BookingService } from "../../../services/booking/booking";
import moment from "moment";
import EmailTriggerService from "../../../services/booking/emailTriggerService";
import EmailService from '../../../services/booking/emailService';
import { OAuth2Client } from 'google-auth-library';

const authClient = new OAuth2Client();

export default async function handler(req, res) {
    // ✅ Allow local development tasks (bypass auth)
    const isLocalTask = req.headers['x-local-task'] === 'true';
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment || isLocalTask) {
        console.log('🏠 Processing local development task (auth bypassed)');
    } else {
        // ✅ Verify OIDC token from Cloud Tasks in production
        const authHeader = req.headers.authorization;
        
        if (!authHeader?.startsWith('Bearer ')) {
            console.error('❌ Missing or invalid Authorization header');
            console.error('   Headers:', JSON.stringify(req.headers, null, 2));
            return res.status(401).json({ message: 'Unauthorized - Missing Bearer token' });
        }

        try {
            const token = authHeader.split('Bearer ')[1];
            const audience = `${process.env.APP_URL}/api/bookings/service-task`;
            
            console.log('🔐 Verifying OIDC token...');
            console.log('   Audience:', audience);
            
            // Verify the token
            const ticket = await authClient.verifyIdToken({
                idToken: token,
                audience: audience,
            });
            
            const payload = ticket.getPayload();
            console.log('✅ Authenticated request from:', payload.email);
            
        } catch (error) {
            console.error('❌ Token verification failed:', error.message);
            console.error('   Error details:', error);
            return res.status(401).json({ 
                message: 'Unauthorized - Invalid token',
                error: error.message 
            });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { type, payload } = req.body;
    
    switch (type) {
        case 'desseminateChanges': {
            console.log('running background task: desseminateChanges');
            const bookingService = new BookingService();
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            bookingService.disseminateChanges(booking, payload.data);
            break;
        }
            
        case 'triggerEmails': {
            console.log('running background task: triggerEmails');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            
            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
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
        }
            
        case 'triggerEmailsOnSubmit': {
            console.log('running background task: triggerEmailsOnSubmit');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            
            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails.on_submit) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
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
        }
            
        case 'triggerEmailsOnBookingConfirmed': {
            console.log('running background task: triggerEmailsOnBookingConfirmed');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            
            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails.on_booking_confirmed) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
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
        }
            
        case 'generatePDFExport': {
            console.log('running background task: generatePDFExport');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            
            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.pdf_export && moment().utc().isSameOrBefore(moment(booking.updatedAt).utc().add(30, 'seconds'))) {
                return res.status(200).json({ success: false, message: 'PDF already exported, try again after 30 seconds' });
            }

            const bookingService = new BookingService();
            await bookingService.generatePDFExport(booking);
            
            bookingMetainfo.pdf_export = true;
            booking.metainfo = JSON.stringify(bookingMetainfo);
            await booking.save();
            break;
        }
            
        case 'evaluateEmailTriggers': {
            console.log('📧 Evaluating email triggers for booking...');
            
            const result = await EmailTriggerService.evaluateAndSendTriggers(
                payload.booking_id,
                {
                    enabled: true,
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
                const { recipient, templateId, emailData } = payload || {};

                if (!recipient || !templateId || !emailData) {
                    console.error('❌ Missing required fields:', { recipient, templateId, hasEmailData: !!emailData });
                    return res.status(400).json({ 
                        success: false, 
                        error: 'Missing required fields (recipient, templateId, or emailData)' 
                    });
                }
                
                // ✅ ADD EMAIL VALIDATION
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(recipient)) {
                    console.error('❌ Invalid email address:', recipient);
                    return res.status(400).json({ 
                        success: false, 
                        error: `Invalid email address: ${recipient}. Check trigger recipient_field configuration.` 
                    });
                }
                
                if (!EmailService) {
                    throw new Error('EmailService not found - check import path');
                }
                
                console.log('   Sending email with EmailService.sendWithTemplate...');
                
                await EmailService.sendWithTemplate(
                    recipient,
                    templateId,
                    emailData,
                    { useFallback: true }
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

        case 'sendDatesOfStayEmail': {
            console.log('running background task: sendDatesOfStayEmail');
            
            // Fetch booking with guest data only (no need for sections/questions with new email service)
            const booking = await Booking.findOne({ 
                where: { id: payload.booking_id },
                include: [Guest]
            });
            
            if (!booking) {
                return res.status(404).json({ message: 'Booking not found' });
            }
            
            let bookingMetainfo = JSON.parse(booking.metainfo || '{}');
            
            // Check if already sent
            if (bookingMetainfo?.sendDatesOfStayEmail?.sent) {
                console.log('Dates of Stay Email already sent', bookingMetainfo?.sendDatesOfStayEmail);
                return res.status(200).json({ success: false, message: 'Dates of Stay Email already sent' });
            }
            
            // Check if booking is complete
            if (booking.complete) {
                console.log('Booking is complete, not sending Dates of Stay Email');
                return res.status(200).json({ success: false, message: 'Booking is complete, not sending Dates of Stay Email' });
            }
            
            // Initialize sendDatesOfStayEmail if not exists
            if (!bookingMetainfo.hasOwnProperty('sendDatesOfStayEmail')) {
                bookingMetainfo.sendDatesOfStayEmail = { sent: false };
            }
            
            const guest = booking.Guest;
            if (!guest?.email) {
                console.error('❌ No guest email found for booking', booking.id);
                return res.status(400).json({ success: false, message: 'No guest email found for booking' });
            }
            
            // Format date range from booking arrival/departure dates
            const arrivalDate = moment(booking.arrival_date).format('D MMMM YYYY');
            const departureDate = moment(booking.departure_date).format('D MMMM YYYY');
            const dateOfStay = `${arrivalDate} – ${departureDate}`;
            
            const guestName = `${guest.first_name} ${guest.last_name}`.trim();
            
            try {
                await EmailService.sendWithTemplate(
                    guest.email,
                    22, // TEMPLATE_IDS.BOOKING_NOTIFY_DATE_OF_STAY
                    {
                        guest_name: guestName,
                        dateOfStay,
                    },
                    { useFallback: true }
                );
                
                bookingMetainfo.sendDatesOfStayEmail.sent = true;
                booking.metainfo = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('✅ sendDatesOfStayEmail sent successfully', booking.id);
                
            } catch (error) {
                console.error('❌ sendDatesOfStayEmail ERROR', error.message, payload);
                return res.status(500).json({ success: false, message: 'Error sending sendDatesOfStayEmail', error: error.message });
            }
            
            break;
        }
            
        default:
            return res.status(400).json({ message: 'Unknown task type' });
    }

    return res.status(201).json({ success: true });
}