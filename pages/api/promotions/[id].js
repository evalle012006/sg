import { Promotion } from '../../../models';
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
  const { id } = req.query;
  const storage = new StorageService({ bucketType: 'restricted' });

  if (req.method === 'GET') {
    try {
      const promotion = await Promotion.findByPk(id);

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found'
        });
      }

      let promotionData = { ...promotion.dataValues };
      
      // Generate signed URL for image if it exists
      if (promotion.image_filename) {
        try {
          promotionData.imageUrl = await storage.getSignedUrl('promotions/' + promotion.image_filename);
        } catch (error) {
          console.error('Error generating signed URL for promotion image:', error);
          promotionData.imageUrl = null; // Fallback if URL generation fails
        }
      }

      return res.status(200).json({
        success: true,
        data: promotionData
      });
    } catch (error) {
      console.error('Error fetching promotion:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch promotion',
        error: error.message
      });
    }
  }

  if (req.method === 'PUT') {
    try {
      const promotion = await Promotion.findByPk(id);

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found'
        });
      }

      const {
        title,
        description,
        availability,
        terms,
        start_date,
        end_date,
        image_filename,
        status,
        order
      } = req.body;

      // Validation
      if (title !== undefined && (!title || title.trim() === '')) {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      // Update promotion
      const updateData = {};
      if (title !== undefined) updateData.title = title.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (availability !== undefined) updateData.availability = availability?.trim() || null;
      if (terms !== undefined) updateData.terms = terms?.trim() || null;
      if (start_date !== undefined) updateData.start_date = start_date || null;
      if (end_date !== undefined) updateData.end_date = end_date || null;
      if (image_filename !== undefined) updateData.image_filename = image_filename || null;
      if (status !== undefined) updateData.status = status;
      if (order !== undefined) updateData.order = order;

      await promotion.update(updateData);

      // Generate signed URL for the updated promotion
      let promotionData = { ...promotion.dataValues };
      if (promotion.image_filename) {
        try {
          promotionData.imageUrl = await storage.getSignedUrl('promotions/' + promotion.image_filename);
        } catch (error) {
          console.error('Error generating signed URL for promotion image:', error);
          promotionData.imageUrl = null;
        }
      }

      return res.status(200).json({
        success: true,
        message: 'Promotion updated successfully',
        data: promotionData
      });
    } catch (error) {
      console.error('Error updating promotion:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to update promotion',
        error: error.message
      });
    }
  }

  if (req.method === 'DELETE') {
    try {
      const promotion = await Promotion.findByPk(id);

      if (!promotion) {
        return res.status(404).json({
          success: false,
          message: 'Promotion not found'
        });
      }

      // Delete associated image file if it exists
      if (promotion.image_filename) {
        try {
          await storage.deleteFile('promotions/' + promotion.image_filename);
        } catch (error) {
          console.error('Error deleting promotion image:', error);
          // Continue with promotion deletion even if image deletion fails
        }
      }

      // Hard delete the promotion
      await promotion.destroy();

      return res.status(200).json({
        success: true,
        message: 'Promotion deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting promotion:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to delete promotion',
        error: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`
  });
}