import { Guest, Notification, User } from '../../../models';

export default async function handler(req, res) {

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { user_id, user_type } = req.body;

    let notifications;

    if (user_type == 'user') {
        notifications = await Notification.findAll({
            where: { notifyee_id: user_id, notifyee_type: user_type },
            include: [User],
            order: [['created_at', 'DESC']]
        });
    } else if (user_id) {
        notifications = await Notification.findAll({
            where: { notifyee_id: user_id, notifyee_type: user_type },
            include: [Guest],
            order: [['created_at', 'DESC']]
        });
    }

    return res.status(200).json({ success: true, notifications });
}
