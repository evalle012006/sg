import { Booking, Equipment, BookingEquipment, EquipmentCategory, Setting, Log } from "../../../../models";
import { BookingService } from "../../../../services/booking/booking";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { category, equipments, isDirty } = req.body;
    const bookingStatuses = await Setting.findAll({ where: { attribute: 'booking_status' } });

    const booking = await Booking.findOne({ where: { uuid }, include: [{ model: Equipment, plain: true, include: [EquipmentCategory] }] });
    let isEquipmentsAmended = false;

    const manageBookingEquipment = async (booking, category, equipments) => {
        // NEW: Handle infant_care category specially
        if (category === 'infant_care') {
            return await manageInfantCareEquipment(booking, equipments);
        }

        // fetch all equipment for the given booking and category
        const existingEquipments = booking.Equipment.map((equipment) => {
            if (equipment.dataValues.EquipmentCategory.name == category) {
                return equipment.dataValues;
            }
        });

        for (let i = 0; i < equipments.length; i++) {
            const equipment = equipments[i];

            const currentEquipment = existingEquipments.find((existingEquipment) => 
                existingEquipment && existingEquipment.category_id == equipment.category_id
            );
            
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
                    
                    // ✅ UPDATED: Include meta_data when updating
                    const updateData = { equipment_id: equipment.id };
                    if (equipment.meta_data) {
                        updateData.meta_data = equipment.meta_data;
                    }
                    
                    return await BookingEquipment.update(updateData, { 
                        where: { booking_id: booking.id, equipment_id: currentEquipment.id } 
                    });
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
                    return await BookingEquipment.destroy({ 
                        where: { booking_id: booking.id, equipment_id: currentEquipment.id } 
                    });
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
                
                // ✅ UPDATED: Include meta_data when creating new equipment
                const createData = { 
                    booking_id: booking.id, 
                    equipment_id: equipment.id 
                };
                if (equipment.meta_data) {
                    createData.meta_data = equipment.meta_data;
                }
                
                // add the new equipment
                isEquipmentsAmended = true;
                return await BookingEquipment.create(createData);
            }

            if (equipment.type == 'group') {
                const equipmentExists = existingEquipments.find((existingEquipment) => 
                    existingEquipment && existingEquipment.id == equipment.id
                );

                if (equipmentExists && !equipment.value) {
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
                                    oldAnswer: equipment.name,
                                }
                            }
                        });
                    }

                    isEquipmentsAmended = true;
                    await BookingEquipment.destroy({ 
                        where: { booking_id: booking.id, equipment_id: equipment.id } 
                    });
                }

                if (!equipmentExists && equipment.value) {
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
                    
                    // ✅ UPDATED: Include meta_data when creating group equipment
                    const createData = { 
                        booking_id: booking.id, 
                        equipment_id: equipment.id 
                    };
                    if (equipment.meta_data) {
                        createData.meta_data = equipment.meta_data;
                    }
                    
                    await BookingEquipment.create(createData);
                    isEquipmentsAmended = true;
                }
            }
        }
    }

    // NEW: Special handler for infant_care equipment
    const manageInfantCareEquipment = async (booking, equipments) => {
        // Get existing infant_care equipment for this booking
        const existingEquipments = booking.Equipment.filter((equipment) => {
            return equipment.dataValues.EquipmentCategory && 
                   equipment.dataValues.EquipmentCategory.name === 'infant_care';
        }).map(eq => eq.dataValues);

        for (let i = 0; i < equipments.length; i++) {
            const equipment = equipments[i];

            // Find existing booking equipment for this specific equipment
            const currentEquipment = existingEquipments.find((existingEquipment) => 
                existingEquipment && existingEquipment.id === equipment.id
            );

            if (currentEquipment) {
                // Equipment exists - update or remove based on value
                if (equipment.value) {
                    // Update existing equipment
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
                                    question: 'Equipment Updated',
                                    answer: `${equipment.name} (Quantity: ${equipment.meta_data?.quantity || 1})`,
                                    question_type: 'qa_pair',
                                    oldAnswer: equipment.name,
                                }
                            }
                        });
                    }

                    isEquipmentsAmended = true;
                    
                    // Update with meta_data including quantity
                    const updateData = { equipment_id: equipment.id };
                    if (equipment.meta_data) {
                        updateData.meta_data = equipment.meta_data;
                    }
                    
                    await BookingEquipment.update(updateData, { 
                        where: { booking_id: booking.id, equipment_id: equipment.id } 
                    });
                } else {
                    // Remove equipment
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
                                    oldAnswer: equipment.name,
                                }
                            }
                        });
                    }

                    isEquipmentsAmended = true;
                    await BookingEquipment.destroy({ 
                        where: { booking_id: booking.id, equipment_id: equipment.id } 
                    });
                }
            } else {
                // Equipment doesn't exist - create if value is true
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
                                    question: 'Equipment Added',
                                    answer: `${equipment.name} (Quantity: ${equipment.meta_data?.quantity || 1})`,
                                    question_type: 'qa_pair',
                                    oldAnswer: '',
                                }
                            }
                        });
                    }

                    // Create new equipment with meta_data
                    const createData = { 
                        booking_id: booking.id, 
                        equipment_id: equipment.id 
                    };
                    if (equipment.meta_data) {
                        createData.meta_data = equipment.meta_data;
                    }
                    
                    await BookingEquipment.create(createData);
                    isEquipmentsAmended = true;
                }
            }
        }
    };

    await manageBookingEquipment(booking, category, equipments);

    const bookingService = new BookingService();
    const isBookingComplete = await bookingService.isBookingComplete(booking.uuid);

    if (isBookingComplete && isEquipmentsAmended && booking.status.includes('booking_confirmed')) {
        const bookingAmendedStatus = await bookingStatuses.find(status => JSON.parse(status.value).name == 'booking_amended');
        await Booking.update({ status: bookingAmendedStatus.value, status_name: bookingAmendedStatus.name }, { where: { id: booking.id } });
    }
    return res.status(200).end();
}