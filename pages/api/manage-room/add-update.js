import { Checklist, ChecklistAction, RoomType } from '../../../models';

export default async function handler(req, res) {
    const room = req.body;

    const [data, created] = await RoomType.upsert({
        ...room
    });

    return res.status(200).json({ success: true,  room: data});
}
