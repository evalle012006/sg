import { Package } from '../../../models'

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      // Extract query parameters for filtering
      const { funder, ndis_package_type, limit, offset } = req.query;
      
      // Build where clause based on query parameters
      const whereClause = {};
      
      // Filter by funder type
      if (funder && ['NDIS', 'Non-NDIS'].includes(funder)) {
        whereClause.funder = funder;
      }
      
      // Filter by NDIS package type (only applicable for NDIS packages)
      if (ndis_package_type && ['sta', 'holiday'].includes(ndis_package_type)) {
        whereClause.ndis_package_type = ndis_package_type;
        // Ensure we only look at NDIS packages when filtering by NDIS package type
        whereClause.funder = 'NDIS';
      }
      
      // Build query options
      const queryOptions = {
        where: whereClause,
        order: [['created_at', 'DESC']]
      };
      
      // Add pagination if provided
      if (limit) {
        queryOptions.limit = parseInt(limit);
      }
      
      if (offset) {
        queryOptions.offset = parseInt(offset);
      }
      
      // List packages based on filters
      const packages = await Package.findAll(queryOptions);
      
      // Get total count for pagination (if limit is specified)
      let totalCount = null;
      if (limit) {
        totalCount = await Package.count({ where: whereClause });
      }

      // Transform packages data for frontend
      const transformedPackages = packages.map(pkg => {
        const packageData = pkg.dataValues;
        
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

        return packageData;
      });

      return res.status(200).json({
        success: true,
        packages: transformedPackages,
        // Include pagination info if limit was specified
        ...(limit && {
          pagination: {
            total: totalCount,
            limit: parseInt(limit),
            offset: parseInt(offset) || 0,
            hasMore: (parseInt(offset) || 0) + parseInt(limit) < totalCount
          }
        }),
        // Include applied filters
        filters: {
          funder: funder || null,
          ndis_package_type: ndis_package_type || null
        }
      });

    } else if (req.method === 'POST') {
      // Create new package
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

      // Prepare package data based on funder type
      const packageData = {
        name: name.trim(),
        package_code: package_code.trim(),
        funder: funder.trim(),
        created_at: new Date(),
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

        // Set NDIS data
        packageData.ndis_package_type = ndis_package_type;
        packageData.ndis_line_items = ndis_line_items.map(item => ({
          sta_package: item.sta_package.trim(),
          line_item: item.line_item.trim(),
          price_per_night: parseFloat(item.price_per_night)
        }));
        packageData.price = null; // No price field for NDIS packages

      } else if (funder === 'Non-NDIS') {
        // Validate Non-NDIS specific fields
        if (typeof price !== 'number' || price < 0) {
          return res.status(400).json({
            success: false,
            error: 'Valid price is required for Non-NDIS packages'
          });
        }

        // Set Non-NDIS data
        packageData.price = parseFloat(price);
        packageData.ndis_package_type = null;
        packageData.ndis_line_items = [];
      }

      // Create package
      const newPackage = await Package.create(packageData);

      return res.status(201).json({
        success: true,
        message: 'Package created successfully',
        package: newPackage.dataValues
      });

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

    // Handle unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({
        success: false,
        error: 'Package with this name already exists'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}