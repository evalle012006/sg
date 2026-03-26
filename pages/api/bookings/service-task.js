import { Booking, EmailTemplate, EmailTrigger, Guest } from "../../../models";
import { BookingService } from "../../../services/booking/booking";
import moment from "moment";
import EmailTriggerService from "../../../services/booking/emailTriggerService";
import EmailService from '../../../services/booking/emailService';
import { OAuth2Client } from 'google-auth-library';
import BookingEmailDataService from "../../../services/booking/BookingEmailDataService";

const authClient = new OAuth2Client();

export default async function handler(req, res) {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const isLocalTask   = req.headers['x-local-task'] === 'true';
    const isDevelopment = process.env.NODE_ENV === 'development';

    if (isDevelopment || isLocalTask) {
        console.log('🏠 Processing local development task (auth bypassed)');
    } else {
        const authHeader = req.headers.authorization;

        if (!authHeader?.startsWith('Bearer ')) {
            console.error('❌ Missing or invalid Authorization header');
            console.error('   Headers:', JSON.stringify(req.headers, null, 2));
            return res.status(401).json({ message: 'Unauthorized - Missing Bearer token' });
        }

        try {
            const token    = authHeader.split('Bearer ')[1];
            const audience = `${process.env.APP_URL}/api/bookings/service-task`;

            console.log('🔐 Verifying OIDC token...');
            console.log('   Audience:', audience);

            const ticket  = await authClient.verifyIdToken({ idToken: token, audience });
            const payload = ticket.getPayload();
            console.log('✅ Authenticated request from:', payload.email);
        } catch (error) {
            console.error('❌ Token verification failed:', error.message);
            return res.status(401).json({ message: 'Unauthorized - Invalid token', error: error.message });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { type, payload } = req.body;

    switch (type) {
        // ── Existing tasks (unchanged) ────────────────────────────────────────

        case 'desseminateChanges': {
            console.log('running background task: desseminateChanges');
            const bookingService = new BookingService();
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) return res.status(404).json({ message: 'Booking not found' });
            bookingService.disseminateChanges(booking, payload.data);
            break;
        }

        case 'triggerEmails': {
            console.log('running background task: triggerEmails');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
            const emailsTriggered = await bookingService.triggerEmails(booking);

            if (emailsTriggered) {
                bookingMetainfo.triggered_emails = true;
                booking.metainfo   = JSON.stringify(bookingMetainfo);
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
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails.on_submit) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
            const emailsTriggeredOnSubmit = await bookingService.triggerEmailsOnSubmit(booking);

            if (emailsTriggeredOnSubmit) {
                bookingMetainfo.triggered_emails.on_submit = true;
                booking.metainfo   = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('emailsTriggeredOnSubmit', booking);
            } else {
                console.log('triggerEmailsOnSubmit ERROR', emailsTriggeredOnSubmit, payload);
                return res.status(400).json({ success: false, message: 'Error triggering emails' });
            }
            break;
        }

        case 'triggerEmailsOnBookingConfirmed': {
            console.log('running background task: triggerEmailsOnBookingConfirmed');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            let bookingMetainfo = JSON.parse(booking.metainfo);
            if (bookingMetainfo.triggered_emails.on_booking_confirmed) {
                return res.status(200).json({ success: false, message: 'Emails already triggered' });
            }

            const bookingService = new BookingService();
            const emailsTriggeredOnBookingConfirmed = await bookingService.triggerEmailsOnBookingConfirmed(booking);

            if (emailsTriggeredOnBookingConfirmed) {
                bookingMetainfo.triggered_emails.on_booking_confirmed = true;
                booking.metainfo   = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('triggerEmailsOnBookingConfirmed', booking);
            } else {
                console.log('triggerEmailsOnBookingConfirmed ERROR', emailsTriggeredOnBookingConfirmed, payload);
                return res.status(400).json({ success: false, message: 'Error triggering emails' });
            }
            break;
        }

        case 'generatePDFExport': {
            console.log('running background task: generatePDFExport');
            const booking = await Booking.findOne({ where: { id: payload.booking_id } });
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

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

        case 'sendDatesOfStayEmail': {
            console.log('running background task: sendDatesOfStayEmail');
            const booking = await Booking.findOne({
                where: { id: payload.booking_id },
                include: [Guest]
            });
            if (!booking) return res.status(404).json({ message: 'Booking not found' });

            let bookingMetainfo = JSON.parse(booking.metainfo || '{}');

            if (bookingMetainfo?.sendDatesOfStayEmail?.sent) {
                console.log('Dates of Stay Email already sent', bookingMetainfo?.sendDatesOfStayEmail);
                return res.status(200).json({ success: false, message: 'Dates of Stay Email already sent' });
            }

            if (booking.complete) {
                console.log('Booking is complete, not sending Dates of Stay Email');
                return res.status(200).json({ success: false, message: 'Booking is complete, not sending Dates of Stay Email' });
            }

            if (!bookingMetainfo.hasOwnProperty('sendDatesOfStayEmail')) {
                bookingMetainfo.sendDatesOfStayEmail = { sent: false };
            }

            const guest = booking.Guest;
            if (!guest?.email) {
                console.error('❌ No guest email found for booking', booking.id);
                return res.status(400).json({ success: false, message: 'No guest email found for booking' });
            }

            const arrivalDate   = moment(booking.arrival_date).format('D MMMM YYYY');
            const departureDate = moment(booking.departure_date).format('D MMMM YYYY');
            const dateOfStay    = `${arrivalDate} – ${departureDate}`;
            const guestName     = `${guest.first_name} ${guest.last_name}`.trim();

            try {
                await EmailService.sendWithTemplate(
                    guest.email,
                    22, // TEMPLATE_IDS.BOOKING_NOTIFY_DATE_OF_STAY
                    { guest_name: guestName, dateOfStay },
                    { useFallback: true }
                );

                bookingMetainfo.sendDatesOfStayEmail.sent = true;
                booking.metainfo   = JSON.stringify(bookingMetainfo);
                booking.updated_at = new Date();
                await booking.save();
                console.log('✅ sendDatesOfStayEmail sent successfully', booking.id);
            } catch (error) {
                console.error('❌ sendDatesOfStayEmail ERROR', error.message, payload);
                return res.status(500).json({ success: false, message: 'Error sending sendDatesOfStayEmail', error: error.message });
            }
            break;
        }

        // ── New trigger system tasks ───────────────────────────────────────────

        /**
         * evaluateEmailTriggers
         *
         * Dispatched by update-status.js after every status/eligibility/iCare change.
         * payload: { booking_id, context }
         *   context examples:
         *     { booking_status: 'booking_confirmed' }
         *     { booking_eligibility: 'eligible' }
         *     { icare_funding_updated: true, update_type: 'allocation', ... }
         *
         * FIX: previously wrapped context in { enabled: true, context: ... }
         * which caused all system trigger context matching to fail silently.
         */
        case 'evaluateEmailTriggers': {
            // ⚠️  This task is dispatched EXCLUSIVELY from save-qa-pair.
            // It evaluates BOOKING FORM triggers (internal + external) only.
            // System triggers are fired directly from their own API routes.
            console.log('📋 Evaluating booking form triggers for booking', payload.booking_id, '(context:', payload.context || 'default', ')');

            const result = await EmailTriggerService.evaluateBookingFormTriggers(
                payload.booking_id,
                payload.context || 'default'
            );

            console.log(`✅ Booking form trigger evaluation complete: ${result.queued} queued, ${result.skipped} skipped, ${result.errored} errors`);

            return res.status(200).json({ success: true, result });
        }

        /**
         * sendTriggerEmail
         *
         * Dispatched by EmailTriggerService._evaluateSystemTrigger after a trigger matches.
         * payload: { trigger_id, booking_id, recipient, email_data }
         *
         * FIX 1: was expecting camelCase templateId/emailData — now reads snake_case
         *         email_data from EmailTriggerService and looks up template via trigger_id.
         * FIX 2: was missing trigger_id lookup — now fetches trigger + template from DB.
         */
        case 'sendTriggerEmail': {
            console.log('📧 Running background task: sendTriggerEmail');

            try {
                const { trigger_id, booking_id, recipient, email_data } = payload || {};

                // ── Validate required fields ───────────────────────────────
                if (!recipient) {
                    console.error('❌ sendTriggerEmail: no recipient in payload');
                    return res.status(400).json({ success: false, error: 'Missing recipient' });
                }
                if (!trigger_id) {
                    console.error('❌ sendTriggerEmail: no trigger_id in payload');
                    return res.status(400).json({ success: false, error: 'Missing trigger_id' });
                }
                if (!email_data) {
                    console.error('❌ sendTriggerEmail: no email_data in payload');
                    return res.status(400).json({ success: false, error: 'Missing email_data' });
                }

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(recipient)) {
                    console.error('❌ sendTriggerEmail: invalid email address:', recipient);
                    return res.status(400).json({ success: false, error: `Invalid email address: ${recipient}` });
                }

                // ── Load trigger + template ────────────────────────────────
                const trigger = await EmailTrigger.findByPk(trigger_id, {
                    include: [{ model: EmailTemplate, as: 'template' }]
                });

                if (!trigger) {
                    console.error(`❌ sendTriggerEmail: trigger ${trigger_id} not found`);
                    return res.status(404).json({ success: false, error: `Trigger ${trigger_id} not found` });
                }
                if (!trigger.email_template_id) {
                    console.error(`❌ sendTriggerEmail: trigger ${trigger_id} has no email_template_id`);
                    return res.status(400).json({ success: false, error: `Trigger ${trigger_id} has no template configured` });
                }

                console.log(`   Trigger:   #${trigger.id} (${trigger.description || trigger.type})`);
                console.log(`   Template:  #${trigger.email_template_id} (${trigger.template?.name || 'unknown'})`);
                console.log(`   Recipient: ${recipient}`);

                // ── Send ───────────────────────────────────────────────────
                await EmailService.sendWithTemplate(
                    recipient,
                    trigger.email_template_id,
                    email_data,
                    { useFallback: true }
                );

                console.log(`✅ sendTriggerEmail: sent to ${recipient}`);

                // ── Audit log (non-critical) ───────────────────────────────
                if (booking_id) {
                    try {
                        const booking = await Booking.findByPk(booking_id);
                        if (booking) {
                            await BookingEmailDataService.logEmailSend(booking, {
                                success:      true,
                                recipients:   [recipient],
                                templateId:   trigger.email_template_id,
                                templateName: trigger.template?.name || `Template ${trigger.email_template_id}`,
                                triggerType:  trigger.type || 'system',
                                triggerId:    trigger.id,
                                triggerName:  trigger.description || null,
                                reason:       'Email delivered successfully',
                                emailData:    email_data,
                            });
                        }
                    } catch (auditError) {
                        console.error('⚠️ Audit log failed (non-critical):', auditError.message);
                    }
                }

                return res.status(200).json({ success: true, message: `Email sent to ${recipient}` });

            } catch (error) {
                console.error('❌ sendTriggerEmail error:', error);

                // ── Audit failure (non-critical) ───────────────────────────
                if (payload?.booking_id) {
                    try {
                        const booking = await Booking.findByPk(payload.booking_id);
                        if (booking) {
                            await BookingEmailDataService.logEmailSend(booking, {
                                success:      false,
                                recipients:   [payload.recipient],
                                templateId:   null,
                                templateName: `Trigger #${payload.trigger_id}`,
                                triggerType:  'system',
                                triggerId:    payload.trigger_id || null,
                                triggerName:  null,
                                error:        error.message,
                                reason:       'Email delivery failed',
                                emailData:    payload.email_data,
                            });
                        }
                    } catch (auditError) {
                        console.error('⚠️ Failure audit log failed (non-critical):', auditError.message);
                    }
                }

                return res.status(500).json({ success: false, error: error.message });
            }
        }

        default:
            return res.status(400).json({ message: 'Unknown task type' });
    }

    return res.status(201).json({ success: true });
}