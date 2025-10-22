import { Package, PackageRequirement } from '../../../models';
import { Op } from 'sequelize';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed' 
    });
  }

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

    // ✅ FIXED: Apply NDIS package type filter correctly
    if (funder === 'NDIS' && ndis_package_type) {
      // Simple 1:1 filtering - if holiday requested, only return holiday packages
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
        required: false // LEFT JOIN to include packages without requirements
      }];
    }

    // Execute query
    const { count, rows: packages } = await Package.findAndCountAll(queryOptions);

    // ✅ Verify filtering worked correctly
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
        const requirement = packageData.requirements[0]; // Should only be one requirement per package
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
          ? `AUD ${parseFloat(packageData.price).toFixed(2)}` 
          : 'Price TBA';
      }

      // Add summary and compatibility fields for frontend
      transformed.summary = generatePackageSummary(packageData, transformed.requirement);
      transformed.inclusions = Array.isArray(packageData.ndis_line_items) ? packageData.ndis_line_items : [];
      transformed.features = [];

      return transformed;
    });

    return res.status(200).json({
      success: true,
      packages: transformedPackages,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: totalPages
    });

  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Generate a human-readable summary for the package based on requirements
 */
function generatePackageSummary(pkg, requirement) {
  const parts = [];
  
  // Funder info
  parts.push(pkg.funder);
  if (pkg.funder === 'NDIS' && pkg.ndis_package_type) {
    parts.push(pkg.ndis_package_type.toUpperCase());
  }
  
  if (!requirement) {
    parts.push('Requirements not set');
    return parts.join(' • ');
  }
  
  // Care requirements
  if (requirement.requires_no_care) {
    parts.push('No care');
  } else if (requirement.care_hours_range && (requirement.care_hours_range.min !== null || requirement.care_hours_range.max !== null)) {
    const min = requirement.care_hours_range.min || 0;
    const max = requirement.care_hours_range.max || '∞';
    parts.push(`${min}-${max} hours care`);
  }
  
  // Course requirements
  if (requirement.requires_course === true) {
    parts.push('Requires course');
  } else if (requirement.requires_course === false) {
    parts.push('No course');
  } else if (requirement.compatible_with_course) {
    parts.push('Course optional');
  }
  
  return parts.join(' • ');
}