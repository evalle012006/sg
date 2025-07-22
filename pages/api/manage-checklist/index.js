import { ChecklistTemplate } from '../../../models';

export default async function handler(req, res) {
    try {
        const checklist = await ChecklistTemplate.findAll({
            order: [['order', 'ASC']]
        });

        return res.status(200).json(checklist);
    } catch (error) {
        console.error('Error fetching checklists:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}