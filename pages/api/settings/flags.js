// pages/api/settings/flags.js
import { Setting } from '../../../models';
import { Op } from 'sequelize';

export default async function handler(req, res) {
    try {
        if (req.method === 'GET') {
            // Get all guest_flag and booking_flag settings
            const flags = await Setting.findAll({
                where: {
                    attribute: ['guest_flag', 'booking_flag']
                },
                order: [['attribute', 'ASC'], ['value', 'ASC']]
            });

            // Group by attribute type
            const grouped = {
                guest_flags: flags.filter(f => f.attribute === 'guest_flag'),
                booking_flags: flags.filter(f => f.attribute === 'booking_flag')
            };

            return res.status(200).json(grouped);
        }

        if (req.method === 'POST') {
            const { attribute, value } = req.body;

            // Validation
            if (!attribute || !value) {
                return res.status(400).json({ 
                    message: 'Attribute and value are required' 
                });
            }

            if (!['guest_flag', 'booking_flag'].includes(attribute)) {
                return res.status(400).json({ 
                    message: 'Invalid attribute type. Must be guest_flag or booking_flag' 
                });
            }

            // Check if flag already exists
            const existing = await Setting.findOne({
                where: { attribute, value }
            });

            if (existing) {
                return res.status(409).json({ 
                    message: 'This flag already exists' 
                });
            }

            // Create new flag
            const newFlag = await Setting.create({
                attribute,
                value: value.trim(),
                created_at: new Date(),
                updated_at: new Date()
            });

            return res.status(201).json({
                message: 'Flag created successfully',
                flag: newFlag
            });
        }

        if (req.method === 'PUT') {
            const { id, value } = req.body;

            if (!id || !value) {
                return res.status(400).json({ 
                    message: 'ID and value are required' 
                });
            }

            const flag = await Setting.findByPk(id);

            if (!flag) {
                return res.status(404).json({ 
                    message: 'Flag not found' 
                });
            }

            // Check if new value already exists for this attribute
            const existing = await Setting.findOne({
                where: { 
                    attribute: flag.attribute, 
                    value,
                    id: { [Op.ne]: id }
                }
            });

            if (existing) {
                return res.status(409).json({ 
                    message: 'A flag with this value already exists' 
                });
            }

            await flag.update({
                value: value.trim(),
                updated_at: new Date()
            });

            return res.status(200).json({
                message: 'Flag updated successfully',
                flag
            });
        }

        if (req.method === 'DELETE') {
            const { id } = req.body;

            if (!id) {
                return res.status(400).json({ 
                    message: 'ID is required' 
                });
            }

            const flag = await Setting.findByPk(id);

            if (!flag) {
                return res.status(404).json({ 
                    message: 'Flag not found' 
                });
            }

            await flag.destroy();

            return res.status(200).json({
                message: 'Flag deleted successfully'
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