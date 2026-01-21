import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SignatureInput from './signature-pad';
import { getNSWHolidaysV2, calculateDaysBreakdown } from '../../services/booking/create-summary-data';
import { serializePackage } from '../../utilities/common';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';
import { scroller, Element } from 'react-scroll';
import { formatAUD } from '../../utilities/priceUtil';

const SummaryOfStay = ({ 
  bookingData, 
  bookingId, 
  origin, 
  getRequestFormTemplate, 
  bookingAmended, 
  submitBooking,
  careAnalysisData = null,
  courseAnalysisData = null,
  ndisFormFilters = null
}) => {
  const currentUser = useSelector(state => state.user.user);
  const selectedRooms = useSelector(state => state.bookingRequestForm.rooms);
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
    hspAccommodation: 0 // For HSP packages - all rooms use hsp_pricing
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

  const summaryContainerRef = useRef();

  // ✅ Auto-scroll to top when Summary of Stay is displayed
  useEffect(() => {
    // Use multiple approaches to ensure scrolling works
    const scrollToTop = () => {
      // Approach 1: Try react-scroll's scroller
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

      // Approach 2: Direct DOM scroll on the container
      const mainContainer = document.getElementById('main-content-container');
      if (mainContainer) {
        mainContainer.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }

      // Approach 3: Scroll the summary container into view
      if (summaryContainerRef.current) {
        summaryContainerRef.current.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }

      // Approach 4: Window scroll as last resort
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    };

    // Use double requestAnimationFrame to ensure DOM is fully painted
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        scrollToTop();
      });
    });

    // Also try after a small delay in case the DOM isn't ready
    const timeoutId = setTimeout(() => {
      scrollToTop();
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  // Helper to check if package is NDIS Support Holiday Package (any type)
  const isSupportHolidayPackage = () => {
    // ✅ FIX: Check if package data is available first
    if (!resolvedPackageData && !summary?.data) {
      return false;
    }
    
    // Check from resolved package data API response first (most reliable)
    if (resolvedPackageData?.package_code) {
      return resolvedPackageData.package_code === 'HOLIDAY_SUPPORT_PLUS' || 
             resolvedPackageData.package_code === 'HOLIDAY_SUPPORT';
    }
    
    // Fallback: Check from summary data
    if (summary?.data?.packageCode) {
      return summary.data.packageCode === 'HOLIDAY_SUPPORT_PLUS' || 
             summary.data.packageCode === 'HOLIDAY_SUPPORT';
    }
    
    // Fallback: Check package name
    const packageName = summary?.data?.ndisPackage || summary?.data?.packageTypeAnswer || '';
    return packageName.includes('Holiday Support');
  };

  // Helper to check if package is specifically HOLIDAY_SUPPORT_PLUS (requires custom quote)
  const isHolidaySupportPlusPackage = () => {
    if (!resolvedPackageData && !summary?.data) {
      return false;
    }
    
    // Check from resolved package data API response first (most reliable)
    if (resolvedPackageData?.package_code) {
      return resolvedPackageData.package_code === 'HOLIDAY_SUPPORT_PLUS';
    }
    
    // Fallback: Check from summary data
    if (summary?.data?.packageCode) {
      return summary.data.packageCode === 'HOLIDAY_SUPPORT_PLUS';
    }
    
    // Fallback: Check package name for "Plus" variant
    const packageName = summary?.data?.ndisPackage || summary?.data?.packageTypeAnswer || '';
    return packageName.includes('Holiday Support Plus') || packageName.includes('Holiday Support+');
  };

  // NEW: Extract care and course data from summary if not provided as props
  const getAnalysisDataFromSummary = () => {
    let extractedCareData = careAnalysisData;
    let extractedCourseData = courseAnalysisData;
    
    if (!extractedCareData && summary?.data?.careAnalysis) {
      extractedCareData = summary.data.careAnalysis;
    }
    
    if (!extractedCourseData && summary?.data?.courseAnalysis) {
      extractedCourseData = summary.data.courseAnalysis;
    }
    
    if (!extractedCareData && summary?.data?.ndisQuestions) {
      const careQuestions = summary.data.ndisQuestions.filter(q => 
        q.question?.toLowerCase().includes('care') || 
        q.question?.toLowerCase().includes('assistance')
      );
      
      if (careQuestions.length > 0) {
        extractedCareData = {
          requiresCare: true,
          totalHoursPerDay: 6,
          carePattern: 'moderate-care',
          sampleDay: { morning: 2, afternoon: 2, evening: 2 }
        };
      }
    }
    
    return { careData: extractedCareData, courseData: extractedCourseData };
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
      console.log('No bookingData.data available');
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
    
    if (bookingData.data.ndisQuestions && Array.isArray(bookingData.data.ndisQuestions)) {
      const fundingTypeQuestion = bookingData.data.ndisQuestions.find(q => 
        q.question && q.question.toLowerCase().includes('ndis funding options')
      );
      if (fundingTypeQuestion && fundingTypeQuestion.answer) {
        return fundingTypeQuestion.answer;
      }
    }
    
    console.log('NDIS funding type not found');
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
    
    // Validate signature based on type
    let hasValidSignature = false;
    
    if (signatureType === 'drawn') {
        // For drawn signatures, check if signature pad has content
        hasValidSignature = signaturePad && 
            typeof signaturePad.isEmpty === 'function' && 
            !signaturePad.isEmpty();
    } else if (signatureType === 'upload') {
        // For uploaded signatures, check if signature pad has been populated with image
        hasValidSignature = signaturePad && 
            typeof signaturePad.isEmpty === 'function' && 
            !signaturePad.isEmpty();
    }
    
    // Also check if there's an existing signature from previous submission
    if (!hasValidSignature && !hasExistingSignature) {
        setSignatureValidationError(true); // Show visual error
        toast.error('Please sign the agreement before continuing. You can either draw your signature or upload an image of your signature.');
        scrollToSignature();
        return;
    }

    // Clear error if validation passes
    setSignatureValidationError(false);

    if (isSignatureLoading) {
        toast.info('Loading signature, please wait...');
        setTimeout(() => updateBooking(), 1000);
        return;
    }

    console.log('Signature is valid, proceeding to save...');
    try {
        // Validate we can get the canvas data
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
            headers: {
                'Content-Type': 'application/json',
            },
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
                headers: {
                    'Content-Type': 'application/json',
                },
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
  }

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
  }

  const clearSignature = () => {
    if (signaturePad && typeof signaturePad.clear === 'function') {
      signaturePad.clear();
    }
    setHasExistingSignature(false);
  };

  const resolvePackageSelection = async () => {
    const currentPackageId = bookingData?.data?.selectedPackageId;
    
    // ✅ FIX: Check if this is a NEW package that needs resolution
    if (currentPackageId && 
        bookingData?.data?.packageSelectionType === 'package-selection' && 
        currentPackageId !== lastResolvedPackageId) {  // Changed from !packageResolved
      try {
        setIsResolvingPackage(true);
        setLastResolvedPackageId(currentPackageId);  // Track the package we're resolving
        
        console.log('🔄 Resolving package selection:', currentPackageId);
        
        const response = await fetch(`/api/packages/${currentPackageId}`);
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.package) {
            const packageData = result.package;
            
            console.log('✅ Package resolved successfully:', {
              packageId: packageData.id,
              packageCode: packageData.package_code,
              packageName: packageData.name
            });
            
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
            
            console.log('✅ Summary updated with resolved package data:', {
              packageName: packageData.name,
              isNDIS: updatedSummaryData.data.isNDISFunder
            });
          }
        } else {
          console.error('❌ Failed to fetch package details:', currentPackageId);
          // Reset on failure so it can retry
          setLastResolvedPackageId(null);
        }
      } catch (error) {
        console.error('❌ Error resolving package selection:', error);
        // Reset on error so it can retry
        setLastResolvedPackageId(null);
      } finally {
        setIsResolvingPackage(false);
      }
    }
  };

  // ✅ NEW: Helper to get room price based on package type
  const getRoomPrice = (room, isHSP) => {
    if (isHSP) {
      // For HSP packages, use hsp_pricing if available, otherwise fall back to regular price
      return room.hsp_pricing || room.price || room.price_per_night || 0;
    }
    // For non-HSP packages, use regular pricing
    return room.price || room.price_per_night || 0;
  };

  useEffect(() => {
    let summaryData = { ...bookingData };
    
    const currentPackageId = summaryData?.data?.selectedPackageId;

    console.log('Summary Data:', summaryData);

    // ✅ FIX: Check if this is a NEW package that needs resolution
    if (currentPackageId && 
        summaryData?.data?.packageSelectionType === 'package-selection' && 
        currentPackageId !== lastResolvedPackageId) {  // Changed from !packageResolved
      console.log('📦 Package selection detected/changed, resolving...', {
        currentPackageId,
        lastResolvedPackageId
      });
      resolvePackageSelection();
      return; // Exit early, wait for resolution
    }

    // Only proceed with summary setup if package is resolved or not needed
    const isNDISFunder = summaryData?.data?.funder?.includes('NDIS') || 
                         summaryData?.data?.funder?.includes('NDIA') ? true : false;
    summaryData.data.isNDISFunder = isNDISFunder;
    
    if (!isNDISFunder) {
      summaryData.data.packageType = summaryData.data.packageTypeAnswer;
    } else {
      summaryData.data.packageType = serializePackage(summaryData.data.ndisPackage);
    }

    // ✅ FIX: Properly handle rooms - check both selectedRooms and bookingData.rooms
    let roomsToUse = [];
    
    if (selectedRooms && selectedRooms.length > 0) {
      roomsToUse = selectedRooms;
    } else if (summaryData.rooms && summaryData.rooms.length > 0) {
      roomsToUse = summaryData.rooms;
    } else if (bookingData?.rooms && bookingData.rooms.length > 0) {
      roomsToUse = bookingData.rooms;
    }
    
    // Don't filter out studio rooms - they are valid selections
    // Only filter for room upgrade/additional room calculations
    summaryData.rooms = roomsToUse;
    
    // Calculate room costs
    const nights = summaryData.data?.nights || 0;
    
    // ✅ Determine if this is an HSP package for pricing logic
    const packageCode = resolvedPackageData?.package_code || summaryData?.data?.packageCode || '';
    const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';
    
    if (roomsToUse && roomsToUse.length > 0) {
      if (isHSP) {
        // ✅ HSP PACKAGE LOGIC: All rooms use hsp_pricing, including main room
        console.log('🏨 Calculating HSP room costs using hsp_pricing...');
        
        let totalHspCostPerNight = 0;
        const hspRoomBreakdown = [];
        
        roomsToUse.forEach((room, index) => {
          const roomPrice = getRoomPrice(room, true); // Use HSP pricing
          totalHspCostPerNight += roomPrice;
          
          hspRoomBreakdown.push({
            name: room.room || room.name || room.label || `Room ${index + 1}`,
            type: room.type,
            pricePerNight: roomPrice,
            isMainRoom: index === 0
          });
          
          console.log(`  Room ${index + 1} (${room.type}): $${roomPrice}/night (hsp_pricing)`);
        });
        
        summaryData.hspRoomBreakdown = hspRoomBreakdown;
        summaryData.hspTotalPerNight = totalHspCostPerNight;
        
        setTotalRoomCosts({
          roomUpgrade: 0,
          additionalRoom: 0,
          hspAccommodation: totalHspCostPerNight * nights
        });
        
        console.log('🏨 HSP Room costs calculated:', {
          totalRooms: roomsToUse.length,
          totalPerNight: totalHspCostPerNight,
          nights,
          totalHspAccommodation: totalHspCostPerNight * nights
        });
      } else {
        // ✅ NON-HSP PACKAGE LOGIC: Standard room upgrade/additional room calculations
        // For room cost calculations, we need to identify:
        // 1. Base room (included in package - typically studio for NDIS)
        // 2. Room upgrade (if first room is not studio)
        // 3. Additional rooms (any rooms beyond the first)
        
        // Find the first non-studio room for upgrade calculation
        const nonStudioRooms = roomsToUse.filter(room => room.type !== 'studio');
        
        let roomUpgradePerNight = 0;
        let additionalRoomPerNight = 0;
        
        if (nonStudioRooms.length > 0) {
          // First non-studio room is the upgrade
          roomUpgradePerNight = getRoomPrice(nonStudioRooms[0], false);
          summaryData.roomUpgrade = roomUpgradePerNight;
          
          // Additional rooms are any non-studio rooms after the first
          if (nonStudioRooms.length > 1) {
            additionalRoomPerNight = nonStudioRooms
              .slice(1)
              .reduce((total, room) => total + getRoomPrice(room, false), 0);
          }
          summaryData.additionalRoom = additionalRoomPerNight;
        } else {
          // All rooms are studio - no upgrade costs
          summaryData.roomUpgrade = 0;
          summaryData.additionalRoom = 0;
        }

        setTotalRoomCosts({
          roomUpgrade: roomUpgradePerNight * nights,
          additionalRoom: additionalRoomPerNight * nights,
          hspAccommodation: 0
        });
        
        console.log('🏨 Standard Room costs calculated:', {
          totalRooms: roomsToUse.length,
          nonStudioRooms: nonStudioRooms.length,
          roomUpgradePerNight,
          additionalRoomPerNight,
          nights,
          totalRoomUpgrade: roomUpgradePerNight * nights,
          totalAdditionalRoom: additionalRoomPerNight * nights
        });
      }
    }

    if (!summary?.data?.isNDISFunder) {
      const price = parseFloat(summaryData?.data?.packageCost || 0);
      setTotalPackageCost(price * nights);
    }

    if (bookingData.signature?.image) {
      console.log('Loading existing signature...');
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
  }, [bookingData, selectedRooms, resolvedPackageData, lastResolvedPackageId]);

  // Reset resolution state when navigating away and back with different data
  useEffect(() => {
      const currentPackageId = bookingData?.data?.selectedPackageId;
      
      // If the package ID changed and we have stale resolved data, clear it
      if (currentPackageId && 
          resolvedPackageData && 
          resolvedPackageData.id !== parseInt(currentPackageId)) {
        console.log('🔄 Package ID mismatch detected, clearing stale data:', {
          currentPackageId,
          resolvedPackageId: resolvedPackageData.id
        });
        setResolvedPackageData(null);
        setLastResolvedPackageId(null);
      }
  }, [bookingData?.data?.selectedPackageId]);

  const getTotalOutOfPocketExpenses = () => {
    // ✅ For HSP packages, use the HSP accommodation cost
    if (isHolidaySupportPlusPackage() || isSupportHolidayPackage()) {
      return totalRoomCosts.hspAccommodation;
    }
    
    // For STA with ocean view special handling
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
    // Clear validation error when user provides signature
    if ((signaturePad && !signaturePad.isEmpty()) || hasExistingSignature) {
        setSignatureValidationError(false);
    }
  }, [signaturePad, hasExistingSignature]);

  const getGrandTotal = () => {
    // For HOLIDAY_SUPPORT_PLUS, don't include package cost in grand total
    // since it will be quoted separately
    if (isHolidaySupportPlusPackage()) {
      return getTotalOutOfPocketExpenses();
    }
    return totalPackageCost + getTotalOutOfPocketExpenses();
  };

  // ✅ Show loading state while package is being resolved
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

  // ✅ Don't render the component until we have summary data
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

  // Helper to get room display info
  const getRoomDisplayInfo = () => {
    const rooms = summary?.rooms || [];
    const nights = summary?.data?.nights || 0;
    
    // ✅ Check if HSP package first
    const packageCode = resolvedPackageData?.package_code || summary?.data?.packageCode || '';
    const isHSP = packageCode === 'HOLIDAY_SUPPORT_PLUS' || packageCode === 'HOLIDAY_SUPPORT';
    
    if (isHSP) {
      // For HSP packages, return the breakdown with hsp_pricing
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
    
    // Non-HSP logic
    const nonStudioRooms = rooms.filter(room => room.type !== 'studio');
    
    // Check if this is STA package with ocean view special handling
    const isStaWithOceanView = summary?.data?.isNDISFunder && 
                               ndisFormFilters?.ndisPackageType === 'sta' && 
                               nonStudioRooms.length > 0 && 
                               nonStudioRooms[0]?.type === 'ocean_view';
    
    let roomUpgradeDisplay = 'N/A';
    let additionalRoomDisplay = 'N/A';
    
    if (isStaWithOceanView) {
      // For STA with ocean view: upgrade shows N/A, ocean view cost goes to additional
      roomUpgradeDisplay = 'N/A';
      const oceanViewPrice = nonStudioRooms[0].price || nonStudioRooms[0].price_per_night || 0;
      if (oceanViewPrice > 0) {
        additionalRoomDisplay = `${formatAUD(oceanViewPrice)} per night (${formatAUD(oceanViewPrice * nights)} total)`;
      }
    } else {
      // Standard display logic
      if (nonStudioRooms.length > 0) {
        const upgradePrice = nonStudioRooms[0].price || nonStudioRooms[0].price_per_night || 0;
        if (upgradePrice > 0) {
          roomUpgradeDisplay = `${formatAUD(upgradePrice)} per night (${formatAUD(upgradePrice * nights)} total)`;
        }
        
        // Additional rooms (beyond the first non-studio)
        if (nonStudioRooms.length > 1) {
          const additionalPrice = nonStudioRooms
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
      
      {origin != 'admin' && <span className='italic text-red-400 text-lg font-bold block mb-4'>Please note, your booking request is not submitted until you review, sign and submit your request below.</span>}
      
      <div className="grid grid-cols-2 gap-6">
        <div>
          <h3 className="font-semibold text-slate-700 mb-1">Guest Name</h3>
          <p className="text-gray-900 p-2">{ summary?.guestName }</p>
        </div>
        <div>
          <h3 className="font-semibold text-slate-700 mb-1">Funder</h3>
          <p className="text-gray-900 p-2">{ formatFunderDisplay() }</p>
        </div>
        
        {summary?.data?.participantNumber && (
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">
              {bookingData.funder} Participant Number
            </h3>
            <p className="text-gray-900 p-2">{ summary?.data?.participantNumber }</p>
          </div>
        )}
        
        <div>
          <h3 className="font-semibold text-slate-700 mb-1">Number of Nights</h3>
          <p className="text-gray-900 p-2">{ summary?.data?.nights }</p>
        </div>
        
        <div>
          <h3 className="font-semibold text-slate-700 mb-1">Dates of Stay</h3>
          <p className="text-gray-900 p-2">
            { summary?.data?.datesOfStay }
          </p>
        </div>
      </div>

      {(summary?.data?.isNDISFunder || summary?.data?.funder == "ndis") ? (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">Package - cost to be charged to your funder:</h2>
          <p className="text-slate-700 mb-2 p-2">Package Name: { summary.data.ndisPackage }</p>
          
          {/* ✅ For HOLIDAY_SUPPORT_PLUS: Show quote message instead of pricing table */}
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
                careAnalysisData={getAnalysisDataFromSummary().careData}
                courseAnalysisData={getAnalysisDataFromSummary().courseData}
                isSupportHolidayPackage={isSupportHolidayPackage()}
              />
              <div className="mt-2 text-right">
                <p className="font-semibold text-slate-700">Total Package Cost: {formatAUD(totalPackageCost)}</p>
              </div>
            </>
          )}
        </div>
      ): (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">Package to be paid for by your funder:</h2>
          <p className="text-slate-700">{` ${summary?.data?.packageType} - ${formatAUD(summary?.data?.packageCost || 0)} per night`}</p>
        </div>
      )}

      {/* ✅ UPDATED: Accommodation section with HSP pricing support */}
      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">
          Accommodation (to be paid privately by you)
        </h2>
        
        {roomDisplayInfo.isHSP ? (
          // ✅ HSP Package: Show detailed room breakdown with hsp_pricing
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
                    <span className="text-gray-900">
                      {formatAUD(room.pricePerNight)} per night
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-300">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-700">Total per night:</span>
                  <span className="font-semibold text-gray-900">
                    {formatAUD(roomDisplayInfo.totalPerNight)}
                  </span>
                </div>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-slate-600">
                    {summary?.data?.nights} nights
                  </span>
                  <span className="font-bold text-gray-900">
                    {formatAUD(roomDisplayInfo.totalAccommodation)}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-slate-700">
                Total Accommodation: {formatAUD(roomDisplayInfo.totalAccommodation)}
              </p>
            </div>
          </div>
        ) : (
          // Non-HSP Package: Standard room upgrade/additional room display
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

        {/* ✅ MOVED: Funding assistance disclaimer - now under accommodation section */}
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
                  Funding assistance of {formatAUD(319)} per night for up to 5 nights may be available to you. Our bookings team will provide more information when processing your booking.
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
            <>
              <div className="flex justify-between">
                <span>Package Costs <i>(Quote to be provided by bookings team)</i>:</span>
                <span className="text-amber-600 font-medium">TBD</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between">
              <span>Package Costs{<i> {`${summary?.data?.isNDISFunder ? "(To be billed to your funder)" : "(To be paid for by your funder)"}`}</i>}:</span>
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

        {/* Show validation error if signature is missing */}
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
                            Please {signatureType === 'drawn' ? 'draw your signature' : 'upload your signature'} before submitting your booking.
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
              onChange={(e) => setVerbalConsent({...verbalConsent, checked: e.target.checked, timestamp: new Date().toISOString() })}
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
                { `Guest verbal consent of amendment(s) to booking given to ${verbalConsent.adminName} at ${formatAUDate(verbalConsent.timestamp)}.` }
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
          <div className="text-sm text-blue-600">
            Loading signature...
          </div>
        )}
        
        <div className="flex justify-end mt-6">
          <button
            onClick={updateBooking}
            disabled={isSignatureLoading}
            className={`px-6 py-2 rounded-lg font-medium ${
              isSignatureLoading 
                ? 'bg-gray-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-700'
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
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0
  });

  // Separate breakdown for care that includes all calendar days
  const [careDaysBreakdown, setCareDaysBreakdown] = useState({
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0
  });

  const shouldUseApiLogic = packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0;

  const calculateStayDatesBreakdown = async () => {
    if (!datesOfStay || nights <= 0) return;
    
    try {
      // Service days breakdown (excludes check-in day)
      const breakdown = await calculateDaysBreakdown(datesOfStay, nights, false);
      setDaysBreakdown(breakdown);
      
      // ✅ Care days breakdown (includes ALL calendar days: check-in through check-out)
      const careBreakdown = await calculateDaysBreakdown(datesOfStay, nights, true);
      setCareDaysBreakdown(careBreakdown);
      
      console.log('📅 Days breakdown calculated:', {
        serviceDays: breakdown,
        careDays: careBreakdown,
        nights
      });
    } catch (error) {
      console.error('Error calculating stay dates breakdown:', error);
    }
  };

  const processStaticPackageData = () => {
    console.log('Using static pricing logic for option:', option);
    
    const staticPricing = getStaticHourlyPricing(option);
    
    if (!staticPricing || staticPricing.length === 0) {
      console.log('No static pricing found for option:', option);
      setTableData([]);
      if (setTotalPackageCost) setTotalPackageCost(0);
      return [];
    }

    const applicableRows = staticPricing.filter(row => {
      const hoursForType = getHoursForStaticType(row.type);
      return hoursForType > 0;
    });

    const processedRows = applicableRows.map(row => {
      const hoursForType = getHoursForStaticType(row.type);
      const totalForRow = row.hourlyRate * hoursForType;

      let rateCategoryLabel = '/hour';
      let rateCategoryQtyLabel = 'hours';
      if (row.rate_category === 'day') {
        rateCategoryLabel = '/day';
        rateCategoryQtyLabel = 'days';
      } else if (row.rate_category === 'night') {
        rateCategoryLabel = '/night';
        rateCategoryQtyLabel = 'nights';
      }
      
      return {
        description: row.itemDescription,
        lineItem: row.lineItem,
        rate: row.hourlyRate,
        quantity: hoursForType,
        total: totalForRow,
        funder: '',
        rateCategory: 'hour',
        rateCategoryLabel: rateCategoryLabel,
        rateCategoryQtyLabel: rateCategoryQtyLabel,
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

  const getHoursForStaticType = (type) => {
    const daysForType = getDaysForRateType(type, daysBreakdown);
    return daysForType * 24;
  };

  const getStaticHourlyPricing = (option) => {
    const HOURS_PER_DAY = 24;
    
    switch (option) {
      case 'SP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 39.58,
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 45.83,
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 52.08,
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 62.50,
            type: 'publicHoliday' 
          }
        ];
      case 'CSP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 45.83,
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 58.33,
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 72.92,
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 83.33,
            type: 'publicHoliday' 
          }
        ];
      case 'HCSP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 72.50,
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 77.08,
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 83.33,
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 93.75,
            type: 'publicHoliday' 
          }
        ];
      default:
        return [];
    }
  };

  const processApiPackageData = () => {
    const processedRows = packageData.ndis_line_items
      .filter(lineItem => {
        // Filter out room line items for Support Holiday Packages
        if (isSupportHolidayPackage && lineItem.line_item_type === 'room') {
          return false;
        }

        // ✅ NEW: Filter out course line items when there's no course in the booking
        if (lineItem.line_item_type === 'course' && (!courseAnalysisData || !courseAnalysisData.hasCourse)) {
          console.log(`🎓 Filtering out course line item (no course in booking): "${lineItem.sta_package}"`);
          return false;
        }
        
        return true;
      })
      .map(lineItem => {
        const quantity = calculateApiQuantity(lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown);
        const rate = parseFloat(lineItem.price_per_night || 0);
        const total = rate * quantity;
        const funder = getFunder(packageData, lineItem);

        const rateCategoryLabel = lineItem.rate_category === 'hour' ? '/hour' : lineItem.rate_category === 'day' ? '/day' : '/night';
        const rateCategoryQtyLabel = lineItem.rate_category === 'hour' ? 'hrs' : lineItem.rate_category === 'day' ? 'days' : 'nights';

        return {
          description: lineItem.sta_package || lineItem.description || 'Package Item',
          lineItem: lineItem.line_item || lineItem.line_item_code || 'N/A',
          rate: rate,
          quantity: quantity,
          total: total,
          funder: funder,
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

  const calculateApiQuantity = (lineItem, daysBreakdown, careAnalysisData, courseAnalysisData, careDaysBreakdown) => {
    const { line_item_type, rate_type, rate_category, care_time } = lineItem;
    
    if (!rate_type || rate_type === '') {
      console.log(`Processing line item with blank rate_type:`, {
        lineItemType: line_item_type,
        rateCategory: rate_category,
        description: lineItem.sta_package || lineItem.description
      });
    }
    
    switch (line_item_type) {
      case 'room':
        return nights;
        
      case 'group_activities':
        return calculateGroupActivitiesQuantity(lineItem, daysBreakdown, courseAnalysisData);
        
      case 'sleep_over':
        return nights;
        
      case 'course':
        if (!courseAnalysisData?.hasCourse) return 0;
        return 6;
        
      case 'care':
        if (!careAnalysisData?.requiresCare) return 0;
        return calculateCareQuantity(lineItem, careAnalysisData, careDaysBreakdown);
        
      default:
        if (rate_category === 'day') {
          // Use regular daysBreakdown for service days
          const dayQty = getDaysForRateType(rate_type, daysBreakdown);
          return dayQty;
        } else if (rate_category === 'hour') {
          const daysForType = getDaysForRateType(rate_type, daysBreakdown);
          const hourQty = daysForType * 12;
          return hourQty;
        }
        return 0;
    }
  };

  const calculateGroupActivitiesQuantity = (lineItem, daysBreakdown, courseAnalysisData) => {
    const { rate_type } = lineItem;
    
    if (!rate_type || rate_type === '') {
      const totalDays = daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
      
      if (totalDays === 0) return 0;
      
      let totalHours = 0;
      const stayDates = generateStayDates(datesOfStay, nights);
      
      stayDates.forEach((date, index) => {
        const isCheckInDay = index === 0;
        const isCheckOutDay = index === stayDates.length - 1;
        const isCourseDay = courseAnalysisData?.hasCourse && isCourseOnDate(date, courseAnalysisData);
        
        if (isCheckInDay || isCheckOutDay) {
          totalHours += 6;
        } else if (isCourseDay) {
          totalHours += 6;
        } else {
          totalHours += 12;
        }
      });
      
      return totalHours;
    }
    
    const daysForType = getDaysForRateType(rate_type, daysBreakdown);
    
    if (daysForType === 0) return 0;
    
    let totalHours = 0;
    const stayDates = generateStayDates(datesOfStay, nights);
    
    stayDates.forEach((date, index) => {
      const dateRateType = getDateRateType(date, daysBreakdown);
      
      if (dateRateType !== rate_type) return;
      
      const isCheckInDay = index === 0;
      const isCheckOutDay = index === stayDates.length - 1;
      const isCourseDay = courseAnalysisData?.hasCourse && isCourseOnDate(date, courseAnalysisData);
      
      if (isCheckInDay || isCheckOutDay) {
        totalHours += 6;
      } else if (isCourseDay) {
        totalHours += 6;
      } else {
        totalHours += 12;
      }
    });
    
    return totalHours;
  };

  const calculateCareQuantity = (lineItem, careAnalysisData, daysBreakdown) => {
    const { rate_type, care_time } = lineItem;
    
    // 🔧 FIX: For care, if the care schedule applies to all days (not rate-specific),
    // use the total of all days instead of filtering by rate_type
    const careHoursPerDay = getCareHoursForTime(care_time, careAnalysisData);
    
    if (careHoursPerDay === 0) return 0;
    
    // Check if rate_type is specified and should be filtered
    if (!rate_type || rate_type === '') {
      // No rate_type specified = care applies to ALL days
      const totalDays = daysBreakdown.weekdays + daysBreakdown.saturdays + 
                      daysBreakdown.sundays + daysBreakdown.publicHolidays;
      return careHoursPerDay * totalDays;
    }
    
    // Rate-specific care (e.g., "weekday" care vs "saturday" care)
    const daysForType = getDaysForRateType(rate_type, daysBreakdown);
    
    if (daysForType === 0) return 0;
    
    return careHoursPerDay * daysForType;
  };

  const getCareHoursForTime = (careTime, careAnalysisData) => {
    if (!careAnalysisData?.sampleDay) return 0;
    
    const sampleDay = careAnalysisData.sampleDay;
    
    // If care_time is empty, return TOTAL care hours per day (all time periods)
    if (!careTime || careTime === '') {
      const totalHours = (sampleDay.morning || 0) + 
                        (sampleDay.afternoon || 0) + 
                        (sampleDay.evening || 0);
      return totalHours;
    }
    
    // Otherwise, return hours for specific time period
    switch (careTime.toLowerCase()) {
      case 'morning':
        return sampleDay.morning || 0;
      case 'afternoon':
        return sampleDay.afternoon || 0;
      case 'evening':
        return sampleDay.evening || 0;
      default:
        return 0;
    }
  };

  const getDaysForRateType = (rateType, daysBreakdown) => {
    if (!rateType || rateType === '') {
      return daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
    }
    
    switch (rateType) {
      case 'weekday':
        return daysBreakdown.weekdays;
      case 'saturday':
        return daysBreakdown.saturdays;
      case 'sunday':
        return daysBreakdown.sundays;
      case 'public_holiday':
      case 'publicHoliday':
        return daysBreakdown.publicHolidays;
      default:
        return 0;
    }
  };

  const generateStayDates = (datesOfStay, nights, includeAllDays = true) => {
    if (!datesOfStay) return [];
    
    const startDateStr = datesOfStay.split(' - ')[0];
    const [day, month, year] = startDateStr.split('/');
    const startDate = new Date(year, month - 1, day);
    
    const dates = [];
    // ✅ For activities and care, we need all calendar days
    const daysToGenerate = includeAllDays ? nights + 1 : nights;
    
    for (let i = 0; i < daysToGenerate; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(currentDate.getDate() + i);
      dates.push(currentDate);
    }
    
    return dates;
  };

  const getDateRateType = (date, daysBreakdown) => {
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 6) return 'saturday';
    if (dayOfWeek === 0) return 'sunday';
    return 'weekday';
  };

  const isCourseOnDate = (date, courseAnalysisData) => {
    if (!courseAnalysisData?.hasCourse) return false;
    
    const stayDates = generateStayDates(datesOfStay, nights);
    const courseDay = stayDates[1];
    
    return courseDay && date.toDateString() === courseDay.toDateString();
  };

  const getFunder = (packageData, lineItem) => {
    if (packageData?.ndis_package_type !== 'holiday-plus') {
      return '';
    }
    
    if (lineItem.line_item_type === 'room') {
      return 'Self/Foundation';
    }
    
    return 'NDIS';
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

  if (!tableData || tableData.length === 0) {
    return (
      <div className="w-full max-w-4xl p-4 text-center text-gray-500">
        {shouldUseApiLogic 
          ? "No applicable pricing information available for this package and stay dates."
          : "No pricing information available for this package."}
      </div>
    );
  }

  const showFunderColumn = shouldUseApiLogic && packageData?.ndis_package_type === 'holiday-plus';

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
                {shouldUseApiLogic ? (
                  <div>
                    <div className="font-medium">{row.description}</div>
                    <div className="text-sm text-gray-600">
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="font-medium">{row.description}</div>
                    <div className="text-sm text-gray-600">({row.lineItem})</div>
                  </div>
                )}
              </td>
              <td className="p-3 border border-gray-300">{row.lineItem}</td>
              <td className="p-3 border border-gray-300">
                {formatAUD(row.rate)}
                {shouldUseApiLogic && (
                  <div className="text-sm text-gray-600">
                    {row.rateCategoryLabel}
                  </div>
                )}
              </td>
              <td className="p-3 border border-gray-300">
                {shouldUseApiLogic ? (
                  <>
                    {row.quantity}
                    <div className="text-sm text-gray-600">
                      {row.rateCategoryQtyLabel}
                    </div>
                  </>
                ) : (
                  row.quantity.toFixed(0)
                )}
              </td>
              <td className="p-3 border border-gray-300">{formatAUD(row.total)}</td>
              {showFunderColumn && (
                <td className="p-3 border border-gray-300">
                  <span className={`px-2 py-1 rounded text-sm ${
                    row.funder === 'NDIS' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {row.funder}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {careAnalysisData?.totalHoursPerDay > 0 && (
        <div className="mt-2 text-sm text-gray-600 italic">
          * Care fees reflect requested care at the time of booking submission and may vary based on actual care hours used.
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