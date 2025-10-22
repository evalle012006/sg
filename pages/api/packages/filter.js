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
      care_hours = 0,
      care_pattern = 'no-care',
      recommended_packages = [],
      funder_type,
      ndis_package_type,
      search,
      has_course = false,
      sta_in_plan = null,
      sort = 'name',
      order = 'ASC',
      page = 1,
      limit = 50,
      debug = false
    } = req.body;

    const criteria = {
      care_hours,
      care_pattern,
      recommended_packages,
      funder_type,
      ndis_package_type,
      has_course,
      sta_in_plan
    };

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
    //     ndis_package_type,
    //     has_course
    //   });
    // }

    // ✅ FIXED: Build the basic WHERE clause with proper NDIS package type filtering
    const whereClause = {};
    
    // Funder filtering
    if (funder_type) {
      whereClause.funder = funder_type;
      if (debug) debugInfo.processingSteps.push(`Added funder filter: ${funder_type}`);
    }

    // ✅ CRITICAL FIX: NDIS package type filtering
    if (ndis_package_type) {
      if (funder_type === 'NDIS' || !funder_type) {
        whereClause.ndis_package_type = ndis_package_type;
        if (debug) debugInfo.processingSteps.push(`Added NDIS package type filter: ${ndis_package_type}`);
        // console.log(`🎯 FILTERING BY NDIS PACKAGE TYPE: ${ndis_package_type}`);
      }
    }

    // Search filtering
    if (search) {
      whereClause[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { package_code: { [Op.like]: `%${search}%` } }
      ];
      if (debug) debugInfo.processingSteps.push(`Added search filter: ${search}`);
    }

    // ✅ Add explicit logging to see what WHERE clause is being used
    // console.log('🔍 Final WHERE clause for database query:', whereClause);

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
      order: [[sort, order.toUpperCase()]],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      distinct: true
    };

    // Include requirements if requested
    if (req.body.include_requirements === true) {
      queryOptions.include = [{
        model: PackageRequirement,
        as: 'requirements',
        required: false
      }];
    }

    const { count, rows: basePackages } = await Package.findAndCountAll(queryOptions);

    // if (debug) {
    //   console.log('📦 Packages returned from database:', basePackages.map(p => ({
    //     code: p.package_code,
    //     name: p.name,
    //     funder: p.funder,
    //     ndis_package_type: p.ndis_package_type
    //   })));
    // }

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
        
        if (debug) {
          debugInfo.matchingResults.push({
            package_code: pkg.package_code,
            requirement: {
              requires_no_care: requirement.requires_no_care,
              care_hours_min: requirement.care_hours_min,
              care_hours_max: requirement.care_hours_max,
              requires_course: requirement.requires_course,
              compatible_with_course: requirement.compatible_with_course
            }
          });
        }
      } else if (req.body.include_requirements === true) {
        pkg.requirement = null;
        if (debug) {
          debugInfo.matchingResults.push({
            package_code: pkg.package_code,
            requirement: 'NO REQUIREMENT DATA'
          });
        }
      }

      // FIXED: Now criteria is properly defined
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
          : (pkg.price ? `${parseFloat(pkg.price).toFixed(2)}` : 'Price TBA'),
        // Add placeholder fields for frontend compatibility
        description: pkg.summary || `${pkg.name} package`,
        inclusions: pkg.ndis_line_items || [],
        features: []
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

    // if (debug) {
    //   debugInfo.finalPackages = filteredPackages.map(pkg => ({
    //     package_code: pkg.package_code,
    //     name: pkg.name,
    //     matchScore: pkg.matchScore,
    //     isRecommended: pkg.isRecommended,
    //     hasRequirement: !!pkg.requirement
    //   }));
      
    //   console.log('🎯 Final filtering results:', {
    //     totalFound: basePackages.length,
    //     afterCareFiltering: filteredPackages.length,
    //     recommendedPackages: recommended_packages,
    //     careHours: care_hours,
    //     funderType: funder_type
    //   });
    // }

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
 * @param {Object} pkg - Package data with requirement information
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

  // FIXED: Use actual package requirements instead of hardcoded package codes
  if (pkg.requirement) {
    const req = pkg.requirement;
    
    // HIGH PRIORITY: Perfect match for no-care requirements
    if (care_hours === 0 && req.requires_no_care === true) {
      // This is a perfect match - guest needs no care, package requires no care
      score += 0.5; // Highest bonus
      // console.log(`🎯 PERFECT NO-CARE MATCH for ${pkg.package_code}: Guest needs 0h care, package requires no care`);
    }
    // Check if package violates no-care requirement
    else if (care_hours > 0 && req.requires_no_care === true) {
      // Package requires no care but guest needs care - major penalty
      score -= 0.8;
      // console.log(`❌ NO-CARE VIOLATION for ${pkg.package_code}: Guest needs ${care_hours}h care but package requires no care`);
    }
    // Check care hours range compatibility
    else if (req.requires_no_care !== true) {
      // Package allows care, check if it's within range
      if (req.care_hours_min !== null && care_hours < req.care_hours_min) {
        score -= 0.3; // Guest needs less care than package minimum
      } else if (req.care_hours_max !== null && care_hours > req.care_hours_max) {
        score -= 0.3; // Guest needs more care than package maximum
      } else {
        // Care hours are within range
        score += 0.3;
      }
    }
    
    // Course requirements matching
    if (req.requires_course === true && !has_course) {
      score -= 0.4; // Package requires course but guest doesn't have one
    } else if (req.requires_course === false && has_course) {
      score -= 0.2; // Package forbids courses but guest has one
    } else if (req.compatible_with_course === true || req.requires_course === null) {
      // Package is course-compatible or neutral
      score += 0.1;
    }
  } else {
    // Fallback to old logic for packages without requirements data
    // console.log(`⚠️ Package ${pkg.package_code} has no requirements data, using fallback logic`);
    
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

  // Course compatibility (secondary check)
  if (has_course) {
    // Holiday packages are more suitable for course participants
    if (pkg.package_code.includes('HOLIDAY') || 
        ['WHS', 'WVHS'].includes(pkg.package_code)) {
      score += 0.1;
    }
  }

  // Ensure score stays within bounds
  const finalScore = Math.max(0, Math.min(1, score));
  
  // console.log(`📊 Score calculation for ${pkg.package_code}:`, {
  //   care_hours,
  //   requires_no_care: pkg.requirement?.requires_no_care,
  //   finalScore,
  //   hasRequirement: !!pkg.requirement
  // });
  
  return finalScore;
}

/**
 * Generate a descriptive summary for a package
 * @param {Object} pkg - Package data
 * @param {Object} context - Context for summary generation
 * @returns {string} - Package summary
 */
function generatePackageSummary(pkg, context) {
  const { care_hours, matchScore } = context;
  
  let summary = `${pkg.funder} funded accommodation package`;
  
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
  
  // Add NDIS line items info if available
  if (pkg.ndis_line_items && Array.isArray(pkg.ndis_line_items) && pkg.ndis_line_items.length > 0) {
    summary += `. Includes ${pkg.ndis_line_items.length} NDIS line item${pkg.ndis_line_items.length > 1 ? 's' : ''}`;
  }
  
  return summary;
}