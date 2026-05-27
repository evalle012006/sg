import { Booking, Guest, QaPair, Question, Room, Section } from '../../../models';
import { Op } from 'sequelize';
import moment from 'moment';

const FUNDING_SOURCE_KEY = 'how-will-your-stay-be-funded';

/**
 * Formats a raw funder answer into a clean display label.
 * e.g. "ndis" → "NDIS", "icare" → "iCare", "royal-rehab-grant" → "Royal Rehab Grant"
 */
const formatFunder = (raw) => {
    if (!raw) return '—';
    const lower = raw.toLowerCase().trim();
    if (lower === 'icare') return 'iCare';
    if (lower.includes('ndis') || lower.includes('ndia')) {
        if (lower.includes('self')) return 'NDIS Self-Managed';
        if (lower.includes('plan')) return 'NDIS Plan Managed';
        if (lower.includes('portal') || lower.includes('ndia')) return 'NDIA Managed';
        return 'NDIS';
    }
    if (lower.includes('royal-rehab') || lower.includes('royal rehab')) return 'Royal Rehab Grant';
    if (lower.includes('promotional')) return 'Promotional Stay';
    if (lower.includes('private') || lower.includes('self-fund')) return 'Privately Self-Funded';
    if (lower.includes('other')) return 'Other';
    // Title-case fallback
    return raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    try {
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'startDate and endDate are required for the occupancy report' });
        }

        // Parse as UTC date-only strings (YYYY-MM-DD) to avoid timezone shifting.
        // moment.utc() treats the value as UTC midnight, so a local date picked in any
        // timezone arrives as the same calendar date on the server.
        const rangeStart = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day');
        const rangeEnd   = moment.utc(endDate,   'YYYY-MM-DD', true).endOf('day');

        if (!rangeStart.isValid() || !rangeEnd.isValid()) {
            return res.status(400).json({ message: 'Invalid date format. Expected YYYY-MM-DD.' });
        }

        // A booking overlaps the range if:
        //   arrival < rangeEnd  AND  departure > rangeStart
        // This captures full-overlap, partial-start, and partial-end stays.
        const whereClause = {
            deleted_at: null,
            complete: true,                         // Only confirmed bookings for occupancy
            preferred_arrival_date: { [Op.lt]: rangeEnd.toDate() },
            preferred_departure_date: { [Op.gt]: rangeStart.toDate() },
        };

        const bookings = await Booking.findAll({
            where: whereClause,
            include: [
                {
                    model: Section,
                    include: [
                        {
                            model: QaPair,
                            include: [
                                {
                                    model: Question,
                                    attributes: ['id', 'question_key'],
                                },
                            ],
                        },
                    ],
                    separate: true,
                    order: [['order', 'ASC']],
                },
                {
                    model: Guest,
                    attributes: ['first_name', 'last_name'],
                },
                Room,
            ],
            order: [['preferred_arrival_date', 'ASC']],
        });

        // Sanity bound: reject bookings whose departure date is clearly corrupt (> 20 years out)
        const MAX_REASONABLE_DATE = moment().add(20, 'years');

        const processed = bookings.flatMap(booking => {
            const arrival   = moment(booking.preferred_arrival_date);
            const departure = moment(booking.preferred_departure_date);

            // Skip bookings with invalid or corrupt date values
            if (!arrival.isValid() || !departure.isValid())  return [];
            if (departure.isAfter(MAX_REASONABLE_DATE))      return [];
            if (departure.isSameOrBefore(arrival))           return [];

            // Clip to the filter window
            const clippedStart = moment.max(arrival,   rangeStart);
            const clippedEnd   = moment.min(departure, rangeEnd);

            // Nights = diff in days. departure.diff(arrival) counts day boundaries crossed,
            // which naturally excludes the checkout date.
            // e.g. Feb 25 → Feb 28 = 3 nights (Feb 25, 26, 27) ✓
            const nightsInPeriod = Math.max(0, clippedEnd.diff(clippedStart, 'days'));

            // Exclude bookings that produce 0 nights in the period after clipping.
            // This happens when arrival == rangeEnd or departure == rangeStart (boundary edge cases).
            if (nightsInPeriod === 0) return [];

            // Extract funder from QaPairs
            let funder = '—';
            for (const section of booking.Sections || []) {
                for (const qa of section.QaPairs || []) {
                    const key = qa.Question?.question_key || qa.question_key || '';
                    if (key === FUNDING_SOURCE_KEY && qa.answer) {
                        funder = formatFunder(qa.answer);
                        break;
                    }
                }
                if (funder !== '—') break;
            }

            const guestName = booking.Guest
                ? `${booking.Guest.first_name || ''} ${booking.Guest.last_name || ''}`.trim()
                : '—';

            // Show clipped dates (within the filter window), not the full booking dates.
            // e.g. a Dec 2024 – Dec 2025 booking filtered to May shows "01 May 2025 – 31 May 2025"
            const displayStart = clippedStart.format('DD MMM YYYY');
            const displayEnd   = clippedEnd.format('DD MMM YYYY');

            return {
                BOOKING:          booking.reference_id || String(booking.id),
                GUEST:            guestName,
                DATES_OF_STAY:    `${displayStart} – ${displayEnd}`,
                FUNDER:           funder,
                BOOKING_TYPE:     booking.type || '—',
                NIGHTS_IN_PERIOD: nightsInPeriod,
            };
        });

        return res.status(200).json({
            bookings: processed,
            totalCount: processed.length,
            periodStart: rangeStart.format('YYYY-MM-DD'),
            periodEnd:   rangeEnd.format('YYYY-MM-DD'),
        });

    } catch (error) {
        console.error('Error fetching occupancy report:', error);
        return res.status(500).json({
            message: 'Error fetching occupancy report',
            error: error.message,
        });
    }
}