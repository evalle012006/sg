import { Package, PackageRequirement } from '../../../models';
import { Op } from 'sequelize';

export default async function handler(req, res) {
  // Handle POST - Create new package
  if (req.method === 'POST') {
    try {
      const { 
        name, 
        package_code, 
        funder, 
        price, 
        ndis_package_type, 
        description, 
        ndis_line_items,
        image_filename 
      } = req.body;

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

      // Check for duplicate package_code
      const existingPackage = await Package.findOne({
        where: { package_code: package_code.trim() }
      });

      if (existingPackage) {
        return res.status(409).json({
          success: false,
          error: 'A package with this code already exists'
        });
      }

      // Prepare create data based on funder type
      const createData = {
        name: name.trim(),
        package_code: package_code.trim(),
        description: description ? description.trim() : null,
        funder: funder.trim(),
        image_filename: image_filename || null
      };

      if (funder === 'NDIS') {
        // Validate NDIS-specific fields
        if (!ndis_package_type || !['sta', 'holiday'].includes(ndis_package_type)) {
          return res.status(400).json({
            success: false,
            error: 'Valid NDIS package type is required (sta or holiday)'
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
          if (!item.sta_package || !item.line_item) {
            return res.status(400).json({
              success: false,
              error: `Line item ${i + 1} is missing required fields (STA package and line item)`
            });
          }
        }

        createData.ndis_package_type = ndis_package_type;
        createData.ndis_line_items = ndis_line_items.map(item => ({
          sta_package: item.sta_package?.trim() || '',
          line_item: item.line_item?.trim() || '',
          price_per_night: parseFloat(item.price_per_night) || 0,
          rate_type: item.rate_type || '',
          rate_category: item.rate_category || 'day',
          line_item_type: item.line_item_type || '',
          care_time: item.care_time || ''
        }));
        createData.price = null; // NDIS packages don't have a flat price
      } else {
        // Non-NDIS package
        createData.price = parseFloat(price) || 0;
        createData.ndis_package_type = null;
        createData.ndis_line_items = [];
      }

      // Create the package
      const newPackage = await Package.create(createData);

      console.log('✅ Package created successfully:', {
        id: newPackage.id,
        name: newPackage.name,
        package_code: newPackage.package_code
      });

      return res.status(201).json({
        success: true,
        message: 'Package created successfully',
        package: {
          id: newPackage.id,
          name: newPackage.name,
          package_code: newPackage.package_code,
          funder: newPackage.funder,
          price: newPackage.price,
          ndis_package_type: newPackage.ndis_package_type,
          description: newPackage.description,
          ndis_line_items: newPackage.ndis_line_items,
          image_filename: newPackage.image_filename,
          created_at: newPackage.created_at,
          updated_at: newPackage.updated_at
        }
      });

    } catch (error) {
      console.error('❌ Error creating package:', error);
      
      // Handle Sequelize validation errors
      if (error.name === 'SequelizeValidationError') {
        const validationErrors = error.errors.map(e => e.message).join(', ');
        return res.status(400).json({
          success: false,
          error: validationErrors
        });
      }

      // Handle unique constraint errors
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({
          success: false,
          error: 'A package with this code already exists'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Failed to create package',
        message: error.message
      });
    }
  }

  // Handle GET - List packages with filtering
  if (req.method === 'GET') {
    try {
      const { 
        funder, 
        ndis_package_type,
        priceRange,
        search,
        include_requirements = 'false',
        page = 1,
        limit = 50,
        sort = 'name'
      } = req.query;

      // Build the where clause for filtering
      const whereClause = {};
      const orderClause = [];

      // Apply funder filter
      if (funder) {
        whereClause.funder = funder;
        console.log(`📤 Added funder filter: ${funder}`);
      }

      // Apply NDIS package type filter correctly
      if (funder === 'NDIS' && ndis_package_type) {
        whereClause.ndis_package_type = ndis_package_type;
      }

      // Apply search filter
      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { package_code: { [Op.like]: `%${search}%` } }
        ];
      }

      // Apply price range filter for Non-NDIS packages only
      if (priceRange && funder !== 'NDIS') {
        try {
          const { min, max } = JSON.parse(priceRange);
          if (min !== undefined || max !== undefined) {
            whereClause.price = {};
            if (min !== undefined) whereClause.price[Op.gte] = min;
            if (max !== undefined) whereClause.price[Op.lte] = max;
          }
        } catch (error) {
          console.error('Invalid price range format:', priceRange);
        }
      }

      // Set up ordering
      switch (sort) {
        case 'name':
          orderClause.push(['name', 'ASC']);
          break;
        case 'price':
          orderClause.push(['price', 'ASC']);
          break;
        case 'funder':
          orderClause.push(['funder', 'ASC'], ['name', 'ASC']);
          break;
        default:
          orderClause.push(['name', 'ASC']);
      }

      // Set up query options
      const queryOptions = {
        where: whereClause,
        attributes: [
          'id', 
          'name', 
          'package_code', 
          'funder', 
          'price', 
          'ndis_package_type',
          'description',
          'ndis_line_items',
          'image_filename',
          'created_at',
          'updated_at'
        ],
        order: orderClause,
        limit: parseInt(limit),
        offset: (parseInt(page) - 1) * parseInt(limit),
        distinct: true
      };

      // Include requirements if requested
      if (include_requirements === 'true') {
        queryOptions.include = [{
          model: PackageRequirement,
          as: 'requirements',
          required: false
        }];
      }

      // Execute query
      const { count, rows: packages } = await Package.findAndCountAll(queryOptions);

      // Verify filtering worked correctly
      if (ndis_package_type && funder === 'NDIS') {
        const wrongType = packages.filter(p => p.ndis_package_type !== ndis_package_type);
        if (wrongType.length > 0) {
          console.error('❌ DATABASE FILTERING FAILED: Wrong ndis_package_type returned:', 
            wrongType.map(p => ({
              code: p.package_code,
              expected: ndis_package_type,
              actual: p.ndis_package_type
            }))
          );
        }
      }
      
      // Calculate total pages
      const totalPages = Math.ceil(count / parseInt(limit));

      // Transform packages for response
      const transformedPackages = packages.map(pkg => {
        const packageData = pkg.toJSON ? pkg.toJSON() : pkg;
        
        const transformed = {
          id: packageData.id,
          name: packageData.name,
          package_code: packageData.package_code,
          funder: packageData.funder,
          price: packageData.price,
          ndis_package_type: packageData.ndis_package_type,
          description: packageData.description,
          ndis_line_items: packageData.ndis_line_items,
          image_filename: packageData.image_filename,
          created_at: packageData.created_at,
          updated_at: packageData.updated_at
        };

        // Include requirement data if requested
        if (include_requirements === 'true' && packageData.requirements && packageData.requirements.length > 0) {
          const requirement = packageData.requirements[0];
          transformed.requirement = {
            ...requirement,
            care_hours_range: {
              min: requirement.care_hours_min,
              max: requirement.care_hours_max
            }
          };
        }

        // Format price display
        if (packageData.funder === 'NDIS') {
          if (packageData.ndis_line_items && packageData.ndis_line_items.length > 0) {
            const priceRange = packageData.ndis_line_items.map(item => parseFloat(item.price_per_night || 0));
            const minPrice = Math.min(...priceRange);
            const maxPrice = Math.max(...priceRange);
            transformed.formattedPrice = minPrice === maxPrice 
              ? `AUD ${minPrice}/night` 
              : `AUD ${minPrice}-AUD ${maxPrice}/night`;
          } else {
            transformed.formattedPrice = 'NDIS Funded';
          }
        } else {
          transformed.formattedPrice = packageData.price 
            ? `AUD ${parseFloat(packageData.price).toFixed(2)}/night`
            : 'Price on request';
        }

        return transformed;
      });

      return res.status(200).json({
        success: true,
        packages: transformedPackages,
        pagination: {
          total: count,
          totalPages,
          currentPage: parseInt(page),
          limit: parseInt(limit)
        }
      });

    } catch (error) {
      console.error('❌ Error fetching packages:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch packages',
        message: error.message
      });
    }
  }

  // Method not allowed for other HTTP methods
  return res.status(405).json({ 
    success: false, 
    error: 'Method not allowed. Use GET to list packages or POST to create a new package.' 
  });
}