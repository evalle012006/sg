import { BOOKING_TYPES } from "../../../../components/constants";
import { 
    AccessToken, 
    Booking, 
    BookingApprovalUsage,
    Guest, 
    FundingApproval,
    NotificationLibrary, 
    Package,
    QaPair, 
    Room, 
    RoomType, 
    Section, 
    Setting 
} from "../../../../models";
import { NotificationService } from "../../../../services/notification/notification";
import { dispatchHttpTaskHandler } from "../../../../services/queues/dispatchHttpTask";
import { 
    QUESTION_KEYS, 
    getAnswerByQuestionKey 
} from "../../../../services/booking/question-helper";
import { ApprovalTrackingService } from "../../../../services/approvalTracking";
const jwt = require('jsonwebtoken');
import moment from 'moment';
import { Op } from "sequelize";
import EmailService from '../../../../services/booking/emailService';
import { TEMPLATE_IDS } from '../../../../services/booking/templateIds';

export default async function handler(req, res) {
    try {
        const { uuid } = req.query;
        const { status, eligibility, isFullChargeCancellation } = req.body;

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

        // Get all Q&A pairs from all sections
        const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();
        
        // Check if funding source is icare
        const fundingSource = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.FUNDING_SOURCE);
        const cancellationType = isFullChargeCancellation ? 'full_charge' : 'no_charge';

        if (eligibility) {
            switch (eligibility.name) {
                case 'pending_approval':
                    break;
                case 'eligible':
                    if (booking.type == 'Enquiry' || BOOKING_TYPES.FIRST_TIME_GUEST) {
                        await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'eligible')), type: BOOKING_TYPES.FIRST_TIME_GUEST }, { where: { id: booking.id } });
                        
                        EmailService.sendWithTemplate(
                            booking.Guest.email,
                            TEMPLATE_IDS.BOOKING_APPROVED,
                            {
                                guest_name: booking.Guest.first_name,
                                booking_id: booking.id,
                                set_new_password_link: `${process.env.APP_URL}/auth/onboarding/set-new-password?token=${accessToken.token}`
                            }
                        );

                        if (!booking.Guest.active) {
                            await Guest.update({ active: true }, { where: { id: booking.Guest.id } });
                        }
                        generateNotifications(booking, 'eligible', true);
                    }
                    break;
                case 'ineligible':
                    EmailService.sendWithTemplate(
                        booking.Guest.email,
                        TEMPLATE_IDS.BOOKING_DECLINED,
                        {
                            guest_name: booking.Guest.first_name,
                        }
                    );

                    await Guest.update({ active: false }, { where: { id: booking.Guest.id } });
                    
                    const bookingCanceledStatus = await Setting.findOne({ 
                        where: { attribute: 'booking_status', value: { [Op.like]: '%booking_cancelled%' } } 
                    });
                    
                    // Parse the JSON to get the actual status name
                    const cancelledStatusObj = JSON.parse(bookingCanceledStatus.value);
                    
                    await booking.update({ 
                        status: bookingCanceledStatus.value, 
                        status_name: cancelledStatusObj.name,  // ✅ Now using the correct value
                        status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')) 
                    });
                    
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
                    console.log('🃏 Booking confirmed - funding source:', fundingSource);
                    
                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        // Get check-in and check-out dates
                        let checkInDate = null;
                        let checkOutDate = null;
                        
                        // Try combined date range first
                        const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                        if (dateRange) {
                            // Handle various date range formats
                            if (dateRange.includes(' - ')) {
                                const [start, end] = dateRange.split(' - ');
                                checkInDate = moment(start, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                checkOutDate = moment(end, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                            } else if (dateRange.includes(' to ')) {
                                const [start, end] = dateRange.split(' to ');
                                checkInDate = moment(start, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                checkOutDate = moment(end, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                            }
                        }
                        
                        // Fallback to separate fields or booking preferred dates
                        if (!checkInDate) {
                            checkInDate = booking.preferred_arrival_date;
                        }
                        if (!checkOutDate) {
                            checkOutDate = booking.preferred_departure_date;
                        }
                        
                        if (checkInDate && checkOutDate) {
                            // Calculate number of nights
                            const nightsRequested = moment(checkOutDate).diff(moment(checkInDate), 'days');
                            
                            if (nightsRequested > 0) {
                                try {
                                    // Check if usage records already exist (this is a re-confirmation/amendment)
                                    const existingUsageRecords = await BookingApprovalUsage.findAll({
                                        where: {
                                            booking_id: booking.id,
                                            room_type: 'primary',
                                            status: 'confirmed'
                                        },
                                        include: [{
                                            model: FundingApproval,
                                            as: 'approval'
                                        }]
                                    });
                                    
                                    let currentNightsConsumed = 0;
                                    if (existingUsageRecords && existingUsageRecords.length > 0) {
                                        currentNightsConsumed = existingUsageRecords.reduce((sum, record) => sum + record.nights_consumed, 0);
                                    }
                                    
                                    // If nights changed, we need to adjust the allocations
                                    if (currentNightsConsumed !== nightsRequested) {
                                        // Step 1: Return old nights to approvals (if any)
                                        if (existingUsageRecords && existingUsageRecords.length > 0) {
                                            console.log(`♻️ Returning ${currentNightsConsumed} nights from previous confirmation`);
                                            
                                            for (const usageRecord of existingUsageRecords) {
                                                if (usageRecord.approval) {
                                                    const fundingApprovalId = usageRecord.approval.id;
                                                    const nightsToReturn = usageRecord.nights_consumed;
                                                    
                                                    // ✅ FIX: Fetch fresh approval and use its nights_used value (respects manual adjustments)
                                                    const fundingApproval = await FundingApproval.findByPk(fundingApprovalId);
                                                    const currentNightsUsed = fundingApproval.nights_used || 0;
                                                    const newNightsUsed = Math.max(0, currentNightsUsed - nightsToReturn);
                                                    
                                                    // Update the approval - return nights
                                                    await FundingApproval.update(
                                                        { nights_used: newNightsUsed },
                                                        { where: { id: fundingApprovalId } }
                                                    );
                                                    
                                                    console.log(`✅ Returned ${nightsToReturn} nights to FundingApproval ${fundingApprovalId}. Nights used: ${currentNightsUsed} -> ${newNightsUsed}`);
                                                }
                                                
                                                // Delete the old usage record
                                                await usageRecord.destroy();
                                            }
                                        }
                                        
                                        // Step 2: Get ALL active approvals and check consolidated total
                                        const approvalSummary = await ApprovalTrackingService.getAllActiveApprovals(booking.Guest.id);
                                        
                                        console.log(`🃏 Guest ${booking.Guest.id} has ${approvalSummary.count} active approval(s) with ${approvalSummary.totalRemainingNights} total nights remaining`);
                                        
                                        // Check if guest has ANY active approvals
                                        if (approvalSummary.count === 0) {
                                            return res.status(400).json({
                                                error: 'No active iCare approval found',
                                                message: `Cannot confirm booking: This guest does not have any active funding approvals. This booking requires ${nightsRequested} nights. Please add an funding approval for this guest before confirming.`
                                            });
                                        }
                                        
                                        // Check if TOTAL nights across ALL approvals is sufficient
                                        if (approvalSummary.totalRemainingNights < nightsRequested) {
                                            return res.status(400).json({
                                                error: 'Insufficient approved nights',
                                                message: `Cannot confirm booking: This booking requires ${nightsRequested} nights, but the guest only has ${approvalSummary.totalRemainingNights} nights remaining across ${approvalSummary.count} approval(s). Please update the guest's funding approval(s) before confirming.`
                                            });
                                        }
                                        
                                        // Step 3: Allocate new nights across approvals (earliest approval_from date first)
                                        const allocations = await ApprovalTrackingService.allocateNightsFromApprovals(
                                            booking.Guest.id,
                                            nightsRequested
                                        );
                                        
                                        if (!allocations || allocations.length === 0) {
                                            return res.status(400).json({
                                                error: 'Unable to allocate nights',
                                                message: `Cannot confirm booking: Unable to allocate ${nightsRequested} nights from available approvals. Please contact support.`
                                            });
                                        }
                                        
                                        console.log(`🃏 Allocating ${nightsRequested} nights across ${allocations.length} approval(s)`);
                                        
                                        // Process each allocation
                                        const allocationSummary = [];
                                        for (const allocation of allocations) {
                                            const fundingApprovalId = allocation.approval.id;
                                            const nightsToUse = allocation.nightsToUse;
                                            
                                            // ✅ FIX: Fetch fresh approval and use its nights_used value (respects manual adjustments)
                                            const fundingApproval = await FundingApproval.findByPk(fundingApprovalId);
                                            const currentNightsUsed = fundingApproval.nights_used || 0;
                                            const newNightsUsed = currentNightsUsed + nightsToUse;
                                            
                                            console.log(`🃏 Using FundingApproval ${fundingApprovalId}: ${currentNightsUsed} + ${nightsToUse} = ${newNightsUsed} nights`);
                                            
                                            // Update the FundingApproval nights_used
                                            await FundingApproval.update(
                                                { nights_used: newNightsUsed },
                                                { where: { id: fundingApprovalId } }
                                            );
                                            
                                            // Create BookingApprovalUsage record
                                            try {
                                                await BookingApprovalUsage.create({
                                                    booking_id: booking.id,
                                                    funding_approval_id: fundingApprovalId,
                                                    room_type: 'primary',
                                                    nights_consumed: nightsToUse,
                                                    status: 'confirmed'
                                                });
                                                
                                                console.log(`✅ Created BookingApprovalUsage: booking_id=${booking.id}, funding_approval_id=${fundingApprovalId}, nights=${nightsToUse}`);
                                            } catch (usageError) {
                                                console.error('Error creating BookingApprovalUsage record:', usageError);
                                            }
                                            
                                            // Track for email summary
                                            allocationSummary.push({
                                                approvalNumber: fundingApproval.approval_number,
                                                approvalName: fundingApproval.approval_name,
                                                nightsUsedThisBooking: nightsToUse,  // Nights from this booking only
                                                totalNightsApproved: fundingApproval.nights_approved,  // Total approved from DB
                                                totalNightsUsed: newNightsUsed,  // Total used after this booking
                                                remainingNights: fundingApproval.nights_approved - newNightsUsed
                                            });
                                        }
                                        
                                        try {
                                            await sendIcareNightsUpdateEmail(booking.Guest, allocationSummary, {
                                                nightsRequested,
                                                totalAllocations: allocations.length
                                            });
                                        } catch (emailError) {
                                            console.error('Error sending funding nights update email:', emailError);
                                        }
                                    } else {
                                        console.log(`✅ Nights unchanged (${nightsRequested}), no allocation adjustment needed`);
                                    }
                                    
                                } catch (fundingError) {
                                    console.error('Error updating nights_used:', fundingError);
                                    return res.status(500).json({
                                        error: 'Database error',
                                        message: 'Unable to update funding funding information. Please try again or contact support.'
                                    });
                                }
                            }
                        }
                    }

                    // ALL VALIDATIONS PASSED - Now update the status logs
                    await Booking.update({ status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'confirmed')) }, { where: { id: booking.id } });

                    let roomTypes = '';
                    if (booking.Rooms.length > 0) {
                        if (booking.Rooms.length == 1) {
                            roomTypes = booking.Rooms[0].RoomType?.name;
                        } else {
                            const unique = new Set();
                            booking.Rooms.map((room, index) => {
                                unique.add(`${index + 1}. ${room.RoomType?.name}`);
                            })
                            roomTypes = [...unique].join(', ');
                        }
                    }

                    // ✅ FIXED: Get package name from database instead of just ID
                    const bookingPackage = await getBookingPackage(booking);

                    // Generate PDF and upload to GCS
                    const bookingPDFUrl = await dispatchHttpTaskHandler(`${process.env.APP_URL}/api/bookings/${booking.id}/generate-and-upload-pdf`, { booking_id: booking.id });

                    // ✅ UPDATED: Send guest confirmation using EmailService
                    EmailService.sendWithTemplate(
                        booking.Guest.email,
                        TEMPLATE_IDS.BOOKING_CONFIRMED,
                        {
                            guest_name: booking.Guest.first_name,
                            arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                            departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-',
                            accommodation: roomTypes || '-',
                            booking_package: bookingPackage || '-',
                            booking_id: booking.reference_id
                        }
                    );

                    EmailService.sendWithTemplate(
                        "info@sargoodoncollaroy.com.au",
                        TEMPLATE_IDS.BOOKING_CONFIRMED_ADMIN,
                        {
                            guest_name: booking.Guest.first_name + ' ' + booking.Guest.last_name,
                            arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                            departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-',
                            accommodation: roomTypes || '-',
                            booking_package: bookingPackage || '-',
                            booking_id: booking.reference_id
                        }
                    );

                    generateNotifications(booking, 'confirmed', true);
                    break;
                case 'booking_cancelled':
                    // ========================================================
                    // Cancellation Night Logic (supports multiple approvals)
                    // - Full Charge Cancellation: Guest is penalized, nights STAY subtracted (no refund)
                    // - No Charge Cancellation: Guest is NOT penalized, nights are RETURNED to approval(s)
                    // ========================================================
                    
                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        // Only process night returns for NO CHARGE cancellations
                        // Full Charge = penalty, nights stay subtracted
                        if (!isFullChargeCancellation) {
                            let nightsReturned = false;
                            
                            try {
                                // Find ALL usage records for this booking (supports multiple approvals)
                                const usageRecords = await BookingApprovalUsage.findAll({
                                    where: {
                                        booking_id: booking.id,
                                        room_type: 'primary',
                                        status: 'confirmed'
                                    },
                                    include: [{
                                        model: FundingApproval,
                                        as: 'approval'
                                    }]
                                });
                                
                                if (usageRecords && usageRecords.length > 0) {
                                    console.log(`🔄 Processing No Charge cancellation - returning nights to ${usageRecords.length} approval(s)`);
                                    
                                    const returnSummary = [];
                                    for (const usageRecord of usageRecords) {
                                        if (usageRecord.approval) {
                                            const fundingApprovalId = usageRecord.approval.id;
                                            const nightsToReturn = usageRecord.nights_consumed;
                                            
                                            // ✅ FIX: Fetch fresh approval and use its nights_used value (respects manual adjustments)
                                            const fundingApproval = await FundingApproval.findByPk(fundingApprovalId);
                                            const currentNightsUsed = fundingApproval.nights_used || 0;
                                            const newNightsUsed = Math.max(0, currentNightsUsed - nightsToReturn);
                                            
                                            // Update the approval - return nights
                                            await FundingApproval.update(
                                                { nights_used: newNightsUsed },
                                                { where: { id: fundingApprovalId } }
                                            );
                                            
                                            // Update the usage record status
                                            await usageRecord.update({ status: 'cancelled' });
                                            
                                            console.log(`✅ Returned ${nightsToReturn} nights to FundingApproval ${fundingApprovalId}. Nights used: ${currentNightsUsed} -> ${newNightsUsed}`);
                                            
                                            returnSummary.push({
                                                approvalNumber: fundingApproval.approval_number,
                                                approvalName: fundingApproval.approval_name,
                                                nightsReturned: nightsToReturn,
                                                totalNightsApproved: fundingApproval.nights_approved,
                                                totalNightsUsed: newNightsUsed,
                                                remainingNights: fundingApproval.nights_approved - newNightsUsed
                                            });
                                        }
                                    }
                                    
                                    // ✅ UPDATED: Send email notification using EmailService
                                    try {
                                        await sendIcareCancellationEmail(booking.Guest, returnSummary, {
                                            isNoCharge: true,
                                            totalReturned: returnSummary.reduce((sum, r) => sum + r.nightsReturned, 0)
                                        });
                                    } catch (emailError) {
                                        console.error('Error sending funding cancellation email:', emailError);
                                    }
                                    
                                    nightsReturned = true;
                                } else {
                                    console.log('No BookingApprovalUsage records found - trying fallback method');
                                }
                            } catch (usageError) {
                                console.error('Error looking up BookingApprovalUsage:', usageError);
                            }
                            
                            // Fallback: If no usage record found (for bookings confirmed before this system)
                            if (!nightsReturned) {
                                let checkInDate = booking.preferred_arrival_date;
                                let checkOutDate = booking.preferred_departure_date;
                                
                                // Try to get from Q&A if available
                                const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                                if (dateRange) {
                                    if (dateRange.includes(' - ')) {
                                        const [start, end] = dateRange.split(' - ');
                                        checkInDate = moment(start, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                        checkOutDate = moment(end, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                    } else if (dateRange.includes(' to ')) {
                                        const [start, end] = dateRange.split(' to ');
                                        checkInDate = moment(start, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                        checkOutDate = moment(end, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                    }
                                }
                                
                                if (checkInDate && checkOutDate) {
                                    const nightsToReturn = moment(checkOutDate).diff(moment(checkInDate), 'days');
                                    
                                    if (nightsToReturn > 0) {
                                        try {
                                            // Find the most recent active FundingApproval for this guest
                                            const fundingApproval = await FundingApproval.findOne({
                                                where: {
                                                    guest_id: booking.Guest.id,
                                                    status: 'active'
                                                },
                                                order: [['approval_from', 'DESC']]
                                            });
                                            
                                            if (fundingApproval) {
                                                const currentNightsUsed = fundingApproval.nights_used || 0;
                                                const newNightsUsed = Math.max(0, currentNightsUsed - nightsToReturn);
                                                
                                                await FundingApproval.update(
                                                    { nights_used: newNightsUsed },
                                                    { where: { id: fundingApproval.id } }
                                                );
                                                
                                                console.log(`Fallback method (No Charge): Returned ${nightsToReturn} nights to FundingApproval ${fundingApproval.id}. Nights used: ${currentNightsUsed} -> ${newNightsUsed}`);
                                                
                                                // ✅ UPDATED: Send email using EmailService
                                                try {
                                                    await sendIcareCancellationEmail(booking.Guest, [{
                                                        approvalNumber: fundingApproval.approval_number,
                                                        approvalName: fundingApproval.approval_name,
                                                        nightsReturned: nightsToReturn,
                                                        remainingNights: fundingApproval.nights_approved - newNightsUsed
                                                    }], {
                                                        isNoCharge: true,
                                                        totalReturned: nightsToReturn
                                                    });
                                                } catch (emailError) {
                                                    console.error('Error sending funding cancellation email:', emailError);
                                                }
                                            }
                                        } catch (fundingError) {
                                            console.error('Error returning nights_used (fallback):', fundingError);
                                        }
                                    }
                                }
                            }
                        } else {
                            // Full Charge Cancellation - nights stay subtracted as penalty
                            try {
                                const usageRecords = await BookingApprovalUsage.findAll({
                                    where: {
                                        booking_id: booking.id,
                                        room_type: 'primary',
                                        status: 'confirmed'
                                    },
                                    include: [{
                                        model: FundingApproval,
                                        as: 'approval'
                                    }]
                                });
                                
                                if (usageRecords && usageRecords.length > 0) {
                                    console.log(`💰 Processing Full Charge cancellation - nights remain subtracted from ${usageRecords.length} approval(s)`);
                                    
                                    let totalNightsLost = 0;
                                    const penaltySummary = [];
                                    
                                    for (const usageRecord of usageRecords) {
                                        await usageRecord.update({ status: 'charged' });
                                        totalNightsLost += usageRecord.nights_consumed;
                                        
                                        if (usageRecord.approval) {
                                            penaltySummary.push({
                                                approvalNumber: usageRecord.approval.approval_number,
                                                approvalName: usageRecord.approval.approval_name,
                                                nightsLost: usageRecord.nights_consumed,
                                                totalNightsApproved: usageRecord.approval.nights_approved,
                                                totalNightsUsed: usageRecord.approval.nights_used,
                                                remainingNights: usageRecord.approval.nights_approved - usageRecord.approval.nights_used
                                            });
                                        }
                                    }
                                    
                                    console.log(`Full Charge Cancellation: Guest loses ${totalNightsLost} nights as penalty.`);
                                    
                                    // ✅ UPDATED: Send email notification using EmailService
                                    try {
                                        await sendIcareFullChargeCancellationEmail(booking.Guest, penaltySummary, {
                                            totalNightsLost
                                        });
                                    } catch (emailError) {
                                        console.error('Error sending funding full charge cancellation email:', emailError);
                                    }
                                } else {
                                    console.log('⚠️ No usage records found for Full Charge cancellation - booking was never confirmed');
                                }
                            } catch (usageError) {
                                console.error('Error updating usage records for full charge cancellation:', usageError);
                            }
                        }
                    }
                    // ========================================================
                    
                    if (currentStatus && (currentStatus.name === 'booking_cancelled' || status.name === 'booking_cancelled')) {
                        // Update status logs
                        await Booking.update({ 
                            status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')),
                            cancellation_type: cancellationType
                        }, { where: { id: booking.id } });
                        
                        // ✅ UPDATED: Send cancellation emails using EmailService
                        EmailService.sendWithTemplate(
                            booking.Guest.email,
                            TEMPLATE_IDS.BOOKING_CANCELLED,
                            {
                                guest_name: booking.Guest.first_name,
                                arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                                departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                            }
                        );
                        
                        EmailService.sendWithTemplate(
                            "info@sargoodoncollaroy.com.au",
                            TEMPLATE_IDS.BOOKING_CANCELLED_ADMIN,
                            {
                                guest_name: booking.Guest.first_name + ' ' + booking.Guest.last_name,
                                arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                                departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                            }
                        );
                    }
                    
                    generateNotifications(booking, 'booking_cancelled', true);
                    break;
                case 'guest_cancelled':
                    // Update status logs
                    await Booking.update({ 
                        status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'guest_canceled'))
                    }, { where: { id: booking.id } });
                    
                    // ✅ Send guest-initiated cancellation emails using new template IDs
                    EmailService.sendWithTemplate(
                        booking.Guest.email,
                        TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST, // ID: 35
                        {
                            guest_name: booking.Guest.first_name,
                            arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                            departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                        }
                    );
                    
                    EmailService.sendWithTemplate(
                        "info@sargoodoncollaroy.com.au",
                        TEMPLATE_IDS.BOOKING_GUEST_CANCELLATION_REQUEST_ADMIN, // ID: 36
                        {
                            guest_name: booking.Guest.first_name + ' ' + booking.Guest.last_name,
                            arrivalDate: booking.preferred_arrival_date ? moment(booking.preferred_arrival_date).format("DD-MM-YYYY") : '-',
                            departureDate: booking.preferred_departure_date ? moment(booking.preferred_departure_date).format("DD-MM-YYYY") : '-'
                        }
                    );
                    
                    generateNotifications(booking, 'guest_cancelled', true);
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
 * ✅ FIXED: Get booking package NAME from database instead of just returning the ID
 * This function now queries the Package table to return the actual package name
 */
const getBookingPackage = async (booking) => {
    const allQaPairs = booking.Sections.map(section => section.QaPairs).flat();
    
    // First check for course packages
    const coursePackageAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES);
    if (coursePackageAnswer) {
        // If it's a numeric ID, fetch the package name from database
        if (!isNaN(coursePackageAnswer)) {
            try {
                const packageRecord = await Package.findByPk(coursePackageAnswer);
                if (packageRecord) {
                    return packageRecord.name;
                }
            } catch (error) {
                console.error('Error fetching package by ID:', error);
            }
        }
        // Otherwise return the answer as-is (might be a text value)
        return coursePackageAnswer;
    }
    
    // Then check for full packages
    const fullPackageAnswer = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL);
    if (fullPackageAnswer) {
        // If it's a numeric ID, fetch the package name from database
        if (!isNaN(fullPackageAnswer)) {
            try {
                const packageRecord = await Package.findByPk(fullPackageAnswer);
                if (packageRecord) {
                    return packageRecord.name;
                }
            } catch (error) {
                console.error('Error fetching package by ID:', error);
            }
        }
        // Otherwise return the answer as-is (might be a text value)
        return fullPackageAnswer;
    }
    
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

/**
 * Send iCare nights update email using EmailService
 */
const sendIcareNightsUpdateEmail = async (guest, allocationSummary, bookingDetails) => {
    const { nightsRequested, totalAllocations } = bookingDetails;
    
    // Build allocation details for email
    const allocationDetails = allocationSummary.map(a => 
        `• ${a.approvalNumber || a.approvalName || 'Approval'}: ${a.nightsUsedThisBooking} nights from this booking (${a.totalNightsUsed} total used), ${a.remainingNights} remaining`
    ).join('\n');
    
    const templateData = {
        guest_name: `${guest.first_name} ${guest.last_name}`,
        nights_requested: nightsRequested,
        total_allocations: totalAllocations,
        allocation_details: allocationDetails,
        // For backwards compatibility with existing template
        approval_number: allocationSummary[0]?.approvalNumber || 'Multiple approvals',
        nights_approved: allocationSummary.reduce((sum, a) => sum + (a.totalNightsApproved || 0), 0),
        nights_used: allocationSummary.reduce((sum, a) => sum + (a.totalNightsUsed || 0), 0),
        nights_remaining: allocationSummary.reduce((sum, a) => sum + a.remainingNights, 0)
    };
    
    EmailService.sendWithTemplate(
        guest.email,
        TEMPLATE_IDS.ICARE_NIGHTS_UPDATE,
        templateData
    );
};

/**
 * Send iCare cancellation email using EmailService
 */
const sendIcareCancellationEmail = async (guest, returnSummary, cancellationDetails) => {
    const { isNoCharge, totalReturned } = cancellationDetails;
    
    const returnDetails = returnSummary.map(r => 
        `• ${r.approvalNumber || r.approvalName || 'Approval'}: ${r.nightsReturned} nights returned, ${r.remainingNights} now remaining`
    ).join('\n');
    
    const templateData = {
        guest_name: `${guest.first_name} ${guest.last_name}`,
        nights_returned: totalReturned,
        return_details: returnDetails,
        cancellation_type: isNoCharge ? 'No Charge' : 'Full Charge',
        // For backwards compatibility
        approval_number: returnSummary[0]?.approvalNumber || 'Multiple approvals',
        nights_approved: returnSummary.reduce((sum, r) => sum + (r.totalNightsApproved || 0), 0),
        nights_used: returnSummary.reduce((sum, r) => sum + (r.totalNightsUsed || 0), 0),
        nights_remaining: returnSummary.reduce((sum, r) => sum + r.remainingNights, 0)
    };
    
    EmailService.sendWithTemplate(
        guest.email,
        TEMPLATE_IDS.ICARE_NIGHTS_UPDATE,
        templateData
    );
};

/**
 * Send iCare full charge cancellation email using EmailService
 */
const sendIcareFullChargeCancellationEmail = async (guest, penaltySummary, penaltyDetails) => {
    const { totalNightsLost } = penaltyDetails;
    
    const penaltyDetailsText = penaltySummary.map(p => 
        `• ${p.approvalNumber || p.approvalName || 'Approval'}: ${p.nightsLost} nights lost, ${p.remainingNights} remaining`
    ).join('\n');
    
    const templateData = {
        guest_name: `${guest.first_name} ${guest.last_name}`,
        nights_lost: totalNightsLost,
        penalty_details: penaltyDetailsText,
        cancellation_type: 'Full Charge (Penalty Applied)',
        // For backwards compatibility
        approval_number: penaltySummary[0]?.approvalNumber || 'Multiple approvals',
        nights_approved: penaltySummary.reduce((sum, p) => sum + (p.totalNightsApproved || 0), 0),
        nights_used: penaltySummary.reduce((sum, p) => sum + (p.totalNightsUsed || 0), 0),
        nights_remaining: penaltySummary.reduce((sum, p) => sum + p.remainingNights, 0)
    };
    
    EmailService.sendWithTemplate(
        guest.email,
        TEMPLATE_IDS.ICARE_NIGHTS_UPDATE,
        templateData
    );
};