import { EmailTemplate } from '../../../models';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  if (req.method === 'GET') {
    try {
      const { type, active } = req.query;
      
      const where = {};
      if (type) where.template_type = type;
      if (active !== undefined) where.is_active = active === 'true';
      
      const templates = await EmailTemplate.findAll({
        where,
        order: [['created_at', 'DESC']]
      });
      
      return res.status(200).json({ success: true, data: templates });
    } catch (error) {
      console.error('Error fetching email templates:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  if (req.method === 'POST') {
    try {
      const { name, subject, description, html_content, json_design, preview_image } = req.body;
      
      const template = await EmailTemplate.create({
        name,
        subject,
        description,
        html_content,
        json_design,
        preview_image,
        created_by: session.user.id,
        template_type: 'custom'
      });
      
      return res.status(201).json({ success: true, data: template });
    } catch (error) {
      console.error('Error creating email template:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}