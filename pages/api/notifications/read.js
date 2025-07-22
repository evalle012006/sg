import { Notification } from "../../../models";

export default async function handler(req, res) {
    const { notification_id } = req.body;

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    await Notification.update({ read: true }, { where: { id: notification_id } });

    return res.status(200).json({
        success: true,
    });
}
