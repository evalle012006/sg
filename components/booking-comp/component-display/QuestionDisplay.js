import React from 'react';
import moment from 'moment';
import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoalTableDisplay = dynamic(() => import('./GoalTableDisplay'), { ssr: false });
const ServiceCardsDisplay = dynamic(() => import('./ServiceCardDisplay'), { ssr: false });

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

  // UPDATED: Helper to format care table data for display only (not amendments)
  const formatCareTableForDisplay = (answer) => {
    let data = answer;
    
    try {
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
      // UPDATED: Handle new data structure { careData: [], defaultValues: {} }
      // Extract only careData for display, ignore defaultValues
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        if (data.careData && Array.isArray(data.careData)) {
          data = data.careData;
        }
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

      case 'service-cards':
      case 'service-cards-multi':
        return <ServiceCardsDisplay data={parsedAnswer} options={options} />;

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

export default QuestionDisplay;