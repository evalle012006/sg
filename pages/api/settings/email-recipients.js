// pages/api/settings/email-recipients.js
import { Setting } from '../../../models';

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Get all email recipient settings
            const emailSettings = await Setting.findAll({
                where: {
                    attribute: [
                        'email_eoi_recipients',
                        'email_admin_recipients',
                        'email_info_recipients'
                    ]
                },
                order: [['attribute', 'ASC']]
            });

            // Transform to object format with parsed email arrays
            const settings = {};
            emailSettings.forEach(setting => {
                const emails = setting.value ? 
                    setting.value.split(',').map(e => e.trim()).filter(e => e) : 
                    [];
                
                settings[setting.attribute] = {
                    id: setting.id,
                    attribute: setting.attribute,
                    emails,
                    raw_value: setting.value
                };
            });

            return res.status(200).json(settings);
        }

        if (req.method === 'PUT') {
            const { attribute, emails } = req.body;

            // Validation
            if (!attribute) {
                return res.status(400).json({ 
                    message: 'Attribute is required' 
                });
            }

            if (!['email_eoi_recipients', 'email_admin_recipients', 'email_info_recipients'].includes(attribute)) {
                return res.status(400).json({ 
                    message: 'Invalid attribute type' 
                });
            }

            if (!Array.isArray(emails)) {
                return res.status(400).json({ 
                    message: 'Emails must be an array' 
                });
            }

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            const invalidEmails = emails.filter(email => !emailRegex.test(email));
            
            if (invalidEmails.length > 0) {
                return res.status(400).json({ 
                    message: `Invalid email format: ${invalidEmails.join(', ')}` 
                });
            }

            // Convert array to comma-separated string
            const value = emails.join(',');

            // Check if setting exists
            const existing = await Setting.findOne({
                where: { attribute }
            });

            let setting;
            if (existing) {
                // Update existing
                await existing.update({
                    value,
                    updated_at: new Date()
                });
                setting = existing;
            } else {
                // Create new
                setting = await Setting.create({
                    attribute,
                    value,
                    created_at: new Date(),
                    updated_at: new Date()
                });
            }

            return res.status(200).json({
                message: 'Email recipients updated successfully',
                setting: {
                    id: setting.id,
                    attribute: setting.attribute,
                    emails,
                    raw_value: setting.value
                }
            });
        }

        return res.status(405).json({ message: 'Method not allowed' });

    } catch (error) {
        console.error('API error:', error);
        return res.status(500).json({ 
            message: 'Server error', 
            error: error.message 
        });
    }
}