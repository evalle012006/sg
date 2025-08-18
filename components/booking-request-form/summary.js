import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SignatureInput from './signature-pad';
import { getNSWHolidaysV2 } from '../../services/booking/create-summary-data';
import { serializePackage } from '../../utilities/common';
import { findByQuestionKey, QUESTION_KEYS } from '../../services/booking/question-helper';

const SummaryOfStay = ({ bookingData, bookingId, origin, getRequestFormTemplate, bookingAmended, submitBooking }) => {
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
  const [verbalConsent, setVerbalConsent] = useState({ checked: false, timestamp: null, adminName: currentUser.first_name + ' ' + currentUser.last_name });
  
  const [isSignatureLoading, setIsSignatureLoading] = useState(false);
  const [hasExistingSignature, setHasExistingSignature] = useState(false);
  const [packageResolved, setPackageResolved] = useState(false);
  const [resolvedPackageData, setResolvedPackageData] = useState(null);

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
    console.log('getNdisFundingType called, bookingData:', bookingData);
    
    if (!bookingData?.data) {
      console.log('No bookingData.data available');
      return null;
    }
    
    // First, try to find the answer directly in summary data if it exists
    if (bookingData.data.ndisFundingType) {
      console.log('Found NDIS funding type in summary data:', bookingData.data.ndisFundingType);
      return bookingData.data.ndisFundingType;
    }
    
    // If not in summary data, search through the original sections for the Q&A pair
    // This assumes bookingData has access to the original sections with Q&A pairs
    if (bookingData.originalSections) {
      console.log('Searching in originalSections...');
      for (const section of bookingData.originalSections) {
        if (section.QaPairs) {
          const ndisFundingQA = findByQuestionKey(section.QaPairs, 'please-select-from-one-of-the-following-ndis-funding-options');
          if (ndisFundingQA && ndisFundingQA.answer) {
            console.log('Found NDIS funding type in QaPairs:', ndisFundingQA.answer);
            return ndisFundingQA.answer;
          }
        }
      }
    }
    
    // Alternative: Try to find it in the ndisQuestions array if it exists
    if (bookingData.data.ndisQuestions && Array.isArray(bookingData.data.ndisQuestions)) {
      console.log('Searching in ndisQuestions...');
      const fundingTypeQuestion = bookingData.data.ndisQuestions.find(q => 
        q.question && q.question.toLowerCase().includes('ndis funding options')
      );
      if (fundingTypeQuestion && fundingTypeQuestion.answer) {
        console.log('Found NDIS funding type in ndisQuestions:', fundingTypeQuestion.answer);
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
        console.log('Resolving package selection:', bookingData.data.selectedPackageId);
        setPackageResolved(true); // Prevent multiple calls
        
        const response = await fetch(`/api/packages/${bookingData.data.selectedPackageId}`);
        if (response.ok) {
          const result = await response.json();
          
          if (result.success && result.package) {
            const packageData = result.package;
            console.log('Package data resolved:', packageData);
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
          />
          <div className="mt-2 text-right">
            <p className="font-semibold text-slate-700">Total Package Cost: ${formatPrice(totalPackageCost)}</p>
          </div>
        </div>
      ): (
        <div className="mt-8">
          <h2 className="text-lg font-semibold mb-4 text-slate-700">Package to be paid for by your funder:</h2>
          <p className="text-slate-700">{` ${summary?.data?.packageType} - $${formatPrice(summary?.data?.packageCost || 0)} per night`}</p>
        </div>
      )}

      <div className="mt-8 space-y-4">
        <h2 className="text-lg font-semibold text-slate-700">Additional Room and Upgrade Costs</h2>
        <h3 className="text-sm font-semibold text-slate-700">To be paid by you privately without prior approval by your funder</h3>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Room Upgrade</h3>
            <p className="text-gray-900 p-2">
              {summary?.roomUpgrade ? 
                `$${formatPrice(summary.roomUpgrade)} per night ($${formatPrice(totalRoomCosts.roomUpgrade)} total)` : 
                'N/A'}
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-slate-700 mb-1">Additional Room</h3>
            <p className="text-gray-900 p-2">
              {summary?.additionalRoom ? 
                `$${formatPrice(summary.additionalRoom)} per night ($${formatPrice(totalRoomCosts.additionalRoom)} total)` : 
                'N/A'}
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

// Updated PricingTable component with 24-hour calculation
const PricingTable = ({ option, datesOfStay, nights = 0, setTotalPackageCost, packageData }) => {
  const [dataOption, setDataOption] = useState([]);
  const [daysBreakdown, setDaysBreakdown] = useState({
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0
  });

  // Convert nightly rate to hourly rate (using full 24 hours per day)
  const HOURS_PER_DAY = 24;

  const calculateTotalCost = () => {
    if (!dataOption.length) return 0;

    let total = 0;
    dataOption.forEach(row => {
      const hoursForType = getHoursForType(row.type);
      // Only include costs for rows that have hours > 0
      if (hoursForType > 0) {
        total += row.hourlyRate * hoursForType;
      }
    });
    
    return total;
  };

  // Helper function to get the number of hours for a specific rate type
  const getHoursForType = (type) => {
    const daysForType = getDaysForType(type);
    return daysForType * HOURS_PER_DAY; // 24 hours per day
  };

  // Helper function to get the number of days for a specific rate type
  const getDaysForType = (type) => {
    switch (type) {
      case 'weekday': return daysBreakdown.weekdays;
      case 'saturday': return daysBreakdown.saturdays;
      case 'sunday': return daysBreakdown.sundays;
      case 'publicHoliday': return daysBreakdown.publicHolidays;
      default: return 0;
    }
  };

  useEffect(() => {
    const pricingData = getHourlyPricing(option, packageData);
    console.log('PricingTable - Setting hourly pricing data:', pricingData);
    setDataOption(pricingData);
    
    if (datesOfStay && nights > 0) {
      const handleGetBreakdown = async () => {
        const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
        console.log('PricingTable - Days breakdown:', breakdown);
        setDaysBreakdown(breakdown);
      }
      handleGetBreakdown();
    }
  }, [option, datesOfStay, nights, packageData]);

  useEffect(() => {
    if (setTotalPackageCost && dataOption.length > 0) {
      const totalCost = calculateTotalCost();
      console.log('PricingTable - Total cost calculated:', totalCost);
      setTotalPackageCost(totalCost);
    }
  }, [dataOption, daysBreakdown, setTotalPackageCost]);

  // If no pricing data, don't render the table
  if (!dataOption || dataOption.length === 0) {
    return (
      <div className="w-full max-w-4xl p-4 text-center text-gray-500">
        No pricing information available for this package.
      </div>
    );
  }

  // Filter out rows where hours would be 0
  const applicableRows = dataOption.filter(row => {
    const hoursForType = getHoursForType(row.type);
    const isApplicable = hoursForType > 0;
    
    if (!isApplicable) {
      console.log(`Filtering out ${row.type} row - 0 hours applicable`);
    }
    
    return isApplicable;
  });

  console.log(`PricingTable - Showing ${applicableRows.length} of ${dataOption.length} rate types`, 
    applicableRows.map(row => row.type));

  // If no applicable rows after filtering, don't render the table
  if (applicableRows.length === 0) {
    return (
      <div className="w-full max-w-4xl p-4 text-center text-gray-500">
        No applicable pricing information for the selected dates.
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-[#20485A] text-white">
            <th className="p-3 text-left border border-gray-300">Item</th>
            <th className="p-3 text-left border border-gray-300">Hourly Rate</th>
            <th className="p-3 text-left border border-gray-300">Hours</th>
            <th className="p-3 text-left border border-gray-300">Total ($)</th>
          </tr>
        </thead>
        <tbody>
          {applicableRows.map((row, index) => {
            const hoursForType = getHoursForType(row.type);
            const totalForRow = row.hourlyRate * hoursForType;
            return (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 border border-gray-300">
                  <div>
                    <div className="font-medium">{row.itemDescription}</div>
                    <div className="text-sm text-gray-600">({row.lineItem})</div>
                  </div>
                </td>
                <td className="p-3 border border-gray-300">${formatPrice(row.hourlyRate)}</td>
                <td className="p-3 border border-gray-300">{hoursForType.toFixed(0)}</td>
                <td className="p-3 border border-gray-300">${formatPrice(totalForRow)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

// Helper function to get hourly pricing data
const getHourlyPricing = (option, packageData = null) => {
  const HOURS_PER_DAY = 24; // Full 24 hours per day
  
  // PRIORITY 1: If we have resolved package data with ndis_line_items, use that
  if (packageData && packageData.ndis_line_items && packageData.ndis_line_items.length > 0) {
    console.log('Using package line items for hourly pricing:', packageData.ndis_line_items);
    
    // Map the line items to hourly rates
    const lineItems = packageData.ndis_line_items.map((lineItem) => ({
      itemDescription: getItemDescription(lineItem),
      lineItem: lineItem.line_item || lineItem.line_item_code || lineItem.code || 'Line Item Code',
      hourlyRate: parseFloat((lineItem.price_per_night || lineItem.price || lineItem.cost || 0) / HOURS_PER_DAY),
      type: determineLineItemType(lineItem)
    }));
    
    console.log('Mapped hourly line items:', lineItems);
    
    // Sort by type order
    const sortOrder = { 'weekday': 0, 'saturday': 1, 'sunday': 2, 'publicHoliday': 3 };
    lineItems.sort((a, b) => (sortOrder[a.type] || 999) - (sortOrder[b.type] || 999));
    
    return lineItems;
  }

  // PRIORITY 2: Fallback to hardcoded hourly pricing based on option
  console.log('Using hardcoded hourly pricing for option:', option);
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

// Helper function to get item description from line item data
const getItemDescription = (lineItem) => {
  // Try to extract a meaningful description from the line item
  const staPackage = lineItem.sta_package || lineItem.description || lineItem.name;
  
  if (staPackage) {
    // Convert STA package name to self-care activities format
    if (staPackage.toLowerCase().includes('weekday')) {
      return "Assistance With Self-Care Activities in a STA - WEEKDAY";
    } else if (staPackage.toLowerCase().includes('saturday')) {
      return "Assistance With Self-Care Activities in a STA - SATURDAY";
    } else if (staPackage.toLowerCase().includes('sunday')) {
      return "Assistance With Self-Care Activities in a STA - SUNDAY";
    } else if (staPackage.toLowerCase().includes('holiday') || staPackage.toLowerCase().includes('public')) {
      return "Assistance With Self-Care Activities in a STA - PUBLIC HOLIDAY";
    }
  }
  
  // Fallback to generic description
  return "Assistance With Self-Care Activities in a STA";
};

// Enhanced helper function to handle rate_type mapping correctly
const determineLineItemType = (lineItem) => {
  if (!lineItem) return 'weekday';
  
  // PRIORITY 1: Use rate_type field directly from API if available
  if (lineItem.rate_type) {
    const rateType = lineItem.rate_type.toLowerCase();
    if (rateType === 'weekday') return 'weekday';
    if (rateType === 'saturday') return 'saturday';
    if (rateType === 'sunday') return 'sunday';
    if (rateType === 'public_holiday' || rateType === 'publicholiday' || rateType === 'holiday') return 'publicHoliday';
  }
  
  // PRIORITY 2: Parse from description/package name
  const description = (lineItem.description || lineItem.name || lineItem.package_name || lineItem.sta_package || '').toLowerCase();
  const code = (lineItem.line_item_code || lineItem.code || lineItem.lineItem || lineItem.line_item || '').toLowerCase();
  
  // Check both description and code for type indicators
  const fullText = `${description} ${code}`.toLowerCase();
  
  if (fullText.includes('public') || fullText.includes('holiday')) {
    return 'publicHoliday';
  } else if (fullText.includes('sunday')) {
    return 'sunday';
  } else if (fullText.includes('saturday')) {
    return 'saturday';
  } else if (fullText.includes('weekday') || fullText.includes('monday') || fullText.includes('tuesday') || 
             fullText.includes('wednesday') || fullText.includes('thursday') || fullText.includes('friday')) {
    return 'weekday';
  }
  
  // Default fallback
  return 'weekday';
};

// Updated formatPrice function to handle currency formatting
const formatPrice = (price) => {
  return parseFloat(price || 0).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

// Updated calculateDaysBreakdown function (keep existing logic)
const calculateDaysBreakdown = async (startDateStr, numberOfNights) => {
  console.log('calculateDaysBreakdown called with:', { startDateStr, numberOfNights });
  
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

  console.log('Parsed start date:', startDateParsed);

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

  console.log('Starting breakdown calculation for', numberOfNights, 'nights');

  // Calculate breakdown for each night of the stay
  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(startDateParsed);
    currentDate.setDate(currentDate.getDate() + i);
    
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    
    console.log(`Day ${i + 1}: ${currentDate.toDateString()}, day of week: ${dayOfWeek}`);
    
    if (dayOfWeek === 6) { // Saturday
      breakdown.saturdays++;
    } else if (dayOfWeek === 0) { // Sunday
      breakdown.sundays++;
    } else { // Monday-Friday (1-5)
      breakdown.weekdays++;
    }
  }

  console.log('Final breakdown:', breakdown);
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