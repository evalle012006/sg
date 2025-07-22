import { NotificationLibrary } from '../../../models';

export default async function handler(req, res) {
    const notif = req.body;

    const [data, created] = await NotificationLibrary.upsert({
        ...notif
    });

    return res.status(200).json({ success: true,  data: data});
}
