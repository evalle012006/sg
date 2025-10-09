import { EmailTemplate } from '../../../models';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  const { id } = req.query;

  if (req.method === 'GET') {
    try {
      const template = await EmailTemplate.findByPk(id);
      
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      
      return res.status(200).json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  if (req.method === 'PUT') {
    try {
      const { name, subject, description, html_content, json_design, preview_image, is_active } = req.body;
      
      const template = await EmailTemplate.findByPk(id);
      
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      
      await template.update({
        name,
        subject,
        description,
        html_content,
        json_design,
        preview_image,
        is_active
      });
      
      return res.status(200).json({ success: true, data: template });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const template = await EmailTemplate.findByPk(id);
      
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }
      
      // Check if template is being used by any triggers
      const triggerCount = await template.countTriggers();
      
      if (triggerCount > 0) {
        return res.status(400).json({ 
          success: false, 
          message: `Cannot delete template. It is being used by ${triggerCount} trigger(s).` 
        });
      }
      
      await template.destroy();
      
      return res.status(200).json({ success: true, message: 'Template deleted successfully' });
    } catch (error) {
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}