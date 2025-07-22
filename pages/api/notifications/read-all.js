import { Notification } from "../../../models";

export default async function handler(req, res) {
    const { guestId } = req.body;

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    await Notification.update({ read: true }, { where: { notifyee_id: guestId, notifyee_type: 'guest' } });

    return res.status(200).json({
        success: true,
    });
}
