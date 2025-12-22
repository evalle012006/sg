import { RoomType } from '../../../models';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    try {
        const room = req.body;

        // Validate required fields
        if (!room.name || room.name.trim() === '') {
            return res.status(400).json({ 
                success: false, 
                message: 'Room name is required' 
            });
        }

        // Prepare room data with proper type handling
        const roomData = {
            id: room.id || undefined, // undefined for new rooms, id for updates
            type: room.type || room.name.replace(/\s+/g, '_').toLowerCase(),
            name: room.name.trim(),
            ergonomic_king_beds: parseInt(room.ergonomic_king_beds) || 0,
            king_single_beds: parseInt(room.king_single_beds) || 0,
            queen_sofa_beds: parseInt(room.queen_sofa_beds) || 0,
            bedrooms: parseInt(room.bedrooms) || 0,
            bathrooms: parseInt(room.bathrooms) || 0,
            ocean_view: room.ocean_view ? 1 : 0,
            max_guests: parseInt(room.max_guests) || 0,
            price_per_night: parseFloat(room.price_per_night) || 0,
            peak_rate: parseFloat(room.peak_rate) || 0,
            hsp_pricing: parseFloat(room.hsp_pricing) || 0,
        };

        // Keep existing image_filename if present
        if (room.image_filename) {
            roomData.image_filename = room.image_filename;
        }

        const [data, created] = await RoomType.upsert(roomData);

        return res.status(200).json({ 
            success: true, 
            room: data,
            id: data.id,
            created: created
        });
    } catch (error) {
        console.error('Error saving room:', error);
        return res.status(500).json({ 
            success: false, 
            message: 'Failed to save room',
            error: error.message 
        });
    }
}