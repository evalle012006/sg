import React, { useState, useEffect, useRef, useMemo } from 'react';
import { calculateCareHours, createPackageFilterCriteria, formatCareScheduleForDisplay } from '../../utilities/careHoursCalculator';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';

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
  const [expandedPackages, setExpandedPackages] = useState(new Set());
  const [expandedCategories, setExpandedCategories] = useState(new Set(['NDIS', 'Non-NDIS']));
  const [debugInfo, setDebugInfo] = useState(null);
  const [autoSelected, setAutoSelected] = useState(false);
  
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
    
    // Funding source detection
    let fundingAnswer = getAnswerByQuestionKey('how-will-your-stay-be-funded');
    
    // Fallback: use formData.funder if available
    if (!fundingAnswer && formData.funder) {
      fundingAnswer = formData.funder;
    }
    
    // Fallback: use formData.isNdisFunded if available
    if (!fundingAnswer && typeof formData.isNdisFunded === 'boolean') {
      fundingAnswer = formData.isNdisFunded ? 'NDIS' : 'Non-NDIS';
    }
    
    if (fundingAnswer) {
      requirements.funder_type = fundingAnswer.includes('NDIS') ? 'NDIS' : 'Non-NDIS';
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
        console.log('🔍 Trying to find course answers by question text patterns...');
        
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
        
        console.log('🎓 Found course-related QA pairs:', courseRelatedQA.map(qa => ({
          question: qa.question,
          answer: qa.answer,
          question_key: qa.question_key || qa.Question?.question_key
        })));
        
        // Try to find course offer question
        const offerQA = courseRelatedQA.find(qa => 
          qa.question.toLowerCase().includes('offered') || 
          qa.question.toLowerCase().includes('place')
        );
        if (offerQA) {
          courseOfferAnswer = offerQA.answer;
          console.log('✅ Found course offer by text pattern:', courseOfferAnswer);
        }
        
        // Try to find which course question
        const whichQA = courseRelatedQA.find(qa => 
          qa.question.toLowerCase().includes('which') || 
          qa.question.toLowerCase().includes('what') ||
          qa.question.toLowerCase().includes('select')
        );
        if (whichQA) {
          whichCourseAnswer = whichQA.answer;
          console.log('✅ Found which course by text pattern:', whichCourseAnswer);
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
        console.log('✅ Course detected from which-course answer:', whichCourseAnswer);
      }
      
      console.log('🎓 Fallback course detection:', {
        courseOfferAnswer,
        whichCourseAnswer,
        hasCourse
      });
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
      }
      
      requirements.ndis_package_type = requirements.has_course ? 'sta' : 'holiday';
    }
    
    console.log('🎯 Final extracted guest requirements:', requirements);
    return requirements;
  };

  // Helper function to get answer by question key from ALL booking data
  const getAnswerByQuestionKey = (questionKey) => {
    console.log(`🔍 Looking for question key: "${questionKey}"`);
    
    // Strategy 1: Try qaData first (current page QA pairs)
    if (qaData && qaData.length > 0) {
      console.log(`📊 Current page QA Data:`, qaData.map(q => ({
        question: q.question?.substring(0, 50) + '...',
        question_key: q.question_key,
        answer: q.answer,
        hasAnswer: !!q.answer
      })));
      
      const qa = qaData.find(q => q.question_key === questionKey);
      if (qa) {
        console.log(`✅ Found in current page qaData:`, qa.answer);
        return qa.answer;
      }
    }
    
    // Strategy 2: Access global form data through window or other global sources
    if (typeof window !== 'undefined' && window.bookingFormData) {
      console.log(`🌍 Checking global booking form data...`);
      // Check if there's global booking data available
      if (window.bookingFormData.sections) {
        for (const section of window.bookingFormData.sections) {
          if (section.QaPairs) {
            for (const qaPair of section.QaPairs) {
              if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                console.log(`✅ Found in global booking data:`, qaPair.answer);
                return qaPair.answer;
              }
            }
          }
        }
      }
    }
    
    // Strategy 3: Try formData structure variations
    if (formData && typeof formData === 'object') {
      console.log(`📋 Form Data structure:`, {
        keys: Object.keys(formData),
        funder: formData.funder,
        isNdisFunded: formData.isNdisFunded,
        hasBookingData: !!(formData.booking || formData.sections || formData.allPages),
        careAnalysisType: typeof formData.careAnalysis
      });
      
      // Direct key lookup
      if (formData[questionKey]) {
        console.log(`✅ Found direct key in formData:`, formData[questionKey]);
        return formData[questionKey];
      }
      
      // Check if formData contains booking data structure
      if (formData.booking) {
        console.log(`📋 Found booking data in formData`);
        // If booking data is structured like the API response
        if (formData.booking.sections && Array.isArray(formData.booking.sections)) {
          for (const section of formData.booking.sections) {
            if (section.QaPairs && Array.isArray(section.QaPairs)) {
              for (const qaPair of section.QaPairs) {
                if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                  console.log(`✅ Found in formData.booking:`, qaPair.answer);
                  return qaPair.answer;
                }
              }
            }
          }
        }
      }
      
      // Check sections directly in formData
      if (formData.sections && Array.isArray(formData.sections)) {
        console.log(`📂 Searching through ${formData.sections.length} form sections`);
        for (const section of formData.sections) {
          if (section.QaPairs && Array.isArray(section.QaPairs)) {
            for (const qaPair of section.QaPairs) {
              if (qaPair.Question?.question_key === questionKey && qaPair.answer) {
                console.log(`✅ Found in formData.sections:`, qaPair.answer);
                return qaPair.answer;
              }
            }
          }
          
          // Also check if section has questions array
          if (section.questions && Array.isArray(section.questions)) {
            for (const question of section.questions) {
              if (question.question_key === questionKey && question.answer) {
                console.log(`✅ Found in section questions:`, question.answer);
                return question.answer;
              }
            }
          }
        }
      }
      
      // Strategy 4: Check if formData has aggregated answers
      if (formData.answers && typeof formData.answers === 'object') {
        if (formData.answers[questionKey]) {
          console.log(`✅ Found in formData.answers:`, formData.answers[questionKey]);
          return formData.answers[questionKey];
        }
      }
    }
    
    // Strategy 5: Use known course information from props/context
    // If we know this is about courses and we have course-related props
    if (questionKey === 'which-course' && restProps.selectedCourse) {
      console.log(`✅ Found course from props:`, restProps.selectedCourse);
      return restProps.selectedCourse;
    }
    
    console.log(`❌ Not found anywhere: "${questionKey}"`);
    return null;
  };

  // Enhanced care analysis
  const careAnalysis = useMemo(() => {
    if (!careAnalysisData && (!formData || Object.keys(formData).length === 0)) {
      return {
        requiresCare: false,
        totalHoursPerDay: 0,
        carePattern: 'no-care',
        recommendedPackages: []
      };
    }

    try {
      const careScheduleData = careAnalysisData || findByQuestionKey(qaData || [], QUESTION_KEYS.CARE_SCHEDULE);
      
      if (!careScheduleData) {
        return {
          requiresCare: false,
          totalHoursPerDay: 0,
          carePattern: 'no-care',
          recommendedPackages: []
        };
      }

      const parsedCareData = typeof careScheduleData === 'string' 
        ? JSON.parse(careScheduleData) 
        : careScheduleData;
      
      const analysis = calculateCareHours(parsedCareData);
      
      console.log('🏥 Calculated care analysis:', {
        totalHours: analysis.totalHoursPerDay,
        pattern: analysis.carePattern,
        recommended: analysis.recommendedPackages,
        rawData: parsedCareData
      });

      return {
        requiresCare: true,
        ...analysis,
        rawCareData: parsedCareData
      };
    } catch (error) {
      console.error('Error parsing care data in PackageSelection:', error);
      return {
        requiresCare: true,
        totalHoursPerDay: 0,
        carePattern: 'care-error',
        recommendedPackages: [],
        analysis: 'Error parsing care schedule data'
      };
    }
  }, [careAnalysisData, formData, qaData]);

  // ENHANCED: Build comprehensive filter criteria
  const enhancedFilterCriteria = useMemo(() => {
    const baseCriteria = packageFilterCriteria || createPackageFilterCriteria(careAnalysis.rawCareData || []);
    
    // Get additional requirements from form data
    const guestRequirements = extractGuestRequirements();
    
    const criteria = {
      ...baseCriteria,
      ...guestRequirements,
      
      // Override with explicit props if provided
      funder_type: localFilterState?.funderType || guestRequirements.funder_type || funder,
      ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type || ndis_package_type,
      
      // Care-specific criteria
      care_hours: Math.ceil(careAnalysis.totalHoursPerDay || 0),
      care_pattern: careAnalysis.carePattern,
      recommended_packages: careAnalysis.recommendedPackages || [],
      
      // Course-specific criteria (ENHANCED)
      has_course: guestRequirements.has_course,
      course_offered: courseAnalysisData?.courseOffered || false,
      course_id: courseAnalysisData?.courseId || null,
      
      // Additional filters
      ...additionalFilters
    };

    console.log('🎯 Enhanced filter criteria for PackageRequirement filtering:', {
      ...criteria,
      careAnalysisData: careAnalysis,
      courseAnalysisData: courseAnalysisData, // ENHANCED LOGGING
      formDataKeys: Object.keys(formData || {}),
      qaDataLength: qaData?.length || 0
    });
    return criteria;
  }, [careAnalysis, courseAnalysisData, localFilterState, funder, ndis_package_type, additionalFilters, packageFilterCriteria, formData, qaData]);

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

  const fetchPackages = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      
      // Determine if we need advanced filtering (care-based)
      const needsAdvancedFiltering = careAnalysis.requiresCare && careAnalysis.totalHoursPerDay > 0;
      
      let response;
      
      if (needsAdvancedFiltering) {
        // Use advanced filtering API with care requirements
        console.log('🔍 Using advanced package filtering with care data');
        response = await fetch('/api/packages/filter', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...enhancedFilterCriteria,
            include_requirements: true, // ADDED: Include requirements data
            debug: true // Enable debug mode for development
          })
        });
      } else {
        // Use simple API for basic filtering
        console.log('🔍 Using basic package filtering');
        const params = new URLSearchParams();
        if (enhancedFilterCriteria.funder_type) params.set('funder', enhancedFilterCriteria.funder_type);
        if (enhancedFilterCriteria.ndis_package_type) params.set('ndis_package_type', enhancedFilterCriteria.ndis_package_type);
        
        // ADDED: Always include requirements for proper filtering
        params.set('include_requirements', 'true');
        
        const queryString = params.toString();
        response = await fetch(`/api/packages${queryString ? `?${queryString}` : '?include_requirements=true'}`);
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.packages) {
        console.log(`📦 Fetched ${data.packages.length} packages with requirements data`);
        
        let fetchedPackages = data.packages.map(pkg => ({
          ...pkg,
          formattedPrice: pkg.funder === 'NDIS' 
            ? 'NDIS Funded' 
            : `${parseFloat(pkg.price || 0).toFixed(2)}`,
          summary: pkg.description ? 
            (pkg.description.length > 100 ? pkg.description.substring(0, 100) + '...' : pkg.description) :
            'Package details available',
          // Ensure arrays are properly formatted
          ndis_line_items: Array.isArray(pkg.ndis_line_items) ? pkg.ndis_line_items : [],
          inclusions: Array.isArray(pkg.inclusions) ? pkg.inclusions : [],
          features: Array.isArray(pkg.features) ? pkg.features : [],
          // ADDED: Ensure requirement data is properly attached
          hasRequirement: !!(pkg.requirement && typeof pkg.requirement === 'object')
        }));

        // Enhanced logging for requirements
        console.log('✅ Packages with requirements analysis:', fetchedPackages.map(pkg => ({
          code: pkg.package_code,
          name: pkg.name,
          hasRequirement: pkg.hasRequirement,
          requirementSummary: pkg.requirement ? {
            requires_no_care: pkg.requirement.requires_no_care,
            care_hours_min: pkg.requirement.care_hours_min,
            care_hours_max: pkg.requirement.care_hours_max,
            requires_course: pkg.requirement.requires_course,
            compatible_with_course: pkg.requirement.compatible_with_course,
            adminNotes: pkg.requirement.notes
          } : 'NO REQUIREMENT DATA'
        })));

        console.log('🎯 Current guest criteria for filtering:', {
          care_hours: enhancedFilterCriteria.care_hours,
          has_course: enhancedFilterCriteria.has_course,
          course_offered: enhancedFilterCriteria.course_offered,
          funder_type: enhancedFilterCriteria.funder_type
        });

        // Apply PackageRequirement filtering WITH enhanced logging
        fetchedPackages = applyPackageRequirementFiltering(fetchedPackages, enhancedFilterCriteria);

        // Continue with existing logic for Non-NDIS vs NDIS handling
        if (!builderMode) {
          const ndisPackages = fetchedPackages.filter(pkg => pkg.funder === 'NDIS');
          const nonNdisPackages = fetchedPackages.filter(pkg => pkg.funder !== 'NDIS');
          
          if (nonNdisPackages.length > 0) {
            // For Non-NDIS: Find best match and auto-select only one
            const bestMatch = findBestMatchPackage(nonNdisPackages);
            if (bestMatch) {
              fetchedPackages = [bestMatch]; // Show only one Non-NDIS package
              
              // Auto-select the package if not already selected
              if (!value && !autoSelected) {
                console.log('🎯 Auto-selecting Non-NDIS package:', bestMatch.name);
                onChange?.(bestMatch.id); // Use package ID
                setAutoSelected(true);
              }
            }
          } else if (ndisPackages.length > 0) {
            const bestMatch = findBestMatchPackage(ndisPackages);
            if (bestMatch) {
              fetchedPackages = [bestMatch]; // Show only one NDIS package
              
              // Auto-select the NDIS package if not already selected
              if (!value && !autoSelected) {
                console.log('🎯 Auto-selecting NDIS package:', bestMatch.name);
                onChange?.(bestMatch.id); // Use package ID
                setAutoSelected(true);
              }
            } else {
              // Fallback: if no best match found, show all NDIS packages
              fetchedPackages = ndisPackages;
              console.log('📋 Fallback: Showing all NDIS packages (no best match found):', ndisPackages.length);
            }
          }
        }

        setPackages(fetchedPackages);
        
        if (data.debugInfo) {
          setDebugInfo(data.debugInfo);
        }
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

  // NEW: Function to find the best matching package based on PackageRequirement
  const findBestMatchPackage = (packageList) => {
    if (!packageList || packageList.length === 0) return null;
    
    const guestRequirements = extractGuestRequirements();
    
    // Score packages based on how well they match requirements
    const scoredPackages = packageList.map(pkg => {
      let score = 0;
      
      // Funder type match (highest priority)
      if (pkg.funder === guestRequirements.funder_type) {
        score += 100;
      }
      
      // NDIS package type match
      if (pkg.funder === 'NDIS' && pkg.ndis_package_type === guestRequirements.ndis_package_type) {
        score += 50;
      }
      
      // Care requirements match
      if (careAnalysis.recommendedPackages?.includes(pkg.package_code)) {
        score += 75;
      }
      
      // Course compatibility
      if (guestRequirements.has_course && pkg.course_compatible) {
        score += 25;
      }
      
      return { ...pkg, matchScore: score };
    });
    
    // Sort by score (highest first) and return the best match
    scoredPackages.sort((a, b) => b.matchScore - a.matchScore);
    
    console.log('🎯 Package scoring results:', scoredPackages.map(p => ({ 
      name: p.name, 
      score: p.matchScore, 
      funder: p.funder 
    })));
    
    return scoredPackages[0];
  };

  // Debug value changes
  useEffect(() => {
    console.log('📦 PackageSelection value changed:', {
      value,
      type: typeof value,
      isArray: Array.isArray(value),
      isPackageId: (typeof value === 'number' || typeof value === 'string'),
      selectedPackageName: (() => {
        if (Array.isArray(value)) {
          return value.map(id => packages.find(p => p.id == id)?.name || `ID:${id}`);
        } else if (value) {
          return packages.find(p => p.id == value)?.name || `ID:${value}`;
        }
        return null;
      })()
    });
  }, [value, packages]);

  // Fetch packages when component mounts or criteria changes
  useEffect(() => {
    console.log('📦 PackageSelection useEffect triggered:', {
      builderMode,
      enhancedFilterCriteria,
      currentValue: value,
      autoSelected
    });
    
    if (builderMode) {
      // In builder mode, show all packages without filtering
      console.log('🏗️ Builder mode: Fetching all packages');
    }
    
    fetchPackages();
    
    return () => {
      if (fetchTimeout.current) {
        clearTimeout(fetchTimeout.current);
      }
    };
  }, [enhancedFilterCriteria, builderMode]);

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

  // Auto-select Non-NDIS package when available and no selection exists
  useEffect(() => {
    if (!builderMode && !value && packages.length === 1 && !autoSelected && onChange) {
      const pkg = packages[0];
      if (pkg.funder !== 'NDIS') {
        console.log('🔄 Fallback auto-selection for Non-NDIS package:', pkg.name);
        console.log('🔄 Fallback package full object:', pkg);
        console.log('🔄 Fallback package ID:', pkg.id, typeof pkg.id);
        setTimeout(() => {
          const packageId = pkg.id;
          console.log('🔄 Fallback about to call onChange with:', packageId);
          console.log('🔄 Fallback confirm package ID type:', typeof packageId);
          onChange(packageId); // Send only the package ID, not the full object
          console.log('🔄 Fallback onChange called successfully');
          setAutoSelected(true);
        }, 200);
      }
    }
  }, [packages, value, autoSelected, builderMode, onChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Handle package selection
  const handlePackageSelect = (selectedPackage) => {
    if (builderMode) return; // Don't handle selection in builder mode
    
    console.log('📦 Package selected:', selectedPackage.name, selectedPackage.funder);
    console.log('📦 Package full object:', selectedPackage);
    
    // Save only the package ID as the answer (not the full object)
    const packageId = selectedPackage.id;
    console.log('📦 Extracted package ID:', packageId, typeof packageId);
    
    // Different behavior for NDIS vs Non-NDIS packages
    if (selectedPackage.funder === 'NDIS') {
      // NDIS packages: Allow normal selection/switching between packages
      if (multi) {
        const currentValues = Array.isArray(value) ? value : [];
        const isSelected = currentValues.includes(packageId);
        
        const newValue = isSelected
          ? currentValues.filter(id => id !== packageId)
          : [...currentValues, packageId];
          
        console.log('📦 NDIS Multi-selection onChange called with:', newValue);
        console.log('📦 NDIS Multi-selection onChange type check:', typeof newValue, Array.isArray(newValue));
        onChange?.(newValue);
      } else {
        // For single selection of NDIS packages, always select the clicked package
        console.log('📦 NDIS Single-selection onChange called with:', packageId);
        console.log('📦 NDIS Single-selection onChange type check:', typeof packageId);
        onChange?.(packageId);
      }
    } else {
      // Non-NDIS packages: Already auto-selected, but allow deselection if needed
      if (multi) {
        const currentValues = Array.isArray(value) ? value : [];
        const isSelected = currentValues.includes(packageId);
        
        const newValue = isSelected
          ? currentValues.filter(id => id !== packageId)
          : [...currentValues, packageId];
          
        console.log('📦 Non-NDIS Multi-selection onChange called with:', newValue);
        console.log('📦 Non-NDIS Multi-selection onChange type check:', typeof newValue, Array.isArray(newValue));
        onChange?.(newValue);
      } else {
        // For Non-NDIS, toggle selection (can deselect if needed)
        const currentlySelected = value == packageId; // Use == to handle string/number comparison
        const newValue = currentlySelected ? null : packageId;
        console.log('📦 Non-NDIS Single-selection onChange called with:', newValue);
        console.log('📦 Non-NDIS Single-selection onChange type check:', typeof newValue);
        onChange?.(newValue);
      }
    }
  };

  // Check if package is selected (value is now package ID, not full object)
  const isPackageSelected = (pkg) => {
    if (multi) {
      const result = Array.isArray(value) && value.includes(pkg.id);
      console.log('📦 Multi-select check for', pkg.name, ':', result, 'Current value:', value);
      return result;
    }
    const result = value == pkg.id; // Use == to handle string/number comparison
    console.log('📦 Single-select check for', pkg.name, ':', result, 'Current value:', value);
    return result;
  };

  const getRateTypeLabel = (rateType) => {
    const labels = {
      weekday: 'Weekday',
      weekend: 'Weekend', 
      public_holiday: 'Holiday'
    };
    return labels[rateType] || 'Unknown';
  };

  const getRateTypeBadgeStyle = (rateType) => {
    const styles = {
      weekday: 'bg-blue-100 text-blue-800',
      weekend: 'bg-green-100 text-green-800', 
      public_holiday: 'bg-red-100 text-red-800'
    };
    return styles[rateType] || 'bg-gray-100 text-gray-800';
  };

  // Render Non-NDIS Package Tile
  const renderNonNdisTile = (pkg) => {
    const isSelected = isPackageSelected(pkg) || (!builderMode && packages.length === 1);
    
    return (
      <div
        key={pkg.id}
        onClick={() => handlePackageSelect(pkg)}
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
              <span className="px-2 py-1 bg-orange-100 text-orange-800 rounded font-medium text-sm">
                {safeRender(pkg.funder, 'Unknown')}
              </span>
            </div>
            
            <div className="text-2xl font-bold text-gray-900">
              {safeRender(pkg.formattedPrice, 'Price not available')}
            </div>
          </div>

          {/* Package Details */}
          <div className="space-y-4">
            {pkg.description && (
              <div>
                <p className="text-sm text-gray-600">
                  {safeRender(pkg.description, 'No description available')}
                </p>
              </div>
            )}
            
            {pkg.inclusions && pkg.inclusions.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  What&apos;s Included
                </h4>
                <ul className="text-sm text-gray-600 space-y-1">
                  {pkg.inclusions.slice(0, 4).map((inclusion, idx) => {
                    const inclusionText = safeRender(
                      typeof inclusion === 'string' ? inclusion : 
                      inclusion?.name || inclusion?.item || inclusion,
                      'Inclusion not available'
                    );
                    return (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-xs mt-1 text-green-500">✓</span>
                        {inclusionText}
                      </li>
                    );
                  })}
                  {pkg.inclusions.length > 4 && (
                    <li className="text-xs text-gray-500 italic">
                      +{pkg.inclusions.length - 4} more inclusions
                    </li>
                  )}
                </ul>
              </div>
            )}
            
            {pkg.features && pkg.features.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">
                  Key Features
                </h4>
                <div className="flex flex-wrap gap-2">
                  {pkg.features.slice(0, 6).map((feature, idx) => {
                    const featureText = safeRender(
                      typeof feature === 'string' ? feature : 
                      feature?.name || feature?.title || feature,
                      'Feature'
                    );
                    return (
                      <span 
                        key={idx} 
                        className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700"
                      >
                        {featureText}
                      </span>
                    );
                  })}
                  {pkg.features.length > 6 && (
                    <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                      +{pkg.features.length - 6} more
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render NDIS Package Table
  const renderNdisTable = (pkg) => {
    const isSelected = isPackageSelected(pkg) || (!builderMode && packages.length === 1);
    
    return (
      <div
        key={pkg.id}
        onClick={() => handlePackageSelect(pkg)}
        className={`border-2 rounded-lg overflow-hidden transition-all duration-200 ${
          builderMode 
            ? 'cursor-default border-gray-200' 
            : 'cursor-pointer hover:shadow-md'
        } ${
          isSelected
            ? 'border-green-500 bg-white shadow-lg'
            : 'border-gray-200 bg-white hover:border-gray-300'
        }`}
      >
        {/* Table Header */}
        <div className={`px-6 py-4 border-b ${isSelected ? 'bg-gray-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className={`text-xl font-bold ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
                {safeRender(pkg.name, 'Package Name')}
              </h3>
            </div>
            
            {/* Selection Checkmark */}
            {isSelected && (
              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
            )}
          </div>
          
          {/* Package Summary */}
          <div className="mt-3 flex items-center gap-4 text-sm">
            <span className={`font-mono px-2 py-1 rounded ${isSelected ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700'}`}>
              {safeRender(pkg.package_code, 'N/A')}
            </span>
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded font-medium">
              {safeRender(pkg.funder, 'Unknown')} Funded
            </span>
            <span className={`font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
              {safeRender(pkg.formattedPrice, 'Price not available')}
            </span>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <tbody>
              {/* NDIS Package Type */}
              {pkg.ndis_package_type && (
                <tr className={isSelected ? 'bg-white' : 'bg-white'}>
                  <td className={`px-6 py-3 font-medium border-b ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    NDIS Support Type
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded font-medium text-sm uppercase">
                      {pkg.ndis_package_type === 'sta' ? 'Short Term Accommodation' : safeRender(pkg.ndis_package_type, 'Unknown')}
                    </span>
                  </td>
                </tr>
              )}

              {/* Description */}
              {pkg.description && (
                <tr className={isSelected ? 'bg-gray-50' : 'bg-gray-50'}>
                  <td className={`px-6 py-3 font-medium border-b align-top ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    Description
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    {safeRender(pkg.description, 'No description available')}
                  </td>
                </tr>
              )}

              {/* NDIS Line Items */}
              {pkg.ndis_line_items && pkg.ndis_line_items.length > 0 && (
                <tr className={isSelected ? 'bg-white' : 'bg-white'}>
                  <td className={`px-6 py-3 font-medium border-b align-top ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    NDIS Line Items & Pricing
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    <div className="space-y-3">
                      {pkg.ndis_line_items.map((item, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border ${isSelected ? 'bg-gray-50 border-gray-200' : 'bg-gray-50 border-gray-200'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center space-x-2">
                              <span className={`font-mono text-xs px-2 py-1 rounded ${isSelected ? 'bg-gray-100 text-gray-700' : 'bg-gray-100 text-gray-700'}`}>
                                {safeRender(item.line_item, 'Line Item')}
                              </span>
                              <span className={`px-2 py-1 text-xs rounded font-medium ${getRateTypeBadgeStyle(item.rate_type)}`}>
                                {getRateTypeLabel(item.rate_type)}
                              </span>
                            </div>
                            <span className={`font-bold text-sm ${isSelected ? 'text-gray-900' : 'text-gray-900'}`}>
                              ${safeRender(item.price_per_night, '0')}/night
                            </span>
                          </div>
                          <p className={`text-sm ${isSelected ? 'text-gray-600' : 'text-gray-600'}`}>
                            {safeRender(item.sta_package, 'STA Package')}
                          </p>
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              )}

              {/* Support Level */}
              {pkg.support_level && (
                <tr className={isSelected ? 'bg-gray-50' : 'bg-gray-50'}>
                  <td className={`px-6 py-3 font-medium border-b ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    Support Level
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    <span className={`px-2 py-1 rounded text-sm font-medium ${
                      isSelected ? 'bg-yellow-100 text-yellow-800' : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {safeRender(pkg.support_level, 'Not specified')}
                    </span>
                  </td>
                </tr>
              )}

              {/* Care Hours (if applicable) */}
              {careAnalysis.totalHoursPerDay > 0 && (
                <tr className={isSelected ? 'bg-white' : 'bg-white'}>
                  <td className={`px-6 py-3 font-medium border-b ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    Daily Care Match
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{careAnalysis.totalHoursPerDay}h care requirements</span>
                      {careAnalysis.recommendedPackages?.includes(pkg.package_code) && (
                        <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                          ⭐ Perfect Match
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )}

              {/* Course Information (if applicable) */}
              {/* {courseAnalysisData && courseAnalysisData.hasCourse && (
                <tr className={isSelected ? 'bg-gray-50' : 'bg-gray-50'}>
                  <td className={`px-6 py-3 font-medium border-b ${isSelected ? 'text-gray-700 border-gray-200' : 'text-gray-700 border-gray-200'}`}>
                    Course Participation
                  </td>
                  <td className={`px-6 py-3 border-b ${isSelected ? 'text-gray-900 border-gray-200' : 'text-gray-900 border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">Course participant</span>
                      {courseAnalysisData.courseId && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                          🎓 Course ID: {courseAnalysisData.courseId}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              )} */}
            </tbody>
          </table>
        </div>

        {/* NDIS Package Footer */}
        <div className={`px-6 py-3 border-t text-xs ${isSelected ? 'bg-gray-50 border-gray-200 text-gray-600' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <span>Pricing shown is per night and varies by day of week. Final costs are processed through NDIS funding.</span>
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
      {/* Package Display */}
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

              {/* NDIS Category Header */}
              {funderType === 'NDIS' && (builderMode || funderPackages.length > 1) && (
                <div className="mb-4">
                  <div className="flex items-center gap-3 mb-2">
                    <h2 className="text-lg font-semibold text-gray-900">
                      NDIS Packages
                    </h2>
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 text-sm rounded">
                      {funderPackages.length} available
                    </span>
                  </div>
                  {!builderMode && funderPackages.length > 1 && (
                    <p className="text-sm text-gray-600">
                      Please select the NDIS package that best suits your accommodation and support needs.
                    </p>
                  )}
                </div>
              )}

              {/* NDIS Selection Status */}
              {funderType === 'NDIS' && !builderMode && funderPackages.length > 1 && (
                <div className="mb-4">
                  {!funderPackages.some(pkg => isPackageSelected(pkg)) ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-blue-400 rounded-full"></div>
                        <span className="text-sm text-blue-700">
                          Please select an NDIS package to continue
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
                          NDIS package selected: {(() => {
                            const selectedPkg = funderPackages.find(pkg => isPackageSelected(pkg));
                            return selectedPkg?.name || 'Package';
                          })()}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Render packages based on funder type */}
              <div className={funderType === 'NDIS' ? 'space-y-4' : 'max-w-md'}>
                {funderPackages.map((pkg) => {
                  return (
                    <ErrorBoundary key={pkg.id}>
                      {pkg.funder === 'NDIS' 
                        ? renderNdisTable(pkg)
                        : renderNonNdisTile(pkg)}
                    </ErrorBoundary>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Debug Information (only in development) */}
      {debugInfo && process.env.NODE_ENV === 'development' && (
        <details className="mt-6 p-3 bg-gray-100 rounded text-xs">
          <summary className="cursor-pointer font-medium">Debug Info</summary>
          <pre className="mt-2 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      )}

      {/* Error indicator */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
          {error}
        </div>
      )}
    </div>
  );
};

export default PackageSelection;