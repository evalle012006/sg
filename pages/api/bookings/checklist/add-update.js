import { Booking, Checklist, ChecklistAction } from '../../../../models';
import AuditLogService from '../../../../services/AuditLogService';
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

    const checklist = req.body;

    // Get booking for audit log
    const booking = await Booking.findOne({
      where: { id: checklist.booking_id },
      include: [{ model: Checklist, as: 'Checklist' }]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Store old checklist name for audit log
    const oldChecklistName = booking.Checklist?.name || 'None';
    
    const existing = await Checklist.findOne({ 
      where: { booking_id: checklist.booking_id } 
    });
    
    if (existing) {
      await ChecklistAction.destroy({ where: { checklist_id: existing.id } });
      await Checklist.destroy({ where: { booking_id: checklist.booking_id } });
    }

    const [data, created] = await Checklist.upsert({
      ...checklist
    });
    
    const ckId = data.id;
    const actions = checklist.ChecklistActions;

    await Promise.all(
      actions.map(async (action, index) => {
        if (created) {
          action.ChecklistId = ckId;
          action.checklist_id = ckId;
        }

        action.order = index;
        return await upsertAction(action);
      })
    );

    // ⭐ AUDIT LOG - Server side
    try {
      const currentUser = session.user;
      const isAdmin = currentUser.type === 'user';
      const description = oldChecklistName === 'None'
        ? `Added checklist: ${checklist.name}`
        : `Changed checklist: ${oldChecklistName} → ${checklist.name}`;

      await AuditLogService.createAuditEntry({
        bookingId: booking.id,
        userId: isAdmin ? currentUser.id : null,
        guestId: isAdmin ? null : booking.guest_id,
        actionType: 'admin_note_added',
        userType: isAdmin ? 'admin' : 'guest',
        description: description,
        oldValue: { checklist: oldChecklistName },
        newValue: { 
          checklist: checklist.name,
          actions: actions.map(a => a.action)
        },
        category: 'Checklist',
        metadata: {
          checklist_id: ckId,
          action_count: actions.length,
          updated_at: new Date()
        }
      });
      console.log('✅ Checklist change logged to audit trail');
    } catch (auditError) {
      console.error('Failed to log checklist change:', auditError);
    }

    return res.status(200).json({ success: true, id: ckId });
  } catch (error) {
    console.error('Error in checklist handler:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
}

const upsertAction = async (action) => {
  return await ChecklistAction.upsert({
    ...action
  });
}