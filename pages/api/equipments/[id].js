import { Equipment, EquipmentCategory, Supplier } from "../../../models/";
import StorageService from "../../../services/storage/storage";

export default async function handler(req, res) {
    const { id } = req.query;

    // Only allow GET method
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    // Validate ID parameter
    if (!id) {
        return res.status(400).json({ message: 'Equipment ID is required' });
    }

    try {
        const storage = new StorageService({ bucketType: 'restricted' });
        
        // Find equipment by ID with related models
        const equipment = await Equipment.findOne({
            where: { 
                id: id,
                hidden: false // Only return non-hidden equipment
            },
            include: [
                {
                    model: EquipmentCategory,
                    attributes: ['id', 'name']
                },
                {
                    model: Supplier,
                    attributes: ['id', 'name', 'phone_number'] // Only include fields that exist
                }
            ],
            raw: false // Set to false to get proper object structure
        });

        // Check if equipment exists
        if (!equipment) {
            return res.status(404).json({ message: 'Equipment not found' });
        }

        // Convert to plain object for manipulation
        const equipmentData = equipment.toJSON();

        // Generate signed URL for equipment image if exists
        if (equipmentData.image_filename && !equipmentData.image_filename.includes("default-")) {
            try {
                const imageUrl = await storage.getSignedUrl('equipment-photo' + '/' + equipmentData.image_filename);
                equipmentData.image_url = imageUrl;
            } catch (imageError) {
                console.error('Error generating image URL:', imageError);
                // Continue without image URL if there's an error
            }
        }

        // Format the response to match the structure expected by the frontend
        const formattedEquipment = {
            ...equipmentData,
            // Ensure category_name is available for the frontend
            category_name: equipmentData.EquipmentCategory?.name ? 
                equipmentData.EquipmentCategory.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '',
            // Ensure supplier info is available
            supplier_name: equipmentData.Supplier?.name || '',
            supplier_contact_number: equipmentData.Supplier?.phone_number || '',
            // Ensure status field exists
            assetStatus: equipmentData.status || 'active'
        };

        return res.status(200).json(formattedEquipment);

    } catch (error) {
        console.error('Error fetching equipment:', error);
        return res.status(500).json({ 
            message: 'Internal server error', 
            error: error.message 
        });
    }
}