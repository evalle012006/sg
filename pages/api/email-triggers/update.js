import { EmailTrigger, Supplier } from '../../../models';

export default async function handler(req, res) {
    const email = req.body;

    const [data, created] = await EmailTrigger.upsert({
        ...email
    });

    return res.status(200).json({ success: true,  email: data});
}
