import { Booking, Equipment, BookingEquipment, EquipmentCategory, Setting, Log } from "../../../../models";
import { BookingService } from "../../../../services/booking/booking";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { category, equipments, isDirty } = req.body;
    const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_status' } });

    const booking = await Booking.findOne({ where: { uuid }, include: [{ model: Equipment, plain: true, include: [EquipmentCategory] }] });
    let isEquipmentsAmended = false;

    const manageBookingEquipment = async (booking, category, equipments) => {
        // fetch all mattress_options for the given booking
        const existingEquipments = booking.Equipment.map((equipment) => {
            if (equipment.dataValues.EquipmentCategory.name == category) {
                return equipment.dataValues;
            }
        });

        for (let i = 0; i < equipments.length; i++) {
            const equipment = equipments[i];

            const currentEquipment = existingEquipments.find((existingEquipment) => existingEquipment && existingEquipment.category_id == equipment.category_id);
            if (currentEquipment && currentEquipment.type == 'independent') {
                // update the existing equipment
                if (equipment.value) {

                    if (isDirty && booking.complete) {

                        await Log.create({
                            loggable_id: booking.id,
                            loggable_type: 'booking',
                            type: 'qa_pair',
                            data: {
                                approved: false,
                                approved_by: null,
                                approval_date: null,
                                qa_pair: {
                                    question: 'Equipment Changed',
                                    answer: equipment.name,
                                    question_type: 'qa_pair',
                                    oldAnswer: currentEquipment.name,
                                }
                            }
                        });
                    }
                    isEquipmentsAmended = true;
                    return await BookingEquipment.update({
                        equipment_id
                            : equipment.id
                    }, { where: { booking_id: booking.id, equipment_id: currentEquipment.id } });
                } else {

                    if (isDirty && booking.complete) {
                        await Log.create({
                            loggable_id: booking.id,
                            loggable_type: 'booking',
                            type: 'qa_pair',
                            data: {
                                approved: false,
                                approved_by: null,
                                approval_date: null,
                                qa_pair: {
                                    question: 'Equipment Removed',
                                    answer: '',
                                    question_type: 'qa_pair',
                                    oldAnswer: currentEquipment.name,
                                }
                            }
                        });
                    }
                    // remove the equipment
                    isEquipmentsAmended = true;
                    return await BookingEquipment.destroy({ where: { booking_id: booking.id, equipment_id: currentEquipment.id } });
                }
            }

            if (!currentEquipment && equipment.type == 'independent' && equipment.value) {

                if (isDirty && booking.complete) {
                    await Log.create({
                        loggable_id: booking.id,
                        loggable_type: 'booking',
                        type: 'qa_pair',
                        data: {
                            approved: false,
                            approved_by: null,
                            approval_date: null,
                            qa_pair: {
                                question: 'Equipment Added',
                                answer: equipment.name,
                                question_type: 'qa_pair',
                                oldAnswer: '',
                            }
                        }
                    });
                }
                // add the new equipment
                isEquipmentsAmended = true;
                return await BookingEquipment.create({ booking_id: booking.id, equipment_id: equipment.id });
            }

            if (equipment.type == 'group') {
                const equipmentExists = existingEquipments.find((existingEquipment) => existingEquipment && existingEquipment.id == equipment.id);
                if (equipmentExists && equipment.value == false) {

                    if (isDirty && booking.complete) {
                        await Log.create({
                            loggable_id: booking.id,
                            loggable_type: 'booking',
                            type: 'qa_pair',
                            data: {
                                approved: false,
                                approved_by: null,
                                approval_date: null,
                                qa_pair: {
                                    question: 'Equipment Removed',
                                    answer: '',
                                    question_type: 'qa_pair',
                                    oldAnswer: equipmentExists.name,
                                }
                            }
                        });
                    }
                    // remove the equipment
                    await BookingEquipment.destroy({ where: { booking_id: booking.id, equipment_id: equipmentExists.id } });
                    isEquipmentsAmended = true;
                } else {
                    // add the equipment
                    if (!equipmentExists && equipment.value == true) {
                        if (isDirty && booking.complete) {
                            await Log.create({
                                loggable_id: booking.id,
                                loggable_type: 'booking',
                                type: 'qa_pair',
                                data: {
                                    approved: false,
                                    approved_by: null,
                                    approval_date: null,
                                    qa_pair: {
                                        question: 'Equipment Added',
                                        answer: equipment.name,
                                        question_type: 'qa_pair',
                                        oldAnswer: '',
                                    }
                                }
                            });
                        }
                        await BookingEquipment.create({ booking_id: booking.id, equipment_id: equipment.id });
                        isEquipmentsAmended = true;
                    }
                }
            }

        }
    }

    await manageBookingEquipment(booking, category, equipments);

    const bookingService = new BookingService();
    const isBookingComplete = await bookingService.isBookingComplete(booking.uuid);

    if (isBookingComplete && isEquipmentsAmended && booking.status.includes('booking_confirmed')) {
        const bookingAmendedStatus = await bookingStatuses.find(status => JSON.parse(status.value).name == 'booking_amended');
        await Booking.update({ status: bookingAmendedStatus.value, status_name: bookingAmendedStatus.name }, { where: { id: booking.id } });
    }
    return res.status(200).end();
}