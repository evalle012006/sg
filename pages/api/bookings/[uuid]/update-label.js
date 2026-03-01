import { Booking } from "../../../../models";
import AuditLogService from "../../../../services/AuditLogService";
import _ from 'lodash';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uuid } = req.query;
    const { label } = req.body;

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

    // Store old labels for audit log
    let oldLabels = [];
    if (booking.label) {
      try {
        oldLabels = typeof booking.label === 'string' 
          ? JSON.parse(booking.label) 
          : booking.label;
      } catch (e) {
        oldLabels = [];
      }
    }

    // Ensure label is an array
    const newLabels = Array.isArray(label) ? label : [label];

    // Update labels
    await Booking.update(
      { label: JSON.stringify(newLabels) }, 
      { where: { uuid: uuid } }
    );

    // ⭐ AUDIT LOG - Server side
    try {
      const isAdmin = currentUser.type === 'user';
      const added = newLabels.filter(l => !oldLabels.includes(l));
      const removed = oldLabels.filter(l => !newLabels.includes(l));
      
      let description = 'Updated booking labels';
      if (added.length > 0 && removed.length === 0) {
        description = `Added labels: ${added.map(l => _.startCase(l)).join(', ')}`;
      } else if (removed.length > 0 && added.length === 0) {
        description = `Removed labels: ${removed.map(l => _.startCase(l)).join(', ')}`;
      } else if (added.length > 0 && removed.length > 0) {
        description = `Changed labels: +${added.length} added, -${removed.length} removed`;
      }

      await AuditLogService.createAuditEntry({
        bookingId: booking.id,
        userId: isAdmin ? currentUser.id : null,
        guestId: isAdmin ? null : booking.guest_id,
        actionType: 'admin_note_added',
        userType: isAdmin ? 'admin' : 'guest',
        description: description,
        oldValue: { labels: oldLabels },
        newValue: { labels: newLabels },
        category: 'Labels',
        metadata: {
          added: added,
          removed: removed,
          updated_at: new Date()
        }
      });
      console.log('✅ Labels change logged to audit trail');
    } catch (auditError) {
      console.error('Failed to log labels change:', auditError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating labels:', error);
    return res.status(500).json({ error: 'Failed to update labels' });
  }
}