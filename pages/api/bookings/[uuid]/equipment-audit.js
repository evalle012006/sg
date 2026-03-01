import { Booking } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { bookingId } = req.query;
    const { 
      action, 
      equipment_id, 
      equipment_name, 
      serial_number,
      category,
      old_start_date, 
      old_end_date, 
      new_start_date, 
      new_end_date 
    } = req.body;

    // Verify booking exists
    const booking = await Booking.findByPk(bookingId);
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const userId = req.user?.id || req.session?.user?.id;
    const userType = req.user?.type === 'user' ? 'admin' : 'guest';

    let description, oldValue, newValue;

    switch (action) {
      case 'added':
        description = `Added equipment: ${equipment_name}`;
        oldValue = null;
        newValue = {
          equipment_id,
          equipment_name,
          serial_number,
          category
        };
        break;

      case 'removed':
        description = `Removed equipment: ${equipment_name}`;
        oldValue = {
          equipment_id,
          equipment_name,
          serial_number,
          category
        };
        newValue = null;
        break;

      case 'dates_changed':
        description = `Updated dates for ${equipment_name}: ${old_start_date} - ${old_end_date} → ${new_start_date} - ${new_end_date}`;
        oldValue = {
          equipment_name,
          start_date: old_start_date,
          end_date: old_end_date
        };
        newValue = {
          equipment_name,
          start_date: new_start_date,
          end_date: new_end_date
        };
        break;

      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    await AuditLogService.createAuditEntry({
      bookingId: booking.id,
      userId: userId || booking.guest_id,
      actionType: 'equipment_changed',
      userType: userType,
      description: description,
      oldValue: oldValue,
      newValue: newValue,
      category: 'Equipment',
      metadata: {
        action: action,
        equipment_id: equipment_id,
        updated_at: new Date()
      }
    });

    return res.status(200).json({ success: true });

  } catch (error) {
    console.error('Error logging equipment audit:', error);
    return res.status(500).json({ 
      error: 'Failed to log audit entry',
      details: error.message 
    });
  }
}