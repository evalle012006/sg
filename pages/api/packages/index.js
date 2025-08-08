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

    console.log('Package API called with filters:', { 
      funder, 
      ndis_package_type, 
      priceRange, 
      search,
      include_requirements 
    });

    // Build the where clause for filtering
    const whereClause = {};
    const orderClause = [];

    // Apply funder filter
    if (funder) {
      whereClause.funder = funder;
    }

    // Apply NDIS package type filter when funder is NDIS
    if (funder === 'NDIS' && ndis_package_type) {
      if (ndis_package_type === 'holiday') {
        whereClause.ndis_package_type = {
          [Op.in]: ['sta', 'holiday']
        };
      } else if (ndis_package_type === 'sta') {
        whereClause.ndis_package_type = 'sta';
      } else {
        whereClause.ndis_package_type = ndis_package_type;
      }
    }

    // Apply search filter
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { package_code: { [Op.like]: `%${search}%` } }
      ];
    }

    // Apply price range filter for Non-NDIS packages
    if (priceRange) {
      try {
        const { min, max } = JSON.parse(priceRange);
        if (min !== undefined || max !== undefined) {
          whereClause.price = {};
          if (min !== undefined) whereClause.price[Op.gte] = min;
          if (max !== undefined) whereClause.price[Op.lte] = max;
          // Only apply to Non-NDIS packages
          whereClause.funder = 'Non-NDIS';
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
      order: orderClause,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit)
    };

    // Include requirements if requested (admin mode)
    if (include_requirements === 'true') {
      queryOptions.include = [{
        model: PackageRequirement,
        as: 'requirements',
        required: false // LEFT JOIN to include packages without requirements
      }];
    }

    // Execute query
    const { count, rows: packages } = await Package.findAndCountAll(queryOptions);
    
    // Calculate total pages
    const totalPages = Math.ceil(count / parseInt(limit));

    // Transform packages for response
    const transformedPackages = packages.map(pkg => {
      const transformed = {
        id: pkg.id,
        name: pkg.name,
        package_code: pkg.package_code,
        funder: pkg.funder,
        price: pkg.price,
        ndis_package_type: pkg.ndis_package_type,
        ndis_line_items: pkg.ndis_line_items,
        created_at: pkg.created_at,
        updated_at: pkg.updated_at
      };

      // Format price display
      if (pkg.funder === 'NDIS') {
        if (pkg.ndis_line_items && pkg.ndis_line_items.length > 0) {
          const priceRange = pkg.ndis_line_items.map(item => item.price_per_night);
          const minPrice = Math.min(...priceRange);
          const maxPrice = Math.max(...priceRange);
          transformed.formattedPrice = minPrice === maxPrice 
            ? `$${minPrice}/night` 
            : `$${minPrice}-$${maxPrice}/night`;
        } else {
          transformed.formattedPrice = 'NDIS Funded';
        }
      } else {
        transformed.formattedPrice = pkg.price ? `$${pkg.price}` : 'Price TBA';
      }

      // Add requirement data if included
      if (include_requirements === 'true' && pkg.requirements && pkg.requirements.length > 0) {
        const requirement = pkg.requirements[0]; // Should only be one requirement per package
        
        // Transform requirement for easier frontend use
        transformed.requirement = {
          ...requirement.dataValues,
          care_hours_range: {
            min: requirement.care_hours_min,
            max: requirement.care_hours_max
          }
        };
        
        // Generate summary
        transformed.summary = generatePackageSummary(transformed, transformed.requirement);
      } else if (include_requirements === 'true') {
        // No requirements found
        transformed.requirement = null;
        transformed.summary = generatePackageSummary(transformed, null);
      }

      return transformed;
    });

    // Prepare response
    const response = {
      success: true,
      packages: transformedPackages,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total_items: count,
        total_pages: totalPages,
        has_next: parseInt(page) < totalPages,
        has_prev: parseInt(page) > 1
      }
    };

    // Add stats for admin mode
    if (include_requirements === 'true') {
      response.stats = {
        total_packages: count,
        packages_with_requirements: transformedPackages.filter(p => p.requirement).length,
        packages_without_requirements: transformedPackages.filter(p => !p.requirement).length,
        ndis_packages: transformedPackages.filter(p => p.funder === 'NDIS').length,
        non_ndis_packages: transformedPackages.filter(p => p.funder === 'Non-NDIS').length,
        requirements_system_available: true
      };
    }

    // Add debug info in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        queryOptions,
        whereClause,
        include_requirements: include_requirements === 'true',
        packageRequirement_available: true
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch packages',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
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

// Export the summary generator for use in other files
export { generatePackageSummary };