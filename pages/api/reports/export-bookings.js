import { processAnswer } from '../../../lib/report-utils';
import { Booking, Guest, QaPair, Section } from '../../../models';
import { Op } from 'sequelize';
import moment from 'moment';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const {
        startDate,
        endDate,
        dateField  = 'created_at',
        occupancy  = 'false',
    } = req.query;

    const ALLOWED_DATE_FIELDS = ['created_at', 'preferred_arrival_date', 'preferred_departure_date'];
    const resolvedDateField   = ALLOWED_DATE_FIELDS.includes(dateField) ? dateField : 'created_at';
    const includeOccupancy    = occupancy === 'true';

    try {
        let whereClause = {
            deleted_at: null,
            [Op.or]: [
                { complete: true },
                { type: 'Enquiry' },
            ]
        };

        // Mirror booking-reports date filter logic exactly
        if (startDate && endDate && startDate.trim() && endDate.trim()) {
            const start  = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day');
            const endDay = moment.utc(endDate,   'YYYY-MM-DD', true).endOf('day');

            if (start.isValid() && endDay.isValid()) {
                if (resolvedDateField === 'preferred_arrival_date') {
                    whereClause.preferred_arrival_date = { [Op.between]: [start.toDate(), endDay.toDate()] };
                } else if (resolvedDateField === 'preferred_departure_date') {
                    whereClause.preferred_departure_date = { [Op.between]: [start.toDate(), endDay.toDate()] };
                } else {
                    whereClause.createdAt = { [Op.between]: [start.toDate(), endDay.toDate()] };
                }
            }
        }

        // Performance: only select columns we actually use; exclude heavy blobs
        const bookings = await Booking.findAll({
            where: whereClause,
            attributes: [
                'id', 'reference_id', 'type', 'status', 'eligibility',
                'createdAt', 'preferred_arrival_date', 'preferred_departure_date'
            ],
            include: [
                {
                    model: Guest,
                    attributes: ['first_name', 'last_name', 'email', 'phone_number'],
                },
                {
                    model: Section,
                    attributes: ['id', 'order'],
                    include: [{
                        model: QaPair,
                        attributes: ['id', 'question', 'answer', 'question_type'],
                    }],
                    separate: true,   // avoids cartesian explosion on JOIN
                    order: [['order', 'ASC']],
                },
            ],
            order: [['createdAt', 'DESC']],
        });

        const processedBookings = bookings.map(booking => {
            const b = booking.get({ plain: true });

            const baseData = {
                BOOKING:          b.reference_id || '',
                GUEST:            b.Guest ? `${b.Guest.first_name || ''} ${b.Guest.last_name || ''}`.trim() : '',
                GUEST_EMAIL:      b.Guest?.email || '',
                GUEST_PHONE:      b.Guest?.phone_number || '',
                BOOKING_TYPE:     b.type || '',
                CREATED:          b.createdAt                ? moment(b.createdAt).format('DD-MM-YYYY')                   : '',
                STATUS:           processAnswer(b.status),
                ELIGIBILITY:      processAnswer(b.eligibility),
                // Keys match BASE_COLUMN_TYPES in reports-index.js
                CHECK_IN_DATE:    b.preferred_arrival_date   ? moment(b.preferred_arrival_date).format('DD-MM-YYYY')   : '',
                CHECK_OUT_DATE:   b.preferred_departure_date ? moment(b.preferred_departure_date).format('DD-MM-YYYY') : '',
            };

            // Occupancy columns — only when flag is set
            if (includeOccupancy) {
                baseData.DATES_OF_STAY    = b.DATES_OF_STAY    || '';
                baseData.FUNDER           = b.FUNDER           || '';
                baseData.NIGHTS_IN_PERIOD = b.NIGHTS_IN_PERIOD ?? 0;
            }

            if (b.Sections) {
                [...b.Sections]
                    .sort((a, b) => (a.order || 0) - (b.order || 0))
                    .forEach(section => {
                        if (!section.QaPairs) return;
                        [...section.QaPairs]
                            .sort((a, b) => (a.id || 0) - (b.id || 0))
                            .forEach(qa => {
                                if (qa?.question) {
                                    baseData[qa.question] = processAnswer(qa.answer, qa.question_type);
                                }
                            });
                    });
            }

            return baseData;
        });

        return res.status(200).json({ success: true, data: processedBookings });

    } catch (error) {
        console.error('Export error:', error);
        return res.status(500).json({
            success: false,
            message: 'Error generating export',
            error: error.message,
        });
    }
}