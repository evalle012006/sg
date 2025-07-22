import { Op } from "sequelize";
import { Booking, BookingEquipment, NotificationLibrary, QaPair, Section } from "../../../models";
import { EquipmentService } from "../../../services/equipment/equipment";
import { NotificationService } from "../../../services/notification/notification";
import dispatchHttpTask from "./../../../services/queues/dispatchHttpTask";
import moment from 'moment';

export default async function handler(req, res) {

    if (req.method === 'POST') {
        const bookingEquipment = req.body;
        const currentBooking = await Booking.findOne({
            where: { id: bookingEquipment.booking_id },
            include: [
                {
                    model: Section,
                    include: [{ model: QaPair, where: { [Op.or] : [ { question: 'Check In Date and Check Out Date' }, { question: 'Check In Date' }, { question: 'Check Out Date' } ] } }]
                }]
        });

        let startDate;
        let endDate;

        currentBooking.Sections.map(section => {
            const questionCheckInOutDate = section.QaPairs.find(qa => qa.question == 'Check In Date and Check Out Date')
            if (questionCheckInOutDate && questionCheckInOutDate.answer) {
                startDate = questionCheckInOutDate.answer.split(' - ')[0];
                endDate = questionCheckInOutDate.answer.split(' - ')[1];
            }

            const questionCheckInDate = section.QaPairs.find(qa => qa.question == 'Check In Date')
            if (questionCheckInDate && questionCheckInDate.answer) {
                startDate = questionCheckInDate.answer;
            }

            const questionCheckOutDate = section.QaPairs.find(qa => qa.question == 'Check Out Date')
            if (questionCheckOutDate && questionCheckOutDate.answer) {
                endDate = questionCheckOutDate.answer;
            }
        });

        const [data, created] = await BookingEquipment.upsert({
            ...bookingEquipment,
            start_date: startDate,
            end_date: endDate
        });


        // isEquipmentRunningOutOfStock STARTS HERE
        // checking if the equipment is running out of stock and dispatching notification
        const equipmentService = new EquipmentService();
        const notificationService = new NotificationService();

        const equipmentStatus = await equipmentService.getEquipmentStatus(bookingEquipment.equipment_id, bookingEquipment.booking_id);

        const lowAssetTypeNotification = await NotificationLibrary.findOne({ where: { name: 'Low Asset Type', enabled: true } });
        const placeholderAssetTypeNotification = await NotificationLibrary.findOne({ where: { name: 'Placeholder Asset Type', enabled: true } });

        if (equipmentStatus) {
            equipmentStatus.data.map(async (status) => {
                if (status.value < 2 && status.value >= 0) {
                    let message = lowAssetTypeNotification.notification;
    
                    message = message.replace('[asset_type]', equipmentStatus.equipment.name);
                    message = message.replace('[asset_count]', status.value);
                    message = message.replace('[date]', moment(status.date).format('YYYY-MM-DD'));
    
                    const payload = {
                        message,
                        notification_to: lowAssetTypeNotification.notification_to
                    };
    
                    console.log('dispatching notification', payload)
                    await notificationService.dispatchNotification(payload);
                }
    
                if (status.value < 0) {
                    let message = placeholderAssetTypeNotification.notification;
    
                    message = message.replace('[asset_count]', Math.abs(status.value));
                    message = message.replace('[asset_type]', equipmentStatus.equipment.name);
                    message = message.replace('[date]', moment(status.date).format('YYYY-MM-DD'));
    
                    const payload = {
                        message,
                        notification_to: placeholderAssetTypeNotification.notification_to
                    };
    
                    console.log('dispatching notification', payload)
                    await notificationService.dispatchNotification(payload);
                }
            });
        }

        //isEquipmentRunningOutOfStock ENDS HERE

        return res.status(200).json({ success: true, equipment: data });
    }

    if (req.method === 'DELETE') {
        const { equipment_id, booking_id } = req.body;

        const equipment = await BookingEquipment.findOne({ where: { equipment_id, booking_id } });
        await equipment.destroy();

        // queuing task to reallocate on another booking
        dispatchHttpTask(process.env.APP_URL + '/api/equipments/reallocate', 'POST', { equipment_id, booking_id });

        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ message: 'Method not allowed' });
}
