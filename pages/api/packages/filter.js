import { Package, PackageRequirement } from '../../../models';
import { Op } from 'sequelize';

/**
 * Enhanced package filtering API with care requirements support
 * Supports both simple filtering and advanced care-based matching
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      error: 'Method not allowed. Use POST for dynamic filtering.' 
    });
  }

  try {
    const { 
      // Care-specific filtering criteria
      care_hours = 0,
      care_pattern = 'no-care',
      recommended_packages = [],
      
      // Standard filtering criteria
      funder_type,
      ndis_package_type,
      search,
      has_course = false,
      sta_in_plan = null,
      living_situation = null,
      
      // Pagination and sorting
      sort = 'name',
      order = 'ASC',
      page = 1,
      limit = 50,
      
      // Debug mode
      debug = false
    } = req.body;

    const debugInfo = debug ? {
      receivedCriteria: req.body,
      processingSteps: [],
      matchingResults: [],
      finalPackages: []
    } : null;

    // if (debug) {
    //   console.log('🔍 Enhanced package filter request:', {
    //     care_hours,
    //     care_pattern,
    //     recommended_packages,
    //     funder_type,
    //     ndis_package_type
    //   });
    // }

    // Build the basic WHERE clause
    const whereClause = {};
    
    // Funder filtering
    if (funder_type) {
      whereClause.funder = funder_type;
      if (debug) debugInfo.processingSteps.push(`Added funder filter: ${funder_type}`);
    }

    // NDIS package type filtering
    if (ndis_package_type && funder_type === 'NDIS') {
      whereClause.ndis_package_type = ndis_package_type;
      if (debug) debugInfo.processingSteps.push(`Added NDIS package type filter: ${ndis_package_type}`);
    }

    // Search filtering
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { package_code: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
      if (debug) debugInfo.processingSteps.push(`Added search filter: ${search}`);
    }

    const queryOptions = {
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
        'description',
        'created_at',
        'updated_at'
      ],
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    };

    // ADD THIS: Include requirements if requested
    if (req.body.include_requirements === true) {
      queryOptions.include = [{
        model: PackageRequirement,
        as: 'requirements',
        required: false // LEFT JOIN to include packages without requirements
      }];
    }

    const { count, rows: basePackages } = await Package.findAndCountAll(queryOptions);

    if (debug) {
      debugInfo.processingSteps.push(`Found ${basePackages.length} packages after basic filtering`);
    }

    // Apply care-based filtering and scoring
    const enhancedPackages = basePackages.map(packageData => {
      const pkg = packageData.toJSON ? packageData.toJSON() : packageData;
      
      // Include requirement data if requested
      if (req.body.include_requirements === true && pkg.requirements && pkg.requirements.length > 0) {
        const requirement = pkg.requirements[0]; // Should only be one requirement per package
        pkg.requirement = {
          ...requirement,
          care_hours_range: {
            min: requirement.care_hours_min,
            max: requirement.care_hours_max
          }
        };
      } else if (req.body.include_requirements === true) {
        pkg.requirement = null;
      }

      // Existing care analysis logic...
      const matchScore = calculateCareMatchScore(pkg, criteria);
      const isRecommended = recommended_packages.includes(pkg.package_code);
      
      return {
        ...pkg,
        matchScore,
        isRecommended,
        careCompatible: matchScore > 0.3,
        summary: generatePackageSummary(pkg, { care_hours, matchScore }),
        formattedPrice: pkg.funder === 'NDIS' 
          ? 'NDIS Funded' 
          : (pkg.price ? `$${parseFloat(pkg.price).toFixed(2)}` : 'Price TBA')
      };
    });

    // Filter out packages with very low match scores (unless no care is required)
    let filteredPackages = enhancedPackages;
    if (care_hours > 0) {
      // Only show packages that have some compatibility or are specifically recommended
      filteredPackages = enhancedPackages.filter(pkg => 
        pkg.matchScore > 0.2 || pkg.isRecommended
      );
      
      if (debug) {
        debugInfo.processingSteps.push(
          `Filtered ${enhancedPackages.length} packages down to ${filteredPackages.length} care-compatible packages`
        );
      }
    }

    // Sort packages by relevance
    filteredPackages.sort((a, b) => {
      // First priority: recommended packages
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      
      // Second priority: match score
      if (a.matchScore !== b.matchScore) {
        return b.matchScore - a.matchScore;
      }
      
      // Third priority: alphabetical
      return (a.name || '').localeCompare(b.name || '');
    });

    if (debug) {
      debugInfo.finalPackages = filteredPackages.map(pkg => ({
        package_code: pkg.package_code,
        name: pkg.name,
        matchScore: pkg.matchScore,
        isRecommended: pkg.isRecommended
      }));
    }

    const response = {
      success: true,
      packages: filteredPackages,
      total: filteredPackages.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(filteredPackages.length / parseInt(limit)),
      
      // Care analysis summary
      careAnalysis: {
        care_hours,
        care_pattern,
        recommended_packages,
        compatible_packages: filteredPackages.filter(pkg => pkg.careCompatible).length,
        total_analyzed: basePackages.length
      }
    };

    if (debug) {
      response.debug = debugInfo;
    }

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error in enhanced package filtering:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error while filtering packages',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

/**
 * Calculate how well a package matches the care requirements
 * @param {Object} pkg - Package data
 * @param {Object} criteria - Care and guest criteria
 * @returns {number} - Match score between 0 and 1
 */
function calculateCareMatchScore(pkg, criteria) {
  let score = 0.5; // Base score for all packages
  const { care_hours, recommended_packages, has_course, funder_type } = criteria;

  // Strong bonus for recommended packages
  if (recommended_packages.includes(pkg.package_code)) {
    score += 0.4;
  }

  // Care hours compatibility based on package requirements logic
  if (care_hours === 0) {
    // No care required - suitable for WS, NDIS SP, Holiday Support
    if (['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT'].includes(pkg.package_code)) {
      score += 0.3;
    }
  } else if (care_hours <= 6) {
    // Up to 6 hours - suitable for WHS, NDIS CSP, Holiday Support Plus
    if (['WHS', 'WHSP', 'NDIS_CSP', 'HOLIDAY_SUPPORT_PLUS'].includes(pkg.package_code)) {
      score += 0.3;
    }
  } else {
    // More than 6 hours - suitable for WVHS, HCSP
    if (['WVHS', 'WVHSP', 'HCSP'].includes(pkg.package_code)) {
      score += 0.3;
    }
  }

  // Funder type compatibility
  if (funder_type) {
    if ((funder_type === 'NDIS' && pkg.funder === 'NDIS') ||
        (funder_type === 'Non-NDIS' && pkg.funder !== 'NDIS')) {
      score += 0.1;
    } else {
      score -= 0.2; // Penalty for funder mismatch
    }
  }

  // Course compatibility
  if (has_course) {
    // Holiday packages are more suitable for course participants
    if (pkg.package_code.includes('HOLIDAY') || 
        ['WHS', 'WVHS'].includes(pkg.package_code)) {
      score += 0.1;
    }
  }

  // Ensure score stays within bounds
  return Math.max(0, Math.min(1, score));
}

/**
 * Generate a descriptive summary for a package
 * @param {Object} pkg - Package data
 * @param {Object} context - Context for summary generation
 * @returns {string} - Package summary
 */
function generatePackageSummary(pkg, context) {
  const { care_hours, matchScore } = context;
  
  let summary = `${pkg.funder} package`;
  
  if (pkg.ndis_package_type) {
    summary += ` (${pkg.ndis_package_type.toUpperCase()})`;
  }
  
  // Add care compatibility note
  if (care_hours > 0 && matchScore > 0.7) {
    summary += ' - Highly compatible with your care needs';
  } else if (care_hours > 0 && matchScore > 0.5) {
    summary += ' - Compatible with your care needs';
  } else if (care_hours === 0) {
    summary += ' - Suitable for guests not requiring care assistance';
  }
  
  return summary;
}