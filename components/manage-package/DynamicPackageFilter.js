import React, { useState, useEffect, useCallback } from 'react';
import { ChevronDown, ChevronUp, Filter, X, Settings } from 'lucide-react';

const DynamicPackageFilter = ({ 
  onPackagesChange, 
  onFiltersChange,
  initialFilters = {},
  className = '',
  adminMode = false,
  showAdvancedFilters = false
}) => {
  // Filter state
  const [filters, setFilters] = useState({
    funder_type: initialFilters.funder_type || '',
    ndis_package_type: initialFilters.ndis_package_type || '',
    care_hours: initialFilters.care_hours || '',
    has_course: initialFilters.has_course || '',
    sta_in_plan: initialFilters.sta_in_plan || '',
    living_situation: initialFilters.living_situation || '',
    search: initialFilters.search || '',
    // Admin-specific filters
    has_requirements: adminMode ? (initialFilters.has_requirements || '') : '',
    is_active: adminMode ? (initialFilters.is_active || '') : '',
    price_range: adminMode ? (initialFilters.price_range || '') : ''
  });

  // UI state
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isExpanded, setIsExpanded] = useState(true);
  const [showAdminFilters, setShowAdminFilters] = useState(false);
  const [filterSummary, setFilterSummary] = useState('');
  const [stats, setStats] = useState({});
  const [hasInitialLoad, setHasInitialLoad] = useState(false);
  const [requirementsSystemAvailable, setRequirementsSystemAvailable] = useState(true);

  // Debounced search
  const [searchDebounce, setSearchDebounce] = useState(null);

  // Fetch packages based on current filters
  const fetchPackages = useCallback(async (currentFilters) => {
    // Use current filters if provided, otherwise use state
    const filtersToUse = currentFilters || filters;
    
    setLoading(true);
    setError(null);

    try {
      // In admin mode, use either the dynamic filter API or the regular API
      const apiEndpoint = adminMode && hasActiveFilters(filtersToUse) 
        ? '/api/packages/filter' 
        : '/api/packages';

      let response;
      
      if (adminMode && hasActiveFilters(filtersToUse)) {
        // Use dynamic filtering for complex queries
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...filtersToUse,
            // Convert string values to appropriate types
            care_hours: filtersToUse.care_hours !== '' ? parseInt(filtersToUse.care_hours) : undefined,
            has_course: filtersToUse.has_course !== '' ? filtersToUse.has_course === 'true' : undefined,
            sta_in_plan: filtersToUse.sta_in_plan !== '' ? filtersToUse.sta_in_plan === 'true' : undefined,
            // Admin mode specific
            admin_mode: true,
            include_inactive: filtersToUse.is_active === 'false'
          })
        });
      } else {
        // Use simple API for basic listing
        const params = new URLSearchParams();
        if (filtersToUse.funder_type) params.set('funder', filtersToUse.funder_type);
        if (filtersToUse.ndis_package_type) params.set('ndis_package_type', filtersToUse.ndis_package_type);
        if (filtersToUse.search) params.set('search', filtersToUse.search);
        // Add include_requirements for admin mode
        if (adminMode) params.set('include_requirements', 'true');
        
        const queryString = params.toString();
        response = await fetch(`${apiEndpoint}${queryString ? `?${queryString}` : '?include_requirements=true'}`);
      }

      const data = await response.json();

      if (data.success) {
        let packageList = data.packages || data;
        
        // Apply admin-specific client-side filters
        if (adminMode) {
          packageList = applyAdminFilters(packageList, filtersToUse);
        }
        
        setPackages(packageList);
        setFilterSummary(data.filters?.summary || `${packageList.length} packages found`);
        
        // Check if requirements system is available
        if (data.system_status && !data.system_status.requirements_available) {
          setFilterSummary(prev => `${prev} (Basic filtering - Requirements system not set up)`);
          setRequirementsSystemAvailable(false);
        } else if (data.admin_stats && data.admin_stats.requirements_system_available !== undefined) {
          setRequirementsSystemAvailable(data.admin_stats.requirements_system_available);
        }
        
        // Calculate stats for admin mode
        if (adminMode) {
          calculateStats(packageList);
        }
        
        onPackagesChange?.(packageList);
      } else {
        throw new Error(data.message || 'Failed to fetch packages');
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      setError(err.message);
      setPackages([]);
      onPackagesChange?.([]);
    } finally {
      setLoading(false);
    }
  }, [adminMode, onPackagesChange]); // Removed filters from dependencies

  // Check if any filters are active
  const hasActiveFilters = (filterObj) => {
    return Object.values(filterObj).some(value => value !== '');
  };

  // Apply admin-specific filters on client side
  const applyAdminFilters = (packageList, currentFilters) => {
    let filtered = [...packageList];

    // Filter by price range
    if (currentFilters.price_range) {
      const [min, max] = currentFilters.price_range.split('-').map(v => parseFloat(v));
      filtered = filtered.filter(pkg => {
        if (pkg.funder === 'NDIS') return true; // NDIS packages don't have simple prices
        const price = parseFloat(pkg.price) || 0;
        return price >= min && (max ? price <= max : true);
      });
    }

    // Filter by whether package has requirements setup
    if (currentFilters.has_requirements === 'true') {
      filtered = filtered.filter(pkg => pkg.requirements && pkg.requirements.length > 0);
    } else if (currentFilters.has_requirements === 'false') {
      filtered = filtered.filter(pkg => !pkg.requirements || pkg.requirements.length === 0);
    }

    return filtered;
  };

  // Calculate statistics for admin view
  const calculateStats = (packageList) => {
    const stats = {
      total: packageList.length,
      ndis: packageList.filter(p => p.funder === 'NDIS').length,
      nonNdis: packageList.filter(p => p.funder === 'Non-NDIS').length,
      withRequirements: packageList.filter(p => p.requirements && p.requirements.length > 0).length,
      avgPrice: 0
    };

    const nonNdisWithPrice = packageList.filter(p => p.funder === 'Non-NDIS' && p.price);
    if (nonNdisWithPrice.length > 0) {
      stats.avgPrice = nonNdisWithPrice.reduce((sum, p) => sum + parseFloat(p.price), 0) / nonNdisWithPrice.length;
    }

    setStats(stats);
  };

  // Handle filter changes
  const handleFilterChange = (filterName, value) => {
    const newFilters = { ...filters, [filterName]: value };
    
    // Reset dependent filters
    if (filterName === 'funder_type') {
      if (value !== 'NDIS') {
        newFilters.ndis_package_type = '';
        newFilters.sta_in_plan = '';
      }
    }

    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  // Handle search with debouncing
  const handleSearchChange = (value) => {
    const newFilters = { ...filters, search: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
    
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
    
    const timeout = setTimeout(() => {
      fetchPackages(newFilters);
    }, 300);
    
    setSearchDebounce(timeout);
  };

  // Clear all filters
  const clearAllFilters = () => {
    const clearedFilters = {
      funder_type: '',
      ndis_package_type: '',
      care_hours: '',
      has_course: '',
      sta_in_plan: '',
      living_situation: '',
      search: '',
      ...(adminMode && {
        has_requirements: '',
        is_active: '',
        price_range: ''
      })
    };
    setFilters(clearedFilters);
    onFiltersChange?.(clearedFilters);
  };

  // Get active filter count
  const getActiveFilterCount = () => {
    return Object.values(filters).filter(value => value !== '').length;
  };

  // Initial load effect
  useEffect(() => {
    // Only fetch packages when component mounts and hasn't loaded yet
    if (!hasInitialLoad) {
      fetchPackages(filters);
      setHasInitialLoad(true);
    }
  }, []); // Only run on mount

  // Effect to fetch packages when filters change
  useEffect(() => {
    if (searchDebounce || !hasInitialLoad) return; // Skip if search is debouncing or not initially loaded
    
    const timer = setTimeout(() => {
      fetchPackages(filters);
    }, 100);

    return () => clearTimeout(timer);
  }, [
    hasInitialLoad,
    filters.funder_type,
    filters.ndis_package_type, 
    filters.care_hours,
    filters.has_course,
    filters.sta_in_plan,
    filters.living_situation,
    filters.has_requirements,
    filters.is_active,
    filters.price_range
    // Note: Removed filters.search and fetchPackages from dependencies to prevent infinite loops
  ]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce);
      }
    };
  }, [searchDebounce]);

  return (
    <div className={`bg-white rounded-lg shadow-lg border ${className}`}>
      {/* Filter Header */}
      <div className="flex items-center justify-between p-4 border-b bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-3">
          <Filter className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {adminMode ? 'Admin Filters' : 'Package Filters'}
          </h3>
          {getActiveFilterCount() > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs font-medium px-2.5 py-0.5 rounded-full">
              {getActiveFilterCount()} active
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {adminMode && (
            <button
              onClick={() => setShowAdminFilters(!showAdminFilters)}
              className={`text-sm px-2 py-1 rounded transition-colors ${
                showAdminFilters 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'text-gray-600 hover:text-purple-600'
              }`}
            >
              <Settings className="w-4 h-4 inline mr-1" />
              Advanced
            </button>
          )}
          {getActiveFilterCount() > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-gray-600 hover:text-red-600 flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Clear all
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-gray-600 hover:text-gray-900 p-1"
          >
            {isExpanded ? (
              <ChevronUp className="w-5 h-5" />
            ) : (
              <ChevronDown className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Filter Results Summary */}
      {filterSummary && (
        <div className="px-4 py-2 bg-blue-50 border-b">
          <p className="text-sm text-blue-800">{filterSummary}</p>
        </div>
      )}

      {/* Admin Statistics */}
      {adminMode && stats.total > 0 && (
        <div className="px-4 py-3 bg-gray-50 border-b">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-600">Total:</span>
              <span className="ml-1 font-medium">{stats.total}</span>
            </div>
            <div>
              <span className="text-gray-600">NDIS:</span>
              <span className="ml-1 font-medium">{stats.ndis}</span>
            </div>
            <div>
              <span className="text-gray-600">Non-NDIS:</span>
              <span className="ml-1 font-medium">{stats.nonNdis}</span>
            </div>
            <div>
              <span className="text-gray-600">With Rules:</span>
              <span className="ml-1 font-medium">{stats.withRequirements}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter Controls */}
      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Packages
            </label>
            <input
              type="text"
              value={filters.search}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by package name or code..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Basic Filter Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Funder Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Funder Type
              </label>
              <select
                value={filters.funder_type}
                onChange={(e) => handleFilterChange('funder_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">All Funders</option>
                <option value="NDIS">NDIS</option>
                <option value="Non-NDIS">Non-NDIS</option>
              </select>
            </div>

            {/* NDIS Package Type - Only show when NDIS is selected */}
            {filters.funder_type === 'NDIS' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  NDIS Package Type
                </label>
                <select
                  value={filters.ndis_package_type}
                  onChange={(e) => handleFilterChange('ndis_package_type', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All NDIS Types</option>
                  <option value="sta">STA (Short Term Accommodation)</option>
                  <option value="holiday">Holiday</option>
                </select>
              </div>
            )}
          </div>

          {/* Requirements System Status Notice */}
          {!requirementsSystemAvailable && adminMode && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <div className="text-yellow-600">⚠️</div>
                <div>
                  <div className="text-sm font-medium text-yellow-800">Requirements System Not Set Up</div>
                  <div className="text-xs text-yellow-700 mt-1">
                    Advanced filtering (care hours, courses, etc.) will be available after running the requirements migration.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Advanced Filters - Show based on settings and system availability */}
          {(showAdvancedFilters || adminMode) && requirementsSystemAvailable && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="text-sm font-medium text-gray-700">Advanced Filters</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Care Hours */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Care Hours Required
                  </label>
                  <select
                    value={filters.care_hours}
                    onChange={(e) => handleFilterChange('care_hours', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Any Care Level</option>
                    <option value="0">No Care Required</option>
                    <option value="3">Up to 3 hours</option>
                    <option value="6">Up to 6 hours</option>
                    <option value="12">More than 6 hours</option>
                    <option value="24">24 hour care</option>
                  </select>
                </div>

                {/* Course Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Course Participation
                  </label>
                  <select
                    value={filters.has_course}
                    onChange={(e) => handleFilterChange('has_course', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Any Course Status</option>
                    <option value="true">With Course</option>
                    <option value="false">No Course</option>
                  </select>
                </div>

                {/* STA in Plan - Only show when NDIS is selected */}
                {filters.funder_type === 'NDIS' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      STA in NDIS Plan
                    </label>
                    <select
                      value={filters.sta_in_plan}
                      onChange={(e) => handleFilterChange('sta_in_plan', e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Either</option>
                      <option value="true">STA in Plan</option>
                      <option value="false">No STA in Plan</option>
                    </select>
                  </div>
                )}

                {/* Living Situation */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Living Situation
                  </label>
                  <select
                    value={filters.living_situation}
                    onChange={(e) => handleFilterChange('living_situation', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Any Situation</option>
                    <option value="alone">Lives Alone</option>
                    <option value="with_supports">With Informal Supports</option>
                    <option value="sil">Supported Independent Living</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Admin-Only Filters */}
          {adminMode && showAdminFilters && (
            <div className="space-y-4 pt-4 border-t border-purple-200">
              <h4 className="text-sm font-medium text-purple-700">Admin Only</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Has Requirements */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Requirements Setup
                  </label>
                  <select
                    value={filters.has_requirements}
                    onChange={(e) => handleFilterChange('has_requirements', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">All Packages</option>
                    <option value="true">Has Requirements</option>
                    <option value="false">Missing Requirements</option>
                  </select>
                </div>

                {/* Price Range (Non-NDIS) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Price Range (Non-NDIS)
                  </label>
                  <select
                    value={filters.price_range}
                    onChange={(e) => handleFilterChange('price_range', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                  >
                    <option value="">Any Price</option>
                    <option value="0-100">$0 - $100</option>
                    <option value="100-500">$100 - $500</option>
                    <option value="500-1000">$500 - $1000</option>
                    <option value="1000-">$1000+</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading and Error States */}
      {loading && (
        <div className="p-4 text-center">
          <div className="inline-flex items-center gap-2 text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span>Loading packages...</span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-400">
          <p className="text-red-800">{error}</p>
        </div>
      )}
    </div>
  );
};

export default DynamicPackageFilter;