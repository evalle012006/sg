/**
 * AOBPricingPanel
 *
 * Displays indicative accommodation pricing for an accommodation-only booking
 * in the admin booking detail view. Reads room rates directly from the booking's
 * associated Rooms → RoomType data — no package logic, no funder context.
 */

import React, { useMemo } from 'react';
import moment from 'moment';

const formatAUD = (amount) => {
    if (!amount && amount !== 0) return '—';
    return `AUD ${parseFloat(amount).toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};

const AOBPricingPanel = ({ booking, onSendPaymentLink, sendingLink }) => {
    const { rooms, nights, checkinDate, checkoutDate } = useMemo(() => {
        if (!booking) return { rooms: [], nights: 0, checkinDate: null, checkoutDate: null };

        // Extract dates from preferred_arrival/departure_date or QaPairs
        let checkinDate  = booking.preferred_arrival_date
            ? moment(booking.preferred_arrival_date).format('DD/MM/YYYY')
            : null;
        let checkoutDate = booking.preferred_departure_date
            ? moment(booking.preferred_departure_date).format('DD/MM/YYYY')
            : null;

        // Fall back to QaPairs if preferred dates not set
        if (!checkinDate || !checkoutDate) {
            for (const section of booking.Sections || []) {
                for (const qa of section.QaPairs || []) {
                    const key = qa.Question?.question_key;
                    if (!key || !qa.answer) continue;
                    if (key === 'check-in-date')  checkinDate  = qa.answer;
                    if (key === 'check-out-date') checkoutDate = qa.answer;
                    if (key === 'check-in-date-and-check-out-date') {
                        const parts = qa.answer.split(' - ');
                        if (parts.length === 2) {
                            checkinDate  = parts[0].trim();
                            checkoutDate = parts[1].trim();
                        }
                    }
                }
            }
        }

        // Calculate nights
        let nights = 0;
        if (checkinDate && checkoutDate) {
            const ci = moment(checkinDate,  ['YYYY-MM-DD', 'DD/MM/YYYY']);
            const co = moment(checkoutDate, ['YYYY-MM-DD', 'DD/MM/YYYY']);
            if (ci.isValid() && co.isValid()) {
                nights = Math.max(0, co.diff(ci, 'days'));
            }
        }

        // Rooms with their rates
        const rooms = (booking.Rooms || []).map(room => ({
            name:           room.label || room.RoomType?.name || 'Room',
            type:           room.RoomType?.type || 'studio',
            pricePerNight:  room.RoomType?.price_per_night || 0,
            peakRate:       room.RoomType?.peak_rate       || 0,
        }));

        return { rooms, nights, checkinDate, checkoutDate };
    }, [booking]);

    const totalPerNight    = rooms.reduce((sum, r) => sum + r.pricePerNight, 0);
    const totalAccommodation = totalPerNight * nights;

    if (!booking || booking.booking_type !== 'accommodation_only') return null;

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 uppercase tracking-wide">
                Accommodation Pricing
            </h3>

            {/* Stay dates summary */}
            {checkinDate && checkoutDate && (
                <div className="flex justify-between text-sm text-gray-600 mb-4 pb-3 border-b border-gray-100">
                    <span>{checkinDate} → {checkoutDate}</span>
                    <span className="font-medium">
                        {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                </div>
            )}

            {/* Room line items */}
            {rooms.length > 0 ? (
                <div className="space-y-2 mb-4">
                    {rooms.map((room, i) => (
                        <div key={i} className="flex justify-between items-start text-sm">
                            <div>
                                <span className="text-gray-900 font-medium">{room.name}</span>
                                {room.peakRate > 0 && (
                                    <span className="ml-2 text-xs text-orange-600">
                                        (Peak: {formatAUD(room.peakRate)}/night)
                                    </span>
                                )}
                            </div>
                            <div className="text-right text-gray-700">
                                <div>{formatAUD(room.pricePerNight)}/night</div>
                                {nights > 0 && (
                                    <div className="text-xs text-gray-500">
                                        {formatAUD(room.pricePerNight * nights)} total
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 mb-4">No room selected</p>
            )}

            {/* Total */}
            {rooms.length > 0 && nights > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-900">
                        Indicative Total
                    </span>
                    <span className="font-bold text-gray-900">
                        {formatAUD(totalAccommodation)}
                    </span>
                </div>
            )}

            {/* Peak rate note */}
            {rooms.some(r => r.peakRate > 0) && (
                <p className="text-xs text-orange-600 mt-2 italic">
                    Peak rate applies during peak periods. Confirm applicable rate with Sargood staff.
                </p>
            )}

            <p className="text-xs text-gray-400 mt-2 italic">
                Indicative only. Payment required in full at least 48 hours before arrival.
            </p>

            {/* Admin: Send Payment Link */}
            {/* Payment link status indicator */}
            {booking?.booking_type === 'accommodation_only' && 
             booking?.status_name === 'booking_confirmed' && 
             booking?.payment_status !== 'paid' && (
              <div style={{ 
                marginTop: 12, 
                padding: '8px 12px', 
                borderRadius: 6,
                backgroundColor: booking?.PaymentLinks?.[0]?.sent_at ? '#eff6ff' : '#f8fafc',
                border: '1px solid',
                borderColor: booking?.PaymentLinks?.[0]?.sent_at ? '#bfdbfe' : '#e2e8f0',
                fontSize: 12,
                color: booking?.PaymentLinks?.[0]?.sent_at ? '#1d4ed8' : '#64748b',
              }}>
                {booking?.PaymentLinks?.[0]?.sent_at 
                  ? `📧 Link sent ${moment(booking.PaymentLinks[0].sent_at).fromNow()}`
                  : '📭 Payment link not yet sent'}
              </div>
            )}

            {onSendPaymentLink && booking?.status_name === 'booking_confirmed' && booking?.payment_status !== 'paid' && (
                <button
                    onClick={onSendPaymentLink}
                    disabled={sendingLink}
                    className="mt-4 w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                    {sendingLink ? (
                        <>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Generating link...
                        </>
                    ) : (
                        booking?.PaymentLinks?.[0]?.sent_at ? 'Resend Payment Link' : 'Send Payment Link to Guest'
                    )}
                </button>
            )}

            {booking?.payment_status === 'paid' && (
                <div className="mt-4 flex items-center gap-2 text-green-700 bg-green-50 rounded-lg px-3 py-2 text-sm font-medium">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Payment received
                </div>
            )}
        </div>
    );
};

export default AOBPricingPanel;