import { User, ModelHasRole, Role, NotificationLibrary } from "../../../models";
import moment from "moment";
import { NotificationService } from "../../../services/notification/notification";

export default async function handler(req, res) {
    const { uuid } = req.query;

    const user = await User.findOne({ where: { uuid } });
    
    const notificationService = new NotificationService();

    if (req.method === 'DELETE') {
        const notificationLibs = await NotificationLibrary.findOne({ where: {name: 'User Deleted', enabled: true} });
        await User.destroy({ where: { uuid } });

        if (notificationLibs && user) {
            let message = notificationLibs.notification;
            message = message.replace('[user_email]', user.email);

            const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
            await notificationService.notificationHandler({
                notification_to: notificationLibs.notification_to,
                message: message,
                link: null,
                dispatch_date: dispatch_date
            });
        }
        
        return res.status(200).json({ message: 'User deleted successfully' });
    }

    if (req.method === 'POST') {
        const notificationLibs = await NotificationLibrary.findOne({ where: {name: 'User Updated', enabled: true} });
        await User.update(req.body, { where: { uuid } })

        if (req.body.hasOwnProperty('role')) {
            const role = await Role.findOne({ where: { name: req.body.role } });
            if (role) {
                const data = { role_id: role.id, model_id: req.body.id, model_type: 'user' };
                const modalHasRole = await ModelHasRole.findOne({ where: { model_id: req.body.id, model_type: 'user' } });

                if (modalHasRole) {
                    await ModelHasRole.update(data, { where: { model_id: req.body.id, model_type: 'user' } });
                } else {
                    await ModelHasRole.create(data);
                }
            };
        }

        if (notificationLibs && user) {
            let message = notificationLibs.notification;
            message = message.replace('[user_email]', user.email);

            const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
            await notificationService.notificationHandler({
                notification_to: notificationLibs.notification_to,
                message: message,
                link: null,
                dispatch_date: dispatch_date
            });
        }
    }

    res.json(user);
}