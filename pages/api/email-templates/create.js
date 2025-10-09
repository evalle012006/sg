import { EmailTrigger, EmailTemplate } from '../../../models';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const {
      recipient,
      email_template_id,
      trigger_questions,
      trigger_conditions,
      type,
      enabled = true
    } = req.body;

    // Validate email template exists
    if (email_template_id) {
      const template = await EmailTemplate.findByPk(email_template_id);
      if (!template) {
        return res.status(400).json({ 
          success: false, 
          message: 'Email template not found' 
        });
      }
    }

    const emailTrigger = await EmailTrigger.create({
      recipient,
      email_template_id,
      trigger_questions,
      trigger_conditions,
      type,
      enabled
    });

    // Fetch the trigger with template data
    const triggerWithTemplate = await EmailTrigger.findByPk(emailTrigger.id, {
      include: [{ model: EmailTemplate, as: 'template' }]
    });

    return res.status(201).json({ 
      success: true, 
      data: triggerWithTemplate 
    });
  } catch (error) {
    console.error('Error creating email trigger:', error);
    return res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
}