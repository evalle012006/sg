import { ChecklistAction, Checklist, Booking } from '../../../../models';
import AuditLogService from '../../../../services/AuditLogService';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { id, status } = req.body;

    // Get current user from session
    const currentUser = req.session?.user || req.user;
    
    if (!currentUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the checklist action with its checklist and booking
    const checklistAction = await ChecklistAction.findByPk(id, {
      include: [{
        model: Checklist,
        include: [{
          model: Booking,
          attributes: ['id', 'guest_id']
        }]
      }]
    });

    if (!checklistAction) {
      return res.status(404).json({ error: 'Checklist action not found' });
    }

    // Store old status for audit log
    const oldStatus = checklistAction.status;
    const actionText = checklistAction.action;

    // Update checklist item status
    await ChecklistAction.update(
      { status: status },
      { where: { id: id } }
    );

    // ⭐ AUDIT LOG - Server side
    try {
      const isAdmin = currentUser.type === 'user';
      const booking = checklistAction.Checklist?.Booking;
      
      if (booking) {
        const description = status 
          ? `Completed checklist item: ${actionText}`
          : `Unchecked checklist item: ${actionText}`;

        await AuditLogService.createAuditEntry({
          bookingId: booking.id,
          userId: isAdmin ? currentUser.id : null,
          guestId: isAdmin ? null : booking.guest_id,
          actionType: 'admin_note_added',
          userType: isAdmin ? 'admin' : 'guest',
          description: description,
          oldValue: { status: oldStatus },
          newValue: { status: status },
          category: 'Checklist',
          metadata: {
            checklist_item: actionText,
            checklist_item_id: id,
            updated_at: new Date()
          }
        });
        console.log('✅ Checklist item change logged to audit trail');
      }
    } catch (auditError) {
      console.error('Failed to log checklist item change:', auditError);
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error updating checklist item:', error);
    return res.status(500).json({ error: 'Failed to update checklist item' });
  }
}