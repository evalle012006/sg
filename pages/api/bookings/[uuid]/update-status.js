import { BOOKING_TYPES } from "../../../../components/constants";
import { 
    AccessToken, Booking, BookingApprovalUsage, Guest, FundingApproval,
    NotificationLibrary, Package, QaPair, Question, Room, RoomType, Section, Setting 
} from "../../../../models";
import { NotificationService } from "../../../../services/notification/notification";
import { dispatchHttpTaskHandler } from "../../../../services/queues/dispatchHttpTask";
import { QUESTION_KEYS, getAnswerByQuestionKey } from "../../../../services/booking/question-helper";
import { ApprovalTrackingService } from "../../../../services/approvalTracking";
import EmailTriggerService from '../../../../services/booking/emailTriggerService';
const { syncFundingProfileFromBooking } = require('../../../../services/booking/guest-funding-profile-service');
const jwt = require('jsonwebtoken');
import moment from 'moment';
import { Op } from "sequelize";
import EmailService from '../../../../services/booking/emailService';
import { TEMPLATE_IDS } from '../../../../services/booking/templateIds';
import AuditLogService from "../../../../services/AuditLogService";

// ─── Build formatted iCare context for trigger dispatch ───────────────────────
const buildIcareContext = (allocationSummary, updateType, extraFields = {}) => {
    let approvalFrom = '-', approvalTo = '-';

    if (allocationSummary.length === 1) {
        approvalFrom = allocationSummary[0].approvalFrom
            ? moment(allocationSummary[0].approvalFrom).format('DD MMM YYYY') : '-';
        approvalTo = allocationSummary[0].approvalTo
            ? moment(allocationSummary[0].approvalTo).format('DD MMM YYYY') : '-';
    } else if (allocationSummary.length > 1) {
        const valid = allocationSummary.filter(a => a.approvalFrom && a.approvalTo);
        if (valid.length > 0) {
            const earliest = valid.reduce((e, c) =>
                moment(c.approvalFrom).isBefore(moment(e.approvalFrom)) ? c : e);
            const latest = valid.reduce((l, c) =>
                moment(c.approvalTo).isAfter(moment(l.approvalTo)) ? c : l);
            approvalFrom = moment(earliest.approvalFrom).format('DD MMM YYYY');
            approvalTo = moment(latest.approvalTo).format('DD MMM YYYY');
        }
    }

    return {
        icare_funding_updated: true,
        update_type:      updateType,
        approval_number:  allocationSummary.map(a => a.approvalNumber).filter(Boolean).join(', ') || 'Multiple approvals',
        approval_from:    approvalFrom,
        approval_to:      approvalTo,
        nights_approved:  allocationSummary.reduce((s, a) => s + (a.totalNightsApproved || 0), 0),
        nights_used:      allocationSummary.reduce((s, a) => s + (a.totalNightsUsed || 0), 0),
        nights_remaining: allocationSummary.reduce((s, a) => s + a.remainingNights, 0),
        ...extraFields
    };
};

export default async function handler(req, res) {
    try {
        const { uuid } = req.query;
        const { status, eligibility, isFullChargeCancellation } = req.body;

        if (!uuid) {
            return res.status(400).json({ error: 'Booking UUID is required', message: 'Booking UUID is required' });
        }

        const booking = await Booking.findOne({
            where: { uuid },
            include: [
                { model: Section, include: [{ model: QaPair, include: [Question] }] },
                Guest,
                { model: Room, include: [RoomType] }
            ]
        });

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found', message: 'Booking not found' });
        }

        const token = jwt.sign({ email: booking.Guest.email, user_type: 'guest' }, process.env.SECRET);
        const accessToken = await AccessToken.create({ token, tokenable_id: booking.Guest.id, tokenable_type: 'guest' });

        let statusLogs = booking.status_logs ? JSON.parse(booking.status_logs) : [];
        const currentStatus = booking.status ? JSON.parse(booking.status) : null;
        const allQaPairs = booking.Sections.map(s => s.QaPairs).flat();
        const fundingSource = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.FUNDING_SOURCE);
        const cancellationType = isFullChargeCancellation ? 'full_charge' : 'no_charge';

        // ════════════════════════════════════════════════════════════════════
        // ELIGIBILITY BRANCH
        // ════════════════════════════════════════════════════════════════════
        if (eligibility) {
            switch (eligibility.name) {
                case 'pending_approval':
                    break;

                case 'eligible':
                    if (booking.type == 'Enquiry' || BOOKING_TYPES.FIRST_TIME_GUEST) {
                        await Booking.update(
                            { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'eligible')), type: BOOKING_TYPES.FIRST_TIME_GUEST },
                            { where: { id: booking.id } }
                        );
                        // ✅ Keep direct — embeds one-time JWT access token
                        EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.BOOKING_APPROVED, {
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
                    // ✅ Keep direct — declined/cancelled (no configurable trigger needed)
                    EmailService.sendWithTemplate(booking.Guest.email, TEMPLATE_IDS.BOOKING_DECLINED, {
                        guest_name: booking.Guest.first_name
                    });
                    await Guest.update({ active: false }, { where: { id: booking.Guest.id } });
                    const bookingCanceledStatus = await Setting.findOne({
                        where: { attribute: 'booking_status', value: { [Op.like]: '%booking_cancelled%' } }
                    });
                    const cancelledStatusObj = JSON.parse(bookingCanceledStatus.value);
                    await booking.update({
                        status: bookingCanceledStatus.value,
                        status_name: cancelledStatusObj.name,
                        status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled'))
                    });
                    generateNotifications(booking, 'ineligible', true);
                    break;

                default:
                    break;
            }

            await Booking.update(
                { eligibility: JSON.stringify(eligibility), eligibility_name: eligibility?.name },
                { where: { uuid } }
            );

            // ✅ Direct system trigger dispatch — no queue
            try {
                await EmailTriggerService.evaluateAllTriggers(booking.id, {
                    booking_eligibility_changed: true,
                    booking_eligibility: eligibility.name,
                });
            } catch (triggerErr) {
                console.warn('⚠️ booking_eligibility_changed trigger dispatch failed (non-fatal):', triggerErr.message);
            }

        // ════════════════════════════════════════════════════════════════════
        // STATUS BRANCH
        // ════════════════════════════════════════════════════════════════════
        } else if (status) {
            switch (status.name) {
                case 'enquiry':
                    break;

                // ── Booking Confirmed ──────────────────────────────────────
                case 'booking_confirmed': {
                    console.log('🃏 Booking confirmed - funding source:', fundingSource);

                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        let checkInDate = null, checkOutDate = null;

                        const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                        if (dateRange) {
                            if (dateRange.includes(' - ')) {
                                const [s, e] = dateRange.split(' - ');
                                checkInDate = moment(s, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                checkOutDate = moment(e, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                            } else if (dateRange.includes(' to ')) {
                                const [s, e] = dateRange.split(' to ');
                                checkInDate = moment(s, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                checkOutDate = moment(e, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                            }
                        }
                        if (!checkInDate) checkInDate = booking.preferred_arrival_date;
                        if (!checkOutDate) checkOutDate = booking.preferred_departure_date;

                        if (checkInDate && checkOutDate) {
                            const nightsRequested = moment(checkOutDate).diff(moment(checkInDate), 'days');

                            if (nightsRequested > 0) {
                                try {
                                    const existingUsage = await BookingApprovalUsage.findAll({
                                        where: { booking_id: booking.id, room_type: 'primary', status: 'confirmed' },
                                        include: [{ model: FundingApproval, as: 'approval' }]
                                    });
                                    const currentNightsConsumed = existingUsage.reduce((s, r) => s + r.nights_consumed, 0);

                                    if (currentNightsConsumed !== nightsRequested) {
                                        // Return old nights if re-confirming
                                        if (existingUsage.length > 0) {
                                            console.log(`♻️ Returning ${currentNightsConsumed} nights from previous confirmation`);
                                            for (const ur of existingUsage) {
                                                if (ur.approval) {
                                                    const fa = await FundingApproval.findByPk(ur.approval.id);
                                                    const newUsed = Math.max(0, (fa.nights_used || 0) - ur.nights_consumed);
                                                    await FundingApproval.update({ nights_used: newUsed }, { where: { id: fa.id } });
                                                    console.log(`✅ Returned ${ur.nights_consumed} nights to FundingApproval ${fa.id}`);
                                                }
                                                await ur.destroy();
                                            }
                                        }

                                        const approvalSummary = await ApprovalTrackingService.getAllActiveApprovals(booking.Guest.id);
                                        console.log(`🃏 Guest ${booking.Guest.id}: ${approvalSummary.count} approval(s), ${approvalSummary.totalRemainingNights} nights remaining`);

                                        if (approvalSummary.count === 0) {
                                            return res.status(400).json({
                                                error: 'No active iCare approval found',
                                                message: `Cannot confirm: guest has no active funding approvals. Requires ${nightsRequested} nights.`
                                            });
                                        }
                                        if (approvalSummary.totalRemainingNights < nightsRequested) {
                                            return res.status(400).json({
                                                error: 'Insufficient approved nights',
                                                message: `Cannot confirm: requires ${nightsRequested} nights but only ${approvalSummary.totalRemainingNights} remaining across ${approvalSummary.count} approval(s).`
                                            });
                                        }

                                        const allocations = await ApprovalTrackingService.allocateNightsFromApprovals(booking.Guest.id, nightsRequested);
                                        if (!allocations || allocations.length === 0) {
                                            return res.status(400).json({
                                                error: 'Unable to allocate nights',
                                                message: `Cannot confirm: unable to allocate ${nightsRequested} nights from available approvals.`
                                            });
                                        }

                                        const allocationSummary = [];
                                        for (const allocation of allocations) {
                                            const fa = await FundingApproval.findByPk(allocation.approval.id, {
                                                attributes: ['id', 'approval_number', 'approval_name', 'nights_approved', 'nights_used', 'approval_from', 'approval_to']
                                            });
                                            const newUsed = (fa.nights_used || 0) + allocation.nightsToUse;
                                            await FundingApproval.update({ nights_used: newUsed }, { where: { id: fa.id } });

                                            try {
                                                await BookingApprovalUsage.create({
                                                    booking_id: booking.id,
                                                    funding_approval_id: fa.id,
                                                    room_type: 'primary',
                                                    nights_consumed: allocation.nightsToUse,
                                                    status: 'confirmed'
                                                });
                                                console.log(`✅ BookingApprovalUsage created: booking=${booking.id}, approval=${fa.id}, nights=${allocation.nightsToUse}`);
                                            } catch (usageError) {
                                                console.error('Error creating BookingApprovalUsage:', usageError);
                                            }

                                            allocationSummary.push({
                                                approvalNumber:        fa.approval_number,
                                                approvalName:          fa.approval_name,
                                                nightsUsedThisBooking: allocation.nightsToUse,
                                                totalNightsApproved:   fa.nights_approved,
                                                totalNightsUsed:       newUsed,
                                                remainingNights:       fa.nights_approved - newUsed,
                                                approvalFrom:          fa.approval_from,
                                                approvalTo:            fa.approval_to
                                            });
                                        }

                                        // ✅ Direct system trigger dispatch — no queue
                                        try {
                                            await EmailTriggerService.evaluateAllTriggers(booking.id, buildIcareContext(
                                                allocationSummary,
                                                'allocation',
                                                {
                                                    nights_requested:  nightsRequested,
                                                    total_allocations: allocations.length,
                                                    allocation_details: allocations.map(a =>
                                                        `• ${a.approvalNumber || a.approvalName}: ${a.nightsUsedThisBooking} nights used this booking (${a.totalNightsUsed} total), ${a.remainingNights} remaining`
                                                    ).join('\n'),
                                                    guest_name:  `${booking.Guest.first_name} ${booking.Guest.last_name}`,
                                                    guest_email: booking.Guest.email,
                                                }
                                            ));
                                        } catch (triggerErr) {
                                            console.warn('⚠️ icare_funding_updated (allocation) trigger dispatch failed (non-fatal):', triggerErr.message);
                                        }

                                    } else {
                                        console.log(`✅ Nights unchanged (${nightsRequested}), no allocation adjustment needed`);
                                    }
                                } catch (fundingError) {
                                    console.error('Error updating nights_used:', fundingError);
                                    return res.status(500).json({
                                        error: 'Database error',
                                        message: 'Unable to update funding information. Please try again or contact support.'
                                    });
                                }
                            }
                        }
                    }

                    // ── NEW: Sync iCare/NDIS funding data to guest_funding_profiles ──
                    // Runs for both iCare and NDIS confirmed bookings (not Promotional Stay etc.)
                    // Non-fatal — booking confirmation is not rolled back if this fails.
                    if (fundingSource) {
                        try {
                            await syncFundingProfileFromBooking(
                                booking,
                                fundingSource,
                                allQaPairs  // pass flat array — QaPairs are nested under Sections in this handler
                            );
                        } catch (profileSyncError) {
                            console.error('❌ [update-status] GuestFundingProfile sync failed (non-fatal):', profileSyncError.message);
                        }
                    }
                    // ────────────────────────────────────────────────────────

                    await Booking.update(
                        { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'confirmed')) },
                        { where: { id: booking.id } }
                    );

                    await dispatchHttpTaskHandler(
                        `${process.env.APP_URL}/api/bookings/${booking.id}/generate-and-upload-pdf`,
                        { booking_id: booking.id }
                    );

                    generateNotifications(booking, 'confirmed', true);
                    break;
                }

                // ── Booking Cancelled ──────────────────────────────────────
                case 'booking_cancelled': {
                    if (fundingSource && fundingSource.toLowerCase().includes('icare')) {
                        if (!isFullChargeCancellation) {
                            // No Charge — return nights to approvals
                            let nightsReturned = false;

                            try {
                                const usageRecords = await BookingApprovalUsage.findAll({
                                    where: { booking_id: booking.id, room_type: 'primary', status: 'confirmed' },
                                    include: [{ model: FundingApproval, as: 'approval' }]
                                });

                                if (usageRecords && usageRecords.length > 0) {
                                    console.log(`🔄 No Charge cancellation — returning nights to ${usageRecords.length} approval(s)`);
                                    const returnSummary = [];

                                    for (const ur of usageRecords) {
                                        if (ur.approval) {
                                            const fa = await FundingApproval.findByPk(ur.approval.id);
                                            const newUsed = Math.max(0, (fa.nights_used || 0) - ur.nights_consumed);
                                            await FundingApproval.update({ nights_used: newUsed }, { where: { id: fa.id } });
                                            await ur.update({ status: 'cancelled' });

                                            returnSummary.push({
                                                approvalNumber:      fa.approval_number,
                                                approvalName:        fa.approval_name,
                                                nightsReturned:      ur.nights_consumed,
                                                totalNightsApproved: fa.nights_approved,
                                                totalNightsUsed:     newUsed,
                                                remainingNights:     fa.nights_approved - newUsed,
                                                approvalFrom:        fa.approval_from,
                                                approvalTo:          fa.approval_to
                                            });
                                        }
                                    }

                                    const totalReturned = returnSummary.reduce((s, r) => s + r.nightsReturned, 0);

                                    try {
                                        await EmailTriggerService.evaluateAllTriggers(booking.id, buildIcareContext(
                                            returnSummary,
                                            'no_charge_cancellation',
                                            {
                                                nights_returned:   totalReturned,
                                                return_details:    returnSummary.map(r =>
                                                    `• ${r.approvalNumber || r.approvalName}: ${r.nightsReturned} nights returned, ${r.remainingNights} now remaining`
                                                ).join('\n'),
                                                cancellation_type: 'No Charge',
                                                guest_name:     `${booking.Guest.first_name} ${booking.Guest.last_name}`,
                                                guest_email:    booking.Guest.email,
                                            }
                                        ));
                                    } catch (triggerErr) {
                                        console.warn('⚠️ icare_funding_updated (no_charge_cancellation) trigger dispatch failed (non-fatal):', triggerErr.message);
                                    }

                                    nightsReturned = true;
                                }
                            } catch (usageError) {
                                console.error('Error looking up BookingApprovalUsage:', usageError);
                            }

                            // Fallback: for bookings confirmed before usage tracking existed
                            if (!nightsReturned) {
                                let checkInDate = booking.preferred_arrival_date;
                                let checkOutDate = booking.preferred_departure_date;

                                const dateRange = getAnswerByQuestionKey(allQaPairs, QUESTION_KEYS.CHECK_IN_OUT_DATE);
                                if (dateRange) {
                                    if (dateRange.includes(' - ')) {
                                        const [s, e] = dateRange.split(' - ');
                                        checkInDate = moment(s, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                        checkOutDate = moment(e, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                    } else if (dateRange.includes(' to ')) {
                                        const [s, e] = dateRange.split(' to ');
                                        checkInDate = moment(s, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                        checkOutDate = moment(e, ['DD/MM/YYYY', 'YYYY-MM-DD']).toDate();
                                    }
                                }

                                if (checkInDate && checkOutDate) {
                                    const nightsToReturn = moment(checkOutDate).diff(moment(checkInDate), 'days');
                                    if (nightsToReturn > 0) {
                                        try {
                                            const fa = await FundingApproval.findOne({
                                                where: { guest_id: booking.Guest.id, status: 'active' },
                                                order: [['approval_from', 'DESC']]
                                            });
                                            if (fa) {
                                                const newUsed = Math.max(0, (fa.nights_used || 0) - nightsToReturn);
                                                await FundingApproval.update({ nights_used: newUsed }, { where: { id: fa.id } });
                                                console.log(`Fallback (No Charge): returned ${nightsToReturn} nights to FundingApproval ${fa.id}`);

                                                const fallbackSummary = [{
                                                    approvalNumber:      fa.approval_number,
                                                    approvalName:        fa.approval_name,
                                                    nightsReturned:      nightsToReturn,
                                                    totalNightsApproved: fa.nights_approved,
                                                    totalNightsUsed:     newUsed,
                                                    remainingNights:     fa.nights_approved - newUsed,
                                                    approvalFrom:        fa.approval_from,
                                                    approvalTo:          fa.approval_to
                                                }];

                                                try {
                                                    await EmailTriggerService.evaluateAllTriggers(booking.id, buildIcareContext(
                                                        fallbackSummary,
                                                        'no_charge_cancellation',
                                                        {
                                                            nights_returned:   nightsToReturn,
                                                            cancellation_type: 'No Charge',
                                                            guest_name:     `${booking.Guest.first_name} ${booking.Guest.last_name}`,
                                                            guest_email:    booking.Guest.email,
                                                        }
                                                    ));
                                                } catch (triggerErr) {
                                                    console.warn('⚠️ icare_funding_updated (no_charge_cancellation fallback) trigger dispatch failed (non-fatal):', triggerErr.message);
                                                }
                                            }
                                        } catch (fundingError) {
                                            console.error('Error returning nights_used (fallback):', fundingError);
                                        }
                                    }
                                }
                            }

                        } else {
                            // Full Charge — nights stay subtracted as penalty
                            try {
                                const usageRecords = await BookingApprovalUsage.findAll({
                                    where: { booking_id: booking.id, room_type: 'primary', status: 'confirmed' },
                                    include: [{ model: FundingApproval, as: 'approval' }]
                                });

                                if (usageRecords && usageRecords.length > 0) {
                                    console.log(`💰 Full Charge cancellation — nights stay subtracted from ${usageRecords.length} approval(s)`);
                                    let totalNightsLost = 0;
                                    const penaltySummary = [];

                                    for (const ur of usageRecords) {
                                        await ur.update({ status: 'charged' });
                                        totalNightsLost += ur.nights_consumed;

                                        if (ur.approval) {
                                            penaltySummary.push({
                                                approvalNumber:      ur.approval.approval_number,
                                                approvalName:        ur.approval.approval_name,
                                                nightsLost:          ur.nights_consumed,
                                                totalNightsApproved: ur.approval.nights_approved,
                                                totalNightsUsed:     ur.approval.nights_used,
                                                remainingNights:     ur.approval.nights_approved - ur.approval.nights_used,
                                                approvalFrom:        ur.approval.approval_from,
                                                approvalTo:          ur.approval.approval_to
                                            });
                                        }
                                    }

                                    console.log(`Full Charge: guest loses ${totalNightsLost} nights as penalty`);

                                    try {
                                        await EmailTriggerService.evaluateAllTriggers(booking.id, buildIcareContext(
                                            penaltySummary,
                                            'full_charge_cancellation',
                                            {
                                                nights_lost:     totalNightsLost,
                                                penalty_details: penaltySummary.map(p =>
                                                    `• ${p.approvalNumber || p.approvalName}: ${p.nightsLost} nights lost as penalty, ${p.remainingNights} remaining`
                                                ).join('\n'),
                                                cancellation_type: 'Full Charge (Penalty Applied)',
                                                guest_name:     `${booking.Guest.first_name} ${booking.Guest.last_name}`,
                                                guest_email:    booking.Guest.email,
                                            }
                                        ));
                                    } catch (triggerErr) {
                                        console.warn('⚠️ icare_funding_updated (full_charge_cancellation) trigger dispatch failed (non-fatal):', triggerErr.message);
                                    }
                                } else {
                                    console.log('⚠️ No usage records found for Full Charge cancellation');
                                }
                            } catch (usageError) {
                                console.error('Error updating usage records for full charge cancellation:', usageError);
                            }
                        }
                    }

                    if (currentStatus && (currentStatus.name === 'booking_cancelled' || status.name === 'booking_cancelled')) {
                        await Booking.update({
                            status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'canceled')),
                            cancellation_type: cancellationType
                        }, { where: { id: booking.id } });
                    }

                    generateNotifications(booking, 'booking_cancelled', true);
                    break;
                }

                // ── Guest Cancelled ────────────────────────────────────────
                case 'guest_cancelled':
                    await Booking.update(
                        { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'guest_canceled')) },
                        { where: { id: booking.id } }
                    );
                    generateNotifications(booking, 'guest_cancelled', true);
                    break;

                // ── On Hold ────────────────────────────────────────────────
                case 'on_hold':
                    await Booking.update(
                        { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'on_hold')) },
                        { where: { id: booking.id } }
                    );
                    generateNotifications(booking, 'on hold');
                    break;

                // ── In Progress ────────────────────────────────────────────
                case 'in_progress':
                    generateNotifications(booking, 'in progress');
                    break;

                // ── Ready to Process ───────────────────────────────────────
                case 'ready_to_process':
                    generateNotifications(booking, 'ready to process');
                    break;

                // ── Pending Approval ───────────────────────────────────────
                case 'pending_approval':
                    await Booking.update(
                        { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'pending_approval')) },
                        { where: { id: booking.id } }
                    );
                    break;

                // ── Booking Amended ────────────────────────────────────────
                case 'booking_amended':
                    await Booking.update(
                        { status_logs: JSON.stringify(updateStatusLogs(statusLogs, 'booking_amended')) },
                        { where: { id: booking.id } }
                    );
                    generateNotifications(booking, 'booking_amended');
                    break;

                default:
                    break;
            }

            await Booking.update(
                { status: JSON.stringify(status), status_name: status?.name },
                { where: { uuid } }
            );

            // ── Audit log the status change ───────────────────────────────────────────
            try {
                await AuditLogService.logStatusChange({
                    bookingId:  booking.id,
                    userId:     null,
                    guestId:    booking.Guest?.id || null,
                    userType:   'system',
                    oldStatus:  currentStatus?.name || 'unknown',
                    newStatus:  status.name,
                });
            } catch (auditErr) {
                console.warn('⚠️ Status change audit log failed (non-fatal):', auditErr.message);
            }

            try {
                await EmailTriggerService.evaluateAllTriggers(booking.id, {
                    booking_status:      status.name,
                    status_to:           status.name,
                    status_from:         currentStatus?.name || null,
                    is_first_time_guest: booking.type === BOOKING_TYPES.FIRST_TIME_GUEST,
                    ...(status.name === 'booking_confirmed' && { booking_confirmed: true }),
                    ...(status.name === 'booking_cancelled' && { booking_cancelled: true, cancelled_by: 'admin' }),
                    ...(status.name === 'guest_cancelled'   && { booking_cancelled: true, cancelled_by: 'guest' }),
                });
            } catch (triggerErr) {
                console.warn('⚠️ booking_status_changed trigger dispatch failed (non-fatal):', triggerErr.message);
            }
        }

        return res.status(200).json({ success: true, message: 'Booking status updated successfully' });

    } catch (error) {
        console.error('Error updating booking status:', error);

        if (error.name === 'SequelizeValidationError') {
            return res.status(400).json({ error: 'Validation error', message: error.errors.map(e => e.message).join(', ') });
        }
        if (error.name === 'SequelizeDatabaseError') {
            return res.status(500).json({ error: 'Database error', message: 'Database operation failed. Please try again.' });
        }
        return res.status(500).json({ error: 'Internal server error', message: 'An unexpected error occurred.' });
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const generateNotifications = async (booking, status, adminOnly = false) => {
    const notificationLibs = await NotificationLibrary.findAll({ where: { enabled: true, name: "Booking Status Change" } });
    const notificationService = new NotificationService();
    const notificationLink = process.env.APP_URL + '/bookings/' + booking.uuid;

    for (const lib of notificationLibs) {
        let message = lib.notification;
        if (lib.alert_type == 'guest' && adminOnly) continue;
        if (lib.alert_type == 'admin') message = message.replace('[guest_name]', `${booking.Guest.first_name} ${booking.Guest.last_name}`);

        if (status == 'on hold') {
            message = message.replace('[has been]', 'is currently');
        } else if (status == 'in progress') {
            message = message.replace('[has been]', lib.alert_type == 'admin' ? 'is currently being processed' : 'is currently being processed by our team');
        } else if (status == 'ready to process') {
            message = message.replace('[has been]', 'has been received and is awaiting processing');
        } else {
            message = message.replace('[has been]', 'has been');
        }

        message = message.replace('[booking_id]', booking.reference_id);
        message = message.replace('[status]', ['in progress', 'ready to process'].includes(status) ? '' : status);

        await notificationService.notificationHandler({
            notification_to: lib.alert_type == 'admin' ? lib.notification_to : booking.Guest.email,
            message,
            link: lib.alert_type == 'admin' ? notificationLink : null,
            dispatch_date: moment().add(lib.date_factor, 'days').toDate()
        });
    }
};

const updateStatusLogs = (statusLogs, newStatus) => {
    const currentLogs = Array.isArray(statusLogs) ? statusLogs : [];
    const updated = [...currentLogs];
    const last = currentLogs[currentLogs.length - 1];
    if (last && last.status === newStatus) {
        updated[currentLogs.length - 1] = { ...last, updated_at: new Date() };
    } else {
        updated.push({ status: newStatus, created_at: new Date() });
    }
    return updated;
};