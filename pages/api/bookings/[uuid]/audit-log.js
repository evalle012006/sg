import { Booking, BookingAuditLog } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;
    const {
      limit = 20,
      offset = 0,
      actionType,
      category,
      includeInternal = false,
      userType
    } = req.query;

    // Find booking by UUID
    const booking = await Booking.findOne({ where: { uuid } });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Build where clause for count
    const where = { booking_id: booking.id };
    
    if (actionType) {
      where.action_type = actionType;
    }
    
    if (category) {
      where.category = category;
    }
    
    if (includeInternal !== 'true') {
      where.is_internal_note = false;
    }

    if (userType) {
      where.user_type = userType;
    }

    // Get total count
    const totalCount = await BookingAuditLog.count({ where });

    // Fetch audit logs
    const logs = await AuditLogService.getBookingAuditLog(booking.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
      actionType,
      category,
      includeInternal: includeInternal === 'true',
      userType
    });

    // Format logs for response
    const formattedLogs = logs.map(log => {
      let actorName = 'System';
      let actorEmail = null;
      
      if (log.user) {
        actorName = `${log.user.first_name} ${log.user.last_name}`.trim();
        actorEmail = log.user.email;
      } else if (log.guest) {
        actorName = `${log.guest.first_name} ${log.guest.last_name}`.trim();
        actorEmail = log.guest.email;
      }

      return {
        id: log.id,
        action_type: log.action_type,
        user_type: log.user_type,
        description: log.description,
        old_value: log.old_value,
        new_value: log.new_value,
        category: log.category,
        created_at: log.created_at,
        actor: {
          name: actorName,
          email: actorEmail,
          type: log.user_type
        },
        user: log.user ? {
          id: log.user.id,
          name: actorName,
          email: log.user.email
        } : null,
        guest: log.guest ? {
          id: log.guest.id,
          name: actorName,
          email: log.guest.email
        } : null
      };
    });

    return res.status(200).json({
      success: true,
      logs: formattedLogs,
      total: totalCount,
      showing: formattedLogs.length,
      hasMore: totalCount > (parseInt(offset) + formattedLogs.length)
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return res.status(500).json({ 
      error: 'Failed to fetch audit logs',
      details: error.message 
    });
  }
}