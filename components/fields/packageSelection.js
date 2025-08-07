import React, { useState, useEffect, useRef, useMemo } from 'react';
import { calculateCareHours, createPackageFilterCriteria } from '../../utilities/careHoursCalculator';

const PackageSelection = ({ 
  funder = null,
  ndis_package_type = null,
  additionalFilters = {},
  value = null, 
  onChange, 
  required = false,
  multi = false,
  builderMode = false,
  error = null,
  className = '',
  localFilterState,
  // New props for care analysis
  formData = {}, // All form Q&A data
  qaData = [], // Q&A pairs from booking
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set(['NDIS', 'Non-NDIS']));
  
  const isMounted = useRef(true);
  const fetchTimeout = useRef(null);

  // Extract care requirements from form data
  const careAnalysis = useMemo(() => {
    // Check if guest requires personal care
    const requiresCare = getAnswerByQuestionKey('do-you-require-assistance-with-personal-care');
    
    if (!requiresCare || requiresCare.toLowerCase() !== 'yes') {
      return {
        requiresCare: false,
        totalHoursPerDay: 0,
        carePattern: 'no-care',
        recommendedPackages: ['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT']
      };
    }

    // Get care schedule data
    const careScheduleData = getAnswerByQuestionKey('when-do-you-require-care');
    
    if (!careScheduleData) {
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-unspecified',
        recommendedPackages: []
      };
    }

    try {
      // Parse care data and calculate hours
      const parsedCareData = typeof careScheduleData === 'string' 
        ? JSON.parse(careScheduleData) 
        : careScheduleData;
      
      const analysis = calculateCareHours(parsedCareData);
      
      return {
        requiresCare: true,
        ...analysis,
        rawCareData: parsedCareData
      };
    } catch (error) {
      console.error('Error parsing care data:', error);
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-error',
        recommendedPackages: []
      };
    }
  }, [formData, qaData]);

  // Extract guest requirements from form data
  const guestRequirements = useMemo(() => {
    const requirements = {};
    
    // Funding source
    const fundingAnswer = getAnswerByQuestionKey('how-will-your-stay-be-funded');
    if (fundingAnswer) {
      requirements.funder_type = fundingAnswer.includes('NDIS') ? 'NDIS' : 'Non-NDIS';
    }
    
    // Course participation
    const courseAnswer = getAnswerByQuestionKey('which-course');
    requirements.has_course = courseAnswer ? true : false;
    
    // NDIS specific requirements
    if (requirements.funder_type === 'NDIS') {
      const staAnswer = getAnswerByQuestionKey('is-sta-a-stated-support-in-your-plan');
      if (staAnswer) {
        requirements.sta_in_plan = staAnswer.toLowerCase().includes('yes');
      }
      
      // Package type based on course
      requirements.ndis_package_type = requirements.has_course ? 'holiday' : 'sta';
    }
    
    // Living situation
    const livingSituationQuestions = [
      'do-you-live-alone',
      'do-you-live-in-supported-independent-living-sil', 
      'are-you-staying-with-any-informal-supports'
    ];
    
    for (const questionKey of livingSituationQuestions) {
      const answer = getAnswerByQuestionKey(questionKey);
      if (answer?.toLowerCase().includes('yes')) {
        if (questionKey.includes('alone')) {
          requirements.living_situation = 'alone';
        } else if (questionKey.includes('sil')) {
          requirements.living_situation = 'sil';
        } else if (questionKey.includes('supports')) {
          requirements.living_situation = 'with_supports';
        }
        break;
      }
    }
    
    return requirements;
  }, [formData, qaData]);

  // Create comprehensive filter criteria
  const filterCriteria = useMemo(() => {
    const baseCriteria = createPackageFilterCriteria(careAnalysis.rawCareData || []);
    
    return {
      ...baseCriteria,
      ...guestRequirements,
      // Override with explicit props if provided
      funder_type: localFilterState?.funderType || guestRequirements.funder_type || funder,
      ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type || ndis_package_type,
      care_hours: Math.ceil(careAnalysis.totalHoursPerDay || 0),
      ...additionalFilters
    };
  }, [careAnalysis, guestRequirements, localFilterState, funder, ndis_package_type, additionalFilters]);

  // Helper function to get answer by question key
  function getAnswerByQuestionKey(questionKey) {
    // First try formData (direct form fields)
    if (formData[questionKey]) {
      return formData[questionKey];
    }
    
    // Then try qaData (Q&A pairs)
    if (qaData && Array.isArray(qaData)) {
      const qa = qaData.find(item => 
        item.Question?.question_key === questionKey ||
        item.question_key === questionKey
      );
      return qa?.answer || qa?.value;
    }
    
    return null;
  }

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      // Determine which API to use based on care requirements
      const hasAdvancedFiltering = careAnalysis.requiresCare && careAnalysis.totalHoursPerDay > 0;
      
      let response;
      
      if (hasAdvancedFiltering) {
        // Use dynamic filtering API for care-based filtering
        response = await fetch('/api/packages/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(filterCriteria)
        });
      } else {
        // Use simple API for basic filtering
        const params = new URLSearchParams();
        if (filterCriteria.funder_type) params.set('funder', filterCriteria.funder_type);
        if (filterCriteria.ndis_package_type) params.set('ndis_package_type', filterCriteria.ndis_package_type);
        if (filterCriteria.search) params.set('search', filterCriteria.search);
        
        const queryString = params.toString();
        response = await fetch(`/api/packages${queryString ? `?${queryString}` : ''}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        let packageList = data.packages || data;
        
        // Filter and sort packages based on care requirements
        if (careAnalysis.requiresCare && careAnalysis.recommendedPackages.length > 0) {
          packageList = packageList.sort((a, b) => {
            // Prioritize recommended packages
            const aRecommended = careAnalysis.recommendedPackages.includes(a.package_code);
            const bRecommended = careAnalysis.recommendedPackages.includes(b.package_code);
            
            if (aRecommended && !bRecommended) return -1;
            if (!aRecommended && bRecommended) return 1;
            
            // Then by match score if available
            return (b.matchScore || 0) - (a.matchScore || 0);
          });
        }
        
        setPackages(packageList);
        console.log(`✅ Fetched ${packageList.length} packages (Care: ${careAnalysis.totalHoursPerDay}h, Pattern: ${careAnalysis.carePattern})`);
      } else {
        console.error('Failed to fetch packages:', data.error);
        setPackages([]);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      setFetchError('Failed to load packages. Please try again.');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTimeout.current = setTimeout(() => {
      fetchPackages();
    }, 100);

    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, [
    filterCriteria.funder_type,
    filterCriteria.ndis_package_type,
    filterCriteria.care_hours,
    filterCriteria.has_course,
    filterCriteria.sta_in_plan,
    builderMode
  ]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, []);

  // Toggle expanded state for packages with many line items
  const togglePackageExpansion = (packageId) => {
    setExpandedPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(packageId)) {
        newSet.delete(packageId);
      } else {
        newSet.add(packageId);
      }
      return newSet;
    });
  };

  // Toggle category expansion (builder mode only)
  const toggleCategoryExpansion = (category) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Categorize packages for builder mode
  const categorizePackages = (packages) => {
    const categories = {};
    
    packages.forEach(pkg => {
      const category = pkg.funder || 'Other';
      if (!categories[category]) {
        categories[category] = [];
      }
      categories[category].push(pkg);
    });

    // Sort categories: NDIS first, then Non-NDIS, then others
    const sortedCategories = {};
    if (categories['NDIS']) sortedCategories['NDIS'] = categories['NDIS'];
    if (categories['Non-NDIS']) sortedCategories['Non-NDIS'] = categories['Non-NDIS'];
    
    Object.keys(categories).forEach(key => {
      if (key !== 'NDIS' && key !== 'Non-NDIS') {
        sortedCategories[key] = categories[key];
      }
    });

    return sortedCategories;
  };

  const handleChange = (selectedPackage) => {
    if (onChange) {
      onChange(selectedPackage);
    }
  };

  const handleMultiChange = (selectedPackages) => {
    if (onChange) {
      onChange(selectedPackages);
    }
  };

  const getSelectedIds = () => {
    if (!value) return [];
    if (multi) {
      return Array.isArray(value) ? value : [value];
    }
    return [value];
  };

  const selectedIds = getSelectedIds();

  // Generate care requirements notice for display
  const getCareRequirementsNotice = () => {
    if (!careAnalysis.requiresCare) {
      return {
        type: 'info',
        message: 'Showing packages suitable for guests who do not require personal care assistance.'
      };
    }
    
    if (careAnalysis.totalHoursPerDay === 0) {
      return {
        type: 'warning',
        message: 'Personal care required but schedule not specified. Showing all packages.'
      };
    }
    
    return {
      type: 'success',
      message: `Showing packages suitable for ${careAnalysis.totalHoursPerDay} hours of daily care (${careAnalysis.carePattern.replace('-', ' ')}).`
    };
  };

  const careNotice = getCareRequirementsNotice();

  // Render individual package card
  const renderPackageCard = (pkg) => {
    const isSelected = selectedIds.includes(pkg.id);
    const isExpanded = expandedPackages.has(pkg.id);
    const hasManyLineItems = pkg.funder === 'NDIS' && pkg.ndis_line_items && pkg.ndis_line_items.length > 3;
    const isRecommended = careAnalysis.recommendedPackages.includes(pkg.package_code);
    
    return (
      <div 
        key={pkg.id} 
        className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer
          ${isSelected 
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-[1.02] ring-4 ring-blue-200/50' 
            : isRecommended
              ? 'border-green-300 bg-gradient-to-br from-green-50 to-green-100 hover:border-green-400 hover:shadow-md hover:scale-[1.01]'
              : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-md hover:scale-[1.01]'
          }`}
        onClick={() => {
          if (multi) {
            const currentValue = selectedIds;
            const newValue = currentValue.includes(pkg.id)
              ? currentValue.filter(id => id !== pkg.id)
              : [...currentValue, pkg.id];
            handleMultiChange(newValue);
          } else {
            handleChange(pkg.id);
          }
        }}
      >
        {/* Recommended badge */}
        {isRecommended && (
          <div className="absolute top-3 right-3 z-10">
            <span className="bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-sm">
              RECOMMENDED
            </span>
          </div>
        )}

        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-3 left-3 z-10">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Package header */}
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2 pr-8">
              {pkg.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block bg-gray-100 text-gray-800 text-xs font-medium px-2 py-1 rounded font-mono">
                {pkg.package_code}
              </span>
              <span className={`inline-block text-xs font-medium px-2 py-1 rounded ${
                pkg.funder === 'NDIS' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-purple-100 text-purple-800'
              }`}>
                {pkg.funder}
              </span>
              {pkg.ndis_package_type && (
                <span className="inline-block bg-indigo-100 text-indigo-800 text-xs font-medium px-2 py-1 rounded uppercase">
                  {pkg.ndis_package_type}
                </span>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="mb-4">
            <div className="text-2xl font-bold text-gray-900">
              {pkg.funder === 'NDIS' ? (
                <div>
                  <span className="text-base text-gray-600">{pkg.ndis_line_items?.length || 0} line items</span>
                  {pkg.ndis_line_items && pkg.ndis_line_items.length > 0 && (
                    <div className="text-sm text-gray-500 mt-1">
                      Total: ${pkg.ndis_line_items.reduce((sum, item) => sum + (parseFloat(item.price_per_night) || 0), 0).toFixed(2)}/night
                    </div>
                  )}
                </div>
              ) : (
                <span>${parseFloat(pkg.price || 0).toFixed(2)}</span>
              )}
            </div>
          </div>

          {/* Care compatibility notice */}
          {isRecommended && careAnalysis.requiresCare && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <div className="text-sm text-green-800">
                <strong>✓ Care Compatible:</strong> Suitable for {careAnalysis.totalHoursPerDay} hours daily care
              </div>
            </div>
          )}

          {/* NDIS Line Items Preview */}
          {pkg.funder === 'NDIS' && pkg.ndis_line_items && (
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-2">NDIS Line Items:</div>
              <div className="space-y-1">
                {pkg.ndis_line_items.slice(0, isExpanded ? undefined : 2).map((item, index) => (
                  <div key={index} className="flex justify-between text-sm bg-gray-50 rounded px-2 py-1">
                    <span className="text-gray-700 truncate">{item.line_item}</span>
                    <span className="font-medium text-gray-900 ml-2">${item.price_per_night}/night</span>
                  </div>
                ))}
                {hasManyLineItems && !isExpanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePackageExpansion(pkg.id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    +{pkg.ndis_line_items.length - 2} more items
                  </button>
                )}
                {isExpanded && hasManyLineItems && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePackageExpansion(pkg.id);
                    }}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Rest of the component rendering logic...
  const renderCategorizedPackages = (packages) => {
    const categories = categorizePackages(packages);
    
    return (
      <div className="space-y-6">
        {Object.entries(categories).map(([category, categoryPackages]) => (
          <div key={category} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <button
              onClick={() => toggleCategoryExpansion(category)}
              className="w-full px-6 py-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between hover:bg-gray-100 transition-colors"
            >
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                {category} Packages
                <span className="bg-gray-200 text-gray-700 text-sm px-2 py-1 rounded-full">
                  {categoryPackages.length}
                </span>
              </h3>
              <svg 
                className={`w-5 h-5 text-gray-500 transition-transform ${expandedCategories.has(category) ? 'rotate-180' : ''}`}
                fill="currentColor" 
                viewBox="0 0 20 20"
              >
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>
            
            {expandedCategories.has(category) && (
              <div className="p-6">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {categoryPackages.map(renderPackageCard)}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className={`package-selection ${className} mt-4`}>
      {/* Care Requirements Notice */}
      {careAnalysis.requiresCare !== undefined && (
        <div className={`mb-4 p-3 rounded-lg border ${
          careNotice.type === 'success' ? 'bg-green-50 border-green-200' :
          careNotice.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className={`text-sm ${
            careNotice.type === 'success' ? 'text-green-800' :
            careNotice.type === 'warning' ? 'text-yellow-800' :
            'text-blue-800'
          }`}>
            {careNotice.message}
          </div>
        </div>
      )}

      {/* Builder mode header */}
      {builderMode && packages.length > 0 && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg p-4 mb-6 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="text-2xl">🔧</div>
            <div>
              <div className="font-bold text-lg">Builder Mode Preview</div>
              <div className="text-blue-100">Showing all {packages.length} packages organized by category</div>
            </div>
          </div>
        </div>
      )}
      
      {/* Multi-selection summary */}
      {multi && selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
            <span className="text-green-800 font-semibold">
              {selectedIds.length} package{selectedIds.length !== 1 ? 's' : ''} selected
            </span>
          </div>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 text-blue-600">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span>Loading suitable packages...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="text-red-800 text-sm">{fetchError}</div>
        </div>
      )}
      
      {/* Render packages */}
      {!loading && !fetchError && (
        <>
          {builderMode ? (
            renderCategorizedPackages(packages)
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {packages.map(renderPackageCard)}
            </div>
          )}

          {/* No packages message */}
          {packages.length === 0 && (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">📭</div>
              <div className="text-gray-600 text-xl mb-2">No suitable packages found</div>
              <div className="text-gray-500">
                {careAnalysis.requiresCare 
                  ? `No packages match your ${careAnalysis.totalHoursPerDay} hours daily care requirements`
                  : 'No packages match the current criteria'
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* Required field indicator */}
      {required && !value && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-yellow-800 text-sm font-medium">⚠️ This field is required</div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}
    </div>
  );
};

export default PackageSelection;