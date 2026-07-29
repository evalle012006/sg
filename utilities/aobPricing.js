import moment from 'moment';

export const getAobPricing = (booking) => {
    if (!booking || booking.booking_type !== 'accommodation_only') {
        return { rooms: [], nights: 0, checkinDate: null, checkoutDate: null, indicativeTotalCents: 0 };
    }

    let checkinDateRaw = booking.preferred_arrival_date || null;
    let checkoutDateRaw = booking.preferred_departure_date || null;

    if ((!checkinDateRaw || !checkoutDateRaw) && booking.Sections) {
        for (const section of booking.Sections) {
            for (const qa of section.QaPairs || []) {
                const key = qa.Question?.question_key;
                if (!key || !qa.answer) continue;
                if (key === 'check-in-date') checkinDateRaw = qa.answer;
                if (key === 'check-out-date') checkoutDateRaw = qa.answer;
                if (key === 'check-in-date-and-check-out-date') {
                    const parts = qa.answer.split(' - ');
                    if (parts.length === 2) {
                        checkinDateRaw = parts[0].trim();
                        checkoutDateRaw = parts[1].trim();
                    }
                }
            }
        }
    }

    const ci = checkinDateRaw ? moment(checkinDateRaw, ['YYYY-MM-DD', 'DD/MM/YYYY', moment.ISO_8601]) : null;
    const co = checkoutDateRaw ? moment(checkoutDateRaw, ['YYYY-MM-DD', 'DD/MM/YYYY', moment.ISO_8601]) : null;

    const nights = (ci && co && ci.isValid() && co.isValid()) ? Math.max(0, co.diff(ci, 'days')) : 0;

    // Return AU-formatted display strings, not raw input — every caller
    // (list columns, detail panel) should get consistently formatted dates.
    const checkinDate = ci && ci.isValid() ? ci.format('DD/MM/YYYY') : null;
    const checkoutDate = co && co.isValid() ? co.format('DD/MM/YYYY') : null;

    const rooms = (booking.Rooms || []).map(room => ({
        name: room.label || room.RoomType?.name || 'Room',
        pricePerNight: room.RoomType?.price_per_night || 0,
        peakRate: room.RoomType?.peak_rate || 0,
    }));

    const totalPerNight = rooms.reduce((sum, r) => sum + r.pricePerNight, 0);
    const indicativeTotalCents = Math.round(totalPerNight * nights * 100);

    return { rooms, nights, checkinDate, checkoutDate, indicativeTotalCents };
};

export const formatAUD = (amountCents) => {
    if (amountCents == null) return '—';
    return `AUD ${(amountCents / 100).toLocaleString('en-AU', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
};