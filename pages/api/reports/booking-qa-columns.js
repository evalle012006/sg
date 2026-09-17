import moment from 'moment';
import { Booking, QaPair, Section, Question } from '../../../models';
import { Op } from 'sequelize';
import { buildPackageAndCourseLookups, resolveQaAnswer } from '../../../lib/server/report-qa-resolver';

/**
 * booking-qa-columns.js
 *
 * Secondary endpoint — fetches QaPair answers for all bookings matching
 * the current filter. Called only when the user adds dynamic QA columns
 * via the ColumnSelector. Kept separate from booking-reports so the
 * initial page load stays fast.
 *
 * Resolves "reference id" style answers (package-selection, course card-selection,
 * service-cards) into their display values server-side, since the frontend has no
 * access to the Package/Course tables or the originating Question's option labels.
 *
 * Returns: { qaByBookingId, availableColumns }
 *   qaByBookingId: { [bookingId]: { [questionText]: { answer, question_type } } }
 *   availableColumns: [ { key, label, sectionOrder, questionId, questionType } ]
 */
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
    }

    const start = Date.now();

    try {
        const { startDate, endDate, dateField = 'created_at' } = req.query;

        const ALLOWED_DATE_FIELDS = ['created_at', 'preferred_arrival_date', 'preferred_departure_date'];
        const resolvedDateField = ALLOWED_DATE_FIELDS.includes(dateField) ? dateField : 'created_at';

        // Mirror the same where clause as booking-reports so QA columns match visible rows
        let bookingWhere = {
            deleted_at: null,
            [Op.or]: [
                { complete: true },
                { type: 'Enquiry' },
            ],
        };

        if (startDate && endDate && startDate.trim() && endDate.trim()) {
            const sd = moment.utc(startDate, 'YYYY-MM-DD', true).startOf('day');
            const ed = moment.utc(endDate,   'YYYY-MM-DD', true).endOf('day');
            if (sd.isValid() && ed.isValid()) {
                if (resolvedDateField === 'preferred_arrival_date') {
                    bookingWhere.preferred_arrival_date = { [Op.between]: [sd.toDate(), ed.toDate()] };
                } else if (resolvedDateField === 'preferred_departure_date') {
                    bookingWhere.preferred_departure_date = { [Op.between]: [sd.toDate(), ed.toDate()] };
                } else {
                    bookingWhere.createdAt = { [Op.between]: [sd.toDate(), ed.toDate()] };
                }
            }
        }

        // Fetch only id to get matching booking IDs — no other columns needed
        const matchingBookings = await Booking.findAll({
            where: bookingWhere,
            attributes: ['id'],
            raw: true,
        });

        const bookingIds = matchingBookings.map(b => b.id);

        if (!bookingIds.length) {
            return res.status(200).json({ qaByBookingId: {}, availableColumns: [] });
        }

        // Fetch all QaPairs for these bookings, joined to Question for option_type
        // (course selection) and options (service-cards labels).
        const sections = await Section.findAll({
            where: {
                model_id: { [Op.in]: bookingIds },
                model_type: 'booking',
            },
            attributes: ['id', 'model_id', 'order'],
            include: [{
                model: QaPair,
                attributes: ['id', 'question', 'answer', 'question_type', 'section_id'],
                include: [{
                    model: Question,
                    attributes: ['id', 'option_type', 'options'],
                    required: false,
                }],
            }],
            order: [['order', 'ASC']],
        });

        // First pass: batch-resolve every package/course id referenced across all bookings
        const allQaPairs = sections.flatMap(section => section.QaPairs || []);
        const lookups = await buildPackageAndCourseLookups(allQaPairs);

        // Build: qaByBookingId[bookingId][questionText] = { answer, question_type }
        const qaByBookingId = {};
        // Track all unique questions for availableColumns
        const columnMap = new Map(); // questionText -> { key, label, sectionOrder, questionId, questionType }

        let colIndex = 0;
        sections.forEach(section => {
            const bookingId = section.model_id;
            if (!qaByBookingId[bookingId]) qaByBookingId[bookingId] = {};

            (section.QaPairs || []).forEach(qa => {
                if (!qa.question) return;

                const { answer: resolvedAnswer, question_type: resolvedType } = resolveQaAnswer(qa, lookups);

                // Store both answer and question_type so processAnswer can format correctly
                qaByBookingId[bookingId][qa.question] = {
                    answer:        resolvedAnswer,
                    question_type: resolvedType,
                };

                if (!columnMap.has(qa.question)) {
                    columnMap.set(qa.question, {
                        key:          `q_${colIndex++}`,
                        label:        qa.question,
                        sectionOrder: section.order,
                        questionId:   qa.id,
                        questionType: resolvedType,
                    });
                }
            });
        });

        // Sort columns by section order then question id
        const availableColumns = Array.from(columnMap.values()).sort((a, b) =>
            a.sectionOrder !== b.sectionOrder
                ? a.sectionOrder - b.sectionOrder
                : a.questionId - b.questionId
        );

        console.log(`[booking-qa-columns] ${bookingIds.length} bookings, ${availableColumns.length} columns in ${Date.now() - start}ms`);

        return res.status(200).json({ qaByBookingId, availableColumns });

    } catch (error) {
        console.error('Error fetching QA columns:', error);
        return res.status(500).json({ message: 'Error fetching QA columns', error: error.message });
    }
}