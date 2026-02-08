// Fixed version with fallbacks for legacy data
import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SignatureInput from './signature-pad';
import { getNSWHolidaysV2, calculateDaysBreakdown } from '../../services/booking/create-summary-data';
import { serializePackage } from '../../utilities/common';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';
import { scroller, Element } from 'react-scroll';
import { formatAUD } from '../../utilities/priceUtil';
import moment from 'moment';

/**
 * Parse duration string to hours
 */
const parseDurationToHours = (durationStr) => {
  if (!durationStr || typeof durationStr !== 'string') return 0;
  
  const normalized = durationStr.toLowerCase().trim();
  
  const hoursMatch = normalized.match(/^([\d.]+)\s*hours?$/);
  if (hoursMatch) {
    return parseFloat(hoursMatch[1]);
  }
  
  const minutesMatch = normalized.match(/^([\d.]+)\s*minutes?$/);
  if (minutesMatch) {
    return parseFloat(minutesMatch[1]) / 60;
  }
  
  const numericValue = parseFloat(normalized);
  if (!isNaN(numericValue)) {
    return numericValue;
  }
  
  return 0;
};

/**
 * Get rate type for a given day of week
 */
const getRateTypeForDay = (dayOfWeek) => {
  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';
  return 'weekday';
};

/**
 * Generate array of dates for the stay
 */
const generateStayDatesArray = (datesOfStay, nights) => {
  if (!datesOfStay) return [];
  
  const startDateStr = datesOfStay.split(' - ')[0];
  const startMoment = moment(startDateStr, 'DD/MM/YYYY');
  
  if (!startMoment.isValid()) return [];
  
  const dates = [];
  const totalDays = nights + 1;
  
  for (let i = 0; i < totalDays; i++) {
    const currentDate = startMoment.clone().add(i, 'days');
    dates.push({
      date: currentDate.format('DD/MM/YYYY'),
      dayOfWeek: currentDate.day(),
      rateType: getRateTypeForDay(currentDate.day()),
      isCheckIn: i === 0,
      isCheckOut: i === totalDays - 1,
      isMiddleDay: i > 0 && i < totalDays - 1
    });
  }
  
  return dates;
};

/**
 * Check if the data is raw care data
 */
const isRawCareData = (data) => {
  if (!data) return false;
  
  if (Array.isArray(data.careData) && data.careData.length > 0) {
    return true;
  }
  
  if (Array.isArray(data.rawCareData) && data.rawCareData.length > 0) {
    return true;
  }
  
  return false;
};

/**
 * Check if the data is already processed care analysis
 */
const isProcessedCareData = (data) => {
  return data && data.requiresCare === true && Array.isArray(data.dailyCareDetails) && data.dailyCareDetails.length > 0;
};

/**
 * Get the raw care array from various possible locations
 */
const getRawCareArray = (data) => {
  if (!data) return null;
  
  if (Array.isArray(data.careData) && data.careData.length > 0) {
    return data.careData;
  }
  
  if (Array.isArray(data.rawCareData) && data.rawCareData.length > 0) {
    return data.rawCareData;
  }
  
  return null;
};

/**
 * Extract and process care data with check-in/check-out rules
 */
const extractCareAnalysisFromRawData = (rawCareData, datesOfStay, nights) => {
  const careArray = getRawCareArray(rawCareData);
  
  if (!careArray || careArray.length === 0) {
    return null;
  }
  
  const careByDateAndPeriod = {};
  careArray.forEach(item => {
    const date = item.date;
    const period = (item.care || '').toLowerCase();
    const duration = parseDurationToHours(item.values?.duration);
    const carers = item.values?.carers;
    
    if (carers === 'No care required' || duration === 0) {
      return;
    }
    
    if (!careByDateAndPeriod[date]) {
      careByDateAndPeriod[date] = { morning: 0, afternoon: 0, evening: 0 };
    }
    
    if (period === 'morning') {
      careByDateAndPeriod[date].morning = duration;
    } else if (period === 'afternoon') {
      careByDateAndPeriod[date].afternoon = duration;
    } else if (period === 'evening') {
      careByDateAndPeriod[date].evening = duration;
    }
  });
  
  let defaultValues = rawCareData.defaultValues;
  
  if (!defaultValues || Object.keys(defaultValues).length === 0) {
    defaultValues = { morning: {}, afternoon: {}, evening: {} };
    
    careArray.forEach(item => {
      const period = (item.care || '').toLowerCase();
      if (period && !defaultValues[period]?.duration) {
        defaultValues[period] = {
          duration: item.values?.duration,
          carers: item.values?.carers
        };
      }
    });
  }
  
  const defaultCare = {
    morning: defaultValues.morning?.carers !== 'No care required' 
      ? parseDurationToHours(defaultValues.morning?.duration) : 0,
    afternoon: defaultValues.afternoon?.carers !== 'No care required' 
      ? parseDurationToHours(defaultValues.afternoon?.duration) : 0,
    evening: defaultValues.evening?.carers !== 'No care required' 
      ? parseDurationToHours(defaultValues.evening?.duration) : 0
  };
  
  const stayDates = generateStayDatesArray(datesOfStay, nights);
  
  if (stayDates.length === 0) {
    return null;
  }
  
  const dailyCareDetails = [];
  
  stayDates.forEach(dayInfo => {
    const { date, dayOfWeek, rateType, isCheckIn, isCheckOut, isMiddleDay } = dayInfo;
    
    const rawCare = careByDateAndPeriod[date] || { ...defaultCare };
    
    let applicableCare = { morning: 0, afternoon: 0, evening: 0 };
    
    if (isCheckIn) {
      applicableCare.evening = rawCare.evening || 0;
    } else if (isCheckOut) {
      applicableCare.morning = rawCare.morning || 0;
    } else {
      applicableCare.morning = rawCare.morning || 0;
      applicableCare.afternoon = rawCare.afternoon || 0;
      applicableCare.evening = rawCare.evening || 0;
    }
    
    const dayTotal = applicableCare.morning + applicableCare.afternoon + applicableCare.evening;
    
    dailyCareDetails.push({
      date,
      dayOfWeek,
      rateType,
      isCheckIn,
      isCheckOut,
      isMiddleDay,
      rawCare,
      applicableCare,
      dayTotal
    });
  });
  
  const totalCareHours = dailyCareDetails.reduce((sum, day) => sum + day.dayTotal, 0);
  const totalHoursPerDay = defaultCare.morning + defaultCare.afternoon + defaultCare.evening;
  
  const hasCareHours = totalCareHours > 0 || totalHoursPerDay > 0;
  
  return {
    requiresCare: hasCareHours,
    totalHoursPerDay,
    totalCareHours,
    sampleDay: defaultCare,
    careVaries: rawCareData.careVaries,
    dailyCareDetails,
    rawCareData
  };
};

/**
 * Extract care data from booking sections Q&A pairs
 */
const extractCareDataFromBooking = (bookingData) => {
  const possibleSectionSources = [
    bookingData?.originalSections,
    bookingData?.Sections,
    bookingData?.sections,
    bookingData?.data?.sections,
    bookingData?.data?.originalSections
  ];
  
  for (const sections of possibleSectionSources) {
    if (!sections || !Array.isArray(sections)) continue;
    
    for (const section of sections) {
      const qaPairs = section?.QaPairs || section?.qaPairs || section?.qa_pairs || [];
      
      for (const pair of qaPairs) {
        const questionKey = pair?.Question?.question_key || pair?.question_key || pair?.questionKey;
        
        if (questionKey === 'when-do-you-require-care') {
          const answer = pair?.answer;
          
          if (answer) {
            try {
              const careData = typeof answer === 'string' ? JSON.parse(answer) : answer;
              
              if (careData?.careData && careData.careData.length > 0) {
                return careData;
              }
            } catch (e) {
              console.error('Error parsing care data:', e);
            }
          }
        }
      }
    }
  }
  
  if (bookingData?.careData && Array.isArray(bookingData.careData)) {
    return {
      careData: bookingData.careData,
      defaultValues: bookingData.defaultValues || {},
      careVaries: bookingData.careVaries || false
    };
  }
  
  if (bookingData?.data?.careData && Array.isArray(bookingData.data.careData)) {
    return {
      careData: bookingData.data.careData,
      defaultValues: bookingData.data.defaultValues || {},
      careVaries: bookingData.data.careVaries || false
    };
  }
  
  return null;
};

/**
 * Extract care data from form data
 */
const extractCareDataFromFormData = (formDataPages) => {
  if (!formDataPages || !Array.isArray(formDataPages)) return null;
  
  for (const page of formDataPages) {
    if (!page?.Sections) continue;
    
    for (const section of page.Sections) {
      const questions = section?.Questions || [];
      for (const question of questions) {
        const questionKey = question?.question_key;
        
        if (questionKey === 'when-do-you-require-care' && question.answer) {
          try {
            const careData = typeof question.answer === 'string' 
              ? JSON.parse(question.answer) 
              : question.answer;
            
            if (careData?.careData && careData.careData.length > 0) {
              return careData;
            }
          } catch (e) {
            console.error('Error parsing care data from Questions:', e);
          }
        }
      }
      
      const qaPairs = section?.QaPairs || [];
      for (const pair of qaPairs) {
        const questionKey = pair?.Question?.question_key || pair?.question_key;
        
        if (questionKey === 'when-do-you-require-care' && pair.answer) {
          try {
            const careData = typeof pair.answer === 'string' 
              ? JSON.parse(pair.answer) 
              : pair.answer;
            
            if (careData?.careData && careData.careData.length > 0) {
              return careData;
            }
          } catch (e) {
            console.error('Error parsing care data from QaPairs:', e);
          }
        }
      }
    }
  }
  
  return null;
};

/**
 * Extract course data from booking sections Q&A pairs
 */
const extractCourseDataFromBooking = (bookingData) => {
  const possibleSectionSources = [
    bookingData?.originalSections,
    bookingData?.Sections,
    bookingData?.sections,
    bookingData?.data?.sections,
    bookingData?.data?.originalSections
  ];
  
  for (const sections of possibleSectionSources) {
    if (!sections || !Array.isArray(sections)) continue;
    
    for (const section of sections) {
      const qaPairs = section?.QaPairs || section?.qaPairs || section?.qa_pairs || [];
      
      for (const pair of qaPairs) {
        const questionKey = pair?.Question?.question_key || pair?.question_key || pair?.questionKey;
        
        if (questionKey === 'have-you-been-offered-a-place-in-a-course-for-this-stay') {
          const answer = pair?.answer;
          const hasCourse = typeof answer === 'string' && answer.toLowerCase() === 'yes';
          return { hasCourse, courseDay: 1 };
        }
      }
    }
  }
  
  return { hasCourse: false };
};

const SummaryOfStay = ({ 
  bookingData, 
  bookingId, 
  origin, 
  stayDates, 
  bookingAmended, 
  submitBooking,
  careAnalysisData = null,
  courseAnalysisData = null,
  ndisFormFilters = null,
  formData = null
}) => {
  const currentUser = useSelector(state => state.user.user);
  const selectedRooms = useSelector(state => state.bookingRequestForm.rooms);
  const reduxFormData = useSelector(state => state.bookingRequestForm.data);
  
  const [summary, setSummary] = useState();
  const [signaturePad, setSignaturePad] = useState(null);
  const signatureRef = useRef();
  const signatureSectionRef = useRef();
  const [signatureValidationError, setSignatureValidationError] = useState(false);
  const [signatureType, setSignatureType] = useState('drawn');
  const [totalPackageCost, setTotalPackageCost] = useState(0);
  const [totalRoomCosts, setTotalRoomCosts] = useState({
    roomUpgrade: 0,
    additionalRoom: 0,
    hspAccommodation: 0
  });
  const [verbalConsent, setVerbalConsent] = useState({ 
    checked: false, 
    timestamp: null, 
    adminName: currentUser.first_name + ' ' + currentUser.last_name 
  });
  
  const [isSignatureLoading, setIsSignatureLoading] = useState(false);
  const [hasExistingSignature, setHasExistingSignature] = useState(false);
  const [lastResolvedPackageId, setLastResolvedPackageId] = useState(null);
  const [resolvedPackageData, setResolvedPackageData] = useState(null);
  const [isResolvingPackage, setIsResolvingPackage] = useState(false);
  const [processedCareAnalysis, setProcessedCareAnalysis] = useState(null);

  const availableFormData = formData || reduxFormData;

  const summaryContainerRef = useRef();

  // Auto-scroll to top
  useEffect(() => {
    const scrollToTop = () => {
      try {
        scroller.scrollTo('summary-of-stay-top', {
          duration: 350,
          delay: 0,
          smooth: 'easeInOutQuart',
          containerId: 'main-content-container',
          offset: -20,
          isDynamic: true,
          ignoreCancelEvents: false
        });
      } catch (e) {
        console.log('react-scroll failed, trying fallback');
      }

      const mainContainer = document.getElementById('main-content-container');
      if (mainContainer) {
        mainContainer.scrollTo({ top: 0, behavior: 'smooth' });
      }

      if (summaryContainerRef.current) {
        summaryContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToTop();
      });
    });

    const timeoutId = setTimeout(() => {
      scrollToTop();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Helper to check if package is NDIS Support Holiday Package
  const isSupportHolidayPackage = () => {
    if (!resolvedPackageData && !summary?.data) {
      return false;
    }
    
    if (resolvedPackageData?.package_code) {
      return resolvedPackageData.package_code === 'HOLIDAY_SUPPORT_PLUS' || 
             resolvedPackageData.package_code === 'HOLIDAY_SUPPORT';
    }
    
    if (summary?.data?.packageCode) {
      return summary.data.packageCode === 'HOLIDAY_SUPPORT_PLUS' || 
             summary.data.packageCode === 'HOLIDAY_SUPPORT';
    }
    
    const packageName = summary?.data?.ndisPackage || summary?.data?.packageTypeAnswer || '';
    return packageName.includes('Holiday Support');
  };

  const isHolidaySupportPlusPackage = () => {
    if (!resolvedPackageData && !summary?.data) {
      return false;
    }
    
    if (resolvedPackageData?.package_code) {
      return resolvedPackageData.package_code === 'HOLIDAY_SUPPORT_PLUS';
    }
    
    if (summary?.data?.packageCode) {
      return summary.data.packageCode === 'HOLIDAY_SUPPORT_PLUS';
    }
    
    const packageName = summary?.data?.ndisPackage || summary?.data?.packageTypeAnswer || '';
    return packageName.includes('Holiday Support Plus') || packageName.includes('Holiday Support+');
  };

  // Process care data
  useEffect(() => {
    const datesOfStay = summary?.data?.datesOfStay;
    const nights = summary?.data?.nights;
    
    if (!datesOfStay || !nights) {
      return;
    }
    
    if (isProcessedCareData(careAnalysisData)) {
      setProcessedCareAnalysis(careAnalysisData);
      return;
    }
    
    if (isRawCareData(careAnalysisData)) {
      const processed = extractCareAnalysisFromRawData(careAnalysisData, datesOfStay, nights);
      if (processed) {
        setProcessedCareAnalysis(processed);
        return;
      }
    }
    
    if (summary?.data?.careAnalysis) {
      if (isProcessedCareData(summary.data.careAnalysis)) {
        setProcessedCareAnalysis(summary.data.careAnalysis);
        return;
      }
      
      if (summary.data.careAnalysis.rawCareData && isRawCareData(summary.data.careAnalysis.rawCareData)) {
        const processed = extractCareAnalysisFromRawData(summary.data.careAnalysis.rawCareData, datesOfStay, nights);
        if (processed) {
          setProcessedCareAnalysis(processed);
          return;
        }
      }
    }
    
    if (bookingData?.data?.careAnalysis) {
      if (isProcessedCareData(bookingData.data.careAnalysis)) {
        setProcessedCareAnalysis(bookingData.data.careAnalysis);
        return;
      }
      
      if (bookingData.data.careAnalysis.rawCareData && isRawCareData(bookingData.data.careAnalysis.rawCareData)) {
        const processed = extractCareAnalysisFromRawData(bookingData.data.careAnalysis.rawCareData, datesOfStay, nights);
        if (processed) {
          setProcessedCareAnalysis(processed);
          return;
        }
      }
    }
    
    if (availableFormData && availableFormData.length > 0) {
      const rawCareFromFormData = extractCareDataFromFormData(availableFormData);
      if (rawCareFromFormData) {
        const processed = extractCareAnalysisFromRawData(rawCareFromFormData, datesOfStay, nights);
        if (processed) {
          setProcessedCareAnalysis(processed);
          return;
        }
      }
    }
    
    const rawCareFromBooking = extractCareDataFromBooking(bookingData);
    if (rawCareFromBooking) {
      const processed = extractCareAnalysisFromRawData(rawCareFromBooking, datesOfStay, nights);
      if (processed) {
        setProcessedCareAnalysis(processed);
        return;
      }
    }
  }, [summary?.data?.datesOfStay, summary?.data?.nights, careAnalysisData, summary?.data?.careAnalysis, bookingData?.data?.careAnalysis, bookingData, availableFormData]);

  // Get care and course analysis data for PricingTable
  const getAnalysisDataForPricingTable = () => {
    let careData = processedCareAnalysis;
    let courseData = courseAnalysisData;
    
    if (!courseData && summary?.data?.courseAnalysis) {
      courseData = summary.data.courseAnalysis;
    }
    
    if (!courseData || courseData.hasCourse === undefined) {
      const extractedCourseData = extractCourseDataFromBooking(bookingData);
      if (extractedCourseData) {
        courseData = extractedCourseData;
      }
    }
    
    return { careData, courseData };
  };

  const scrollToSignature = () => {
    signatureSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSetSignaturePad = (newSigPad) => {
    if (newSigPad && typeof newSigPad.isEmpty === 'function') {
      setSignaturePad(newSigPad);
    }
  };

  const getNdisFundingType = () => {
    if (!bookingData?.data) {
      return null;
    }
    
    if (bookingData.data.ndisFundingType) {
      return bookingData.data.ndisFundingType;
    }
    
    if (bookingData.originalSections) {
      for (const section of bookingData.originalSections) {
        if (section.QaPairs) {
          const ndisFundingQA = findByQuestionKey(section.QaPairs, 'please-select-from-one-of-the-following-ndis-funding-options');
          if (ndisFundingQA && ndisFundingQA.answer) {
            return ndisFundingQA.answer;
          }
        }
      }
    }
    
    return null;
  };

  const formatFunderDisplay = () => {
    let funderDisplay = summary?.data?.funder || '';
    
    if (funderDisplay.toLowerCase().includes('ndis') || funderDisplay.toLowerCase().includes('ndia')) {
      funderDisplay = 'NDIS';
      
      const ndisFundingType = getNdisFundingType();
      if (ndisFundingType) {
        funderDisplay += ` - ${ndisFundingType}`;
      }
    } else {
      funderDisplay = funderDisplay.charAt(0).toUpperCase() + funderDisplay.slice(1).toLowerCase();
    }
    
    return funderDisplay;
  };

  const updateBooking = async () => {
    if (origin == 'admin') {
      onContinue();
      return;
    }
    
    let hasValidSignature = false;
    
    if (signatureType === 'drawn' || signatureType === 'upload') {
      hasValidSignature = signaturePad && 
        typeof signaturePad.isEmpty === 'function' && 
        !signaturePad.isEmpty();
    }
    
    if (!hasValidSignature && !hasExistingSignature) {
      setSignatureValidationError(true);
      toast.error('Please sign the agreement before continuing.');
      scrollToSignature();
      return;
    }

    setSignatureValidationError(false);

    if (isSignatureLoading) {
      toast.info('Loading signature, please wait...');
      setTimeout(() => updateBooking(), 1000);
      return;
    }

    try {
      const trimmedCanvas = signaturePad.getTrimmedCanvas();
      if (!trimmedCanvas) {
        toast.error('Unable to process signature. Please try signing again.');
        return;
      }

      const signatureData = {
        image: trimmedCanvas.toDataURL('image/png'),
        timestamp: new Date().toISOString(),
        type: signatureType,
        uuid: summary.uuid
      };

      const response = await fetch(`/api/bookings/${bookingId}/signature`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature: signatureData }),
      });

      if (!response.ok) {
        throw new Error('Failed to save signature');
      }

      onContinue();
    } catch (error) {
      console.error('Error saving signature:', error);
      toast.error('Failed to save signature. Please try again.');
    }
  };

  const saveVerbalConsent = async () => {
    if (origin != 'admin') {
      return;
    }

    if (verbalConsent.checked) {
      try {
        const response = await fetch(`/api/bookings/${bookingId}/verbal-consent`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verbalConsent: verbalConsent }),
        });

        if (!response.ok) {
          throw new Error('Failed to save verbal consent');
        }

        return true;
      } catch (error) {
        console.error('Error saving verbal consent:', error);
        toast.error('Failed to save verbal consent. Please try again.');
      }
    } else {
      toast.error('Please confirm verbal consent before continuing.');
      return false;
    }
  };

  const onContinue = () => {
    if (origin && origin == 'admin') {
      if (!bookingData.signature) {
        submitBooking();
        return;
      }

      saveVerbalConsent().then((resp) => {
        if (resp) {
          submitBooking();
        }
      });
    } else {
      submitBooking();
    }
  };

  const clearSignature = () => {
    if (signaturePad && typeof signaturePad.clear === 'function') {
      signaturePad.clear();
    }
    setHasExistingSignature(false);
  };

  const resolvePackageSelection = async () => {
    const currentPackageId = bookingData?.data?.selectedPackageId;
    
    if (currentPackageId && 
        bookingData?.data?.packageSelectionType === 'package-selection' && 
        currentPackageId !== lastResolvedPackageId) {
      try {
        setIsResolvingPackage(true);
        setLastResolvedPackageId(currentPackageId);
        
        const response = await fetch(`/api/packages/${currentPackageId}`);
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.package) {
            const packageData = result.package;
            setResolvedPackageData(packageData);
            
            const updatedSummaryData = { ...bookingData };
            
            if (packageData.name?.includes('Wellness')) {
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageTypeAnswer = packageData.name;
              updatedSummaryData.data.packageCost = packageData.price;
              updatedSummaryData.data.isNDISFunder = false;
              updatedSummaryData.data.packageCode = packageData.package_code;
            } else {
              updatedSummaryData.data.ndisPackage = packageData.name;
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageTypeAnswer = packageData.name;
              updatedSummaryData.data.packageCost = packageData.price;
              updatedSummaryData.data.isNDISFunder = true;
              updatedSummaryData.data.packageCode = packageData.package_code;
            }
            
            setSummary(updatedSummaryData);
          }
        } else {
          setLastResolvedPackageId(null);
        }
      } catch (error) {
        console.error('Error resolving package:', error);
        setLastResolvedPackageId(null);
      } finally {
        setIsResolvingPackage(false);
      }
    }
  };

  const getRoomPrice = (room, isHSP) => {
    if (isHSP) {
      return room.hsp_pricing || room.price || room.price_per_night || 0;
    }
    return room.price || room.price_per_night || 0;
  };

  useEffect(() => {
    let summaryData = { ...bookingData };

    console.log("SummaryData:", summaryData);
    
    const currentPackageId = summaryData?.data?.selectedPackageId;

    // Handle stayDates updates
    if (stayDates?.checkInDate && stayDates?.checkOutDate) {
      const checkIn = moment(stayDates.checkInDate, ['YYYY-MM-DD', 'DD/MM/YYYY']);
      const checkOut = moment(stayDates.checkOutDate, ['YYYY-MM-DD', 'DD/MM/YYYY']);
      
      if (checkIn.isValid() && checkOut.isValid()) {
        const newDatesOfStay = `${checkIn.format('DD/MM/YYYY')} - ${checkOut.format('DD/MM/YYYY')}`;
        const existingDatesOfStay = summaryData?.data?.datesOfStay;
        
        if (!existingDatesOfStay || existingDatesOfStay !== newDatesOfStay) {
          summaryData = {
            ...summaryData,
            data: {
              ...summaryData?.data,
              checkinDate: checkIn.format('DD/MM/YYYY'),
              checkoutDate: checkOut.format('DD/MM/YYYY'),
              datesOfStay: newDatesOfStay,
              nights: checkOut.diff(checkIn, 'days')
            }
          };
        }
      }
    }

    // Resolve package if needed
    if (currentPackageId && 
        summaryData?.data?.packageSelectionType === 'package-selection' && 
        currentPackageId !== lastResolvedPackageId) {
      resolvePackageSelection();
      return;
    }

    const isNDISFunder = summaryData?.data?.funder?.includes('NDIS') || 
                         summaryData?.data?.funder?.includes('NDIA') ? true : false;
    summaryData.data.isNDISFunder = isNDISFunder;
    
    // ✅ FALLBACK: Handle empty or missing packageType
    if (!summaryData.data.packageType || summaryData.data.packageType === '') {
      if (!isNDISFunder && summaryData.data.packageTypeAnswer) {
        summaryData.data.packageType = summaryData.data.packageTypeAnswer;
      } else if (isNDISFunder && summaryData.data.ndisPackage) {
        summaryData.data.packageType = serializePackage(summaryData.data.ndisPackage);
      } else {
        // Last resort: use a default value to prevent empty string
        summaryData.data.packageType = isNDISFunder ? 'NDIS' : 'WELLNESS';
      }
    } else {
      // Normal path
      if (!isNDISFunder) {
        summaryData.data.packageType = summaryData.data.packageTypeAnswer;
      } else {
        summaryData.data.packageType = serializePackage(summaryData.data.ndisPackage);
      }
    }

    // Handle rooms
    let roomsToUse = [];
    
    if (selectedRooms && selectedRooms.length > 0) {
      roomsToUse = selectedRooms;
    } else if (summaryData.rooms && summaryData.rooms.length > 0) {
      roomsToUse = summaryData.rooms;
    } else if (bookingData?.rooms && bookingData.rooms.length > 0) {
      roomsToUse = bookingData.rooms;
    }
    
    // ✅ FALLBACK: Don't filter out studio rooms if they're the only rooms available
    // Only filter studio rooms if there are non-studio rooms available
    const hasNonStudioRooms = roomsToUse.some(room => room.type !== 'studio');
    if (hasNonStudioRooms) {
      summaryData.rooms = roomsToUse.filter(room => room.type !== 'studio');
    } else {
      // Keep all rooms including studios if that's all we have
      summaryData.rooms = roomsToUse;
    }
    
    const nights = summaryData.data?.nights || 0;
    
    const packageCode = resolvedPackageData?.package_code || summaryData?.data?.packageCode || '';
    const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';
    
    // Calculate room costs
    if (roomsToUse && roomsToUse.length > 0) {
      if (isHSP) {
        let totalHspCostPerNight = 0;
        const hspRoomBreakdown = [];
        
        roomsToUse.forEach((room, index) => {
          const roomPrice = getRoomPrice(room, true);
          totalHspCostPerNight += roomPrice;
          
          hspRoomBreakdown.push({
            name: room.room || room.name || room.label || `Room ${index + 1}`,
            type: room.type,
            pricePerNight: roomPrice,
            isMainRoom: index === 0
          });
        });
        
        summaryData.hspRoomBreakdown = hspRoomBreakdown;
        summaryData.hspTotalPerNight = totalHspCostPerNight;
        
        setTotalRoomCosts({
          roomUpgrade: 0,
          additionalRoom: 0,
          hspAccommodation: totalHspCostPerNight * nights
        });
      } else {
        const nonStudioRooms = summaryData.rooms; // Already filtered or kept as is
        
        let roomUpgradePerNight = 0;
        let additionalRoomPerNight = 0;
        
        if (nonStudioRooms.length > 0) {
          roomUpgradePerNight = getRoomPrice(nonStudioRooms[0], false);
          summaryData.roomUpgrade = roomUpgradePerNight;
          
          if (nonStudioRooms.length > 1) {
            additionalRoomPerNight = nonStudioRooms
              .slice(1)
              .reduce((total, room) => total + getRoomPrice(room, false), 0);
          }
          summaryData.additionalRoom = additionalRoomPerNight;
        } else {
          summaryData.roomUpgrade = 0;
          summaryData.additionalRoom = 0;
        }

        setTotalRoomCosts({
          roomUpgrade: roomUpgradePerNight * nights,
          additionalRoom: additionalRoomPerNight * nights,
          hspAccommodation: 0
        });
      }
    }

    // Calculate package cost
    if (!summary?.data?.isNDISFunder) {
      const price = parseFloat(summaryData?.data?.packageCost || 0);
      setTotalPackageCost(price * nights);
    }

    // Handle signature
    if (bookingData.signature?.image) {
      setIsSignatureLoading(true);
      setHasExistingSignature(true);
      setSignatureType(bookingData.signature?.type || 'drawn');
      
      setTimeout(() => {
        setIsSignatureLoading(false);
      }, 2000);
    } else {
      setHasExistingSignature(false);
      setIsSignatureLoading(false);
    }

    if (bookingData.verbal_consent) {
      setVerbalConsent(bookingData.verbal_consent);
    }
    
    setSummary(summaryData);
  }, [bookingData, selectedRooms, resolvedPackageData, lastResolvedPackageId, stayDates]);

  useEffect(() => {
    const currentPackageId = bookingData?.data?.selectedPackageId;
    
    if (currentPackageId && 
        resolvedPackageData && 
        resolvedPackageData.id !== parseInt(currentPackageId)) {
      setResolvedPackageData(null);
      setLastResolvedPackageId(null);
    }
  }, [bookingData?.data?.selectedPackageId]);

  const getTotalOutOfPocketExpenses = () => {
    if (isHolidaySupportPlusPackage() || isSupportHolidayPackage()) {
      return totalRoomCosts.hspAccommodation;
    }
    
    if (summary?.data?.isNDISFunder && 
        ndisFormFilters?.ndisPackageType === 'sta' && 
        summary?.rooms?.length > 0 && 
        summary.rooms[0]?.type === 'ocean_view') {
      
      const oceanViewCost = (summary.rooms[0].price || summary.rooms[0].price_per_night || 0) * (summary?.data?.nights || 0);
      const additionalRoomCost = totalRoomCosts.additionalRoom;
      return oceanViewCost + additionalRoomCost;
    }
    
    return totalRoomCosts.roomUpgrade + totalRoomCosts.additionalRoom;
  };

  useEffect(() => {
    if ((signaturePad && !signaturePad.isEmpty()) || hasExistingSignature) {
      setSignatureValidationError(false);
    }
  }, [signaturePad, hasExistingSignature]);

  const getGrandTotal = () => {
    if (isHolidaySupportPlusPackage()) {
      return getTotalOutOfPocketExpenses();
    }
    return totalPackageCost + getTotalOutOfPocketExpenses();
  };

  if (isResolvingPackage) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading package information...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex justify-center items-center py-12">
          <div className="text-center">
            <p className="text-gray-600">Loading summary...</p>
          </div>
        </div>
      </div>
    );
  }

  const getRoomDisplayInfo = () => {
    const rooms = summary?.rooms || [];
    const nights = summary?.data?.nights || 0;
    
    const packageCode = resolvedPackageData?.package_code || summary?.data?.packageCode || '';
    const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';
    
    if (isHSP) {
      const hspBreakdown = summary?.hspRoomBreakdown || [];
      const totalPerNight = summary?.hspTotalPerNight || 0;
      
      return {
        isHSP: true,
        hspBreakdown: hspBreakdown,
        totalPerNight: totalPerNight,
        totalAccommodation: totalRoomCosts.hspAccommodation,
        roomUpgradeDisplay: 'N/A',
        additionalRoomDisplay: 'N/A'
      };
    }
    
    // ✅ FALLBACK: Use all rooms instead of filtering
    const displayRooms = rooms;
    
    const isStaWithOceanView = summary?.data?.isNDISFunder && 
                               ndisFormFilters?.ndisPackageType === 'sta' && 
                               displayRooms.length > 0 && 
                               displayRooms[0]?.type === 'ocean_view';
    
    let roomUpgradeDisplay = 'N/A';
    let additionalRoomDisplay = 'N/A';
    
    if (isStaWithOceanView) {
      roomUpgradeDisplay = 'N/A';
      const oceanViewPrice = displayRooms[0].price || displayRooms[0].price_per_night || 0;
      if (oceanViewPrice > 0) {
        additionalRoomDisplay = `${formatAUD(oceanViewPrice)} per night (${formatAUD(oceanViewPrice * nights)} total)`;
      }
    } else {
      if (displayRooms.length > 0) {
        const upgradePrice = displayRooms[0].price || displayRooms[0].price_per_night || 0;
        if (upgradePrice > 0) {
          roomUpgradeDisplay = `${formatAUD(upgradePrice)} per night (${formatAUD(upgradePrice * nights)} total)`;
        }
        
        if (displayRooms.length > 1) {
          const additionalPrice = displayRooms
            .slice(1)
            .reduce((total, room) => total + (room.price || room.price_per_night || 0), 0);
          if (additionalPrice > 0) {
            additionalRoomDisplay = `${formatAUD(additionalPrice)} per night (${formatAUD(additionalPrice * nights)} total)`;
          }
        }
      }
    }
    
    return { isHSP: false, roomUpgradeDisplay, additionalRoomDisplay };
  };

  const roomDisplayInfo = getRoomDisplayInfo();
  const analysisData = getAnalysisDataForPricingTable();

  return (
    <Element name="summary-of-stay-top">
      <div ref={summaryContainerRef} className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="flex justify-between items-start mb-6 flex-col sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-slate-700">Summary of Your Stay</h1>
          {origin != 'admin' && (
            <div className="mt-4 sm:mt-0">
              <button 
                onClick={scrollToSignature} 
                className="px-6 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Sign & Submit Your Booking
              </button>
            </div>
          )}
        </div>
        
        {origin != 'admin' && (
          <span className='italic text-red-400 text-lg font-bold block mb-4'>
            Please note, your booking request is not submitted until you review, sign and submit your request below.
          </span>
        )}
        
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Guest Name</h3>
            <p className="text-gray-900 p-2">{summary?.guestName}</p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Funder</h3>
            <p className="text-gray-900 p-2">{formatFunderDisplay()}</p>
          </div>
          
          {summary?.data?.participantNumber && (
            <div>
              <h3 className="font-semibold text-slate-700 mb-1">
                {bookingData.funder} Participant Number
              </h3>
              <p className="text-gray-900 p-2">{summary?.data?.participantNumber}</p>
            </div>
          )}
          
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Number of Nights</h3>
            <p className="text-gray-900 p-2">{summary?.data?.nights}</p>
          </div>
          
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Dates of Stay</h3>
            <p className="text-gray-900 p-2">{summary?.data?.datesOfStay}</p>
          </div>
        </div>

        {(summary?.data?.isNDISFunder || summary?.data?.funder == "ndis") ? (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-700">Package - cost to be charged to your funder:</h2>
            <p className="text-slate-700 mb-2 p-2">
              Package Name: {summary.data.ndisPackage || summary.data.packageType || 'NDIS Package'}
            </p>
            
            {isHolidaySupportPlusPackage() ? (
              <div className="mt-4 p-6 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-sm">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-amber-800 mb-2">Custom Quote Required</h3>
                    <p className="text-base text-amber-900">
                      Our bookings team will send you a quote for NDIS services for this stay based on the information you have provided.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <PricingTable 
                  option={summary?.data?.packageType} 
                  datesOfStay={summary?.data?.datesOfStay} 
                  nights={summary?.data?.nights} 
                  setTotalPackageCost={setTotalPackageCost}
                  packageData={resolvedPackageData}
                  careAnalysisData={analysisData.careData}
                  courseAnalysisData={analysisData.courseData}
                  isSupportHolidayPackage={isSupportHolidayPackage()}
                />
                <div className="mt-2 text-right">
                  <p className="font-semibold text-slate-700">Total Package Cost: {formatAUD(totalPackageCost)}</p>
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-700">Package to be paid for by your funder:</h2>
            <p className="text-slate-700">{`${summary?.data?.packageType || 'Package'} - ${formatAUD(summary?.data?.packageCost || 0)} per night`}</p>
          </div>
        )}

        <div className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold text-slate-700">
            Accommodation (to be paid privately by you)
          </h2>
          
          {roomDisplayInfo.isHSP ? (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold text-slate-700 mb-3">Room Breakdown</h3>
                <div className="space-y-2">
                  {roomDisplayInfo.hspBreakdown.map((room, index) => (
                    <div key={index} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                      <div>
                        <span className="font-medium text-gray-900">{room.name}</span>
                        {room.isMainRoom && (
                          <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">Primary Room</span>
                        )}
                      </div>
                      <span className="text-gray-900">{formatAUD(room.pricePerNight)} per night</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-3 border-t border-gray-300">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold text-slate-700">Total per night:</span>
                    <span className="font-semibold text-gray-900">{formatAUD(roomDisplayInfo.totalPerNight)}</span>
                  </div>
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-slate-600">{summary?.data?.nights} nights</span>
                    <span className="font-bold text-gray-900">{formatAUD(roomDisplayInfo.totalAccommodation)}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-700">Total Accommodation: {formatAUD(roomDisplayInfo.totalAccommodation)}</p>
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Room Upgrade</h3>
                  <p className="text-gray-900 p-2">{roomDisplayInfo.roomUpgradeDisplay}</p>
                </div>
                <div>
                  <h3 className="font-semibold text-slate-700 mb-1">Additional Room</h3>
                  <p className="text-gray-900 p-2">{roomDisplayInfo.additionalRoomDisplay}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold text-slate-700">Total Out of Pocket: {formatAUD(getTotalOutOfPocketExpenses())}</p>
              </div>
            </>
          )}

          {isSupportHolidayPackage() && (
            <div className="mt-4 p-6 bg-amber-50 border-2 border-amber-400 rounded-lg shadow-sm">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-amber-800 mb-2">Funding Assistance Available</h3>
                  <p className="text-base text-amber-900">
                    Funding assistance of {formatAUD(319)} per night for up to 5 nights may be available to you.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold text-slate-700 mb-4">Cost Summary</h2>
          <div className="space-y-2">
            {isHolidaySupportPlusPackage() ? (
              <div className="flex justify-between">
                <span>Package Costs <i>(Quote to be provided by bookings team)</i>:</span>
                <span className="text-amber-600 font-medium">TBD</span>
              </div>
            ) : (
              <div className="flex justify-between">
                <span>Package Costs<i> {`${summary?.data?.isNDISFunder ? "(To be billed to your funder)" : "(To be paid for by your funder)"}`}</i>:</span>
                <span>{formatAUD(totalPackageCost)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Accommodation <i>(To be paid privately by you)</i>:</span>
              <span>{formatAUD(getTotalOutOfPocketExpenses())}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
              <span>Grand Total{isHolidaySupportPlusPackage() ? ' (excluding package costs)' : ''}:</span>
              <span>{formatAUD(getGrandTotal())}</span>
            </div>
          </div>
        </div>

        {((summary?.data?.funder?.includes('NDIS') || summary?.data?.funder?.includes('NDIA')) && summary?.data?.ndisQuestions?.length > 0) && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-slate-700">NDIS Questions</h2>
            <div className="space-y-4">
              {summary.data.ndisQuestions.map((item, index) => (
                <div key={index} className="bg-white p-4 rounded-lg border border-gray-200">
                  <h3 className="font-semibold text-slate-700 mb-2">{item.question}</h3>
                  {Array.isArray(item.answer) ? (
                    <ul className="list-disc pl-5 space-y-1">
                      {item.answer.map((ans, idx) => (
                        <li key={idx} className="text-gray-700">{ans}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-gray-700">{item.answer}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div ref={signatureSectionRef} className="mt-8 space-y-4 pt-4 border-t-2 border-gray-200">
          <div className="flex items-center space-x-2">
            <label className="text-sm text-slate-700">
              I have read, understood and agreed to{' '}
              <a href="https://sargoodoncollaroy.com.au/terms-and-conditions/" target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
                Sargood on Collaroy&apos;s Terms and Conditions
              </a>
            </label>
          </div>

          {signatureValidationError && (
            <div className="p-4 bg-red-50 border-2 border-red-400 rounded-lg">
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <svg className="h-6 w-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-red-800 mb-1">Signature Required</h3>
                  <p className="text-base text-red-900">
                    Please {signatureType === 'drawn' ? 'draw your signature' : 'upload your signature'} before submitting.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(origin == 'admin') && (
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                checked={verbalConsent.checked}
                onChange={(e) => setVerbalConsent({...verbalConsent, checked: e.target.checked, timestamp: new Date().toISOString()})}
                className="rounded-md p-2"
              />
              <label className="text-sm text-slate-700">
                Verbal consent for amendment (s) has been gained from the guest
              </label>
            </div>
          )}

          {origin != 'admin' && verbalConsent.checked && (
            <div className="flex items-center space-x-2">
              <label className="text-sm text-slate-700">
                {`Guest verbal consent of amendment(s) to booking given to ${verbalConsent.adminName} at ${formatAUDate(verbalConsent.timestamp)}.`}
              </label>
            </div>
          )}

          <SignatureInput
            sigPad={signaturePad}
            setSignaturePad={handleSetSignaturePad}
            signatureRef={signatureRef}
            origin={origin}
            clearSignature={clearSignature}
            existingSignature={bookingData.signature?.image}
            signatureType={signatureType}
            setSignatureType={setSignatureType}
            bookingAmended={bookingAmended}
            onSignatureLoaded={(loaded) => {
              setIsSignatureLoading(false);
              if (loaded) {
                setHasExistingSignature(true);
              }
            }}
          />
          
          {isSignatureLoading && (
            <div className="text-sm text-blue-600">Loading signature...</div>
          )}
          
          <div className="flex justify-end mt-6">
            <button
              onClick={updateBooking}
              disabled={isSignatureLoading}
              className={`px-6 py-2 rounded-lg font-medium ${
                isSignatureLoading ? 'bg-gray-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
              } text-white`}
            >
              {isSignatureLoading ? 'Loading...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </Element>
  );
};

export default SummaryOfStay;

/**
 * Calculate care quantity using detailed daily care data
 */
const calculateCareQuantityFromDetails = (lineItem, careAnalysisData) => {
  const { rate_type, care_time } = lineItem;
  
  if (!careAnalysisData?.requiresCare || !careAnalysisData?.dailyCareDetails) {
    return 0;
  }
  
  const dailyDetails = careAnalysisData.dailyCareDetails;
  let totalHours = 0;
  
  const normalizedCareTime = (care_time || '').toLowerCase();
  const isMorning = normalizedCareTime === 'morning';
  const isAfternoon = normalizedCareTime === 'afternoon';
  const isEvening = normalizedCareTime === 'evening';
  const isDaytime = normalizedCareTime === 'daytime' || normalizedCareTime.includes('daytime');
  const isAllPeriods = !normalizedCareTime || normalizedCareTime === '';
  
  dailyDetails.forEach(dayDetail => {
    const { rateType: dayRateType, applicableCare, date } = dayDetail;
    
    if (rate_type && rate_type !== '' && dayRateType !== rate_type) {
      return;
    }
    
    let dayHours = 0;
    
    if (isAllPeriods) {
      dayHours = (applicableCare.morning || 0) + 
                 (applicableCare.afternoon || 0) + 
                 (applicableCare.evening || 0);
    } else if (isDaytime) {
      dayHours = applicableCare.afternoon || 0;
    } else if (isMorning) {
      dayHours = applicableCare.morning || 0;
    } else if (isAfternoon) {
      dayHours = applicableCare.afternoon || 0;
    } else if (isEvening) {
      dayHours = applicableCare.evening || 0;
    }
    
    totalHours += dayHours;
  });
  
  return totalHours;
};

const PricingTable = ({ 
  option, 
  datesOfStay, 
  nights = 0, 
  setTotalPackageCost, 
  packageData, 
  careAnalysisData, 
  courseAnalysisData,
  isSupportHolidayPackage = false 
}) => {
  const [tableData, setTableData] = useState([]);
  const [daysBreakdown, setDaysBreakdown] = useState({
    weekdays: 0, saturdays: 0, sundays: 0, publicHolidays: 0
  });
  const [careDaysBreakdown, setCareDaysBreakdown] = useState({
    weekdays: 0, saturdays: 0, sundays: 0, publicHolidays: 0
  });

  const shouldUseApiLogic = packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0;

  const calculateStayDatesBreakdown = async () => {
    if (!datesOfStay || nights <= 0) return;
    
    try {
      const breakdown = await calculateDaysBreakdown(datesOfStay, nights, false);
      setDaysBreakdown(breakdown);
      
      const careBreakdown = await calculateDaysBreakdown(datesOfStay, nights, true);
      setCareDaysBreakdown(careBreakdown);
    } catch (error) {
      console.error('Error calculating stay dates breakdown:', error);
    }
  };

  const getDaysForRateType = (rateType, breakdown) => {
    if (!rateType || rateType === '') {
      return breakdown.weekdays + breakdown.saturdays + breakdown.sundays + breakdown.publicHolidays;
    }
    
    switch (rateType) {
      case 'weekday': return breakdown.weekdays;
      case 'saturday': return breakdown.saturdays;
      case 'sunday': return breakdown.sundays;
      case 'public_holiday':
      case 'publicHoliday': return breakdown.publicHolidays;
      default: return 0;
    }
  };

  const calculateApiQuantity = (lineItem) => {
    const { line_item_type, rate_type, rate_category } = lineItem;
    
    switch (line_item_type) {
      case 'room':
        return nights;
        
      case 'group_activities':
        return calculateGroupActivitiesQuantity(lineItem);
        
      case 'sleep_over':
        return nights;
        
      case 'course':
        if (!courseAnalysisData?.hasCourse) return 0;
        return 6;
        
      case 'care':
        if (!careAnalysisData?.requiresCare) {
          return 0;
        }
        return calculateCareQuantityFromDetails(lineItem, careAnalysisData);
        
      default:
        if (rate_category === 'day') {
          return getDaysForRateType(rate_type, daysBreakdown);
        } else if (rate_category === 'hour') {
          const daysForType = getDaysForRateType(rate_type, daysBreakdown);
          return daysForType * 12;
        }
        return 0;
    }
  };

  const calculateGroupActivitiesQuantity = (lineItem) => {
    const { rate_type } = lineItem;
    const stayDates = generateStayDatesArray(datesOfStay, nights);
    
    if (stayDates.length === 0) return 0;
    
    let totalHours = 0;
    
    stayDates.forEach((dayInfo, index) => {
      const { rateType: dayRateType, isCheckIn, isCheckOut } = dayInfo;
      
      if (rate_type && rate_type !== '' && dayRateType !== rate_type) {
        return;
      }
      
      const isCourseDay = courseAnalysisData?.hasCourse && index === 1;
      
      if (isCheckIn || isCheckOut) {
        totalHours += 6;
      } else if (isCourseDay) {
        totalHours += 6;
      } else {
        totalHours += 12;
      }
    });
    
    return totalHours;
  };

  const processApiPackageData = () => {
    const processedRows = packageData.ndis_line_items
      .filter(lineItem => {
        if (isSupportHolidayPackage && lineItem.line_item_type === 'room') {
          return false;
        }
        if (lineItem.line_item_type === 'course' && (!courseAnalysisData || !courseAnalysisData.hasCourse)) {
          return false;
        }
        return true;
      })
      .map(lineItem => {
        const quantity = calculateApiQuantity(lineItem);
        const rate = parseFloat(lineItem.price_per_night || 0);
        const total = rate * quantity;

        const rateCategoryLabel = lineItem.rate_category === 'hour' ? '/hour' : lineItem.rate_category === 'day' ? '/day' : '/night';
        const rateCategoryQtyLabel = lineItem.rate_category === 'hour' ? 'hrs' : lineItem.rate_category === 'day' ? 'days' : 'nights';

        return {
          description: lineItem.sta_package || lineItem.description || 'Package Item',
          lineItem: lineItem.line_item || lineItem.line_item_code || 'N/A',
          rate: rate,
          quantity: quantity,
          total: total,
          funder: packageData?.ndis_package_type === 'holiday-plus' 
            ? (lineItem.line_item_type === 'room' ? 'Self/Foundation' : 'NDIS') 
            : '',
          rateCategory: lineItem.rate_category || 'day',
          rateCategoryLabel: rateCategoryLabel,
          rateCategoryQtyLabel: rateCategoryQtyLabel,
          lineItemType: lineItem.line_item_type || '',
          rateType: lineItem.rate_type || 'BLANK'
        };
      });

    const filteredRows = processedRows.filter(row => row.quantity > 0);
    
    setTableData(filteredRows);

    const totalCost = filteredRows.reduce((sum, row) => sum + row.total, 0);
    if (setTotalPackageCost) {
      setTotalPackageCost(totalCost);
    }

    return filteredRows;
  };

  const processStaticPackageData = () => {
    const staticPricing = getStaticHourlyPricing(option);
    
    // ✅ FALLBACK: If no pricing data, return empty array but don't fail
    if (!staticPricing || staticPricing.length === 0) {
      setTableData([]);
      if (setTotalPackageCost) setTotalPackageCost(0);
      return [];
    }

    const processedRows = staticPricing
      .filter(row => {
        const daysForType = getDaysForRateType(row.type, daysBreakdown);
        return daysForType > 0;
      })
      .map(row => {
        const daysForType = getDaysForRateType(row.type, daysBreakdown);
        const hoursForType = daysForType * 24;
        const totalForRow = row.hourlyRate * hoursForType;
        
        return {
          description: row.itemDescription,
          lineItem: row.lineItem,
          rate: row.hourlyRate,
          quantity: hoursForType,
          total: totalForRow,
          funder: '',
          rateCategory: 'hour',
          rateCategoryLabel: '/hour',
          rateCategoryQtyLabel: 'hours',
          lineItemType: 'static',
          rateType: row.type
        };
      });

    setTableData(processedRows);
    
    const totalCost = processedRows.reduce((sum, row) => sum + row.total, 0);
    if (setTotalPackageCost) {
      setTotalPackageCost(totalCost);
    }

    return processedRows;
  };

  const getStaticHourlyPricing = (option) => {
    // ✅ FALLBACK: Handle empty or unknown packageType
    if (!option || option === '' || option === 'NDIS' || option === 'WELLNESS') {
      // Return empty array for legacy/unknown packages
      return [];
    }
    
    switch (option) {
      case 'SP':
        return [
          { itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", lineItem: "01_200_0115_1_1", hourlyRate: 39.58, type: 'weekday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", lineItem: "01_202_0115_1_1", hourlyRate: 45.83, type: 'saturday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", lineItem: "01_203_0115_1_1", hourlyRate: 52.08, type: 'sunday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", lineItem: "01_204_0115_1_1", hourlyRate: 62.50, type: 'publicHoliday' }
        ];
      case 'CSP':
        return [
          { itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", lineItem: "01_200_0115_1_1", hourlyRate: 45.83, type: 'weekday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", lineItem: "01_202_0115_1_1", hourlyRate: 58.33, type: 'saturday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", lineItem: "01_203_0115_1_1", hourlyRate: 72.92, type: 'sunday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", lineItem: "01_204_0115_1_1", hourlyRate: 83.33, type: 'publicHoliday' }
        ];
      case 'HCSP':
        return [
          { itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", lineItem: "01_200_0115_1_1", hourlyRate: 72.50, type: 'weekday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", lineItem: "01_202_0115_1_1", hourlyRate: 77.08, type: 'saturday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", lineItem: "01_203_0115_1_1", hourlyRate: 83.33, type: 'sunday' },
          { itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", lineItem: "01_204_0115_1_1", hourlyRate: 93.75, type: 'publicHoliday' }
        ];
      default:
        return [];
    }
  };

  const processPackageData = () => {
    if (shouldUseApiLogic) {
      return processApiPackageData();
    } else {
      return processStaticPackageData();
    }
  };

  useEffect(() => {
    calculateStayDatesBreakdown();
  }, [datesOfStay, nights]);

  useEffect(() => {
    const canProcess = shouldUseApiLogic 
      ? (packageData && Object.keys(careDaysBreakdown).some(key => careDaysBreakdown[key] > 0))
      : Object.keys(careDaysBreakdown).some(key => careDaysBreakdown[key] > 0);
      
    if (canProcess) {
      processPackageData();
    }
  }, [packageData, daysBreakdown, careDaysBreakdown, careAnalysisData, courseAnalysisData, shouldUseApiLogic, isSupportHolidayPackage]);

  // ✅ FALLBACK: Show a more user-friendly message for legacy data
  if (!tableData || tableData.length === 0) {
    return (
      <div className="w-full max-w-4xl p-4 text-center text-gray-500">
        {shouldUseApiLogic 
          ? "No applicable pricing information available for this package and stay dates."
          : "Package pricing will be confirmed by our bookings team."}
      </div>
    );
  }

  const showFunderColumn = shouldUseApiLogic && packageData?.ndis_package_type === 'holiday-plus';
  const hasCareItems = tableData.some(row => row.lineItemType === 'care');

  return (
    <div className="w-full max-w-6xl">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-[#20485A] text-white">
            <th className="p-3 text-left border border-gray-300">
              {shouldUseApiLogic ? 'Description' : 'Item'}
            </th>
            <th className="p-3 text-left border border-gray-300">Line Item</th>
            <th className="p-3 text-left border border-gray-300">
              {shouldUseApiLogic ? 'Rate' : 'Hourly Rate'}
            </th>
            <th className="p-3 text-left border border-gray-300">
              {shouldUseApiLogic ? 'Qty' : 'Hours'}
            </th>
            <th className="p-3 text-left border border-gray-300">Total ($)</th>
            {showFunderColumn && (
              <th className="p-3 text-left border border-gray-300">Funder</th>
            )}
          </tr>
        </thead>
        <tbody>
          {tableData.map((row, index) => (
            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="p-3 border border-gray-300">
                <div className="font-medium">{row.description}</div>
              </td>
              <td className="p-3 border border-gray-300">{row.lineItem}</td>
              <td className="p-3 border border-gray-300">
                {formatAUD(row.rate)}
                {shouldUseApiLogic && (
                  <div className="text-sm text-gray-600">{row.rateCategoryLabel}</div>
                )}
              </td>
              <td className="p-3 border border-gray-300">
                {shouldUseApiLogic ? (
                  <>
                    {row.quantity}
                    <div className="text-sm text-gray-600">{row.rateCategoryQtyLabel}</div>
                  </>
                ) : (
                  row.quantity.toFixed(0)
                )}
              </td>
              <td className="p-3 border border-gray-300">{formatAUD(row.total)}</td>
              {showFunderColumn && (
                <td className="p-3 border border-gray-300">
                  <span className={`px-2 py-1 rounded text-sm ${
                    row.funder === 'NDIS' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {row.funder}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {hasCareItems && (
        <div className="mt-2 text-sm text-gray-600 italic">
          * Care fees reflect requested care at the time of booking submission and may vary based on actual care hours used.
          <br />
          <span className="text-xs text-gray-500">
            Note: Check-in day includes evening care only. Check-out day includes morning care only.
          </span>
        </div>
      )}
    </div>
  );
};

const formatAUDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};