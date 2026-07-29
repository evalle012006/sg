import React, { useState } from 'react';
import { useRouter } from 'next/router';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const Layout = dynamic(() => import('../../components/layout'));
const Spinner = dynamic(() => import('../../components/ui/spinner'));

// ── Icons ─────────────────────────────────────────────────────────────────────

function AccommodationIcon({ selected }) {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
                d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V10.5z"
                stroke={selected ? '#fff' : '#00467F'}
                strokeWidth="1.75"
                strokeLinejoin="round"
            />
            <path
                d="M9 21V13h6v8"
                stroke={selected ? '#fff' : '#00467F'}
                strokeWidth="1.75"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function FundedIcon({ selected }) {
    return (
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle
                cx="9" cy="7" r="4"
                stroke={selected ? '#fff' : '#00467F'}
                strokeWidth="1.75"
            />
            <path
                d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"
                stroke={selected ? '#fff' : '#00467F'}
                strokeWidth="1.75"
                strokeLinejoin="round"
            />
            <path
                d="M16 3.13a4 4 0 010 7.75M21 21v-2a4 4 0 00-3-3.87"
                stroke={selected ? '#fff' : '#00467F'}
                strokeWidth="1.75"
                strokeLinejoin="round"
            />
        </svg>
    );
}

function RadioDot({ selected }) {
    return (
        <div style={{
            width: 20,
            height: 20,
            borderRadius: '50%',
            border: selected ? '2px solid #00467F' : '2px solid #CBD5E1',
            backgroundColor: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'border-color 0.15s',
        }}>
            {selected && (
                <div style={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    backgroundColor: '#00467F',
                }} />
            )}
        </div>
    );
}

// ── PathwayCard ───────────────────────────────────────────────────────────────

function PathwayCard({ id, title, description, Icon, selected, onSelect }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect();
        }
    };

    return (
        <div
            id={id}
            role="radio"
            aria-checked={selected}
            aria-describedby={`${id}-desc`}
            tabIndex={0}
            onClick={onSelect}
            onKeyDown={handleKeyDown}
            style={{
                display: 'flex',
                alignItems: 'stretch',      // icon panel stretches full height
                borderRadius: 8,
                border: selected ? '2px solid #00467F' : '2px solid #E2E8F0',
                overflow: 'hidden',
                cursor: 'pointer',
                backgroundColor: '#fff',
                outline: 'none',
                transition: 'border-color 0.15s',
                minHeight: 88,
            }}
            className="focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-blue-700"
        >
            {/* Left icon panel — stretches full card height */}
            <div style={{
                width: 72,
                backgroundColor: selected ? '#00467F' : '#F1F5F9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background-color 0.15s',
            }}>
                <Icon selected={selected} />
            </div>

            {/* Text block */}
            <div style={{
                flex: 1,
                padding: '16px 16px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
            }}>
                <p style={{
                    margin: 0,
                    fontWeight: 700,
                    fontSize: 15,
                    color: '#00467F',
                    lineHeight: 1.3,
                }}>
                    {title}
                </p>
                <p
                    id={`${id}-desc`}
                    style={{
                        margin: '5px 0 0',
                        fontSize: 13,
                        color: '#64748B',
                        lineHeight: 1.55,
                    }}
                >
                    {description}
                </p>
            </div>

            {/* Radio dot */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                paddingRight: 16,
                paddingLeft: 8,
                flexShrink: 0,
            }}>
                <RadioDot selected={selected} />
            </div>
        </div>
    );
}

// ── Options ───────────────────────────────────────────────────────────────────

const PATHWAY_OPTIONS = [
    {
        value: 'accommodation_only',
        title: 'Book and pay for accommodation only',
        description: "Pay privately for a self-funded stay. A streamlined form with no funding or services — ideal if you're covering the cost yourself.",
        Icon: AccommodationIcon,
    },
    {
        value: 'funded',
        title: 'Make the most of services and funding',
        description: "Use funding from NDIS, iCare or another funder and access Sargood's full services. This is the complete booking request form.",
        Icon: FundedIcon,
    },
];

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BookingTypeSelectPage() {
    const router = useRouter();
    const user = useSelector(state => state.user.user);

    const [selectedType, setSelectedType] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleGroupKeyDown = (e) => {
        const values = PATHWAY_OPTIONS.map(o => o.value);
        const currentIndex = values.indexOf(selectedType);
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            const next = values[(currentIndex + 1) % values.length];
            setSelectedType(next);
            document.getElementById(`card-${next}`)?.focus();
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            const prev = values[(currentIndex - 1 + values.length) % values.length];
            setSelectedType(prev);
            document.getElementById(`card-${prev}`)?.focus();
        }
    };

    const handleContinue = async () => {
        if (!selectedType || loading) return;
        setLoading(true);

        try {
            const createRes = await fetch('/api/bookings/book-now/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ guestId: user.id, bookingType: selectedType }),
            });

            if (!createRes.ok) {
                toast.error('Something went wrong. Unable to create booking at the moment.');
                setLoading(false);
                return;
            }

            const newBooking = await createRes.json();

            const brfRes = await fetch('/api/booking-request-form/check-booking-section', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ bookingId: newBooking.id, bookingType: selectedType }),
            });

            if (!brfRes.ok) {
                toast.error('Something went wrong. Unable to set up booking form at the moment.');
                setLoading(false);
                return;
            }

            setTimeout(() => {
                const base = `/booking-request-form?uuid=${newBooking.uuid}`;
                const prevParam = newBooking.prevBookingId ? `&prevBookingId=${newBooking.prevBookingId}` : '';
                const typeParam = `&type=${selectedType}`;
                window.open(`${base}${prevParam}${typeParam}`, '_self');
            }, 500);

        } catch (err) {
            console.error('❌ BookingTypeSelect error:', err);
            toast.error('Something went wrong. Please try again.');
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <Layout title="New Booking" hideSidebar={true} hideTitleBar={true}>
                <div className="h-screen flex items-center justify-center">
                    <Spinner />
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="New Booking" hideSidebar={true} hideTitleBar={true}>
            {/*
              Outer wrapper: white bg, full remaining height.
              Flex centering on desktop; on mobile just top-pads so content
              starts below the Layout header naturally.
            */}
            <div style={{
                minHeight: 'calc(100vh - 80px)',
                backgroundColor: '#fff',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'center',
                padding: '40px 20px 64px',
                boxSizing: 'border-box',
            }}>
                <div style={{ width: '100%', maxWidth: 640 }}>

                    {/* Eyebrow */}
                    <p style={{
                        margin: '0 0 6px',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        color: '#FFCE00',
                    }}>
                        New Booking
                    </p>

                    {/* Heading — Sargood navy */}
                    <h1 style={{
                        margin: '0 0 8px',
                        fontSize: 'clamp(22px, 5vw, 28px)',
                        fontWeight: 800,
                        color: '#00467F',
                        lineHeight: 1.2,
                    }}>
                        How would you like to book?
                    </h1>

                    {/* Subtitle */}
                    <p style={{
                        margin: '0 0 28px',
                        fontSize: 14,
                        color: '#64748B',
                        lineHeight: 1.55,
                    }}>
                        Choose the option that best matches your needs. We&apos;ll take you to the right form.
                    </p>

                    {/* Radiogroup */}
                    <div
                        role="radiogroup"
                        aria-label="Booking type"
                        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                        onKeyDown={handleGroupKeyDown}
                    >
                        {PATHWAY_OPTIONS.map(option => (
                            <PathwayCard
                                key={option.value}
                                id={`card-${option.value}`}
                                title={option.title}
                                description={option.description}
                                Icon={option.Icon}
                                selected={selectedType === option.value}
                                onSelect={() => setSelectedType(option.value)}
                            />
                        ))}
                    </div>

                    {/* Continue */}
                    <div style={{ marginTop: 24 }}>
                        <button
                            onClick={handleContinue}
                            disabled={!selectedType}
                            aria-disabled={!selectedType}
                            style={{
                                width: '100%',
                                padding: '15px 0',
                                borderRadius: 6,
                                border: 'none',
                                backgroundColor: selectedType ? '#FFCE00' : '#E2E8F0',
                                color: selectedType ? '#00467F' : '#94A3B8',
                                fontWeight: 700,
                                fontSize: 13,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                cursor: selectedType ? 'pointer' : 'not-allowed',
                                transition: 'background-color 0.15s, color 0.15s',
                            }}
                        >
                            Continue
                        </button>
                    </div>

                    {/* My Bookings — always visible, not hidden off-screen */}
                    <div style={{ marginTop: 20, textAlign: 'center' }}>
                        <Link href="/bookings">
                            <a style={{
                                fontSize: 13,
                                color: '#64748B',
                                textDecoration: 'underline',
                                textUnderlineOffset: 2,
                            }}>
                                My Bookings
                            </a>
                        </Link>
                    </div>

                </div>
            </div>
        </Layout>
    );
}