import { Package } from "../../../models";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // Find the package first - with explicit attribute selection to avoid timestamp issues
    const packageResult = await Package.findByPk(id, {
      attributes: [
        'id', 
        'name', 
        'package_code', 
        'funder', 
        'price', 
        'ndis_package_type', 
        'ndis_line_items', 
        'image_filename',
        'created_at',
        'updated_at'
      ]
    });
    
    if (!packageResult) {
      return res.status(404).json({
        success: false,
        error: 'Package not found'
      });
    }

    if (req.method === 'GET') {
      const packageData = packageResult.dataValues;
      
      // Ensure ndis_line_items is properly formatted as array
      if (packageData.ndis_line_items && typeof packageData.ndis_line_items === 'string') {
        try {
          packageData.ndis_line_items = JSON.parse(packageData.ndis_line_items);
        } catch (e) {
          packageData.ndis_line_items = [];
        }
      } else if (!packageData.ndis_line_items) {
        packageData.ndis_line_items = [];
      }

      // Ensure ndis_line_items have the new fields with defaults
      packageData.ndis_line_items = packageData.ndis_line_items.map(item => ({
        sta_package: item.sta_package || '',
        line_item: item.line_item || '',
        price_per_night: item.price_per_night || 0,
        rate_type: item.rate_type || '',
        rate_category: item.rate_category || 'day',
        line_item_type: item.line_item_type || '',
        care_time: item.care_time || ''
      }));

      return res.status(200).json({
        success: true,
        package: packageData
      });

    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      // Update package
      const { name, package_code, funder, price, ndis_package_type, ndis_line_items, image_filename } = req.body;

      // Basic validation
      if (!name || !name.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Package name is required'
        });
      }

      if (!package_code || !package_code.trim()) {
        return res.status(400).json({
          success: false,
          error: 'Package code is required'
        });
      }

      if (!funder || !['NDIS', 'Non-NDIS'].includes(funder)) {
        return res.status(400).json({
          success: false,
          error: 'Valid funder is required (NDIS or Non-NDIS)'
        });
      }

      // Prepare update data based on funder type
      const updateData = {
        name: name.trim(),
        package_code: package_code.trim(),
        funder: funder.trim(),
        image_filename: image_filename || null
      };

      if (funder === 'NDIS') {
        // Validate NDIS-specific fields
        if (!ndis_package_type || !['sta', 'holiday', 'holiday-plus'].includes(ndis_package_type)) {
          return res.status(400).json({
            success: false,
            error: 'Valid NDIS package type is required (sta, holiday, or holiday-plus)'
          });
        }

        if (!ndis_line_items || !Array.isArray(ndis_line_items) || ndis_line_items.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'At least one line item is required for NDIS packages'
          });
        }

        // Validate line items with new fields
        for (let i = 0; i < ndis_line_items.length; i++) {
          const item = ndis_line_items[i];
          
          if (!item.line_item || !item.line_item.trim()) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Line item description is required`
            });
          }
          
          if (typeof item.price_per_night !== 'number' || item.price_per_night < 0) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Valid price per night is required`
            });
          }

          if (item.rate_type && !['', 'weekday', 'saturday', 'sunday', 'public_holiday'].includes(item.rate_type)) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Valid rate type is required (blank for all days, weekday, saturday, sunday, public_holiday)`
            });
          }

          // Validate new fields
          if (!item.rate_category || !['day', 'hour', 'night'].includes(item.rate_category)) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Valid rate category is required (day, hour, or night)`
            });
          }

          if (item.line_item_type && !['', 'care', 'course', 'room', 'group_activities', 'sleep_over'].includes(item.line_item_type)) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Valid line item type is required (blank, care, course, room, group_activities, or sleep_over)`
            });
          }

          if (item.care_time && !['', 'morning', 'afternoon', 'evening'].includes(item.care_time)) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Valid care time is required (blank, morning, afternoon, or evening)`
            });
          }

          // If line_item_type is not 'care', care_time should be empty
          if (item.line_item_type !== 'care' && item.care_time) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1}: Care time can only be set when line item type is 'care'`
            });
          }
        }

        updateData.ndis_package_type = ndis_package_type;
        updateData.ndis_line_items = ndis_line_items.map(item => ({
          sta_package: item.sta_package || '',
          line_item: item.line_item || '',
          price_per_night: item.price_per_night || 0,
          rate_type: item.rate_type || '',
          rate_category: item.rate_category || 'day',
          line_item_type: item.line_item_type || '',
          care_time: item.care_time || ''
        }));
        updateData.price = null; // NDIS packages don't have direct prices
      } else {
        // Non-NDIS package
        if (!price || isNaN(parseFloat(price)) || parseFloat(price) < 0) {
          return res.status(400).json({
            success: false,
            error: 'Valid price is required for Non-NDIS packages'
          });
        }

        updateData.price = parseFloat(price);
        updateData.ndis_package_type = null;
        updateData.ndis_line_items = [];
      }

      // Update package
      await packageResult.update(updateData);

      // Fetch updated package to return - with explicit attributes
      await packageResult.reload({
        attributes: [
          'id', 
          'name', 
          'package_code', 
          'funder', 
          'price', 
          'ndis_package_type', 
          'ndis_line_items', 
          'image_filename',
          'created_at',
          'updated_at'
        ]
      });

      return res.status(200).json({
        success: true,
        message: 'Package updated successfully',
        package: packageResult.dataValues
      });

    } else if (req.method === 'DELETE') {
      // Delete package
      try {
        await packageResult.destroy();
        
        return res.status(200).json({
          success: true,
          message: 'Package deleted successfully'
        });
      } catch (deleteError) {
        // Handle foreign key constraints
        if (deleteError.name === 'SequelizeForeignKeyConstraintError') {
          return res.status(500).json({
            success: false,
            error: 'Cannot delete package',
            message: 'Cannot delete this package as it is associated with existing bookings or other records.'
          });
        }
        throw deleteError;
      }

    } else {
      return res.status(405).json({
        success: false,
        error: 'Method not allowed'
      });
    }

  } catch (error) {
    console.error('Package API Error:', error);
    
    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        message: error.errors.map(e => e.message).join(', ')
      });
    }

    // Handle Sequelize database errors
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(500).json({
        success: false,
        error: 'Database error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Database operation failed'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}