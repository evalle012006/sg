import { EmailTrigger } from '../../../models'
export default async function handler(req, res) {
    const { id } = req.query;

    const email = await EmailTrigger.findOne({ where: { id: id } });

    return res.status(200).json({ success: true, data: email });
}
