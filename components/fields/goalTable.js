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
  
  const isInitialLoad = useRef(true);
  const hasUserInteracted = useRef(false);
  const prevGoalsRef = useRef([]);
  const prevSpecificGoalRef = useRef("");

  const getParsedValue = useCallback(() => {
    if (!props.value) return [];
    if (typeof props.value === 'string') {
      try {
        const parsed = JSON.parse(props.value);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Error parsing props.value:", e);
        return [];
      }
    }
    return Array.isArray(props.value) ? props.value : [];
  }, [props.value]);

  useEffect(() => {
    const fetchSettingsGoalList = async () => {
      const response = await fetch('/api/settings/goals');
      const parsedValue = getParsedValue();
      
      if (response.ok) {
        const data = await response.json();
        const updatedData = data.map((goal) => {
          let value = goal.value ? JSON.parse(goal.value) : {};
          if (value.goal) {
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

  const handleCheckboxChange = useCallback((id, checked, specificGoalData) => {
    hasUserInteracted.current = true;
    setShowDetails(prev => ({...prev, [id]: checked}));
    setGoals(prevGoals => 
      prevGoals.map((goal, index) => {
        if (index === prevGoals.length - 1 && goal.id === id) {
          return { ...goal, value: checked, goal: goal.goal, specificGoal: specificGoalData };
        }
        return goal.id === id ? { ...goal, value: checked } : goal;
      })
    );
  }, []);

  const getUpdatedGoals = useCallback(() => {
    return goals.filter(goal => goal.value).map((goal) => {
      const result = { ...goal };
      delete result.value;
      result.id = goal.id;
      result.goal = goal.goal;
      if (goal.specificGoal) {
        result.specificGoal = goal.specificGoal;
      }
      console.log("Saving complete goal data:", result);
      return result;
    });
  }, [goals]);

  useEffect(() => {
    if (goals.length === 0) return;
    
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      prevGoalsRef.current = goals;
      prevSpecificGoalRef.current = specificGoal;
      if (props.onChange) {
        props.onChange(getUpdatedGoals());
      }
      return;
    }
    
    const goalsEqual = JSON.stringify(prevGoalsRef.current) === JSON.stringify(goals);
    const specificGoalEqual = prevSpecificGoalRef.current === specificGoal;
    if (goalsEqual && specificGoalEqual) return;
    
    prevGoalsRef.current = goals;
    prevSpecificGoalRef.current = specificGoal;
    
    if (hasUserInteracted.current && props.required) {
      const hasSelectedGoal = goals.some(goal => goal.value);
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
      if (isValid && props.onChange) {
        props.onChange(getUpdatedGoals());
      }
    } else if (!props.required && props.onChange) {
      props.onChange(getUpdatedGoals());
    }
  }, [goals, specificGoal, props.required, props.onChange, getUpdatedGoals]);
  
  const getErrorStyles = (type) => {
    if (hasValidationRun && errors[type]) {
      return "border-red-500 bg-red-50";
    }
    return "";
  };

  const hasAnyDetails = goals.some(goal => showDetails[goal.id]);
  
  return (
    <div className="w-full">
      {hasValidationRun && errors.goalRequired && (
        <div className="text-red-500 mb-2 font-medium text-sm">
          Please select at least one goal
        </div>
      )}

      {/* Desktop table — hidden on small screens */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50">
              <th className="p-4 text-left font-semibold text-gray-900 border">Goal</th>
              {hasAnyDetails && (
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
            {goals.map((goal, index) => {
              const checkboxId = `checkbox-${goal.id}`;
              const isLastGoal = index === goals.length - 1;
              return (
                <tr key={goal.id} className="border-b hover:bg-gray-50">
                  <td className={`p-4 border ${getErrorStyles("goalRequired")}`}>
                    <div className="flex items-start">
                      <CheckboxGeneric
                        id={goal.id}
                        checked={goal.value}
                        label={goal.goal}
                        onChange={handleCheckboxChange}
                        hideLabel={true}
                      />
                      {!isLastGoal ? (
                        <label htmlFor={checkboxId} className="ml-2 cursor-pointer">
                          {goal.goal}
                        </label>
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
                            <div className="text-red-500 text-sm mt-1">Please specify your goal</div>
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
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card layout — shown only on small screens */}
      <div className="md:hidden flex flex-col gap-3">
        {goals.map((goal, index) => {
          const isLastGoal = index === goals.length - 1;
          const isChecked = goal.value;
          const checkboxId = `checkbox-mobile-${goal.id}`;

          return (
            <div
              key={goal.id}
              className={`rounded-lg border transition-all duration-200 ${
                isChecked ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
              } ${hasValidationRun && errors.goalRequired ? "border-red-400 bg-red-50" : ""}`}
            >
              {/* Goal row — always visible */}
              <div className="flex items-start p-3 gap-3">
                <div className="pt-0.5 flex-shrink-0">
                  <CheckboxGeneric
                    id={goal.id}
                    checked={isChecked}
                    label={goal.goal}
                    onChange={handleCheckboxChange}
                    hideLabel={true}
                  />
                </div>

                {!isLastGoal ? (
                  <label htmlFor={checkboxId} className="cursor-pointer text-sm leading-snug flex-1">
                    {goal.goal}
                  </label>
                ) : (
                  <div className="flex-1">
                    <textarea
                      className={`w-full p-2 text-sm border rounded auto-save-input bg-transparent ${
                        hasValidationRun && errors.specificGoalRequired && isChecked
                          ? "border-red-500 bg-red-50"
                          : "border-gray-300"
                      }`}
                      placeholder={goal.goal}
                      defaultValue={specificGoal}
                      rows="3"
                      onBlur={(e) => {
                        hasUserInteracted.current = true;
                        const value = e.target.value;
                        setSpecificGoal(value);
                        handleCheckboxChange(goal.id, true, value);
                      }}
                    />
                    {hasValidationRun && errors.specificGoalRequired && isChecked && (
                      <div className="text-red-500 text-xs mt-1">Please specify your goal</div>
                    )}
                  </div>
                )}
              </div>

              {/* Detail rows — only shown when checked */}
              {showDetails[goal.id] && (
                <div className="border-t border-gray-200 divide-y divide-gray-100">
                  {goal.service && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        What new service is needed?
                      </p>
                      <p className="text-sm text-gray-800">{goal.service}</p>
                    </div>
                  )}
                  {goal.expect && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">What to expect?</p>
                      <p className="text-sm text-gray-800">{goal.expect}</p>
                    </div>
                  )}
                  {goal.funding && goal.funding.length > 0 && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Funding request?</p>
                      <ul className="list-disc pl-4">
                        {goal.funding.map((item, idx) => (
                          <li key={idx} className="text-sm text-gray-800">{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {goal.rate && (
                    <div className="px-3 py-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Hourly rate</p>
                      <p className="text-sm text-gray-800">{goal.rate}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}