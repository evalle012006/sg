import { Op } from "sequelize";
import { Booking, BookingEquipment, Log, NotificationLibrary, QaPair, Section } from "../../../models";
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
            // Use for...of so each iteration is properly awaited.
            // .map(async) was used previously -- it fires all promises without
            // awaiting them, meaning any failure is swallowed silently and the
            // outer try/catch never sees it.
            for (const status of equipmentStatus.data) {
                let alertType = null;
                let payload = null;

                if (status.value < 2 && status.value >= 0) {
                    // Guard: notification library entry may be disabled or deleted
                    if (!lowAssetTypeNotification) {
                        console.warn('[stock-alert] Low Asset Type notification library entry not found or disabled -- skipping');
                        continue;
                    }

                    let message = lowAssetTypeNotification.notification;
                    message = message.replace('[asset_type]', equipmentStatus.equipment.name);
                    message = message.replace('[asset_count]', status.value);
                    message = message.replace('[date]', moment(status.date).format('YYYY-MM-DD'));

                    alertType = 'low_stock';
                    payload = {
                        message,
                        notification_to: lowAssetTypeNotification.notification_to
                    };
                } else if (status.value < 0) {
                    // Guard: notification library entry may be disabled or deleted
                    if (!placeholderAssetTypeNotification) {
                        console.warn('[stock-alert] Placeholder Asset Type notification library entry not found or disabled -- skipping');
                        continue;
                    }

                    let message = placeholderAssetTypeNotification.notification;
                    message = message.replace('[asset_count]', Math.abs(status.value));
                    message = message.replace('[asset_type]', equipmentStatus.equipment.name);
                    message = message.replace('[date]', moment(status.date).format('YYYY-MM-DD'));

                    alertType = 'placeholder_stock';
                    payload = {
                        message,
                        notification_to: placeholderAssetTypeNotification.notification_to
                    };
                }

                if (!payload) continue;

                // Dispatch and write audit log -- individually try/caught so a
                // single failure does not stop remaining notifications from sending.
                let dispatchSuccess = false;
                let dispatchError = null;

                try {
                    console.log('[stock-alert] dispatching notification', payload);
                    await notificationService.dispatchNotification(payload);
                    dispatchSuccess = true;
                    console.log('[stock-alert] dispatched successfully', {
                        alertType,
                        equipmentName: equipmentStatus.equipment.name,
                        recipient: payload.notification_to,
                        date: status.date
                    });
                } catch (err) {
                    dispatchSuccess = false;
                    dispatchError = err.message || String(err);
                    console.error('[stock-alert] dispatch FAILED', {
                        alertType,
                        equipmentId: bookingEquipment.equipment_id,
                        equipmentName: equipmentStatus.equipment.name,
                        recipient: payload.notification_to,
                        date: status.date,
                        error: dispatchError
                    });
                    // Do NOT rethrow -- continue to the next status entry
                }

                // Audit log -- written regardless of success/failure.
                // Stored in the existing Log table under loggable_type='equipment'
                // so it is queryable alongside other equipment events.
                // Query failures: SELECT * FROM logs WHERE loggable_type='equipment'
                // AND type='stock_alert' AND JSON_EXTRACT(data,'$.success')=false
                try {
                    await Log.create({
                        loggable_id: bookingEquipment.equipment_id,
                        loggable_type: 'equipment',
                        type: 'stock_alert',
                        data: {
                            alert_type: alertType,
                            equipment_id: bookingEquipment.equipment_id,
                            equipment_name: equipmentStatus.equipment.name,
                            booking_id: bookingEquipment.booking_id,
                            stock_value: status.value,
                            stock_date: moment(status.date).format('YYYY-MM-DD'),
                            recipient: payload.notification_to,
                            dispatched_at: new Date().toISOString(),
                            success: dispatchSuccess,
                            error: dispatchError
                        }
                    });
                } catch (logErr) {
                    // Log write failure must never kill the response
                    console.error('[stock-alert] audit log write failed', logErr.message);
                }
            }
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