import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import moment from 'moment';
import { CheckCircle, AlertCircle } from 'lucide-react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import { Can, AbilityContext } from "../../../services/acl/can";

const CareTableDisplay = dynamic(() => import('./CareTableDisplay'), { ssr: false });
const GoalTableDisplay = dynamic(() => import('./GoalTableDisplay'), { ssr: false });
const ServiceCardsDisplay = dynamic(() => import('./ServiceCardDisplay'), { ssr: false });

const AmendmentDisplay = ({ amendment, onApprove, onDecline, currentUser, booking }) => {
  const isApproved = amendment.data.approved;
  const isDeclined = amendment.data.declined_by;
  const qaPair = amendment.data.qa_pair || amendment.data;
  const isUser = currentUser && currentUser.type === 'user';
  const globalLoading = useSelector(state => state.global.loading);
  const [packageCache, setPackageCache] = useState({});
  const [loadingPackages, setLoadingPackages] = useState(new Set());
  const [questionOptions, setQuestionOptions] = useState([]);

  useEffect(() => {
    if ((qaPair.question_type === 'service-cards' || 
         qaPair.question_type === 'service-cards-multi') && 
        !qaPair.Question?.options && !qaPair.options) {
      
      const findQuestionOptions = () => {
        if (!booking?.Sections) return null;
        
        for (const section of booking.Sections) {
          if (section.QaPairs) {
            for (const bookingQaPair of section.QaPairs) {
              // Match by question text or ID
              if ((bookingQaPair.Question?.question === qaPair.question) ||
                  (bookingQaPair.id === qaPair.id)) {
                return bookingQaPair.Question?.options;
              }
            }
          }
        }
        return null;
      };
      
      const options = findQuestionOptions();
      if (options) {
        setQuestionOptions(options);
      }
    }
  }, [qaPair, booking]);

  const fetchPackageDetails = async (packageId) => {
    if (!packageId || packageCache[packageId] || loadingPackages.has(packageId)) {
      return packageCache[packageId] || null;
    }

    setLoadingPackages(prev => new Set([...prev, packageId]));
    
    try {
      const response = await fetch(`/api/packages/${packageId}`);
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success && data.package) {
          setPackageCache(prev => ({
            ...prev,
            [packageId]: data.package
          }));
          return data.package;
        }
      }
    } catch (error) {
      console.error('Error fetching package details for amendment:', error);
    } finally {
      setLoadingPackages(prev => {
        const newSet = new Set(prev);
        newSet.delete(packageId);
        return newSet;
      });
    }
    
    return null;
  };

  const formatPackageDisplay = (packageId, packageData) => {
    if (packageData) {
      return (
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-green-500" />
          <div>
            <span className="font-medium">{packageData.name}</span>
            {packageData.package_code && (
              <span className="text-xs text-gray-500 ml-2">({packageData.package_code})</span>
            )}
          </div>
        </div>
      );
    } else if (loadingPackages.has(packageId)) {
      return (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span className="text-sm text-gray-600">Loading package...</span>
        </div>
      );
    } else {
      return (
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-orange-500" />
          <span className="text-sm">Package ID: {packageId}</span>
        </div>
      );
    }
  };

  const parseServiceCardsDiff = (oldData, newData, options) => {
    if (!oldData && !newData) return null;
    
    const parseServiceData = (data) => {
      if (!data) return {};
      try {
        if (typeof data === 'string') {
          return JSON.parse(data);
        }
        return data;
      } catch (e) {
        console.error("Error parsing service cards data:", e);
        return {};
      }
    };

    const oldServices = parseServiceData(oldData);
    const newServices = parseServiceData(newData);
    
    if (Object.keys(oldServices).length === 0 && Object.keys(newServices).length === 0) {
      return null;
    }
    
    const allServiceKeys = new Set([
      ...Object.keys(oldServices),
      ...Object.keys(newServices)
    ]);
    
    const changes = [];
    
    allServiceKeys.forEach(serviceKey => {
      const oldService = oldServices[serviceKey];
      const newService = newServices[serviceKey];
      
      const wasSelected = oldService?.selected;
      const isSelected = newService?.selected;
      
      // Check if selection changed
      if (wasSelected !== isSelected) {
        changes.push({
          type: isSelected ? 'ADDED' : 'REMOVED',
          serviceKey,
          oldService,
          newService
        });
      } else if (isSelected && wasSelected) {
        // Check if sub-options changed
        const oldSubOptions = oldService?.subOptions || [];
        const newSubOptions = newService?.subOptions || [];
        
        if (JSON.stringify([...oldSubOptions].sort()) !== JSON.stringify([...newSubOptions].sort())) {
          changes.push({
            type: 'CHANGED',
            serviceKey,
            oldService,
            newService
          });
        }
      }
    });
    
    if (changes.length === 0) {
      return null;
    }
    
    return {
      hasChanges: true,
      changes,
      options
    };
  };

  // Parse answer logic from old component
  const parseAnswer = (answer, questionType) => {
    if (!answer && answer !== 0 && answer !== false) return '';
    
    try {
      switch (questionType) {
        case 'date':
          return moment(answer).format('DD/MM/YYYY');
        case 'date-range':
          const answerArr = answer.split(' - ');
          return moment(answerArr[0]).format('DD/MM/YYYY') + ' - ' + moment(answerArr[1]).format('DD/MM/YYYY');
        case 'care-table':
          return formatCareTableData(answer);
        case 'goal-table':
          return formatGoalTableData(answer);
        case 'checkbox':
          if (Array.isArray(answer)) {
            // Filter out null values and safely handle objects
            return answer.filter(item => item !== null && item !== undefined);
          }
          if (typeof answer === 'string') {
            try {
              const parsed = JSON.parse(answer);
              if (Array.isArray(parsed)) {
                return parsed.filter(item => item !== null && item !== undefined);
              }
            } catch (e) {
              return answer;
            }
          }
          return answer;
        case 'rooms':
          if (Array.isArray(answer)) {
            return answer.map(room => room?.name || 'Unnamed room').join(', ');
          }
          if (typeof answer === 'string') {
            try {
              const parsed = JSON.parse(answer);
              if (Array.isArray(parsed)) {
                return parsed.map(room => room?.name || 'Unnamed room').join(', ');
              }
            } catch (e) {
              // Continue if parsing fails
            }
          }
          return answer;
        case 'package-selection':
          // Handle package selection specially
          if (/^\d+$/.test(String(answer))) {
            const packageId = String(answer);
            const packageData = packageCache[packageId];
            
            // Trigger fetch if not already cached
            if (!packageData && !loadingPackages.has(packageId)) {
              fetchPackageDetails(packageId);
            }
            
            return formatPackageDisplay(packageId, packageData);
          }
          return String(answer);
        case 'service-cards':
        case 'service-cards-multi':
            try {
                return typeof answer === 'string' ? JSON.parse(answer) : answer;
            } catch (e) {
                console.error('Error parsing service cards:', e);
                return answer;
            }
        default:
          return String(answer);
      }
    } catch (e) {
      console.error('Parse error:', e);
      return String(answer || '');
    }
  };

  // Format care table data
  const formatCareTableData = (answer) => {
    let data = answer;
    
    try {
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      if (!Array.isArray(data)) {
        return "Invalid care data format";
      }
      
      const dateGroups = {};
      data.forEach(item => {
        if (!item.date) return;
        
        if (!dateGroups[item.date]) {
          dateGroups[item.date] = {
            morning: null,
            afternoon: null,
            evening: null
          };
        }
        
        if (item.care && dateGroups[item.date].hasOwnProperty(item.care)) {
          dateGroups[item.date][item.care] = item.values;
        }
      });
      
      return {
        formatted: true,
        dates: Object.entries(dateGroups).map(([date, periods]) => ({
          date,
          periods: {
            morning: periods.morning,
            afternoon: periods.afternoon,
            evening: periods.evening
          }
        }))
      };
    } catch (e) {
      console.error("Error formatting care table data:", e);
      return "Error formatting care data";
    }
  };

  // Format goal table data
  const formatGoalTableData = (answer) => {
    let data = answer;
    
    try {
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      if (!Array.isArray(data)) {
        return "Invalid goal data format";
      }
      
      return {
        formatted: true,
        goals: data
      };
      
    } catch (e) {
      console.error("Error formatting goal table data:", e);
      return "Error formatting goal data";
    }
  };

  // Parse care diff logic
  const parseCareDiff = (oldData, newData) => {
    if (!oldData || !newData) return { oldFormatted: '', newFormatted: '', detailedChanges: [] };
    
    try {
      const oldArray = Array.isArray(oldData) ? oldData : JSON.parse(oldData);
      const newArray = Array.isArray(newData) ? newData : JSON.parse(newData);
      
      const changesMap = {};
      const detailedChanges = [];
      
      const createKey = (item) => `${item.date}-${item.care}`;
      
      const compareValues = (oldValues, newValues) => {
        if (!oldValues || !newValues) return true;
        
        const changed = 
          oldValues.time !== newValues.time ||
          oldValues.duration !== newValues.duration ||
          oldValues.carers !== newValues.carers;
          
        return changed;
      };
      
      const oldItemsMap = {};
      oldArray.forEach(item => {
        const key = createKey(item);
        oldItemsMap[key] = { ...item, processed: false };
      });
      
      newArray.forEach(item => {
        const key = createKey(item);
        const oldItem = oldItemsMap[key];
        
        if (!oldItem) {
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'ADDED';
          
          detailedChanges.push({
            type: 'ADDED',
            date: item.date,
            period: item.care,
            newValue: item.values,
            oldValue: null
          });
        } else if (compareValues(oldItem.values, item.values)) {
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'CHANGED';
          
          detailedChanges.push({
            type: 'CHANGED',
            date: item.date,
            period: item.care,
            newValue: item.values,
            oldValue: oldItem.values
          });
          
          oldItemsMap[key].processed = true;
        } else {
          oldItemsMap[key].processed = true;
        }
      });
      
      Object.values(oldItemsMap).forEach(item => {
        if (!item.processed) {
          const key = createKey(item);
          if (!changesMap[item.date]) changesMap[item.date] = {};
          changesMap[item.date][item.care] = 'REMOVED';
          
          detailedChanges.push({
            type: 'REMOVED',
            date: item.date,
            period: item.care,
            newValue: null,
            oldValue: item.values
          });
        }
      });
      
      let oldFormatted = formatCareTableData(oldArray);
      let newFormatted = formatCareTableData(newArray);
      
      if (typeof oldFormatted === 'object' && oldFormatted.formatted) {
        oldFormatted.changes = changesMap;
        oldFormatted.detailedChanges = detailedChanges;
      }
      
      if (typeof newFormatted === 'object' && newFormatted.formatted) {
        newFormatted.changes = changesMap;
        newFormatted.detailedChanges = detailedChanges;
      }
      
      return {
        oldFormatted,
        newFormatted,
        detailedChanges
      };
    } catch (e) {
      console.error('Error comparing care data:', e);
      return {
        oldFormatted: 'Error comparing care schedules',
        newFormatted: 'Error comparing care schedules'
      };
    }
  };

  // Parse goal diff logic
  const parseGoalDiff = (oldData, newData) => {
    if (!oldData && !newData) return null;
    
    const parseGoalData = (data) => {
      if (!data) return [];
      
      try {
        if (typeof data === 'string') {
          try {
            return JSON.parse(data);
          } catch (e) {
            console.error("Error parsing goal data string:", e);
            return [];
          }
        } else if (typeof data === 'object' && data.goals && Array.isArray(data.goals)) {
          return data.goals;
        } else if (Array.isArray(data)) {
          return data;
        }
        return [];
      } catch (e) {
        console.error("Error in parseGoalData:", e);
        return [];
      }
    };

    // Parse both sets of data
    const oldGoals = parseGoalData(oldData);
    const newGoals = parseGoalData(newData);
    
    // If we have no data to show, return null
    if ((!oldGoals || oldGoals.length === 0) && (!newGoals || newGoals.length === 0)) {
      return null;
    }
    
    // Helper to determine if goals are significantly different
    const areGoalsDifferent = (goal1, goal2) => {
      if (!goal1 || !goal2) return true;
      
      return (
        goal1.goal !== goal2.goal ||
        goal1.service !== goal2.service ||
        goal1.expect !== goal2.expect ||
        goal1.rate !== goal2.rate ||
        JSON.stringify(goal1.funding) !== JSON.stringify(goal2.funding)
      );
    };

    // For added or removed goals, simply show them
    if (oldGoals.length === 0 && newGoals.length > 0) {
      // All goals are new
      return {
        type: 'all-new',
        goals: newGoals
      };
    }
    
    if (newGoals.length === 0 && oldGoals.length > 0) {
      // All goals were removed
      return {
        type: 'all-removed',
        goals: oldGoals
      };
    }
    
    // Otherwise, we need to compare the goals
    // This is a simplified comparison that assumes goals are in the same order
    const maxLength = Math.max(oldGoals.length, newGoals.length);
    const comparisonItems = [];
    
    for (let i = 0; i < maxLength; i++) {
      const oldGoal = i < oldGoals.length ? oldGoals[i] : null;
      const newGoal = i < newGoals.length ? newGoals[i] : null;
      
      if (!oldGoal && newGoal) {
        // Goal was added
        comparisonItems.push({
          type: 'ADDED',
          newGoal
        });
      } else if (oldGoal && !newGoal) {
        // Goal was removed
        comparisonItems.push({
          type: 'REMOVED',
          oldGoal
        });
      } else if (areGoalsDifferent(oldGoal, newGoal)) {
        // Goal was changed
        comparisonItems.push({
          type: 'CHANGED',
          oldGoal,
          newGoal
        });
      }
    }
    
    // If no differences, return null
    if (comparisonItems.length === 0) {
      return null;
    }
    
    // Return the comparison data
    return {
      type: 'comparison',
      items: comparisonItems
    };
  };

  // Helper function to safely convert any value to string for display
  const safeStringify = (value) => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'number' || typeof value === 'boolean') return String(value);
    if (Array.isArray(value)) {
      return value.map(item => {
        if (typeof item === 'object' && item !== null) {
          return item.label || item.name || item.value || item.goal || JSON.stringify(item);
        }
        return String(item);
      }).join(', ');
    }
    if (typeof value === 'object' && value !== null) {
      return value.label || value.name || value.value || value.goal || JSON.stringify(value);
    }
    return String(value);
  };

  // Process the amendment data
  let oldAnswerStr = '';
  let answerStr = '';
  let goalDiffData = null;
  let serviceCardsDiffData = null;

  const optionsSource = qaPair.Question?.options || qaPair.options || questionOptions;

  if (qaPair.question_type === 'care-table' && qaPair.answer && qaPair.oldAnswer) {
    try {
      const { oldFormatted, newFormatted } = parseCareDiff(qaPair.oldAnswer, qaPair.answer);
      oldAnswerStr = oldFormatted;
      answerStr = newFormatted;
    } catch (e) {
      console.error('Error in care diff:', e);
      oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
      answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
    }
  } else if (qaPair.question_type === 'goal-table' && qaPair.answer) {
    goalDiffData = parseGoalDiff(qaPair.oldAnswer, qaPair.answer);
    oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
    answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
  } else if ((qaPair.question_type === 'service-cards' || qaPair.question_type === 'service-cards-multi') && qaPair.answer) {
    const questionOptions = qaPair.Question?.options || qaPair.options;
    serviceCardsDiffData = parseServiceCardsDiff(qaPair.oldAnswer, qaPair.answer, questionOptions);
    oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
    answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
  } else {
    oldAnswerStr = parseAnswer(qaPair.oldAnswer, qaPair.question_type);
    answerStr = parseAnswer(qaPair.answer, qaPair.question_type);
  }

  let question = qaPair.question;
  if (qaPair.question && (qaPair.question.startsWith('Preferred') || qaPair.question.startsWith('Duration'))) {
    question = `${question} (${qaPair.sectionLabel})`
  } else if (qaPair.question_type === 'care-table' && !question) {
    question = 'Care Schedule Changes';
  } else if (qaPair.question_type === 'goal-table' && !question) {
    question = 'Exercise Goal Changes';
  }

  return (
    <div className="items-center w-full mt-3 mb-5 text-sm">
      <div className="flex flex-col md:flex-row justify-between items-center">
        <p className="font-bold pb-1">{question}</p>
        {amendment.data.hasOwnProperty('approved') && (
          <div className="approval-wrapper">
            {(!amendment.data.approved && amendment.data?.modifiedBy != 'admin') && isUser && onApprove && onDecline && (
              <Can I="Create/Edit" a="Booking">
                <button 
                  disabled={globalLoading} 
                  className="bg-sargood-blue h-fit p-2 text-xs rounded-md text-white hover:bg-sky-700 disabled:bg-slate-600" 
                  onClick={() => onApprove()}
                >
                  Approve
                </button>
              </Can>
            )}
          </div>
        )}
      </div>
      
      <div className="flex flex-col space-y-2">
        {qaPair.question_type === 'care-table' ? (
          <div className="care-amendment">
            {typeof oldAnswerStr === 'object' && oldAnswerStr.formatted && typeof answerStr === 'object' && answerStr.formatted ? (
              <CareTableDisplay 
                data={answerStr} 
                oldData={oldAnswerStr}
              />
            ) : (
              <>
                <div className="line-through text-gray-500">
                  <pre className="whitespace-pre-wrap font-sans text-sm">{safeStringify(oldAnswerStr)}</pre>
                </div>
                <div>
                  <pre className="whitespace-pre-wrap font-sans text-sm">{safeStringify(answerStr)}</pre>
                </div>
              </>
            )}
          </div>
        ) : qaPair.question_type === 'goal-table' && goalDiffData ? (
          <div className="bg-gray-50 p-3 rounded-md">
            {goalDiffData.type === 'all-new' && (
              <>
                <div className="text-green-600 font-medium mb-2">New Goals Added:</div>
                {goalDiffData.goals.map((goal, idx) => (
                  <div key={idx} className="pl-2 border-l-2 border-green-500 mb-3">
                    <div className="mb-3 pl-2">
                      <div className="font-medium">{safeStringify(goal.goal)}</div>
                      <div className="ml-4 text-sm">
                        <div><span className="font-medium">Service:</span> {safeStringify(goal.service) || 'N/A'}</div>
                        <div><span className="font-medium">Expected outcome:</span> {safeStringify(goal.expect) || 'N/A'}</div>
                        <div>
                          <span className="font-medium">Funding request:</span>{" "}
                          {goal.funding && goal.funding.length > 0 
                            ? safeStringify(goal.funding)
                            : 'N/A'
                          }
                        </div>
                        <div><span className="font-medium">Rate:</span> {safeStringify(goal.rate) || 'N/A'}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        ) : (qaPair.question_type === 'service-cards' || qaPair.question_type === 'service-cards-multi') && serviceCardsDiffData ? (
          <div className="service-cards-amendment">
            <ServiceCardsDisplay 
              data={answerStr} 
              oldData={oldAnswerStr}
              options={optionsSource}
            />
          </div>
        ) : qaPair.question_type === 'service-cards' || qaPair.question_type === 'service-cards-multi' ? (
          <>
            {oldAnswerStr && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-500 mb-2">Previous Services:</div>
                <div className="line-through opacity-60">
                  <ServiceCardsDisplay 
                    data={oldAnswerStr} 
                    options={qaPair.Question?.options || qaPair.options} 
                  />
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Updated Services:</div>
              <ServiceCardsDisplay 
                data={answerStr} 
                options={qaPair.Question?.options || qaPair.options} 
              />
            </div>
          </>
        ) : qaPair.question_type === 'goal-table' ? (
          <>
            {oldAnswerStr && (
              <div className="mb-4">
                <div className="text-sm font-medium text-gray-500 mb-2">Previous Goals:</div>
                <div className="line-through opacity-60">
                  {typeof oldAnswerStr === 'object' && oldAnswerStr.formatted ? (
                    <GoalTableDisplay data={oldAnswerStr} />
                  ) : (
                    <GoalTableDisplay data={oldAnswerStr} />
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-2">Updated Goals:</div>
              {typeof answerStr === 'object' && answerStr.formatted ? (
                <GoalTableDisplay data={answerStr} />
              ) : (
                <GoalTableDisplay data={answerStr} />
              )}
            </div>
          </>
        ) : qaPair.question_type === 'package-selection' ? (
          <div className="space-y-3">
            {oldAnswerStr && (
              <div>
                <div className="text-sm font-medium text-gray-500 mb-1">Previous Package:</div>
                <div className="line-through opacity-60">
                  {typeof oldAnswerStr === 'object' ? oldAnswerStr : (
                    <span className="text-sm">{safeStringify(oldAnswerStr)}</span>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-gray-700 mb-1">Updated Package:</div>
              {typeof answerStr === 'object' ? answerStr : (
                <span className="text-sm">{safeStringify(answerStr)}</span>
              )}
            </div>
          </div>
          ) : qaPair.question_type === 'checkbox' && Array.isArray(answerStr) ? (
          <div className="space-y-2">
            {oldAnswerStr && Array.isArray(oldAnswerStr) && (
              <div className="line-through text-gray-500 mb-2">
                <ul className="list-disc ml-8">
                  {oldAnswerStr.map((item, idx) => (
                    <li key={idx}>{safeStringify(item)}</li>
                  ))}
                </ul>
              </div>
            )}
            <ul className="list-disc ml-8">
              {answerStr.map((item, idx) => (
                <li key={idx}>{safeStringify(item)}</li>
              ))}
            </ul>
          </div>
        ) : (
          // Regular display for other types
          <>
            {oldAnswerStr && (
              <div className="line-through text-gray-500">
                <pre className="whitespace-pre-wrap font-sans text-sm">{safeStringify(oldAnswerStr)}</pre>
              </div>
            )}
            <div>
              <pre className="whitespace-pre-wrap font-sans text-sm">{safeStringify(answerStr)}</pre>
            </div>
          </>
        )}
      </div>
      
      <div className="flex flex-col md:flex-row justify-between mt-2">
        {amendment.data.approved ? (
          <div className="flex items-center space-x-2">
            <Image
              alt={"check in sargood"}
              src={"/icons/check-green.png"}
              width={18}
              height={18} 
            />
            <p className="text-xs">
              Approved <span>{amendment.data.approved_by != null && `by ${amendment.data.approved_by} ${moment.duration(moment(amendment.data.approval_date).diff(moment())).humanize(true)}`}</span>
            </p>
          </div>
        ) : (
          <div></div>
        )}
        <p className="text-slate-500 text-xs">
          amended {moment.duration(moment(amendment.createdAt).diff(moment())).humanize(true)}
        </p>
      </div>
    </div>
  );
};

export default AmendmentDisplay;