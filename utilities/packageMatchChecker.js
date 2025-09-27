import { QUESTION_KEYS, questionHasKey } from '../services/booking/question-helper';

/**
 * Get the best match package ID based on current form criteria
 */
export const getBestMatchPackageId = async (formData, careAnalysisData, courseAnalysisData, localFilterState) => {
  try {
    // Extract criteria similar to PackageSelection
    const guestRequirements = extractGuestRequirementsFromFormData(formData);
    
    const criteria = {
      ...guestRequirements,
      funder_type: localFilterState?.funderType || guestRequirements.funder_type,
      ndis_package_type: localFilterState?.ndisPackageType || guestRequirements.ndis_package_type,
      care_hours: careAnalysisData ? Math.ceil(careAnalysisData.totalHoursPerDay || 0) : 0,
      has_course: courseAnalysisData ? (courseAnalysisData.hasCourse || courseAnalysisData.courseOffered) : false,
      course_offered: courseAnalysisData ? courseAnalysisData.courseOffered : false,
    };

    console.log('🔍 Getting best match package with criteria:', criteria);

    // Fetch packages using same logic as PackageSelection
    const needsAdvancedFiltering = criteria.care_hours > 0;
    let response;

    if (needsAdvancedFiltering) {
      response = await fetch('/api/packages/filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...criteria,
          include_requirements: true,
          debug: false
        })
      });
    } else {
      const params = new URLSearchParams();
      if (criteria.funder_type) params.set('funder', criteria.funder_type);
      if (criteria.ndis_package_type) params.set('ndis_package_type', criteria.ndis_package_type);
      params.set('include_requirements', 'true');
      
      const queryString = params.toString();
      response = await fetch(`/api/packages${queryString ? `?${queryString}` : '?include_requirements=true'}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    
    if (!data.success || !data.packages || data.packages.length === 0) {
      console.log('❌ No packages found for best match');
      return null;
    }

    // Apply same filtering and sorting logic as PackageSelection
    let packages = data.packages.filter(pkg => {
      if (!pkg.requirement) return true;
      
      const req = pkg.requirement;
      const careHours = criteria.care_hours || 0;
      const hasCourse = criteria.has_course || false;

      // Care requirements check
      if (req.requires_no_care === true && careHours > 0) return false;
      if (req.requires_no_care !== true) {
        if (req.care_hours_min !== null && careHours < req.care_hours_min) return false;
        if (req.care_hours_max !== null && careHours > req.care_hours_max) return false;
      }

      // Course requirements check
      if (req.requires_course === true && !hasCourse) return false;
      if (req.requires_course === false && hasCourse) return false;
      if (req.compatible_with_course === false && hasCourse) return false;

      return true;
    });

    // Sort packages with boundary prioritization logic
    packages.sort((a, b) => {
      const careHours = criteria.care_hours || 0;
      
      // NEW: Boundary prioritization logic for care hours
      if (careHours > 0 && a.requirement && b.requirement) {
        const aReq = a.requirement;
        const bReq = b.requirement;
        
        // Check if guest is at the boundary between packages
        const aAtUpperLimit = aReq.care_hours_max !== null && careHours === aReq.care_hours_max;
        const bAtUpperLimit = bReq.care_hours_max !== null && careHours === bReq.care_hours_max;
        const aAtLowerLimit = aReq.care_hours_min !== null && careHours === aReq.care_hours_min;
        const bAtLowerLimit = bReq.care_hours_min !== null && careHours === bReq.care_hours_min;
        
        // If one package has guest at upper limit and another at lower limit,
        // prioritize the one with higher capacity (lower limit)
        if (aAtUpperLimit && bAtLowerLimit) {
          console.log(`🎯 Best match boundary priority: ${b.package_code} (higher capacity) over ${a.package_code} (at max)`);
          return 1; // b wins (HCSP over CSP)
        }
        if (bAtUpperLimit && aAtLowerLimit) {
          console.log(`🎯 Best match boundary priority: ${a.package_code} (higher capacity) over ${b.package_code} (at max)`);
          return -1; // a wins
        }
        
        // If both packages are suitable, prioritize the one with higher maximum capacity
        if (aReq.care_hours_max !== null && bReq.care_hours_max !== null) {
          if (aReq.care_hours_max !== bReq.care_hours_max) {
            console.log(`🎯 Best match capacity priority: Higher max capacity wins`);
            return bReq.care_hours_max - aReq.care_hours_max; // Higher max wins
          }
        }
        
        // If one has unlimited capacity (null max) and other has limited, prioritize unlimited
        if (aReq.care_hours_max === null && bReq.care_hours_max !== null) {
          console.log(`🎯 Best match unlimited capacity priority: ${a.package_code} over ${b.package_code}`);
          return -1; // a wins (unlimited capacity)
        }
        if (bReq.care_hours_max === null && aReq.care_hours_max !== null) {
          console.log(`🎯 Best match unlimited capacity priority: ${b.package_code} over ${a.package_code}`);
          return 1; // b wins (unlimited capacity)
        }
      }
      
      // Existing no-care prioritization logic
      if (careHours === 0) {
        const aIsNoCarePerfect = a.requirement?.requires_no_care === true;
        const bIsNoCarePerfect = b.requirement?.requires_no_care === true;
        
        if (aIsNoCarePerfect && !bIsNoCarePerfect) return -1;
        if (!aIsNoCarePerfect && bIsNoCarePerfect) return 1;
      }
      
      // Funder compatibility
      const guestFunder = criteria.funder_type;
      if (guestFunder) {
        const aFunderMatch = (guestFunder === 'NDIS' && a.funder === 'NDIS') || 
                            (guestFunder === 'Non-NDIS' && a.funder !== 'NDIS');
        const bFunderMatch = (guestFunder === 'NDIS' && b.funder === 'NDIS') || 
                            (guestFunder === 'Non-NDIS' && b.funder !== 'NDIS');
        
        if (aFunderMatch && !bFunderMatch) return -1;
        if (!aFunderMatch && bFunderMatch) return 1;
      }
      
      // Alphabetical fallback
      return (a.name || '').localeCompare(b.name || '');
    });

    const bestMatch = packages.length > 0 ? packages[0] : null;
    
    if (bestMatch) {
      console.log('🏆 Best match package found:', {
        id: bestMatch.id,
        name: bestMatch.name,
        package_code: bestMatch.package_code,
        careRange: bestMatch.requirement ? `${bestMatch.requirement.care_hours_min || 0}-${bestMatch.requirement.care_hours_max || '∞'}h` : 'No req'
      });
      return bestMatch.id;
    }

    return null;
  } catch (error) {
    console.error('❌ Error getting best match package:', error);
    return null;
  }
};

/**
 * Extract guest requirements from form data
 */
const extractGuestRequirementsFromFormData = (formData) => {
  const requirements = {};
  
  if (!formData || !Array.isArray(formData)) {
    return requirements;
  }

  // Look through all pages for answered questions
  for (const page of formData) {
    if (!page.Sections) continue;
    
    for (const section of page.Sections) {
      // Check Questions
      if (section.Questions) {
        for (const question of section.Questions) {
          if (!question.answer) continue;
          
          if (questionHasKey(question, QUESTION_KEYS.FUNDING_SOURCE)) {
            requirements.funder_type = question.answer.includes('NDIS') || question.answer.includes('NDIA') ? 'NDIS' : 'Non-NDIS';
          }
          
          if (questionHasKey(question, QUESTION_KEYS.IS_STA_STATED_SUPPORT)) {
            requirements.sta_in_plan = question.answer.toLowerCase().includes('yes');
          }
          
          if (questionHasKey(question, QUESTION_KEYS.COURSE_OFFER_QUESTION)) {
            requirements.has_course = question.answer.toLowerCase().includes('yes');
          }
        }
      }
      
      // Check QaPairs
      if (section.QaPairs) {
        for (const qaPair of section.QaPairs) {
          if (!qaPair.answer || !qaPair.Question) continue;
          
          if (questionHasKey(qaPair.Question, QUESTION_KEYS.FUNDING_SOURCE)) {
            requirements.funder_type = qaPair.answer.includes('NDIS') || qaPair.answer.includes('NDIA') ? 'NDIS' : 'Non-NDIS';
          }
          
          if (questionHasKey(qaPair.Question, QUESTION_KEYS.IS_STA_STATED_SUPPORT)) {
            requirements.sta_in_plan = qaPair.answer.toLowerCase().includes('yes');
          }
          
          if (questionHasKey(qaPair.Question, QUESTION_KEYS.COURSE_OFFER_QUESTION)) {
            requirements.has_course = qaPair.answer.toLowerCase().includes('yes');
          }
        }
      }
    }
  }
  
  return requirements;
};

/**
 * Get the current answer for ACCOMMODATION_PACKAGE_FULL question
 */
export const getCurrentPackageAnswer = (formData) => {
  if (!formData || !Array.isArray(formData)) {
    return null;
  }

  for (const page of formData) {
    if (!page.Sections) continue;
    
    for (const section of page.Sections) {
      // Check Questions
      if (section.Questions) {
        for (const question of section.Questions) {
          if (questionHasKey(question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) && question.answer) {
            return question.answer;
          }
        }
      }
      
      // Check QaPairs  
      if (section.QaPairs) {
        for (const qaPair of section.QaPairs) {
          if (qaPair.Question && questionHasKey(qaPair.Question, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL) && qaPair.answer) {
            return qaPair.answer;
          }
        }
      }
    }
  }
  
  return null;
};