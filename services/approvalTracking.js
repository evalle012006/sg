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
      numberOfNights
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
   * Get all active funding approvals for a guest with their remaining nights
   * Ordered by approval_from date (earliest first)
   * @param {number} guestId - The guest ID
   * @returns {Object} - Object containing approvals array and total remaining nights
   */
  static async getAllActiveApprovals(guestId) {
    const now = moment();
    
    // Query FundingApproval table - ordered by approval_from (earliest first)
    const approvals = await FundingApproval.findAll({
      where: {
        guest_id: guestId,
        status: 'active'
      },
      order: [['approval_from', 'ASC']]  // Earliest approval date first
    });

    let totalRemainingNights = 0;
    const approvalsWithRemaining = [];
    
    for (const approval of approvals) {
      // Skip expired approvals (approval_to is in the past)
      const isExpired = approval.approval_to && moment(approval.approval_to).isBefore(now, 'day');
      if (isExpired) {
        console.log(`⏭️  Skipping expired approval ${approval.id} (expired: ${approval.approval_to})`);
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

    console.log(`🔍 Found ${approvalsWithRemaining.length} active (non-expired) FundingApproval(s) for guest ${guestId} with ${totalRemainingNights} total nights remaining`);
    
    // Log the order for debugging
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
   * Allocate nights from multiple approvals in order of earliest approval_from date
   * @param {number} guestId - The guest ID
   * @param {number} nightsNeeded - Number of nights needed
   * @returns {Array|null} - Array of allocations [{approval, nightsToUse}] or null if insufficient
   */
  static async allocateNightsFromApprovals(guestId, nightsNeeded) {
    const { approvals, totalRemainingNights, count } = await this.getAllActiveApprovals(guestId);

    // Check if total nights across all approvals is sufficient
    if (totalRemainingNights < nightsNeeded) {
      console.log(`❌ Insufficient nights: Need ${nightsNeeded}, have ${totalRemainingNights} across ${count} approval(s)`);
      return null;
    }

    const allocations = [];
    let remainingToAllocate = nightsNeeded;

    // Allocate from approvals in order (earliest approval_from first)
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
    const allocations = await this.allocateNightsFromApprovals(guestId, nightsNeeded);
    
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
   * Get consolidated approval summary for a guest
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