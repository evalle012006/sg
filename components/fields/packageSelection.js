import React, { useState, useEffect, useCallback } from 'react';

const PackageSelection = ({ 
  funder = null,
  ndis_package_type = null,
  value = null, 
  onChange, 
  required = false,
  multi = false,
  builderMode = false,
  error = null,
  className = '',
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);

  // Fetch packages from API
  const fetchPackages = useCallback(async () => {
    if (!funder && !builderMode) return;

    setLoading(true);
    setFetchError(null);

    try {
      const queryParams = new URLSearchParams();
      if (funder) queryParams.append('funder', funder);
      if (ndis_package_type) queryParams.append('ndis_package_type', ndis_package_type);

      const response = await fetch(`/api/packages?${queryParams.toString()}`);
      const data = await response.json();

      if (data.success) {
        setPackages(data.packages || []);
      } else {
        setFetchError(data.error || 'Failed to fetch packages');
      }
    } catch (err) {
      console.error('Error fetching packages:', err);
      setFetchError('Failed to fetch packages');
    } finally {
      setLoading(false);
    }
  }, [funder, ndis_package_type, builderMode]);

  // Fetch packages when funder or ndis_package_type changes
  useEffect(() => {
    fetchPackages();
  }, [fetchPackages]);

  // Handle the change event for single selection
  const handleChange = (packageId) => {
    if (onChange && !builderMode) {
      onChange(packageId);
    }
  };

  // Handle the change event for multi selection
  const handleMultiChange = (packageId) => {
    if (onChange && !builderMode) {
      if (Array.isArray(value)) {
        if (value.includes(packageId)) {
          onChange(value.filter(v => v !== packageId));
        } else {
          onChange([...value, packageId]);
        }
      } else {
        onChange([packageId]);
      }
    }
  };

  // Check if a package is selected
  const isSelected = (packageId) => {
    if (multi) {
      return Array.isArray(value) && value.includes(packageId);
    }
    return value === packageId;
  };

  // Get validation styling
  const getValidationClasses = () => {
    if (error) {
      return 'border-red-400 bg-red-50';
    }
    if (required && value && ((Array.isArray(value) && value.length > 0) || (!Array.isArray(value) && value))) {
      return 'border-green-400 bg-green-50';
    }
    return 'border-gray-300 bg-white';
  };

  // Show loading state
  if (loading) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-center items-center py-8">
          <div className="flex flex-col items-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
            <span className="text-sm text-gray-600">Loading packages...</span>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (fetchError) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-center items-center py-8">
          <div className="flex flex-col items-center text-red-500">
            <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm">{fetchError}</span>
            <button 
              onClick={fetchPackages}
              className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show empty state
  if (packages.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        <div className="flex justify-center items-center py-8">
          <div className="flex flex-col items-center text-gray-500">
            <svg className="h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-sm">No packages available</span>
            {funder && (
              <span className="text-xs text-gray-400 mt-1">
                for {funder} {ndis_package_type ? `(${ndis_package_type})` : ''}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render Non-NDIS packages as cards
  const renderNonNdisPackages = () => {
    const nonNdisPackages = packages.filter(pkg => pkg.funder === 'Non-NDIS');
    
    if (nonNdisPackages.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">Non-NDIS Packages</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {nonNdisPackages.map((pkg) => (
            <div
              key={pkg.id}
              className={`relative border-2 rounded-lg p-4 cursor-pointer transition-all duration-200 ${
                isSelected(pkg.id) 
                  ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-200' 
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }`}
              onClick={() => multi ? handleMultiChange(pkg.id) : handleChange(pkg.id)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h5 className="font-semibold text-gray-900 mb-2">{pkg.name}</h5>
                  <div className="text-2xl font-bold text-blue-600">
                    ${pkg.price ? pkg.price.toFixed(2) : 'TBA'}
                  </div>
                  <div className="text-sm text-gray-500 mt-1">per night</div>
                </div>
                
                {/* Radio/Checkbox control */}
                <div className="flex-shrink-0 ml-4">
                  {multi ? (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected(pkg.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected(pkg.id) && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ) : (
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                      isSelected(pkg.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                    }`}>
                      {isSelected(pkg.id) && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Hidden input for form submission */}
              <input
                type={multi ? "checkbox" : "radio"}
                name="package-selection"
                value={pkg.id}
                checked={isSelected(pkg.id)}
                onChange={() => multi ? handleMultiChange(pkg.id) : handleChange(pkg.id)}
                className="sr-only"
                required={required && (!multi || (Array.isArray(value) && value.length === 0))}
              />
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Render NDIS packages as table
  const renderNdisPackages = () => {
    const ndisPackages = packages.filter(pkg => pkg.funder === 'NDIS');
    
    if (ndisPackages.length === 0) return null;

    return (
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900">NDIS Packages</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  {multi ? 'Select' : 'Choose'}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Package Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Package Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Line Item Details
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ndisPackages.map((pkg) => (
                <React.Fragment key={pkg.id}>
                  {/* Package Selection Row */}
                  <tr 
                    className={`hover:bg-gray-50 cursor-pointer transition-colors duration-150 ${
                      isSelected(pkg.id) ? 'bg-blue-50 border-l-4 border-blue-600' : ''
                    }`}
                    onClick={() => multi ? handleMultiChange(pkg.id) : handleChange(pkg.id)}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {multi ? (
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected(pkg.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}>
                            {isSelected(pkg.id) && (
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </div>
                        ) : (
                          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            isSelected(pkg.id) ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                          }`}>
                            {isSelected(pkg.id) && (
                              <div className="w-2 h-2 bg-white rounded-full"></div>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900">
                        {pkg.name}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600 font-mono">
                        {pkg.package_code || 'N/A'}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">
                        {pkg.ndis_line_items && pkg.ndis_line_items.length > 0 
                          ? `${pkg.ndis_line_items.length} line item${pkg.ndis_line_items.length > 1 ? 's' : ''} included`
                          : 'No line items'
                        }
                      </div>
                    </td>
                  </tr>
                  
                  {/* Line Items Details Rows (only show if package is selected) */}
                  {isSelected(pkg.id) && pkg.ndis_line_items && pkg.ndis_line_items.length > 0 && (
                    <>
                      {/* Line Items Header */}
                      <tr className="bg-gray-50">
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-600 uppercase">
                          Line Item Code
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-600 uppercase">
                          STA Package Description
                        </td>
                        <td className="px-4 py-2 text-xs font-medium text-gray-600 uppercase text-right">
                          Price per Night
                        </td>
                      </tr>
                      
                      {/* Line Items Data */}
                      {pkg.ndis_line_items.map((item, itemIndex) => (
                        <tr key={`${pkg.id}-item-${itemIndex}`} className="bg-gray-50">
                          <td className="px-4 py-2"></td>
                          <td className="px-4 py-2">
                            <div className="text-sm font-mono text-gray-700">
                              {item.line_item}
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="text-sm text-gray-700">
                              {item.sta_package}
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="text-sm font-semibold text-gray-900">
                              ${item.price_per_night}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </>
                  )}
                  
                  {/* Hidden input for form submission */}
                  <input
                    key={`input-${pkg.id}`}
                    type={multi ? "checkbox" : "radio"}
                    name="package-selection"
                    value={pkg.id}
                    checked={isSelected(pkg.id)}
                    onChange={() => multi ? handleMultiChange(pkg.id) : handleChange(pkg.id)}
                    className="sr-only"
                    required={required && (!multi || (Array.isArray(value) && value.length === 0))}
                  />
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <div className={`w-full ${className}`}>
      <div className={`rounded-lg border transition-all duration-200 p-4 ${getValidationClasses()}`}>
        {/* Filter information */}
        {(funder || ndis_package_type) && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
            <div className="flex items-center">
              <svg className="h-4 w-4 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <span className="text-sm text-blue-700">
                Showing {funder} packages
                {ndis_package_type && ` for ${ndis_package_type} services`}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-8">
          {/* Render Non-NDIS packages as cards */}
          {renderNonNdisPackages()}
          
          {/* Render NDIS packages as table */}
          {renderNdisPackages()}
        </div>
      </div>
      
      {/* Error message */}
      {error && (
        <div className="mt-1.5 flex items-center">
          <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-red-600 text-sm font-medium">{error}</p>
        </div>
      )}
    </div>
  );
};

export default PackageSelection;