import { Op } from "sequelize";
import { Booking, sequelize } from "../../../../models";

export default async function handler(request, response) {
    const data = JSON.parse(request.body);

    const transaction = await sequelize.transaction();
    try {
        const prevBooking = await Booking.findOne({
            where: {
                guest_id: data.guestId,
                deleted_at: null,
                [Op.not]: [{
                    [Op.and]: [
                        { status: { [Op.like]: '%guest_cancelled%' }, complete: { [Op.not]: true } }
                    ]
                }]
            }, order: [['created_at', 'DESC']]
        }, { transaction });
        if (prevBooking && !prevBooking.complete) {
            response.status(200).json({ hasIncomplete: true });
        } else {
            response.status(200).json({ hasIncomplete: false });
        }
    } catch (error) {
        let message = error.errors ? { error: error.errors.map(e => e.message)[0], type: error.errors.map(e => e.type)[0] } : { error: "Something went wrong", type: "error" };
        response.status(403).json(message);
        console.log(error);
        await transaction.rollback();
    }
}