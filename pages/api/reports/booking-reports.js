import moment from 'moment';
import { Booking, Guest, QaPair, Question, Room, Section } from './../../../models';
import { Op } from 'sequelize';

const FUNDING_SOURCE_KEY = 'how-will-your-stay-be-funded';

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
    if (lower.includes('sargood')) return 'Sargood Foundation';
    if (lower.includes('other')) return 'Other';
    return raw.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * DATE FIELD OPTIONS (dateField query param):
 *   created_at               — filters on booking submission date (default)
 *   preferred_arrival_date   — filters on check-in date
 *   preferred_departure_date — filters on check-out date
 *
 * OCCUPANCY FLAG (occupancy=true):
 *   When set, also returns DATES_OF_STAY, FUNDER, and NIGHTS_IN_PERIOD columns.
 *   For arrival/departure date filters, nights are clipped to the filter window.
 *   For created_at filter, nights = full booking length.
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const queryStart = Date.now();

    try {
        const {
            startDate,
            endDate,
            dateField  = 'created_at',   // 'created_at' | 'preferred_arrival_date' | 'preferred_departure_date'
            occupancy  = 'false',
        } = req.query;

        const includeOccupancy = occupancy === 'true';

        // Validate dateField to prevent injection
        const ALLOWED_DATE_FIELDS = ['created_at', 'preferred_arrival_date', 'preferred_departure_date'];
        const resolvedDateField = ALLOWED_DATE_FIELDS.includes(dateField) ? dateField : 'created_at';

        let whereClause = {
            deleted_at: null,
            [Op.or]: [
                { complete: true },
                { type: 'Enquiry' },
            ],
        };

        let rangeStart = null;
        let rangeEnd   = null;

        if (startDate && endDate && startDate.trim() && endDate.trim()) {
            rangeStart = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day');
            rangeEnd   = moment.utc(endDate,   'YYYY-MM-DD', true).endOf('day');

            if (rangeStart.isValid() && rangeEnd.isValid()) {
                if (resolvedDateField === 'created_at') {
                    whereClause.createdAt = { [Op.between]: [rangeStart.toDate(), rangeEnd.toDate()] };
                } else if (resolvedDateField === 'preferred_arrival_date') {
                    // For check-in filter: arrival falls within range
                    whereClause.preferred_arrival_date = { [Op.between]: [rangeStart.toDate(), rangeEnd.toDate()] };
                } else if (resolvedDateField === 'preferred_departure_date') {
                    // For check-out filter: departure falls within range
                    whereClause.preferred_departure_date = { [Op.between]: [rangeStart.toDate(), rangeEnd.toDate()] };
                }
            }
        }

        // COUNT — fast, separate from data fetch
        const totalCount = await Booking.count({ where: whereClause });

        const include = [
            {
                model: Guest,
                attributes: ['id', 'first_name', 'last_name'],
            },
            {
                model: Room,
                attributes: ['id', 'label'],
                required: false,
            },
        ];

        // Only load Sections+QaPairs when occupancy columns are requested.
        // Targeted: only the funding source question, not all QA data.
        if (includeOccupancy) {
            include.push({
                model: Section,
                attributes: ['id', 'model_id', 'order'],
                include: [{
                    model: QaPair,
                    attributes: ['id', 'answer', 'section_id'],
                    include: [{
                        model: Question,
                        attributes: ['id', 'question_key'],
                        where: { question_key: FUNDING_SOURCE_KEY },
                        required: false,
                    }],
                    required: false,
                }],
                separate: true,
                order: [['order', 'ASC']],
            });
        }

        const bookings = await Booking.findAll({
            where: whereClause,
            attributes: [
                'id', 'reference_id', 'type', 'status', 'eligibility',
                'createdAt', 'preferred_arrival_date', 'preferred_departure_date',
            ],
            include,
            order: [['createdAt', 'DESC']],
        });

        // Build response rows
        const processed = bookings.map(booking => {
            const b = booking.get ? booking.get({ plain: true }) : booking;

            const row = {
                id:           b.id,
                reference_id: b.reference_id,
                type:         b.type,
                status:       b.status,
                eligibility:  b.eligibility,
                createdAt:    b.createdAt,
                preferred_arrival_date:   b.preferred_arrival_date,
                preferred_departure_date: b.preferred_departure_date,
                Guest: b.Guest,
                Rooms: b.Rooms,
            };

            if (includeOccupancy) {
                const arrival   = moment(b.preferred_arrival_date);
                const departure = moment(b.preferred_departure_date);
                const MAX_SANE  = moment().add(20, 'years');

                if (
                    arrival.isValid() &&
                    departure.isValid() &&
                    departure.isBefore(MAX_SANE) &&
                    departure.isAfter(arrival)
                ) {
                    // Clip nights to the filter window when filtering by stay dates
                    let nightsInPeriod;
                    let displayStart = arrival;
                    let displayEnd   = departure;

                    if (rangeStart && rangeEnd && resolvedDateField !== 'created_at') {
                        displayStart   = moment.max(arrival,   rangeStart);
                        displayEnd     = moment.min(departure, rangeEnd);
                        nightsInPeriod = Math.max(0, displayEnd.diff(displayStart, 'days'));
                    } else {
                        nightsInPeriod = Math.max(0, departure.diff(arrival, 'days'));
                    }

                    // Extract funder from QaPairs
                    let funder = '—';
                    for (const section of b.Sections || []) {
                        for (const qa of section.QaPairs || []) {
                            if (qa.Question?.question_key === FUNDING_SOURCE_KEY && qa.answer) {
                                funder = formatFunder(qa.answer);
                                break;
                            }
                        }
                        if (funder !== '—') break;
                    }

                    row.DATES_OF_STAY    = `${displayStart.format('DD MMM YYYY')} – ${displayEnd.format('DD MMM YYYY')}`;
                    row.FUNDER           = funder;
                    row.NIGHTS_IN_PERIOD = nightsInPeriod;
                } else {
                    row.DATES_OF_STAY    = '—';
                    row.FUNDER           = '—';
                    row.NIGHTS_IN_PERIOD = 0;
                }
            }

            return row;
        });

        console.log(`[booking-reports] ${processed.length} rows, occupancy=${includeOccupancy}, dateField=${resolvedDateField} in ${Date.now() - queryStart}ms`);

        return res.status(200).json({ bookings: processed, totalCount });

    } catch (error) {
        console.error('Error fetching bookings:', error);
        return res.status(500).json({ message: 'Error fetching bookings', error: error.message });
    }
}