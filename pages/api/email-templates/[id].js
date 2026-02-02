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

      // ✅ PROTECTION: Prevent deactivating system templates
      if (template.is_system && template.is_active && !is_active) {
        return res.status(403).json({
          success: false,
          error: 'Cannot deactivate system template',
          message: 'This template is required by the system and cannot be deactivated. You can modify its appearance but must keep it active.',
          is_system: true
        });
      }

      // ✅ PROTECTION: Validate required variables for system templates
      if (template.is_system && template.required_variables && template.required_variables.length > 0) {
        // Create a temporary template instance to validate
        const tempTemplate = await EmailTemplate.build({
          ...template.dataValues,
          html_content: html_content
        });

        const validation = tempTemplate.validateRequiredVariables();
        
        if (!validation.valid) {
          return res.status(400).json({
            success: false,
            error: 'Required variables missing',
            message: `The following required variables must be present in the template: ${validation.missing.join(', ')}`,
            missing_variables: validation.missing,
            required_variables: template.required_variables,
            variable_descriptions: template.variable_description,
            is_system: true
          });
        }
      }

      // ✅ PROTECTION: Prevent changing template_code for system templates
      const updateData = {
        name,
        subject,
        description,
        html_content,
        json_design,
        preview_image,
        is_active
      };

      // Only allow updating non-system fields
      await template.update(updateData);
      
      return res.status(200).json({ 
        success: true, 
        data: template,
        message: 'Template updated successfully'
      });
    } catch (error) {
      console.error('Error updating template:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const template = await EmailTemplate.findByPk(id);
      
      if (!template) {
        return res.status(404).json({ success: false, message: 'Template not found' });
      }

      // ✅ PROTECTION: Prevent deletion of system templates
      if (template.is_system) {
        return res.status(403).json({
          success: false,
          error: 'Cannot delete system template',
          message: 'This template is required by the system and cannot be deleted. You can only modify its appearance.',
          template_code: template.template_code,
          is_system: true
        });
      }
      
      // Check if template is being used by any triggers
      const triggerCount = await template.countTriggers();
      
      if (triggerCount > 0) {
        return res.status(400).json({ 
          success: false,
          error: 'Template in use',
          message: `Cannot delete template. It is being used by ${triggerCount} trigger(s). Please remove or reassign these triggers first.`,
          trigger_count: triggerCount
        });
      }
      
      await template.destroy();
      
      return res.status(200).json({ 
        success: true, 
        message: 'Template deleted successfully' 
      });
    } catch (error) {
      console.error('Error deleting template:', error);
      return res.status(500).json({ success: false, message: error.message });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}