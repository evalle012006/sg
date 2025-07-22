import { Checklist, ChecklistAction } from '../../../../models';

export default async function handler(req, res) {
  try {
    const checklist = req.body;
    
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