import { Booking, Setting, sequelize } from '../../../../models';
import { Op } from "sequelize";
import moment from 'moment';

// Constants
const PENDING_APPROVAL_STATUS = JSON.stringify({ name: 'pending_approval', label: 'Pending Approval', color: 'amber' });
const ELIGIBLE_STATUS = JSON.stringify({ name: 'eligible', label: 'Eligible', color: 'green' });
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
        res.setHeader('Expires', new Date(Date.now() + 3600000).toUTCString());
        
        const dates = getDateRanges(filter);

        // Fetch all required data in parallel
        const [
            bookingCancelledStatus,
            bookings
        ] = await Promise.all([
            Setting.findOne({ 
                where: { 
                    attribute: 'booking_status', 
                    value: { [Op.like]: '%booking_cancelled%' } 
                },
                attributes: ['value']
            }),
            Booking.findAll({
                where: {
                    deleted_at: null
                },
                attributes: ['id', 'created_at', 'updated_at', 'status', 'eligibility', 'status_logs', 'complete']
            })
        ]);

        // Filter bookings for different date ranges
        const yearToDateBookings = bookings.filter(booking => 
            moment(booking.created_at).isBetween(dates.yearStart, dates.currentDate, null, '[]')
        );

        const lastQuarterBookings = bookings.filter(booking =>
            moment(booking.created_at).isBetween(
                dates.lastQuarterStart,
                dates.lastQuarterEnd,
                null,
                '[]'
            )
        );

        const lastMonthBookings = bookings.filter(booking =>
            moment(booking.created_at).isBetween(
                dates.lastMonthStart,
                dates.lastMonthEnd,
                null,
                '[]'
            )
        );

        const periodBookings = bookings.filter(booking =>
            moment(booking.created_at).isBetween(dates.periodStart, dates.periodEnd, null, '[]')
        );

        const completedBookings = bookings.filter(booking => booking.complete);

        // After fetching bookings, add this
        // console.log('Total bookings:', bookings.length);
        // console.log('Completed bookings:', completedBookings.length);

        // const bookingsWithLogs = completedBookings.filter(b => b.status_logs != null);
        // let confirmedCount = 0;
        // let amendedCount = 0;
        // let readyToProcessCount = 0;
        // let pendingApprovalCount = 0;

        // bookingsWithLogs.forEach(booking => {
        //     try {
        //         const logs = typeof booking.status_logs === 'string' ? 
        //             JSON.parse(booking.status_logs) : booking.status_logs;
                
        //         if (Array.isArray(logs)) {
        //             if (logs.find(sl => sl.status === 'confirmed')) confirmedCount++;
        //             if (logs.find(sl => sl.status === 'booking_amended')) amendedCount++;
        //             if (logs.find(sl => sl.status === 'ready_to_process' && booking.complete)) readyToProcessCount++;
        //             if (logs.find(sl => sl.status === 'pending_approval' && booking.complete)) pendingApprovalCount++;
        //         }
        //     } catch (e) {
        //         // ignore
        //     }
        // });

        // console.log('Completion status breakdown:');
        // console.log('- Confirmed:', confirmedCount);
        // console.log('- Booking Amended:', amendedCount);
        // console.log('- Ready to Process (complete):', readyToProcessCount);
        // console.log('- Pending Approval (complete):', pendingApprovalCount);
        // console.log('- Using updated_at fallback:', completedBookings.length - bookingsWithLogs.length);

        // const leads = calculateLeadTimes(completedBookings);
        // console.log('Lead times calculated:', leads);
        // console.log('Total in lead times:', leads.zero19 + leads.twenty39 + leads.fourty59 + leads.sixtyPlus);

        // Calculate metrics
        const data = {
            totalBookingsYTD: yearToDateBookings.length,
            bookingLastQuarter: lastQuarterBookings.length,
            bookingsLastMonth: lastMonthBookings.length,
            bookingsCanceledYTD: countCancelledBookings(bookings, dates.yearStart, dates.currentDate, bookingCancelledStatus.value),
            leads: calculateLeadTimes(completedBookings),
            bookings_versus_data: getBookingsVersusData(filter, periodBookings, dates),
            bookings_status_data: getBookingsStatusData(filter, periodBookings, dates),
            metadata: {
                generatedAt: new Date().toISOString(),
                filter,
                dateRanges: {
                    start: dates.periodStart,
                    end: dates.periodEnd
                }
            }
        };

        return res.status(200).json(data);
    } catch (error) {
        console.error('Dashboard data fetch error:', error);
        return res.status(500).json({ 
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}

function getDateRanges(filter) {
    const currentDate = moment().add(1, 'days').format("YYYY-MM-DD"); // Match original query
    const yearStart = moment().startOf('year').format("YYYY-MM-DD");
    
    const previousQuarter = moment().subtract(1, 'Q');
    const lastQuarterStart = previousQuarter.startOf('month').format("YYYY-MM-DD");
    const lastQuarterEnd = previousQuarter.endOf('quarter').format("YYYY-MM-DD");
    
    const previousMonth = moment().subtract(1, 'months');
    const lastMonthStart = previousMonth.startOf('month').format("YYYY-MM-DD");
    const lastMonthEnd = previousMonth.endOf('month').format("YYYY-MM-DD");

    let periodStart, periodEnd;
    switch(filter) {
        case 'Week':
            periodStart = moment().subtract(1, 'weeks').startOf('week').format('YYYY-MM-DD');
            periodEnd = moment().endOf('week').format('YYYY-MM-DD');
            break;
        case 'Month':
            periodStart = moment().subtract(1, 'months').startOf('month').format('YYYY-MM-DD');
            periodEnd = moment().endOf('month').format('YYYY-MM-DD');
            break;
        case 'Quarter':
            periodStart = moment().subtract(1, 'Q').startOf('quarter').format('YYYY-MM-DD');
            periodEnd = moment().endOf('quarter').format('YYYY-MM-DD');
            break;
        case 'Year':
            periodStart = moment().subtract(1, 'years').startOf('year').format('YYYY-MM-DD');
            periodEnd = moment().endOf('year').format('YYYY-MM-DD');
            break;
    }

    return {
        currentDate,
        yearStart,
        lastQuarterStart,
        lastQuarterEnd,
        lastMonthStart,
        lastMonthEnd,
        periodStart,
        periodEnd
    };
}

function countCancelledBookings(bookings, startDate, endDate, cancelledStatus) {
    let count = 0;
    bookings.forEach(booking => {
        try {
            if (booking.status !== cancelledStatus) return;
            
            const statusLogs = typeof booking.status_logs === 'string' ? 
                JSON.parse(booking.status_logs) : booking.status_logs;
            
            const canceledStatus = statusLogs?.find(sl => sl.status === 'canceled');
            if (canceledStatus && moment(canceledStatus.created_at).isBetween(startDate, endDate, null, '[]')) {
                count++;
            }
        } catch (error) {
            console.error(`Error processing cancelled booking ${booking.id}:`, error);
        }
    });
    return count;
}

function calculateLeadTimes(completedBookings) {
    return completedBookings.reduce((acc, booking) => {
        try {
            const createdDate = moment(booking.created_at);
            let completionDate = null;
            
            // Try to get completion date from status_logs first
            let statusLogs = booking.status_logs;
            
            if (statusLogs) {
                // Parse if it's a string
                if (typeof statusLogs === 'string') {
                    try {
                        statusLogs = JSON.parse(statusLogs);
                    } catch (e) {
                        statusLogs = null;
                    }
                }
                
                // Look for completion statuses
                if (Array.isArray(statusLogs) && statusLogs.length > 0) {
                    const completionStatus = statusLogs.find(sl => 
                        sl.status === 'confirmed' || 
                        sl.status === 'booking_amended' ||
                        (sl.status === 'ready_to_process' && booking.complete === true) ||
                        (sl.status === 'pending_approval' && booking.complete === true)
                    );
                    
                    if (completionStatus && completionStatus.created_at) {
                        completionDate = moment(completionStatus.created_at);
                    }
                }
            }
            
            // Fallback: use updated_at if no status_logs found
            if (!completionDate && booking.updated_at) {
                completionDate = moment(booking.updated_at);
            }
            
            // Calculate lead time if we have a completion date
            if (completionDate) {
                const noOfDays = completionDate.diff(createdDate, 'days');

                if (noOfDays <= 19) acc.zero19++;
                else if (noOfDays <= 39) acc.twenty39++;
                else if (noOfDays <= 59) acc.fourty59++;
                else acc.sixtyPlus++;
            }
        } catch (error) {
            console.error(`Error processing booking ${booking.id}:`, error);
        }
        
        return acc;
    }, { zero19: 0, twenty39: 0, fourty59: 0, sixtyPlus: 0 });
}

function getBookingsVersusData(filter, bookings, dates) {
    const periodBookings = groupBookingsByPeriod(filter, bookings, dates);
    const prevPeriodBookings = groupBookingsByPeriod(filter, bookings, dates, true);

    return {
        labels: getLabelsByFilter(filter),
        details: [
            {
                label: `Previous ${filter}`,
                data: prevPeriodBookings
            },
            {
                label: `Current ${filter}`,
                data: periodBookings
            }
        ]
    };
}

function getBookingsStatusData(filter, bookings, dates) {
    return {
        labels: getLabelsByFilter(filter),
        details: [
            {
                label: 'Enquiries',
                data: groupBookingsByPeriod(filter, 
                    bookings.filter(b => b.status === PENDING_APPROVAL_STATUS),
                    dates
                )
            },
            {
                label: 'Eligible',
                data: groupBookingsByPeriod(filter, 
                    bookings.filter(b => b.eligibility === ELIGIBLE_STATUS),
                    dates
                )
            },
            {
                label: 'Bookings',
                data: groupBookingsByPeriod(filter, bookings, dates)
            }
        ]
    };
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

function groupBookingsByPeriod(filter, bookings, dates, isPrevious = false) {
    const getStartOfPeriod = (date) => {
        switch(filter) {
            case 'Week':
                return moment(date).startOf('week');
            case 'Month':
                return moment(date).startOf('month');
            case 'Quarter':
                return moment(date).startOf('quarter');
            case 'Year':
                return moment(date).startOf('year');
            default:
                return moment(date);
        }
    };

    const labels = getLabelsByFilter(filter);
    const counts = new Array(labels.length).fill(0);

    bookings.forEach(booking => {
        try {
            const bookingDate = moment(booking.created_at);
            let index = -1;

            switch(filter) {
                case 'Week':
                    index = bookingDate.day();
                    break;
                case 'Month':
                    index = Math.floor((bookingDate.date() - 1) / 7);
                    break;
                case 'Quarter':
                    index = bookingDate.month() % 3;
                    break;
                case 'Year':
                    index = bookingDate.month();
                    break;
            }

            if (index >= 0 && index < counts.length) {
                counts[index]++;
            }
        } catch (error) {
            console.error(`Error processing booking ${booking.id}:`, error);
        }
    });

    return counts;
}