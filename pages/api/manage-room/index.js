import { RoomType } from '../../../models'
import StorageService from "../../../services/storage/storage"

export default async function handler(req, res) {
    const storage = new StorageService({ bucketType: 'restricted' });

    const rooms = await RoomType.findAll();

    if (rooms) {
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