/**
 * API Endpoint: System Email Triggers Management
 * 
 * Provides CRUD operations for system email triggers and context information.
 * 
 * Location: pages/api/system-triggers/index.js
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]';
import { EmailTrigger, EmailTemplate } from '../../../models';
import SystemTriggerService from '../../../services/systemTriggerService';
import { 
  TRIGGER_CONTEXTS, 
  getContextsByCategory,
  getMergeTagsForContext,
  getConditionsForContext 
} from '../../../services/triggerContextRegistry';

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  
  if (!session) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  // ============================================================
  // GET - List all system triggers or get context information
  // ============================================================
  if (req.method === 'GET') {
    const { context, action } = req.query;

    try {
      // Get context information (for UI)
      if (action === 'contexts') {
        const contextsByCategory = getContextsByCategory();
        return res.status(200).json({
          success: true,
          data: contextsByCategory
        });
      }

      // Get merge tags for a specific context
      if (action === 'merge-tags' && context) {
        const mergeTags = getMergeTagsForContext(context);
        return res.status(200).json({
          success: true,
          data: mergeTags
        });
      }

      // Get conditions for a specific context
      if (action === 'conditions' && context) {
        const conditions = getConditionsForContext(context);
        return res.status(200).json({
          success: true,
          data: conditions
        });
      }

      // Get all system triggers
      const whereClause = { type: 'system' };
      if (context) {
        whereClause.trigger_context = context;
      }

      const triggers = await EmailTrigger.findAll({
        where: whereClause,
        include: [
          {
            model: EmailTemplate,
            as: 'template'
          }
        ],
        order: [
          ['trigger_context', 'ASC'],
          ['priority', 'DESC']
        ]
      });

      // Group by context for easier UI rendering
      const grouped = {};
      triggers.forEach(trigger => {
        const ctx = trigger.trigger_context || 'uncategorized';
        if (!grouped[ctx]) {
          grouped[ctx] = [];
        }
        grouped[ctx].push(trigger);
      });

      return res.status(200).json({
        success: true,
        data: {
          triggers,
          grouped
        }
      });

    } catch (error) {
      console.error('Error fetching system triggers:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================================
  // POST - Create a new system trigger
  // ============================================================
  if (req.method === 'POST') {
    try {
      const trigger = await SystemTriggerService.createSystemTrigger(req.body);

      // Fetch with template
      const triggerWithTemplate = await EmailTrigger.findByPk(trigger.id, {
        include: [{ model: EmailTemplate, as: 'template' }]
      });

      return res.status(201).json({
        success: true,
        data: triggerWithTemplate
      });

    } catch (error) {
      console.error('Error creating system trigger:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================================
  // PUT - Update an existing system trigger
  // ============================================================
  if (req.method === 'PUT') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Trigger ID required'
      });
    }

    try {
      const trigger = await SystemTriggerService.updateSystemTrigger(parseInt(id), req.body);

      // Fetch with template
      const triggerWithTemplate = await EmailTrigger.findByPk(trigger.id, {
        include: [{ model: EmailTemplate, as: 'template' }]
      });

      return res.status(200).json({
        success: true,
        data: triggerWithTemplate
      });

    } catch (error) {
      console.error('Error updating system trigger:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // ============================================================
  // DELETE - Delete a system trigger
  // ============================================================
  if (req.method === 'DELETE') {
    const { id } = req.query;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: 'Trigger ID required'
      });
    }

    try {
      const trigger = await EmailTrigger.findByPk(id);

      if (!trigger) {
        return res.status(404).json({
          success: false,
          message: 'Trigger not found'
        });
      }

      if (trigger.type !== 'system') {
        return res.status(400).json({
          success: false,
          message: 'Can only delete system triggers through this endpoint'
        });
      }

      await trigger.destroy();

      return res.status(200).json({
        success: true,
        message: 'Trigger deleted successfully'
      });

    } catch (error) {
      console.error('Error deleting system trigger:', error);
      return res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: 'Method not allowed'
  });
}