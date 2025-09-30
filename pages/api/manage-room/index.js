import { RoomType } from '../../../models'
import StorageService from "../../../services/storage/storage"

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });
    
    // Get optional filter parameters from query string
    const { types, simple } = req.query;
    
    // Build query options
    const queryOptions = {};
    
    // If types parameter is provided, filter by room types
    if (types) {
        try {
            // Parse types array from query string
            // Supports: ?types=ocean_view,deluxe or ?types[]=ocean_view&types[]=deluxe
            const typeArray = Array.isArray(types) ? types : types.split(',');
            queryOptions.where = {
                type: typeArray.map(t => t.trim())
            };
        } catch (error) {
            console.error('Error parsing types filter:', error);
        }
    }

    const rooms = await RoomType.findAll(queryOptions);

    if (rooms) {
        // If simple=true is passed, return data without images (faster response)
        if (simple === 'true') {
            const simpleRooms = rooms.map(room => ({
                id: room.id,
                name: room.name,
                type: room.type,
                max_guests: room.max_guests,
                price_per_night: room.price_per_night,
                peak_rate: room.peak_rate,
                bedrooms: room.bedrooms,
                bathrooms: room.bathrooms,
                ocean_view: room.ocean_view
            }));
            
            return res.status(200).json(simpleRooms);
        }
        
        // Default behavior: include images with signed URLs
        let updatedRooms = [];
        const promise = await new Promise(async (resolve) => {
            const response = await Promise.all(rooms.map(async (room) => {
                let uRoom = { ...room.dataValues };
                let image_url = '';
                if (uRoom.image_filename) {
                    image_url = await storage.getSignedUrl('room-type-photo/' + uRoom.image_filename);
                }
                updatedRooms.push({ data: uRoom, image_url: image_url });
            }));

            resolve(response);
        });

        if (promise) {
            return res.status(200).json(updatedRooms);
        }
        else {
            return res.status(500).json({ message: "Error fetching rooms" });
        }
    }
}