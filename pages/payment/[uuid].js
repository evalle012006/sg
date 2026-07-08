import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import moment from 'moment';

const formatAUD = (cents) =>
  `AUD ${(cents / 100).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PaymentPage() {
  const router    = useRouter();
  const { uuid, cancelled } = router.query;
  const [state, setState] = useState('loading'); // loading | redirecting | processing | paid | cancelled | expired | error
  const [details, setDetails] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!uuid) return;

    // Guest declined/backed out of Stripe Checkout — no need to poll or
    // hit the API, this is an immediate, certain state.
    if (cancelled === 'true') {
      setState('cancelled');
      return;
    }

    let isCancelledEffect = false;
    let attempts = 0;
    const maxAttempts = 5;
    const pollInterval = 3000;

    const checkStatus = () => {
      fetch(`/api/stripe/payment-link/${uuid}`)
        .then(r => r.json())
        .then(data => {
          if (isCancelledEffect) return;

          if (data.status === 'pending') {
            setDetails(data);
            setState('redirecting');
            window.location.href = data.url;
          } else if (data.status === 'paid') {
            setDetails(data);
            setState('paid');
          } else if (data.status === 'processing') {
            if (attempts < maxAttempts) {
              attempts++;
              setState('processing');
              setTimeout(checkStatus, pollInterval);
            } else {
              // Webhook still hasn't landed after ~15s of polling — don't leave
              // the guest stuck; tell them plainly rather than spinning forever.
              setState('error');
              setMessage('Your payment is still being confirmed. Please check back in a few minutes, or contact us if this persists.');
            }
          } else if (data.status === 'booking_cancelled') {
            setState('booking_cancelled');
            setMessage(data.message);
          } else {
            setState('expired');
            setMessage(data.message);
          }
        })
        .catch(() => {
          if (!isCancelledEffect) {
            setState('error');
            setMessage('Something went wrong. Please contact Sargood on Collaroy.');
          }
        });
    };

    checkStatus();

    return () => { isCancelledEffect = true; };
  }, [uuid, cancelled]);

  return (
    <>
      <Head>
        <title>Sargood on Collaroy — Secure Payment</title>
      </Head>

      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">

          <div className="mb-6">
            <div className="w-16 h-16 bg-yellow-400 rounded-full mx-auto flex items-center justify-center">
              <span className="text-white font-bold text-xl">S</span>
            </div>
            <p className="text-gray-500 text-sm mt-2">Sargood on Collaroy</p>
          </div>

          {state === 'loading' && (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Loading your payment details...</p>
            </>
          )}

          {state === 'redirecting' && (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-4" />
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Redirecting to secure payment</h1>
              {details && (
                <p className="text-gray-600 text-sm mb-4">
                  Amount: <span className="font-medium">{formatAUD(details.amount)}</span>
                </p>
              )}
              <p className="text-xs text-gray-400">
                You will be redirected to Stripe's secure payment page. If you are not redirected automatically,{' '}
                <a href={details?.url} className="text-blue-600 underline">click here</a>.
              </p>
            </>
          )}

          {state === 'processing' && (
            <>
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Confirming your payment</h1>
              <p className="text-gray-600 text-sm">
                This will only take a moment. Please don't close this page.
              </p>
            </>
          )}

          {state === 'paid' && details && (
            <>
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Payment Confirmed</h1>

              {details.booking?.guest_name && (
                <p className="text-gray-600 text-sm mb-1">Thank you, {details.booking.guest_name}!</p>
              )}

              <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-700 my-4 space-y-1">
                {details.booking?.reference_id && (
                  <p><span className="text-gray-500">Booking Ref:</span> <span className="font-medium">{details.booking.reference_id}</span></p>
                )}
                {details.booking?.check_in && details.booking?.check_out && (
                  <p>
                    <span className="text-gray-500">Stay:</span>{' '}
                    <span className="font-medium">
                      {moment(details.booking.check_in).format('DD MMM YYYY')} → {moment(details.booking.check_out).format('DD MMM YYYY')}
                    </span>
                  </p>
                )}
                <p><span className="text-gray-500">Amount paid:</span> <span className="font-medium">{formatAUD(details.amountCents)}</span></p>
              </div>

              {details.receiptUrl && (
                <a
                  href={details.receiptUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-blue-600 underline text-sm mb-4"
                >
                  View Stripe receipt
                </a>
              )}

              <p className="text-gray-600 text-sm">
                You should also receive a confirmation email shortly.
                Contact us at <a href="mailto:bookings@sargoodoncollaroy.com.au" className="text-blue-600 underline">bookings@sargoodoncollaroy.com.au</a> if you have any questions.
              </p>
            </>
          )}

          {state === 'cancelled' && (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Payment not completed</h1>
              <p className="text-gray-600 text-sm mb-4">
                You have not been charged. Your payment link is still valid — you can complete payment using the original link sent to your email.
              </p>
              <p className="text-sm text-gray-500">
                Need a new link? Contact us at{' '}
                <a href="mailto:bookings@sargoodoncollaroy.com.au" className="text-blue-600 underline">
                  bookings@sargoodoncollaroy.com.au
                </a>
              </p>
            </>
          )}

          {(state === 'expired' || state === 'error') && (
            <>
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Payment link unavailable</h1>
              <p className="text-gray-600 text-sm mb-4">
                {message || 'This payment link is no longer valid.'}
              </p>
              <div className="bg-gray-50 rounded-lg p-4 text-left text-sm text-gray-600">
                <p className="font-medium mb-2">Need help? Contact us:</p>
                <p>📧 <a href="mailto:bookings@sargoodoncollaroy.com.au" className="text-blue-600 underline">bookings@sargoodoncollaroy.com.au</a></p>
                <p>📞 (02) 9971 0522</p>
              </div>
            </>
          )}

          {state === 'booking_cancelled' && (
            <>
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-gray-900 mb-2">Booking Cancelled</h1>
              <p className="text-gray-600 text-sm mb-4">{message}</p>
            </>
          )}

        </div>
      </div>
    </>
  );
}