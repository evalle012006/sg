import { Booking, BookingEquipment, Equipment, QaPair, Section } from "../../../models";
import { EquipmentService } from "../../../services/equipment/equipment";

export default async function handler(req, res) {
    const { equipment_id, booking_id } = req.body;
    const equipmentService = new EquipmentService();
    if (req.method === 'POST') {

        const availableEquipment = await Equipment.findOne({where: { id: equipment_id }});

        const booking = await Booking.findOne({
            where: { id: booking_id },
            include: [{ model: Section, include: [{ model: QaPair }] }]
        });

        let checkInDate = null;
        let checkOutDate = null;

        booking.Sections.map(section => {
            const questionCheckInOutDate = section.QaPairs.find(qa => qa.question == 'Check In Date and Check Out Date')
            if (questionCheckInOutDate && questionCheckInOutDate.answer) {
                checkInDate = questionCheckInOutDate.answer.split(' - ')[0];
                checkOutDate = questionCheckInOutDate.answer.split(' - ')[1];
            }

            const questionCheckInDate = section.QaPairs.find(qa => qa.question == 'Check In Date')
            if (questionCheckInDate && questionCheckInDate.answer) {
                checkInDate = questionCheckInDate.answer;
            }

            const questionCheckOutDate = section.QaPairs.find(qa => qa.question == 'Check Out Date')
            if (questionCheckOutDate && questionCheckOutDate.answer) {
                checkOutDate = questionCheckOutDate.answer;
            }
        });

        const bookings = await Booking.findAll({ include: [{ model: Section, include: [QaPair] }], order: [['created_at', 'ASC']] });
        const bookingEquipments = await BookingEquipment.findAll({ include: [Equipment, Booking] });

        const filteredBookings = bookings.filter(booking => {
            let inDateRange = false;
            for (let i = 0; i < booking.Sections.length; i++) {
                const section = booking.Sections[i];
                const question = section.QaPairs.find(qa => qa.question == 'Check In Date and Check Out Date')

                if (question && question.answer) {
                    const bookingCheckInDate = question.answer.split(' - ')[0];
                    const bookingCheckOutDate = question.answer.split(' - ')[1];

                    if (bookingCheckInDate >= checkInDate && bookingCheckInDate <= checkOutDate ||
                        bookingCheckOutDate >= checkInDate && bookingCheckOutDate <= checkOutDate) {
                        inDateRange = true;
                        break;
                    } else {
                        inDateRange = false;
                        break;
                    }
                }

                const checkInDateQa = section.QaPairs.find(qa => qa.question == 'Check In Date');
                const checkOutDateQa = section.QaPairs.find(qa => qa.question == 'Check Out Date');
                if (checkInDateQa && checkInDateQa.answer && checkOutDateQa && checkOutDateQa.answer) {
                    if (checkInDateQa.answer >= checkInDate && checkInDateQa.answer <= checkOutDate ||
                        checkOutDateQa.answer >= checkInDate && checkOutDateQa.answer <= checkOutDate) {
                        inDateRange = true;
                        break;
                    } else {
                        inDateRange = false;
                        break;
                    }
                }
            }

            return inDateRange;
        });


        for(let i = 0; i < filteredBookings.length; i++) {
            const booking = filteredBookings[i];
            const filteredBookingEquipments = bookingEquipments.filter(bookingEquipment => bookingEquipment.Booking.id == booking.id);
            for(let j = 0; j < filteredBookingEquipments.length; j++) {

                const bookingEquipment = filteredBookingEquipments[j];

                if (bookingEquipment.Equipment.name == availableEquipment.name) {
                    const equipmentAvailability = await equipmentService.checkAvailability(bookingEquipment.Equipment.id, booking.id);

                    if (!equipmentAvailability) {
                        console.log('reallocating equipment', bookingEquipment.Equipment.id, ' ->', availableEquipment.id, 'to booking', booking.id);
                        await BookingEquipment.update({ equipment_id: availableEquipment.id }, { 
                            where: { equipment_id: bookingEquipment.equipment_id, booking_id: bookingEquipment.booking_id } });
                        break;
                    }
                }
            }
        }

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}