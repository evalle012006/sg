import React, { useState, useEffect, useRef, useMemo } from 'react';
import { calculateCareHours, createPackageFilterCriteria, formatCareScheduleForDisplay } from '../../utilities/careHoursCalculator';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';
import { useCallback } from 'react';

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
  ...restProps
}) => {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [debugInfo, setDebugInfo] = useState(null);
  const [autoSelected, setAutoSelected] = useState(false);
  const [stableFilterCriteria, setStableFilterCriteria] = useState(null);
  const [lastCriteriaHash, setLastCriteriaHash] = useState(null);
  const previousValueRef = useRef(value);
  const lastFetchCriteriaRef = useRef(null);

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
      
      console.log('🏥 Using pre-processed care analysis data:', careAnalysisData);
      
      // If it has raw care data, we could re-process if needed, but usually just use the processed data
      if (careAnalysisData.rawCareData && Array.isArray(careAnalysisData.rawCareData)) {
        console.log('🔄 Re-processing care data from rawCareData');
        const analysis = calculateCareHours(careAnalysisData.rawCareData);
        return {
          requiresCare: analysis.totalHoursPerDay > 0,
          ...analysis,
          rawCareData: careAnalysisData.rawCareData
        };
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
      
      console.log('🏥 Processing raw care data from qaData:', rawCareData);
      
      // Validate that this is actually raw care schedule data (array format)
      if (!Array.isArray(rawCareData)) {
        console.warn('⚠️ Care data is not in expected array format:', rawCareData);
        return {
          requiresCare: false,
          totalHoursPerDay: 0,
          carePattern: 'no-care',
          recommendedPackages: []
        };
      }
      
      const analysis = calculateCareHours(rawCareData);
      
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
      // Use stableFilterCriteria if available and no major changes detected
      if (stableFilterCriteria && !builderMode) {
          console.log('📦 Using stable filter criteria (no recalculation needed)');
          return stableFilterCriteria;
      }
      
      console.log('📦 Calculating new filter criteria');
      
      const baseCriteria = packageFilterCriteria || createPackageFilterCriteria(careAnalysis.rawCareData || []);
      
      // Get additional requirements from form data - BUT ONLY USE STABLE QAPAIRS DATA
      const guestRequirements = extractGuestRequirementsFromStableData();
      
      const criteria = {
          ...baseCriteria,
          ...guestRequirements,
          
          // Override with explicit props if provided
          funder_type: localFilterState?.funderType || guestRequirements.funder_type || funder,
          ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type || ndis_package_type,
          
          // Care-specific criteria - ONLY use if careAnalysisData is provided (stable)
          care_hours: careAnalysisData ? Math.ceil(careAnalysisData.totalHoursPerDay || 0) : 0,
          care_pattern: careAnalysisData ? careAnalysisData.carePattern : 'no-care',
          recommended_packages: careAnalysisData ? (careAnalysisData.recommendedPackages || []) : [],
          
          // Course-specific criteria - ONLY use if courseAnalysisData is provided (stable)
          has_course: courseAnalysisData ? (courseAnalysisData.hasCourse || courseAnalysisData.courseOffered) : false,
          course_offered: courseAnalysisData ? courseAnalysisData.courseOffered : false,
          course_id: courseAnalysisData ? courseAnalysisData.courseId : null,
          
          // Additional filters
          ...additionalFilters
      };

      console.log('🎯 New filter criteria calculated:', {
          funder_type: criteria.funder_type,
          ndis_package_type: criteria.ndis_package_type,
          care_hours: criteria.care_hours,
          has_course: criteria.has_course,
          course_offered: criteria.course_offered,
          dataStability: {
              hasCareAnalysisData: !!careAnalysisData,
              hasCourseAnalysisData: !!courseAnalysisData,
              careDataSource: careAnalysisData?.dataSource,
              courseDataSource: courseAnalysisData?.dataSource
          }
      });
      
      return criteria;
  }, [
      careAnalysisData?.totalHoursPerDay,
      careAnalysisData?.carePattern,
      courseAnalysisData?.hasCourse,
      courseAnalysisData?.courseOffered,
      localFilterState?.funderType,
      localFilterState?.ndisPackageType,
      funder,
      ndis_package_type,
      stableFilterCriteria,
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

  const fetchPackages = async (forceFetch = false) => {
      try {
          // Create hash of current criteria
          const currentHash = createCriteriaHash(enhancedFilterCriteria);
          
          // Check if we need to fetch (criteria changed or forced)
          if (!forceFetch && lastCriteriaHash === currentHash && packages.length > 0) {
              console.log('📦 Skipping fetch - criteria unchanged and packages already loaded');
              return;
          }
          
          setLoading(true);
          setFetchError(null);
          
          console.log('📦 Fetching packages with criteria:', enhancedFilterCriteria);
          
          // Store criteria that we're fetching with
          lastFetchCriteriaRef.current = { ...enhancedFilterCriteria };
          
          // Determine if we need advanced filtering (care-based)
          const needsAdvancedFiltering = enhancedFilterCriteria.care_hours > 0;
          
          let response;
          
          if (needsAdvancedFiltering) {
              console.log('🔍 Using advanced package filtering with care data');
              response = await fetch('/api/packages/filter', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                      ...enhancedFilterCriteria,
                      include_requirements: true,
                      debug: false
                  })
              });
          } else {
              console.log('🔍 Using basic package filtering');
              const params = new URLSearchParams();
              if (enhancedFilterCriteria.funder_type) params.set('funder', enhancedFilterCriteria.funder_type);
              if (enhancedFilterCriteria.ndis_package_type) params.set('ndis_package_type', enhancedFilterCriteria.ndis_package_type);
              params.set('include_requirements', 'true');
              
              const queryString = params.toString();
              response = await fetch(`/api/packages${queryString ? `?${queryString}` : '?include_requirements=true'}`);
          }

          if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const data = await response.json();
          
          if (data.success && data.packages) {
              console.log(`📦 Successfully fetched ${data.packages.length} packages`);
              
              let fetchedPackages = data.packages.map(pkg => ({
                  ...pkg,
                  formattedPrice: pkg.funder === 'NDIS' ? 'NDIS Funded' : `${parseFloat(pkg.price || 0).toFixed(2)}`,
                  summary: pkg.description ? 
                      (pkg.description.length > 100 ? pkg.description.substring(0, 100) + '...' : pkg.description) :
                      'Package details available',
                  ndis_line_items: Array.isArray(pkg.ndis_line_items) ? pkg.ndis_line_items : [],
                  inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
                  features: Array.isArray(pkg.features) ? pkg.features : [],
                  hasRequirement: !!(pkg.requirement && typeof pkg.requirement === 'object')
              }));

              // Apply PackageRequirement filtering
              fetchedPackages = applyPackageRequirementFiltering(fetchedPackages, enhancedFilterCriteria);

              // Enhanced package sorting logic (keep existing)
              fetchedPackages.sort((a, b) => {
                  const careHours = enhancedFilterCriteria.care_hours || 0;
                  
                  if (careHours === 0) {
                      const aIsNoCarePerfect = a.requirement?.requires_no_care === true;
                      const bIsNoCarePerfect = b.requirement?.requires_no_care === true;
                      
                      if (aIsNoCarePerfect && !bIsNoCarePerfect) {
                          console.log(`🥇 Prioritizing ${a.package_code} (requires_no_care=true) over ${b.package_code}`);
                          return -1;
                      }
                      if (!aIsNoCarePerfect && bIsNoCarePerfect) {
                          console.log(`🥇 Prioritizing ${b.package_code} (requires_no_care=true) over ${a.package_code}`);
                          return 1;
                      }
                  }
                  
                  if (a.isRecommended && !b.isRecommended) return -1;
                  if (!a.isRecommended && b.isRecommended) return 1;
                  
                  if (a.matchScore !== undefined && b.matchScore !== undefined) {
                      if (a.matchScore !== b.matchScore) {
                          return b.matchScore - a.matchScore;
                      }
                  }
                  
                  const guestFunder = enhancedFilterCriteria.funder_type;
                  if (guestFunder) {
                      const aFunderMatch = (guestFunder === 'NDIS' && a.funder === 'NDIS') || 
                                          (guestFunder === 'Non-NDIS' && a.funder !== 'NDIS');
                      const bFunderMatch = (guestFunder === 'NDIS' && b.funder === 'NDIS') || 
                                          (guestFunder === 'Non-NDIS' && b.funder !== 'NDIS');
                      
                      if (aFunderMatch && !bFunderMatch) return -1;
                      if (!aFunderMatch && bFunderMatch) return 1;
                  }
                  
                  if (a.careCompatible && !b.careCompatible) return -1;
                  if (!a.careCompatible && b.careCompatible) return 1;
                  
                  return (a.name || '').localeCompare(b.name || '');
              });

              console.log('📦 Final package order after enhanced sorting:', 
                  fetchedPackages.map(p => ({
                      code: p.package_code,
                      name: p.name,
                      requiresNoCare: p.requirement?.requires_no_care,
                      ndis_package_type: p.ndis_package_type
                  }))
              );

              if (!builderMode) {
                  const bestMatch = fetchedPackages.length > 0 ? fetchedPackages[0] : null;
                  
                  if (bestMatch) {
                      console.log('🏆 Single best match selected:', {
                          name: bestMatch.name,
                          code: bestMatch.package_code,
                          id: bestMatch.id,
                          funder: bestMatch.funder,
                          ndis_package_type: bestMatch.ndis_package_type
                      });

                      // Auto-select immediately
                      if (onChange && value != bestMatch.id) {
                          onChange(bestMatch.id);
                          setAutoSelected(true);
                          console.log('✅ Package auto-selected:', bestMatch.id);
                      }
                      
                      // ✅ SHOW ONLY THE SINGLE BEST MATCH
                      setPackages([bestMatch]);
                      
                  } else {
                      console.warn('⚠️ No packages found');
                      setPackages([]);
                  }
              } else {
                  // Builder mode - show all packages
                  setPackages(fetchedPackages);
              }
              
              // Update stable criteria and hash
              setStableFilterCriteria({ ...enhancedFilterCriteria });
              setLastCriteriaHash(currentHash);
          } else {
              throw new Error(data.message || 'Failed to fetch packages');
          }
      } catch (error) {
          console.error('❌ Error fetching packages:', error);
          setFetchError(error.message);
          setPackages([]);
      } finally {
          setLoading(false);
      }
  };

  // Fetch packages when component mounts or criteria changes
  useEffect(() => {
      console.log('📦 PackageSelection useEffect triggered:', {
          builderMode,
          hasStableCriteria: !!stableFilterCriteria,
          currentValue: value,
          autoSelected,
          packagesCount: packages.length
      });
      
      // Create hash of current criteria
      const currentHash = createCriteriaHash(enhancedFilterCriteria);
      
      // Only fetch if:
      // 1. We don't have stable criteria yet (first load)
      // 2. The criteria hash has actually changed
      // 3. We're in builder mode and need to show all packages
      const shouldFetch = !stableFilterCriteria || 
                        lastCriteriaHash !== currentHash || 
                        (builderMode && packages.length === 0);
      
      if (shouldFetch) {
          console.log('📦 Criteria changed or first load - fetching packages');
          fetchPackages();
      } else {
          console.log('📦 No fetch needed - using existing packages');
      }
      
      return () => {
          if (fetchTimeout.current) {
              clearTimeout(fetchTimeout.current);
          }
      };
  }, [
      // REDUCED dependencies - only what actually matters
      enhancedFilterCriteria.funder_type,
      enhancedFilterCriteria.ndis_package_type,
      enhancedFilterCriteria.care_hours,
      enhancedFilterCriteria.has_course,
      enhancedFilterCriteria.course_offered,
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
              <span className="font-mono text-sm bg-gray-100 px-2 py-1 rounded">
                {safeRender(pkg.package_code, 'N/A')}
              </span>
            </div>
            
            <div className="text-2xl font-bold text-gray-900">
              {safeRender(pkg.formattedPrice, 'Price not available')}
            </div>
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
                    This package is processed through NDIS funding. Final costs and line item details will be shown in your Summary of Stay.
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
      {/* Main Content Layout */}
      <div className="flex flex-col lg:flex-row gap-3">
        {/* Package Display - Main Content */}
        <div className="flex-1 min-w-0">
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

                  {/* Package Cards Grid */}
                  <div className={`grid gap-6 ${
                    builderMode 
                      ? 'grid-cols-1 lg:grid-cols-2 xl:grid-cols-3'
                      : funderPackages.length === 1 
                        ? 'grid-cols-1 max-w-lg'
                        : 'grid-cols-1 lg:grid-cols-2'
                  }`}>
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

          {/* Error indicator */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
              {error}
            </div>
          )}
        </div>
        
        {/* Right Sidebar - Lorem Ipsum Section */}
        {!builderMode && (
          <div className="w-full lg:w-96 xl:w-1/2 flex-shrink-0">
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 sticky top-4">
              <h3 className="font-semibold text-gray-900 mb-3">Promo code</h3>
              <p className="text-gray-700 text-sm leading-relaxed">
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PackageSelection;