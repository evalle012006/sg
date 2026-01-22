import { Guest, Notification, User } from '../../../models';
import { Op } from 'sequelize';

// Performance constants
const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 10;

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { 
        user_id, 
        user_type,
        // Pagination parameters
        limit = DEFAULT_LIMIT,
        offset = 0,
        page,
        // Filter parameters
        read_status, // 'read', 'unread', or 'all' (default)
        // Performance options
        count_only = false // If true, only return counts (for badge)
    } = req.body;

    if (!user_id || !user_type) {
        return res.status(400).json({ 
            success: false, 
            message: 'user_id and user_type are required' 
        });
    }

    try {
        // Build where clause
        const whereClause = {
            notifyee_id: user_id,
            notifyee_type: user_type
        };

        // Add read status filter
        if (read_status === 'read') {
            whereClause.read = true;
        } else if (read_status === 'unread') {
            whereClause.read = false;
        }
        // 'all' or undefined = no filter on read status

        // If only counting (for notification badge), return just the count
        if (count_only) {
            const unreadCount = await Notification.count({
                where: {
                    notifyee_id: user_id,
                    notifyee_type: user_type,
                    read: false
                }
            });

            return res.status(200).json({
                success: true,
                unread_count: unreadCount
            });
        }

        // Calculate pagination
        const processedLimit = Math.min(parseInt(limit), MAX_LIMIT);
        const processedOffset = page 
            ? (parseInt(page) - 1) * processedLimit 
            : parseInt(offset);

        // Build include based on user type
        const includeModel = user_type === 'user' ? User : Guest;

        // Execute paginated query with count
        const { count: totalCount, rows: notifications } = await Notification.findAndCountAll({
            where: whereClause,
            include: [includeModel],
            order: [['created_at', 'DESC']],
            limit: processedLimit,
            offset: processedOffset,
            distinct: true
        });

        // Get unread count separately (for badge display)
        const unreadCount = await Notification.count({
            where: {
                notifyee_id: user_id,
                notifyee_type: user_type,
                read: false
            }
        });

        // Process notifications to add createdBy field
        const processedNotifications = notifications.map(notif => {
            const notifData = notif.toJSON ? notif.toJSON() : notif;
            
            if (notifData.notifyee_type === 'guest') {
                const guestFullName = notifData.Guest 
                    ? `${notifData.Guest.first_name} ${notifData.Guest.last_name}` 
                    : 'Unknown';
                return { ...notifData, createdBy: guestFullName };
            } else {
                const userFullName = notifData.User 
                    ? `${notifData.User.first_name} ${notifData.User.last_name}` 
                    : 'Unknown';
                return { ...notifData, createdBy: userFullName };
            }
        });

        // Calculate pagination metadata
        const totalPages = Math.ceil(totalCount / processedLimit);
        const currentPage = Math.floor(processedOffset / processedLimit) + 1;
        const hasMore = processedOffset + processedLimit < totalCount;

        return res.status(200).json({
            success: true,
            notifications: processedNotifications,
            pagination: {
                total: totalCount,
                limit: processedLimit,
                offset: processedOffset,
                page: currentPage,
                total_pages: totalPages,
                has_more: hasMore
            },
            unread_count: unreadCount
        });

    } catch (error) {
        console.error('Error fetching notifications:', error);
        return res.status(500).json({
            success: false,
            message: 'Error fetching notifications',
            error: error.message
        });
    }
}