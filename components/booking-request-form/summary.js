import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SignatureInput from './signature-pad';
import { getNSWHolidaysV2 } from '../../services/booking/create-summary-data';
import { serializePackage } from '../../utilities/common';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';

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
  const [signatureType, setSignatureType] = useState('drawn');
  const [totalPackageCost, setTotalPackageCost] = useState(0);
  const [totalRoomCosts, setTotalRoomCosts] = useState({
    roomUpgrade: 0,
    additionalRoom: 0
  });
  const [verbalConsent, setVerbalConsent] = useState({ 
    checked: false, 
    timestamp: null, 
    adminName: currentUser.first_name + ' ' + currentUser.last_name 
  });
  
  const [isSignatureLoading, setIsSignatureLoading] = useState(false);
  const [hasExistingSignature, setHasExistingSignature] = useState(false);
  const [packageResolved, setPackageResolved] = useState(false);
  const [resolvedPackageData, setResolvedPackageData] = useState(null);
  const [isResolvingPackage, setIsResolvingPackage] = useState(false);

  // Helper to check if package is NDIS Support Holiday Package
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
    
    const hasValidSignature = signaturePad && 
      typeof signaturePad.isEmpty === 'function' && 
      !signaturePad.isEmpty();
    
    if (!hasValidSignature && !hasExistingSignature) {
        toast.error('Please sign the agreement before continuing.');
        return;
    }

    if (isSignatureLoading) {
        toast.info('Loading signature, please wait...');
        setTimeout(() => updateBooking(), 1000);
        return;
    }

    console.log('Signature is valid, proceeding to save...');
    try {
        const trimmedCanvas = signaturePad.getTrimmedCanvas();
        if (!trimmedCanvas) {
            throw new Error('Could not get signature image');
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
    if (bookingData?.data?.selectedPackageId && 
        bookingData?.data?.packageSelectionType === 'package-selection' && 
        !packageResolved) {
      try {
        setIsResolvingPackage(true);
        setPackageResolved(true);
        
        console.log('🔄 Resolving package selection:', bookingData.data.selectedPackageId);
        
        const response = await fetch(`/api/packages/${bookingData.data.selectedPackageId}`);
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
            
            // ✅ FIX: Set the package name correctly for both NDIS and non-NDIS
            if (packageData.name?.includes('Wellness')) {
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageTypeAnswer = packageData.name; // This is the display name
              updatedSummaryData.data.packageCost = packageData.price;
              updatedSummaryData.data.isNDISFunder = false;
              updatedSummaryData.data.packageCode = packageData.package_code;
            } else {
              // ✅ FIX: For NDIS packages, set BOTH ndisPackage AND packageTypeAnswer
              updatedSummaryData.data.ndisPackage = packageData.name; // Full package name
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageTypeAnswer = packageData.name; // ✅ ADD: Display name
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
          console.error('❌ Failed to fetch package details for summary:', bookingData.data.selectedPackageId);
        }
      } catch (error) {
        console.error('❌ Error resolving package selection in summary:', error);
      } finally {
        setIsResolvingPackage(false);
      }
    }
  };

  useEffect(() => {
    let summaryData = { ...bookingData };

    console.log('Summary Data:', summaryData);

    // ✅ If package needs resolution, trigger it and return early
    if (summaryData?.data?.selectedPackageId && 
        summaryData?.data?.packageSelectionType === 'package-selection' && 
        !packageResolved) {
      console.log('📦 Package selection detected, resolving...');
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

    if (selectedRooms.length > 0) {
      summaryData.rooms = selectedRooms;
    }
    summaryData.rooms = summaryData.rooms.filter(room => room.type !== 'studio');
    
    const nights = summaryData.data?.nights || 0;
    if (summaryData.rooms.length > 0) {
      const roomUpgradePerNight = summaryData.rooms[0].price || 0;
      summaryData.roomUpgrade = roomUpgradePerNight;
      
      let additionalRoomPerNight = 0;
      if (summaryData.rooms.length > 1) {
        additionalRoomPerNight = summaryData.rooms
          .filter((room, index) => index > 0)
          .reduce((total, room) => total + (room.price || 0), 0);
      }
      summaryData.additionalRoom = additionalRoomPerNight;

      setTotalRoomCosts({
        roomUpgrade: roomUpgradePerNight * nights,
        additionalRoom: additionalRoomPerNight * nights
      });
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
  }, [bookingData, selectedRooms, resolvedPackageData, packageResolved]);

  const getTotalOutOfPocketExpenses = () => {
    if (summary?.data?.isNDISFunder && 
        ndisFormFilters?.ndisPackageType === 'sta' && 
        summary?.rooms?.length > 0 && 
        summary.rooms[0]?.type === 'ocean_view') {
      
      const oceanViewCost = summary.rooms[0].price * (summary?.data?.nights || 0);
      const additionalRoomCost = totalRoomCosts.additionalRoom;
      return oceanViewCost + additionalRoomCost;
    }
    
    return totalRoomCosts.roomUpgrade + totalRoomCosts.additionalRoom;
  };

  const getGrandTotal = () => {
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
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
            <p className="font-semibold text-slate-700">Total Package Cost: ${formatPrice(totalPackageCost)}</p>
          </div>
        </div>
      ): (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">Package to be paid for by your funder:</h2>
          <p className="text-slate-700">{` ${summary?.data?.packageType} - AUD ${formatPrice(summary?.data?.packageCost || 0)} per night`}</p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Accommodation (to be paid privately by you)</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Room Upgrade</h3>
            <p className="text-gray-900 p-2">
              {summary?.data?.isNDISFunder && 
               ndisFormFilters?.ndisPackageType === 'sta' && 
               summary?.rooms?.length > 0 && 
               summary.rooms[0]?.type === 'ocean_view' ? 
                'N/A' :
                (summary?.roomUpgrade ? 
                  `AUD ${formatPrice(summary.roomUpgrade)} per night (AUD ${formatPrice(totalRoomCosts.roomUpgrade)} total)` : 
                  'N/A')
              }
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Additional Room</h3>
            <p className="text-gray-900 p-2">
              {summary?.data?.isNDISFunder && 
               ndisFormFilters?.ndisPackageType === 'sta' && 
               summary?.rooms?.length > 0 && 
               summary.rooms[0]?.type === 'ocean_view' ? 
                `AUD ${formatPrice(summary.rooms[0].price)} per night (AUD ${formatPrice(summary.rooms[0].price * (summary?.data?.nights || 0))} total)` :
                (summary?.additionalRoom ? 
                  `AUD ${formatPrice(summary.additionalRoom)} per night (AUD ${formatPrice(totalRoomCosts.additionalRoom)} total)` : 
                  'N/A')
              }
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="font-semibold text-slate-700">Total Out of Pocket: ${formatPrice(getTotalOutOfPocketExpenses())}</p>
        </div>
      </div>

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Cost Summary</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span>Package Costs{<i> {`${summary?.data?.isNDISFunder ? "(To be billed to your funder)" : "(To be paid for by your funder)"}`}</i>}:</span>
            <span>${formatPrice(totalPackageCost)}</span>
          </div>
          <div className="flex justify-between">
            <span>Accommodation <i>(To be paid privately by you)</i>:</span>
            <span>${formatPrice(getTotalOutOfPocketExpenses())}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
            <span>Grand Total:</span>
            <span>${formatPrice(getGrandTotal())}</span>
          </div>
        </div>
      </div>

      {/* Funding assistance disclaimer for Support Holiday Packages */}
      {isSupportHolidayPackage() && (
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-slate-700">
            Funding assistance of $319 per nights for up to 5 nights may be available to you. Our bookings team will provide more information when processing your booking.
          </p>
        </div>
      )}

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
  );
};

export default SummaryOfStay;

// Updated PricingTable component
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

  const shouldUseApiLogic = packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0;

  const calculateStayDatesBreakdown = async () => {
    if (!datesOfStay || nights <= 0) return;
    
    try {
      const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
      setDaysBreakdown(breakdown);
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
        return true;
      })
      .map(lineItem => {
        const quantity = calculateApiQuantity(lineItem, daysBreakdown, careAnalysisData, courseAnalysisData);
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

  const calculateApiQuantity = (lineItem, daysBreakdown, careAnalysisData, courseAnalysisData) => {
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
        return calculateCareQuantity(lineItem, careAnalysisData, daysBreakdown);
        
      default:
        if (rate_category === 'day') {
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
    const daysForType = getDaysForRateType(rate_type, daysBreakdown);
    
    if (daysForType === 0) return 0;
    
    const careHoursPerDay = getCareHoursForTime(care_time, careAnalysisData);
    
    return careHoursPerDay * daysForType;
  };

  const getCareHoursForTime = (careTime, careAnalysisData) => {
    if (!careTime || !careAnalysisData?.sampleDay) return 0;
    
    const sampleDay = careAnalysisData.sampleDay;
    
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

  const generateStayDates = (datesOfStay, nights) => {
    if (!datesOfStay) return [];
    
    const startDateStr = datesOfStay.split(' - ')[0];
    const [day, month, year] = startDateStr.split('/');
    const startDate = new Date(year, month - 1, day);
    
    const dates = [];
    for (let i = 0; i < nights; i++) {
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
      ? (packageData && Object.keys(daysBreakdown).some(key => daysBreakdown[key] > 0))
      : Object.keys(daysBreakdown).some(key => daysBreakdown[key] > 0);
      
    if (canProcess) {
      processPackageData();
    }
  }, [packageData, daysBreakdown, careAnalysisData, courseAnalysisData, shouldUseApiLogic, isSupportHolidayPackage]);

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
                ${formatPrice(row.rate)}
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
              <td className="p-3 border border-gray-300">${formatPrice(row.total)}</td>
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

const calculateDaysBreakdown = async (startDateStr, numberOfNights) => {
  let startDateParsed;
  if (startDateStr.includes(' - ')) {
    const startDatePart = startDateStr.split(' - ')[0];
    if (startDatePart.includes('/')) {
      const [day, month, year] = startDatePart.split('/');
      startDateParsed = new Date(year, month - 1, day);
    } else {
      startDateParsed = new Date(startDatePart);
    }
  } else {
    startDateParsed = new Date(startDateStr);
  }

  if (isNaN(startDateParsed.getTime())) {
    console.error('Invalid start date:', startDateStr);
    return {
      weekdays: 0,
      saturdays: 0,
      sundays: 0,
      publicHolidays: 0
    };
  }

  const dates = startDateStr.split(' - ');
  let holidays = [];
  try {
    holidays = await getNSWHolidaysV2(dates[0], dates[1]);
  } catch (error) {
    console.warn('Could not fetch holidays:', error);
    holidays = [];
  }
  
  let breakdown = {
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: holidays.length || 0
  };

  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(startDateParsed);
    currentDate.setDate(currentDate.getDate() + i);
    
    const dayOfWeek = currentDate.getDay();
    
    if (dayOfWeek === 6) {
      breakdown.saturdays++;
    } else if (dayOfWeek === 0) {
      breakdown.sundays++;
    } else {
      breakdown.weekdays++;
    }
  }

  return breakdown;
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

const formatPrice = (price) => {
  return parseFloat(price || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};