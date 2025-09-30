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
  ndisFormFilters = null // ADDED: NDIS filters parameter
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

  // NEW: Extract care and course data from summary if not provided as props
  const getAnalysisDataFromSummary = () => {
    let extractedCareData = careAnalysisData;
    let extractedCourseData = courseAnalysisData;
    
    // Try to extract care analysis from summary data if not provided
    if (!extractedCareData && summary?.data?.careAnalysis) {
      extractedCareData = summary.data.careAnalysis;
    }
    
    // Try to extract course analysis from summary data if not provided  
    if (!extractedCourseData && summary?.data?.courseAnalysis) {
      extractedCourseData = summary.data.courseAnalysis;
    }
    
    // Try to extract from NDIS questions or other summary fields
    if (!extractedCareData && summary?.data?.ndisQuestions) {
      // Look for care-related questions in NDIS questions
      const careQuestions = summary.data.ndisQuestions.filter(q => 
        q.question?.toLowerCase().includes('care') || 
        q.question?.toLowerCase().includes('assistance')
      );
      
      if (careQuestions.length > 0) {
        // Basic care analysis from NDIS questions
        extractedCareData = {
          requiresCare: true,
          totalHoursPerDay: 6, // Default assumption for NDIS packages
          carePattern: 'moderate-care',
          sampleDay: { morning: 2, afternoon: 2, evening: 2 }
        };
      }
    }
    
    // console.log('Extracted analysis data:', {
    //   careData: extractedCareData,
    //   courseData: extractedCourseData,
    //   fromProps: { care: !!careAnalysisData, course: !!courseAnalysisData },
    //   fromSummary: { 
    //     care: !!summary?.data?.careAnalysis, 
    //     course: !!summary?.data?.courseAnalysis 
    //   }
    // });
    
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

  // Helper function to get NDIS funding type from Q&A pairs
  const getNdisFundingType = () => {
    
    if (!bookingData?.data) {
      console.log('No bookingData.data available');
      return null;
    }
    
    // First, try to find the answer directly in summary data if it exists
    if (bookingData.data.ndisFundingType) {
      return bookingData.data.ndisFundingType;
    }
    
    // If not in summary data, search through the original sections for the Q&A pair
    // This assumes bookingData has access to the original sections with Q&A pairs
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
    
    // Alternative: Try to find it in the ndisQuestions array if it exists
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

  // Helper function to format funder display with proper capitalization and NDIS type
  const formatFunderDisplay = () => {
    let funderDisplay = summary?.data?.funder || '';
    
    // Capitalize NDIS
    if (funderDisplay.toLowerCase().includes('ndis') || funderDisplay.toLowerCase().includes('ndia')) {
      funderDisplay = 'NDIS';
      
      // Append NDIS funding type if available
      const ndisFundingType = getNdisFundingType();
      if (ndisFundingType) {
        funderDisplay += ` - ${ndisFundingType}`;
      }
    } else {
      // Capitalize other funders properly
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

  // Resolve package selection to actual package data
  const resolvePackageSelection = async () => {
    if (bookingData?.data?.selectedPackageId && bookingData?.data?.packageSelectionType === 'package-selection' && !packageResolved) {
      try {
        setPackageResolved(true); // Prevent multiple calls
        
        const response = await fetch(`/api/packages/${bookingData.data.selectedPackageId}`);
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.package) {
            const packageData = result.package;
            setResolvedPackageData(packageData);
            
            // Update the booking data with resolved package details
            const updatedSummaryData = { ...bookingData };
            
            if (packageData.name?.includes('Wellness')) {
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageTypeAnswer = packageData.name;
              updatedSummaryData.data.packageCost = packageData.price;
              updatedSummaryData.data.isNDISFunder = false;
            } else {
              // Assume NDIS package
              updatedSummaryData.data.ndisPackage = packageData.name;
              updatedSummaryData.data.packageType = serializePackage(packageData.name);
              updatedSummaryData.data.packageCost = packageData.price;
              updatedSummaryData.data.isNDISFunder = true;
            }
            
            setSummary(updatedSummaryData);
          }
        } else {
          console.error('Failed to fetch package details for summary:', bookingData.data.selectedPackageId);
        }
      } catch (error) {
        console.error('Error resolving package selection in summary:', error);
      }
    }
  };

  useEffect(() => {
    let summaryData = { ...bookingData };

    console.log('Summary Data:', summaryData);

    // Check if this is a package selection that needs resolution
    if (summaryData?.data?.selectedPackageId && summaryData?.data?.packageSelectionType === 'package-selection') {
      resolvePackageSelection();
      return; // Exit early, will re-run after package is resolved
    }

    const isNDISFunder = summaryData?.data?.funder?.includes('NDIS') || summaryData?.data?.funder?.includes('NDIA') ? true : false;
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

    // Handle existing signature
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
    // SPECIAL CASE: NDIS STA with Ocean View main room - show ocean view cost instead of room upgrade
    if (summary?.data?.isNDISFunder && 
        ndisFormFilters?.ndisPackageType === 'sta' && 
        summary?.rooms?.length > 0 && 
        summary.rooms[0]?.type === 'ocean_view') {
      
      const oceanViewCost = summary.rooms[0].price * (summary?.data?.nights || 0);
      const additionalRoomCost = totalRoomCosts.additionalRoom;
      return oceanViewCost + additionalRoomCost;
    }
    
    // Standard calculation
    return totalRoomCosts.roomUpgrade + totalRoomCosts.additionalRoom;
  };

  const getGrandTotal = () => {
    return totalPackageCost + getTotalOutOfPocketExpenses();
  };

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

      {summary?.data?.isNDISFunder ? (
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
        <h2 className="text-lg font-semibold text-slate-700">Additional Room and Upgrade Costs</h2>
        <h3 className="text-sm font-semibold text-slate-700">To be paid by you privately without prior approval by your funder</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Room Upgrade</h3>
            <p className="text-gray-900 p-2">
              {/* SPECIAL CASE: NDIS STA with Ocean View main room - show as N/A */}
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
              {/* SPECIAL CASE: NDIS STA with Ocean View main room - show ocean view cost here */}
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
            {/* Show explanation for NDIS STA ocean view special case */}
            {/* {summary?.data?.isNDISFunder && 
             ndisFormFilters?.ndisPackageType === 'sta' && 
             summary?.rooms?.length > 0 && 
             summary.rooms[0]?.type === 'ocean_view' && (
              <p className="text-xs text-blue-600 italic mt-1">
                * Ocean View Room is shown as additional room for NDIS STA packages
              </p>
            )} */}
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
            <span>Additional Room and Upgrade Costs <i>(To be paid privately by you)</i>:</span>
            <span>${formatPrice(getTotalOutOfPocketExpenses())}</span>
          </div>
          <div className="flex justify-between pt-2 border-t border-gray-200 font-semibold">
            <span>Grand Total:</span>
            <span>${formatPrice(getGrandTotal())}</span>
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

// Updated PricingTable component with conditional logic for API vs static data
const PricingTable = ({ option, datesOfStay, nights = 0, setTotalPackageCost, packageData, careAnalysisData, courseAnalysisData }) => {
  const [tableData, setTableData] = useState([]);
  const [daysBreakdown, setDaysBreakdown] = useState({
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0
  });

  // Check if we should use new API-based logic or existing static logic
  const shouldUseApiLogic = packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0;

  // Calculate stay dates breakdown
  const calculateStayDatesBreakdown = async () => {
    if (!datesOfStay || nights <= 0) return;
    
    try {
      const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
      setDaysBreakdown(breakdown);
    } catch (error) {
      console.error('Error calculating stay dates breakdown:', error);
    }
  };

  // EXISTING STATIC LOGIC (unchanged from original)
  // Process static/hardcoded package data (original logic)
  const processStaticPackageData = () => {
    console.log('Using static pricing logic for option:', option);
    
    const staticPricing = getStaticHourlyPricing(option);
    
    if (!staticPricing || staticPricing.length === 0) {
      console.log('No static pricing found for option:', option);
      setTableData([]);
      if (setTotalPackageCost) setTotalPackageCost(0);
      return [];
    }

    // Filter out rows where hours would be 0 (existing logic)
    const applicableRows = staticPricing.filter(row => {
      const hoursForType = getHoursForStaticType(row.type);
      return hoursForType > 0;
    });

    // Convert to table format (existing logic)
    const processedRows = applicableRows.map(row => {
      const hoursForType = getHoursForStaticType(row.type);
      const totalForRow = row.hourlyRate * hoursForType;
      
      return {
        description: row.itemDescription,
        lineItem: row.lineItem,
        rate: row.hourlyRate,
        quantity: hoursForType,
        total: totalForRow,
        funder: '', // No funder column for static pricing
        rateCategory: 'hour',
        lineItemType: 'static',
        rateType: row.type
      };
    });

    setTableData(processedRows);
    
    // Calculate total cost (existing logic)
    const totalCost = processedRows.reduce((sum, row) => sum + row.total, 0);
    if (setTotalPackageCost) {
      setTotalPackageCost(totalCost);
    }

    return processedRows;
  };

  // Helper function for static pricing hours calculation (existing logic)
  const getHoursForStaticType = (type) => {
    const daysForType = getDaysForRateType(type, daysBreakdown);
    return daysForType * 24; // 24 hours per day for static pricing
  };

  // Get static hourly pricing data (existing logic from original code)
  const getStaticHourlyPricing = (option) => {
    const HOURS_PER_DAY = 24;
    
    switch (option) {
      case 'SP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 39.58, // 950 / 24
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 45.83, // 1100 / 24
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 52.08, // 1250 / 24
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 62.50, // 1500 / 24
            type: 'publicHoliday' 
          }
        ];
      case 'CSP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 45.83, // 1100 / 24
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 58.33, // 1400 / 24
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 72.92, // 1750 / 24
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 83.33, // 2000 / 24
            type: 'publicHoliday' 
          }
        ];
      case 'HCSP':
        return [
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - WEEKDAY", 
            lineItem: "01_200_0115_1_1", 
            hourlyRate: 72.50, // 1740 / 24
            type: 'weekday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SATURDAY", 
            lineItem: "01_202_0115_1_1", 
            hourlyRate: 77.08, // 1850 / 24
            type: 'saturday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - SUNDAY", 
            lineItem: "01_203_0115_1_1", 
            hourlyRate: 83.33, // 2000 / 24
            type: 'sunday' 
          },
          { 
            itemDescription: "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY", 
            lineItem: "01_204_0115_1_1", 
            hourlyRate: 93.75, // 2250 / 24
            type: 'publicHoliday' 
          }
        ];
      default:
        return [];
    }
  };

  // NEW API LOGIC (for packages with ndis_line_items)
  // Process API package data with new complex logic
  // NEW API LOGIC (for packages with ndis_line_items)
  // Process API package data with new complex logic
  const processApiPackageData = () => {
    // console.log('Using API pricing logic with line items:', packageData.ndis_line_items);
    
    const processedRows = packageData.ndis_line_items.map(lineItem => {
      const quantity = calculateApiQuantity(lineItem, daysBreakdown, careAnalysisData, courseAnalysisData);
      const rate = parseFloat(lineItem.price_per_night || 0);
      const total = rate * quantity;
      const funder = getFunder(packageData, lineItem);

      // Log details for blank rate_type items
      if (!lineItem.rate_type || lineItem.rate_type === '') {
        // console.log(`Processing item with blank rate_type:`, {
        //   description: lineItem.sta_package,
        //   lineItemType: lineItem.line_item_type,
        //   rateCategory: lineItem.rate_category,
        //   calculatedQuantity: quantity,
        //   daysBreakdown: daysBreakdown
        // });
      }

      return {
        description: lineItem.sta_package || lineItem.description || 'Package Item',
        lineItem: lineItem.line_item || lineItem.line_item_code || 'N/A',
        rate: rate,
        quantity: quantity,
        total: total,
        funder: funder,
        rateCategory: lineItem.rate_category || 'day',
        lineItemType: lineItem.line_item_type || '',
        rateType: lineItem.rate_type || 'BLANK'
      };
    });

    // Filter out rows with 0 quantity (no applicable hours/days)
    const filteredRows = processedRows.filter(row => row.quantity > 0);
    
    // console.log(`API Logic: Showing ${filteredRows.length} of ${processedRows.length} line items`, {
    //   filtered: processedRows.filter(row => row.quantity === 0).map(row => ({
    //     description: row.description,
    //     lineItemType: row.lineItemType,
    //     rateType: row.rateType,
    //     reason: 'Zero quantity'
    //   }))
    // });

    setTableData(filteredRows);

    // Calculate total cost
    const totalCost = filteredRows.reduce((sum, row) => sum + row.total, 0);
    if (setTotalPackageCost) {
      setTotalPackageCost(totalCost);
    }

    return filteredRows;
  };

  // Calculate quantity for API packages based on line_item_type and rate_category
  const calculateApiQuantity = (lineItem, daysBreakdown, careAnalysisData, courseAnalysisData) => {
    const { line_item_type, rate_type, rate_category, care_time } = lineItem;
    
    // Log when processing blank rate_type
    if (!rate_type || rate_type === '') {
      console.log(`Processing line item with blank rate_type:`, {
        lineItemType: line_item_type,
        rateCategory: rate_category,
        description: lineItem.sta_package || lineItem.description
      });
    }
    
    switch (line_item_type) {
      case 'room':
        // Qty = checkin date until checkout date - 1 day (checkout date not charged)
        return nights;
        
      case 'group_activities':
        return calculateGroupActivitiesQuantity(lineItem, daysBreakdown, courseAnalysisData);
        
      case 'sleep_over':
        // Same as room logic
        return nights;
        
      case 'course':
        // Show only if booking has course, default 6 hours
        if (!courseAnalysisData?.hasCourse) return 0;
        return 6; // Default 6 hours for course
        
      case 'care':
        // Show only if booking has care, calculate based on care_time
        if (!careAnalysisData?.requiresCare) return 0;
        return calculateCareQuantity(lineItem, careAnalysisData, daysBreakdown);
        
      default:
        // For line items without specific type, use day-based calculation
        if (rate_category === 'day') {
          const dayQty = getDaysForRateType(rate_type, daysBreakdown);
          // console.log(`Day calculation for rate_type "${rate_type || 'BLANK'}":`, dayQty);
          return dayQty;
        } else if (rate_category === 'hour') {
          // UPDATED: Default to 12 hours per day instead of 24 for hourly rate category
          const daysForType = getDaysForRateType(rate_type, daysBreakdown);
          const hourQty = daysForType * 12; // 12 hours per day default
          // console.log(`Hour calculation for rate_type "${rate_type || 'BLANK'}": ${daysForType} days × 12 hours = ${hourQty}`);
          return hourQty;
        }
        return 0;
    }
  };

  // Calculate group activities quantity
  const calculateGroupActivitiesQuantity = (lineItem, daysBreakdown, courseAnalysisData) => {
    const { rate_type } = lineItem;
    
    // NEW: Handle blank rate_type (applies to all days)
    if (!rate_type || rate_type === '') {
      // For blank rate_type, calculate across all days
      const totalDays = daysBreakdown.weekdays + daysBreakdown.saturdays + daysBreakdown.sundays + daysBreakdown.publicHolidays;
      
      if (totalDays === 0) return 0;
      
      let totalHours = 0;
      const stayDates = generateStayDates(datesOfStay, nights);
      
      stayDates.forEach((date, index) => {
        const isCheckInDay = index === 0;
        const isCheckOutDay = index === stayDates.length - 1;
        const isCourseDay = courseAnalysisData?.hasCourse && isCourseOnDate(date, courseAnalysisData);
        
        if (isCheckInDay || isCheckOutDay) {
          totalHours += 6; // 6 hours on checkin/checkout days
        } else if (isCourseDay) {
          totalHours += 6; // UPDATED: 6 hours on course days
        } else {
          totalHours += 12; // 12 hours on regular days
        }
      });
      
      return totalHours;
    }
    
    // For specific rate types (weekday, saturday, sunday, public_holiday)
    const daysForType = getDaysForRateType(rate_type, daysBreakdown);
    
    if (daysForType === 0) return 0;
    
    let totalHours = 0;
    const stayDates = generateStayDates(datesOfStay, nights);
    
    stayDates.forEach((date, index) => {
      const dateRateType = getDateRateType(date, daysBreakdown);
      
      if (dateRateType !== rate_type) return; // Skip if not matching rate type
      
      const isCheckInDay = index === 0;
      const isCheckOutDay = index === stayDates.length - 1;
      const isCourseDay = courseAnalysisData?.hasCourse && isCourseOnDate(date, courseAnalysisData);
      
      if (isCheckInDay || isCheckOutDay) {
        totalHours += 6; // 6 hours on checkin/checkout days
      } else if (isCourseDay) {
        totalHours += 6; // UPDATED: 6 hours on course days
      } else {
        totalHours += 12; // 12 hours on regular days
      }
    });
    
    return totalHours;
  };

  // Calculate care quantity based on care_time and analysis data
  const calculateCareQuantity = (lineItem, careAnalysisData, daysBreakdown) => {
    const { rate_type, care_time } = lineItem;
    const daysForType = getDaysForRateType(rate_type, daysBreakdown);
    
    if (daysForType === 0) return 0;
    
    // Get care hours for the specific time period
    const careHoursPerDay = getCareHoursForTime(care_time, careAnalysisData);
    
    return careHoursPerDay * daysForType;
  };

  // Get care hours for specific time period (morning, afternoon, evening)
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

  // Get number of days for specific rate type
  const getDaysForRateType = (rateType, daysBreakdown) => {
    // NEW: Handle blank rate_type for all days
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

  // Generate array of stay dates for detailed calculation
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

  // Get rate type for a specific date
  const getDateRateType = (date, daysBreakdown) => {
    const dayOfWeek = date.getDay();
    
    // Check if it's a public holiday first
    if (daysBreakdown.publicHolidays > 0) {
      // Would need to check against actual holiday dates
      // For now, assume public holidays are handled separately
    }
    
    if (dayOfWeek === 6) return 'saturday';
    if (dayOfWeek === 0) return 'sunday';
    return 'weekday';
  };

  // Check if a date is a course day - improved implementation
  const isCourseOnDate = (date, courseAnalysisData) => {
    // This would need to be implemented based on actual course start dates from the booking
    // For now, this is a placeholder that should be replaced with actual course date logic
    
    // Example implementation - you would replace this with actual course date checking:
    // if (courseAnalysisData?.courseStartDate) {
    //   const courseStart = new Date(courseAnalysisData.courseStartDate);
    //   return date.toDateString() === courseStart.toDateString();
    // }
    
    // Placeholder: assume first day after checkin is course day if course exists
    if (!courseAnalysisData?.hasCourse) return false;
    
    // This is a simple placeholder - replace with actual course scheduling logic
    const stayDates = generateStayDates(datesOfStay, nights);
    const courseDay = stayDates[1]; // Assume second day is course day (placeholder)
    
    return courseDay && date.toDateString() === courseDay.toDateString();
  };

  // Determine funder based on package type and line item type
  const getFunder = (packageData, lineItem) => {
    if (packageData?.ndis_package_type !== 'holiday-plus') {
      return ''; // Only show funder for holiday-plus packages
    }
    
    if (lineItem.line_item_type === 'room') {
      return 'Self/Foundation';
    }
    
    return 'NDIS';
  };

  // Main processing logic - choose between API and static
  const processPackageData = () => {
    if (shouldUseApiLogic) {
      return processApiPackageData();
    } else {
      return processStaticPackageData();
    }
  };

  // Initialize calculations
  useEffect(() => {
    calculateStayDatesBreakdown();
  }, [datesOfStay, nights]);

  useEffect(() => {
    // For static logic, we need daysBreakdown
    // For API logic, we need daysBreakdown AND package data
    const canProcess = shouldUseApiLogic 
      ? (packageData && Object.keys(daysBreakdown).some(key => daysBreakdown[key] > 0))
      : Object.keys(daysBreakdown).some(key => daysBreakdown[key] > 0);
      
    if (canProcess) {
      processPackageData();
    }
  }, [packageData, daysBreakdown, careAnalysisData, courseAnalysisData, shouldUseApiLogic]);

  // Don't render if no data
  if (!tableData || tableData.length === 0) {
    return (
      <div className="w-full max-w-4xl p-4 text-center text-gray-500">
        {shouldUseApiLogic 
          ? "No applicable pricing information available for this package and stay dates."
          : "No pricing information available for this package."}
      </div>
    );
  }

  // Determine if we should show the Funder column (only for API packages with holiday-plus type)
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
                    {row.rateCategory === 'hour' ? '/hour' : '/day'}
                  </div>
                )}
              </td>
              <td className="p-3 border border-gray-300">
                {shouldUseApiLogic ? (
                  <>
                    {row.quantity}
                    <div className="text-sm text-gray-600">
                      {row.rateCategory === 'hour' ? 'hrs' : 'days'}
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

// Helper function to calculate days breakdown (existing function from create-summary-data.js)
const calculateDaysBreakdown = async (startDateStr, numberOfNights) => {
  // console.log('calculateDaysBreakdown called with:', { startDateStr, numberOfNights });
  
  // Parse the date range - handle both formats: "DD/MM/YYYY - DD/MM/YYYY" and other formats
  let startDateParsed;
  if (startDateStr.includes(' - ')) {
    const startDatePart = startDateStr.split(' - ')[0];
    // Handle DD/MM/YYYY format
    if (startDatePart.includes('/')) {
      const [day, month, year] = startDatePart.split('/');
      startDateParsed = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      startDateParsed = new Date(startDatePart);
    }
  } else {
    startDateParsed = new Date(startDateStr);
  }

  // console.log('Parsed start date:', startDateParsed);

  if (isNaN(startDateParsed.getTime())) {
    console.error('Invalid start date:', startDateStr);
    return {
      weekdays: 0,
      saturdays: 0,
      sundays: 0,
      publicHolidays: 0
    };
  }

  // Get holiday information
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

  // Calculate breakdown for each night of the stay
  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(startDateParsed);
    currentDate.setDate(currentDate.getDate() + i);
    
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    if (dayOfWeek === 6) { // Saturday
      breakdown.saturdays++;
    } else if (dayOfWeek === 0) { // Sunday
      breakdown.sundays++;
    } else { // Monday-Friday (1-5)
      breakdown.weekdays++;
    }
  }

  // console.log('Final breakdown:', breakdown);
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

// Format currency
const formatPrice = (price) => {
  return parseFloat(price || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};