import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/router';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Package, 
  CreditCard, 
  FileText, 
  Settings, 
  User,
  AlertCircle,
  CheckCircle,
  XCircle,
  Home,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import moment from 'moment';
import { toast } from 'react-toastify';
import Image from 'next/image';
import { globalActions } from "../../store/globalSlice";
import { checklistActions } from '../../store/checklistSlice';
import { Can, AbilityContext } from "../../services/acl/can";
import { fetchBookingStatuses, fetchBookingEligibilities } from "../../services/booking/statuses";
import { QUESTION_KEYS } from "./../../services/booking/question-helper";
import dynamic from 'next/dynamic';
import _ from 'lodash';

// Dynamic imports for layout and existing components
const Layout = dynamic(() => import('../../components/layout'));
const BookingEditView = dynamic(() => import('../../components/booking-comp/booking-edit-view'));
const AssetsAndEquipment = dynamic(() => import('../../components/booking-comp/assets-and-equipment'));
const Box = dynamic(() => import('../../components/booking-comp/box'));
const SelectComponent = dynamic(() => import('../../components/ui/select'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));
const Button = dynamic(() => import('../../components/ui-v2/Button'));
const Select = dynamic(() => import('../../components/fields/select'));

// Custom Accordion Item Component matching the screenshot design
const CustomAccordionItem = ({ title, description, isOpen, onToggle, children, status }) => {
  return (
    <div>
      {/* Header */}
      <div 
        className={`flex items-center justify-between py-6 px-6 cursor-pointer hover:bg-gray-50 transition-colors ${isOpen ? 'bg-gray-100' : 'bg-white'}`}
        onClick={onToggle}
      >
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-800 text-base uppercase tracking-wide">{title}</h3>
            {description && <p className="text-sm text-gray-600 mt-1">{description}</p>}
          </div>
        </div>
        <div className="text-sargood-blue">
          {isOpen ? <ChevronDown className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
        </div>
      </div>
      
      {/* Content */}
      {isOpen && (
        <div className="bg-white border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
};

const FunderImageDisplay = ({ funderDisplay }) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    const fetchImageUrl = async () => {
      // If imageUrl already exists (from question data), use it
      if (funderDisplay?.imageUrl) {
        setImageUrl(funderDisplay.imageUrl);
        return;
      }

      // If imageFilename exists but no imageUrl, fetch it from storage API
      if (funderDisplay?.imageFilename && !imageError) {
        setImageLoading(true);
        setImageError(false);

        try {
          const response = await fetch(`/api/storage/upload?filename=${funderDisplay.imageFilename}&filepath=funder/`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.fileUrl) {
              setImageUrl(data.fileUrl);
            } else {
              setImageError(true);
            }
          } else {
            setImageError(true);
          }
        } catch (error) {
          console.error('Error fetching funder image URL:', error);
          setImageError(true);
        } finally {
          setImageLoading(false);
        }
      }
    };

    fetchImageUrl();
  }, [funderDisplay?.imageUrl, funderDisplay?.imageFilename, imageError]);

  if (!funderDisplay) {
    return (
      <div className="text-center py-8">
        <CreditCard className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">No funding information available</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-6">
        {/* Funder Image - from storage API - Made bigger */}
        {(imageUrl || imageLoading) && (
          <div className="flex-shrink-0">
            {imageLoading ? (
              <div className="w-24 h-24 bg-gray-200 rounded flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <img 
                src={imageUrl}
                alt={funderDisplay.label}
                className="w-32 h-32 object-contain"
                onError={() => setImageError(true)}
              />
            )}
          </div>
        )}
        
        <div className="flex items-center space-x-4 flex-1">
          <div className="flex-1">
            <p className="font-semibold text-gray-900 text-lg">{funderDisplay.label}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Care Table Component (reused from existing implementation)
const CareTableDisplay = ({ data, oldData }) => {
  if (!data || !data.formatted || !data.dates) {
    return <pre className="whitespace-pre-wrap font-sans text-sm">{String(data)}</pre>;
  }
  
  const hasChanges = data.detailedChanges && data.detailedChanges.length > 0;
  
  if (!hasChanges) {
    return (
      <div className="care-table bg-gray-50 p-3 rounded-md">
        {data.dates.map((dateItem, dateIndex) => (
          <div key={dateIndex} className="mb-4">
            <div className="font-bold border-b pb-1 mb-2">{dateItem.date}</div>
            
            {dateItem.periods.morning && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-yellow-500 mr-2">☀️</span>
                <span>Morning: {dateItem.periods.morning.time} ({dateItem.periods.morning.duration}) - {dateItem.periods.morning.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.afternoon && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-orange-500 mr-2">🌤️</span>
                <span>Afternoon: {dateItem.periods.afternoon.time} ({dateItem.periods.afternoon.duration}) - {dateItem.periods.afternoon.carers} carer(s)</span>
              </div>
            )}
            
            {dateItem.periods.evening && (
              <div className="ml-4 flex items-center mb-1">
                <span className="text-blue-900 mr-2">🌙</span>
                <span>Evening: {dateItem.periods.evening.time} ({dateItem.periods.evening.duration}) - {dateItem.periods.evening.carers} carer(s)</span>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }
  
  // Show changes highlighting logic from old component
  const changesByDate = {};
  data.detailedChanges.forEach(change => {
    if (!changesByDate[change.date]) {
      changesByDate[change.date] = [];
    }
    changesByDate[change.date].push(change);
  });
  
  const getPeriodIcon = (period, isOld = false) => {
    if (period === 'morning') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-yellow-500'} mr-2`}>☀️</span>;
    } else if (period === 'afternoon') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-orange-500'} mr-2`}>🌤️</span>;
    } else if (period === 'evening') {
      return <span className={`${isOld ? 'text-gray-400' : 'text-blue-900'} mr-2`}>🌙</span>;
    }
    return null;
  };
  
  const formatCareValue = (value) => {
    if (!value) return 'None';
    return `${value.time} (${value.duration}) - ${value.carers} carer(s)`;
  };
  
  const getChangeLabel = (type) => {
    if (type === 'ADDED') {
      return <span className="ml-2 text-green-600 text-xs">[ADDED]</span>;
    } else if (type === 'REMOVED') {
      return <span className="ml-2 text-red-600 text-xs">[REMOVED]</span>;
    } else if (type === 'CHANGED') {
      return <span className="ml-2 text-orange-600 text-xs">[CHANGED]</span>;
    }
    return null;
  };
  
  return (
    <div className="care-table bg-gray-50 p-3 rounded-md">
      {Object.entries(changesByDate).map(([date, changes], dateIndex) => (
        <div key={dateIndex} className="mb-4">
          <div className="font-bold border-b pb-1 mb-2">{date}</div>
          
          {changes.map((change, changeIndex) => (
            <div key={changeIndex} className="ml-4 mb-3">
              <div className="font-medium capitalize mb-1">
                {change.period}:
                {getChangeLabel(change.type)}
              </div>
              
              {change.type === 'CHANGED' && (
                <>
                  <div className="flex items-center ml-4 line-through text-gray-500 mb-1">
                    {getPeriodIcon(change.period, true)}
                    <span>Old: {formatCareValue(change.oldValue)}</span>
                  </div>
                  <div className="flex items-center ml-4 font-medium">
                    {getPeriodIcon(change.period)}
                    <span>New: {formatCareValue(change.newValue)}</span>
                  </div>
                </>
              )}
              
              {change.type === 'ADDED' && (
                <div className="flex items-center ml-4 font-medium text-green-700">
                  {getPeriodIcon(change.period)}
                  <span>{formatCareValue(change.newValue)}</span>
                </div>
              )}
              
              {change.type === 'REMOVED' && (
                <div className="flex items-center ml-4 line-through text-gray-500">
                  {getPeriodIcon(change.period, true)}
                  <span>{formatCareValue(change.oldValue)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

// Goal Table Component (reused from existing implementation)
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

// Question Display Component
const QuestionDisplay = ({ question, answer, questionType, options, optionType, courseData, packageData }) => {
  
  // Helper function to safely parse JSON strings
  const safeJsonParse = (value) => {
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (e) {
        return value;
      }
    }
    return value;
  };

  // Helper function to safely convert any value to a displayable string
  const safeStringify = (value) => {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
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

  // Helper to format care table data for display only (not amendments)
  const formatCareTableForDisplay = (answer) => {
    let data = answer;
    
    try {
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      if (!Array.isArray(data)) {
        return <div className="text-sm bg-gray-50 p-3 rounded">{String(answer)}</div>;
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
      
      return (
        <div className="care-table bg-gray-50 p-3 rounded-md">
          {Object.entries(dateGroups).map(([date, periods], dateIndex) => (
            <div key={dateIndex} className="mb-4">
              <div className="font-bold border-b pb-1 mb-2">{date}</div>
              
              {periods.morning && (
                <div className="ml-4 flex items-center mb-1">
                  <span className="text-yellow-500 mr-2">☀️</span>
                  <span>Morning: {periods.morning.time} ({periods.morning.duration}) - {periods.morning.carers} carer(s)</span>
                </div>
              )}
              
              {periods.afternoon && (
                <div className="ml-4 flex items-center mb-1">
                  <span className="text-orange-500 mr-2">🌤️</span>
                  <span>Afternoon: {periods.afternoon.time} ({periods.afternoon.duration}) - {periods.afternoon.carers} carer(s)</span>
                </div>
              )}
              
              {periods.evening && (
                <div className="ml-4 flex items-center mb-1">
                  <span className="text-blue-900 mr-2">🌙</span>
                  <span>Evening: {periods.evening.time} ({periods.evening.duration}) - {periods.evening.carers} carer(s)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      );
    } catch (e) {
      console.error("Error formatting care table data:", e);
      return <div className="text-sm bg-gray-50 p-3 rounded text-red-500">Error displaying care data</div>;
    }
  };

  const formatAnswer = (answer, type, options) => {
    if (!answer && answer !== 0 && answer !== false) return <span className="text-gray-500 italic">Not answered</span>;
    
    // Parse answer if it's a JSON string
    let parsedAnswer = safeJsonParse(answer);
    
    switch (type) {
      case 'care-table':
        return formatCareTableForDisplay(parsedAnswer);
        
      case 'goal-table':
        return <GoalTableDisplay data={parsedAnswer} />;

      case 'package-selection':
        // Use pre-fetched package data if available
        if (packageData && packageData.name) {
          return (
            <div className="flex items-center text-sm">
              <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
              <span className="font-medium">{packageData.name}</span>
            </div>
          );
        }
        
        // Fallback for package questions without pre-fetched data
        if (/^\d+$/.test(parsedAnswer)) {
          return (
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 text-orange-500 mr-2" />
              <span>Package ID: {safeStringify(parsedAnswer)}</span>
            </div>
          );
        }
        
        return <span className="text-sm">{safeStringify(parsedAnswer)}</span>;
        
      case 'simple-checkbox':
      case 'checkbox':
        // Handle 1/0 values for Yes/No
        if (parsedAnswer === 1 || parsedAnswer === '1' || parsedAnswer === true) {
          return <div className="flex items-center text-sm">
            <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
            <span>Yes</span>
          </div>;
        }
        if (parsedAnswer === 0 || parsedAnswer === '0' || parsedAnswer === false) {
          return <div className="flex items-center text-sm">
            <XCircle className="w-4 h-4 text-red-500 mr-2" />
            <span>No</span>
          </div>;
        }
        
        // Handle array values like ["T1","T2","T3"] or ["I understand"]
        if (Array.isArray(parsedAnswer)) {
          return (
            <div className="space-y-1">
              {parsedAnswer.map((item, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>{safeStringify(item)}</span>
                </div>
              ))}
            </div>
          );
        }
        
        return <div className="flex items-center text-sm">
          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          <span>{safeStringify(parsedAnswer)}</span>
        </div>;
        
      case 'checkbox-multi':
        // Handle array values for multi-checkbox
        if (Array.isArray(parsedAnswer)) {
          return (
            <div className="space-y-1">
              {parsedAnswer.map((item, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>{safeStringify(item)}</span>
                </div>
              ))}
            </div>
          );
        }
        return <div className="flex items-center text-sm">
          <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
          <span>{safeStringify(parsedAnswer)}</span>
        </div>;
        
      case 'room-selection':
        // Handle room selection with objects like [{"name":"Deluxe Studio Room","order":1}]
        if (Array.isArray(parsedAnswer)) {
          return (
            <div className="space-y-1">
              {parsedAnswer.map((room, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>{safeStringify(room)}</span>
                </div>
              ))}
            </div>
          );
        }
        return <span className="text-sm">{safeStringify(parsedAnswer)}</span>;
        
      case 'radio':
      case 'select':
        // Handle options safely
        if (options && Array.isArray(options)) {
          const selectedOption = options.find(opt => opt.value === parsedAnswer);
          return selectedOption ? selectedOption.label : safeStringify(parsedAnswer);
        }
        return safeStringify(parsedAnswer);
        
      case 'date':
        return moment(parsedAnswer).isValid() ? moment(parsedAnswer).format('DD/MM/YYYY') : safeStringify(parsedAnswer);
        
      case 'datetime':
        return moment(parsedAnswer).isValid() ? moment(parsedAnswer).format('DD/MM/YYYY HH:mm') : safeStringify(parsedAnswer);
        
      case 'email':
        return <a href={`mailto:${parsedAnswer}`} className="text-blue-600 hover:underline">{safeStringify(parsedAnswer)}</a>;
        
      case 'phone':
        return <a href={`tel:${parsedAnswer}`} className="text-blue-600 hover:underline">{safeStringify(parsedAnswer)}</a>;
        
      case 'url':
        return <a href={parsedAnswer} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{safeStringify(parsedAnswer)}</a>;
        
      case 'textarea':
        return <div className="whitespace-pre-wrap text-sm">{safeStringify(parsedAnswer)}</div>;
        
      default:
        // Handle course questions with option_type='course' using pre-fetched data
        if (optionType === 'course' && /^\d+$/.test(parsedAnswer)) {
          if (courseData && courseData.title) {
            return (
              <div className="flex items-center space-x-3">
                {courseData.imageUrl && (
                  <img 
                    src={courseData.imageUrl}
                    alt={courseData.title}
                    className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
                <div className="flex items-center text-sm">
                  <span className="font-medium">{courseData.title}</span>
                </div>
              </div>
            );
          }
          
          // Fallback if no course data available
          return (
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 text-orange-500 mr-2" />
              <span>Course ID: {safeStringify(parsedAnswer)}</span>
            </div>
          );
        }
        
        // Handle package questions with package data
        if ((questionType === 'package-selection' || 
             (question && question.toLowerCase().includes('accommodation') && 
              question.toLowerCase().includes('package'))) && 
            /^\d+$/.test(parsedAnswer)) {
          
          if (packageData && packageData.name) {
            return (
              <div className="flex items-center text-sm">
                <span className="font-medium">{packageData.name}</span>
              </div>
            );
          }
          
          return (
            <div className="flex items-center text-sm">
              <AlertCircle className="w-4 h-4 text-orange-500 mr-2" />
              <span>Package ID: {safeStringify(parsedAnswer)}</span>
            </div>
          );
        }
        
        if (Array.isArray(parsedAnswer)) {
          return (
            <div className="space-y-1">
              {parsedAnswer.map((item, idx) => (
                <div key={idx} className="flex items-center text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  <span>{safeStringify(item)}</span>
                </div>
              ))}
            </div>
          );
        }
        return <span className="text-sm">{safeStringify(parsedAnswer)}</span>;
    }
  };

  return (
    <div className="border-b border-gray-100 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
      <div className="text-sm font-medium text-gray-700 mb-1">{question}</div>
      <div>{formatAnswer(answer, questionType, options)}</div>
    </div>
  );
};

const AmendmentDisplay = ({ amendment, onApprove, onDecline, currentUser }) => {
  const isApproved = amendment.data.approved;
  const isDeclined = amendment.data.declined_by;
  const qaPair = amendment.data.qa_pair || amendment.data;
  const isUser = currentUser && currentUser.type === 'user';
  const globalLoading = useSelector(state => state.global.loading);

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

    const oldGoals = parseGoalData(oldData);
    const newGoals = parseGoalData(newData);
    
    if ((!oldGoals || oldGoals.length === 0) && (!newGoals || newGoals.length === 0)) {
      return null;
    }
    
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

    if (oldGoals.length === 0 && newGoals.length > 0) {
      return {
        type: 'all-new',
        goals: newGoals
      };
    }
    
    if (newGoals.length === 0 && oldGoals.length > 0) {
      return {
        type: 'all-removed',
        goals: oldGoals
      };
    }
    
    const maxLength = Math.max(oldGoals.length, newGoals.length);
    const comparisonItems = [];
    
    for (let i = 0; i < maxLength; i++) {
      const oldGoal = i < oldGoals.length ? oldGoals[i] : null;
      const newGoal = i < newGoals.length ? newGoals[i] : null;
      
      if (!oldGoal && newGoal) {
        comparisonItems.push({
          type: 'ADDED',
          newGoal
        });
      } else if (oldGoal && !newGoal) {
        comparisonItems.push({
          type: 'REMOVED',
          oldGoal
        });
      } else if (areGoalsDifferent(oldGoal, newGoal)) {
        comparisonItems.push({
          type: 'CHANGED',
          oldGoal,
          newGoal
        });
      }
    }
    
    if (comparisonItems.length === 0) {
      return null;
    }
    
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
            {/* Add more goal diff cases as needed from original */}
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

// Sidebar Component for flags, notes, checklist
const DetailSidebar = ({ booking, callback, guest, address, setEditBooking }) => {
  const dispatch = useDispatch();
  const [checklist, setChecklist] = useState();
  const checklistData = useSelector(state => state.checklist.list);
  const [editChecklist, setEditCheckList] = useState(false);
  const [notes, setNotes] = useState('');
  const [checkListNotes, setChecklistNotes] = useState('');
  const [originalNotes, setOriginalNotes] = useState('');
  const [originalChecklistNotes, setOriginalChecklistNotes] = useState('');
  const user = useSelector(state => state.user.user);
  const [isSaving, setIsSaving] = useState(false);
  const [bookingLabels, setBookingLabels] = useState([]);
  const [settingsFlags, setSettingsFlags] = useState([]);
  const [selectedBookingLabels, setSelectedBookingLabels] = useState([]);

  const handleAddChangeChecklist = async (selected) => {
    const checklistActions = selected.actions.map(a => ({
      action: a,
      status: false,
      created_at: new Date(),
      updated_at: new Date()
    }));

    const checklistData = {
      name: selected.name,
      booking_id: booking.id,
      created_at: new Date(),
      updated_at: new Date(),
      ChecklistActions: checklistActions
    };

    const response = await fetch('/api/bookings/checklist/add-update', {
      method: 'POST',
      body: JSON.stringify(checklistData),
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      toast.success('Checklist successfully added.');
      // Close the edit mode
      setEditCheckList(false);
      // Refresh the local checklist data
      await getCheckList();
      // Refresh the booking data
      callback && callback();
    }
  };

  const fetchChecklistData = async () => {
    const response = await fetch("/api/manage-checklist");
    if (response.ok) {
      const respData = await response.json();
      const ckData = respData.map(ck => ({ ...ck, value: ck.id, label: ck.name }));
      dispatch(checklistActions.setList(ckData));
    }
  };

  // Handle checklist operations
  const getCheckList = async () => {
    const res = await fetch(`/api/bookings/checklist?bookingId=${booking.id}`);
    const data = await res.json();
    
    if (!data.hasOwnProperty('message')) {
      setChecklist(data);
    }
  };

  const handleOnChange = (e, index) => {
    let temp = { ...checklist };
    temp.ChecklistActions = temp.ChecklistActions.map((cka, idx) => {
      if (idx === index) {
        cka.status = e.target.checked;
        updateStatus(cka.id, cka.status);
      }
      return cka;
    });
    setChecklist(temp);
  };

  const updateStatus = async (id, status) => {
    await fetch(`/api/bookings/checklist/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status })
    });
  };

  // Handle notes
  const handleNotesChange = (e) => setNotes(e.target.value);
  const handleChecklistNotesChange = (e) => setChecklistNotes(e.target.value);

  const handleSaveNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      });

      if (response.ok) {
        setOriginalNotes(notes);
        toast.success('Notes saved successfully');
        callback && callback();
      }
    } catch (error) {
      toast.error('Failed to save notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveChecklistNotes = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-checklist-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checklist_notes: checkListNotes })
      });

      if (response.ok) {
        setOriginalChecklistNotes(checkListNotes);
        toast.success('Checklist notes saved successfully');
        callback && callback();
      }
    } catch (error) {
      toast.error('Failed to save checklist notes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectBookingLabel = async (selectedLabels) => {
    // Convert display labels back to original format for API
    const apiLabels = selectedLabels.map(displayLabel => {
      // Find the original flag value from the display label
      const matchingFlag = settingsFlags.find(flag => 
        _.startCase(flag) === displayLabel
      );
      return matchingFlag || displayLabel.toLowerCase().replace(/\s+/g, '_');
    });

    const response = await fetch(`/api/bookings/${booking.uuid}/update-label`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: apiLabels })
    });

    if (response.ok) {
      callback && callback();
    }
  };

  const handleViewBookingHistory = () => {
    window.open(`/guests/${guest.uuid}`, '_blank');
  };

  useEffect(() => {
    const fetchSettingsFlagsList = async () => {
      const response = await fetch('/api/settings/booking_flag');
      if (response.ok) {
        const data = await response.json();
        setSettingsFlags(data.map(flag => flag.value));
      }
    };
    fetchSettingsFlagsList();
  }, []);

  useEffect(() => {
    let mounted = true;

    if (mounted && booking && settingsFlags.length > 0) {
      getCheckList();
      fetchChecklistData();
      setNotes(booking?.notes || '');
      setOriginalNotes(booking?.notes || '');
      setChecklistNotes(booking?.checklist_notes || '');
      setOriginalChecklistNotes(booking?.checklist_notes || '');

      // FIXED: Process booking labels properly
      if (booking?.label) {
        let existingLabels = booking.label;
        
        // Parse if it's a string
        if (typeof booking.label === 'string') {
          try {
            existingLabels = JSON.parse(booking.label);
          } catch (e) {
            console.warn('Failed to parse booking label:', e);
            existingLabels = [];
          }
        }
        
        // Ensure it's an array
        if (!Array.isArray(existingLabels)) {
          if (existingLabels && typeof existingLabels === 'object' && existingLabels.value) {
            existingLabels = [existingLabels.value];
          } else {
            existingLabels = [];
          }
        }
        
        // FIXED: Extract values from objects if needed
        const labelValues = existingLabels.map(label => {
          if (typeof label === 'object' && label.value) {
            return label.value;
          }
          return label;
        }).filter(Boolean);
        
        // Set selected labels (display format using startCase)
        setSelectedBookingLabels(labelValues.map(flag => _.startCase(flag)));
        
        // Set all available booking labels
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: labelValues.includes(flag)
        })));
      } else {
        setSelectedBookingLabels([]);
        setBookingLabels(settingsFlags.map(flag => ({
          label: _.startCase(flag),
          value: flag,
          checked: false
        })));
      }
    }

    return () => {
      mounted = false;
    };
  }, [booking, settingsFlags]);

  const hasNotesChanges = notes !== originalNotes;
  const hasChecklistNotesChanges = checkListNotes !== originalChecklistNotes;

  return (
    <div className="bg-white h-full overflow-y-auto border-l">
      {/* Guest Info Header */}
      <div className="p-4">
        <div className="flex items-start space-x-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 flex-shrink-0 flex items-center justify-center">
            {guest?.profileFileUrl ? (
              <Image 
                src={guest.profileFileUrl} 
                alt={`${guest?.first_name} ${guest?.last_name}`}
                width={64}
                height={64}
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'flex';
                }}
              />
            ) : null}
            <div 
              className={`w-full h-full flex items-center justify-center text-gray-500 ${guest?.profileFileUrl ? 'hidden' : 'flex'}`}
              style={{ display: guest?.profileFileUrl ? 'none' : 'flex' }}
            >
              {guest?.first_name && guest?.last_name ? (
                <span className="text-lg font-medium text-gray-600">
                  {guest.first_name.charAt(0)}{guest.last_name.charAt(0)}
                </span>
              ) : (
                <User className="w-8 h-8 text-gray-400" />
              )}
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {guest?.first_name} {guest?.last_name}
            </h2>
            <div className="space-y-1 text-sm">
              {guest?.email && (
                <div className="text-blue-600">{guest.email}</div>
              )}
              {guest?.phone_number && (
                <div className="text-gray-600">{guest.phone_number}</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Alternate Contact Section */}
      <div className="p-4">
        <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">ALTERNATE CONTACT</h3>
        <div className="space-y-2 text-sm text-gray-500">
          <div>{booking.alternate_contact_name ? booking.alternate_contact_name : 'N/A'}</div>
          <div>{booking.alternate_contact_phone ? booking.alternate_contact_phone : 'N/A'}</div>
        </div>
      </div>

      {user && user.type === 'user' && (
        <Can I="Create/Edit" a="Booking">
          <div className="p-4 space-y-6">
            {/* FIXED: Booking Labels with proper options */}
            <div>
              <Select 
                type="multi-select" 
                options={bookingLabels} 
                onChange={handleSelectBookingLabel} 
                value={selectedBookingLabels} 
                multi={true}
              />
            </div>

            {/* Notes */}
            <div>
              <textarea
                disabled={isSaving}
                className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${isSaving ? 'bg-gray-50' : ''}`}
                rows="6"
                value={notes}
                onChange={handleNotesChange}
                placeholder="Enter your note here"
              />
              {hasNotesChanges && (
                <div className="mt-3">
                  <Button
                    color="primary"
                    size="small"
                    label={isSaving ? "Saving..." : "Save Changes"}
                    onClick={handleSaveNotes}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            <div>
              <Can I="Create/Edit" a="Booking">
                {checklist && checklist?.ChecklistActions?.length > 0 ? (
                  <div className="flex flex-col my-3 w-full">
                    {editChecklist ? (
                      <SelectComponent 
                        options={checklistData} 
                        onChange={handleAddChangeChecklist} 
                        value={checklist.name} 
                        width='100%' 
                      />
                    ) : (
                      <React.Fragment>
                        <span 
                          className="underline text-base text-blue-600 cursor-pointer flex justify-end mb-2" 
                          onClick={() => setEditCheckList(true)}
                        >
                          Change Checklist
                        </span>
                        <p className="text-blue-700 font-bold mr-4 flex justify-start mb-4">{checklist.name}</p>
                      </React.Fragment>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-row justify-between w-full mb-4">
                    {editChecklist ? (
                      <SelectComponent 
                        options={checklistData} 
                        onChange={handleAddChangeChecklist} 
                        width='100%' 
                      />
                    ) : (
                      <React.Fragment>
                        <span className="italic text-gray-500">No checklist added</span>
                        <span 
                          className="underline text-base text-blue-600 cursor-pointer" 
                          onClick={() => setEditCheckList(true)}
                        >
                          Add Checklist
                        </span>
                      </React.Fragment>
                    )}
                  </div>
                )}

                {/* Checklist Items Display */}
                <div className={`${checklist && 'overflow-scroll scrollbar-hidden'} mb-8`}>
                  {checklist && checklist?.ChecklistActions?.map((cka, idx) => (
                    <div key={idx} className="mt-2">
                      <label className="flex flex-row items-start p-2">
                        <input
                          type="checkbox"
                          name={cka.id}
                          className="w-4 h-4 text-green-600 border-0 rounded-md focus:ring-0"
                          value={cka.status}
                          onChange={(e) => handleOnChange(e, idx)}
                          checked={cka.status}
                        />
                        <span className="ml-2 -mt-1">{cka.action}</span>
                      </label>
                    </div>
                  ))}
                </div>
              </Can>

              {/* Fallback for users without edit permissions */}
              <Can not I="Create/Edit" a="Booking">
                <div className="text-sm text-gray-500 mb-3">No checklist access</div>
              </Can>
            </div>

            {/* Checklist Notes */}
            <div>
              <textarea
                disabled={isSaving}
                className={`w-full rounded-lg border border-gray-300 px-3 py-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 focus:outline-none transition-colors ${isSaving ? 'bg-gray-50' : ''}`}
                rows="4"
                value={checkListNotes}
                onChange={handleChecklistNotesChange}
                placeholder="Enter your note here"
              />
              {hasChecklistNotesChanges && (
                <div className="mt-3">
                  <Button
                    color="primary"
                    size="small"
                    label={isSaving ? "Saving..." : "Save Changes"}
                    onClick={handleSaveChecklistNotes}
                    disabled={isSaving}
                  />
                </div>
              )}
            </div>

            {/* View Booking History */}
            <div className="pt-4">
              <Button 
                color="outline"
                size="medium"
                label="VIEW BOOKING HISTORY"
                onClick={handleViewBookingHistory}
                fullWidth={true}
                className="flex items-center justify-center"
              />
            </div>
          </div>
        </Can>
      )}

      {/* Limited view for guests */}
      {user && user.type === 'guest' && (
        <div className="p-6">
          <div className="text-center text-gray-500">
            <p className="text-sm">Limited information available for guest view.</p>
          </div>
        </div>
      )}

      {/* No user or unauthorized */}
      {!user && (
        <div className="p-6 text-center">
          <div className="text-gray-400 mb-3">
            <User className="w-12 h-12 mx-auto" />
          </div>
          <p className="text-gray-500">Please log in to view booking details</p>
        </div>
      )}
    </div>
  );
};

// Main BookingDetail Component
export default function BookingDetail() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { uuid } = router.query;
  const currentUser = useSelector(state => state.user.user);
  const loading = useSelector(state => state.global.loading);
  
  // Check user type and permissions
  const isUser = currentUser && currentUser.type === 'user';
  const isGuest = currentUser && currentUser.type === 'guest';
  
  // Main state
  const [booking, setBooking] = useState(null);
  const [status, setStatus] = useState(null);
  const [eligibility, setEligibility] = useState(null);
  const [amendments, setAmendments] = useState([]);
  const [healthInfo, setHealthInfo] = useState(null);
  const [equipmentAvailability, setEquipmentAvailability] = useState([]);
  const [packages, setPackages] = useState(null);
  const [openAccordionItems, setOpenAccordionItems] = useState({}); 
  const [editBooking, setEditBooking] = useState(false);
  const [editEquipment, setEditEquipment] = useState(false);
  
  // Package-related state
  const [packageDetails, setPackageDetails] = useState(null);
  const [loadingPackageDetails, setLoadingPackageDetails] = useState(false);
  
  // Add state for dropdowns
  const [statuses, setStatuses] = useState([]);
  const [eligibilities, setEligibilities] = useState([]);
  
  const [loadingStates, setLoadingStates] = useState({
    booking: true,
    amendments: false,
    healthInfo: false,
    equipment: false
  });

  // Course-related state
  const [courseDetails, setCourseDetails] = useState(null);
  const [loadingCourseDetails, setLoadingCourseDetails] = useState(false);

  // Funder-related state  
  const [funderOptions, setFunderOptions] = useState(null);
  const [selectedFunderOption, setSelectedFunderOption] = useState(null);

  const accordionInitialized = useRef(false);

  // Helper function to serialize package names to short codes
  const serializePackage = (packageType) => {
    if (packageType.includes("Wellness & Very High Support Package")) {
      return "WVHS";
    } else if (packageType.includes("Wellness & High Support Package")) {
      return "WHS";
    } else if (packageType.includes("Wellness & Support") || packageType.includes("Wellness and Support")) {
      return "WS";
    } else if (packageType.includes("NDIS Support Package - No 1:1 assistance with self-care")) {
      return "SP"
    } else if (packageType.includes("NDIS Care Support Package - includes up to 6 hours of 1:1 assistance with self-care")) {
      return "CSP"
    } else if (packageType.includes("NDIS High Care Support Package - includes up to 12 hours of 1:1 assistance with self-care")) {
      return "HCSP"
    } else {
      return '';
    }
  };

  // Get course information
  const courseInfo = useMemo(() => {
    
    if (!booking?.Sections) {
      console.log('❌ No booking.Sections found');
      return null;
    }
    
    let course = null;
    let courseId = null;
    let questionType = null;
    let questionKey = null;
    
    booking.Sections.forEach((section, sectionIndex) => {
      section.QaPairs?.forEach((qaPair, qaPairIndex) => {
        const question = qaPair.Question;
        const questionText = question?.question || '';
        const qType = question?.question_type || question?.type || '';
        const optionType = question?.option_type || '';
        const qKey = qaPair.question_key || '';
        
        // Check for course selection with multiple detection methods
        const isCourseQuestion = 
          qKey === QUESTION_KEYS.COURSE_SELECTION || 
          qKey === 'which-course' ||
          questionText === 'Which course?' ||
          questionText.toLowerCase().includes('which course') ||
          (optionType === 'course' && qKey === 'which-course') ||
          (qType === 'course');
        
        if (isCourseQuestion) {
          course = qaPair.answer;
          questionType = qType;
          questionKey = qKey;
          
          // If answer is numeric, treat as course ID (especially for option_type='course')
          if (qaPair.answer && /^\d+$/.test(qaPair.answer)) {
            courseId = qaPair.answer;
          }
        }
      });
    });
    
    const result = {
      answer: course,
      courseId: courseId,
      questionType: questionType,
      questionKey: questionKey
    };
    
    return result;
  }, [booking]);

  useEffect(() => {
    const fetchCourseDetails = async () => {
      if (courseInfo?.courseId) {
        setLoadingCourseDetails(true);
        
        try {
          const response = await fetch(`/api/courses/${courseInfo.courseId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.data) {
              setCourseDetails(data.data);
            } else if (data.success && data.course) {
              setCourseDetails(data.course);
            } else if (data.title) {
              setCourseDetails(data);
            } else {
              console.error('❌ Invalid course API response structure:', data);
              setCourseDetails(null);
            }
          } else {
            console.error('❌ Course HTTP Error:', response.status, response.statusText);
            
            try {
              const errorData = await response.json();
              console.error('❌ Error response:', errorData);
            } catch (parseError) {
              console.error('❌ Could not parse error response');
            }
            
            setCourseDetails(null);
          }
        } catch (error) {
          console.error('❌ Course Network/fetch error:', error);
          setCourseDetails(null);
        } finally {
          setLoadingCourseDetails(false);
        }
      } else {
        // Reset course details if no courseId
        if (courseDetails !== null) {
          setCourseDetails(null);
        }
      }
    };

    fetchCourseDetails();
  }, [courseInfo?.courseId]);

  const getCourseTypeDisplay = () => {

    if (courseInfo?.courseId && courseDetails) {
      return {
        title: courseDetails.title,
        description: courseDetails.description,
        startDate: courseDetails.start_date,
        endDate: courseDetails.end_date,
        minStartDate: courseDetails.min_start_date,
        minEndDate: courseDetails.min_end_date,
        durationHours: courseDetails.duration_hours,
        ndisStaPrice: courseDetails.ndis_sta_price,
        ndisHspPrice: courseDetails.ndis_hsp_price,
        status: courseDetails.status,
        imageUrl: courseDetails.imageUrl
      };
    } else if (courseInfo?.answer) {
      return {
        title: courseInfo.answer,
        description: null,
        startDate: null,
        endDate: null,
        status: null
      };
    }
    
    console.log('❌ No course information available');
    return null;
  };

  // Get funder information
  const funderInfo = useMemo(() => {
    if (!booking?.Sections) {
      console.log('❌ No booking.Sections found');
      return null;
    }
    
    let funder = null;
    let funderQuestion = null;
    let funderOptions = null;
    
    booking.Sections.forEach((section, sectionIndex) => {      
      section.QaPairs?.forEach((qaPair, qaPairIndex) => {
        const question = qaPair.Question;
        const qKey = qaPair.question_key || '';
        const questionText = question?.question || '';
        
        // Check for funding source question with multiple detection methods
        const isFundingQuestion = 
          qKey === QUESTION_KEYS.FUNDING_SOURCE || 
          qKey === 'how-will-your-stay-be-funded' ||
          questionText === 'How will your stay be funded?' ||
          questionText.toLowerCase().includes('how will your stay be funded');
        
        if (isFundingQuestion) {
          funder = qaPair.answer;
          funderQuestion = question;
          
          // Extract options if available
          if (question?.options) {
            try {
              funderOptions = typeof question.options === 'string' 
                ? JSON.parse(question.options) 
                : question.options;
            } catch (e) {
              console.warn('Failed to parse funder options:', e);
            }
          }
        }
      });
    });
    
    const result = {
      answer: funder,
      question: funderQuestion,
      options: funderOptions
    };
    
    return result;
  }, [booking]);

  useEffect(() => {
    if (funderInfo?.options && funderInfo?.answer) {
      // Find the selected funder option
      const selectedOption = funderInfo.options.find(option => 
        option.value === funderInfo.answer || option.label === funderInfo.answer
      );
      setSelectedFunderOption(selectedOption);
      setFunderOptions(funderInfo.options);
    } else {
      setSelectedFunderOption(null);
      setFunderOptions(null);
    }
  }, [funderInfo]);

  const getFunderTypeDisplay = () => {
    if (selectedFunderOption) {
      return {
        label: selectedFunderOption.label,
        value: selectedFunderOption.value,
        description: selectedFunderOption.description,
        imageUrl: selectedFunderOption.imageUrl,
        imageFilename: selectedFunderOption.imageFilename
      };
    } else if (funderInfo?.answer) {
      return {
        label: funderInfo.answer,
        value: funderInfo.answer,
        description: null,
        imageUrl: null
      };
    }
    
    console.log('❌ No funder information available');
    return null;
  };

  // Get package information with API fetch for package-selection type
  const packageInfo = useMemo(() => {
    if (!booking?.Sections) {
      console.log('❌ No booking.Sections found');
      return null;
    }
    
    // Extract package from Q&A pairs with improved detection
    let packageAnswer = null;
    let packageQuestionType = null;
    let packageId = null;
    let foundSection = null;
    let foundQaPair = null;
    
    // Check all sections for package-related questions
    booking.Sections.forEach(section => {
      section.QaPairs?.forEach(qaPair => {
        const question = qaPair.Question?.question || '';
        const questionType = qaPair.Question?.question_type || '';
        const questionKey = qaPair.question_key || '';
        
        // Check by question_key (original logic)
        if (questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES ||
            questionKey === QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) {
          if (qaPair.answer) {
            packageAnswer = qaPair.answer;
            packageQuestionType = questionType;
            foundSection = section;
            foundQaPair = qaPair;
            
            // FIXED: Always treat answer as packageId for package questions
            packageId = qaPair.answer;
          }
        }
        
        // Also check by question type (backup detection)
        if (!packageAnswer && questionType === 'package-selection' && qaPair.answer) {
          packageAnswer = qaPair.answer;
          packageQuestionType = questionType;
          packageId = qaPair.answer;
          foundSection = section;
          foundQaPair = qaPair;
        }
        
        if (!packageAnswer && 
            question.toLowerCase().includes('accommodation') && 
            question.toLowerCase().includes('package') && 
            qaPair.answer) {
          packageAnswer = qaPair.answer;
          packageQuestionType = questionType || 'package-selection'; // Default to package-selection
          foundSection = section;
          foundQaPair = qaPair;
          
          // Check if answer looks like a package ID (numeric)
          if (/^\d+$/.test(qaPair.answer)) {
            packageId = qaPair.answer;
          }
        }
      });
    });

    // Return the extracted package information
    return {
      answer: packageAnswer,
      questionType: packageQuestionType,
      packageId: packageId,
      packageDetails: packageDetails,
      foundSection: foundSection?.label || foundSection?.id,
      foundQaPair: foundQaPair?.id
    };
  }, [booking, packageDetails]);

  // Fetch package details when packageId is available
  useEffect(() => {
    const fetchPackageDetails = async () => {
      if (packageInfo?.packageId) {
        setLoadingPackageDetails(true);
        
        try {
          const response = await fetch(`/api/packages/${packageInfo.packageId}`);
          
          if (response.ok) {
            const data = await response.json();
            
            if (data.success && data.package) {
              setPackageDetails(data.package);
            } else {
              console.error('❌ Invalid API response structure:', data);
              setPackageDetails(null);
            }
          } else {
            console.error('❌ HTTP Error:', response.status, response.statusText);
            
            try {
              const errorData = await response.json();
              console.error('❌ Error response:', errorData);
            } catch (parseError) {
              console.error('❌ Could not parse error response');
            }
            
            setPackageDetails(null);
          }
        } catch (error) {
          console.error('❌ Network/fetch error:', error);
          setPackageDetails(null);
        } finally {
          setLoadingPackageDetails(false);
        }
      } else {
        // Reset package details if no packageId
        if (packageDetails !== null) {
          console.log('🔄 Resetting package details - no packageId');
          setPackageDetails(null);
        }
      }
    };

    fetchPackageDetails();
  }, [packageInfo?.packageId]);

  // Get serialized package type for display
  const getPackageTypeDisplay = () => {
    if (packageInfo?.packageId && packageDetails) {
      return {
        name: packageDetails.name,
        code: packageDetails.package_code,
        funder: packageDetails.funder,
        price: packageDetails.price,
        ndisPackageType: packageDetails.ndis_package_type,
        ndisLineItems: packageDetails.ndis_line_items
      };
    } else if (packageInfo?.answer) {
      let packageType = null;
      if (!courseInfo) {
        packageType = serializePackage(packageInfo.answer);
      } else if (courseInfo) {
        packageType = 'Course' + serializePackage(packageInfo.answer);
      } else {
        packageType = 'N/A';
      }
      
      return {
        name: packageInfo.answer,
        code: packageType,
        funder: null,
        price: null
      };
    }
    
    console.log('❌ No package information available');
    return null;
  };

  // Get total guests helper function
  const getTotalGuests = (room) => {
    let totalGuests = 0;
    totalGuests += room.adults || 0;
    totalGuests += room.children || 0;
    totalGuests += room.infants || 0;
    totalGuests += room.pets || 0;
    return totalGuests;
  };

  // Add the toggle function
  const toggleAccordionItem = (index) => {
    setOpenAccordionItems(prev => ({
      ...prev,
      [index]: !prev[index]
    }));
  };

  // Status update handlers from original component
  const handleUpdateStatus = useCallback(async (selected) => {
    dispatch(globalActions.setLoading(true));
    setStatus(selected);
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          status: selected
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update booking status';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        toast.error(errorMessage);
        dispatch(globalActions.setLoading(false));
        return;
      }

      await fetchBooking();

      if (status.name == 'eligible') {
        toast.success("An invitation email has been sent to the guest.");
      }
      
      if (selected.name === 'booking_confirmed') {
        toast.success("Booking has been confirmed successfully!");
      }

    } catch (error) {
      console.error('Network error updating status:', error);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }, [booking?.uuid, status, dispatch]);

  const handleUpdateEligibility = useCallback(async (selected) => {
    dispatch(globalActions.setLoading(true));
    setEligibility(selected);
    
    try {
      const response = await fetch(`/api/bookings/${booking.uuid}/update-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          eligibility: selected
        })
      });

      if (!response.ok) {
        let errorMessage = 'Failed to update booking eligibility';
        try {
          const errorData = await response.json();
          if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (parseError) {
          console.error('Error parsing error response:', parseError);
        }
        
        toast.error(errorMessage);
        dispatch(globalActions.setLoading(false));
        return;
      }

      await fetchBooking();
      
      if (selected.name === 'eligible') {
        toast.success("Guest eligibility approved successfully!");
      } else if (selected.name === 'ineligible') {
        toast.success("Guest eligibility status updated.");
      }

    } catch (error) {
      console.error('Network error updating eligibility:', error);
      toast.error('Network error occurred. Please check your connection and try again.');
      dispatch(globalActions.setLoading(false));
    }
  }, [booking?.uuid, dispatch]);

  // Fetch booking data
  const fetchBooking = useCallback(async () => {
    if (!uuid) return;
    
    setLoadingStates(prev => ({ ...prev, booking: true }));
    dispatch(globalActions.setLoading(true));
    
    try {
      const res = await fetch(`/api/bookings/${uuid}`);
      const data = await res.json();
      
      if (res.ok) {
        setBooking(data);
        setStatus(JSON.parse(data.status));
        setEligibility(JSON.parse(data.eligibility));
        setAmendments(data.Logs || []);
      } else {
        toast.error('Failed to load booking');
      }
    } catch (error) {
      console.error('Error fetching booking:', error);
      toast.error('Failed to load booking');
    } finally {
      setLoadingStates(prev => ({ ...prev, booking: false }));
      dispatch(globalActions.setLoading(false));
    }
  }, [uuid, dispatch]);

  // Fetch health info
  const fetchHealthInfo = useCallback(async () => {
    if (!booking?.Guest?.uuid) return;
    
    setLoadingStates(prev => ({ ...prev, healthInfo: true }));
    try {
      const response = await fetch('/api/bookings/history/health-info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uuid: booking.Guest.uuid })
      });
      if (response.ok) {
        const data = await response.json();
        setHealthInfo(data);
      }
    } catch (err) {
      console.error('Error fetching health info:', err);
    } finally {
      setLoadingStates(prev => ({ ...prev, healthInfo: false }));
    }
  }, [booking?.Guest?.uuid]);

  // Amendment approval/decline handlers
  const handleApproveDeclineAmendment = (amendment, approval) => async () => {
    dispatch(globalActions.setLoading(true));
    const currentUsername = currentUser.first_name + ' ' + currentUser.last_name;

    let approvedDeclineAmendments = { 
      approved: approval, 
      approved_by: currentUsername, 
      approval_date: new Date() 
    };
    
    if (!approval) {
      approvedDeclineAmendments = { 
        approved: approval, 
        approved_by: null, 
        approval_date: null, 
        declined_by: currentUsername, 
        decline_date: new Date() 
      };
    }

    try {
      const response = await fetch('/api/bookings/amendment-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: amendment.id,
          ...approvedDeclineAmendments
        })
      });

      if (response.ok) {
        // Update the amendments state
        const updatedAmendments = amendments.map(item => {
          if (item.id === amendment.id) {
            return { 
              ...item, 
              data: { 
                ...item.data, 
                ...approvedDeclineAmendments 
              } 
            }
          }
          return item;
        });

        setAmendments(updatedAmendments);
        toast.success(`Amendment ${approval ? 'approved' : 'declined'} successfully`);
      } else {
        toast.error('Failed to update amendment');
      }
    } catch (error) {
      toast.error('Failed to update amendment');
      console.error('Error updating amendment:', error);
    } finally {
      dispatch(globalActions.setLoading(false));
    }
  };

  // Effects
  useEffect(() => {
    fetchBooking();
  }, [fetchBooking]);

  useEffect(() => {
    if (booking) {
      fetchHealthInfo();
      // Open first accordion item by default
      setOpenAccordionItems({ 0: true });
    }
  }, [booking, fetchHealthInfo]);

  // Fetch statuses and eligibilities
  useEffect(() => {
    fetchBookingStatuses().then(data => {
      const arr = data.map(s => {
        const status = JSON.parse(s.value);
        return { ...status, value: status.name };
      });
      setStatuses(arr);
    });

    fetchBookingEligibilities().then(data => {
      const arr = data.map(s => {
        const status = JSON.parse(s.value);
        return { ...status, value: status.name };
      });
      setEligibilities(arr);
    });
  }, []);

  // Room setup calculation
  const roomSetupData = useMemo(() => {
    if (!booking?.Sections) return { adults: 0, children: 0, infants: 0, pets: 0 };
    
    // Extract room setup data from booking sections/Q&A pairs
    return {
      adults: 3, // Default values - replace with actual extraction logic
      children: 2,
      infants: 0,
      pets: 0
    };
  }, [booking]);

  // Create accordion items
  const accordionItems = useMemo(() => {
    if (!booking) return [];

    const getStatusType = (status) => {
      try {
        const statusObj = JSON.parse(status);
        switch (statusObj.name) {
          case 'booking_confirmed': return 'success';
          case 'booking_pending': return 'pending';
          case 'booking_cancelled': return 'error';
          default: return 'pending';
        }
      } catch {
        return 'pending';
      }
    };

    const items = [
      {
        title: 'Booking Status',
        description: 'Current booking status and eligibility information',
        customContent: (
          <div className="p-6">
            <Can I="Create/Edit" a="Booking">
              {isUser && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className='w-full lg:w-72'>
                    <SelectComponent 
                      label={'Status'} 
                      placeholder={'Update status'} 
                      value={status && status.label} 
                      options={statuses} 
                      onChange={handleUpdateStatus} 
                    />
                  </div>
                  <div className='w-full lg:w-72'>
                    <SelectComponent 
                      label={'Eligibility'} 
                      placeholder={'Update eligibility'} 
                      value={eligibility && eligibility.label} 
                      options={eligibilities} 
                      onChange={handleUpdateEligibility} 
                    />
                  </div>
                </div>
              )}
            </Can>
            
            {/* Show message for users without edit permissions */}
            <Can not I="Create/Edit" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <AlertCircle className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to update booking status</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Accommodation Type',
        description: 'Room type and booking dates',
        status: 'complete',
        customContent: (
          <div className="p-6">
            {booking.Rooms && booking.Rooms.length > 0 ? (
              booking.Rooms.map((room, index) => {
                // Calculate total guests for this room
                const totalGuests = (room.adults || 0) + (room.children || 0) + (room.infants || 0) + (room.pets || 0);
                
                // Get package info - you may need to adjust this based on your package data structure
                const packageTypeDisplay = getPackageTypeDisplay();
                const packageInfo = packageTypeDisplay?.code || packageTypeDisplay?.name || 'WHS';
                
                return (
                  <div key={index} className="mb-6 last:mb-0">
                    <div className="flex items-start space-x-6">
                      {/* Large Room Image */}
                      <div className="w-80 h-48 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
                        {room.imageUrl ? (
                          <img 
                            src={room.imageUrl}
                            alt={room.RoomType?.name || 'Room'}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.target.src = '/api/placeholder/320/192';
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <Home className="w-12 h-12 text-gray-400" />
                          </div>
                        )}
                      </div>
                      
                      {/* Room Details */}
                      <div className="flex-1">
                        {/* Room Title */}
                        <h4 className="text-xl font-semibold text-gray-900 mb-8">
                          {room.RoomType?.name || room.label || 'Standard Studio Room'}
                        </h4>
                        
                        {/* Info Grid - 4 columns with card styling */}
                        <div className="grid grid-cols-4 gap-6">
                          {/* Check-in Card */}
                          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-3">
                              <svg className="w-6 h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8.5 5L15.5 12L8.5 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-2">CHECK-IN</div>
                            <div className="text-lg font-bold text-gray-900 mb-1">
                              {room.checkin ? 
                                moment(room.checkin).format('DD/MM/YYYY') : 
                                (booking.preferred_arrival_date ? 
                                  moment(booking.preferred_arrival_date).format('DD/MM/YYYY') : 
                                  'Not set'
                                )
                              }
                            </div>
                            <div className="text-sm text-gray-600">Preferred</div>
                          </div>
                          
                          {/* Check-out Card */}
                          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-3">
                              <svg className="w-6 h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M15.5 19L8.5 12L15.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-2">CHECK-OUT</div>
                            <div className="text-lg font-bold text-gray-900 mb-1">
                              {room.checkout ? 
                                moment(room.checkout).format('DD/MM/YYYY') : 
                                (booking.preferred_departure_date ? 
                                  moment(booking.preferred_departure_date).format('DD/MM/YYYY') : 
                                  'Not set'
                                )
                              }
                            </div>
                            <div className="text-sm text-gray-600">Preferred</div>
                          </div>
                          
                          {/* Package Card */}
                          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-3">
                              <svg className="w-6 h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M21 8.5V16.5C21 17.33 20.33 18 19.5 18H4.5C3.67 18 3 17.33 3 16.5V8.5L12 3L21 8.5Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                <path d="M3 8.5L12 13.5L21 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-2">PACKAGE</div>
                            <div className="text-lg font-bold text-gray-900">
                              {packageInfo}
                            </div>
                          </div>
                          
                          {/* Guests Card */}
                          <div className="text-center p-4 rounded-lg" style={{ backgroundColor: '#F2F5F9' }}>
                            <div className="mb-3">
                              <svg className="w-6 h-6 text-blue-600 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M16 21V19C16 17.9 15.1 17 14 17H6C4.9 17 4 17.9 4 19V21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                                <circle cx="10" cy="9" r="4" stroke="currentColor" strokeWidth="2" fill="none"/>
                                <path d="M19 8V14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                                <path d="M22 11H16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                              </svg>
                            </div>
                            <div className="text-sm font-semibold text-gray-900 mb-2">GUEST</div>
                            <div className="text-lg font-bold text-gray-900">
                              {totalGuests || room.total_guests || 1}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Multiple rooms separator */}
                    {index < booking.Rooms.length - 1 && (
                      <div className="mt-8 pt-6 border-t border-gray-200">
                        <div className="text-sm font-medium text-gray-700 mb-2">
                          Additional Room {index + 2}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No room information available</p>
              </div>
            )}
          </div>
        )
      },
      {
        title: `Recent Amendments (${amendments.length})`,
        description: `${amendments.length} amendment${amendments.length !== 1 ? 's' : ''} found`,
        customContent: (
          <div className="p-6">
            <Can I="Read" a="Booking">
              {loadingStates.amendments ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : amendments.length > 0 ? (
                <div className="max-h-96 overflow-y-auto">
                  <Box>
                    {amendments
                      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                      .map((amendment, index) => (
                        <div key={amendment.id || index}>
                          <AmendmentDisplay 
                            amendment={amendment}
                            onApprove={isUser ? handleApproveDeclineAmendment(amendment, true) : null}
                            onDecline={isUser ? handleApproveDeclineAmendment(amendment, false) : null}
                            currentUser={currentUser}
                          />
                          {/* Add separator line between amendments (except for last item) */}
                          {index !== amendments.length - 1 && (
                            <hr className="border border-slate-300" />
                          )}
                        </div>
                      ))}
                  </Box>
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No amendments found</p>
                </div>
              )}
            </Can>
            <Can not I="Read" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <FileText className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to view amendments</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Assets & Equipment',
        description: `${booking.Equipment?.length || 0} equipment items assigned`,
        customContent: (
          <div className="p-6">
            <Can I="Read" a="Booking">
              {isUser ? (
                <AssetsAndEquipment equipmentsData={booking.Equipment} bookingId={booking.id} />
              ) : (
                <div className="space-y-4">
                  {booking.Equipment && booking.Equipment.length > 0 ? (
                    <ul className="space-y-2">
                      {booking.Equipment.map((equipment, index) => {
                        const equipmentDisplay = `${equipment.name} - ${equipment.serial_number ? equipment.serial_number : 'N/A'}`;
                        return (
                          <li key={index} className="flex gap-1 items-start">
                            <div className="relative min-w-5 min-h-5 w-5 h-5 mt-0.5">
                              <Image
                                alt={"check in sargood"}
                                src={"/icons/check-green.png"}
                                width={20}
                                height={20}
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <span className="font-bold">{equipmentDisplay}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-center py-8">
                      <Settings className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500">No equipment assigned</p>
                    </div>
                  )}
                </div>
              )}
            </Can>
            <Can not I="Read" a="Booking">
              <div className="text-center py-8">
                <div className="text-gray-400 mb-3">
                  <Settings className="w-12 h-12 mx-auto" />
                </div>
                <p className="text-gray-500">You don&apos;t have permission to view equipment details</p>
              </div>
            </Can>
          </div>
        )
      },
      {
        title: 'Room Setup',
        description: booking.Rooms?.length > 0 ? `${getTotalGuests(booking.Rooms[0])} total guests` : 'No room information',
        customContent: (
          <div className="p-6">
            {booking.hasOwnProperty('Rooms') && booking.Rooms.length > 0 ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Adults</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].adults}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Children</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].children}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Infants</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].infants || 0}</p>
                    </div>
                  </div>
                  <div className="text-center p-4 bg-gray-50 rounded-lg">
                    <p className="font-bold mb-3">Pets</p>
                    <div className="flex items-center justify-center space-x-3">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                      <p className="text-lg font-semibold">{booking.Rooms[0].pets}</p>
                    </div>
                  </div>
                </div>
                
                {booking.Rooms[0].guests?.length && (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h4 className="font-bold mb-4">Guest List</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {JSON.parse(booking.Rooms[0].guests).map((guest, index) => (
                        <div key={index} className="flex space-x-3 items-center">
                          <Image
                            alt={"check in sargood"}
                            src={"/icons/check-green.png"}
                            width={20}
                            height={20}
                          />
                          <p>{guest.name}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-8">
                <Home className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">The guest has not selected a room yet. Room setup will be available once the guest has selected a room.</p>
              </div>
            )}
          </div>
        )
      },
      {
        title: 'Packages',
        description: (() => {
          const packageDisplay = getPackageTypeDisplay();
          if (loadingPackageDetails) return 'Loading package details...';
          if (packageDisplay) return `Package: ${packageDisplay.code || packageDisplay.name}`;
          return 'No package selected';
        })(),
        customContent: (
          <div className="p-6">
            {loadingPackageDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading package details...</span>
              </div>
            ) : (() => {
              const packageDisplay = getPackageTypeDisplay();
              return packageDisplay ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <Image
                        alt={"check in sargood"}
                        src={"/icons/check-green.png"}
                        width={20}
                        height={20}
                      />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {packageDisplay.name}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No package information available</p>
                </div>
              );
            })()}
          </div>
        )
      },
      {
        title: 'Courses',
        description: (() => {
          const courseDisplay = getCourseTypeDisplay();
          if (loadingCourseDetails) return 'Loading course details...';
          if (courseDisplay) return `Course: ${courseDisplay.title}`;
          return 'No course selected';
        })(),
        customContent: (
          <div className="p-6">
            {loadingCourseDetails ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Loading course details...</span>
              </div>
            ) : (() => {
              const courseDisplay = getCourseTypeDisplay();
              return courseDisplay ? (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-center space-x-4">
                    {/* Course Image */}
                    {courseDisplay.imageUrl && (
                      <div className="flex-shrink-0">
                        <img 
                          src={courseDisplay.imageUrl}
                          alt={courseDisplay.title}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            e.target.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center space-x-4 flex-1">
                      <div className="flex-shrink-0">
                        <Image
                          alt={"check in sargood"}
                          src={"/icons/check-green.png"}
                          width={20}
                          height={20}
                        />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{courseDisplay.title}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-3">
                    <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 3L1 9l4 2.18v6L12 21l7-3.82v-6L23 9l-11-6zM5 13.18l7 3.82 7-3.82V11L12 15 5 11v2.18z"/>
                    </svg>
                  </div>
                  <p className="text-gray-500 italic">No course selected.</p>
                </div>
              );
            })()}
          </div>
        )
      },
      {
        title: 'Funder Type',
        description: (() => {
          const funderDisplay = getFunderTypeDisplay();
          if (funderDisplay) return `Funder: ${funderDisplay.label}`;
          return 'No funding information';
        })(),
        customContent: (
          <div className="p-4">
            <FunderImageDisplay funderDisplay={getFunderTypeDisplay()} />
          </div>
        )
      }
    ];

    if (booking?.templatePages && booking.templatePages.length > 0) {
      // Sort template pages by order to ensure correct display sequence
      const sortedTemplatePages = [...booking.templatePages].sort((a, b) => a.order - b.order);
      
      sortedTemplatePages.forEach((page) => {
        const sectionQaPairs = booking.Sections?.filter(section => 
          section.pageId === page.id
        ) || [];
        
        // Filter sections to only include those with answered questions
        const sectionsWithAnswers = sectionQaPairs
          .map(section => {
            // Filter QaPairs to only include those with answers
            const answeredQaPairs = section.QaPairs?.filter(qaPair => 
              qaPair.Question && 
              qaPair.answer !== null && 
              qaPair.answer !== undefined && 
              qaPair.answer !== ''
            ) || [];
            
            // Return section only if it has answered questions
            return answeredQaPairs.length > 0 ? {
              ...section,
              QaPairs: answeredQaPairs
            } : null;
          })
          .filter(Boolean); // Remove null sections
        
        // Only add template page if it has sections with answers
        if (sectionsWithAnswers.length > 0) {
          const totalAnsweredQuestions = sectionsWithAnswers.reduce((acc, section) => 
            acc + (section.QaPairs?.length || 0), 0
          );
          
          items.push({
            title: page.title,
            description: `${totalAnsweredQuestions} question${totalAnsweredQuestions !== 1 ? 's' : ''} answered`,
            status: 'complete',
            customContent: (
              <div className="p-6">
                <div className="space-y-6">
                  {sectionsWithAnswers
                    .sort((a, b) => a.order - b.order) // Sort sections by order
                    .map((section, sectionIndex) => (
                      <div key={section.id || sectionIndex} className="space-y-4">
                        {/* Section label if available */}
                        {section.label && (
                          <div className="border-b border-gray-200 pb-2 mb-4">
                            <h4 className="text-sm font-medium text-gray-700 uppercase tracking-wide">
                              {section.label}
                            </h4>
                          </div>
                        )}
                        
                        {/* Questions and Answers - only answered ones */}
                        <div className="space-y-4">
                          {section.QaPairs.map((qaPair, qaPairIndex) => {
                            const question = qaPair.Question;
                            
                            // Parse options safely - FIXED JSON parsing error
                            let options = null;
                            try {
                              // Handle case where options might already be an object
                              if (typeof question.options === 'object' && question.options !== null) {
                                options = question.options;
                              } else if (typeof question.options === 'string' && question.options.trim() !== '') {
                                options = JSON.parse(question.options);
                              }
                            } catch (e) {
                              console.warn('Failed to parse question options:', e);
                              options = null;
                            }
                            
                            return (
                              <QuestionDisplay
                                key={qaPair.id || `${section.id}-${qaPairIndex}`}
                                question={question.question}
                                answer={qaPair.answer}
                                questionType={question.question_type || question.type}
                                options={options}
                                optionType={question.option_type}
                                courseData={courseDetails}
                                packageData={packageDetails}
                              />
                            );
                          })}
                        </div>
                        
                        {/* Section separator (except for last section) */}
                        {sectionIndex < sectionsWithAnswers.length - 1 && (
                          <div className="border-b border-gray-100 mt-6"></div>
                        )}
                      </div>
                    ))
                  }
                </div>
              </div>
            )
          });
        }
      });
    }

    return items;
  }, [booking, amendments, healthInfo, loadingStates, editEquipment, currentUser, roomSetupData, isUser, status, eligibility, statuses, eligibilities, handleUpdateStatus, handleUpdateEligibility, packageDetails, loadingPackageDetails, courseInfo, funderInfo, getPackageTypeDisplay]);

  useEffect(() => {
    // Set all accordion items to open by default when booking data loads
    if (booking && accordionItems.length > 0 && !accordionInitialized.current) {
      const allOpenItems = {};
      accordionItems.forEach((_, index) => {
        allOpenItems[index] = true;
      });
      setOpenAccordionItems(allOpenItems);
      accordionInitialized.current = true;
    }
  }, [booking?.id, accordionItems.length]);

  useEffect(() => {
    if (booking?.id) {
      accordionInitialized.current = false;
    }
  }, [booking?.id]);

  // Loading state
  if (loadingStates.booking || loading) {
    return (
      <Layout title="Booking Details">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <Spinner />
            <p className="text-gray-500 mt-4">Loading booking details...</p>
          </div>
        </div>
      </Layout>
    );
  }

  // Error state
  if (!booking) {
    return (
      <Layout title="Booking Not Found">
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Booking Not Found</h2>
            <p className="text-gray-500 mb-4">The booking you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.</p>
            <Button
              color="primary"
              size="medium"
              label="Go Back"
              onClick={() => router.back()}
            />
          </div>
        </div>
      </Layout>
    );
  }

  // Show edit view if in edit mode
  if (editBooking) {
    return (
      <Layout title="Edit Booking">
        <BookingEditView booking={booking} onCancel={() => setEditBooking(false)} />
      </Layout>
    );
  }

  return (
    <Layout title={`Booking - ${booking.Guest?.first_name} ${booking.Guest?.last_name}`} noScroll={false}>
      <div className="flex flex-col bg-gray-50 px-6 py-4" style={{ minHeight: '100vh' }}>
        {/* Full Width Header with Breadcrumbs and Edit Button */}
        <div className='mb-4 flex-shrink-0'>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-blue-600">
                <svg width="18" height="19" viewBox="0 0 18 19" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2.46046 17.435C1.73569 17.4345 1.14844 16.8468 1.14844 16.122V8.62633C1.14844 7.90397 1.446 7.21352 1.97109 6.71745L7.27469 1.70703C8.28826 0.749484 9.87346 0.751043 10.8852 1.71057L16.1965 6.74814C16.7193 7.244 17.0154 7.93291 17.0154 8.65347V16.125C17.0154 16.8502 16.4276 17.438 15.7024 17.438H12.0917V13.1707C12.0917 12.4456 11.5038 11.8577 10.7787 11.8577H7.75874C7.03359 11.8577 6.44573 12.4456 6.44573 13.1707V17.438L2.46046 17.435Z" fill="#00467F" stroke="#00467F" strokeWidth="1.313" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div>
                <h1 className="text-lg text-gray-900">
                  <span className="font-semibold">BOOKINGS / </span>{booking.Guest?.first_name?.toUpperCase()} {booking.Guest?.last_name?.toUpperCase()}
                </h1>
              </div>
            </div>
            
            {/* Edit Booking Button */}
            <Can I="Create/Edit" a="Booking">
              {isUser && (
                <Button
                  color="primary"
                  size="medium"
                  label="EDIT BOOKING"
                  onClick={() => setEditBooking(true)}
                />
              )}
            </Can>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex border border-gray-100 shadow" style={{ minHeight: '800px' }}>
          {/* Left Content - Accordion */}
          <div className="flex-1 bg-white">
            {/* Accordion Content - Remove all height constraints that prevent scrolling */}
            <div className="bg-white" style={{ border: '1px solid #E6E6E6' }}>
              <div className="bg-white">
                {accordionItems.map((item, index) => (
                  <CustomAccordionItem
                    key={index}
                    title={item.title}
                    description={item.description}
                    status={item.status}
                    isOpen={openAccordionItems[index] || false}
                    onToggle={() => toggleAccordionItem(index)}
                  >
                    {item.customContent}
                  </CustomAccordionItem>
                ))}
              </div>
            </div>
          </div>

          {/* Right Sidebar */}
          {isUser ? (
            <div className="w-96 flex-shrink-0">
              <DetailSidebar 
                booking={booking} 
                guest={booking.Guest}
                address={booking.Guest?.Addresses?.[0]}
                callback={fetchBooking}
                setEditBooking={setEditBooking}
              />
            </div>
          ) : isGuest ? (
            <div className="w-96 bg-white border-l border-gray-200 flex-shrink-0">
              <div className="p-6">
                <div className="text-center">
                  <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Guest View</h3>
                  <p className="text-sm text-gray-500">You have limited access to booking details.</p>
                </div>
                
                {booking.Guest && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Your Booking</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-blue-700">Check-in:</span>
                        <span className="text-blue-800">
                          {booking.preferred_arrival_date ? 
                            moment(booking.preferred_arrival_date).format('DD MMM YYYY') : 
                            'Not set'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Check-out:</span>
                        <span className="text-blue-800">
                          {booking.preferred_departure_date ? 
                            moment(booking.preferred_departure_date).format('DD MMM YYYY') : 
                            'Not set'
                          }
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-blue-700">Room:</span>
                        <span className="text-blue-800">{booking.Room?.RoomType?.name || 'TBD'}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </Layout>
  );
}