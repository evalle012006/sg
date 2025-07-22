import { ChecklistAction, ChecklistTemplate } from '../../../models';

export default async function handler(req, res) {
    const checklist = req.body;

    const maxOrder = await ChecklistTemplate.max('order') || 0;
    
    const [data, created] = await ChecklistTemplate.upsert({
        ...checklist, 
        actions: JSON.stringify(checklist.actions),
        order: checklist.order || maxOrder + 1
    });

    const ckId = data.id;

    return res.status(200).json({ success: true, id: ckId });
}