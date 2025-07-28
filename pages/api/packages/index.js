import { Package } from '../../../models';
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
      // Add other filter parameters as needed
      page = 1,
      limit = 50,
      sort = 'name'
    } = req.query;

    console.log('Package API called with filters:', { funder, ndis_package_type, priceRange });

    // Build the where clause for filtering
    const whereClause = {};
    const orderClause = [];

    // Apply funder filter
    if (funder) {
      whereClause.funder = funder;
    }

    // UPDATED: Apply NDIS package type filter with new holiday vs STA logic
    if (ndis_package_type && funder === 'NDIS') {
      if (ndis_package_type === 'holiday') {
        // Holiday packages: include both 'sta' and 'holiday' NDIS packages
        whereClause.ndis_package_type = {
          [Op.in]: ['sta', 'holiday']
        };
        console.log('Holiday filter: including both STA and holiday packages');
      } else if (ndis_package_type === 'sta') {
        // STA packages: only include 'sta' packages, exclude 'holiday'
        whereClause.ndis_package_type = 'sta';
        console.log('STA filter: including only STA packages');
      } else {
        // Fallback to exact match for any other values
        whereClause.ndis_package_type = ndis_package_type;
      }
    } else if (ndis_package_type && !funder) {
      // If ndis_package_type is provided without funder, assume NDIS
      whereClause.funder = 'NDIS';
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

    // Apply price range filter (for Non-NDIS packages only)
    if (priceRange && funder === 'Non-NDIS') {
      try {
        const parsedPriceRange = JSON.parse(priceRange);
        if (parsedPriceRange.min !== undefined || parsedPriceRange.max !== undefined) {
          whereClause.price = {};
          if (parsedPriceRange.min !== undefined) {
            whereClause.price[Op.gte] = parsedPriceRange.min;
          }
          if (parsedPriceRange.max !== undefined) {
            whereClause.price[Op.lte] = parsedPriceRange.max;
          }
        }
      } catch (e) {
        console.error('Invalid priceRange format:', e);
        // Continue without price filter if parsing fails
      }
    }

    // Apply sorting
    switch (sort) {
      case 'price_asc':
        orderClause.push(['price', 'ASC']);
        break;
      case 'price_desc':
        orderClause.push(['price', 'DESC']);
        break;
      case 'package_code':
        orderClause.push(['package_code', 'ASC']);
        break;
      case 'funder':
        orderClause.push(['funder', 'ASC'], ['name', 'ASC']);
        break;
      case 'ndis_package_type':
        orderClause.push(['ndis_package_type', 'ASC'], ['name', 'ASC']);
        break;
      case 'name':
      default:
        orderClause.push(['name', 'ASC']);
        break;
    }

    // Calculate pagination
    const offset = (parseInt(page) - 1) * parseInt(limit);

    console.log('Final where clause:', JSON.stringify(whereClause, null, 2));

    // Fetch packages with filters
    const { rows: packages, count } = await Package.findAndCountAll({
      where: whereClause,
      order: orderClause,
      limit: parseInt(limit),
      offset: offset,
      attributes: [
        'id',
        'name',
        'package_code',
        'funder',
        'price',
        'ndis_package_type',
        'ndis_line_items',
        'created_at',
        'updated_at'
      ]
    });

    console.log(`Found ${count} packages matching filters`);

    // Calculate pagination info
    const totalPages = Math.ceil(count / parseInt(limit));
    const hasNextPage = parseInt(page) < totalPages;
    const hasPrevPage = parseInt(page) > 1;

    // Transform packages for frontend
    const transformedPackages = packages.map(pkg => {
      const packageData = pkg.toJSON ? pkg.toJSON() : pkg;
      
      // Ensure ndis_line_items is properly parsed
      if (packageData.ndis_line_items && typeof packageData.ndis_line_items === 'string') {
        try {
          packageData.ndis_line_items = JSON.parse(packageData.ndis_line_items);
        } catch (e) {
          console.error('Error parsing ndis_line_items:', e);
          packageData.ndis_line_items = [];
        }
      } else if (!packageData.ndis_line_items) {
        packageData.ndis_line_items = [];
      }
      
      return {
        ...packageData,
        // Add frontend-specific transformations
        displayPrice: packageData.funder === 'Non-NDIS' && packageData.price 
          ? `$${packageData.price}` 
          : packageData.funder === 'NDIS' ? 'NDIS Funded' : 'Contact for pricing',
        
        // Process NDIS line items for display
        lineItemsCount: packageData.ndis_line_items ? packageData.ndis_line_items.length : 0,
        
        // Create summary for NDIS packages
        summary: packageData.funder === 'NDIS' && packageData.ndis_line_items && packageData.ndis_line_items.length > 0
          ? `${packageData.ndis_line_items.length} NDIS line item${packageData.ndis_line_items.length !== 1 ? 's' : ''} (${packageData.ndis_package_type?.toUpperCase() || 'STA'})`
          : packageData.funder === 'Non-NDIS' && packageData.price
            ? `$${packageData.price}`
            : 'Contact for details',
        
        // Add package type indicator for filtering context
        packageTypeContext: packageData.funder === 'NDIS' && ndis_package_type === 'holiday' 
          ? `Available for ${packageData.ndis_package_type?.toUpperCase()} stays`
          : packageData.funder === 'NDIS' && packageData.ndis_package_type
            ? `${packageData.ndis_package_type?.toUpperCase()} package`
            : null
      };
    });

    return res.status(200).json({
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
          funder: funder || null,
          ndis_package_type: ndis_package_type || null,
          // Include explanation of holiday filter logic
          holidayFilterExplanation: ndis_package_type === 'holiday' 
            ? 'Holiday filter includes both STA and Holiday packages'
            : ndis_package_type === 'sta'
              ? 'STA filter includes only STA packages'
              : null
        },
        available: {
          funders: ['NDIS', 'Non-NDIS'],
          ndisPackageTypes: ['sta', 'holiday'],
          // Add context about filter behavior
          filterBehavior: {
            holiday: 'Includes both STA and Holiday NDIS packages',
            sta: 'Includes only STA NDIS packages (excludes Holiday packages)'
          }
        }
      },
      debug: process.env.NODE_ENV === 'development' ? {
        whereClause,
        originalParams: { funder, ndis_package_type, priceRange }
      } : undefined
    });

  } catch (error) {
    console.error('Error fetching packages:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch packages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Helper function to get available package codes (for filtering)
async function getAvailablePackageCodes() {
  try {
    const codes = await Package.findAll({
      attributes: [[Package.sequelize.fn('DISTINCT', Package.sequelize.col('package_code')), 'package_code']],
      where: {
        package_code: {
          [Op.ne]: null
        }
      },
      raw: true
    });
    
    return codes.map(c => c.package_code).filter(Boolean);
  } catch (error) {
    console.error('Error fetching available package codes:', error);
    return [];
  }
}

// Helper to get price range for Non-NDIS packages
async function getPriceRangeForNonNdis() {
  try {
    const result = await Package.findOne({
      attributes: [
        [Package.sequelize.fn('MIN', Package.sequelize.col('price')), 'minPrice'],
        [Package.sequelize.fn('MAX', Package.sequelize.col('price')), 'maxPrice']
      ],
      where: {
        funder: 'Non-NDIS',
        price: {
          [Op.ne]: null
        }
      },
      raw: true
    });
    
    return {
      min: result?.minPrice || 0,
      max: result?.maxPrice || 1000
    };
  } catch (error) {
    console.error('Error fetching price range:', error);
    return { min: 0, max: 1000 };
  }
}

// ADDED: Helper function to get package statistics (useful for debugging)
export async function getPackageStatistics() {
  try {
    const stats = await Package.findAll({
      attributes: [
        'funder',
        'ndis_package_type',
        [Package.sequelize.fn('COUNT', Package.sequelize.col('id')), 'count']
      ],
      group: ['funder', 'ndis_package_type'],
      raw: true
    });
    
    return stats.reduce((acc, stat) => {
      const key = stat.funder + (stat.ndis_package_type ? `_${stat.ndis_package_type}` : '');
      acc[key] = parseInt(stat.count);
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching package statistics:', error);
    return {};
  }
}