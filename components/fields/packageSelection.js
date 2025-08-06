import React, { useState, useEffect, useRef } from 'react';

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
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [expandedPackages, setExpandedPackages] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set(['NDIS', 'Non-NDIS'])); // Default expand all categories
  
  const isMounted = useRef(true);
  const fetchTimeout = useRef(null);

  const fetchPackages = async () => {
    try {
        setLoading(true);
        
        const params = {
            funder: localFilterState.funderType,
            page: 1,
            limit: 50,
            sort: 'name'
        };
        
        // Only add NDIS package type if funder is NDIS
        if (localFilterState.funderType === 'NDIS' && localFilterState.ndisPackageType) {
            params.ndis_package_type = localFilterState.ndisPackageType;
        }
        
        // Add Non-NDIS specific filters (but no price filtering - get ALL Non-NDIS packages)
        if (localFilterState.funderType === 'Non-NDIS') {
            console.log('Non-NDIS: Fetching all packages without price filtering');
            // Don't add priceRange - we want ALL Non-NDIS packages
            
            // You can add other Non-NDIS specific filters here if needed
            // if (localFilterState.additionalFilters?.region) {
            //     params.region = localFilterState.additionalFilters.region;
            // }
        }
        
        const queryString = new URLSearchParams(params).toString();
        const apiUrl = `/api/packages?${queryString}`;
        
        console.log('Fetching packages with URL:', apiUrl);
        
        const response = await fetch(apiUrl);
        const data = await response.json();
        
        if (data.success) {
            setPackages(data.packages);
            console.log(`✅ Fetched ${data.packages.length} packages`);
        } else {
            console.error('Failed to fetch packages:', data.error);
            setPackages([]);
        }
    } catch (error) {
        console.error('Error fetching packages:', error);
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
  }, [funder, ndis_package_type, builderMode]);

  useEffect(() => {
    fetchTimeout.current = setTimeout(() => {
      fetchPackages();
    }, 100);

    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, [JSON.stringify(additionalFilters || {})]);

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

  // Render individual package card
  const renderPackageCard = (pkg) => {
    const isSelected = selectedIds.includes(pkg.id);
    const isExpanded = expandedPackages.has(pkg.id);
    const hasManyLineItems = pkg.funder === 'NDIS' && pkg.ndis_line_items && pkg.ndis_line_items.length > 3;
    
    return (
      <div 
        key={pkg.id} 
        className={`group relative overflow-hidden rounded-xl border-2 transition-all duration-300 cursor-pointer
          ${isSelected 
            ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-blue-100 shadow-lg scale-[1.02] ring-4 ring-blue-200/50' 
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
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-3 right-3 z-10">
            <div className="w-7 h-7 bg-blue-500 rounded-full flex items-center justify-center shadow-lg">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        )}

        <div className="p-6">
          {/* Package Header */}
          <div className="mb-4">
            <div className="flex items-start justify-between mb-2">
              <h3 className="font-bold text-gray-900 text-lg leading-tight pr-10">{pkg.name}</h3>
            </div>
            
            {pkg.package_code && (
              <div className="flex items-center gap-2 mb-3">
                <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-mono">
                  {pkg.package_code}
                </span>
              </div>
            )}

            {/* Funder and Package Type Badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium
                ${pkg.funder === 'NDIS' 
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-green-100 text-green-800'
                }`}>
                {pkg.funder}
              </span>
              {pkg.ndis_package_type && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-purple-100 text-purple-800 text-xs font-medium">
                  {pkg.ndis_package_type.toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Package Content */}
          <div className="space-y-4">
            {/* Non-NDIS Price Display */}
            {pkg.funder === 'Non-NDIS' && pkg.price && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-green-700">Package Price</span>
                  <span className="text-2xl font-bold text-green-800">${pkg.price}</span>
                </div>
              </div>
            )}

            {/* NDIS Line Items */}
            {pkg.funder === 'NDIS' && pkg.ndis_line_items && pkg.ndis_line_items.length > 0 && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold text-blue-800">
                      NDIS Line Items ({pkg.ndis_line_items.length})
                    </h4>
                    {hasManyLineItems && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          togglePackageExpansion(pkg.id);
                        }}
                        className="text-xs font-medium text-blue-600 hover:text-blue-800 transition-colors duration-200 flex items-center gap-1"
                      >
                        {isExpanded ? 'Show Less' : 'Show All'}
                        <svg 
                          className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                          fill="none" 
                          stroke="currentColor" 
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    {(isExpanded ? pkg.ndis_line_items : pkg.ndis_line_items.slice(0, 3)).map((item, index) => (
                      <div key={index} className="bg-white rounded-md p-3 border border-blue-100 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-gray-900 text-sm">
                              {item.sta_package || item.line_item || `Line Item ${index + 1}`}
                            </div>
                            {item.description && (
                              <div className="text-xs text-gray-600 mt-1">{item.description}</div>
                            )}
                          </div>
                          {item.price_per_night && (
                            <div className="ml-3 text-right">
                              <div className="font-semibold text-blue-800">${item.price_per_night}</div>
                              <div className="text-xs text-gray-500">per night</div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {!isExpanded && pkg.ndis_line_items.length > 3 && (
                      <div className="text-center py-2">
                        <span className="text-xs text-blue-600 font-medium">
                          +{pkg.ndis_line_items.length - 3} more items
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Multi-selection indicator */}
            {multi && (
              <div className="flex items-center pt-2 border-t border-gray-100">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 text-sm text-gray-600 font-medium">
                  {isSelected ? 'Selected' : 'Select this package'}
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Hover effect overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
      </div>
    );
  };

  // Render categorized packages (builder mode only)
  const renderCategorizedPackages = (packages) => {
    const categories = categorizePackages(packages);

    return (
      <div className="space-y-6">
        {Object.entries(categories).map(([categoryName, categoryPackages]) => {
          const isExpanded = expandedCategories.has(categoryName);
          const categoryIcon = categoryName === 'NDIS' ? '🏥' : categoryName === 'Non-NDIS' ? '💼' : '📦';
          
          return (
            <div key={categoryName} className="bg-gray-50 rounded-xl p-1 border border-gray-200">
              <button
                onClick={() => toggleCategoryExpansion(categoryName)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-100 rounded-lg transition-colors duration-200"
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{categoryIcon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900 text-lg">{categoryName} Packages</h3>
                    <p className="text-sm text-gray-600">{categoryPackages.length} packages available</p>
                  </div>
                </div>
                <svg 
                  className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded && (
                <div className="p-4 pt-0">
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {categoryPackages.map(renderPackageCard)}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`package-selection-loading ${className}`}>
        <div className="flex items-center justify-center p-12">
          <div className="relative">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200"></div>
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent absolute top-0"></div>
          </div>
          <div className="ml-4 text-gray-600 font-medium">Loading packages...</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (fetchError) {
    return (
      <div className={`package-selection-error ${className}`}>
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 text-center">
          <div className="text-red-600 text-4xl mb-3">⚠️</div>
          <div className="text-red-800 font-semibold text-lg mb-2">Error loading packages</div>
          <div className="text-red-600 text-sm mb-4">{fetchError}</div>
          <button 
            onClick={fetchPackages}
            className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700 transition-colors duration-200 font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Show builder mode message when no packages
  if (builderMode && packages.length === 0) {
    return (
      <div className={`package-selection-builder ${className}`}>
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-dashed border-blue-300 rounded-xl p-8 text-center">
          <div className="text-4xl mb-4">📦</div>
          <div className="text-blue-800 font-bold text-xl mb-2">Package Selection Field</div>
          <div className="text-blue-600 mb-2">Shows all available packages in live form</div>
          <div className="text-blue-500 text-sm">
            Filtering will be applied in the booking request form based on funder type and other parameters
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`package-selection ${className} mt-4`}>
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
      
      {/* Render packages */}
      {builderMode ? (
        renderCategorizedPackages(packages)
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packages.map(renderPackageCard)}
        </div>
      )}

      {/* No packages message */}
      {packages.length === 0 && !builderMode && (
        <div className="text-center py-16">
          <div className="text-6xl mb-4">📭</div>
          <div className="text-gray-600 text-xl mb-2">No packages available</div>
          <div className="text-gray-500">No packages match the current filter criteria</div>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="text-red-700 text-sm font-medium">{error}</div>
        </div>
      )}

      {/* Required field indicator */}
      {required && !value && (
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="text-yellow-800 text-sm font-medium">⚠️ This field is required</div>
        </div>
      )}
    </div>
  );
};

export default PackageSelection;