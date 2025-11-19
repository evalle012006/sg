import { Booking, GuestApproval, BookingApprovalUsage, Guest } from '../models';
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
        await this.handleBookingCancelled(booking, numberOfNights, false); // On-time cancellation
      }
      else if (oldStatus === 'booking_confirmed' && newStatus === 'booking_late_cancellation') {
        await this.handleBookingCancelled(booking, numberOfNights, true); // Late cancellation
      }

    } catch (error) {
      console.error('Error updating approval usage:', error);
      throw error;
    }
  }

  /**
   * Handle booking confirmation - subtract nights from approval
   */
  static async handleBookingConfirmed(booking, numberOfNights) {
    // Find an active approval with available nights
    const approval = await this.findAvailableApproval(
      booking.guest.id,
      numberOfNights,
      booking.preferred_arrival_date
    );

    if (!approval) {
      console.log('No available approval found for this booking');
      return;
    }

    // Create or update usage record
    const [usage, created] = await BookingApprovalUsage.findOrCreate({
      where: {
        booking_id: booking.id,
        guest_approval_id: approval.id,
        room_type: 'primary'
      },
      defaults: {
        nights_consumed: numberOfNights,
        status: 'confirmed'
      }
    });

    if (!created) {
      await usage.update({
        nights_consumed: numberOfNights,
        status: 'confirmed'
      });
    }

    // Update approval nights_used
    await approval.increment('nights_used', { by: numberOfNights });

    console.log(`Subtracted ${numberOfNights} nights from approval ${approval.id}`);
  }

  /**
   * Handle booking cancellation
   */
  static async handleBookingCancelled(booking, numberOfNights, isLateCancellation) {
    const usage = await BookingApprovalUsage.findOne({
      where: {
        booking_id: booking.id,
        room_type: 'primary',
        status: 'confirmed'
      },
      include: [{
        model: GuestApproval,
        as: 'approval'
      }]
    });

    if (!usage) {
      console.log('No confirmed usage found for this booking');
      return;
    }

    if (isLateCancellation) {
      // Late cancellation - nights remain subtracted
      await usage.update({ status: 'late_cancelled' });
      console.log(`Late cancellation: ${numberOfNights} nights remain subtracted from approval ${usage.guest_approval_id}`);
    } else {
      // On-time cancellation - add nights back
      await usage.update({ status: 'cancelled' });
      await usage.approval.decrement('nights_used', { by: usage.nights_consumed });
      console.log(`On-time cancellation: Added ${usage.nights_consumed} nights back to approval ${usage.guest_approval_id}`);
    }
  }

  /**
   * Find an available approval for the guest
   */
  static async findAvailableApproval(guestId, nightsNeeded, bookingDate) {
    const approvals = await GuestApproval.findAll({
      where: {
        guest_id: guestId,
        status: 'active'
      },
      order: [['approval_from', 'ASC']]
    });

    for (const approval of approvals) {
      // Check if approval is valid for the booking date
      if (bookingDate) {
        const bookingMoment = moment(bookingDate);
        const fromDate = moment(approval.approval_from);
        const toDate = moment(approval.approval_to);

        if (!bookingMoment.isBetween(fromDate, toDate, 'day', '[]')) {
          continue;
        }
      }

      // Check if approval has enough nights
      const remainingNights = approval.getRemainingNights();
      if (remainingNights >= nightsNeeded) {
        return approval;
      }
    }

    return null;
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