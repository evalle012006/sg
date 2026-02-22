import moment from 'moment';
import { Guest, User, Notification } from '../../models';
import createHttpTaskWithToken from '../queues/dispatchHttpTask';
import EmailRecipientsService from '../email/EmailRecipientsService';

export class NotificationService {

    dispatchNotification = async ({ notification_to, message, link }) => {
        let user;
        let userType;

        try {
            user = await User.findOne({ where: { email: notification_to } });

            if (!user) {
                user = await Guest.findOne({ where: { email: notification_to } });
                userType = 'guest';
            } else {
                userType = 'user';
            }

            if (user) {
                await Notification.create({
                    message: message,
                    link: link,
                    notifyee_id: user.id,
                    notifyee_type: userType,
                    created_at: new Date(),
                    updated_at: new Date()
                });
                console.log('notification sent to: ' + notification_to);
            } else {
                console.error('User not found, please ensure the notification_to attribute has a valid email address.');
                console.log('User not found');
                console.log("Notification To: " + notification_to);
            }
        } catch (error) {
            console.error('Error in dispatchNotification:', error);
            throw error;
        }
    }

    dispatchNotificationToQueue = async ({ notification_to, message, link, dispatch_date }) => {
        try {
            const payload = {
                notification_to: notification_to,
                message: message,
                link: link
            }

            const dispatchInSeconds = moment(dispatch_date).diff(moment(), 'seconds');
            await createHttpTaskWithToken(
                process.env.APP_URL + '/api/notifications/service-task', 
                'POST', 
                payload, 
                dispatchInSeconds
            );
        } catch (error) {
            console.error('Error in dispatchNotificationToQueue:', error);
            throw error;
        }
    }

    /**
     * ✨ Resolve notification recipient
     * Replaces hardcoded info@sargoodoncollaroy.com.au with settings value
     * 
     * @param {string} notificationTo - Original recipient email
     * @returns {Promise<string>} Resolved recipient email(s)
     */
    resolveNotificationTo = async (notificationTo) => {
        // If it's the hardcoded info email, use settings instead
        if (notificationTo === 'info@sargoodoncollaroy.com.au') {
            const infoRecipients = await EmailRecipientsService.getRecipientsString('info');
            
            // If settings configured, use them; otherwise keep original
            if (infoRecipients && infoRecipients.length > 0) {
                console.log('📧 Resolved notification recipient from settings:', infoRecipients);
                return infoRecipients;
            }
            
            console.log('⚠️ No info recipients in settings, using original:', notificationTo);
        }
        
        // For all other emails (staff emails, guest emails), use as-is
        return notificationTo;
    }

    /**
     * ✅ FIXED: Notification handler with recipient resolution
     * This method now:
     * 1. Resolves the recipient email (may use settings or keep original)
     * 2. Checks if notification should be dispatched now or queued for later
     * 3. Calls the appropriate dispatch method
     */
    notificationHandler = async ({ notification_to, message, link, dispatch_date }) => {
        try {
            // Step 1: Resolve the recipient (may use settings or keep original)
            const resolvedRecipient = await this.resolveNotificationTo(notification_to);
            
            // Step 2: Determine if we should dispatch now or queue for later
            if (moment(dispatch_date).isAfter(moment())) {
                // Future dispatch - add to queue
                console.log('📅 Queueing notification for future dispatch:', dispatch_date);
                await this.dispatchNotificationToQueue({ 
                    notification_to: resolvedRecipient, 
                    message, 
                    link, 
                    dispatch_date 
                });
            } else {
                // Immediate dispatch
                console.log('📧 Dispatching notification immediately');
                await this.dispatchNotification({ 
                    notification_to: resolvedRecipient, 
                    message, 
                    link 
                });
            }
        } catch (error) {
            console.error('Error in notification handler:', error);
            throw error;
        }
    }
}