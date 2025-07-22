import { ChecklistTemplate } from '../../../models';
import { sequelize } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const items = req.body;
        
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'Invalid data format. Expected array of items.' });
        }

        // Start a transaction to ensure all updates happen or none
        const transaction = await sequelize.transaction();

        try {
            // Update each item's order
            const updatePromises = items.map(item => 
                ChecklistTemplate.update(
                    { order: item.order },
                    { 
                        where: { id: item.id },
                        transaction
                    }
                )
            );

            await Promise.all(updatePromises);
            await transaction.commit();

            // Fetch updated records
            const updatedChecklists = await ChecklistTemplate.findAll({
                order: [['order', 'ASC']]
            });

            return res.status(200).json(updatedChecklists);
        } catch (error) {
            await transaction.rollback();
            console.error('Transaction error:', error);
            return res.status(500).json({ message: 'Failed to update checklist order' });
        }
    } catch (error) {
        console.error('Server error:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
}