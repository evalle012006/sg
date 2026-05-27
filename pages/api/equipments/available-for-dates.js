// pages/api/equipments/available-for-dates.js
//
// Guest-facing endpoint: returns all active, non-hidden equipment
// with an `available` boolean flag for the requested date range.
//
// No session required -- called during the guest booking form flow
// where there is no authenticated session.
//
// Query params:
//   startDate  YYYY-MM-DD  (required)
//   endDate    YYYY-MM-DD  (required)
//
// Overlap logic (Option A -- block on all active bookings except cancellations):
//   An equipment item is unavailable when a booking_equipment row exists where:
//     1. start_date < endDate  AND  end_date > startDate  (date overlap)
//     2. The parent booking's status_name is NOT 'guest_cancelled'
//        or 'booking_cancelled'
//
//   status_name is a plain string column on the bookings table -- no JSON
//   parsing required, no LIKE hacks needed.
//
//   Same-day turnover: a checkout on Day X does NOT conflict with a check-in
//   on Day X because end_date == startDate fails the end_date > startDate test.
//
// Why literal() subquery instead of a Sequelize include join:
//   models/index.js defines both BookingEquipment.belongsTo(Booking) AND
//   BookingEquipment.hasOne(Booking, { sourceKey: 'booking_id', foreignKey: 'id' })
//   -- conflicting associations that make a Sequelize JOIN unreliable here.
//   The literal() subquery bypasses the association layer entirely.

import { Op, literal } from 'sequelize';
import { Equipment, EquipmentCategory, BookingEquipment } from '../../../models';
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Method not allowed' });
    }

    const { startDate, endDate } = req.query;

    // -- Validate required params ---------------------------------------------
    if (!startDate || !endDate) {
        return res.status(400).json({
            message: 'startDate and endDate query parameters are required (YYYY-MM-DD).'
        });
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate) || !dateRegex.test(endDate)) {
        return res.status(400).json({
            message: 'startDate and endDate must be in YYYY-MM-DD format.'
        });
    }

    if (startDate >= endDate) {
        return res.status(400).json({
            message: 'endDate must be after startDate.'
        });
    }

    try {
        const storage = new StorageService({ bucketType: 'restricted' });

        // -- 1. All equipment_ids booked in the date range (active bookings only)
        //
        // Option A: exclude only explicitly cancelled bookings.
        // Everything else (pending_approval, in_progress, on_hold, confirmed,
        // booking_amended) is treated as an active hold on the equipment.

        const bookedEquipmentRows = await BookingEquipment.findAll({
            attributes: ['equipment_id'],
            where: {
                start_date: { [Op.lt]: endDate },
                end_date:   { [Op.gt]: startDate },
                // Exclude rows whose parent booking has been cancelled.
                // status_name is a plain string column -- no JSON parsing needed.
                booking_id: {
                    [Op.in]: literal(`(
                        SELECT id FROM bookings
                        WHERE status_name NOT IN ('guest_cancelled', 'booking_cancelled')
                    )`)
                }
            },
            raw: true
        });

        // Build a Set for O(1) lookup
        const bookedEquipmentIds = new Set(
            bookedEquipmentRows.map(row => row.equipment_id)
        );

        // -- 2. Fetch all active, non-hidden equipment -------------------------
        const equipmentList = await Equipment.findAll({
            where: { hidden: false },
            include: [
                {
                    model: EquipmentCategory,
                    attributes: ['id', 'name']
                }
            ],
            order: [['created_at', 'DESC']],
            raw: false
        });

        // -- 3. Build response: merge availability flag + signed image URL -----
        const results = await Promise.all(
            equipmentList.map(async (equipment) => {
                const data = equipment.toJSON();

                // Signed image URL -- same pattern as /api/equipments/index.js
                if (data.image_filename && !data.image_filename.includes('default-')) {
                    try {
                        data.image_url = await storage.getSignedUrl(
                            'equipment-photo/' + data.image_filename
                        );
                    } catch {
                        // Non-fatal: image URL generation failure should not
                        // block the availability response.
                        data.image_url = null;
                    }
                }

                return {
                    ...data,
                    // Normalise category_name to match existing frontend expectations
                    category_name: data.EquipmentCategory?.name
                        ? data.EquipmentCategory.name
                              .replace(/_/g, ' ')
                              .replace(/\b\w/g, l => l.toUpperCase())
                        : '',
                    // The field the frontend will read
                    available: !bookedEquipmentIds.has(data.id)
                };
            })
        );

        return res.status(200).json(results);

    } catch (error) {
        console.error('[available-for-dates] Error:', error);
        return res.status(500).json({
            message: 'Internal server error',
            error: error.message
        });
    }
}