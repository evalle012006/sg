const { BookingAuditLog } = require("../models");


class AuditLogService {
  /**
   * Create a new audit log entry
   */
  static async createAuditEntry({
    bookingId,
    userId = null,
    guestId = null,
    actionType,
    userType,
    description,
    oldValue = null,
    newValue = null,
    metadata = null,
    isInternalNote = false,
    category = null
  }) {
    try {
      // Validation: Must have either userId OR guestId
      if (!userId && !guestId) {
        console.warn('⚠️ Audit log created without userId or guestId');
      }

      // Validation: Don't allow both userId and guestId (pick one)
      if (userId && guestId) {
        console.warn('⚠️ Both userId and guestId provided, prioritizing based on userType');
        if (userType === 'admin') {
          guestId = null;
        } else {
          userId = null;
        }
      }

      const auditEntry = await BookingAuditLog.create({
        booking_id: bookingId,
        user_id: userId,
        guest_id: guestId,
        action_type: actionType,
        user_type: userType,
        description: description,
        old_value: oldValue,
        new_value: newValue,
        metadata: metadata,
        is_internal_note: isInternalNote,
        category: category
      });

      console.log(`✅ Audit log created: ${actionType} by ${userType} for booking ${bookingId}`);
      return auditEntry;
    } catch (error) {
      console.error('Error creating audit log entry:', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a booking
   */
  static async getBookingAuditLog(bookingId, options = {}) {
    try {
      const {
        limit = 50,
        offset = 0,
        actionType = null,
        category = null,
        includeInternal = false,
        userType = null
      } = options;

      const where = { booking_id: bookingId };
      
      if (actionType) {
        where.action_type = actionType;
      }
      
      if (category) {
        where.category = category;
      }
      
      if (!includeInternal) {
        where.is_internal_note = false;
      }

      if (userType) {
        where.user_type = userType;
      }

      const logs = await BookingAuditLog.findAll({
        where,
        include: [
          {
            association: 'user',  // ✅ FIXED: lowercase 'user'
            attributes: ['id', 'first_name', 'last_name', 'email']
          },
          {
            association: 'guest',  // ✅ FIXED: lowercase 'guest'
            attributes: ['id', 'first_name', 'last_name', 'email']
          }
        ],
        order: [['created_at', 'DESC']],
        limit,
        offset
      });

      return logs;
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      throw error;
    }
  }

  /**
   * Helper method to log status changes
   */
  static async logStatusChange({
    bookingId,
    userId = null,
    guestId = null,
    userType,
    oldStatus,
    newStatus,
    reason = null
  }) {
    return this.createAuditEntry({
      bookingId,
      userId,
      guestId,
      actionType: 'status_changed',
      userType,
      description: `Status changed from ${oldStatus} to ${newStatus}${reason ? ': ' + reason : ''}`,
      oldValue: { status: oldStatus },
      newValue: { status: newStatus },
      category: 'Status',
      metadata: { reason }
    });
  }

  /**
   * Helper method to log date changes
   */
  static async logDateChange({
    bookingId,
    userId = null,
    guestId = null,
    userType,
    oldDates,
    newDates
  }) {
    return this.createAuditEntry({
      bookingId,
      userId,
      guestId,
      actionType: 'dates_changed',
      userType,
      description: `Dates changed from ${oldDates.check_in} - ${oldDates.check_out} to ${newDates.check_in} - ${newDates.check_out}`,
      oldValue: oldDates,
      newValue: newDates,
      category: 'Dates'
    });
  }

  /**
   * Helper method to log accommodation changes
   */
  static async logAccommodationChange({
    bookingId,
    userId = null,
    guestId = null,
    userType,
    oldAccommodation,
    newAccommodation
  }) {
    return this.createAuditEntry({
      bookingId,
      userId,
      guestId,
      actionType: 'accommodation_changed',
      userType,
      description: `Accommodation changed from ${oldAccommodation} to ${newAccommodation}`,
      oldValue: { accommodation: oldAccommodation },
      newValue: { accommodation: newAccommodation },
      category: 'Accommodation'
    });
  }

  /**
   * Helper method to log care hours changes
   */
  static async logCareHoursChange({
    bookingId,
    userId = null,
    guestId = null,
    userType,
    oldHours,
    newHours
  }) {
    return this.createAuditEntry({
      bookingId,
      userId,
      guestId,
      actionType: 'care_hours_changed',
      userType,
      description: `Care hours changed from ${oldHours} to ${newHours}`,
      oldValue: { hours: oldHours },
      newValue: { hours: newHours },
      category: 'Care'
    });
  }

  /**
   * Helper method to log course changes
   */
  static async logCourseChange({
    bookingId,
    userId = null,
    guestId = null,
    userType,
    courseName,
    action
  }) {
    return this.createAuditEntry({
      bookingId,
      userId,
      guestId,
      actionType: 'course_changed',
      userType,
      description: `${action === 'added' ? 'Added' : 'Removed'} course: ${courseName}`,
      oldValue: action === 'removed' ? { course: courseName } : null,
      newValue: action === 'added' ? { course: courseName } : null,
      category: 'Courses',
      metadata: { action }
    });
  }
}

module.exports = AuditLogService;