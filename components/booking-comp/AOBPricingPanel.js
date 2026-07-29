/**
 * AOBPricingPanel
 *
 * Displays indicative accommodation pricing for an accommodation-only booking
 * in the admin booking detail view. Reads room rates directly from the booking's
 * associated Rooms → RoomType data — no package logic, no funder context.
 * Styled to match DetailSidebar's plain sectioned layout, not a floating card.
 */

import React, { useMemo, useState } from 'react';
import { getAobPricing, formatAUD } from '../../utilities/aobPricing';
import moment from 'moment';
import { Can } from '../../services/acl/can';
import { toast } from 'react-toastify';

const AOBPricingPanel = ({ booking, onSendPaymentLink, sendingLink }) => {
    const [showRefundModal, setShowRefundModal] = useState(false);
    const [refundReason, setRefundReason] = useState('');
    const [processingRefund, setProcessingRefund] = useState(false);

    const { rooms, nights, checkinDate, checkoutDate, indicativeTotalCents } = useMemo(
        () => getAobPricing(booking),
        [booking]
    );

    const handleConfirmRefund = async () => {
        setProcessingRefund(true);
        try {
            const response = await fetch(`/api/bookings/${booking.uuid}/refund`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason: refundReason.trim() || null }),
            });
            const data = await response.json();

            if (!response.ok) {
                toast.error(data.error || 'Failed to process refund.');
                return;
            }

            toast.success(
                data.status === 'succeeded'
                    ? 'Refund processed successfully.'
                    : 'Refund initiated — awaiting confirmation from Stripe.'
            );
            setShowRefundModal(false);
            setRefundReason('');
            // caller (booking detail page) should re-fetch booking after this,
            // same as onSendPaymentLink's existing pattern
        } catch (err) {
            console.error('Error processing refund:', err);
            toast.error('Failed to process refund. Please try again.');
        } finally {
            setProcessingRefund(false);
        }
    };

    if (!booking || booking.booking_type !== 'accommodation_only') return null;

    const paidAmountCents = booking?.PaymentLinks?.[0]?.amount_cents; // the actual paid link's amount

    return (
        <div className="p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 uppercase tracking-wide">
                Accommodation Pricing
            </h3>

            {/* Stay dates summary */}
            {checkinDate && checkoutDate && (
                <div className="flex justify-between text-sm text-gray-600 mb-3 pb-3 border-b border-gray-100">
                    <span>{checkinDate} → {checkoutDate}</span>
                    <span className="font-medium">
                        {nights} {nights === 1 ? 'night' : 'nights'}
                    </span>
                </div>
            )}

            {/* Room line items */}
            {rooms.length > 0 ? (
                <div className="space-y-2 mb-3">
                    {rooms.map((room, i) => (
                        <div key={i} className="flex justify-between items-start text-sm">
                            <div>
                                <span className="text-gray-900 font-medium">{room.name}</span>
                                {room.peakRate > 0 && (
                                    <span className="ml-2 text-xs text-orange-600">
                                        (Peak: {formatAUD(room.peakRate * 100)}/night)
                                    </span>
                                )}
                            </div>
                            <div className="text-right text-gray-700">
                                <div>{formatAUD(room.pricePerNight * 100)}/night</div>
                                {nights > 0 && (
                                    <div className="text-xs text-gray-500">
                                        {formatAUD(room.pricePerNight * nights * 100)} total
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 mb-3">No room selected</p>
            )}

            {/* Total */}
            {rooms.length > 0 && nights > 0 && (
                <div className="flex justify-between items-center pt-3 border-t border-gray-200">
                    <span className="text-sm font-medium text-gray-700">
                        Indicative Total
                    </span>
                    <span className="font-semibold text-gray-900">
                        {formatAUD(indicativeTotalCents)}
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

            {/* Payment link status indicator */}
            {booking?.status_name === 'booking_confirmed' &&
             booking?.payment_status !== 'paid' && (
                <div className={`mt-4 px-3 py-2 rounded text-xs ${
                    booking?.PaymentLinks?.[0]?.sent_at
                        ? 'bg-blue-50 text-blue-700 border border-blue-100'
                        : 'bg-gray-50 text-gray-500 border border-gray-200'
                }`}>
                    {booking?.PaymentLinks?.[0]?.sent_at
                        ? `📧 Link sent ${moment(booking.PaymentLinks[0].sent_at).fromNow()}`
                        : '📭 Payment link not yet sent'}
                </div>
            )}

            {onSendPaymentLink && booking?.status_name === 'booking_confirmed' && !['paid', 'refunded', 'partially_refunded'].includes(booking?.payment_status) && (
                <button
                    onClick={onSendPaymentLink}
                    disabled={sendingLink}
                    className="mt-3 w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
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
                <>
                    <div className="mt-3 flex items-center gap-2 text-green-700 bg-green-50 rounded px-3 py-2 text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Payment received
                    </div>

                    <Can I="Create/Edit" a="Booking">
                        <button
                            onClick={() => setShowRefundModal(true)}
                            className="mt-2 w-full px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium rounded-lg transition-colors"
                        >
                            Process Refund
                        </button>
                    </Can>
                </>
            )}

            {booking?.payment_status === 'refunded' && (
                <>
                    <div className="mt-3 flex items-center gap-2 text-gray-600 bg-gray-50 rounded px-3 py-2 text-sm font-medium">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4m0 0l4-4m-4 4h11a4 4 0 010 8h-1" />
                        </svg>
                        Refunded
                    </div>

                    {/* Only surface this when the booking is refunded but NOT cancelled —
                        i.e. someone manually refunded via the button without also cancelling.
                        A cancelled+refunded booking (the auto-refund path) already has both
                        sides resolved and should never see this nudge. */}
                    {booking?.status_name === 'booking_confirmed' && (
                        <p className="mt-2 text-xs text-amber-600 italic">
                            This booking is still marked as Confirmed. If the stay is no longer going ahead, remember to cancel it separately.
                        </p>
                    )}
                </>
            )}

            {showRefundModal && (
                <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center" onClick={() => setShowRefundModal(false)}>
                    <div className="bg-white rounded-lg shadow-lg w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
                        <h2 className="text-lg font-bold text-gray-900 mb-2">Process Refund</h2>
                        <p className="text-sm text-gray-600 mb-4">
                            This will refund the full amount paid ({formatAUD(paidAmountCents)}) to the guest via Stripe. This cannot be undone.
                        </p>
                        <textarea
                            className="w-full rounded-lg border border-gray-300 px-3 py-3 text-sm mb-4"
                            rows="3"
                            value={refundReason}
                            onChange={(e) => setRefundReason(e.target.value)}
                            placeholder="Reason for refund (optional)"
                        />
                        <div className="flex justify-end gap-3">
                            <button
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                                onClick={() => setShowRefundModal(false)}
                                disabled={processingRefund}
                            >
                                Cancel
                            </button>
                            <button
                                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                                onClick={handleConfirmRefund}
                                disabled={processingRefund}
                            >
                                {processingRefund ? 'Processing...' : 'Confirm Refund'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AOBPricingPanel;