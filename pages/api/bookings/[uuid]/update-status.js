import { BOOKING_TYPES } from "../../../../components/constants";
import { AccessToken, Booking, Guest, NotificationLibrary, QaPair, Room, RoomType, Section, Setting } from "../../../../models";
import { NotificationService } from "../../../../services/notification/notification";
import { dispatchHttpTaskHandler } from "../../../../services/queues/dispatchHttpTask";
import sendMail from "../../../../utilities/mail";
import { 
    QUESTION_KEYS, 
    getAnswerByQuestionKey 
} from "../../../../services/booking/question-helper";
const jwt = require('jsonwebtoken');
import moment from 'moment';
import { Op } from "sequelize";

export default async function handler(req, res) {
    const { uuid } = req.query;
    const { status, eligibility } = req.body;

    const booking = await Booking.findOne({ where: { uuid }, include: [{ model: Section, include: [{ model: QaPair }] }, Guest, { model: Room, include: [RoomType] }] });

    const token = jwt.sign({ email: booking.Guest.email, user_type: 'guest' }, process.env.SECRET);

    const accessToken = await AccessToken.create({ token: token, tokenable_id: booking.Guest.id, tokenable_type: 'guest' });

    let statusLogs = booking.status_logs ? JSON.parse(booking.status_logs) : [];
    const currentStatus = booking.status ? JSON.parse(booking.status) : null;

    if (eligibility) {
        switch (eligibility.name) {
            case 'pending_approval':
                break;
            case 'eligible':
                if (booking.type == 'Enquiry' || BOOKING_TYPES.FIRST_TIME_GUEST) {
                    await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'eligible')), type: BOOKING_TYPES.FIRST_TIME_GUEST }, { where: { id: booking.id } });
                    sendMail(booking.Guest.email, 'Sargood On Collaroy - Booking Enquiry', 'booking-approved',
                        {
                            guest_name: booking.Guest.first_name,
                            booking_id: booking.id,
                            set_new_password_link: `${process.env.APP_URL}/auth/onboarding/set-new-password?token=${accessToken.token}`
                        });

                    if (!booking.Guest.active) {
                        await Guest.update({ active: true }, { where: { id: booking.Guest.id } });
                    }
                    generateNotifications(booking, 'eligible', true);
                }
                break;
            case 'ineligible':
                sendMail(booking.Guest.email, 'Sargood On Collaroy - Booking Enquiry', 'booking-declined',
                    {
                        guest_name: booking.Guest.first_name,
                    });

                await Guest.update({ active: false }, { where: { id: booking.Guest.id } });
                const bookingCanceledStatus = await Setting.findOne({ where: { attribute: 'booking_status', value: { [Op.like]: '%booking_cancelled%' } } });
                await booking.update({ 
                    status: bookingCanceledStatus.value, 
                    status_name: bookingCanceledStatus.name, 
                    status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')) });
                generateNotifications(booking, 'ineligible', true);
                break;
            default:
                break;
        }

        await Booking.update({ eligibility: JSON.stringify(eligibility), eligibility_name: eligibility?.name }, { where: { uuid } });
    } else if (status) {
        switch (status.name) {
            case 'enquiry':
                break;
            case 'booking_confirmed':
                await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'confirmed')) }, { where: { id: booking.id } });

                let roomTypes = '';
                if (booking.Rooms.length > 0) {
                    if (booking.Rooms.length == 1) {
                        roomTypes = booking.Rooms[0].RoomType?.name;
                    } else {
                        const unique = new Set();
                        booking.Rooms.map((room, index) => {
                            unique.add(`${index + 1}. ${room.label}`);
                        });
                        roomTypes = Array.from(unique).join(', ');
                    }
                }

                // REFACTORED: Get booking package using question keys
                const bookingPackage = getBookingPackage(booking);

                sendMail(booking.Guest.email, 'Sargood On Collaroy - Booking', 'booking-confirmed',
                    {
                        guest_name: booking.Guest.first_name,
                        arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                        departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-',
                        roomTypes: roomTypes,
                        packages: bookingPackage
                    });
                generateNotifications(booking, 'confirmed');
                dispatchHttpTaskHandler('booking', { type: 'triggerEmailsOnBookingConfirmed', payload: { booking_id: booking.id } });
                break;
            case 'booking_cancelled':
                await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')) }, { where: { id: booking.id } });
                sendMail(booking.Guest.email, 'Sargood On Collaroy - Booking Enquiry', 'booking-cancelled',
                    {
                        guest_name: booking.Guest.first_name,
                        arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                        departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                    });
                sendMail("info@sargoodoncollaroy.com.au", 'Sargood On Collaroy - Booking Enquiry', 'booking-cancelled-admin',
                    {
                        guest_name: booking.Guest.first_name + ' ' + booking.Guest.last_name,
                        arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                        departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                    });
                generateNotifications(booking, 'cancelled');
                break;
            case 'on_hold':
                await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'on_hold')) }, { where: { id: booking.id } });

                generateNotifications(booking, 'on hold');
                break;
            case 'in_progress':
                generateNotifications(booking, 'in progress');
                break;
            case 'ready_to_process':
                generateNotifications(booking, 'ready to process');
                break;
            case 'guest_cancelled':
                generateNotifications(booking, 'guest cancelled', true);
                break;
            default:
                break;
        }

        await Booking.update({ status: JSON.stringify(status), status_name: status?.name }, { where: { uuid } });
    }

    return res.status(200).end();
}

/**
 * REFACTORED: Get booking package using question keys instead of hardcoded question text
 * @param {Object} booking - The booking object with sections and Q&A pairs
 * @returns {string} - The booking package answer or empty string
 */
const getBookingPackage = (booking) => {
    // Get all Q&A pairs from all sections
    const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();
    
    // Try to find course package first
    const coursePackageAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES);
    if (coursePackageAnswer) {
        return coursePackageAnswer;
    }
    
    // Fallback to full accommodation package
    const fullPackageAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL);
    if (fullPackageAnswer) {
        return fullPackageAnswer;
    }
    
    // Return empty string if no package found
    return '';
};

const generateNotifications = async (booking, status, adminOnly = false) => {
    const notificationLibs = await NotificationLibrary.findAll({ where: { enabled: true, name: "Booking Status Change" } });
    const notificationService = new NotificationService();

    const notificationLink = process.env.APP_URL + '/bookings/' + booking.uuid;

    for (let index = 0; index < notificationLibs.length; index++) {
        const lib = notificationLibs[index];
        let message = lib.notification;

        if (lib.alert_type == 'guest' && adminOnly) {
            continue;
        }

        if (lib.alert_type == 'admin') {
            message = message.replace('[guest_name]', `${booking.Guest.first_name} ${booking.Guest.last_name}`);
        }

        if (status == 'on hold') {
            message = message.replace('[has been]', 'is currently');
        } else if (status == 'in progress') {
            if (lib.alert_type == 'admin') {
                message = message.replace('[has been]', 'is currently being processed');
            } else {
                message = message.replace('[has been]', 'is currently being processed by our team');
            }
        } else if (status == 'ready to process') {
            message = message.replace('[has been]', 'has been received and is awaiting processing');
        } else {
            message = message.replace('[has been]', 'has been');
        }

        message = message.replace('[booking_id]', booking.reference_id);

        if (status != 'in progress' && status != 'ready to process') {
            message = message.replace('[status]', status);
        } else {
            message = message.replace('[status]', '');
        }

        const dispatch_date = moment().add(lib.date_factor, 'days').toDate();
        await notificationService.notificationHandler({
            notification_to: lib.alert_type == 'admin' ? lib.notification_to : booking.Guest.email,
            message: message,
            link: lib.alert_type == 'admin' ? notificationLink : null,
            dispatch_date: dispatch_date
        });
    }
}

const updateStatusLogs = (statusLogs, newStatus) => {
    const currentLogs = Array.isArray(statusLogs) ? statusLogs : [];
    let updatedStatusLogs = [...currentLogs];
    let lastStatusLog = currentLogs.length > 0 ? currentLogs[currentLogs.length - 1] : null;
    if (lastStatusLog && lastStatusLog.status === newStatus) {
        updatedStatusLogs[currentLogs.length - 1] = {
            ...lastStatusLog,
            updated_at: new Date()
        };
    } else {
        updatedStatusLogs.push({
            status: newStatus,
            created_at: new Date()
        });
    }
    
    return updatedStatusLogs;
}