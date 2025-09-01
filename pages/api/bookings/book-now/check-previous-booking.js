import { Op } from "sequelize";
import { Booking, Room, sequelize } from "../../../../models";

export default async function handler(request, response) {
    const data = JSON.parse(request.body);

    const transaction = await sequelize.transaction();
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Set to start of day for accurate comparison

        const prevBooking = await Booking.findOne({
            where: {
                guest_id: data.guestId,
                deleted_at: null,
                [Op.not]: [{
                    [Op.and]: [
                        { status: { [Op.like]: '%guest_cancelled%' }, complete: { [Op.not]: true } }
                    ]
                }]
            },
            include: [
                {
                    model: Room,
                    required: false
                }
            ],
            order: [['created_at', 'DESC']]
        }, { transaction });

        if (prevBooking && !prevBooking.complete) {
            // Determine if this incomplete booking should be excluded due to past dates
            let shouldExclude = false;

            // Get the most relevant checkin and checkout dates
            let checkinDate = null;
            let checkoutDate = null;

            // First, try to get dates from associated rooms (most specific)
            if (prevBooking.Rooms && prevBooking.Rooms.length > 0) {
                const room = prevBooking.Rooms[0]; // Get first room's dates
                checkinDate = room.checkin;
                checkoutDate = room.checkout;
            }

            // Fallback to booking-level dates if no room dates
            if (!checkinDate && !checkoutDate) {
                checkinDate = prevBooking.preferred_arrival_date;
                checkoutDate = prevBooking.preferred_departure_date;
            }

            // Exclude incomplete bookings where BOTH checkin AND checkout dates exist AND both are in the past
            // This aligns with the QUESTION_KEYS.CHECK_IN_DATE and QUESTION_KEYS.CHECK_OUT_DATE requirement
            if (checkinDate && checkoutDate) {
                const checkinInPast = new Date(checkinDate) < today;
                const checkoutInPast = new Date(checkoutDate) < today;
                
                if (checkinInPast && checkoutInPast) {
                    shouldExclude = true;
                }
            }

            if (shouldExclude) {
                response.status(200).json({ hasIncomplete: false });
            } else {
                response.status(200).json({ hasIncomplete: true });
            }
        } else {
            response.status(200).json({ hasIncomplete: false });
        }

        await transaction.commit();
    } catch (error) {
        let message = error.errors ? { error: error.errors.map(e => e.message)[0], type: error.errors.map(e => e.type)[0] } : { error: "Something went wrong", type: "error" };
        response.status(403).json(message);
        console.log(error);
        await transaction.rollback();
    }
}