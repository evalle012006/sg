import { Booking } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";

/**
 * POST /api/bookings/[uuid]/add-note
 * Add an admin note to a booking
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;
    const { note, category, metadata } = req.body;
    const userId = req.user?.id; // Assuming auth middleware sets req.user

    // Validate required fields
    if (!note || note.trim() === '') {
      return res.status(400).json({ error: 'Note content is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Verify booking exists (by UUID)
    const booking = await Booking.findOne({ where: { uuid } });
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add notes' });
    }

    // Create the audit entry (using booking.id)
    const auditEntry = await AuditLogService.addAdminNote({
      bookingId: booking.id,
      userId,
      note: note.trim(),
      category: category || null,
      metadata: {
        ...metadata,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Note added successfully',
      auditEntry: {
        id: auditEntry.id,
        description: auditEntry.description,
        created_at: auditEntry.created_at,
        category: auditEntry.category
      }
    });

  } catch (error) {
    console.error('Error adding admin note:', error);
    return res.status(500).json({ 
      error: 'Failed to add note',
      details: error.message 
    });
  }
}