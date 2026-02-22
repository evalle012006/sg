import { Booking, BookingEquipment, Checklist, Equipment, Guest, NotificationLibrary, Setting, sequelize } from "../../../../models";
import moment from "moment";
import { NotificationService } from "../../../../services/notification/notification";
import { generateReferenceId } from "../../../../utilities/bookings";
import { Op } from "sequelize";
import { BOOKING_TYPES } from "../../../../components/constants";

export default async function handler(request, response) {
    const data = JSON.parse(request.body);
    const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_status' } });
    const eligibilityStatuses = await Setting.findAll({ where: { attribute: 'booking_eligibility' } });

    const transaction = await sequelize.transaction();
    let booking;
    let prevBooking;

    try {
        // SF-342: Succeeding Booking always gets answer from the First Booking
        prevBooking = await Booking.findOne({
            where: {
                guest_id: data.guestId,
                deleted_at: null,
                status_name: {
                    [Op.notLike]: '%cancelled%'
                },
                complete: 1
            }, include: [Guest], order: [['created_at', 'DESC']]
        }, { transaction });

        const eligibleStatus = eligibilityStatuses.find(status => JSON.parse(status.value).name === 'eligible');
        const pendingApprovalStatus = bookingStatuses.find(status => JSON.parse(status.value).name === 'pending_approval');
        // const newStatus = '{"name":"incomplete","label":"Incomplete","color":"transparent"}';

        const uniqueReferenceId = await generateReferenceId();

        if (prevBooking) {
            booking = await Booking.create({
                guest_id: data.guestId,
                type: BOOKING_TYPES.RETURNING_GUEST,
                reference_id: uniqueReferenceId,
                type_of_spinal_injury: prevBooking && prevBooking.type_of_spinal_injury,
                alternate_contact_name: prevBooking && prevBooking.alternate_contact_name,
                alternate_contact_number: prevBooking && prevBooking.alternate_contact_number,
                eligibility: eligibleStatus.value,
                status: pendingApprovalStatus.value,
                status_name: JSON.parse(pendingApprovalStatus.value).name,
                eligibility_name: JSON.parse(eligibleStatus.value).name
            }, { transaction });
        } else {
            booking = await Booking.create({
                guest_id: data.guestId,
                type: BOOKING_TYPES.FIRST_TIME_GUEST,
                reference_id: uniqueReferenceId,
                eligibility: eligibleStatus.value,
                status: pendingApprovalStatus.value,
                status_name: JSON.parse(pendingApprovalStatus.value).name,
                eligibility_name: JSON.parse(eligibleStatus.value).name
            }, { transaction });
        }

        // TODO - checklist template needs to be refactored
        const checklistTemplate = await Setting.findOne({ where: { attribute: 'default_checklist' }, raw: true }, { transaction });
        await Checklist.update({ booking_id: booking.id }, { where: { id: checklistTemplate.value } }, { transaction });

        // clone old booking_equipment
        if (prevBooking) {
            const oldBookingEquipment = await BookingEquipment.findAll({ where: { booking_id: prevBooking.id }, include: Equipment }, { transaction });
            if (oldBookingEquipment && booking) {
                const bookingEquipments = [];
                oldBookingEquipment.map(be => {
                    if (be.Equipment.type != 'acknowledgement') {
                        bookingEquipments.push({
                            booking_id: booking.id,
                            equipment_id: be.equipment_id,
                            created_at: new Date(),
                            updated_at: new Date()
                        });
                    }
                });

                if (bookingEquipments.length > 0) {
                    await BookingEquipment.bulkCreate(bookingEquipments, { transaction });
                }
            }
        }

        await transaction.commit();
        
    } catch (error) {
        // Only rollback if transaction hasn't been committed
        if (!transaction.finished) {
            await transaction.rollback();
        }
        
        let message = error.errors 
            ? { error: error.errors.map(e => e.message)[0], type: error.errors.map(e => e.type)[0] } 
            : { error: "Something went wrong", type: "error" };
        
        console.log('Transaction error:', error);
        return response.status(403).json(message);
    }

    // Post-commit operations (notifications, logging, etc.)
    // These should not cause the booking creation to fail
    try {
        const notificationLibs = await NotificationLibrary.findOne({ 
            where: { name: 'New Booking for Returning Guest', enabled: true } 
        });
        
        if (notificationLibs && prevBooking?.Guest) {
            const notificationService = new NotificationService();
            let message = notificationLibs.notification;
            message = message.replace('[guest_name]', `${prevBooking.Guest.first_name} ${prevBooking.Guest.last_name}`);

            const dispatch_date = moment().add(notificationLibs.date_factor, 'days').toDate();
            await notificationService.notificationHandler({
                notification_to: notificationLibs.notification_to,
                message: message,
                link: null,
                dispatch_date: dispatch_date
            });
        }
    } catch (notificationError) {
        // Log notification errors but don't fail the request
        console.error('Error sending notification:', notificationError);
        // Optionally report to error tracking service (Sentry, etc.)
    }

    console.log('============================================================');
    console.log({ 
        ...booking.dataValues, 
        prevBookingId: (prevBooking && prevBooking.complete) ? prevBooking.uuid : null 
    });
    
    return response.status(200).json({ 
        ...booking.dataValues, 
        prevBookingId: (prevBooking && prevBooking.complete) ? prevBooking.uuid : null 
    });
}