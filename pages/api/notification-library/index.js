import { NotificationLibrary } from '../../../models'

export default async function handler(req, res) {

    const notifs = await NotificationLibrary.findAll();

    return res.status(200).json(notifs);
}