// hooks/useFlagDefinitions.js
import { useState, useEffect, useMemo } from 'react';

/**
 * Fetches flag metadata (label/acronym/color) once per mount and exposes
 * fast O(1) lookups by slug value, for both guest and booking flags.
 *
 * Used by any component that renders flag badges (booking list, guest
 * profile) so none of them re-fetch per row/render — this matches the
 * existing fetch-on-mount pattern already used in AdminGuestProfile.js
 * for settingsFlagsList.
 *
 * Falls back to a gray default with the raw value as acronym/label if a
 * flag slug exists in data (Guest.flags / Booking.label) but has no
 * matching row in the flags table — e.g. legacy data, or a flag deleted
 * from Manage Flags after being applied to records. This avoids a render
 * crash; it does not silently fix the data — the badge will visibly look
 * like "unconfigured" (default gray) so it's noticeable.
 */
const DEFAULT_FLAG_META = (value) => ({
  value,
  label: value,
  acronym: value.slice(0, 3).toUpperCase(),
  color: '#6B7280',
});

export default function useFlagDefinitions() {
  const [guestFlags, setGuestFlags] = useState([]);
  const [bookingFlags, setBookingFlags] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch('/api/settings/flags');
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setGuestFlags(data.guest_flags || []);
        setBookingFlags(data.booking_flags || []);
      } catch (error) {
        console.error('Error loading flag definitions:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => { cancelled = true; };
  }, []);

  const guestFlagMap = useMemo(() => {
    const map = new Map();
    guestFlags.forEach(f => map.set(f.value, f));
    return map;
  }, [guestFlags]);

  const bookingFlagMap = useMemo(() => {
    const map = new Map();
    bookingFlags.forEach(f => map.set(f.value, f));
    return map;
  }, [bookingFlags]);

  const getGuestFlag = (value) => guestFlagMap.get(value) || DEFAULT_FLAG_META(value);
  const getBookingFlag = (value) => bookingFlagMap.get(value) || DEFAULT_FLAG_META(value);

  return {
    guestFlags,
    bookingFlags,
    getGuestFlag,
    getBookingFlag,
    isLoading,
  };
}