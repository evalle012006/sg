/**
 * System Trigger Data Provider
 * 
 * Provides data for system email triggers based on the trigger context.
 * Each context has a dedicated method that extracts and formats the
 * relevant data for email template rendering.
 */

import moment from 'moment';
import EmailRecipientsService from './email/EmailRecipientsService.js';
import { Course } from '../models';

class SystemTriggerDataProvider {
  /**
   * Get data for a specific trigger context
   * @param {string} context - The trigger context (e.g., 'booking_status_changed')
   * @param {Object} eventData - The event-specific data
   * @returns {Promise<Object>} - Formatted data for email templates
   */
  static async getDataForContext(context, eventData) {
    switch (context) {
      case 'booking_status_changed':
        return await this.getBookingStatusChangedData(eventData);
      
      case 'booking_submitted':
        return await this.getBookingSubmittedData(eventData);
      
      case 'booking_confirmed':
        return await this.getBookingConfirmedData(eventData);
      
      case 'booking_cancelled':
        return await this.getBookingCancelledData(eventData);
      
      case 'booking_amended':
        return await this.getBookingAmendedData(eventData);
      
      case 'icare_funding_updated':
        return await this.getIcareFundingUpdatedData(eventData);
      
      case 'course_eoi_submitted':
        return await this.getCourseEoiSubmittedData(eventData);
      
      case 'course_eoi_accepted':
        return await this.getCourseEoiAcceptedData(eventData);
      
      case 'course_offer_sent':
        return await this.getCourseOfferSentData(eventData);
      
      case 'account_created':
        return await this.getAccountCreatedData(eventData);
      
      case 'password_reset_requested':
        return await this.getPasswordResetData(eventData);
      
      case 'email_verification_requested':
        return await this.getEmailVerificationData(eventData);
      
      case 'guest_profile_updated':
        return await this.getGuestProfileUpdatedData(eventData);
      
      default:
        console.warn(`⚠️ Unknown trigger context: ${context}`);
        return eventData; // Return raw data as fallback
    }
  }

  /**
   * Booking Status Changed Data
   */
  static async getBookingStatusChangedData(eventData) {
    const { booking, old_status, new_status, access_token } = eventData;
    
    // Get admin email from settings
    const adminEmail = await EmailRecipientsService.getRecipientsString('info');
    
    // Format dates
    const arrivalDate = booking.preferred_arrival_date 
      ? moment(booking.preferred_arrival_date).format('DD-MM-YYYY') 
      : '-';
    const departureDate = booking.preferred_departure_date 
      ? moment(booking.preferred_departure_date).format('DD-MM-YYYY') 
      : '-';
    
    // Get room types if available
    let roomTypes = '-';
    let firstRoomType = '-';
    if (booking.BookedRooms && booking.BookedRooms.length > 0) {
      const unique = new Set();
      booking.BookedRooms.forEach(br => {
        if (br.room && br.room.RoomType) {
          unique.add(`${br.room.room_number} - ${br.room.RoomType.name}`);
          if (firstRoomType === '-') {
            firstRoomType = br.room.RoomType.name;
          }
        }
      });
      roomTypes = [...unique].join(', ');
    }
    
    // Fallback: try booking.Rooms if BookedRooms doesn't exist
    if (roomTypes === '-' && booking.Rooms && booking.Rooms.length > 0) {
      const firstRoom = booking.Rooms[0];
      if (firstRoom.RoomType) {
        firstRoomType = firstRoom.RoomType.name;
        roomTypes = firstRoomType;
      }
    }
    
    // Get booking package
    let bookingPackage = '-';
    if (booking.SelectedPackage && booking.SelectedPackage.Package) {
      bookingPackage = booking.SelectedPackage.Package.name;
    }
    
    // Check if first time guest
    const isFirstTimeGuest = booking.type === 'First Time Guest' || booking.type === 'Enquiry';
    
    // Check if iCare funded
    const icareFunded = booking.funding_source?.toLowerCase().includes('icare') || false;
    
    return {
      // Booking identifiers
      booking_id: booking.id,
      booking_uuid: booking.uuid,
      booking_reference_id: booking.reference_id || booking.id,
      booking_reference: booking.reference_id || booking.uuid || booking.id, // ✨ ALIAS
      
      // Guest data
      guest_email: booking.Guest.email,
      guest_name: `${booking.Guest.first_name} ${booking.Guest.last_name}`,
      guest_first_name: booking.Guest.first_name,
      guest_last_name: booking.Guest.last_name,
      
      // ✨ ALIASES - Email templates often use these shorter names
      first_name: booking.Guest.first_name,
      last_name: booking.Guest.last_name,
      email: booking.Guest.email,
      
      // Dates
      arrival_date: arrivalDate,
      departure_date: departureDate,
      arrival_date_raw: booking.preferred_arrival_date,
      departure_date_raw: booking.preferred_departure_date,
      
      // ✨ ALIASES - Common date field names
      checkin_date: arrivalDate,
      checkout_date: departureDate,
      check_in_date: arrivalDate,
      check_out_date: departureDate,
      
      // Status data
      old_status: old_status?.name || old_status,
      new_status: new_status?.name || new_status,
      old_status_value: old_status?.value || old_status,
      new_status_value: new_status?.value || new_status,
      
      // Booking details
      room_types: roomTypes,
      booking_package: bookingPackage,
      is_first_time_guest: isFirstTimeGuest,
      
      // ✨ ALIASES - Common field names for room and package
      room_type: firstRoomType,
      accommodation: firstRoomType,
      package_type: bookingPackage,
      package_name: bookingPackage,
      package: bookingPackage,
      
      // ✨ iCare funding flag (used by email template)
      icare_funded: icareFunded,
      
      // URLs
      booking_pdf_url: booking.pdf_url || null,
      set_password_link: access_token 
        ? `${process.env.APP_URL}/auth/onboarding/set-new-password?token=${access_token.token}`
        : null,
      
      // Admin
      admin_email: adminEmail || 'info@sargoodoncollaroy.com.au',
    };
  }

  /**
   * Booking Submitted Data
   */
  static async getBookingSubmittedData(eventData) {
    const { booking } = eventData;
    
    // Get all QA pairs from booking sections
    const qaPairs = {};
    let courseId = null;
    let courseName = null;
    
    if (booking.Sections) {
      booking.Sections.forEach(section => {
        if (section.QaPairs) {
          section.QaPairs.forEach(qa => {
            if (qa.Question && qa.Question.question_key) {
              qaPairs[qa.Question.question_key] = qa.answer;
              
              // ✨ Check if this is a course reference
              if (qa.Question.question_key.includes('course') && 
                  qa.answer && 
                  /^\d+$/.test(qa.answer.toString().trim())) {
                courseId = parseInt(qa.answer);
              }
            }
          });
        }
      });
    }
    
    // ✨ Resolve course ID to course name
    if (courseId) {
      try {
        const courseData = await Course.findByPk(courseId, {
          attributes: ['id', 'title', 'start_date', 'end_date']
        });
        
        if (courseData) {
          courseName = courseData.title;
          console.log(`✅ Resolved course ${courseId} → "${courseName}"`);
        }
      } catch (error) {
        console.error('⚠️ Error resolving course:', error);
      }
    }
    
    return {
      booking_id: booking.id,
      booking_uuid: booking.uuid,
      guest_email: booking.Guest.email,
      guest_name: `${booking.Guest.first_name} ${booking.Guest.last_name}`,
      guest_first_name: booking.Guest.first_name,
      guest_last_name: booking.Guest.last_name,
      arrival_date: booking.preferred_arrival_date 
        ? moment(booking.preferred_arrival_date).format('DD-MM-YYYY') 
        : '-',
      departure_date: booking.preferred_departure_date 
        ? moment(booking.preferred_departure_date).format('DD-MM-YYYY') 
        : '-',
      
      // ✨ Course data with both ID and name
      course_id: courseId || null,
      course_name: courseName || courseId || null, // Fallback to ID if name not found
      course_title: courseName || null,
      
      // Include all QA pairs for question-based conditions
      qa_pairs: qaPairs,
    };
  }

  /**
   * Booking Confirmed Data
   */
  static async getBookingConfirmedData(eventData) {
    return await this.getBookingStatusChangedData({
      ...eventData,
      new_status: { name: 'booking_confirmed' }
    });
  }

  /**
   * Booking Cancelled Data
   */
  static async getBookingCancelledData(eventData) {
    const { booking, cancellation_type, cancelled_by } = eventData;
    
    const baseData = await this.getBookingStatusChangedData({
      ...eventData,
      new_status: { name: 'booking_cancelled' }
    });
    
    return {
      ...baseData,
      cancellation_type: cancellation_type || 'no_charge',
      cancelled_by: cancelled_by || 'admin',
    };
  }

  /**
   * Booking Amended Data
   */
  static async getBookingAmendedData(eventData) {
    const { booking, changes } = eventData;
    
    const baseData = await this.getBookingStatusChangedData(eventData);
    
    // Build changes summary
    let changesSummary = [];
    if (changes) {
      if (changes.dates) {
        changesSummary.push(`Dates: ${changes.dates.old} → ${changes.dates.new}`);
      }
      if (changes.accommodation) {
        changesSummary.push(`Accommodation: ${changes.accommodation.old} → ${changes.accommodation.new}`);
      }
      if (changes.care_hours) {
        changesSummary.push(`Care Hours: ${changes.care_hours.old} → ${changes.care_hours.new}`);
      }
    }
    
    return {
      ...baseData,
      old_arrival_date: changes?.dates?.old_arrival || baseData.arrival_date,
      new_arrival_date: changes?.dates?.new_arrival || baseData.arrival_date,
      old_departure_date: changes?.dates?.old_departure || baseData.departure_date,
      new_departure_date: changes?.dates?.new_departure || baseData.departure_date,
      changes_summary: changesSummary.join(', ') || 'Booking details updated',
    };
  }

  /**
   * iCare Funding Updated Data
   */
  static async getIcareFundingUpdatedData(eventData) {
    const {
      guest,
      allocation_summary,
      booking_details,
      cancellation_type,
      total_nights_lost
    } = eventData;
    
    // Build allocation details text
    const allocationDetails = allocation_summary.map(a => 
      `• ${a.approvalNumber || a.approvalName || 'Approval'}: ${a.nightsUsedThisBooking || a.nightsLost} nights, ${a.remainingNights} remaining`
    ).join('\n');
    
    // Determine approval period
    let approvalFrom = '-';
    let approvalTo = '-';
    
    if (allocation_summary.length === 1) {
      approvalFrom = allocation_summary[0].approvalFrom 
        ? moment(allocation_summary[0].approvalFrom).format('DD MMM YYYY') 
        : '-';
      approvalTo = allocation_summary[0].approvalTo 
        ? moment(allocation_summary[0].approvalTo).format('DD MMM YYYY') 
        : '-';
    } else if (allocation_summary.length > 1) {
      const allDates = allocation_summary.map(a => ({
        from: a.approvalFrom ? new Date(a.approvalFrom) : null,
        to: a.approvalTo ? new Date(a.approvalTo) : null
      })).filter(d => d.from && d.to);
      
      if (allDates.length > 0) {
        const earliestFrom = new Date(Math.min(...allDates.map(d => d.from.getTime())));
        const latestTo = new Date(Math.max(...allDates.map(d => d.to.getTime())));
        approvalFrom = moment(earliestFrom).format('DD MMM YYYY');
        approvalTo = moment(latestTo).format('DD MMM YYYY');
      }
    }
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      approval_number: allocation_summary.map(a => a.approvalNumber).join(', ') || 'Multiple approvals',
      nights_approved: allocation_summary.reduce((sum, a) => sum + (a.totalNightsApproved || 0), 0),
      nights_used: allocation_summary.reduce((sum, a) => sum + (a.totalNightsUsed || 0), 0),
      nights_remaining: allocation_summary.reduce((sum, a) => sum + a.remainingNights, 0),
      nights_requested: booking_details?.nightsRequested || 0,
      allocation_details: allocationDetails,
      approval_from: approvalFrom,
      approval_to: approvalTo,
      cancellation_type: cancellation_type || 'allocation',
      nights_lost: total_nights_lost || 0,
    };
  }

  /**
   * Course EOI Submitted Data
   */
  static async getCourseEoiSubmittedData(eventData) {
    const { guest, course, eoi_details } = eventData;
    
    const adminEmail = await EmailRecipientsService.getRecipientsString('info');
    
    // ✨ Handle if course is an ID instead of an object
    let courseData = course;
    if (typeof course === 'number' || /^\d+$/.test(String(course))) {
      try {
        courseData = await Course.findByPk(course, {
          attributes: ['id', 'title', 'start_date', 'end_date']
        });
      } catch (error) {
        console.error('⚠️ Error loading course:', error);
        courseData = { title: `Course ${course}`, date: null };
      }
    }
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      course_id: courseData?.id || course,
      course_name: courseData?.title || courseData?.name || 'Unknown Course',
      course_title: courseData?.title || courseData?.name || 'Unknown Course',
      course_date: courseData?.date || courseData?.start_date 
        ? moment(courseData.date || courseData.start_date).format('DD-MM-YYYY') 
        : '-',
      eoi_details: eoi_details || '',
      admin_email: adminEmail || 'info@sargoodoncollaroy.com.au',
    };
  }

  /**
   * Course EOI Accepted Data
   */
  static async getCourseEoiAcceptedData(eventData) {
    const { guest, course } = eventData;
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      course_name: course.name,
      course_date: course.date ? moment(course.date).format('DD-MM-YYYY') : '-',
    };
  }

  /**
   * Course Offer Sent Data
   */
  static async getCourseOfferSentData(eventData) {
    const { guest, course, course_details } = eventData;
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      course_name: course.name,
      course_date: course.date ? moment(course.date).format('DD-MM-YYYY') : '-',
      course_details: course_details || '',
    };
  }

  /**
   * Account Created Data
   */
  static async getAccountCreatedData(eventData) {
    const { guest, access_token, verification_token } = eventData;
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      guest_first_name: guest.first_name,
      set_password_link: access_token 
        ? `${process.env.APP_URL}/auth/onboarding/set-new-password?token=${access_token.token}`
        : null,
      verification_link: verification_token
        ? `${process.env.APP_URL}/auth/verify-email?token=${verification_token}`
        : null,
    };
  }

  /**
   * Password Reset Data
   */
  static async getPasswordResetData(eventData) {
    const { guest, reset_token } = eventData;
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      reset_link: `${process.env.APP_URL}/auth/reset-password?token=${reset_token}`,
      reset_token: reset_token,
    };
  }

  /**
   * Email Verification Data
   */
  static async getEmailVerificationData(eventData) {
    const { guest_email, verification_token } = eventData;
    
    return {
      guest_email: guest_email,
      verification_link: `${process.env.APP_URL}/auth/verify-email?token=${verification_token}`,
      verification_token: verification_token,
    };
  }

  /**
   * Guest Profile Updated Data
   */
  static async getGuestProfileUpdatedData(eventData) {
    const { guest, profile_summary } = eventData;
    
    return {
      guest_email: guest.email,
      guest_name: `${guest.first_name} ${guest.last_name}`,
      profile_summary: profile_summary || 'Your profile has been updated',
    };
  }

  /**
   * Helper: Determine recipient based on trigger configuration
   */
  static async determineRecipient(trigger, contextData) {
    // Handle recipient_type: pattern (e.g., 'recipient_type:info', 'recipient_type:admin')
    if (trigger.recipient && trigger.recipient.startsWith('recipient_type:')) {
      const recipientType = trigger.recipient.split(':')[1];
      try {
        const recipients = await EmailRecipientsService.getRecipientsString(recipientType);
        if (!recipients) {
          console.warn(`⚠️ No recipients configured for type: ${recipientType}`);
          return null;
        }
        return recipients;
      } catch (error) {
        console.error(`❌ Failed to get recipients for type ${recipientType}:`, error);
        return null;
      }
    }
    
    // If trigger has explicit recipient (email address), use it
    if (trigger.recipient && trigger.recipient !== 'context_based') {
      return trigger.recipient;
    }
    
    // Otherwise use context-based recipient
    switch (trigger.type) {
      case 'internal':
        return trigger.recipient || contextData.admin_email;
      
      case 'external':
        // For external triggers, look for the email in the context data
        if (trigger.recipient_field) {
          return contextData[trigger.recipient_field];
        }
        return contextData.guest_email;
      
      case 'system':
        // For system triggers, default to guest_email unless specified otherwise
        return contextData.guest_email || trigger.recipient;
      
      default:
        return contextData.guest_email;
    }
  }
}

export default SystemTriggerDataProvider;