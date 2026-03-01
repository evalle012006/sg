const AuditLogService = require('../services/AuditLogService');

/**
 * Helper to track changes when Q&A pairs are saved in booking forms
 * This can be integrated into the save-qa-pair.js API endpoint
 */
class BookingFormAuditHelper {
  
  /**
   * Map question IDs to action types and categories
   */
  static getQuestionMapping(questionId) {
    const mappings = {
      // Dates
      'check_in_date': { action: 'dates_changed', category: 'Booking Dates' },
      'check_out_date': { action: 'dates_changed', category: 'Booking Dates' },
      
      // Guest Details
      'guest_name': { action: 'guest_details_changed', category: 'Guest Information' },
      'guest_email': { action: 'guest_details_changed', category: 'Guest Information' },
      'guest_phone': { action: 'guest_details_changed', category: 'Guest Information' },
      'emergency_contact': { action: 'guest_details_changed', category: 'Guest Information' },
      
      // Care Requirements
      'care_hours': { action: 'care_hours_changed', category: 'Care Requirements' },
      'care_level': { action: 'care_hours_changed', category: 'Care Requirements' },
      'support_needs': { action: 'care_hours_changed', category: 'Care Requirements' },
      
      // Funding
      'funding_source': { action: 'funding_changed', category: 'Funding' },
      'ndis_plan': { action: 'funding_changed', category: 'Funding' },
      'funding_approval': { action: 'funding_changed', category: 'Funding' },
      
      // Accommodation
      'room_type': { action: 'accommodation_changed', category: 'Accommodation' },
      'room_preference': { action: 'accommodation_changed', category: 'Accommodation' },
      
      // Equipment
      'equipment_selection': { action: 'equipment_changed', category: 'Equipment' },
      'mobility_aids': { action: 'equipment_changed', category: 'Equipment' },
      
      // Courses
      'course_enrollment': { action: 'courses_changed', category: 'Courses' },
      
      // Dietary
      'dietary_requirements': { action: 'dietary_requirements_changed', category: 'Dietary Requirements' },
      'allergies': { action: 'dietary_requirements_changed', category: 'Dietary Requirements' }
    };

    return mappings[questionId] || { action: 'other', category: null };
  }

  /**
   * Track a Q&A pair change
   */
  static async trackQAPairChange({
    bookingId,
    userId,
    userType,
    questionId,
    questionText,
    oldAnswer,
    newAnswer,
    bookingStatus
  }) {
    // Only track changes for submitted bookings (not drafts)
    if (bookingStatus === 'draft') {
      return null;
    }

    // Skip if answer hasn't actually changed
    if (oldAnswer === newAnswer) {
      return null;
    }

    const mapping = this.getQuestionMapping(questionId);
    
    // Format the description
    const description = this.formatChangeDescription({
      questionText,
      oldAnswer,
      newAnswer
    });

    try {
      const auditEntry = await AuditLogService.createAuditEntry({
        bookingId,
        userId,
        actionType: mapping.action,
        userType,
        description,
        oldValue: { [questionId]: oldAnswer },
        newValue: { [questionId]: newAnswer },
        category: mapping.category,
        metadata: {
          question_id: questionId,
          question_text: questionText
        }
      });

      return auditEntry;
    } catch (error) {
      console.error('Error tracking Q&A change:', error);
      // Don't throw - audit logging shouldn't break the main save operation
      return null;
    }
  }

  /**
   * Format change description with strikethrough for old value
   */
  static formatChangeDescription({ questionText, oldAnswer, newAnswer }) {
    if (!oldAnswer || oldAnswer === '') {
      return `${questionText}: ${newAnswer}`;
    }

    // Format with strikethrough for old value
    return `${questionText} changed. ~~${oldAnswer}~~ → ${newAnswer}`;
  }

  /**
   * Track multiple Q&A changes at once (batch update)
   */
  static async trackBatchQAChanges({
    bookingId,
    userId,
    userType,
    changes,
    bookingStatus
  }) {
    if (bookingStatus === 'draft') {
      return [];
    }

    const auditPromises = changes
      .filter(change => change.oldAnswer !== change.newAnswer)
      .map(change => 
        this.trackQAPairChange({
          bookingId,
          userId,
          userType,
          ...change,
          bookingStatus
        })
      );

    const results = await Promise.allSettled(auditPromises);
    
    // Return successful entries, log failures
    return results
      .filter(result => result.status === 'fulfilled')
      .map(result => result.value)
      .filter(entry => entry !== null);
  }

  /**
   * Detect changes between two booking states
   * Useful for amendment processing
   */
  static detectChanges(oldBooking, newBooking) {
    const changes = [];

    // Check dates
    if (oldBooking.check_in !== newBooking.check_in || 
        oldBooking.check_out !== newBooking.check_out) {
      changes.push({
        type: 'dates',
        old: { check_in: oldBooking.check_in, check_out: oldBooking.check_out },
        new: { check_in: newBooking.check_in, check_out: newBooking.check_out }
      });
    }

    // Check care hours
    if (oldBooking.care_hours !== newBooking.care_hours) {
      changes.push({
        type: 'care_hours',
        old: oldBooking.care_hours,
        new: newBooking.care_hours
      });
    }

    // Check status
    if (oldBooking.status !== newBooking.status) {
      changes.push({
        type: 'status',
        old: oldBooking.status,
        new: newBooking.status
      });
    }

    // Add more field comparisons as needed

    return changes;
  }

  /**
   * Create amendment audit trail
   */
  static async logAmendment({
    bookingId,
    userId,
    userType,
    amendmentType,
    changes,
    reason = null
  }) {
    const description = reason 
      ? `Amendment submitted: ${reason}`
      : 'Amendment submitted';

    return await AuditLogService.createAuditEntry({
      bookingId,
      userId,
      actionType: 'amendment_submitted',
      userType,
      description,
      oldValue: changes.old || null,
      newValue: changes.new || null,
      metadata: {
        amendment_type: amendmentType,
        reason
      },
      category: 'Amendment'
    });
  }
}

module.exports = BookingFormAuditHelper;