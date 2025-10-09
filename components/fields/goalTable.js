import React, { useCallback, useEffect, useState, useRef } from "react";
import CheckboxGeneric from "./checkboxGeneric";

export default function GoalTable(props) {
  const [goals, setGoals] = useState([]);
  const [specificGoal, setSpecificGoal] = useState(props.specificGoal || "");
  const [errors, setErrors] = useState({
    goalRequired: false,
    specificGoalRequired: false
  });
  const [hasValidationRun, setHasValidationRun] = useState(false);
  const [showDetails, setShowDetails] = useState({});
  
  // Refs to prevent loops and track state
  const isInitialLoad = useRef(true);
  const hasUserInteracted = useRef(false);
  const prevGoalsRef = useRef([]);
  const prevSpecificGoalRef = useRef("");

  // Parse props.value if it's a string
  const getParsedValue = useCallback(() => {
    if (!props.value) return [];
    
    // If props.value is a string, try to parse it
    if (typeof props.value === 'string') {
      try {
        return JSON.parse(props.value);
      } catch (e) {
        console.error("Error parsing props.value:", e);
        return [];
      }
    }
    
    // If it's already an array, return it directly
    return Array.isArray(props.value) ? props.value : [];
  }, [props.value]);

  // Fetch goals on mount
  useEffect(() => {
    const fetchSettingsGoalList = async () => {
      const response = await fetch('/api/settings/goals');
      
      // Parse the value if it's a string
      const parsedValue = getParsedValue();
      
      if (response.ok) {
        const data = await response.json();
        const updatedData = data.map((goal) => {
          let value = goal.value ? JSON.parse(goal.value) : {};
          if (value.goal) {
            // Now use the parsed value for finding matches
            const matchingGoal = parsedValue.find(v => v.id === goal.id);
            value = { 
              ...value, 
              id: goal.id, 
              value: matchingGoal ? true : false,
              specificGoal: matchingGoal?.specificGoal
            };

            const specificGoalItem = parsedValue.find(v => v.specificGoal);
            if (specificGoalItem && value.goal.includes("PLEASE WRITE HERE")) {
              setSpecificGoal(specificGoalItem.specificGoal);
            }
            
            // Initialize showDetails state based on whether the goal is checked
            if (matchingGoal) {
              setShowDetails(prev => ({...prev, [goal.id]: true}));
            }
          }
          return value;
        });

        setGoals(updatedData);
      }
    }

    fetchSettingsGoalList();
  }, [getParsedValue]);

  // Handle checkbox changes
  const handleCheckboxChange = useCallback((id, checked, specificGoalData) => {
    hasUserInteracted.current = true;
    
    // Update showDetails when checkbox changes
    setShowDetails(prev => ({...prev, [id]: checked}));
    
    setGoals(prevGoals => 
      prevGoals.map((goal, index) => {
        if (index === prevGoals.length - 1 && goal.id === id) {
          return { 
            ...goal, 
            value: checked, 
            goal: goal.goal, 
            specificGoal: specificGoalData
          };
        }
        return goal.id === id ? { ...goal, value: checked } : goal;
      })
    );
  }, []);

  // Get filtered goals for onChange - MODIFIED to preserve all properties
  const getUpdatedGoals = useCallback(() => {
    return goals.filter(goal => goal.value).map((goal) => {
      // Start with a copy of the entire goal object to preserve all properties
      const result = { ...goal };
      
      // Remove the 'value' property as it's just for internal tracking
      delete result.value;
      
      // Ensure crucial properties are always present
      result.id = goal.id;
      result.goal = goal.goal;
      if (goal.specificGoal) {
        result.specificGoal = goal.specificGoal;
      }
      
      // Log to verify all properties are being saved
      console.log("Saving complete goal data:", result);
      
      return result;
    });
  }, [goals]);

  // Separate effect to handle data changes and validation
  useEffect(() => {
    // Skip empty goals
    if (goals.length === 0) return;
    
    // Handle initial load - call onChange without validation
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      prevGoalsRef.current = goals;
      prevSpecificGoalRef.current = specificGoal;
      
      if (props.onChange) {
        props.onChange(getUpdatedGoals());
      }
      return;
    }
    
    // Skip if no actual change to goals or specificGoal
    const goalsEqual = JSON.stringify(prevGoalsRef.current) === JSON.stringify(goals);
    const specificGoalEqual = prevSpecificGoalRef.current === specificGoal;
    if (goalsEqual && specificGoalEqual) return;
    
    // Update refs with current values
    prevGoalsRef.current = goals;
    prevSpecificGoalRef.current = specificGoal;
    
    // Only validate if user has interacted and component is required
    if (hasUserInteracted.current && props.required) {
      // Check if at least one goal is selected
      const hasSelectedGoal = goals.some(goal => goal.value);
      
      // Check for custom goal requirements
      const customGoalSelected = goals.some(
        goal => goal.value && goal.goal?.includes("PLEASE WRITE HERE")
      );
      
      const newErrors = {
        goalRequired: !hasSelectedGoal,
        specificGoalRequired: customGoalSelected && !specificGoal?.trim()
      };
      
      setErrors(newErrors);
      setHasValidationRun(true);
      
      const isValid = !newErrors.goalRequired && !newErrors.specificGoalRequired;
      
      // Only call onChange if valid
      if (isValid && props.onChange) {
        props.onChange(getUpdatedGoals());
      }
    } else if (!props.required && props.onChange) {
      // If not required, always call onChange
      props.onChange(getUpdatedGoals());
    }
  }, [goals, specificGoal, props.required, props.onChange, getUpdatedGoals]);
  
  // Helper to determine error styling
  const getErrorStyles = (type) => {
    if (hasValidationRun && errors[type]) {
      return "border-red-500 bg-red-50";
    }
    return "";
  };
  
  return (
    <div className="w-full overflow-x-auto">
      {hasValidationRun && errors.goalRequired && (
        <div className="text-red-500 mb-2 font-medium text-sm">
          Please select at least one goal
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="p-4 text-left font-semibold text-gray-900 border">Goal</th>
            {goals.some(goal => showDetails[goal.id]) && (
              <>
                <th className="p-4 text-left font-semibold text-gray-900 border">
                  What new service is needed to achieve this goal?
                </th>
                <th className="p-4 text-left font-semibold text-gray-900 border">What to expect?</th>
                <th className="p-4 text-left font-semibold text-gray-900 border">Funding request?</th>
                <th className="p-4 text-left font-semibold text-gray-900 border">Hourly rate</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {goals.map((goal, index) => (
            <tr key={goal.id} className="border-b hover:bg-gray-50">
              <td className={`p-4 border ${getErrorStyles("goalRequired")}`}>
                <div className="flex items-center">
                  <CheckboxGeneric
                    id={goal.id}
                    checked={goal.value}
                    label={goal.goal}
                    onChange={handleCheckboxChange}
                    hideLabel={true}
                  />
                  {(index !== goals.length - 1) ? (
                    <span className="ml-2">{goal.goal}</span>
                  ) : (
                    <div className="w-full ml-2">
                      <textarea 
                        className={`auto-save-input font-bold p-1 bg-transparent border-stone-50 ${
                          hasValidationRun && errors.specificGoalRequired && goal.value ? "border-red-500 bg-red-50" : ""
                        }`}
                        placeholder={goal.goal}
                        defaultValue={specificGoal}
                        data-tip="edit field label"
                        style={{ width: '90%', fontSize: '12px', fontWeight: 'normal' }}
                        rows="4"
                        onBlur={(e) => {
                          hasUserInteracted.current = true;
                          const value = e.target.value;
                          setSpecificGoal(value);
                          handleCheckboxChange(goal.id, true, value);
                        }}
                      />
                      {hasValidationRun && errors.specificGoalRequired && goal.value && (
                        <div className="text-red-500 text-sm mt-1">
                          Please specify your goal
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
              {showDetails[goal.id] && (
                <>
                  <td className="p-4 border">{goal.service}</td>
                  <td className="p-4 border">{goal.expect}</td>
                  <td className="p-4 border">
                    <ul className="list-disc pl-5">
                      {goal.funding?.map((item, idx) => (
                        <li key={idx} className="text-sm">{item}</li>
                      )) || null}
                    </ul>
                  </td>
                  <td className="p-4 border">{goal.rate}</td>
                </>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}