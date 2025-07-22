import { ChecklistAction, ChecklistTemplate } from '../../../models'
export default async function handler(req, res) {
    const selected = JSON.parse(req.body);

    // const checklistActions = await ChecklistAction.destroy({ where: {checklist_id: selected.id} });
    const checklist = await ChecklistTemplate.destroy({ where: {id: selected.id} });

    return res.status(200).end(JSON.stringify({ success: true }));
}
