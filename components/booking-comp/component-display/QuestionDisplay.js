import React from 'react';
import moment from 'moment';
import { CheckCircle, XCircle, AlertCircle, Download, FileText, File } from 'lucide-react';
import dynamic from 'next/dynamic';

const GoalTableDisplay = dynamic(() => import('./GoalTableDisplay'), { ssr: false });
const ServiceCardsDisplay = dynamic(() => import('./ServiceCardDisplay'), { ssr: false });

const QuestionDisplay = ({ question, answer, questionType, options, optionType, courseData, packageData, fileUrls }) => {
  
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

  // FIXED: Helper to strip HTML tags and convert to plain text
  const stripHtmlTags = (html) => {
    if (!html || typeof html !== 'string') return html;
    
    // Replace common HTML tags with appropriate text equivalents
    let text = html
      .replace(/<\/p>/gi, '\n')           // Paragraphs end with newline
      .replace(/<br\s*\/?>/gi, '\n')      // Line breaks
      .replace(/<\/li>/gi, '\n')          // List items end with newline
      .replace(/<li>/gi, '• ')            // Bullet points for list items
      .replace(/<[^>]+>/g, '')            // Remove all other HTML tags
      .replace(/&nbsp;/gi, ' ')           // Replace &nbsp; with space
      .replace(/&amp;/gi, '&')            // Replace &amp; with &
      .replace(/&lt;/gi, '<')             // Replace &lt; with <
      .replace(/&gt;/gi, '>')             // Replace &gt; with >
      .replace(/&quot;/gi, '"')           // Replace &quot; with "
      .trim();                            // Remove leading/trailing whitespace
    
    // Clean up multiple newlines
    text = text.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    return text;
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

  const processCareDataForDisplay = (careAnswer) => {
    let careData = careAnswer;
    let defaultValues = null;
    let careVaries = true;
    
    if (careAnswer && typeof careAnswer === 'object' && !Array.isArray(careAnswer)) {
      if (careAnswer.careData) {
        careData = careAnswer.careData;
        defaultValues = careAnswer.defaultValues || null;
        careVaries = careAnswer.careVaries !== false;
      }
    }
    
    if (!Array.isArray(careData)) return [];
    
    // Merge defaultValues when careVaries is false
    if (!careVaries && defaultValues) {
      return careData.map(item => ({
        ...item,
        values: {
          carers: item.values?.carers || defaultValues[item.care]?.carers || '',
          time: item.values?.time || defaultValues[item.care]?.time || '',
          duration: item.values?.duration || defaultValues[item.care]?.duration || ''
        }
      }));
    }
    
    return careData;
  };

  // Helper to format care table data for display
  const formatCareTableForDisplay = (answer) => {
    let data = processCareDataForDisplay(answer);
    
    try {
      if (typeof answer === 'string') {
        data = JSON.parse(answer);
      }
      
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

  // UPDATED: Simplified FileUploadDisplay that uses pre-fetched signed URLs
  const FileUploadDisplay = ({ fileData }) => {
    if (!fileData) {
      return (
        <div className="text-sm text-gray-600">
          <File className="w-4 h-4 inline mr-2" />
          File information unavailable
        </div>
      );
    }

    const { filename, url, signedUrl, error } = fileData;
    const displayUrl = url || signedUrl;

    if (error || !displayUrl) {
      return (
        <div className="flex items-center space-x-2 text-amber-600 text-sm">
          <AlertCircle className="w-4 h-4" />
          <span>File not found: {filename}</span>
        </div>
      );
    }

    // Determine if file is an image
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
    const fileExtension = filename.split('.').pop()?.toLowerCase();
    const isImage = imageExtensions.includes(fileExtension);

    if (isImage) {
      return (
        <div className="space-y-2">
          <img 
            src={displayUrl} 
            alt={filename}
            className="max-w-full h-auto rounded-lg border border-gray-200"
            style={{ maxHeight: '400px' }}
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.nextSibling.style.display = 'flex';
            }}
          />
          <div style={{ display: 'none' }} className="flex items-center space-x-2 text-gray-600 text-sm">
            <File className="w-4 h-4" />
            <a 
              href={displayUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              {filename}
            </a>
          </div>
        </div>
      );
    }

    // For non-image files, show download link
    const getFileIcon = () => {
      if (fileExtension === 'pdf') return <FileText className="w-5 h-5 text-red-500" />;
      if (['doc', 'docx'].includes(fileExtension)) return <FileText className="w-5 h-5 text-blue-500" />;
      if (['xls', 'xlsx'].includes(fileExtension)) return <FileText className="w-5 h-5 text-green-500" />;
      return <File className="w-5 h-5 text-gray-500" />;
    };

    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 inline-flex items-center space-x-3">
        {getFileIcon()}
        <div className="flex-1">
          <a 
            href={displayUrl} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:underline font-medium text-sm"
          >
            {filename}
          </a>
          <div className="text-xs text-gray-500 mt-0.5">
            {fileExtension?.toUpperCase()} file
          </div>
        </div>
        <a 
          href={displayUrl}
          download={filename}
          className="text-blue-600 hover:text-blue-700"
          title="Download file"
        >
          <Download className="w-5 h-5" />
        </a>
      </div>
    );
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

      // FIXED: Ensure service-cards are displayed
      case 'service-cards':
      case 'service-cards-multi':
        return <ServiceCardsDisplay data={parsedAnswer} options={options} />;

      // UPDATED: Use pre-fetched file URLs from booking data
      case 'file-upload':
        if (fileUrls && fileUrls.length > 0) {
          // Use the pre-fetched signed URLs
          return (
            <div className="space-y-3">
              {fileUrls.map((fileData, idx) => (
                <FileUploadDisplay key={idx} fileData={fileData} />
              ))}
            </div>
          );
        }
        
        // Fallback: show filename if no URLs available
        if (typeof parsedAnswer === 'string') {
          return (
            <div className="text-sm text-gray-600">
              <File className="w-4 h-4 inline mr-2" />
              {parsedAnswer}
            </div>
          );
        }
        
        if (Array.isArray(parsedAnswer)) {
          return (
            <div className="space-y-2">
              {parsedAnswer.map((filename, idx) => (
                <div key={idx} className="text-sm text-gray-600">
                  <File className="w-4 h-4 inline mr-2" />
                  {filename}
                </div>
              ))}
            </div>
          );
        }
        
        return <span className="text-sm text-gray-500">No file uploaded</span>;

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
        
        // Enhanced error message when package is not found
        if (/^\d+$/.test(parsedAnswer)) {
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-900">Package Not Found</div>
                  <div className="text-xs text-amber-700 mt-1">
                    The selected package (ID: {safeStringify(parsedAnswer)}) could not be loaded. It may have been deleted or is no longer available.
                  </div>
                </div>
              </div>
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
          
          // Enhanced error message when course data is not available
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-900">Course Not Found</div>
                  <div className="text-xs text-amber-700 mt-1">
                    The selected course (ID: {safeStringify(parsedAnswer)}) could not be loaded. It may have been deleted or is no longer available.
                  </div>
                </div>
              </div>
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
          
          // Enhanced error message when package data is not available
          return (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-medium text-amber-900">Package Not Found</div>
                  <div className="text-xs text-amber-700 mt-1">
                    The selected package (ID: {safeStringify(parsedAnswer)}) could not be loaded. It may have been deleted or is no longer available.
                  </div>
                </div>
              </div>
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

  // FIXED: Clean HTML from question text
  const cleanedQuestion = stripHtmlTags(question);

  return (
    <div className="border-b border-gray-100 pb-3 mb-3 last:border-b-0 last:pb-0 last:mb-0">
      <div className="text-sm font-medium text-gray-700 mb-1 whitespace-pre-wrap">{cleanedQuestion}</div>
      <div>{formatAnswer(answer, questionType, options)}</div>
    </div>
  );
};

export default QuestionDisplay;