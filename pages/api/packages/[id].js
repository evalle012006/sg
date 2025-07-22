import { Package } from "../../../models";

export default async function handler(req, res) {
  const { id } = req.query;

  try {
    // Find the package first
    const packageResult = await Package.findByPk(id);
    
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

      return res.status(200).json({
        success: true,
        package: packageData
      });

    } else if (req.method === 'PUT' || req.method === 'PATCH') {
      // Update package
      const { name, package_code, funder, price, ndis_package_type, ndis_line_items } = req.body;

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
        updated_at: new Date()
      };

      if (funder === 'NDIS') {
        // Validate NDIS-specific fields
        if (!ndis_package_type || !['sta', 'holiday'].includes(ndis_package_type)) {
          return res.status(400).json({
            success: false,
            error: 'Valid NDIS package type is required for NDIS packages (sta or holiday)'
          });
        }

        if (!ndis_line_items || !Array.isArray(ndis_line_items) || ndis_line_items.length === 0) {
          return res.status(400).json({
            success: false,
            error: 'At least one line item is required for NDIS packages'
          });
        }

        // Validate each line item
        for (let i = 0; i < ndis_line_items.length; i++) {
          const item = ndis_line_items[i];
          if (!item.sta_package || !item.sta_package.trim()) {
            return res.status(400).json({
              success: false,
              error: `STA Package is required for line item ${i + 1}`
            });
          }
          if (!item.line_item || !item.line_item.trim()) {
            return res.status(400).json({
              success: false,
              error: `Line Item is required for line item ${i + 1}`
            });
          }
          if (typeof item.price_per_night !== 'number' || item.price_per_night < 0) {
            return res.status(400).json({
              success: false,
              error: `Valid price per night is required for line item ${i + 1}`
            });
          }
        }

        // Clean and set NDIS data
        updateData.ndis_package_type = ndis_package_type;
        updateData.ndis_line_items = ndis_line_items.map(item => ({
          sta_package: item.sta_package.trim(),
          line_item: item.line_item.trim(),
          price_per_night: parseFloat(item.price_per_night)
        }));
        updateData.price = null; // Clear price for NDIS packages

      } else if (funder === 'Non-NDIS') {
        // Validate Non-NDIS specific fields
        if (typeof price !== 'number' || price < 0) {
          return res.status(400).json({
            success: false,
            error: 'Valid price is required for Non-NDIS packages'
          });
        }

        // Set Non-NDIS data
        updateData.price = parseFloat(price);
        updateData.ndis_package_type = null;
        updateData.ndis_line_items = [];
      }

      // Update package
      await packageResult.update(updateData);

      // Fetch updated package to return
      await packageResult.reload();

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

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}