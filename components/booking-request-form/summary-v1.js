/**
 * SummaryOfStay v1 Component
 * 
 * Legacy version designed specifically for the old BookingRequestForm
 * Uses create-summary-data-legacy.js for data processing
 * 
 * Features:
 * - Simple package cost display (no care/course analysis)
 * - Standard room costs (no HSP pricing)
 * - Signature capture and submission
 * - NDIS question display
 * - Basic cost summary
 */

import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { scroller, Element } from 'react-scroll';
import SignatureInput from './signature-pad';

const formatAUD = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'AUD 0.00';
  return `AUD ${parseFloat(amount).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

const formatAUDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-AU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const SummaryOfStayV1 = ({ 
  bookingData, 
  bookingId, 
  origin, 
  getRequestFormTemplate,
  bookingAmended, 
  submitBooking
}) => {
  const currentUser = useSelector(state => state.user.user);
  const selectedRooms = useSelector(state => state.bookingRequestForm.rooms);
  
  const [summary, setSummary] = useState(null);
  const [signaturePad, setSignaturePad] = useState(null);
  const signatureRef = useRef();
  const signatureSectionRef = useRef();
  const [signatureValidationError, setSignatureValidationError] = useState(false);
  const [signatureType, setSignatureType] = useState('drawn');
  const [totalPackageCost, setTotalPackageCost] = useState(0);
  const [totalRoomCosts, setTotalRoomCosts] = useState({
    roomUpgrade: 0,
    additionalRoom: 0,
    total: 0
  });
  const [verbalConsent, setVerbalConsent] = useState({ 
    checked: false, 
    timestamp: null, 
    adminName: currentUser?.first_name && currentUser?.last_name 
      ? `${currentUser.first_name} ${currentUser.last_name}` 
      : 'Admin'
  });
  
  const [isSignatureLoading, setIsSignatureLoading] = useState(false);
  const [hasExistingSignature, setHasExistingSignature] = useState(false);

  const summaryContainerRef = useRef();

  // Initialize summary data from bookingData
  useEffect(() => {
    if (bookingData) {
      console.log('📊 SummaryOfStay v1 - Initializing with booking data:', bookingData);
      
      // Use rooms from Redux if available, otherwise from bookingData
      let roomsToUse = selectedRooms && selectedRooms.length > 0 
        ? selectedRooms 
        : bookingData.rooms || [];
      
      setSummary({
        ...bookingData,
        rooms: roomsToUse
      });
    }
  }, [bookingData, selectedRooms]);

  // Calculate package costs
  useEffect(() => {
    if (summary?.packageCosts) {
      const total = summary.packageCosts.totalCost || 0;
      setTotalPackageCost(total);
      console.log('💰 Package costs calculated:', total);
    }
  }, [summary?.packageCosts]);

  // Calculate room costs
  useEffect(() => {
    if (summary?.roomCosts) {
      const costs = {
        roomUpgrade: summary.roomCosts.roomUpgrade?.total || 0,
        additionalRoom: summary.roomCosts.additionalRoom?.total || 0
      };
      costs.total = costs.roomUpgrade + costs.additionalRoom;
      
      setTotalRoomCosts(costs);
      console.log('🏠 Room costs calculated:', costs);
    }
  }, [summary?.roomCosts]);

  // Check for existing signature
  useEffect(() => {
    if (bookingData?.signature) {
      setIsSignatureLoading(true);
      setSignatureType(bookingData.signature.type || 'drawn');
    }
    
    if (bookingData?.verbal_consent) {
      setVerbalConsent(bookingData.verbal_consent);
    }
  }, [bookingData]);

  const handleSetSignaturePad = (pad) => {
    setSignaturePad(pad);
    setSignatureType(pad ? 'drawn' : 'uploaded');
  };

  const clearSignature = () => {
    if (signaturePad) {
      signaturePad.clear();
    }
    setSignaturePad(null);
    setHasExistingSignature(false);
  };

  const scrollToSignature = () => {
    scroller.scrollTo('signature-section', {
      duration: 800,
      delay: 0,
      smooth: 'easeInOutQuart',
      offset: -100
    });
  };

  const validateSignature = () => {
    if (hasExistingSignature) {
      return true;
    }

    if (!signaturePad) {
      return false;
    }

    if (signatureType === 'drawn' && signaturePad.isEmpty && signaturePad.isEmpty()) {
      return false;
    }

    return true;
  };

  const saveVerbalConsent = async () => {
    if (origin !== 'admin') {
      return true;
    }

    if (!verbalConsent.checked) {
      toast.error('Please confirm verbal consent before continuing.');
      return false;
    }

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
      return false;
    }
  };

  const updateBooking = async () => {
    console.log('🚀 SummaryOfStay v1 - Submitting booking...');

    // Validate signature
    if (!validateSignature()) {
      setSignatureValidationError(true);
      toast.error(`Please ${signatureType === 'drawn' ? 'draw' : 'upload'} your signature before submitting.`);
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
      // Save verbal consent if admin
      if (origin === 'admin') {
        const consentSaved = await saveVerbalConsent();
        if (!consentSaved) return;
      }

      // Save signature
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

      // Submit booking
      if (submitBooking) {
        await submitBooking();
      } else {
        toast.success('Booking submitted successfully!');
        if (getRequestFormTemplate) {
          getRequestFormTemplate();
        }
      }
    } catch (error) {
      console.error('❌ Error submitting booking:', error);
      toast.error('Failed to submit booking. Please try again.');
    }
  };

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

  const isNDISFunder = summary?.data?.isNDISFunder || false;
  const nights = summary?.data?.nights || 0;

  return (
    <Element name="summary-of-stay-top">
      <div ref={summaryContainerRef} className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-start mb-6 flex-col sm:flex-row sm:items-center">
          <h1 className="text-2xl font-bold text-slate-700">Summary of Your Stay</h1>
          {origin !== 'admin' && (
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
        
        {origin !== 'admin' && (
          <span className='italic text-red-400 text-lg font-bold block mb-4'>
            Please note, your booking request is not submitted until you review, sign and submit your request below.
          </span>
        )}

        {/* Guest Information */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">Guest Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Guest Name</p>
              <p className="font-medium">{summary.guestName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Funder</p>
              <p className="font-medium">{summary.data?.funder}</p>
            </div>
            {summary.data?.participantNumber && (
              <div>
                <p className="text-sm text-gray-600">{summary.data.funder} Participant Number</p>
                <p className="font-medium">{summary.data.participantNumber}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-600">Number of Nights</p>
              <p className="font-medium">{nights}</p>
            </div>
            <div className="md:col-span-2">
              <p className="text-sm text-gray-600">Dates of Stay</p>
              <p className="font-medium">{summary.data?.datesOfStay}</p>
            </div>
          </div>
        </div>

        {/* Package Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">
            Package - cost to be charged to your funder
          </h2>
          <p className="text-gray-700 mb-4">
            <span className="font-medium">Package Name:</span> {summary.data?.packageTypeAnswer || summary.data?.ndisPackage}
          </p>

          {/* Package Cost Table */}
          {summary.packageCosts?.details && summary.packageCosts.details.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Package Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Line Item
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantity
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Subtotal
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {summary.packageCosts.details
                    .filter(detail => detail.quantity > 0)
                    .map((detail, index) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {detail.description || detail.package}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {detail.lineItem}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900">
                          {formatAUD(detail.rate || detail.price)}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-600">
                          {detail.quantity || detail.nights} {detail.rateCategoryQtyLabel || 'nights'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-medium text-gray-900">
                          {formatAUD(detail.total || detail.subtotal)}
                        </td>
                      </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan="4" className="px-4 py-3 text-sm font-semibold text-right text-gray-700">
                      Total Package Cost:
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-right text-gray-900">
                      {formatAUD(totalPackageCost)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        {/* Room Information */}
        {summary.rooms && summary.rooms.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">
              Selected Rooms
            </h2>
            <div className="space-y-3">
              {summary.rooms.map((room, index) => (
                <div key={index} className="flex justify-between items-center border-b border-gray-100 pb-2 last:border-b-0">
                  <div>
                    <span className="text-gray-900 font-medium">
                      {room.room || room.name}
                    </span>
                    {room.type === 'studio' && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">Studio</span>
                    )}
                  </div>
                  <span className="text-gray-600">
                    {formatAUD(room.price || room.price_per_night)} per night
                  </span>
                </div>
              ))}
            </div>
            {summary.rooms.every(r => r.type === 'studio') && (
              <p className="text-sm text-gray-500 mt-3 italic">
                Studio rooms are included in the package cost
              </p>
            )}
          </div>
        )}

        {/* Room Costs */}
        {(totalRoomCosts.roomUpgrade > 0 || totalRoomCosts.additionalRoom > 0) && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">
              Additional Room and Upgrade Costs
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              To be paid by you privately without prior approval by your funder
            </p>
            
            <div className="space-y-3">
              {totalRoomCosts.roomUpgrade > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Room Upgrade:</span>
                  <span className="font-medium">
                    {formatAUD(summary.roomCosts.roomUpgrade.perNight)} per night 
                    ({formatAUD(totalRoomCosts.roomUpgrade)} total)
                  </span>
                </div>
              )}
              
              {totalRoomCosts.additionalRoom > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-700">Additional Room:</span>
                  <span className="font-medium">
                    {formatAUD(summary.roomCosts.additionalRoom.perNight)} per night 
                    ({formatAUD(totalRoomCosts.additionalRoom)} total)
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-semibold text-gray-900">Total Out of Pocket:</span>
                <span className="font-bold text-gray-900">{formatAUD(totalRoomCosts.total)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Cost Summary */}
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">Cost Summary</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-700">
                Package Cost <span className="text-sm italic">(To be billed to your funder)</span>:
              </span>
              <span className="font-medium">{formatAUD(totalPackageCost)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-700">
                Additional Room and Upgrade Costs <span className="text-sm italic">(To be paid privately by you)</span>:
              </span>
              <span className="font-medium">{formatAUD(totalRoomCosts.total)}</span>
            </div>
            <div className="flex justify-between items-center pt-3 border-t-2 border-blue-300">
              <span className="text-lg font-bold text-gray-900">Grand Total:</span>
              <span className="text-lg font-bold text-gray-900">
                {formatAUD(totalPackageCost + totalRoomCosts.total)}
              </span>
            </div>
          </div>
        </div>

        {/* NDIS Questions */}
        {isNDISFunder && summary.data?.ndisQuestions && summary.data.ndisQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">NDIS Questions</h2>
            <div className="space-y-4">
              {summary.data.ndisQuestions.slice(0, 3).map((item, index) => (
                <div key={index} className="border-b border-gray-200 pb-3 last:border-b-0">
                  <p className="text-sm font-medium text-gray-700 mb-1">{item.question}</p>
                  <div className="text-sm text-gray-600">
                    {Array.isArray(item.answer) ? (
                      <ul className="list-disc list-inside space-y-1">
                        {item.answer.map((ans, i) => (
                          <li key={i}>{ans}</li>
                        ))}
                      </ul>
                    ) : (
                      <p>{item.answer}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Signature Section */}
        <Element name="signature-section">
          <div ref={signatureSectionRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">Agreement Signature</h2>
            <p className="text-gray-700 mb-4">
              I have read, understood and agreed to Sargood on Collaroy&apos;s Terms and Conditions
            </p>

            {signatureValidationError && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">
                      Please {signatureType === 'drawn' ? 'draw your signature' : 'upload your signature'} before submitting.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {origin === 'admin' && (
              <div className="flex items-center space-x-2 mb-4">
                <input
                  type="checkbox"
                  checked={verbalConsent.checked}
                  onChange={(e) => setVerbalConsent({
                    ...verbalConsent, 
                    checked: e.target.checked, 
                    timestamp: new Date().toISOString()
                  })}
                  className="rounded-md p-2"
                />
                <label className="text-sm text-slate-700">
                  Verbal consent for amendment(s) has been gained from the guest
                </label>
              </div>
            )}

            {origin !== 'admin' && verbalConsent?.checked && (
              <div className="flex items-center space-x-2 mb-4">
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
              existingSignature={bookingData?.signature?.image}
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
              <div className="text-sm text-blue-600 mt-2">Loading signature...</div>
            )}
            
            <div className="flex justify-end mt-6">
              <button
                onClick={updateBooking}
                disabled={isSignatureLoading}
                className={`px-6 py-2 rounded-lg font-medium ${
                  isSignatureLoading 
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-blue-600 hover:bg-blue-700'
                } text-white transition-colors`}
              >
                {isSignatureLoading ? 'Loading...' : 'Submit'}
              </button>
            </div>
          </div>
        </Element>
      </div>
    </Element>
  );
};

export default SummaryOfStayV1;