import { EmailTrigger, EmailTemplate } from '../../../models';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  try {
    const emailTriggers = await EmailTrigger.findAll({
      include: [
        {
          model: EmailTemplate,
          as: 'template',
          attributes: ['id', 'name', 'subject', 'preview_image']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    return res.status(200).json(emailTriggers);
  } catch (error) {
    console.error('Error fetching email triggers:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
}