import { Notification } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { user_id, user_type } = req.body;

    if (!user_id || !user_type) {
        return res.status(400).json({
            success: false,
            message: 'user_id and user_type are required'
        });
    }

    try {
        // Update all unread notifications for this user
        const [updatedCount] = await Notification.update(
            { 
                read: true,
                updated_at: new Date()
            },
            { 
                where: { 
                    notifyee_id: user_id, 
                    notifyee_type: user_type,
                    read: false 
                } 
            }
        );

        return res.status(200).json({
            success: true,
            updated_count: updatedCount,
            message: `${updatedCount} notification(s) marked as read`
        });

    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        return res.status(500).json({
            success: false,
            message: 'Error marking notifications as read',
            error: error.message
        });
    }
}