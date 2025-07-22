import moment from 'moment';
import { Guest, User, Notification } from '../../models';
import createHttpTaskWithToken from '../queues/dispatchHttpTask';

export class NotificationService {

    dispatchNotification = async ({ notification_to, message, link }) => {
        let user;
        let userType;

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
            console.log('notification sent to: ' + notification_to)
        } else {
            console.error('User not found, please ensure the notification_to attribute has a valid email address.');
            console.log('User not found');
            console.log("Notification To: " + notification_to);
        }

    }

    dispatchNotificationToQueue = async ({ notification_to, message, link, dispatch_date }) => {
        const payload = {
            notification_to: notification_to,
            message: message,
            link: link
        }

        const dispatchInSeconds = moment(dispatch_date).diff(moment(), 'seconds');
        createHttpTaskWithToken(process.env.APP_URL + '/api/notifications/service-task', 'POST', payload, dispatchInSeconds);
    }

    notificationHandler = async ({ notification_to, message, link, dispatch_date }) => {
        if (moment(dispatch_date).isAfter(moment())) {
            await this.dispatchNotificationToQueue({ notification_to, message, link, dispatch_date });
        } else {
            console.log('dispatching notification')
            await this.dispatchNotification({ notification_to, message, link });
        }
    }
}