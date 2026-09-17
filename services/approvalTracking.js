import { Booking, FundingApproval, BookingApprovalUsage, Guest } from '../models';
import moment from 'moment';

export class ApprovalTrackingService {
  /**
   * Update approval usage when booking status changes
   * @param {number} bookingId - The booking ID
   * @param {string} newStatus - The new booking status
   * @param {string} oldStatus - The old booking status
   */
  static async updateApprovalUsage(bookingId, newStatus, oldStatus) {
    try {
      const booking = await Booking.findByPk(bookingId, {
        include: [{
          model: Guest,
          as: 'guest'
        }]
      });

      if (!booking || !booking.guest) {
        console.log('Booking or guest not found');
        return;
      }

      const numberOfNights = this.calculateNights(
        booking.preferred_arrival_date,
        booking.preferred_departure_date
      );

      // Handle status transitions
      if (newStatus === 'booking_confirmed' && oldStatus !== 'booking_confirmed') {
        await this.handleBookingConfirmed(booking, numberOfNights);
      } 
      else if (oldStatus === 'booking_confirmed' && newStatus === 'booking_cancelled') {
        await this.handleBookingCancelled(booking, numberOfNights, false);
      }
      else if (oldStatus === 'booking_confirmed' && newStatus === 'booking_late_cancellation') {
        await this.handleBookingCancelled(booking, numberOfNights, true);
      }

    } catch (error) {
      console.error('Error updating approval usage:', error);
      throw error;
    }
  }

  /**
   * Handle booking confirmation - subtract nights from approval(s)
   * Now supports splitting across multiple approvals
   */
  static async handleBookingConfirmed(booking, numberOfNights) {
    const allocations = await this.allocateNightsFromApprovals(
      booking.guest.id,
      numberOfNights,
      booking.preferred_arrival_date,
      booking.preferred_departure_date
    );

    if (!allocations || allocations.length === 0) {
      console.log('No available approvals found for this booking');
      return;
    }

    // Create usage records and update each approval
    for (const allocation of allocations) {
      const [usage, created] = await BookingApprovalUsage.findOrCreate({
        where: {
          booking_id: booking.id,
          funding_approval_id: allocation.approval.id,
          room_type: 'primary'
        },
        defaults: {
          nights_consumed: allocation.nightsToUse,
          status: 'confirmed'
        }
      });

      if (!created) {
        await usage.update({
          nights_consumed: allocation.nightsToUse,
          status: 'confirmed'
        });
      }

      // Update approval nights_used
      await allocation.approval.increment('nights_used', { by: allocation.nightsToUse });

      console.log(`Subtracted ${allocation.nightsToUse} nights from FundingApproval ${allocation.approval.id}`);
    }
  }

  /**
   * Handle booking cancellation - supports multiple approval refunds
   */
  static async handleBookingCancelled(booking, numberOfNights, isLateCancellation) {
    // Find all usage records for this booking
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

    if (!usageRecords || usageRecords.length === 0) {
      console.log('No confirmed usage found for this booking');
      return;
    }

    for (const usage of usageRecords) {
      if (isLateCancellation) {
        // Late cancellation - nights remain subtracted
        await usage.update({ status: 'late_cancelled' });
        console.log(`Late cancellation: ${usage.nights_consumed} nights remain subtracted from FundingApproval ${usage.funding_approval_id}`);
      } else {
        // On-time cancellation - add nights back
        await usage.update({ status: 'cancelled' });
        if (usage.approval) {
          await usage.approval.decrement('nights_used', { by: usage.nights_consumed });
        }
        console.log(`On-time cancellation: Added ${usage.nights_consumed} nights back to FundingApproval ${usage.funding_approval_id}`);
      }
    }
  }

  /**
   * Get all active funding approvals for a guest with their remaining nights.
   * IMPORTANT: Only returns PRIMARY approvals (additional_room_type_id IS NULL).
   * Additional room approvals are manually managed and must never be auto-updated.
   * Ordered by approval_from date (earliest first).
   * @param {number} guestId - The guest ID
   * @param {Date|string|null} checkInDate - Requested stay check-in date (optional)
   * @param {Date|string|null} checkOutDate - Requested stay check-out date (optional)
   * @returns {Object} - Object containing approvals array and total remaining nights
   */
  static async getAllActiveApprovals(guestId, checkInDate = null, checkOutDate = null) {
    const now = moment();
    const stayStart = checkInDate ? moment(checkInDate) : null;
    const stayEnd = checkOutDate ? moment(checkOutDate) : null;

    // Query FundingApproval table - EXCLUDE additional room approvals
    const approvals = await FundingApproval.findAll({
      where: {
        guest_id: guestId,
        status: 'active',
        additional_room_type_id: null  // ← Only primary approvals; additional room approvals are manually managed
      },
      order: [['approval_from', 'ASC']]  // Earliest approval date first
    });

    let totalRemainingNights = 0;
    const approvalsWithRemaining = [];
    
    for (const approval of approvals) {
      // An approval must cover the requested stay window, not just be "not yet expired today".
      // If stay dates are supplied, check the approval's from/to against the ACTUAL stay,
      // not against today's date — otherwise a stay booked months in advance can be confirmed
      // against an approval that will have already expired by the time the guest arrives.
      // Fall back to comparing against `now` only when no stay dates were supplied
      // (preserves behaviour for callers like getApprovalSummary that just want a status snapshot).
      const referenceStart = stayStart || now;
      const referenceEnd = stayEnd || now;

      const expiresBeforeStay = approval.approval_to &&
        moment(approval.approval_to).isBefore(referenceEnd, 'day');
      const notYetStartedForStay = approval.approval_from &&
        referenceStart.isBefore(moment(approval.approval_from), 'day');

      if (expiresBeforeStay) {
        console.log(`⏭️  Skipping approval ${approval.id}: approval_to (${approval.approval_to}) is before stay/reference end (${referenceEnd.format('YYYY-MM-DD')})`);
        continue;
      }
      if (notYetStartedForStay) {
        console.log(`⏭️  Skipping approval ${approval.id}: stay/reference start (${referenceStart.format('YYYY-MM-DD')}) is before approval_from (${approval.approval_from})`);
        continue;
      }

      const nightsApproved = approval.nights_approved || 0;
      const nightsUsed = approval.nights_used || 0;
      const remainingNights = Math.max(0, nightsApproved - nightsUsed);
      
      totalRemainingNights += remainingNights;
      
      approvalsWithRemaining.push({
        approval,
        remainingNights,
        approvalNumber: approval.approval_number,
        approvalName: approval.approval_name,
        approvalFrom: approval.approval_from,
        expiresAt: approval.approval_to,
        nightsApproved,
        nightsUsed
      });
    }

    console.log(`🔍 Found ${approvalsWithRemaining.length} active primary FundingApproval(s) for guest ${guestId} covering stay [${stayStart ? stayStart.format('YYYY-MM-DD') : 'n/a'} - ${stayEnd ? stayEnd.format('YYYY-MM-DD') : 'n/a'}] with ${totalRemainingNights} total nights remaining`);
    
    if (approvalsWithRemaining.length > 0) {
      console.log(`📅 Approval order (by approval_from date):`);
      approvalsWithRemaining.forEach((item, idx) => {
        console.log(`   ${idx + 1}. ID ${item.approval.id} - ${item.approvalNumber || item.approvalName || 'Unnamed'} (${item.approvalFrom} to ${item.expiresAt}) - ${item.remainingNights} nights remaining`);
      });
    }

    return {
      approvals: approvalsWithRemaining,
      totalRemainingNights,
      count: approvalsWithRemaining.length
    };
  }

  /**
 * Allocate nights from multiple approvals in order of earliest approval_from date.
 * Only allocates from PRIMARY approvals (additional room approvals are excluded automatically
 * via getAllActiveApprovals).
 * @param {number} guestId - The guest ID
 * @param {number} nightsNeeded - Number of nights needed
 * @param {Date|string|null} checkInDate - Requested stay check-in date (optional)
 * @param {Date|string|null} checkOutDate - Requested stay check-out date (optional)
 * @returns {Array|null} - Array of allocations [{approval, nightsToUse}] or null if insufficient
 */
static async allocateNightsFromApprovals(guestId, nightsNeeded, checkInDate = null, checkOutDate = null) {
    const { approvals, totalRemainingNights, count } = await this.getAllActiveApprovals(guestId, checkInDate, checkOutDate);

    if (totalRemainingNights < nightsNeeded) {
      console.log(`❌ Insufficient nights covering requested stay: Need ${nightsNeeded}, have ${totalRemainingNights} across ${count} approval(s)`);
      return null;
    }

    const allocations = [];
    let remainingToAllocate = nightsNeeded;

    for (const item of approvals) {
      if (remainingToAllocate <= 0) break;
      
      if (item.remainingNights > 0) {
        const nightsToUse = Math.min(item.remainingNights, remainingToAllocate);
        
        allocations.push({
          approval: item.approval,
          nightsToUse,
          approvalNumber: item.approvalNumber,
          approvalName: item.approvalName,
          approvalFrom: item.approvalFrom
        });
        
        remainingToAllocate -= nightsToUse;
        
        console.log(`📝 Allocating ${nightsToUse} nights from FundingApproval ${item.approval.id} (${item.approvalNumber || item.approvalName || 'Unnamed'}, starts ${item.approvalFrom})`);
      }
    }

    if (remainingToAllocate > 0) {
      console.log(`❌ Could not allocate all nights. Still need ${remainingToAllocate} nights.`);
      return null;
    }

    console.log(`✅ Successfully allocated ${nightsNeeded} nights across ${allocations.length} approval(s)`);
    return allocations;
  }

  /**
   * Find available approvals for a booking (legacy method - now uses allocateNightsFromApprovals)
   * Kept for backwards compatibility but now returns the first approval from allocations
   * @deprecated Use allocateNightsFromApprovals instead for multi-approval support
   */
  static async findAvailableApproval(guestId, nightsNeeded, bookingDate = null) {
    const allocations = await this.allocateNightsFromApprovals(guestId, nightsNeeded, bookingDate, bookingDate);
    
    if (!allocations || allocations.length === 0) {
      return null;
    }

    // Return the first approval for backwards compatibility
    // But log a warning that this method doesn't support multi-approval
    if (allocations.length > 1) {
      console.log(`⚠️  findAvailableApproval called but ${allocations.length} approvals needed. Use allocateNightsFromApprovals for full support.`);
    }

    return allocations[0].approval;
  }

  /**
   * Get consolidated approval summary for a guest.
   * Only includes PRIMARY approvals (additional room approvals excluded).
   * @param {number} guestId - The guest ID
   * @returns {Object} - Summary of all approvals
   */
  static async getApprovalSummary(guestId) {
    const { approvals, totalRemainingNights, count } = await this.getAllActiveApprovals(guestId);

    const totalApproved = approvals.reduce((sum, item) => sum + item.nightsApproved, 0);
    const totalUsed = approvals.reduce((sum, item) => sum + item.nightsUsed, 0);

    return {
      totalApprovals: count,
      totalNightsApproved: totalApproved,
      totalNightsUsed: totalUsed,
      totalNightsRemaining: totalRemainingNights,
      approvals: approvals.map(item => ({
        id: item.approval.id,
        approvalNumber: item.approvalNumber,
        approvalName: item.approvalName,
        nightsApproved: item.nightsApproved,
        nightsUsed: item.nightsUsed,
        nightsRemaining: item.remainingNights,
        approvalFrom: item.approvalFrom,
        expiresAt: item.expiresAt,
        status: item.approval.status
      }))
    };
  }

  /**
   * Calculate number of nights between two dates
   */
  static calculateNights(arrivalDate, departureDate) {
    if (!arrivalDate || !departureDate) return 0;
    
    const arrival = moment(arrivalDate);
    const departure = moment(departureDate);
    
    return Math.max(0, departure.diff(arrival, 'days'));
  }
}