import React from 'react';

const GoalTableDisplay = ({ data }) => {
  if (!data) return <span className="text-gray-500">No goals defined</span>;

  try {
    const goalData = typeof data === 'string' ? JSON.parse(data) : data;
    
    if (goalData.formatted && goalData.goals) {
      return (
        <div className="space-y-4">
          {/* FIXED: Add label for goal table in amendments */}
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              EXERCISE GOALS
            </span>
          </div>
          
          {goalData.goals.map((goal, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="font-medium text-gray-800 mb-2">
                <span className="text-blue-600 font-semibold">Goal {idx + 1}:</span> {goal.goal}
              </div>
              {goal.specificGoal && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <span className="font-medium">Specific Goal:</span> {goal.specificGoal}
                </div>
              )}
              {goal.fundingRequest && (
                <div className="text-xs text-blue-600 mt-1">
                  Funding: {goal.fundingRequest}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    if (Array.isArray(goalData)) {
      return (
        <div className="space-y-4">
          {/* FIXED: Add label for goal table */}
          <div className="flex items-center space-x-2 mb-3">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-gray-700 uppercase tracking-wide">
              EXERCISE GOALS
            </span>
          </div>
          
          {goalData.map((goal, idx) => (
            <div key={idx} className="border border-gray-200 rounded-lg p-4">
              <div className="font-medium text-gray-800 mb-2">
                <span className="text-blue-600 font-semibold">Goal {idx + 1}:</span> {goal.goal || goal.description}
              </div>
              {goal.specificGoal && (
                <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                  <span className="font-medium">Details:</span> {goal.specificGoal}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    }
    
    return <div className="text-sm bg-gray-50 p-3 rounded">{JSON.stringify(goalData, null, 2)}</div>;
  } catch (e) {
    console.error('Error displaying goal data:', e);
    return <span className="text-red-500">Error displaying goal data</span>;
  }
};

export default GoalTableDisplay;