import { NotificationLibrary } from '../../../models'
export default async function handler(req, res) {
    const { id } = req.query;

    const notif = await NotificationLibrary.findOne({ where: { id: id } });

    return res.status(200).json({ success: true, data: notif });
}
