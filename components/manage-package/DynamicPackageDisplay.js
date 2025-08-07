import React, { useState } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Info,
  ChevronDown,
  ChevronUp,
  Star,
  DollarSign,
  Calendar,
  Users,
  GraduationCap,
  Edit,
  Trash2,
  Eye,
  AlertTriangle,
  Settings
} from 'lucide-react';

const DynamicPackageDisplay = ({ 
  packages = [], 
  loading = false, 
  onPackageSelect,
  onPackageEdit,
  onPackageDelete,
  onPackageView,
  onPackageRequirements,
  selectedPackage = null,
  showDetails = true,
  layout = 'grid', // 'grid' | 'list'
  adminMode = false
}) => {
  const [expandedPackages, setExpandedPackages] = useState(new Set());

  const togglePackageDetails = (packageId) => {
    const newExpanded = new Set(expandedPackages);
    if (newExpanded.has(packageId)) {
      newExpanded.delete(packageId);
    } else {
      newExpanded.add(packageId);
    }
    setExpandedPackages(newExpanded);
  };

  const renderRequirementBadge = (requirement, label) => {
    if (requirement === true) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircle className="w-3 h-3 mr-1" />
          {label}
        </span>
      );
    } else if (requirement === false) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircle className="w-3 h-3 mr-1" />
          No {label}
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Info className="w-3 h-3 mr-1" />
          {label} Optional
        </span>
      );
    }
  };

  const renderCareHoursInfo = (requirement) => {
    if (!requirement) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          No Requirements Set
        </span>
      );
    }

    const { min, max } = requirement.care_hours_range || {};
    
    if (requirement.requires_no_care) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          <Users className="w-3 h-3 mr-1" />
          No Care Required
        </span>
      );
    }
    
    if (min === null && max === null) {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
          <Users className="w-3 h-3 mr-1" />
          Any Care Level
        </span>
      );
    }
    
    const minHours = min || 0;
    const maxHours = max === null ? '∞' : max;
    
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
        <Users className="w-3 h-3 mr-1" />
        {minHours === maxHours ? `${minHours}h` : `${minHours}-${maxHours}h`} Care
      </span>
    );
  };

  const renderAdminActions = (pkg) => {
    if (!adminMode) return null;

    return (
      <div className="flex items-center gap-1 mt-2">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPackageView?.(pkg);
          }}
          className="p-1 rounded text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPackageEdit?.(pkg);
          }}
          className="p-1 rounded text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
          title="Edit Package"
        >
          <Edit className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPackageRequirements?.(pkg);
          }}
          className="p-1 rounded text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
          title="Manage Requirements"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPackageDelete?.(pkg);
          }}
          className="p-1 rounded text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
          title="Delete Package"
        >
          <Trash2 className="w-4 h-4" />
        </button>
        {/* Requirements Setup Indicator */}
        {(!pkg.requirement || !pkg.requirement.care_hours_range) && (
          <div
            className="p-1 rounded text-yellow-600 bg-yellow-50"
            title="Requirements not configured"
          >
            <AlertTriangle className="w-4 h-4" />
          </div>
        )}
      </div>
    );
  };

  const renderPackageCard = (pkg) => {
    const isExpanded = expandedPackages.has(pkg.id);
    const isSelected = selectedPackage?.id === pkg.id;
    const hasRequirements = pkg.requirement && pkg.requirement.care_hours_range;
    
    return (
      <div 
        key={pkg.id}
        className={`
          bg-white border rounded-lg shadow-sm hover:shadow-md transition-all duration-200
          ${isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-200'}
          ${onPackageSelect ? 'cursor-pointer' : ''}
          ${!hasRequirements && adminMode ? 'border-l-4 border-l-yellow-400' : ''}
        `}
        onClick={() => onPackageSelect?.(pkg)}
      >
        {/* Package Header */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-semibold text-gray-900">
                  {pkg.name}
                </h3>
                {!hasRequirements && adminMode && (
                  <AlertTriangle className="w-5 h-5 text-yellow-500" title="Missing requirements setup" />
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 flex-wrap">
                <span className="font-mono bg-gray-100 px-2 py-1 rounded">
                  {pkg.package_code}
                </span>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  pkg.funder === 'NDIS' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {pkg.funder}
                </span>
                {pkg.ndis_package_type && (
                  <span className="px-2 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 uppercase">
                    {pkg.ndis_package_type}
                  </span>
                )}
                {adminMode && (
                  <span className="text-xs text-gray-500">
                    ID: {pkg.id}
                  </span>
                )}
              </div>
            </div>
            
            {/* Match Score or Admin Status */}
            <div className="flex flex-col items-end gap-1">
              {pkg.matchScore && (
                <div className="flex items-center gap-1 text-yellow-600">
                  <Star className="w-4 h-4 fill-current" />
                  <span className="text-sm font-medium">{pkg.matchScore}</span>
                </div>
              )}
              {adminMode && (
                <div className="text-xs text-gray-500">
                  {hasRequirements ? (
                    <span className="text-green-600">✓ Requirements Set</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Needs Setup</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Pricing */}
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-900">
              {pkg.formattedPrice}
            </span>
            {adminMode && pkg.funder === 'NDIS' && pkg.ndis_line_items && (
              <span className="text-xs text-gray-500">
                ({pkg.ndis_line_items.length} items)
              </span>
            )}
          </div>

          {/* Requirements Summary */}
          <div className="flex flex-wrap gap-1 mb-3">
            {renderCareHoursInfo(pkg.requirement)}
            {pkg.requirement && renderRequirementBadge(pkg.requirement.requires_course, 'Course')}
            {pkg.requirement && pkg.requirement.display_priority > 0 && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                Priority {pkg.requirement.display_priority}
              </span>
            )}
          </div>

          {/* Package Summary */}
          {pkg.summary && (
            <p className="text-sm text-gray-600 mb-3">
              {pkg.summary}
            </p>
          )}

          {/* Admin Actions */}
          {renderAdminActions(pkg)}

          {/* Expand/Collapse Details */}
          {showDetails && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePackageDetails(pkg.id);
              }}
              className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 mt-2"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="w-4 h-4" />
                  Hide Details
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4" />
                  Show Details
                </>
              )}
            </button>
          )}
        </div>

        {/* Expanded Details */}
        {showDetails && isExpanded && (
          <div className="border-t bg-gray-50 p-4 space-y-3">
            {/* NDIS Line Items */}
            {pkg.funder === 'NDIS' && pkg.ndis_line_items && pkg.ndis_line_items.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">NDIS Line Items</h4>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {pkg.ndis_line_items.map((item, index) => (
                    <div key={index} className="flex justify-between text-sm bg-white rounded px-2 py-1">
                      <span className="text-gray-700">{item.line_item}</span>
                      <span className="font-medium">${item.price_per_night}/night</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Requirement Details */}
            {pkg.requirement ? (
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-2">Requirements</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-600">Care Hours:</span>
                    <span className="ml-1 font-medium">
                      {pkg.requirement.requires_no_care ? 'None' : 
                       `${pkg.requirement.care_hours_range?.min || 0} - ${pkg.requirement.care_hours_range?.max || '∞'}`}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Course:</span>
                    <span className="ml-1 font-medium">
                      {pkg.requirement.requires_course === true ? 'Required' :
                       pkg.requirement.requires_course === false ? 'Not allowed' : 'Optional'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Compatible:</span>
                    <span className="ml-1 font-medium">
                      {pkg.requirement.compatible_with_course ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-600">Priority:</span>
                    <span className="ml-1 font-medium">
                      {pkg.requirement.display_priority || 0}
                    </span>
                  </div>
                </div>

                {/* Admin-only requirement details */}
                {adminMode && pkg.requirement.notes && (
                  <div className="mt-2">
                    <h5 className="text-sm font-medium text-gray-900 mb-1">Admin Notes</h5>
                    <p className="text-sm text-gray-600 bg-white rounded px-2 py-1">{pkg.requirement.notes}</p>
                  </div>
                )}
              </div>
            ) : adminMode && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                <h4 className="text-sm font-medium text-yellow-800 mb-1">Missing Requirements</h4>
                <p className="text-sm text-yellow-700">
                  This package doesn't have filtering requirements set up. 
                  Click the settings icon to configure requirements.
                </p>
              </div>
            )}

            {/* Admin Debug Info */}
            {adminMode && process.env.NODE_ENV === 'development' && (
              <div className="border-t pt-2">
                <details className="text-xs text-gray-500">
                  <summary className="cursor-pointer">Debug Info</summary>
                  <pre className="mt-1 bg-gray-100 p-2 rounded text-xs overflow-auto">
                    {JSON.stringify(pkg, null, 2)}
                  </pre>
                </details>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderListItem = (pkg) => {
    const hasRequirements = pkg.requirement && pkg.requirement.care_hours_range;
    
    return (
      <div 
        key={pkg.id}
        className={`
          bg-white border-b hover:bg-gray-50 transition-colors
          ${selectedPackage?.id === pkg.id ? 'bg-blue-50 border-blue-200' : ''}
          ${onPackageSelect ? 'cursor-pointer' : ''}
          ${!hasRequirements && adminMode ? 'border-l-4 border-l-yellow-400' : ''}
        `}
        onClick={() => onPackageSelect?.(pkg)}
      >
        <div className="p-4 flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-medium text-gray-900">{pkg.name}</h3>
                  {!hasRequirements && adminMode && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" title="Missing requirements setup" />
                  )}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 mt-1 flex-wrap">
                  <span className="font-mono">{pkg.package_code}</span>
                  <span>•</span>
                  <span>{pkg.funder}</span>
                  {pkg.ndis_package_type && (
                    <>
                      <span>•</span>
                      <span className="uppercase">{pkg.ndis_package_type}</span>
                    </>
                  )}
                  {adminMode && (
                    <>
                      <span>•</span>
                      <span className="text-xs">ID: {pkg.id}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-medium text-gray-900">{pkg.formattedPrice}</div>
              <div className="text-sm text-gray-600">{pkg.summary}</div>
              {adminMode && (
                <div className="text-xs text-gray-500 mt-1">
                  {hasRequirements ? (
                    <span className="text-green-600">✓ Requirements Set</span>
                  ) : (
                    <span className="text-yellow-600">⚠ Needs Setup</span>
                  )}
                </div>
              )}
            </div>
            
            {/* Quick Actions for List View */}
            {adminMode && (
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPackageView?.(pkg);
                  }}
                  className="p-2 rounded text-gray-600 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="View"
                >
                  <Eye className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPackageEdit?.(pkg);
                  }}
                  className="p-2 rounded text-gray-600 hover:text-green-600 hover:bg-green-50 transition-colors"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPackageRequirements?.(pkg);
                  }}
                  className="p-2 rounded text-gray-600 hover:text-purple-600 hover:bg-purple-50 transition-colors"
                  title="Requirements"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onPackageDelete?.(pkg);
                  }}
                  className="p-2 rounded text-gray-600 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            )}
            
            {pkg.matchScore && (
              <div className="flex items-center gap-1 text-yellow-600">
                <Star className="w-4 h-4 fill-current" />
                <span className="text-sm font-medium">{pkg.matchScore}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading packages...</p>
        </div>
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No packages found</h3>
        <p className="text-gray-600">
          {adminMode 
            ? "Try adjusting your filter criteria or add new packages to get started."
            : "Try adjusting your filter criteria to see more packages."
          }
        </p>
      </div>
    );
  }

  // Calculate packages without requirements for admin warning
  const packagesWithoutReqs = adminMode ? packages.filter(p => !p.requirement || !p.requirement.care_hours_range).length : 0;

  return (
    <div className="space-y-4">
      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">
            Showing {packages.length} package{packages.length !== 1 ? 's' : ''}
          </p>
          {adminMode && packagesWithoutReqs > 0 && (
            <p className="text-sm text-yellow-600 mt-1">
              ⚠ {packagesWithoutReqs} package{packagesWithoutReqs !== 1 ? 's' : ''} need requirements setup
            </p>
          )}
        </div>
        <div className="text-sm text-gray-600">
          Sorted by relevance
        </div>
      </div>

      {/* Package Display */}
      {layout === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map(renderPackageCard)}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {packages.map(renderListItem)}
        </div>
      )}
    </div>
  );
};

export default DynamicPackageDisplay;