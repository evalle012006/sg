import { RoomType } from '../../../models'
import StorageService from "../../../services/storage/storage"

export default async function handler(req, res) {
    const { uuid } = req.query;

    const storage = new StorageService({ bucketType: 'restricted' });

    const room = await RoomType.findOne({ where: { id: uuid } });
    let updatedRoom;
    if (room) {
        updatedRoom = room;
        await new Promise(async (resolve) => {
            let url = '';
            if (room.image_filename) {
                url = await storage.getSignedUrl('room-type-photo/' + room.image_filename);
                updatedRoom = {...room.dataValues, url: url};
            }

            resolve(url);
        });
    }

    return res.status(200).json(updatedRoom);
}
