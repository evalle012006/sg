import { Notification } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { notification_id } = req.body;

    if (!notification_id) {
        return res.status(400).json({
            success: false,
            message: 'notification_id is required'
        });
    }

    try {
        const [updatedCount] = await Notification.update(
            { 
                read: true,
                updated_at: new Date()
            },
            { 
                where: { 
                    id: notification_id,
                    read: false // Only update if not already read
                } 
            }
        );

        return res.status(200).json({
            success: true,
            updated: updatedCount > 0,
            message: updatedCount > 0 
                ? 'Notification marked as read' 
                : 'Notification was already read'
        });

    } catch (error) {
        console.error('Error marking notification as read:', error);
        return res.status(500).json({
            success: false,
            message: 'Error marking notification as read',
            error: error.message
        });
    }
}