import { EmailTrigger } from '../../../models'

export default async function handler(req, res) {

    const emailTriggers = await EmailTrigger.findAll();

    return res.status(200).json(emailTriggers);
}