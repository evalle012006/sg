import { Package } from '../../../models';
import { Op } from 'sequelize';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST for dynamic filtering.' 
    });
  }

  try {
    const { 
      // Dynamic filtering criteria
      funder_type,
      ndis_package_type,
      search,
      
      // Standard filters
      sort = 'name',
      order = 'ASC',
      page = 1,
      limit = 50,
      
      // Debug mode
      debug = false
    } = req.body;

    console.log('🔍 Simple package filter request:', {
      funder_type,
      ndis_package_type,
      search
    });

    // Build the filtering logic (simplified version)
    const whereClause = {
      // Basic package filters
      ...(funder_type && { funder: funder_type }),
      ...(ndis_package_type && funder_type === 'NDIS' && { ndis_package_type })
    };

    // Search filtering
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { package_code: { [Op.like]: `%${search}%` } }
      ];
    }

    // Execute the query
    const { count, rows: packages } = await Package.findAndCountAll({
      where: whereClause,
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
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    });

    // Transform the results (simplified)
    const transformedPackages = packages.map(packageData => {
      const pkg = packageData.toJSON ? packageData.toJSON() : packageData;
      
      // Format pricing
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
      
      return {
        id: pkg.id,
        name: pkg.name,
        package_code: pkg.package_code,
        funder: pkg.funder,
        price: pkg.price,
        ndis_package_type: pkg.ndis_package_type,
        ndis_line_items: pkg.ndis_line_items || [],
        
        // Add placeholder requirement information
        requirement: null, // Will be populated once requirements system is set up
        
        // Computed fields
        formattedPrice,
        summary: `${pkg.funder}${pkg.ndis_package_type ? ' ' + pkg.ndis_package_type.toUpperCase() : ''} package`,
        
        // Placeholder match score
        matchScore: 0
      };
    });

    // Calculate pagination
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

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
          funder_type,
          ndis_package_type,
          search
        },
        summary: `${count} packages found${funder_type ? ` for ${funder_type}` : ''}${search ? ` matching "${search}"` : ''}`
      },
      system_status: {
        requirements_available: false,
        message: 'Advanced filtering will be available once requirements system is set up'
      }
    };

    // Add debug information in development
    if (debug && process.env.NODE_ENV === 'development') {
      response.debug = {
        packageWhere: whereClause,
        totalPackagesFound: count,
        message: 'Using simplified filtering - requirements system not set up yet'
      };
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('❌ Simple package filtering error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to filter packages',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}