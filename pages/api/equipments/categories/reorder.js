import db from '../../../../models';

export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const updatedItems = req.body;

        // Use transaction to ensure all updates succeed or none do
        await db.sequelize.transaction(async (t) => {
            for (const item of updatedItems) {
                await db.EquipmentCategory.update(
                    { order: item.order },
                    { 
                        where: { id: item.id },
                        transaction: t 
                    }
                );
            }
        });

        res.status(200).json({ 
            success: true, 
            message: 'Category order updated successfully' 
        });
    } catch (error) {
        console.error('Error reordering categories:', error);
        res.status(500).json({ 
            error: 'Failed to update category order',
            details: error.message 
        });
    }
}