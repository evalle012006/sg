import React, { useState, useEffect, useRef, useMemo } from 'react';
import { calculateCareHours, createPackageFilterCriteria, formatCareScheduleForDisplay } from '../../utilities/careHoursCalculator';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';

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
  // NEW: Enhanced care analysis props
  careAnalysisData = null,
  packageFilterCriteria = {},
  formData = {}, // All form Q&A data
  qaData = [], // Q&A pairs from booking
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set(['NDIS', 'Non-NDIS']));
  const [debugInfo, setDebugInfo] = useState(null);
  
  const isMounted = useRef(true);
  const fetchTimeout = useRef(null);

  // Helper function to extract guest requirements from form data
  const extractGuestRequirements = () => {
    const requirements = {};
    
    // Funding source
    const fundingAnswer = getAnswerByQuestionKey('how-will-your-stay-be-funded');
    if (fundingAnswer) {
      requirements.funder_type = fundingAnswer.includes('NDIS') ? 'NDIS' : 'Non-NDIS';
    }
    
    // Course participation
    const courseAnswer = getAnswerByQuestionKey('which-course') || getAnswerByQuestionKey('have-you-been-offered-a-place-in-a-course-for-this-stay');
    requirements.has_course = courseAnswer ? true : false;
    
    // NDIS specific requirements
    if (requirements.funder_type === 'NDIS') {
      const staAnswer = getAnswerByQuestionKey('is-sta-a-stated-support-in-your-plan');
      if (staAnswer) {
        requirements.sta_in_plan = staAnswer.toLowerCase().includes('yes');
      }
      
      requirements.ndis_package_type = requirements.has_course ? 'holiday' : 'sta';
    }
    
    // Living situation
    const livingAlone = getAnswerByQuestionKey('do-you-live-alone');
    const livingInSil = getAnswerByQuestionKey('do-you-live-in-supported-independent-living-sil');
    const withInformalSupports = getAnswerByQuestionKey('are-you-staying-with-any-informal-supports');
    
    if (livingAlone?.toLowerCase().includes('yes')) {
      requirements.living_situation = 'alone';
    } else if (livingInSil?.toLowerCase().includes('yes')) {
      requirements.living_situation = 'sil';
    } else if (withInformalSupports?.toLowerCase().includes('yes')) {
      requirements.living_situation = 'with_supports';
    }
    
    return requirements;
  };

  // Helper function to get answer by question key
  function getAnswerByQuestionKey(questionKey) {
    // First try formData (direct form fields)
    if (formData[questionKey]) {
      return formData[questionKey];
    }
    
    // Then try qaData (Q&A pairs)
    if (qaData && Array.isArray(qaData)) {
      const qa = findByQuestionKey(qaData, questionKey);
      return qa?.answer || qa?.value;
    }
    
    return null;
  }

  // ENHANCED: Use provided care analysis or calculate from form data
  const careAnalysis = useMemo(() => {
    // If care analysis is provided directly, use it
    if (careAnalysisData) {
      console.log('📊 Using provided care analysis:', careAnalysisData);
      return careAnalysisData;
    }

    // Otherwise, try to extract and calculate from form data
    const requiresPersonalCare = getAnswerByQuestionKey('do-you-require-assistance-with-personal-care');
    
    if (!requiresPersonalCare || !requiresPersonalCare.toLowerCase().includes('yes')) {
      return {
        requiresCare: false,
        totalHoursPerDay: 0,
        carePattern: 'no-care',
        recommendedPackages: ['WS', 'NDIS_SP', 'HOLIDAY_SUPPORT'],
        analysis: 'Guest does not require personal care assistance'
      };
    }

    // Get care schedule data using the specific question key
    const careScheduleData = getAnswerByQuestionKey(QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE);
    
    if (!careScheduleData) {
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-unspecified',
        recommendedPackages: [],
        analysis: 'Care required but schedule not specified'
      };
    }

    try {
      // Parse care data (matching your JSON format)
      const parsedCareData = typeof careScheduleData === 'string' 
        ? JSON.parse(careScheduleData) 
        : careScheduleData;
      
      const analysis = calculateCareHours(parsedCareData);
      
      console.log('🏥 Calculated care analysis:', {
        totalHours: analysis.totalHoursPerDay,
        pattern: analysis.carePattern,
        recommended: analysis.recommendedPackages,
        rawData: parsedCareData
      });

      return {
        requiresCare: true,
        ...analysis,
        rawCareData: parsedCareData
      };
    } catch (error) {
      console.error('Error parsing care data in PackageSelection:', error);
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-error',
        recommendedPackages: [],
        analysis: 'Error parsing care schedule data'
      };
    }
  }, [careAnalysisData, formData, qaData]);

  // ENHANCED: Build comprehensive filter criteria
  const enhancedFilterCriteria = useMemo(() => {
    const baseCriteria = packageFilterCriteria || createPackageFilterCriteria(careAnalysis.rawCareData || []);
    
    // Get additional requirements from form data
    const guestRequirements = extractGuestRequirements();
    
    const criteria = {
      ...baseCriteria,
      ...guestRequirements,
      
      // Override with explicit props if provided
      funder_type: localFilterState?.funderType || guestRequirements.funder_type || funder,
      ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type || ndis_package_type,
      
      // Care-specific criteria
      care_hours: Math.ceil(careAnalysis.totalHoursPerDay || 0),
      care_pattern: careAnalysis.carePattern,
      recommended_packages: careAnalysis.recommendedPackages || [],
      
      // Additional filters
      ...additionalFilters
    };

    console.log('🎯 Enhanced filter criteria:', criteria);
    return criteria;
  }, [careAnalysis, localFilterState, funder, ndis_package_type, additionalFilters, packageFilterCriteria]);


  // ENHANCED: Fetch packages with advanced filtering
  const fetchPackages = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      // Determine if we need advanced filtering (care-based)
      const needsAdvancedFiltering = careAnalysis.requiresCare && careAnalysis.totalHoursPerDay > 0;
      
      let response;
      
      if (needsAdvancedFiltering) {
        // Use advanced filtering API with care requirements
        console.log('🔍 Using advanced package filtering with care data');
        response = await fetch('/api/packages/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...enhancedFilterCriteria,
            debug: true // Enable debug mode for development
          })
        });
      } else {
        // Use simple API for basic filtering
        console.log('🔍 Using basic package filtering');
        const params = new URLSearchParams();
        if (enhancedFilterCriteria.funder_type) params.set('funder', enhancedFilterCriteria.funder_type);
        if (enhancedFilterCriteria.ndis_package_type) params.set('ndis_package_type', enhancedFilterCriteria.ndis_package_type);
        
        const queryString = params.toString();
        response = await fetch(`/api/packages${queryString ? `?${queryString}` : ''}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        let packageList = data.packages || data;
        
        // Store debug information if provided
        if (data.debug) {
          setDebugInfo(data.debug);
        }
        
        // ENHANCED: Sort packages based on care requirements and match score
        if (careAnalysis.recommendedPackages && careAnalysis.recommendedPackages.length > 0) {
          packageList = packageList.sort((a, b) => {
            // First, prioritize recommended packages
            const aRecommended = careAnalysis.recommendedPackages.includes(a.package_code);
            const bRecommended = careAnalysis.recommendedPackages.includes(b.package_code);
            
            if (aRecommended && !bRecommended) return -1;
            if (!aRecommended && bRecommended) return 1;
            
            // Then by match score if available
            if (a.matchScore && b.matchScore) {
              return b.matchScore - a.matchScore;
            }
            
            // Finally by name
            return (a.name || '').localeCompare(b.name || '');
          });
        }
        
        setPackages(packageList);
        
        console.log(`✅ Fetched ${packageList.length} packages`, {
          careHours: careAnalysis.totalHoursPerDay,
          pattern: careAnalysis.carePattern,
          recommended: careAnalysis.recommendedPackages,
          advanced: needsAdvancedFiltering
        });
        
      } else {
        console.error('Failed to fetch packages:', data.error);
        setPackages([]);
        setFetchError(data.error || 'Failed to fetch packages');
      }
      
    } catch (error) {
      console.error('Error fetching packages:', error);
      setFetchError('Network error - please check your connection and try again');
      setPackages([]);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  // Fetch packages when criteria changes
  useEffect(() => {
    if (fetchTimeout.current) {
      clearTimeout(fetchTimeout.current);
    }

    fetchTimeout.current = setTimeout(() => {
      if (isMounted.current) {
        fetchPackages();
      }
    }, 300); // Debounce API calls

    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, [enhancedFilterCriteria]);

  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle package selection
  const handlePackageSelect = (selectedPackage) => {
    if (multi) {
      const currentValues = Array.isArray(value) ? value : [];
      const isSelected = currentValues.some(pkg => pkg.id === selectedPackage.id);
      
      const newValue = isSelected
        ? currentValues.filter(pkg => pkg.id !== selectedPackage.id)
        : [...currentValues, selectedPackage];
        
      onChange?.(newValue);
    } else {
      onChange?.(selectedPackage);
    }
  };

  // Group packages by funder type for better organization
  const groupedPackages = useMemo(() => {
    const groups = {
      'NDIS': packages.filter(pkg => pkg.funder === 'NDIS'),
      'Non-NDIS': packages.filter(pkg => pkg.funder !== 'NDIS')
    };
    
    // Sort each group by recommended packages first
    Object.keys(groups).forEach(key => {
      groups[key].sort((a, b) => {
        const aRecommended = careAnalysis.recommendedPackages?.includes(a.package_code);
        const bRecommended = careAnalysis.recommendedPackages?.includes(b.package_code);
        
        if (aRecommended && !bRecommended) return -1;
        if (!aRecommended && bRecommended) return 1;
        return 0;
      });
    });
    
    return groups;
  }, [packages, careAnalysis.recommendedPackages]);

  // Render loading state
  if (loading && packages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading packages based on your care requirements...</p>
          {careAnalysis.totalHoursPerDay > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Analyzing {careAnalysis.totalHoursPerDay}h daily care needs
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (fetchError) {
    return (
      <div className="p-4 border border-red-300 rounded-lg bg-red-50">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <span>⚠️</span>
          <span className="font-medium">Error loading packages</span>
        </div>
        <p className="text-sm text-red-600 mb-3">{fetchError}</p>
        <button
          onClick={fetchPackages}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render empty state
  if (packages.length === 0 && !loading) {
    return (
      <div className="p-8 text-center border rounded-lg bg-gray-50">
        <div className="text-4xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No suitable packages found</h3>
        <p className="text-gray-600 mb-4">
          {careAnalysis.requiresCare 
            ? `No packages match your ${careAnalysis.totalHoursPerDay}h daily care requirements.`
            : 'No packages match your current criteria.'
          }
        </p>
        <button
          onClick={fetchPackages}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Refresh Packages
        </button>
      </div>
    );
  }

  return (
    <div className={`package-selection ${className}`.trim()}>
      {/* Care Requirements Summary */}
      {careAnalysis.requiresCare && careAnalysis.totalHoursPerDay > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <span className="text-blue-600 mt-0.5">🏥</span>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-800 mb-1">
                Care Requirements Detected
              </h4>
              <p className="text-sm text-blue-700">
                {formatCareScheduleForDisplay(careAnalysis.rawCareData || []).summary}
              </p>
              {careAnalysis.recommendedPackages?.length > 0 && (
                <p className="text-xs text-blue-600 mt-1">
                  📋 Showing {careAnalysis.recommendedPackages.length} recommended package types
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Package Groups */}
      <div className="space-y-6">
        {Object.entries(groupedPackages).map(([funderType, funderPackages]) => {
          if (funderPackages.length === 0) return null;
          
          const isExpanded = expandedCategories.has(funderType);
          
          return (
            <div key={funderType} className="border rounded-lg overflow-hidden">
              {/* Category Header */}
              <button
                onClick={() => {
                  const newExpanded = new Set(expandedCategories);
                  if (isExpanded) {
                    newExpanded.delete(funderType);
                  } else {
                    newExpanded.add(funderType);
                  }
                  setExpandedCategories(newExpanded);
                }}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="font-medium text-gray-900">{funderType} Packages</span>
                  <span className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded-full">
                    {funderPackages.length}
                  </span>
                </div>
                <span className={`transform transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`}>
                  ▼
                </span>
              </button>

              {/* Package List */}
              {isExpanded && (
                <div className="divide-y divide-gray-200">
                  {funderPackages.map((pkg) => {
                    const isSelected = multi 
                      ? Array.isArray(value) && value.some(v => v.id === pkg.id)
                      : value && value.id === pkg.id;
                    
                    const isRecommended = careAnalysis.recommendedPackages?.includes(pkg.package_code);
                    
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => handlePackageSelect(pkg)}
                        className={`p-4 cursor-pointer transition-all hover:bg-gray-50 ${
                          isSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                        } ${isRecommended ? 'ring-1 ring-green-200 bg-green-50' : ''}`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="font-medium text-gray-900">{pkg.name}</h3>
                              {isRecommended && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                                  ⭐ Recommended
                                </span>
                              )}
                              {pkg.matchScore && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  {Math.round(pkg.matchScore * 100)}% match
                                </span>
                              )}
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              {pkg.package_code} • {pkg.formattedPrice}
                            </p>
                            
                            {pkg.summary && (
                              <p className="text-xs text-gray-500">{pkg.summary}</p>
                            )}
                          </div>
                          
                          {/* Selection Indicator */}
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            isSelected 
                              ? 'bg-blue-600 border-blue-600' 
                              : 'border-gray-300'
                          }`}>
                            {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Debug Information (only in development) */}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <details className="mt-4 p-3 bg-gray-100 rounded text-xs">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <pre className="mt-2 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}

      {/* Error indicator */}
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default PackageSelection;