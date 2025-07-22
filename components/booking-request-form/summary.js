import React, { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import SignatureInput from './signature-pad';
import { getNSWHolidaysV2 } from '../../services/booking/create-summary-data';
import { serializePackage } from '../../utilities/common';

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

  const scrollToSignature = () => {
    signatureSectionRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSetSignaturePad = (newSigPad) => {
    if (newSigPad && typeof newSigPad.isEmpty === 'function') {
        setSignaturePad(newSigPad);
    }
  };

  const updateBooking = async () => {
    if (origin == 'admin') {
        onContinue();
        return;
    }
    
    // console.log('Signature Pad:', signaturePad);
    // console.log('Signature isEmpty Type:', typeof signaturePad?.isEmpty);
    // console.log('Signature isEmpty:', signaturePad?.isEmpty?.());
    // console.log('Has Existing Signature:', hasExistingSignature);
    // console.log('Is Signature Loading:', isSignatureLoading);
    
    const hasValidSignature = signaturePad && 
      typeof signaturePad.isEmpty === 'function' && 
      !signaturePad.isEmpty();
    
    if (!hasValidSignature && !hasExistingSignature) {
        toast.error('Please sign the agreement before continuing.');
        return;
    }

    // If we're still loading the signature, wait a bit
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

  useEffect(() => {
    let summaryData = { ...bookingData };

    console.log('Summary Data:', summaryData);

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
      
      // Set a timeout to ensure signature loading completes
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
  }, [bookingData, selectedRooms]);

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
          <p className="text-gray-900 p-2">{ summary?.data?.funder }</p>
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
        
        {/* Show loading indicator if signature is being loaded */}
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

const PricingTable = ({ option, datesOfStay, nights = 0, setTotalPackageCost }) => {
  const [dataOption, setDataOption] = useState([]);
  const [daysBreakdown, setDaysBreakdown] = useState({
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: 0
  });

  const calculateTotalCost = () => {
    if (!dataOption.length) return 0;

    return (
      dataOption[0].price * daysBreakdown.weekdays +
      dataOption[1].price * daysBreakdown.saturdays +
      dataOption[2].price * daysBreakdown.sundays +
      dataOption[3].price * daysBreakdown.publicHolidays
    );
  };

  useEffect(() => {
    const pricingData = getPricing(option);
    setDataOption(pricingData);
    if (datesOfStay && nights > 0) {
      const handleGetBreakdown = async () => {
        const breakdown = await calculateDaysBreakdown(datesOfStay, nights);
        setDaysBreakdown(breakdown);
      }
      handleGetBreakdown();
    }
  }, [option, datesOfStay, nights]);

  useEffect(() => {
    if (setTotalPackageCost && dataOption.length > 0) {
      const totalCost = calculateTotalCost();
      setTotalPackageCost(totalCost);
    }
  }, [dataOption, daysBreakdown, setTotalPackageCost]);

  return (
    <div className="w-full max-w-4xl">
      <table className="w-full border-collapse bg-white">
        <thead>
          <tr className="bg-[#20485A] text-white">
            <th className="p-3 text-left border border-gray-300">
              {option === 'HCSP' ? '1:1 STA Package' : '1:2 STA Package'}
            </th>
            <th className="p-3 text-left border border-gray-300">Line Item</th>
            <th className="p-3 text-left border border-gray-300">Price/night</th>
            <th className="p-3 text-left border border-gray-300">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {dataOption.map((row, index) => {
            const nights = [
              daysBreakdown.weekdays,
              daysBreakdown.saturdays,
              daysBreakdown.sundays,
              daysBreakdown.publicHolidays
            ][index];
            return (
              <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-3 border border-gray-300">{row.package}</td>
                <td className="p-3 border border-gray-300">{row.lineItem}</td>
                <td className="p-3 border border-gray-300">${formatPrice(row.price)}</td>
                <td className="p-3 border border-gray-300">{nights}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const formatPrice = (price) => {
  return price.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const calculateDaysBreakdown = async (startDateStr, numberOfNights) => {
  const startDate = startDateStr.split(' - ')[0].split('/').reverse().join('-');

  const dates = startDateStr.split(' - ');
  const holidays = await getNSWHolidaysV2(dates[0], dates[1]);
  
  let breakdown = {
    weekdays: 0,
    saturdays: 0,
    sundays: 0,
    publicHolidays: holidays.length || 0
  };

  for (let i = 0; i < numberOfNights; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(currentDate.getDate() + i);

    // const holidayData = await checkNSWPublicHoliday(currentDate);
    // if (holidayData?.isHoliday) {
    //   breakdown.publicHolidays++;
    // } else {
      const day = currentDate.getDay();
      if (day === 6) { // Saturday
        breakdown.saturdays++;
      } else if (day === 0) { // Sunday
        breakdown.sundays++;
      } else { // Monday-Friday
        breakdown.weekdays++;
      }
    // }
  }

  return breakdown;
};


const getPricing = (option) => {
  switch (option) {
    case 'SP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:2 Weekday", lineItem: "01_054_0115_1_1", price: 950.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Saturday", lineItem: "01_055_0115_1_1", price: 1100.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Sunday", lineItem: "01_056_0115_1_1", price: 1250.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday", lineItem: "01_057_0115_1_1", price: 1500.00, type: 'publicHoliday' }
      ];
    case 'CSP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:2 Weekday", lineItem: "01_054_0115_1_1", price: 1100.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Saturday", lineItem: "01_055_0115_1_1", price: 1400.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Sunday", lineItem: "01_056_0115_1_1", price: 1750.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:2 Public Holiday", lineItem: "01_057_0115_1_1", price: 2000.00, type: 'publicHoliday' }
      ];
    case 'HCSP':
      return [
        { package: "STA And Assistance (Inc. Respite) - 1:1 Weekday", lineItem: "01_058_0115_1_1", price: 1740.00, type: 'weekday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Saturday", lineItem: "01_059_0115_1_1", price: 1850.00, type: 'saturday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Sunday", lineItem: "01_060_0115_1_1", price: 2000.00, type: 'sunday' },
        { package: "STA And Assistance (Inc. Respite) - 1:1 Public Holiday", lineItem: "01_061_0115_1_1", price: 2250.00, type: 'publicHoliday' }
      ];
    default:
      return [];
  }
};

const formatAUDate = (dateStr) => {
  return new Date(dateStr).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}