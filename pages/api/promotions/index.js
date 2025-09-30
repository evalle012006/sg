import { Promotion } from '../../../models';
import { Op } from 'sequelize';
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
  const storage = new StorageService({ bucketType: 'restricted' });

  if (req.method === 'GET') {
    try {
      const { status, includeArchived } = req.query;

      // Build where clause
      const whereClause = {};
      
      if (status) {
        whereClause.status = status;
      } else if (!includeArchived || includeArchived === 'false') {
        // By default, exclude archived promotions
        whereClause.status = {
          [Op.ne]: 'archived'
        };
      }

      const promotions = await Promotion.findAll({
        where: whereClause,
        order: [
          ['order', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      // Generate signed URLs for promotion images
      const updatedPromotions = await Promise.all(
        promotions.map(async promotion => {
          let temp = { ...promotion.dataValues };
          if (promotion.image_filename) {
            try {
              // Generate signed URL for promotion image
              temp.imageUrl = await storage.getSignedUrl('promotions/' + promotion.image_filename);
            } catch (error) {
              console.error('Error generating signed URL for promotion image:', error);
              temp.imageUrl = null; // Fallback if URL generation fails
            }
          }
          return temp;
        })
      );

      return res.status(200).json({
        success: true,
        promotions: updatedPromotions
      });
    } catch (error) {
      console.error('Error fetching promotions:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch promotions',
        error: error.message
      });
    }
  }

  if (req.method === 'POST') {
    try {
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
      if (!title || title.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Title is required'
        });
      }

      // Create promotion
      const promotion = await Promotion.create({
        title: title.trim(),
        description: description?.trim() || null,
        availability: availability?.trim() || null,
        terms: terms?.trim() || null,
        start_date: start_date || null,
        end_date: end_date || null,
        image_filename: image_filename || null,
        status: status || 'draft',
        order: order || 0
      });

      // Generate signed URL for the created promotion
      let promotionData = { ...promotion.dataValues };
      if (promotion.image_filename) {
        try {
          promotionData.imageUrl = await storage.getSignedUrl('promotions/' + promotion.image_filename);
        } catch (error) {
          console.error('Error generating signed URL for promotion image:', error);
          promotionData.imageUrl = null;
        }
      }

      return res.status(201).json({
        success: true,
        message: 'Promotion created successfully',
        data: promotionData
      });
    } catch (error) {
      console.error('Error creating promotion:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to create promotion',
        error: error.message
      });
    }
  }

  return res.status(405).json({
    success: false,
    message: `Method ${req.method} not allowed`
  });
}