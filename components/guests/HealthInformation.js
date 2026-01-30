import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import moment from 'moment';
import StatusBadge from '../ui-v2/StatusBadge';

const HealthInformation = ({ healthInfo, healthInfoLastUpdated, ndis, icare }) => {
  const [expandedSections, setExpandedSections] = useState({
    recent_hospitalization: true,
    neurological: true,
    musculoskeletal: true,
    cardiovascular: true,
    medical_history: true
  });

  // Categorize health conditions
  const healthCategories = {
    recent_hospitalization: {
      title: "Recent Hospitalization / Clinical Events",
      conditions: [
        "Admission to hospital in the last 3 months",
        "Current Pressure Injuries",
        "Current open wounds, cuts, abrasions or stitches"
      ]
    },
    neurological: {
      title: "Neurological / Cognitive",
      conditions: [
        "Autonomic Dysreflexia",
        "Head/Brain injury or memory loss",
        "Moderate to severe spasm/spasticity"
      ]
    },
    musculoskeletal: {
      title: "Musculoskeletal / Bone Health",
      conditions: [
        "Osteoperosis/Osteopenia",
        "Low bone density",
        "Fracture/s in the last 12 months"
      ]
    },
    cardiovascular: {
      title: "Cardiovascular / Respiratory",
      conditions: [
        "Low blood pressure",
        "Respiratory complications"
      ]
    },
    medical_history: {
      title: "Medical History & Conditions",
      conditions: [
        "Medications recently changed",
        "Diabetes",
        "Been advised by your doctor not to participate in particular activities",
        "I currently require subcutaneous injections"
      ]
    }
  };

  // Get status for each category
  const getCategoryStatus = (categoryConditions) => {
    const hasAnyCondition = categoryConditions.some(condition => {
      const healthItem = healthInfo.find(item => item.diagnose === condition);
      return healthItem && healthItem.answer === true;
    });
    return hasAnyCondition ? 'critical' : 'normal';
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const getStatusBadge = (status) => {
    if (status === 'critical') {
      return (
        <StatusBadge 
          type="error" 
          label="Critical" 
          showIcon={false}
          size="small"
        />
      );
    }
    return (
      <StatusBadge 
        type="success" 
        label="Normal" 
        showIcon={false}
        size="small"
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between py-6 sm:py-10 space-y-2 sm:space-y-0">
        <h1 className="text-lg sm:text-xl font-bold">Health Information</h1>
        {healthInfoLastUpdated && (
          <p className="text-gray-500 font-bold text-sm sm:text-base">
            <span>Last Updated: {moment(healthInfoLastUpdated).format('DD MMM YYYY')}</span>
          </p>
        )}
      </div>

      {/* Participant Numbers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-4 sm:p-6 lg:p-10 rounded-2xl bg-slate-400 font-bold">
        <div className="flex flex-col sm:flex-row sm:items-center text-gray-700 space-y-2 sm:space-y-0">
          <p className="text-sm sm:text-base">NDIS Participant #</p>
          <p className={`h-fit w-full sm:w-fit bg-white p-2 px-4 sm:px-8 rounded-md sm:ml-6 text-center ${!ndis && 'sm:w-40'}`}>
            {ndis || 'N/A'}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center text-gray-700 space-y-2 sm:space-y-0">
          <p className="text-sm sm:text-base">iCare Participant #</p>
          <p className={`h-fit w-full sm:w-fit bg-white p-2 px-4 sm:px-8 rounded-md sm:ml-6 text-center ${!icare && 'sm:w-40'}`}>
            {icare || 'N/A'}
          </p>
        </div>
      </div>

      {/* Health Information Categories */}
      {healthInfo.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Last Stay Health Information</h2>
          
          {Object.entries(healthCategories).map(([categoryKey, category]) => {
            const categoryStatus = getCategoryStatus(category.conditions);
            const isExpanded = expandedSections[categoryKey];
            
            return (
              <div key={categoryKey} className="bg-white border border-gray-200 rounded-lg shadow-sm">
                {/* Category Header */}
                <button
                  onClick={() => toggleSection(categoryKey)}
                  className="w-full px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors duration-200"
                >
                  <div className="flex items-center">
                    <h3 className="text-sm sm:text-base font-medium text-gray-900 text-left">
                      {category.title}
                    </h3>
                  </div>
                  <div className="flex items-center space-x-3">
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </button>

                {/* Category Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 sm:px-6 sm:pb-6 border-t border-gray-100">
                    <div className="space-y-3 pt-4">
                      {category.conditions.map((condition, index) => {
                        const healthItem = healthInfo.find(item => item.diagnose === condition);
                        const answer = healthItem ? healthItem.answer : false;
                        
                        return (
                          <div
                            key={index}
                            className={`flex flex-col sm:flex-row sm:justify-between sm:items-center p-3 rounded-lg ${
                              index % 2 === 0 ? 'bg-gray-50' : 'bg-white'
                            } space-y-2 sm:space-y-0`}
                          >
                            <div className="sm:max-w-[70%]">
                              <p className="text-sm sm:text-base font-medium sm:font-normal text-gray-700">
                                {condition}
                              </p>
                            </div>
                            <div className="flex justify-start sm:justify-end">
                              {answer ? (
                                <StatusBadge 
                                  type="error" 
                                  label="Yes" 
                                  showIcon={false}
                                  size="small"
                                />
                              ) : (
                                <StatusBadge 
                                  type="success" 
                                  label="No" 
                                  showIcon={false}
                                  size="small"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg py-6 px-6 mb-4" role="alert">
          <h4 className="text-lg font-medium leading-tight mb-2 text-yellow-800">
            No health information to show.
          </h4>
          <p className="text-yellow-700 text-sm">
            Health information will appear here after the guest completes their first booking.
          </p>
        </div>
      )}
    </div>
  );
};

export default HealthInformation;