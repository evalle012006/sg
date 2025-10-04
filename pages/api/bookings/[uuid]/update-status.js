import { BOOKING_TYPES } from "../../../../components/constants";
import { AccessToken, Booking, Guest, GuestFunding, NotificationLibrary, QaPair, Room, RoomType, Section, Setting } from "../../../../models";
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
    try {
        const { uuid } = req.query;
        const { status, eligibility } = req.body;

        if (!uuid) {
            return res.status(400).json({ 
                error: 'Booking UUID is required',
                message: 'Booking UUID is required' 
            });
        }

        const booking = await Booking.findOne({ 
            where: { uuid }, 
            include: [
                { model: Section, include: [{ model: QaPair }] }, 
                Guest, 
                { model: Room, include: [RoomType] }
            ] 
        });

        if (!booking) {
            return res.status(404).json({ 
                error: 'Booking not found',
                message: 'Booking not found' 
            });
        }

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

                // Check if this is the first confirmation (not a re-confirmation)
                const previousConfirmations = statusLogs.filter(log => log.status === 'confirmed');
                const isFirstConfirmation = previousConfirmations.length === 0;

                if (isFirstConfirmation) {
                    // Get all Q&A pairs from all sections
                    const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();
                    
                    // Check if funding source is icare
                    const fundingSource = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.FUNDING_SOURCE);
                    
                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        // Get check-in and check-out dates
                        let checkInDate = null;
                        let checkOutDate = null;
                        
                        // Try combined date range first
                        const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                        if (dateRange) {
                            // Handle various date range formats
                            let dates = [];
                            if (dateRange.includes(' to ')) {
                                dates = dateRange.split(' to ');
                            } else if (dateRange.includes(' - ')) {
                                dates = dateRange.split(' - ');
                            }
                            
                            if (dates.length === 2) {
                                checkInDate = moment(dates[0].trim());
                                checkOutDate = moment(dates[1].trim());
                            }
                        } else {
                            // Try individual date fields
                            const checkInAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_DATE);
                            const checkOutAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
                            
                            if (checkInAnswer) checkInDate = moment(checkInAnswer);
                            if (checkOutAnswer) checkOutDate = moment(checkOutAnswer);
                        }
                        
                        // Calculate nights if both dates are available and valid
                        if (checkInDate && checkOutDate && checkInDate.isValid() && checkOutDate.isValid()) {
                            const nightsRequested = checkOutDate.diff(checkInDate, 'days');
                            
                            if (nightsRequested > 0) {
                                try {
                                    // Find the GuestFunding record for this guest
                                    const guestFunding = await GuestFunding.findOne({
                                        where: { guest_id: booking.Guest.id }
                                    });
                                    
                                    if (guestFunding) {
                                        // Calculate new nights_used
                                        const currentNightsUsed = guestFunding.nights_used || 0;
                                        const newNightsUsed = currentNightsUsed + nightsRequested;
                                        
                                        // Check if it doesn't exceed nights_approved
                                        if (guestFunding.nights_approved && newNightsUsed > guestFunding.nights_approved) {
                                            const remainingNights = guestFunding.nights_approved - currentNightsUsed;
                                            return res.status(400).json({
                                                error: 'Insufficient approved nights',
                                                message: `Cannot confirm booking: This booking requires ${nightsRequested} nights, but only ${remainingNights} nights remain in the guest's iCare approval (${currentNightsUsed}/${guestFunding.nights_approved} nights already used).`
                                            });
                                        }
                                        
                                        if (guestFunding.nights_approved) {
                                            await GuestFunding.update(
                                                { nights_used: newNightsUsed },
                                                { where: { id: guestFunding.id } }
                                            );
                                            
                                            console.log(`Updated nights_used for guest ${booking.Guest.id}: ${currentNightsUsed} + ${nightsRequested} = ${newNightsUsed}`);
                                            
                                            // Send confirmation email with remaining nights info
                                            const remainingNights = guestFunding.nights_approved - newNightsUsed;
                                            try {
                                                await sendIcareNightsUpdateEmail(booking.Guest, guestFunding, {
                                                    nightsRequested,
                                                    remainingNights,
                                                    newNightsUsed
                                                });
                                            } catch (emailError) {
                                                console.error('Error sending iCare nights update email:', emailError);
                                                // Don't fail the booking confirmation if email fails
                                            }
                                        }
                                    } else {
                                        console.log(`No GuestFunding record found for guest ${booking.Guest.id}`);
                                    }
                                } catch (fundingError) {
                                    console.error('Error updating nights_used:', fundingError);
                                    return res.status(500).json({
                                        error: 'Database error',
                                        message: 'Error updating guest funding information. Please try again or contact support.'
                                    });
                                }
                            }
                        }
                    }
                }

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
            case 'guest_cancelled':
            case 'booking_cancelled':
                // Handle guest funding reversal for full charge cancellations
                const isFullChargeCancellation = req.body.isFullChargeCancellation;
                
                if (isFullChargeCancellation) {
                    // Get all Q&A pairs from all sections
                    const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();
                    
                    // Check if funding source is icare
                    const fundingSource = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.FUNDING_SOURCE);
                    
                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        // Get check-in and check-out dates
                        let checkInDate = null;
                        let checkOutDate = null;
                        
                        // Try combined date range first
                        const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                        if (dateRange) {
                            let dates = [];
                            if (dateRange.includes(' to ')) {
                                dates = dateRange.split(' to ');
                            } else if (dateRange.includes(' - ')) {
                                dates = dateRange.split(' - ');
                            }
                            
                            if (dates.length === 2) {
                                checkInDate = moment(dates[0].trim());
                                checkOutDate = moment(dates[1].trim());
                            }
                        } else {
                            // Try individual date fields
                            const checkInAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_DATE);
                            const checkOutAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_OUT_DATE);
                            
                            if (checkInAnswer) checkInDate = moment(checkInAnswer);
                            if (checkOutAnswer) checkOutDate = moment(checkOutAnswer);
                        }
                        
                        // Calculate nights if both dates are available and valid
                        if (checkInDate && checkOutDate && checkInDate.isValid() && checkOutDate.isValid()) {
                            const nightsToReturn = checkOutDate.diff(checkInDate, 'days');
                            
                            if (nightsToReturn > 0) {
                                try {
                                    // Find the GuestFunding record for this guest
                                    const guestFunding = await GuestFunding.findOne({
                                        where: { guest_id: booking.Guest.id }
                                    });
                                    
                                    if (guestFunding) {
                                        const currentNightsUsed = guestFunding.nights_used || 0;
                                        const newNightsUsed = Math.max(0, currentNightsUsed - nightsToReturn);
                                        
                                        await GuestFunding.update(
                                            { nights_used: newNightsUsed },
                                            { where: { id: guestFunding.id } }
                                        );
                                        
                                        console.log(`Reversed nights_used for guest ${booking.Guest.id}: ${currentNightsUsed} - ${nightsToReturn} = ${newNightsUsed}`);
                                        
                                        // Send email notification about nights reversal
                                        try {
                                            await sendIcareCancellationEmail(booking.Guest, guestFunding, {
                                                nightsReturned: nightsToReturn,
                                                newNightsUsed,
                                                remainingNights: guestFunding.nights_approved - newNightsUsed
                                            });
                                        } catch (emailError) {
                                            console.error('Error sending iCare cancellation email:', emailError);
                                            // Don't fail the cancellation if email fails
                                        }
                                    } else {
                                        console.log(`No GuestFunding record found for guest ${booking.Guest.id}`);
                                    }
                                } catch (fundingError) {
                                    console.error('Error reversing nights_used:', fundingError);
                                    // Continue with cancellation even if funding update fails
                                }
                            }
                        }
                    }
                }
                
                if (currentStatus && currentStatus.name === 'booking_cancelled') {
                    // Update status logs
                    await Booking.update({ 
                        status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')) 
                    }, { where: { id: booking.id } });
                    
                    // Send cancellation emails
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
                }
                
                generateNotifications(booking, status.name === 'guest_cancelled' ? 'guest cancelled' : 'cancelled', true);
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
            default:
                break;
        }

        await Booking.update({ status: JSON.stringify(status), status_name: status?.name }, { where: { uuid } });
    }

    return res.status(200).json({ 
        success: true, 
        message: 'Booking status updated successfully' 
    });
    
    } catch (error) {
        console.error('Error updating booking status:', error);
        
        // Handle Sequelize validation errors
        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({
                error: 'Validation error',
                message: error.errors.map(e => e.message).join(', ')
            });
        }

        // Handle Sequelize database errors
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(500).json({
                error: 'Database error',
                message: 'Database operation failed. Please try again.'
            });
        }
        
        // Handle general errors
        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred. Please try again or contact support.'
        });
    }
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

const sendIcareNightsUpdateEmail = async (guest, guestFunding, bookingDetails) => {
    const { nightsRequested, remainingNights, newNightsUsed } = bookingDetails;
    
    // Calculate template variables
    const templateData = {
        guest_name: `${guest.first_name} ${guest.last_name}`,
        approval_number: guestFunding.approval_number || 'Not specified',
        approval_from: guestFunding.approval_from 
            ? moment(guestFunding.approval_from).format('DD/MM/YYYY') 
            : 'Not specified',
        approval_to: guestFunding.approval_to 
            ? moment(guestFunding.approval_to).format('DD/MM/YYYY') 
            : 'Not specified',
        nights_approved: guestFunding.nights_approved || 0,
        nights_used: newNightsUsed, // Updated total after this booking
        nights_remaining: remainingNights,
        nights_requested: nightsRequested // Nights used by this specific booking
    };
    
    // Send email using your existing sendMail function
    await sendMail(
        guest.email,
        'Sargood on Collaroy - iCare Update',
        'icare-nights-update',
        templateData
    );
};

const sendIcareCancellationEmail = async (guest, guestFunding, cancellationDetails) => {
    const { nightsReturned, newNightsUsed, remainingNights } = cancellationDetails;
    
    const templateData = {
        guest_name: `${guest.first_name} ${guest.last_name}`,
        approval_number: guestFunding.approval_number || 'Not specified',
        nights_returned: nightsReturned,
        nights_used: newNightsUsed,
        nights_remaining: remainingNights,
        nights_approved: guestFunding.nights_approved || 0
    };
    
    await sendMail(
        guest.email,
        'Sargood on Collaroy - iCare Nights Update (Cancellation)',
        'icare-nights-update',
        templateData
    );
};