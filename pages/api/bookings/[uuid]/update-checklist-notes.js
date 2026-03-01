import { Booking } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;
    const { checklist_notes } = req.body;

    // Get current user from session
    const currentUser = req.session?.user || req.user;
    
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find booking
    const booking = await Booking.findOne({ where: { uuid } });
    
    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Store old checklist notes for audit log
    const oldChecklistNotes = booking.checklist_notes;

    // Update checklist notes
    await Booking.update(
      { checklist_notes: checklist_notes }, 
      { where: { uuid: uuid } }
    );

    // ⭐ AUDIT LOG - Server side
    try {
      const isAdmin = currentUser.type === 'user';
      
      await AuditLogService.createAuditEntry({
        bookingId: booking.id,
        userId: isAdmin ? currentUser.id : null,
        guestId: isAdmin ? null : booking.guest_id,
        actionType: 'admin_note_added',
        userType: isAdmin ? 'admin' : 'guest',
        description: oldChecklistNotes 
          ? 'Updated checklist notes' 
          : 'Added checklist notes',
        oldValue: oldChecklistNotes ? { checklist_notes: oldChecklistNotes } : null,
        newValue: { checklist_notes: checklist_notes },
        category: 'Checklist Notes',
        metadata: {
          field: 'checklist_notes',
          updated_at: new Date()
        }
      });
      console.log('✅ Checklist notes change logged to audit trail');
    } catch (auditError) {
      console.error('Failed to log checklist notes change:', auditError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating checklist notes:', error);
    return res.status(500).json({ error: 'Failed to update checklist notes' });
  }
}