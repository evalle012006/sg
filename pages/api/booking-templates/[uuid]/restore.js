import { Template } from "../../../../models";

export default async function handler(req, res) {
    const { uuid } = req.query;

    if (req.method === "POST") {
        try {
            const template = await Template.update(
                { archived: false },
                { 
                    where: { uuid },
                    returning: true
                }
            );
            return res.status(200).json(template);
        } catch (error) {
            console.error('Error restoring template:', error);
            return res.status(500).json({ error: 'Failed to restore template' });
        }
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}