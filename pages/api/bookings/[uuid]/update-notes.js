import { Booking } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get session using NextAuth
    const session = await getServerSession(req, res, authOptions);
    
    if (!session) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { uuid } = req.query;
    const { notes } = req.body;

    // Find booking
    const booking = await Booking.findOne({ where: { uuid } });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Store old notes for audit log
    const oldNotes = booking.notes;

    // Update notes
    await Booking.update(
      { notes: notes }, 
      { where: { uuid: uuid } }
    );

    // ⭐ AUDIT LOG - Server side
    try {
      const currentUser = session.user;
      const isAdmin = currentUser.type === 'user';
      
      await AuditLogService.createAuditEntry({
        bookingId: booking.id,
        userId: isAdmin ? currentUser.id : null,
        guestId: isAdmin ? null : booking.guest_id,
        actionType: 'admin_note_added',
        userType: isAdmin ? 'admin' : 'guest',
        description: oldNotes ? 'Updated booking notes' : 'Added booking notes',
        oldValue: oldNotes ? { notes: oldNotes } : null,
        newValue: { notes: notes },
        category: 'Notes',
        metadata: {
          field: 'booking_notes',
          updated_at: new Date()
        }
      });
      console.log('✅ Notes change logged to audit trail');
    } catch (auditError) {
      console.error('Failed to log notes change:', auditError);
      // Don't fail the request if audit logging fails
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating notes:', error);
    return res.status(500).json({ error: 'Failed to update notes' });
  }
}