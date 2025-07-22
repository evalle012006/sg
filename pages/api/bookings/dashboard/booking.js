import { Booking, QaPair, Section, Setting, sequelize } from '../../../../models';
import { Op } from "sequelize";
import moment from 'moment';

const VALID_FILTERS = ['Week', 'Month', 'Quarter', 'Year'];

export default async function handler(req, res) {
    try {
        const { filter = 'Week' } = req.query;

        if (!VALID_FILTERS.includes(filter)) {
            return res.status(400).json({ 
                message: 'Invalid filter parameter',
                validFilters: VALID_FILTERS 
            });
        }

        res.setHeader('Cache-Control', 'private, max-age=3600');
        
        const currentDate = moment().toDate();
        const startCurrentDate = moment().startOf('day').toDate();
        const endCurrentDate = moment().endOf('day').toDate();

        // Fetch all settings and statuses in parallel
        const [bookingStatuses, fundingQaPairs] = await Promise.all([
            Setting.findAll({ 
                where: { attribute: 'booking_status' },
                attributes: ['value']
            }),
            QaPair.findAll({
                where: {
                    question: "How will your stay be funded?",
                    answer: {
                        [Op.not]: null
                    }
                },
                attributes: ['answer']
            })
        ]);

        // Parse booking statuses once
        const statusValues = parseBookingStatuses(bookingStatuses);
        const dateRanges = getDateRanges(filter);

        // Fetch all required booking data in parallel
        const [
            currentGuests,
            arrivingToday,
            checkingOutToday,
            lateCheckInToday,
            confirmedBookings,
            inProgressBookings,
            cancelledBookings,
            pendingBookings,
            guestsOver90Kg
        ] = await Promise.all([
            Booking.count({
                where: {
                    preferred_arrival_date: { [Op.lte]: currentDate },
                    preferred_departure_date: { [Op.gte]: currentDate },
                    status: statusValues.bookingConfirmedValue,
                    deleted_at: null
                }
            }),
            Booking.count({
                where: {
                    preferred_arrival_date: { [Op.between]: [startCurrentDate, endCurrentDate] },
                    status: statusValues.bookingConfirmedValue,
                    deleted_at: null
                }
            }),
            Booking.count({
                where: {
                    preferred_departure_date: { [Op.between]: [startCurrentDate, endCurrentDate] },
                    status: statusValues.bookingConfirmedValue,
                    deleted_at: null
                }
            }),
            Booking.count({
                where: {
                    preferred_arrival_date: { [Op.between]: [startCurrentDate, endCurrentDate] },
                    late_arrival: true,
                    status: statusValues.bookingConfirmedValue,
                    deleted_at: null
                }
            }),
            Booking.findAll({
                where: {
                    status: statusValues.bookingConfirmedValue,
                    deleted_at: null
                },
                attributes: ['id', 'created_at', 'status_logs']
            }),
            Booking.findAll({
                where: {
                    complete: true,
                    status: statusValues.inProgressValue,
                    deleted_at: null
                },
                attributes: ['id', 'created_at', 'status_logs']
            }),
            Booking.findAll({
                where: {
                    status: statusValues.bookingCancelledValue,
                    deleted_at: null
                },
                attributes: ['id', 'created_at', 'status_logs']
            }),
            Booking.findAll({
                where: {
                    status: statusValues.pendingApprovalValue,
                    created_at: { [Op.between]: [dateRanges.periodStart, dateRanges.periodEnd] },
                    deleted_at: null
                },
                attributes: ['id', 'created_at']
            }),
            getGuestsOver90Kg(statusValues.bookingConfirmedValue, currentDate)
        ]);

        // Process metrics
        const data = {
            totalGuests: currentGuests,
            toalGuestsArrivingToday: arrivingToday,
            totalGuestCheckingOutToday: checkingOutToday,
            totalGuestLateCheckInToday: lateCheckInToday,
            guestArrivalEnquiries: getGuestArrivalData(filter, confirmedBookings, inProgressBookings, pendingBookings, dateRanges),
            newBookingsVsCancelations: getBookingsVsCancelationsData(filter, confirmedBookings, cancelledBookings, dateRanges),
            guestOver90Kg: processGuestsOver90Kg(guestsOver90Kg),
            funderType: calculateFunderTypes(fundingQaPairs),
            metadata: {
                generatedAt: new Date().toISOString(),
                filter,
                dateRanges
            }
        };

        return res.status(200).json(data);

    } catch (error) {
        console.error('Guest dashboard error:', error);
        return res.status(500).json({ 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

function parseBookingStatuses(statuses) {
    const statusMap = {};
    statuses.forEach(status => {
        try {
            const parsed = JSON.parse(status.value);
            switch(parsed.name) {
                case 'booking_confirmed':
                    statusMap.bookingConfirmedValue = status.value;
                    break;
                case 'in_progress':
                    statusMap.inProgressValue = status.value;
                    break;
                case 'booking_cancelled':
                    statusMap.bookingCancelledValue = status.value;
                    break;
                case 'pending_approval':
                    statusMap.pendingApprovalValue = status.value;
                    break;
            }
        } catch (error) {
            console.error('Error parsing booking status:', error);
        }
    });
    return statusMap;
}

async function getGuestsOver90Kg(confirmedStatus, currentDate) {
    const next14Days = moment(currentDate).add(14, 'days').toDate();
    
    return await Booking.findAll({
        where: {
            preferred_arrival_date: {
                [Op.between]: [currentDate, next14Days]
            },
            status: confirmedStatus,
            deleted_at: null
        },
        include: [
            {
                model: Section,
                required: true,
                include: [
                    {
                        model: QaPair,
                        required: true,
                        where: {
                            question: "Do you weigh more than 90kg? (This information is needed so we can provide the best equipment and care for your stay)",
                            answer: 'Yes'
                        }
                    }
                ]
            }
        ],
        attributes: ['id', 'preferred_arrival_date']
    });
}

function processGuestsOver90Kg(bookings) {
    const results = {
        labels: [],
        details: {
            label: 'Guest over 90 Kg',
            data: []
        }
    };

    bookings.forEach(booking => {
        const date = moment(booking.preferred_arrival_date).format('MMM-DD');
        const index = results.labels.indexOf(date);
        
        if (index === -1) {
            results.labels.push(date);
            results.details.data.push(1);
        } else {
            results.details.data[index]++;
        }
    });

    return results;
}

function calculateFunderTypes(qaPairs) {
    return qaPairs.reduce((acc, pair) => {
        const answer = pair.answer.toLowerCase();
        
        if (answer === 'icare') acc.icare++;
        else if (answer.startsWith('ndia') || answer.startsWith('ndis')) acc.ndis++;
        else if (answer.startsWith('privately') || answer.startsWith('paraquad')) acc.private++;
        else if (answer.startsWith('promotional') || answer.startsWith('applying')) acc.sargood++;
        else if (answer === 'royal') acc.royalRehab++;
        else if (answer === 'other') acc.other++;
        
        return acc;
    }, {
        ndis: 0,
        icare: 0,
        sargood: 0,
        private: 0,
        royalRehab: 0,
        other: 0
    });
}

function getDateRanges(filter) {
    const ranges = {
        currentDate: moment().toDate(),
        periodStart: null,
        periodEnd: null
    };

    switch(filter) {
        case 'Week':
            ranges.periodStart = moment().startOf('week').toDate();
            ranges.periodEnd = moment().endOf('week').toDate();
            break;
        case 'Month':
            ranges.periodStart = moment().startOf('month').toDate();
            ranges.periodEnd = moment().endOf('month').toDate();
            break;
        case 'Quarter':
            ranges.periodStart = moment().startOf('quarter').toDate();
            ranges.periodEnd = moment().endOf('quarter').toDate();
            break;
        case 'Year':
            ranges.periodStart = moment().startOf('year').toDate();
            ranges.periodEnd = moment().endOf('year').toDate();
            break;
    }

    return ranges;
}

function getLabelsByFilter(filter) {
    switch(filter) {
        case 'Week':
            return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        case 'Month':
            return ['1st Week', '2nd Week', '3rd Week', '4th Week', '5th Week'];
        case 'Quarter':
            return ['1st Month', '2nd Month', '3rd Month'];
        case 'Year':
            return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        default:
            return [];
    }
}

function getGuestArrivalData(filter, confirmedBookings, inProgressBookings, pendingBookings, dateRanges) {
    const labels = getLabelsByFilter(filter);
    return {
        labels,
        details: [
            {
                label: 'Confirmed',
                data: countBookingsByPeriod(filter, confirmedBookings, dateRanges, 'confirmed')
            },
            {
                label: 'In Progress',
                data: countBookingsByPeriod(filter, inProgressBookings, dateRanges, 'inprogress')
            },
            {
                label: 'Enquiry',
                data: countBookingsByPeriod(filter, pendingBookings, dateRanges)
            }
        ]
    };
}

function getBookingsVsCancelationsData(filter, confirmedBookings, cancelledBookings, dateRanges) {
    const labels = getLabelsByFilter(filter);
    return {
        labels,
        details: [
            {
                label: 'Bookings',
                data: countBookingsByPeriod(filter, confirmedBookings, dateRanges, 'confirmed')
            },
            {
                label: 'Cancelations',
                data: countBookingsByPeriod(filter, cancelledBookings, dateRanges, 'canceled')
            }
        ]
    };
}

function countBookingsByPeriod(filter, bookings, dateRanges, type = null) {
    const counts = new Array(getLabelsByFilter(filter).length).fill(0);
    
    const filteredBookings = type ? filterBookingsByType(bookings, type, dateRanges) : bookings;
    
    filteredBookings.forEach(booking => {
        try {
            const index = getBookingIndex(booking, filter);
            if (index >= 0 && index < counts.length) {
                counts[index] += type === 'canceled' ? -1 : 1;
            }
        } catch (error) {
            console.error(`Error processing booking ${booking.id}:`, error);
        }
    });

    return counts;
}

function filterBookingsByType(bookings, type, dateRanges) {
    return bookings.filter(booking => {
        try {
            const statusLogs = typeof booking.status_logs === 'string' ? 
                JSON.parse(booking.status_logs) : booking.status_logs;
            
            const typeStatus = statusLogs?.find(sl => sl.status === type);
            return typeStatus && moment(typeStatus.created_at)
                .isBetween(dateRanges.periodStart, dateRanges.periodEnd, null, '[]');
        } catch (error) {
            console.error(`Error filtering booking ${booking.id}:`, error);
            return false;
        }
    });
}

function getBookingIndex(booking, filter) {
    const date = moment(booking.created_at);
    
    switch(filter) {
        case 'Week':
            return date.day();
        case 'Month':
            return Math.floor((date.date() - 1) / 7);
        case 'Quarter':
            return date.month() % 3;
        case 'Year':
            return date.month();
        default:
            return -1;
    }
}