import { Checklist, ChecklistAction, ChecklistTemplate } from '../../../models'
export default async function handler(req, res) {
    const { id } = req.query;

    const checklist = await ChecklistTemplate.findOne({ where: { id: id }});

    return res.status(200).json({ success: true, data: checklist });
}
