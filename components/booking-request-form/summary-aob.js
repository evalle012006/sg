/**
 * SummaryOfStayAOB
 *
 * Summary page for Accommodation-Only Bookings.
 * No package costs, no NDIS/iCare sections, no care analysis.
 * Shows: stay details, room selection + indicative total, signature, submit.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { scroller, Element } from 'react-scroll';
import SignatureInput from './signature-pad';
import { createSummaryDataAOB } from '../../services/booking/create-summary-data-aob';

const formatAUD = (amount) => {
  if (amount === null || amount === undefined || isNaN(amount)) return 'AUD 0.00';
  return `AUD ${parseFloat(amount).toLocaleString('en-AU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const SummaryOfStayAOB = ({
  bookingData,
  bookingId,
  origin,
  getRequestFormTemplate,
  bookingAmended,
  submitBooking,
}) => {
  const currentUser  = useSelector(state => state.user.user);
  const reduxRooms   = useSelector(state => state.bookingRequestForm.rooms);

  const [summary, setSummary]                       = useState(null);
  const [signaturePad, setSignaturePad]             = useState(null);
  const [signatureType, setSignatureType]           = useState('drawn');
  const [signatureValidationError, setSignatureValidationError] = useState(false);
  const [hasExistingSignature, setHasExistingSignature]         = useState(false);
  const [verbalConsent, setVerbalConsent] = useState({
    checked: false,
    timestamp: null,
    adminName: currentUser?.first_name && currentUser?.last_name
      ? `${currentUser.first_name} ${currentUser.last_name}`
      : 'Admin',
  });

  const summaryContainerRef = useRef();
  const signatureSectionRef = useRef();
  const signatureRef = useRef();

  // ── Build summary from bookingData ─────────────────────────────────────────
  useEffect(() => {
    if (!bookingData) return;

    // Merge Redux room state (real-time selections) over bookingData rooms
    const enriched = {
      ...bookingData,
      rooms: reduxRooms?.length > 0 ? reduxRooms : (bookingData.rooms || []),
    };

    setSummary(enriched);
  }, [bookingData, reduxRooms]);

  // ── Existing signature ─────────────────────────────────────────────────────
  useEffect(() => {
    if (bookingData?.signature) {
      setHasExistingSignature(true);
      setSignatureType(bookingData.signature.type || 'drawn');
    }
    if (bookingData?.verbal_consent) {
      setVerbalConsent(bookingData.verbal_consent);
    }
  }, [bookingData]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const scrollToSignature = () => {
    scroller.scrollTo('aob-signature-section', {
      duration: 800,
      delay: 0,
      smooth: 'easeInOutQuart',
      offset: -100,
    });
  };

  const validateSignature = () => {
    if (hasExistingSignature) return true;
    // signaturePad state is set by SignatureInput when user draws/uploads
    if (!signaturePad) return false;
    if (signatureType === 'drawn' && signaturePad.isEmpty?.()) return false;
    return true;
  };

  const saveVerbalConsent = async () => {
    if (origin !== 'admin') return true;
    if (!verbalConsent.checked) {
      toast.error('Please confirm verbal consent before continuing.');
      return false;
    }
    try {
      await fetch(`/api/bookings/${bookingId}/verbal-consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verbalConsent }),
      });
      return true;
    } catch {
      toast.error('Failed to save verbal consent. Please try again.');
      return false;
    }
  };

  const handleSubmit = async () => {
    if (!validateSignature()) {
      setSignatureValidationError(true);
      scroller.scrollTo('aob-signature-section', {
        duration: 500, delay: 0, smooth: 'easeInOutQuart', offset: -100,
      });
      toast.error('Please provide your signature before submitting.');
      return;
    }
    setSignatureValidationError(false);

    const consentOk = await saveVerbalConsent();
    if (!consentOk) return;

    let signatureData = null;
    if (hasExistingSignature) {
      signatureData = bookingData.signature;
    } else if (signaturePad) {
      signatureData = { type: signatureType, data: signaturePad.toDataURL?.() };
    }

    submitBooking(signatureData);
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (!summary) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-center py-12">
          <p className="text-gray-600">Loading summary...</p>
        </div>
      </div>
    );
  }

  const { data, pricing, rooms, guestName } = summary;
  const nights = data?.nights || pricing?.nights || 0;

  // ── Render ─────────────────────────────────────────────────────────────────
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
          <span className="italic text-red-400 text-lg font-bold block mb-4">
            Please note, your booking request is not submitted until you review, sign and submit your request below.
          </span>
        )}

        {/* Guest Details */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-xl font-semibold mb-4 text-slate-700">Booking Summary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {guestName && (
              <div>
                <span className="text-gray-500 block mb-1">Guest</span>
                <span className="font-medium text-gray-900">{guestName}</span>
              </div>
            )}
            {data?.datesOfStay && (
              <div>
                <span className="text-gray-500 block mb-1">Dates of Stay</span>
                <span className="font-medium text-gray-900">{data.datesOfStay}</span>
              </div>
            )}
            {nights > 0 && (
              <div>
                <span className="text-gray-500 block mb-1">Duration</span>
                <span className="font-medium text-gray-900">
                  {nights} {nights === 1 ? 'night' : 'nights'}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Room Selection & Pricing */}
        {rooms && rooms.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-4 text-slate-700">
              Room Selection &amp; Indicative Cost
            </h2>

            <div className="space-y-3 mb-4">
              {rooms.map((room, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-b-0"
                >
                  <span className="font-medium text-gray-900">
                    {room.room || room.name}
                  </span>
                  <span className="text-gray-700">
                    {formatAUD(room.price || room.price_per_night)} / night
                    {nights > 0 && (
                      <span className="ml-2 text-gray-500 text-sm">
                        ({formatAUD((room.price || room.price_per_night) * nights)} total)
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>

            {nights > 0 && pricing?.totalAccommodation > 0 && (
              <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                <span className="font-semibold text-slate-700">
                  Indicative Total ({nights} {nights === 1 ? 'night' : 'nights'})
                </span>
                <span className="font-bold text-slate-900 text-lg">
                  {formatAUD(pricing.totalAccommodation)}
                </span>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-3 italic">
              Indicative only. Final amount confirmed on booking approval. 
              Payment is required in full at least 48 hours before your stay or your booking will be cancelled.
            </p>
          </div>
        )}

        {/* Signature */}
        <Element name="aob-signature-section">
          <div ref={signatureSectionRef} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold mb-2 text-slate-700">Sign &amp; Submit</h2>
            <p className="text-sm text-gray-600 mb-6">
              By signing below you confirm that all information provided is accurate and you agree to
              Sargood on Collaroy's Terms and Conditions.
            </p>

            {/* Admin verbal consent */}
            {origin === 'admin' && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verbalConsent.checked}
                    onChange={e =>
                      setVerbalConsent(prev => ({
                        ...prev,
                        checked: e.target.checked,
                        timestamp: e.target.checked ? new Date().toISOString() : null,
                      }))
                    }
                    className="mt-1"
                  />
                  <span className="text-sm text-amber-900">
                    I confirm verbal consent was obtained from the guest ({verbalConsent.adminName}).
                  </span>
                </label>
              </div>
            )}

            <SignatureInput
                sigPad={signaturePad}
                setSignaturePad={setSignaturePad}
                signatureRef={signatureRef}
                origin={origin}
                clearSignature={() => {
                    signatureRef.current?.clear?.();
                    setSignaturePad(null);
                }}
                existingSignature={hasExistingSignature ? bookingData?.signature?.image : null}
                signatureType={signatureType}
                setSignatureType={setSignatureType}
                bookingAmended={false}
                onSignatureLoaded={(loaded) => {
                    if (loaded) setHasExistingSignature(true);
                }}
            />

            {signatureValidationError && (
              <p className="text-red-500 text-sm mt-2">Please provide your signature before submitting.</p>
            )}

            {origin !== 'admin' && (
              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  className="w-full sm:w-auto px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Submit Booking Request
                </button>
              </div>
            )}

            {origin === 'admin' && (
              <div className="mt-6">
                <button
                  onClick={handleSubmit}
                  className="w-full sm:w-auto px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
                >
                  Submit on Behalf of Guest
                </button>
              </div>
            )}
          </div>
        </Element>

      </div>
    </Element>
  );
};

export default SummaryOfStayAOB;