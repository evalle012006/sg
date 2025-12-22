import { RoomType } from '../../../models'
import StorageService from "../../../services/storage/storage"

export default async function handler(req, res) {
    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ message: "Room ID is required" });
    }

    const storage = new StorageService({ bucketType: 'restricted' });

    try {
        const room = await RoomType.findOne({ where: { id: id } });
        
        if (!room) {
            return res.status(404).json({ message: "Room not found" });
        }

        let responseRoom = { ...room.dataValues };
        
        // Get signed URL for image if exists
        if (room.image_filename) {
            try {
                const image_url = await storage.getSignedUrl('room-type-photo/' + room.image_filename);
                responseRoom.image_url = image_url;
            } catch (error) {
                console.warn('Failed to generate signed URL for room image:', error);
                responseRoom.image_url = null;
            }
        } else {
            responseRoom.image_url = null;
        }

        return res.status(200).json(responseRoom);
    } catch (error) {
        console.error('Error fetching room:', error);
        return res.status(500).json({ message: "Error fetching room", error: error.message });
    }
}