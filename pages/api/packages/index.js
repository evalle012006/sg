import { Package } from '../../../models';
import { Op } from 'sequelize';

// Try to import PackageRequirement - it may not exist yet during development
let PackageRequirement = null;
try {
  const models = require('../../../models');
  PackageRequirement = models.PackageRequirement;
} catch (error) {
  console.log('PackageRequirement model not available yet');
}

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
      include_requirements = 'false', // New parameter for admin mode
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
    orderClause.push([sort, 'ASC']);

    // Build query options
    const queryOptions = {
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      // Explicitly specify attributes to avoid timestamp issues
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
    };

    // Include requirements for admin mode
    if (include_requirements === 'true' && PackageRequirement) {
      queryOptions.include = [
        {
          model: PackageRequirement,
          as: 'requirements',
          required: false, // LEFT JOIN so packages without requirements still show
          where: { is_active: true }
        }
      ];
    }

    // Execute query
    const { count, rows: packages } = await Package.findAndCountAll(queryOptions);

    // Transform packages for response
    const transformedPackages = packages.map(packageData => {
      const pkg = packageData.toJSON ? packageData.toJSON() : packageData;
      
      // Format pricing based on funder type
      let formattedPrice;
      if (pkg.funder === 'NDIS') {
        if (pkg.ndis_line_items && pkg.ndis_line_items.length > 0) {
          const totalPrice = pkg.ndis_line_items.reduce((sum, item) => 
            sum + (parseFloat(item.price_per_night) || 0), 0);
          formattedPrice = `${pkg.ndis_line_items.length} items (Total: $${totalPrice.toFixed(2)})`;
        } else {
          formattedPrice = 'NDIS Package';
        }
      } else {
        formattedPrice = pkg.price ? `$${parseFloat(pkg.price).toFixed(2)}` : '$0.00';
      }

      // Create transformed package object
      const transformedPkg = {
        id: pkg.id,
        name: pkg.name,
        package_code: pkg.package_code,
        funder: pkg.funder,
        price: pkg.price,
        ndis_package_type: pkg.ndis_package_type,
        ndis_line_items: pkg.ndis_line_items || [],
        image_filename: pkg.image_filename,
        formattedPrice,
        created_at: pkg.created_at,
        updated_at: pkg.updated_at
      };

      // Add requirements data if included and available
      if (include_requirements === 'true' && PackageRequirement && pkg.requirements) {
        // Get the first (primary) requirement or null
        const primaryRequirement = pkg.requirements && pkg.requirements.length > 0 
          ? pkg.requirements[0] 
          : null;

        if (primaryRequirement) {
          transformedPkg.requirement = {
            care_hours_range: {
              min: primaryRequirement.care_hours_min,
              max: primaryRequirement.care_hours_max
            },
            requires_no_care: primaryRequirement.requires_no_care,
            requires_course: primaryRequirement.requires_course,
            compatible_with_course: primaryRequirement.compatible_with_course,
            living_situation: primaryRequirement.living_situation,
            sta_requirements: primaryRequirement.sta_requirements,
            display_priority: primaryRequirement.display_priority,
            notes: primaryRequirement.notes,
            is_active: primaryRequirement.is_active
          };

          // Generate summary for admin view
          transformedPkg.summary = generatePackageSummary(transformedPkg, transformedPkg.requirement);
        } else {
          transformedPkg.requirement = null;
          transformedPkg.summary = `${pkg.funder} package - Requirements not configured`;
        }
      } else if (include_requirements === 'true') {
        // Requirements were requested but model not available or no requirements found
        transformedPkg.requirement = null;
        transformedPkg.summary = `${pkg.funder} package - Requirements system not set up`;
      }

      return transformedPkg;
    });

    // Calculate pagination
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Prepare response
    const response = {
      success: true,
      packages: transformedPackages,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalItems: count,
        itemsPerPage: parseInt(limit),
        hasNextPage,
        hasPrevPage
      },
      filters: {
        applied: {
          funder,
          ndis_package_type: funder === 'NDIS' ? ndis_package_type : null,
          search,
          priceRange
        },
        available: {
          funders: ['NDIS', 'Non-NDIS'],
          ndisPackageTypes: ['sta', 'holiday']
        }
      }
    };

    // Add admin-specific stats if requirements are included
    if (include_requirements === 'true') {
      response.admin_stats = {
        total_packages: count,
        packages_with_requirements: PackageRequirement ? transformedPackages.filter(p => p.requirement).length : 0,
        packages_without_requirements: PackageRequirement ? transformedPackages.filter(p => !p.requirement).length : count,
        ndis_packages: transformedPackages.filter(p => p.funder === 'NDIS').length,
        non_ndis_packages: transformedPackages.filter(p => p.funder === 'Non-NDIS').length,
        requirements_system_available: !!PackageRequirement
      };
    }

    // Add debug info in development
    if (process.env.NODE_ENV === 'development') {
      response.debug = {
        queryOptions,
        whereClause,
        include_requirements: include_requirements === 'true',
        packageRequirement_available: !!PackageRequirement
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