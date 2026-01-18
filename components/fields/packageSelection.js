import React, { useState, useEffect, useRef, useMemo } from 'react';
import { calculateCareHours, createPackageFilterCriteria, formatCareScheduleForDisplay } from '../../utilities/careHoursCalculator';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';
import { useCallback } from 'react';
import FormattedDescription from '../ui-v2/FormattedDescription';

// Simple Error Boundary for debugging
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('PackageSelection Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-medium text-red-800">Error rendering package data</h3>
          <p className="text-sm text-red-600 mt-1">{this.state.error?.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}

const PackageSelection = ({ 
  funder = null,
  selectedFunder = null,
  ndis_package_type = null,
  additionalFilters = {},
  value = null, 
  onChange, 
  required = false,
  multi = false,
  builderMode = false,
  error = null,
  className = '',
  localFilterState,
  // Enhanced care analysis props
  careAnalysisData = null,
  courseAnalysisData = null, // NEW: Course analysis data
  packageFilterCriteria = {},
  formData = {}, // All form Q&A data
  qaData = [], // Q&A pairs from booking
  // Add props to help with course detection
  allBookingData = null, // Complete booking data with all sections
  currentPage = null, // Current page data for context
  forceShowErrors = false,
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const previousValueRef = useRef(value);
  const lastFetchCriteriaRef = useRef(null);
  const abortControllerRef = useRef(null);
  const requestIdRef = useRef(0);
  const [dataReady, setDataReady] = useState(false);
  const initialLoadRef = useRef(true);
  const [stableFilterCriteria, setStableFilterCriteria] = useState(null);

  useEffect(() => {
      console.log('📦 PackageSelection received careAnalysisData:', {
          received: !!careAnalysisData,
          totalHoursPerDay: careAnalysisData?.totalHoursPerDay,
          carePattern: careAnalysisData?.carePattern,
          dataSource: careAnalysisData?.dataSource,
          hasRawData: !!careAnalysisData?.rawCareData,
          rawDataLength: careAnalysisData?.rawCareData?.length || 0
      });
  }, [careAnalysisData]);

  const shouldShowError = !builderMode && required && (
    error || 
    (forceShowErrors && (!value || (Array.isArray(value) && value.length === 0)))
  );

  const shouldShowValid = !builderMode && required && !shouldShowError && value && (
    Array.isArray(value) ? value.length > 0 : true
  );

  useEffect(() => {
    if (builderMode) {
        setDataReady(true);
        return;
    }
    
    if (initialLoadRef.current) {
        const hasFunderData = funder || localFilterState?.funderType || 
                              (formData && formData.funder) ||
                              (qaData && qaData.length > 0);
        
        const hasCareData = careAnalysisData && 
                   typeof careAnalysisData.totalHoursPerDay === 'number';
        
        if (!hasFunderData || !hasCareData) {
            console.log('📦 Waiting for critical data...');
            setDataReady(false);
            return;
        }
        
        initialLoadRef.current = false;
        setDataReady(true);
    }
  }, [builderMode, funder, localFilterState?.funderType, careAnalysisData, formData, qaData]);

  // New function to extract requirements ONLY from stable QaPairs data
  const extractGuestRequirementsFromStableData = () => {
      const requirements = {};
      
      // ONLY use qaData (which should be stable QaPairs)
      if (!qaData || qaData.length === 0) {
          console.log('⚠️ No stable QA data available for requirements extraction');
          return requirements;
      }
      
      console.log('📊 Extracting requirements from stable QA data:', qaData.length, 'items');
      
      qaData.forEach(qa => {
          if (!qa.question_key || !qa.answer) return;
          
          switch (qa.question_key) {
              case QUESTION_KEYS.FUNDING_SOURCE:
                  requirements.funder_type = qa.answer.includes('NDIS') || qa.answer.includes('NDIA') ? 'NDIS' : 'Non-NDIS';
                  console.log('💰 Funding source from stable data:', requirements.funder_type);
                  break;
              case QUESTION_KEYS.IS_STA_STATED_SUPPORT:
                  requirements.sta_in_plan = qa.answer.toLowerCase().includes('yes');
                  console.log('🏛️ STA in plan from stable data:', requirements.sta_in_plan);
                  break;
              case QUESTION_KEYS.COURSE_OFFER_QUESTION:
                  requirements.has_course = qa.answer.toLowerCase().includes('yes');
                  console.log('🎓 Course offer from stable data:', requirements.has_course);
                  break;
              case QUESTION_KEYS.WHICH_COURSE:
                  if (qa.answer && qa.answer.trim() !== '' && qa.answer.toLowerCase() !== 'no') {
                      requirements.has_course = true;
                      console.log('🎓 Course selection from stable data:', qa.answer);
                  }
                  break;
          }
      });
      
      console.log('🎯 Final requirements from stable QA data:', requirements);
      return requirements;
  };

  // Helper function to create a stable hash of criteria
  const createCriteriaHash = (criteria) => {
      const hashable = {
          funder_type: criteria.funder_type,
          ndis_package_type: criteria.ndis_package_type,
          care_hours: criteria.care_hours,
          has_course: criteria.has_course,
          course_offered: criteria.course_offered,
          sta_in_plan: criteria.sta_in_plan
      };
      return JSON.stringify(hashable);
  };
  
  // Safe render helper to prevent object rendering errors
  const safeRender = (value, fallback = 'N/A') => {
    if (value === null || value === undefined) return fallback;
    if (typeof value === 'string' || typeof value === 'number') return value;
    if (typeof value === 'boolean') return value.toString();
    return JSON.stringify(value);
  };

  const isMounted = useRef(true);
  const fetchTimeout = useRef(null);

  // Helper function to extract guest requirements from form data
  const extractGuestRequirements = () => {
    const requirements = {};
    
    // FIXED: Funding source detection with correct priority
    let fundingAnswer = null;
    
    // Priority 1: Use formData.isNdisFunded if available (most authoritative)
    if (typeof formData.isNdisFunded === 'boolean') {
      fundingAnswer = formData.isNdisFunded ? 'NDIS' : 'Non-NDIS';
      requirements.funder_type = formData.isNdisFunded ? 'NDIS' : 'Non-NDIS';
    }
    // Priority 2: Check the funding question answer
    else {
      fundingAnswer = getAnswerByQuestionKey('how-will-your-stay-be-funded');
      if (fundingAnswer) {
        requirements.funder_type = fundingAnswer.includes('NDIS') || fundingAnswer.includes('NDIA') ? 'NDIS' : 'Non-NDIS';
      }
      // Priority 3: Fallback to formData.funder (least reliable for NDIS detection)
      else if (formData.funder) {
        fundingAnswer = formData.funder;
        requirements.funder_type = fundingAnswer.includes('NDIS') || fundingAnswer.includes('NDIA') ? 'NDIS' : 'Non-NDIS';
      }
    }
    
    // Course participation - USE COURSE ANALYSIS DATA FIRST
    let hasCourse = false;
    
    if (courseAnalysisData) {
      // Use the dedicated course analysis data
      hasCourse = courseAnalysisData.hasCourse || courseAnalysisData.courseOffered;
      console.log('🎓 Using course analysis data:', {
        hasCourse: courseAnalysisData.hasCourse,
        courseOffered: courseAnalysisData.courseOffered,
        courseId: courseAnalysisData.courseId,
        finalHasCourse: hasCourse
      });
    } else {
      // Fallback to old detection methods (keep existing logic as fallback)
      let courseOfferAnswer = getAnswerByQuestionKey('have-you-been-offered-a-place-in-a-course-for-this-stay');
      let whichCourseAnswer = getAnswerByQuestionKey('which-course');
      
      // Fallback: try alternative question key patterns
      if (!courseOfferAnswer) {
        courseOfferAnswer = getAnswerByQuestionKey('course-offer') || 
                           getAnswerByQuestionKey('course-participation') ||
                           getAnswerByQuestionKey('offered-course');
      }
      
      if (!whichCourseAnswer) {
        whichCourseAnswer = getAnswerByQuestionKey('course-selection') ||
                           getAnswerByQuestionKey('selected-course') ||
                           getAnswerByQuestionKey('course-name');
      }
      
      // Additional fallback: search by question text patterns
      if (!courseOfferAnswer && !whichCourseAnswer) {
        // console.log('🔍 Trying to find course answers by question text patterns...');
        
        // Check all available data sources for course-related questions
        const allQAData = [];
        
        // Add current page QA data
        if (qaData && qaData.length > 0) {
          allQAData.push(...qaData);
        }
        
        // Add data from allBookingData if available
        if (allBookingData && allBookingData.sections) {
          for (const section of allBookingData.sections) {
            if (section.QaPairs) {
              allQAData.push(...section.QaPairs);
            }
          }
        }
        
        // Add data from formData if structured differently
        if (formData && formData.sections) {
          for (const section of formData.sections) {
            if (section.QaPairs) {
              allQAData.push(...section.QaPairs);
            }
          }
        }
        
        // Look for questions containing "course" in the text
        const courseRelatedQA = allQAData.filter(qa => 
          qa.question && qa.question.toLowerCase().includes('course') && qa.answer
        );
        
        // Try to find course offer question
        const offerQA = courseRelatedQA.find(qa => 
          qa.question.toLowerCase().includes('offered') || 
          qa.question.toLowerCase().includes('place')
        );
        if (offerQA) {
          courseOfferAnswer = offerQA.answer;
          // console.log('✅ Found course offer by text pattern:', courseOfferAnswer);
        }
        
        // Try to find which course question
        const whichQA = courseRelatedQA.find(qa => 
          qa.question.toLowerCase().includes('which') || 
          qa.question.toLowerCase().includes('what') ||
          qa.question.toLowerCase().includes('select')
        );
        if (whichQA) {
          whichCourseAnswer = whichQA.answer;
          // console.log('✅ Found which course by text pattern:', whichCourseAnswer);
        }
      }
      
      // Check course offer answer
      if (courseOfferAnswer) {
        hasCourse = courseOfferAnswer.toLowerCase().includes('yes');
      }
      
      // Check which course answer (any non-empty, non-"no" answer indicates a course)
      if (whichCourseAnswer && 
          whichCourseAnswer.trim() !== '' && 
          whichCourseAnswer.toLowerCase() !== 'no' &&
          whichCourseAnswer !== '0' &&
          whichCourseAnswer !== 'false') {
        hasCourse = true;
        // console.log('✅ Course detected from which-course answer:', whichCourseAnswer);
      }
      
      // console.log('🎓 Fallback course detection:', {
      //   courseOfferAnswer,
      //   whichCourseAnswer,
      //   hasCourse
      // });
    }
    
    requirements.has_course = hasCourse;
    
    console.log('🎯 Final course detection:', {
      hasCourse,
      fundingAnswer,
      funderType: requirements.funder_type
    });
    
    // NDIS specific requirements
    if (requirements.funder_type === 'NDIS') {
      const staAnswer = getAnswerByQuestionKey('is-sta-a-stated-support-in-your-plan') || 
                      getAnswerByQuestionKey('is-short-term-accommodation-including-respite-a-stated-support-in-your-plan');
      if (staAnswer) {
          requirements.sta_in_plan = staAnswer.toLowerCase().includes('yes');
          requirements.ndis_package_type = 'sta'; // STA takes precedence
      } else {
          // Use the new determination logic
          requirements.ndis_package_type = determineNdisPackageTypeFromQuestions(qaData, careAnalysis);
      }
  }
    
    console.log('🎯 Final extracted guest requirements:', requirements);
    return requirements;
  };

  const determineNdisPackageTypeFromQuestions = (questions, careAnalysis) => {
      // Check for holiday conditions first
      let isHolidayType = false;
      
      if (!questions || !Array.isArray(questions)) {
          return 'sta'; // Default fallback
      }
      
      questions.forEach(qa => {
          if (!qa || !qa.question_key || !qa.answer) return;
          
          // Check for holiday-indicating questions
          if (['do-you-live-alone', 'do-you-live-in-sil', 'are-you-staying-with-informal-supports'].includes(qa.question_key) &&
              qa.answer.toLowerCase().includes('yes')) {
              isHolidayType = true;
          }
      });
      
      // If it's a holiday type, determine if plus or regular based on care
      if (isHolidayType) {
          const careHours = careAnalysis?.totalHoursPerDay || 0;
          const requiresCare = careAnalysis?.requiresCare && careHours > 0;
          
          return requiresCare ? 'holiday-plus' : 'holiday';
      }
      
      // Default to STA if not holiday type
      return 'sta';
  };

  // Helper function to get answer by question key from ALL booking data
  const getAnswerByQuestionKey = (questionKey) => {
    // Strategy 1: Try qaData first (current page QA pairs)
    if (qaData && qaData.length > 0) {
      // console.log(`📊 Current page QA Data:`, qaData.map(q => ({
      //   question: q.question?.substring(0, 50) + '...',
      //   question_key: q.question_key,
      //   answer: q.answer,
      //   hasAnswer: !!q.answer
      // })));
      
      const qa = qaData.find(q => q.question_key === questionKey);
      if (qa) {
        // console.log(`✅ Found in current page qaData:`, qa.answer);
        return qa.answer;
      }
    }
    
    // Strategy 2: Access global form data through window or other global sources
    if (typeof window !== 'undefined' && window.bookingFormData) {
      // console.log(`🌍 Checking global booking form data...`);
      // Check if there's global booking data available
      if (window.bookingFormData.sections) {
        for (const section of window.bookingFormData.sections) {
          if (section.QaPairs) {
            for (const qaPair of section.QaPairs) {
              if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                // console.log(`✅ Found in global booking data:`, qaPair.answer);
                return qaPair.answer;
              }
            }
          }
        }
      }
    }
    
    // Strategy 3: Try formData structure variations
    if (formData && typeof formData === 'object') {
      // console.log(`📋 Form Data structure:`, {
      //   keys: Object.keys(formData),
      //   funder: formData.funder,
      //   isNdisFunded: formData.isNdisFunded,
      //   hasBookingData: !!(formData.booking || formData.sections || formData.allPages),
      //   careAnalysisType: typeof formData.careAnalysis
      // });
      
      // Direct key lookup
      if (formData[questionKey]) {
        // console.log(`✅ Found direct key in formData:`, formData[questionKey]);
        return formData[questionKey];
      }
      
      // Check if formData contains booking data structure
      if (formData.booking) {
        // console.log(`📋 Found booking data in formData`);
        // If booking data is structured like the API response
        if (formData.booking.sections && Array.isArray(formData.booking.sections)) {
          for (const section of formData.booking.sections) {
            if (section.QaPairs && Array.isArray(section.QaPairs)) {
              for (const qaPair of section.QaPairs) {
                if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                  // console.log(`✅ Found in formData.booking:`, qaPair.answer);
                  return qaPair.answer;
                }
              }
            }
          }
        }
      }
      
      // Check sections directly in formData
      if (formData.sections && Array.isArray(formData.sections)) {
        // console.log(`📂 Searching through ${formData.sections.length} form sections`);
        for (const section of formData.sections) {
          if (section.QaPairs && Array.isArray(section.QaPairs)) {
            for (const qaPair of section.QaPairs) {
              if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                // console.log(`✅ Found in formData.sections:`, qaPair.answer);
                return qaPair.answer;
              }
            }
          }
          
          // Also check if section has questions array
          if (section.questions && Array.isArray(section.questions)) {
            for (const question of section.questions) {
              if (question.question_key === questionKey && question.answer) {
                // console.log(`✅ Found in section questions:`, question.answer);
                return question.answer;
              }
            }
          }
        }
      }
      
      // Strategy 4: Check if formData has aggregated answers
      if (formData.answers && typeof formData.answers === 'object') {
        if (formData.answers[questionKey]) {
          // console.log(`✅ Found in formData.answers:`, formData.answers[questionKey]);
          return formData.answers[questionKey];
        }
      }
    }
    
    // Strategy 5: Use known course information from props/context
    // If we know this is about courses and we have course-related props
    if (questionKey === 'which-course' && restProps.selectedCourse) {
      // console.log(`✅ Found course from props:`, restProps.selectedCourse);
      return restProps.selectedCourse;
    }
    
    console.log(`❌ Not found anywhere: "${questionKey}"`);
    return null;
  };

  // Enhanced care analysis
  const careAnalysis = useMemo(() => {
    // If careAnalysisData is already processed and has the required properties, use it directly
    if (careAnalysisData && typeof careAnalysisData === 'object' && 
        careAnalysisData.hasOwnProperty('totalHoursPerDay')) {
      
      // console.log('🏥 Using pre-processed care analysis data:', careAnalysisData);
      
      // If it has raw care data, we could re-process if needed, but usually just use the processed data
      if (careAnalysisData.rawCareData) {
          // console.log('🔄 Re-processing care data from rawCareData');
          
          // 🔧 FIX: Handle both array and nested structure
          let careDataArray = careAnalysisData.rawCareData;
          if (!Array.isArray(careDataArray) && careDataArray.careData) {
              // console.log('🔄 Extracting careData from nested rawCareData');
              careDataArray = careDataArray.careData;
          }
          
          if (Array.isArray(careDataArray)) {
              const analysis = calculateCareHours(careDataArray);
              return {
                  requiresCare: analysis.totalHoursPerDay > 0,
                  ...analysis,
                  rawCareData: careDataArray
              };
          }
      }
      
      // Use the already processed data as-is
      return {
        requiresCare: careAnalysisData.requiresCare || careAnalysisData.totalHoursPerDay > 0,
        totalHoursPerDay: careAnalysisData.totalHoursPerDay || 0,
        carePattern: careAnalysisData.carePattern || 'no-care',
        recommendedPackages: careAnalysisData.recommendedPackages || [],
        analysis: careAnalysisData.analysis || 'Care analysis provided',
        rawCareData: careAnalysisData.rawCareData || null
      };
    }

    // Fallback: try to find raw care data from qaData or formData
    if (!formData || Object.keys(formData).length === 0) {
      console.log('⚠️ No careAnalysisData and no formData available');
      return {
        requiresCare: false,
        totalHoursPerDay: 0,
        carePattern: 'no-care',
        recommendedPackages: []
      };
    }

    try {
      // Look for raw care schedule data in qaData
      const careScheduleQA = findByQuestionKey(qaData || [], QUESTION_KEYS.WHEN_DO_YOU_REQUIRE_CARE);
      
      if (!careScheduleQA || !careScheduleQA.answer) {
        console.log('⚠️ No care schedule found in qaData');
        return {
          requiresCare: false,
          totalHoursPerDay: 0,
          carePattern: 'no-care',
          recommendedPackages: []
        };
      }

      // Parse the raw care schedule data
      const rawCareData = typeof careScheduleQA.answer === 'string' 
        ? JSON.parse(careScheduleQA.answer) 
        : careScheduleQA.answer;

      console.log('🏥 Raw care data from qaData:', rawCareData);

      // 🔧 FIX: Extract the care data array - handle both formats:
      // Format 1: Direct array: [{ care: 'morning', date: '...', values: {...} }, ...]
      // Format 2: Nested object: { careData: [...], defaultValues: {...} }
      let careDataArray = rawCareData;

      if (rawCareData && typeof rawCareData === 'object' && !Array.isArray(rawCareData)) {
        if (Array.isArray(rawCareData.careData)) {
          console.log('🔄 Extracting careData array from nested structure');
          careDataArray = rawCareData.careData;
        } else {
          console.warn('⚠️ Care data object has no careData array:', Object.keys(rawCareData));
          return {
            requiresCare: false,
            totalHoursPerDay: 0,
            carePattern: 'no-care',
            recommendedPackages: []
          };
        }
      }

      // Validate that we have an array now
      if (!Array.isArray(careDataArray)) {
        console.warn('⚠️ Final care data is not an array:', typeof careDataArray);
        return {
          requiresCare: false,
          totalHoursPerDay: 0,
          carePattern: 'no-care',
          recommendedPackages: []
        };
      }

      console.log(`✅ Processing ${careDataArray.length} care entries`);
      const analysis = calculateCareHours(careDataArray);
      
      console.log('🏥 Calculated care analysis from raw data:', {
        totalHours: analysis.totalHoursPerDay,
        pattern: analysis.carePattern,
        recommended: analysis.recommendedPackages,
        dataLength: rawCareData.length
      });

      return {
        requiresCare: true,
        ...analysis,
        rawCareData: rawCareData
      };
    } catch (error) {
      console.error('❌ Error parsing care data in PackageSelection:', error);
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-error',
        recommendedPackages: [],
        analysis: 'Error parsing care schedule data'
      };
    }
  }, [careAnalysisData, formData, qaData]);

  // Build comprehensive filter criteria
  const enhancedFilterCriteria = useMemo(() => {
    console.log('📦 Calculating filter criteria with:', {
        careHours: careAnalysisData?.totalHoursPerDay,
        hasCourse: courseAnalysisData?.hasCourse,
        courseOffered: courseAnalysisData?.courseOffered,
        funderType: localFilterState?.funderType || funder
    });
    
    const baseCriteria = packageFilterCriteria || createPackageFilterCriteria(careAnalysisData?.rawCareData || []);
    
    const guestRequirements = extractGuestRequirementsFromStableData();
    
    const criteria = {
        ...baseCriteria,
        ...guestRequirements,
        
        funder_type: localFilterState?.funderType || guestRequirements.funder_type || funder,
        ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type || ndis_package_type,
        
        // CRITICAL: Always use current careAnalysisData
        care_hours: careAnalysisData ? Math.ceil(careAnalysisData.totalHoursPerDay || 0) : 0,
        care_pattern: careAnalysisData ? careAnalysisData.carePattern : 'no-care',
        recommended_packages: careAnalysisData ? (careAnalysisData.recommendedPackages || []) : [],
        
        // CRITICAL: Always use current courseAnalysisData  
        has_course: courseAnalysisData ? (courseAnalysisData.hasCourse || courseAnalysisData.courseOffered) : false,
        course_offered: courseAnalysisData ? courseAnalysisData.courseOffered : false,
        course_id: courseAnalysisData ? courseAnalysisData.courseId : null,
        
        ...additionalFilters
    };

    console.log('🎯 Calculated filter criteria:', criteria);
    return criteria;
  }, [
      // CRITICAL: Depend on the actual data objects' key properties
      careAnalysisData?.totalHoursPerDay,
      careAnalysisData?.carePattern,
      careAnalysisData?.dataSource, // Add this to detect when data source changes
      courseAnalysisData?.hasCourse,
      courseAnalysisData?.courseOffered,
      courseAnalysisData?.courseId,
      localFilterState?.funderType,
      localFilterState?.ndisPackageType,
      funder,
      ndis_package_type,
      packageFilterCriteria,
      additionalFilters,
      builderMode
  ]);

  // Enhanced applyPackageRequirementFiltering function with detailed logging
  const applyPackageRequirementFiltering = (packages, criteria) => {
      console.log('🔧 Applying PackageRequirement filtering with criteria:', criteria);
      console.log('🔧 Packages before filtering:', packages.map(p => ({ 
          code: p.package_code, 
          name: p.name, 
          hasRequirement: !!p.requirement,
          requirementPreview: p.requirement ? {
              requires_no_care: p.requirement.requires_no_care,
              care_hours_min: p.requirement.care_hours_min,
              care_hours_max: p.requirement.care_hours_max,
              requires_course: p.requirement.requires_course,
              compatible_with_course: p.requirement.compatible_with_course
          } : 'NO REQUIREMENT DATA'
      })));
      
      const filtered = packages.filter(pkg => {
          // Skip packages without requirements data
          if (!pkg.requirement) {
              console.log(`⚠️ Package ${pkg.package_code} has no requirements data, keeping by default`);
              return true;
          }

          const req = pkg.requirement;
          console.log(`🔍 Detailed check for package ${pkg.package_code}:`, {
              packageName: pkg.name,
              requirements: {
                  requires_no_care: req.requires_no_care,
                  care_hours_min: req.care_hours_min,
                  care_hours_max: req.care_hours_max,
                  requires_course: req.requires_course,
                  compatible_with_course: req.compatible_with_course
              },
              guestCriteria: {
                  care_hours: criteria.care_hours,
                  has_course: criteria.has_course,
                  course_offered: criteria.course_offered
              }
          });

          // 1. Check care requirements with detailed logging
          const careHours = criteria.care_hours || 0;
          
          console.log(`   🏥 Care Analysis for ${pkg.package_code}:`);
          console.log(`      Guest care hours: ${careHours}`);
          console.log(`      Package requires_no_care: ${req.requires_no_care}`);
          console.log(`      Package care_hours_min: ${req.care_hours_min}`);
          console.log(`      Package care_hours_max: ${req.care_hours_max}`);

          // If package requires care (requires_no_care: false) but guest has 0 care hours, exclude it
          if (req.requires_no_care === false && careHours === 0) {
              console.log(`❌ Excluding ${pkg.package_code}: requires care but guest has 0 care hours`);
              return false;
          }
          
          // If package requires no care, guest must have 0 care hours
          if (req.requires_no_care === true && careHours > 0) {
              console.log(`   ❌ ${pkg.package_code} REJECTED: Package requires no care but guest needs ${careHours}h care`);
              return false;
          }
          
          // If package requires no care and guest has no care - this should PASS
          if (req.requires_no_care === true && careHours === 0) {
              console.log(`   ✅ ${pkg.package_code} CARE MATCH: Package requires no care and guest has no care`);
          }

          // Check care hours range (only if package doesn't require no care)
          if (req.requires_no_care !== true) {
              if (req.care_hours_min !== null && careHours < req.care_hours_min) {
                  console.log(`   ❌ ${pkg.package_code} REJECTED: Package requires min ${req.care_hours_min}h but guest only needs ${careHours}h`);
                  return false;
              }

              if (req.care_hours_max !== null && careHours > req.care_hours_max) {
                  console.log(`   ❌ ${pkg.package_code} REJECTED: Package allows max ${req.care_hours_max}h but guest needs ${careHours}h`);
                  return false;
              }
          }

          // 2. Check course requirements with detailed logging
          const hasCourse = criteria.has_course || false;
          const courseOffered = criteria.course_offered || false;
          
          console.log(`   🎓 Course Analysis for ${pkg.package_code}:`);
          console.log(`      Guest has_course: ${hasCourse}`);
          console.log(`      Guest course_offered: ${courseOffered}`);
          console.log(`      Package requires_course: ${req.requires_course}`);
          console.log(`      Package compatible_with_course: ${req.compatible_with_course}`);
          
          // If package requires a course, guest must have one
          if (req.requires_course === true && !hasCourse && !courseOffered) {
              console.log(`   ❌ ${pkg.package_code} REJECTED: Package requires course but guest has no course`);
              return false;
          }

          // If package forbids courses (requires_course = false), guest must not have one
          if (req.requires_course === false && (hasCourse || courseOffered)) {
              console.log(`   ❌ ${pkg.package_code} REJECTED: Package forbids courses but guest has a course`);
              return false;
          }
          
          // If package forbids courses and guest has no course - this should PASS
          if (req.requires_course === false && !hasCourse && !courseOffered) {
              console.log(`   ✅ ${pkg.package_code} COURSE MATCH: Package forbids courses and guest has no course`);
          }

          // If package is not compatible with courses, guest must not have one
          if (req.compatible_with_course === false && (hasCourse || courseOffered)) {
              console.log(`   ❌ ${pkg.package_code} REJECTED: Package is not compatible with courses but guest has a course`);
              return false;
          }

          // 3. Check STA requirements for NDIS packages
          if (pkg.funder === 'NDIS' && req.sta_requirements) {
              try {
                  const staReq = typeof req.sta_requirements === 'string' 
                      ? JSON.parse(req.sta_requirements) 
                      : req.sta_requirements;
                  
                  const staInPlan = criteria.sta_in_plan;
                  console.log(`   🏛️ STA Analysis for ${pkg.package_code}:`, {
                      guestStaInPlan: staInPlan,
                      packageStaRequirements: staReq
                  });
                  
                  if (staReq.requires_sta_in_plan === true && staInPlan === false) {
                      console.log(`   ❌ ${pkg.package_code} REJECTED: Package requires STA in plan but guest doesn't have it`);
                      return false;
                  }
                  if (staReq.requires_sta_in_plan === false && staInPlan === true) {
                      console.log(`   ❌ ${pkg.package_code} REJECTED: Package doesn't allow STA in plan but guest has it`);
                      return false;
                  }
              } catch (error) {
                  console.warn(`   ⚠️ Error parsing STA requirements for ${pkg.package_code}:`, error);
              }
          }

          console.log(`   ✅ ${pkg.package_code} PASSES all requirement checks`);
          return true;
      });

      console.log('🔧 PackageRequirement filtering results:', {
          beforeCount: packages.length,
          afterCount: filtered.length,
          filteredOut: packages.filter(p => !filtered.includes(p)).map(p => ({
              code: p.package_code,
              name: p.name,
              reason: 'Check logs above for specific rejection reason'
          })),
          remaining: filtered.map(p => p.package_code)
      });
      
      // Special focus on WS package for debugging
      const wsPackage = packages.find(p => p.package_code === 'WS');
      const wsFiltered = filtered.find(p => p.package_code === 'WS');
      
      if (wsPackage) {
          console.log('🔍 SPECIAL FOCUS - WS Package Analysis:', {
              wasIncluded: !!wsFiltered,
              hasRequirementData: !!wsPackage.requirement,
              requirementData: wsPackage.requirement,
              guestCriteria: {
                  care_hours: criteria.care_hours,
                  has_course: criteria.has_course,
                  course_offered: criteria.course_offered
              },
              expectedMatch: 'Should PASS if requires_no_care=true and guest has 0 care, requires_course=false and guest has no course'
          });
      }
      
      return filtered;
  };

  const fetchPackages = useCallback(async (forceFetch = false) => {
    // Cancel any previous pending request
    if (abortControllerRef.current) {
        console.log('📦 Cancelling previous request');
        abortControllerRef.current.abort();
    }

    // Clear packages immediately to prevent showing stale data
    setPackages([]);
    
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const currentRequestId = ++requestIdRef.current;
    
    console.log(`📦 Fetching packages #${currentRequestId} with:`, {
        funder_type: enhancedFilterCriteria.funder_type,
        ndis_package_type: enhancedFilterCriteria.ndis_package_type,
        care_hours: enhancedFilterCriteria.care_hours,
        has_course: enhancedFilterCriteria.has_course,
        course_offered: enhancedFilterCriteria.course_offered
    });

    try {
        setLoading(true);
        setFetchError(null);

        const needsAdvancedFiltering = enhancedFilterCriteria.care_hours > 0;
        let response;

        if (needsAdvancedFiltering) {
            console.log('🔍 Using advanced package filtering');
            response = await fetch('/api/packages/filter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...enhancedFilterCriteria,
                    include_requirements: true,
                    debug: false
                }),
                signal
            });
        } else {
            console.log('🔍 Using basic package filtering');
            const params = new URLSearchParams();
            if (enhancedFilterCriteria.funder_type) params.set('funder', enhancedFilterCriteria.funder_type);
            if (enhancedFilterCriteria.ndis_package_type) params.set('ndis_package_type', enhancedFilterCriteria.ndis_package_type);
            params.set('include_requirements', 'true');

            response = await fetch(`/api/packages?${params.toString()}`, { signal });
        }

        if (signal.aborted || currentRequestId !== requestIdRef.current) {
            console.log(`📦 Request #${currentRequestId} aborted/stale`);
            return;
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();

        if (currentRequestId !== requestIdRef.current) {
            console.log(`📦 Request #${currentRequestId} stale, ignoring`);
            return;
        }

        if (data.success && data.packages) {
            let fetchedPackages = data.packages.map(pkg => ({
                ...pkg,
                formattedPrice: pkg.funder === 'NDIS'
                    ? 'NDIS Funded'
                    : selectedFunder === 'icare' || selectedFunder === 'iCare'
                        ? 'iCare Funded'
                        : `$${parseFloat(pkg.price || 0).toFixed(2)}`,
                summary: pkg.description ?
                    (pkg.description.length > 100 ? pkg.description.substring(0, 100) + '...' : pkg.description) :
                    'Package details available',
                ndis_line_items: Array.isArray(pkg.ndis_line_items) ? pkg.ndis_line_items : [],
                inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
                features: Array.isArray(pkg.features) ? pkg.features : [],
                hasRequirement: !!(pkg.requirement && typeof pkg.requirement === 'object')
            }));

            fetchedPackages = applyPackageRequirementFiltering(fetchedPackages, enhancedFilterCriteria);

            // Sort packages
            fetchedPackages.sort((a, b) => {
                const careHours = enhancedFilterCriteria.care_hours || 0;
                if (careHours === 0) {
                    const aIsNoCarePerfect = a.requirement?.requires_no_care === true;
                    const bIsNoCarePerfect = b.requirement?.requires_no_care === true;
                    if (aIsNoCarePerfect && !bIsNoCarePerfect) return -1;
                    if (!aIsNoCarePerfect && bIsNoCarePerfect) return 1;
                }
                if (a.isRecommended && !b.isRecommended) return -1;
                if (!a.isRecommended && b.isRecommended) return 1;
                if (a.matchScore !== undefined && b.matchScore !== undefined) {
                    if (a.matchScore !== b.matchScore) return b.matchScore - a.matchScore;
                }
                return (a.name || '').localeCompare(b.name || '');
            });

            console.log(`📦 Setting ${fetchedPackages.length} packages`);

            if (!builderMode && fetchedPackages.length > 0) {
                const bestMatch = fetchedPackages[0];
                console.log(`🏆 Auto-selecting: ${bestMatch.name} (${bestMatch.package_code})`);
                if (onChange && value !== bestMatch.id) {
                    onChange(bestMatch.id);
                    setAutoSelected(true);
                }
                setPackages([bestMatch]);
            } else {
                setPackages(fetchedPackages);
            }
        } else {
            throw new Error(data.message || 'Failed to fetch packages');
        }
    } catch (error) {
        if (error.name === 'AbortError') {
            console.log(`📦 Request #${currentRequestId} aborted`);
            return;
        }
        console.error('❌ Error fetching packages:', error);
        setFetchError(error.message);
        setPackages([]);
    } finally {
        if (currentRequestId === requestIdRef.current) {
            setLoading(false);
        }
    }
  }, [
      enhancedFilterCriteria,
      builderMode,
      onChange,
      value,
      selectedFunder,
      applyPackageRequirementFiltering
  ]);

  // Fetch packages when component mounts or criteria changes
  useEffect(() => {
    if (!dataReady && !builderMode) {
        console.log('⏳ Skipping fetch - data not ready');
        return;
    }
    
    if (!builderMode && !enhancedFilterCriteria.funder_type) {
        console.log('⏳ Skipping fetch - no funder type');
        return;
    }

    console.log('🔄 Triggering fetch due to criteria change:', enhancedFilterCriteria);
    fetchPackages();

    return () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
    };
  }, [
      dataReady,
      JSON.stringify({
          funder_type: enhancedFilterCriteria.funder_type,
          ndis_package_type: enhancedFilterCriteria.ndis_package_type,
          care_hours: enhancedFilterCriteria.care_hours,
          has_course: enhancedFilterCriteria.has_course,
          course_offered: enhancedFilterCriteria.course_offered
      }),
      builderMode
  ]);

  useEffect(() => {
      if (!builderMode && packages.length === 1 && onChange && !value && !autoSelected) {
          const bestMatch = packages[0];
          onChange(bestMatch.id);
          setAutoSelected(true);
          console.log('✅ Auto-selected single package:', bestMatch.id);
      }
  }, [packages, value, autoSelected, builderMode, onChange]);

  // Track value changes to prevent unnecessary auto-selection
  useEffect(() => {
      if (value !== previousValueRef.current) {
          console.log('📦 Package selection value changed externally:', {
              from: previousValueRef.current,
              to: value
          });
          
          // If value was cleared (set to null), reset auto-selection flag
          if (!value && previousValueRef.current) {
              console.log('📦 Selection cleared - resetting auto-selection flag');
              setAutoSelected(false);
          }
          
          previousValueRef.current = value;
      }
  }, [value]);

  useEffect(() => {
    return () => {
        isMounted.current = false;
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        // FIX: Reset these on unmount so next mount starts fresh
        initialLoadRef.current = true;
        lastFetchCriteriaRef.current = null;
    };
  }, []);

  // Handle pre-population when value is provided (package ID from saved form)
  useEffect(() => {
    if (value && packages.length > 0) {
      const selectedPackageId = Array.isArray(value) ? value[0] : value;
      const selectedPackage = packages.find(p => p.id == selectedPackageId);
      
      if (selectedPackage) {
        console.log('📦 Pre-populated with package:', selectedPackage.name);
        setAutoSelected(true); // Prevent auto-selection from overriding
      } else {
        console.log('📦 Warning: Could not find package with ID:', selectedPackageId);
      }
    }
  }, [value, packages]);

  // Auto-select package when available and no selection exists
  useEffect(() => {
    // Auto-select package when available and no selection exists
    if (!builderMode && !value && packages.length === 1 && !autoSelected && onChange) {
      const pkg = packages[0];
      console.log('🔄 Auto-selecting package:', {
        name: pkg.name,
        id: pkg.id,
        funder: pkg.funder,
        packageCode: pkg.package_code
      });
      
      setTimeout(() => {
        onChange(pkg.id);
        setAutoSelected(true);
      }, 200);
    }
  }, [packages, value, autoSelected, builderMode, onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Check if package is selected (value is now package ID, not full object)
  const isPackageSelected = (pkg) => {
    if (multi) {
      const result = Array.isArray(value) && value.includes(pkg.id);
      return result;
    }
    const result = value == pkg.id; // Use == to handle string/number comparison
    return result;
  };

  const handlePackageClick = (pkg) => {
    if (builderMode) return;
    
    if (multi) {
      const currentValue = Array.isArray(value) ? value : [];
      if (currentValue.includes(pkg.id)) {
        // Remove from selection
        const newValue = currentValue.filter(id => id !== pkg.id);
        onChange(newValue);
      } else {
        // Add to selection
        onChange([...currentValue, pkg.id]);
      }
    } else {
      // Single selection
      if (value === pkg.id) {
        // Deselect if clicking the same package
        onChange(null);
      } else {
        // Select new package
        onChange(pkg.id);
      }
    }
  };

  // ✅ NEW: Reset auto-selection when NDIS package type changes
  useEffect(() => {
      if (localFilterState?.ndisPackageType && stableFilterCriteria?.ndis_package_type) {
          if (localFilterState.ndisPackageType !== stableFilterCriteria.ndis_package_type) {
              console.log('📦 NDIS package type changed, resetting auto-selection:', {
                  from: stableFilterCriteria.ndis_package_type,
                  to: localFilterState.ndisPackageType
              });
              setAutoSelected(false);
              setStableFilterCriteria(null); // Force recalculation
          }
      }
  }, [localFilterState?.ndisPackageType]);

  // Unified Package Card Component
  const renderPackageCard = (pkg) => {
    const isSelected = isPackageSelected(pkg) || (!builderMode && packages.length === 1);
    const isNdis = pkg.funder === 'NDIS';
    
    return (
      <div
        key={pkg.id}
        onClick={() => handlePackageClick(pkg)}
        className={`relative rounded-lg overflow-hidden transition-all duration-200 ${
          builderMode 
            ? 'cursor-default' 
            : 'cursor-pointer hover:shadow-md'
        } ${
          isSelected
            ? 'ring-2 ring-green-500 shadow-lg'
            : 'ring-1 ring-gray-200 hover:ring-gray-300'
        }`}
      >
        {/* Package Image */}
        <div className="relative h-48 bg-gray-200">
          {pkg.image_filename ? (
            <img 
              src={`/images/packages/${pkg.image_filename}`} 
              alt={pkg.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200">
              <div className="text-center text-gray-600">
                <svg className="w-16 h-16 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path>
                </svg>
                <p className="text-sm font-medium">Package Image</p>
              </div>
            </div>
          )}
          
          {/* Selection Indicator Overlay */}
          {isSelected && (
            <div className="absolute top-3 right-3 w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            </div>
          )}
        </div>

        {/* Package Content */}
        <div className="p-6 bg-white">
          {/* Package Header */}
          <div className="mb-4">
            <h3 className="text-xl font-bold text-gray-900 mb-2">
              {safeRender(pkg.name, 'Package Name')}
            </h3>
            
            <div className="flex items-center justify-between mb-3">
              <span 
                className="text-sm bg-gray-100 px-2 py-1 rounded"
                style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}
              >
                {safeRender(pkg.package_code, 'N/A')}
              </span>
            </div>
            {console.log("FUNDER: ", selectedFunder)}
            {selectedFunder !== 'icare' && selectedFunder !== 'iCare' && (
              <div className="text-2xl font-bold text-gray-900">
                {safeRender(pkg.formattedPrice, 'Price not available')}
              </div>
            )}
          </div>

          {/* Package Details */}
          <div className="space-y-4">
            {/* NDIS-specific footer note */}
            {isNdis && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  <p className="text-xs text-blue-700">
                    This package includes NDIS funded support and non NDIS funded accomodation. Further information will be shown on your Summary of Stay.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Group packages by funder type for display
  const groupedPackages = useMemo(() => {
    const groups = {
      'NDIS': packages.filter(pkg => pkg.funder === 'NDIS'),
      'Non-NDIS': packages.filter(pkg => pkg.funder !== 'NDIS')
    };
    
    // Sort NDIS packages by recommended packages first, then by name
    if (groups['NDIS'].length > 0) {
      groups['NDIS'].sort((a, b) => {
        const aRecommended = careAnalysis.recommendedPackages?.includes(a.package_code);
        const bRecommended = careAnalysis.recommendedPackages?.includes(b.package_code);
        
        if (aRecommended && !bRecommended) return -1;
        if (!aRecommended && bRecommended) return 1;
        return a.name.localeCompare(b.name);
      });
    }
    
    return groups;
  }, [packages, careAnalysis.recommendedPackages]);

  // Render loading state
  if (loading && packages.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {builderMode 
              ? "Loading all packages..." 
              : "Finding packages suited to your needs..."
            }
          </p>
          {!builderMode && careAnalysis.totalHoursPerDay > 0 && (
            <p className="text-sm text-gray-500 mt-1">
              Analyzing {careAnalysis.totalHoursPerDay}h daily care requirements
            </p>
          )}
          {!builderMode && courseAnalysisData && courseAnalysisData.hasCourse && (
            <p className="text-sm text-gray-500 mt-1">
              Course participation detected
            </p>
          )}
        </div>
      </div>
    );
  }

  // Render error state
  if (fetchError) {
    return (
      <div className="p-6 border-2 border-red-300 rounded-lg bg-red-50">
        <div className="flex items-center gap-2 text-red-700 mb-2">
          <span>⚠️</span>
          <span className="font-medium">Error loading packages</span>
        </div>
        <p className="text-sm text-red-600 mb-4">{fetchError}</p>
        <button
          onClick={fetchPackages}
          className="px-4 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  // Render empty state
  if (packages.length === 0 && !loading) {
    return (
      <div className="p-8 text-center border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
        <div className="text-4xl mb-4">📦</div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">
          {builderMode ? "No packages available" : "No packages found"}
        </h3>
        <p className="text-gray-600 mb-4">
          {builderMode 
            ? "No packages are currently configured in the system."
            : careAnalysis.requiresCare 
              ? `No packages match your ${careAnalysis.totalHoursPerDay}h daily care requirements${courseAnalysisData?.hasCourse ? ' and course participation' : ''}.`
              : courseAnalysisData?.hasCourse 
                ? 'No packages match your course participation requirements.'
                : 'No packages match your current criteria.'
          }
        </p>
        <button
          onClick={fetchPackages}
          className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    );
  }

  return (
    <div className={`package-selection ${className}`}>
      {/* Main Content Layout - Grid for equal column control */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        
        {/* Package Display - Left Column */}
        <div className="w-full">
          <div className={`
            rounded-lg border transition-all duration-200 p-3
            ${shouldShowError
                ? 'border-red-400 bg-red-50'
                : shouldShowValid
                    ? 'border-green-400 bg-green-50'
                    : 'border-gray-300 bg-white'
            }
          `}>
            <div className="space-y-6">
              {Object.entries(groupedPackages).map(([funderType, funderPackages]) => {
                if (funderPackages.length === 0) return null;
                
                return (
                  <div key={funderType} className="space-y-4">
                    {!builderMode && (
                      <div className="mb-4">
                        <p className="text-gray-700 text-sm">
                          Based on the information provided, the following {funderPackages.length === 1 ? 'package is' : 'packages are'} available to you:
                        </p>
                      </div>
                    )}

                    {/* Category Header (only show in builder mode or when multiple packages) */}
                    {(builderMode || funderPackages.length > 1) && (
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <h2 className="text-lg font-semibold text-gray-900">
                            {funderType} Packages
                          </h2>
                          <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                            {funderPackages.length} available
                          </span>
                        </div>
                        {!builderMode && funderPackages.length > 1 && (
                          <p className="text-sm text-gray-600">
                            Please select the package that best suits your accommodation and support needs.
                          </p>
                        )}
                      </div>
                    )}

                    {/* Selection Status (only for multi-package scenarios) */}
                    {!builderMode && funderPackages.length > 1 && (
                      <div className="mb-4">
                        {!funderPackages.some(pkg => isPackageSelected(pkg)) ? (
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 border-2 border-blue-400 rounded-full"></div>
                              <span className="text-sm text-blue-700">
                                Please select a package to continue
                              </span>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                                </svg>
                              </div>
                              <span className="text-sm text-green-700">
                                Package selected: {(() => {
                                  const selectedPkg = funderPackages.find(pkg => isPackageSelected(pkg));
                                  return selectedPkg?.name || 'Package';
                                })()}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Package Cards - Single column within the grid cell */}
                    <div className="space-y-4">
                      {funderPackages.map((pkg) => (
                        <ErrorBoundary key={pkg.id}>
                          {renderPackageCard(pkg)}
                        </ErrorBoundary>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Error indicator */}
          {shouldShowError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm flex items-center">
              <svg className="h-4 w-4 text-red-500 mr-1.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error || 'Please select a package to continue'}
            </div>
          )}
        </div>

        {/* Right Column - Package Description */}
        {!builderMode && (
          <div className="w-full">
            {(() => {
              // Find the currently selected package
              let selectedPackage;
  
              if (!builderMode && packages.length === 1) {
                // Single package mode - always use the only available package
                // This ensures description stays in sync with the card which also uses this condition
                selectedPackage = packages[0];
              } else {
                // Multiple packages - use value-based selection
                selectedPackage = packages.find(pkg => isPackageSelected(pkg));
              }

              if (selectedPackage && selectedPackage.description) {
                return (
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm sticky top-4 overflow-hidden">
                    {/* Header */}
                    <div className="bg-blue-500 px-4 py-3 sm:px-6 sm:py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-white font-semibold text-base sm:text-lg">Package Description</h3>
                          <p className="text-blue-100 text-xs sm:text-sm truncate">{selectedPackage.name}</p>
                        </div>
                      </div>
                    </div>

                    {/* Description content - Using FormattedDescription */}
                    <div className="p-4 sm:p-6">
                      <FormattedDescription 
                        text={selectedPackage.description}
                        variant="default"
                        className="text-gray-700"
                      />

                      {/* Package metadata */}
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600">
                          <span className="bg-gray-100 px-2 py-1 rounded">
                            {selectedPackage.package_code}
                          </span>
                          <span className="text-gray-400">•</span>
                          <span>{selectedPackage.funder}</span>
                          {selectedPackage.ndis_package_type && (
                            <>
                              <span className="text-gray-400">•</span>
                              <span className="uppercase">{selectedPackage.ndis_package_type}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Default view when no package selected or no description
              return (
                <div className="bg-gray-50 rounded-lg border border-gray-200 sticky top-4 overflow-hidden">
                  <div className="p-6 sm:p-8 text-center">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <svg className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                      </svg>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2 text-base sm:text-lg">Package Description</h3>
                    <p className="text-xs sm:text-sm text-gray-600 leading-relaxed max-w-xs mx-auto">
                      {packages.length === 1 
                        ? "Package description will appear here once loaded."
                        : "Select a package to view its description."
                      }
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageSelection;