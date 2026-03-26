import moment from 'moment';

/**
 * ✅ GLOBAL Email Data Parsing Service
 *
 * Parses data from various database tables into email merge tag format.
 * Each table/entity has its own parsing method for clean separation.
 *
 * ── Enrich methods ───────────────────────────────────────────────────────────
 * Course and Package have NO direct Booking FK in models/index.js.
 * They are stored as QaPair answers:
 *
 *   question_type = 'package-selection'                        → answer = package_id  (e.g. "6")
 *   question_type = 'horizontal-card' + option_type = 'course' → answer = course_id  (e.g. "2")
 *
 * FundingApproval also has NO direct Booking FK — it belongs to Guest.
 * getFullBookingData() includes it nested under Guest (as 'fundingApprovals').
 * parseAllData() reads it from bookingData.Guest?.fundingApprovals.
 *
 * enrichPackageData / enrichCourseData resolve IDs from QaPairs, fetch the record,
 * and attach it via booking.setDataValue() so parseAllData() sees it naturally.
 *
 * ── Answer helpers ───────────────────────────────────────────────────────────
 *   - formatAnswerForDisplay()  — always a plain string, safe for {{tag}}
 *   - formatAnswerForEmail()    — preserves arrays/objects for Handlebars #each
 *   - answersMatch()            — service-cards, strings, arrays, JSON, comma-sep
 *   - findQaPairWithFallback()  — 5-step: id → key → exact → case-insensitive → partial
 */
class EmailDataParsingService {

  // ═══════════════════════════════════════════════════════════════════════════
  // ENRICH METHODS
  // Resolve entity records from QaPair ID answers and attach to booking object.
  // Called by BookingEmailDataService.getFullBookingData() after the DB fetch.
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Convenience: run all enrich steps for a booking in one call.
   *
   * @param {Object} booking  - Booking Sequelize instance
   * @param {Array}  qaPairs  - Flat QaPair array (with Question included)
   */
  static async enrichBookingData(booking, qaPairs = []) {
    await this.enrichPackageData(booking, qaPairs);
    await this.enrichCourseData(booking, qaPairs);
  }

  /**
   * Resolve Package from a 'package-selection' QaPair answer and attach to booking.
   *
   * Finds the QaPair where question_type = 'package-selection'.
   * Answer is a numeric package_id → fetches Package → booking.setDataValue('Package', record).
   *
   * @param {Object} booking  - Booking instance (mutated via setDataValue)
   * @param {Array}  qaPairs  - Flat QaPair array (with Question included)
   */
  static async enrichPackageData(booking, qaPairs) {
    const packageQa = qaPairs.find(
      qa => (qa.Question?.type ?? qa.question_type) === 'package-selection'
    );

    if (!packageQa?.answer) return;

    const packageId = parseInt(packageQa.answer, 10);
    if (isNaN(packageId)) {
      console.warn(`⚠️ enrichPackageData: non-numeric answer "${packageQa.answer}" — skipping`);
      return;
    }

    try {
      const { Package } = await import('../models/index.js');
      const record = await Package.findByPk(packageId);
      if (record) {
        booking.setDataValue('Package', record);
        console.log(`  ✅ enrichPackageData: Package #${packageId} (${record.name})`);
      } else {
        console.warn(`  ⚠️ enrichPackageData: Package #${packageId} not found`);
      }
    } catch (err) {
      console.error(`  ❌ enrichPackageData:`, err.message);
    }
  }

  /**
   * Resolve Course from a QaPair answer and attach to booking.
   *
   * Finds a QaPair where:
   *   question_type = 'horizontal-card'  AND  option_type = 'course'
   *
   * The answer is a numeric course_id. Non-numeric slugs ("icare", "ndis") are
   * funder selections — filtered out by the option_type = 'course' guard.
   *
   * @param {Object} booking  - Booking instance (mutated via setDataValue)
   * @param {Array}  qaPairs  - Flat QaPair array (with Question included)
   */
  static async enrichCourseData(booking, qaPairs) {
    const courseQa = qaPairs.find(qa => {
      const type       = qa.Question?.type       ?? qa.question_type;
      const optionType = qa.Question?.option_type ?? qa.option_type;
      if (type !== 'horizontal-card' && optionType !== 'course') return false;
      return qa.answer !== null && qa.answer !== undefined && !isNaN(parseInt(qa.answer, 10));
    });

    if (!courseQa?.answer) return;

    const courseId = parseInt(courseQa.answer, 10);

    try {
      const { Course } = await import('../models/index.js');
      const record = await Course.findByPk(courseId);
      if (record) {
        booking.setDataValue('Course', record);
        console.log(`  ✅ enrichCourseData: Course #${courseId} (${record.title})`);
      } else {
        console.warn(`  ⚠️ enrichCourseData: Course #${courseId} not found`);
      }
    } catch (err) {
      console.error(`  ❌ enrichCourseData:`, err.message);
    }
  }

  /**
   * Fetch a Guest by ID and attach to booking.
   *
   * Used when a guest_id is known but the Guest relation wasn't eagerly loaded.
   *
   * @param {Object} booking  - Booking instance (mutated via setDataValue)
   * @param {Number} guestId  - Guest primary key
   */
  static async enrichGuestData(booking, guestId) {
    if (!guestId) return;
    try {
      const { Guest } = await import('../models/index.js');
      const record = await Guest.findByPk(guestId);
      if (record) {
        booking.setDataValue('Guest', record);
        console.log(`  ✅ enrichGuestData: Guest #${guestId}`);
      }
    } catch (err) {
      console.error(`  ❌ enrichGuestData:`, err.message);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseBookingData(booking) {
    if (!booking) return {};

    return {
      booking_reference: booking.reference_id || '',
      booking_status: booking.status || '',
      booking_status_name: booking.status_name || '',
      booking_type: booking.type || '',
      booking_name: booking.name || '',

      alternate_contact_name: booking.alternate_contact_name || '',
      alternate_contact_number: booking.alternate_contact_number || '',

      type_of_spinal_injury: booking.type_of_spinal_injury || '',

      preferred_arrival_date: booking.preferred_arrival_date
        ? moment(booking.preferred_arrival_date).format('DD/MM/YYYY')
        : '',
      preferred_departure_date: booking.preferred_departure_date
        ? moment(booking.preferred_departure_date).format('DD/MM/YYYY')
        : '',

      eligibility: booking.eligibility || '',
      eligibility_name: booking.eligibility_name || '',

      notes: booking.notes || '',
      checklist_notes: booking.checklist_notes || '',

      late_arrival: booking.late_arrival ? 'Yes' : 'No',
      booking_complete: booking.complete ? 'Yes' : 'No',

      cancellation_type: booking.cancellation_type || '',

      booking_created_date: booking.created_at
        ? moment(booking.created_at).format('DD/MM/YYYY')
        : '',
      booking_updated_date: booking.updated_at
        ? moment(booking.updated_at).format('DD/MM/YYYY')
        : ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // GUEST DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseGuestData(guest) {
    if (!guest) return {};

    const addressParts = [
      guest.address_street1,
      guest.address_street2,
      guest.address_city,
      guest.address_state_province,
      guest.address_postal,
      guest.address_country
    ].filter(Boolean);

    let age = '';
    if (guest.dob) {
      age = moment().diff(moment(guest.dob), 'years').toString();
    }

    return {
      guest_first_name: guest.first_name || '',
      guest_last_name: guest.last_name || '',
      guest_name: guest.first_name && guest.last_name
        ? `${guest.first_name} ${guest.last_name}`
        : guest.first_name || guest.last_name || '',

      // Aliases used by some templates
      first_name: guest.first_name || '',
      last_name:  guest.last_name  || '',

      guest_email: guest.email || '',
      guest_phone: guest.phone_number || '',

      guest_gender: guest.gender || '',
      guest_dob: guest.dob ? moment(guest.dob).format('DD/MM/YYYY') : '',
      guest_age: age,

      guest_address_street1: guest.address_street1 || '',
      guest_address_street2: guest.address_street2 || '',
      guest_address_city: guest.address_city || '',
      guest_address_state: guest.address_state_province || '',
      guest_address_postal: guest.address_postal || '',
      guest_address_country: guest.address_country || '',
      guest_address_full: addressParts.join(', '),

      guest_email_verified: guest.email_verified ? 'Yes' : 'No',
      guest_active: guest.active ? 'Yes' : 'No'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COURSE DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseCourseData(course) {
    if (Array.isArray(course)) course = course[0];
    if (!course) return {};

    return {
      course_title: course.title || '',
      course_description: course.description || '',
      course_start_date: course.start_date
        ? moment(course.start_date).format('DD/MM/YYYY')
        : '',
      course_end_date: course.end_date
        ? moment(course.end_date).format('DD/MM/YYYY')
        : '',
      course_duration_hours: course.duration_hours || '',
      course_status: course.status || '',
      course_ndis_sta_price: course.ndis_sta_price
        ? `$${parseFloat(course.ndis_sta_price).toFixed(2)}`
        : '',
      course_ndis_hsp_price: course.ndis_hsp_price
        ? `$${parseFloat(course.ndis_hsp_price).toFixed(2)}`
        : '',
      course_holiday_price: course.holiday_price
        ? `$${parseFloat(course.holiday_price).toFixed(2)}`
        : '',
      course_sta_price: course.sta_price
        ? `$${parseFloat(course.sta_price).toFixed(2)}`
        : ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PACKAGE DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parsePackageData(packageData) {
    if (Array.isArray(packageData)) packageData = packageData[0];
    if (!packageData) return {};

    return {
      package_name: packageData.name || '',
      package_code: packageData.package_code || '',
      package_funder: packageData.funder || '',
      package_ndis_type: packageData.ndis_package_type || '',
      package_description: packageData.description || '',
      package_price: packageData.price
        ? `$${parseFloat(packageData.price).toFixed(2)}`
        : ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROMOTIONS DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parsePromotionData(promotion) {
    if (Array.isArray(promotion)) promotion = promotion[0];
    if (!promotion) return {};

    return {
      promotion_title: promotion.title || '',
      promotion_description: promotion.description || '',
      promotion_availability: promotion.availability || '',
      promotion_terms: promotion.terms || '',
      promotion_start_date: promotion.start_date
        ? moment(promotion.start_date).format('DD/MM/YYYY')
        : '',
      promotion_end_date: promotion.end_date
        ? moment(promotion.end_date).format('DD/MM/YYYY')
        : '',
      promotion_status: promotion.status || ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOM TYPE DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseRoomTypeData(roomType) {
    if (Array.isArray(roomType)) roomType = roomType[0];
    if (!roomType) return {};

    return {
      room_type: roomType.type || '',
      room_name: roomType.name || '',
      room_bedrooms: roomType.bedrooms?.toString() || '',
      room_bathrooms: roomType.bathrooms?.toString() || '',
      room_ergonomic_king_beds: roomType.ergonomic_king_beds?.toString() || '',
      room_king_single_beds: roomType.king_single_beds?.toString() || '',
      room_queen_sofa_beds: roomType.queen_sofa_beds?.toString() || '',
      room_ocean_view: roomType.ocean_view ? 'Yes' : 'No',
      room_max_guests: roomType.max_guests?.toString() || '',
      room_price_per_night: roomType.price_per_night
        ? `$${parseFloat(roomType.price_per_night).toFixed(2)}`
        : '',
      room_peak_rate: roomType.peak_rate
        ? `$${parseFloat(roomType.peak_rate).toFixed(2)}`
        : '',
      room_hsp_pricing: roomType.hsp_pricing
        ? `$${parseFloat(roomType.hsp_pricing).toFixed(2)}`
        : ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNDING APPROVAL DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseFundingApprovalData(fundingApproval) {
    if (Array.isArray(fundingApproval)) fundingApproval = fundingApproval[0];
    if (!fundingApproval) return {};

    const nightsRemaining =
      (fundingApproval.nights_approved || 0) - (fundingApproval.nights_used || 0);
    const additionalNightsRemaining =
      (fundingApproval.additional_room_nights_approved || 0) -
      (fundingApproval.additional_room_nights_used || 0);

    return {
      funding_approval_name: fundingApproval.approval_name || '',
      funding_approval_number: fundingApproval.approval_number || '',
      funding_type: fundingApproval.funding_type || '',
      funding_nights_approved: fundingApproval.nights_approved?.toString() || '',
      funding_nights_used: fundingApproval.nights_used?.toString() || '',
      funding_nights_remaining: nightsRemaining.toString(),
      funding_additional_nights_remaining: additionalNightsRemaining.toString(),
      funding_approval_from: fundingApproval.approval_from
        ? moment(fundingApproval.approval_from).format('DD/MM/YYYY')
        : '',
      funding_approval_to: fundingApproval.approval_to
        ? moment(fundingApproval.approval_to).format('DD/MM/YYYY')
        : '',
      funding_additional_room_nights_approved:
        fundingApproval.additional_room_nights_approved?.toString() || '',
      funding_additional_room_nights_used:
        fundingApproval.additional_room_nights_used?.toString() || '',
      funding_status: fundingApproval.status || '',
      funding_notes: fundingApproval.notes || ''
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROPERTY DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parsePropertyData() {
    return {
      property_name: 'Sargood on Collaroy',
      property_address: '1 Brissenden Avenue, Collaroy NSW 2097, Australia',
      property_phone: '02 8597 0600',
      property_email: 'info@sargoodoncollaroy.com.au',
      property_website: 'www.sargoodoncollaroy.com.au'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // BOOKING QUESTIONS PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse booking template questions from Q&A pairs.
   *
   *  - Uses formatAnswerForDisplay() for {{tag}} safety (no [object Object])
   *  - Uses formatAnswerForEmail() to preserve arrays/objects for Handlebars #each
   *  - Builds _raw data (selected service-cards as structured array)
   *  - Stores both hyphenated and underscore key variants
   *  - Stores section-specific keys (key_s{sectionId})
   *
   * @param {Array} qaPairs
   * @param {Object} options
   * @param {Boolean} options.includeSectionSpecific - default true
   * @returns {Object}
   */
  static parseBookingQuestions(qaPairs, { includeSectionSpecific = true } = {}) {
    if (!qaPairs || !Array.isArray(qaPairs)) return {};

    const questionTags = {};

    qaPairs.forEach(qaPair => {
      const questionKey = qaPair.Question?.question_key || qaPair.question_key;
      const sectionId   = qaPair.section_id;
      const answer      = qaPair.answer;

      if (!questionKey || answer === null || answer === undefined) return;

      const displayValue    = this.formatAnswerForDisplay(answer);
      const formattedAnswer = this.formatAnswerForEmail(answer);
      const rawData         = this._buildRawData(formattedAnswer);

      const register = (key, overwrite = false) => {
        if (overwrite || questionTags[key] === undefined) {
          questionTags[key] = displayValue;
          if (rawData !== null) {
            questionTags[`${key}_raw`] = rawData;
          }
        }
      };

      register(questionKey);

      if (questionKey.includes('-')) {
        register(questionKey.replace(/-/g, '_'));
      }

      if (includeSectionSpecific && sectionId) {
        const secSuffix = `_s${sectionId}`;
        questionTags[`${questionKey}${secSuffix}`] = displayValue;
        if (questionKey.includes('-')) {
          questionTags[`${questionKey.replace(/-/g, '_')}${secSuffix}`] = displayValue;
        }
      }
    });

    return questionTags;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ROOM DATA PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  static parseRoomData(rooms) {
    if (!rooms || !Array.isArray(rooms) || rooms.length === 0) {
      return {
        number_of_guests:   '0',
        number_of_adults:   '0',
        number_of_children: '0',
        number_of_infants:  '0'
      };
    }

    const firstRoom = rooms[0];

    return {
      number_of_guests:   firstRoom.total_guests?.toString() || '0',
      number_of_adults:   firstRoom.adults?.toString()       || '0',
      number_of_children: firstRoom.children?.toString()     || '0',
      number_of_infants:  firstRoom.infants?.toString()      || '0'
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // COMBINED PARSER
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Parse all data from a complete booking object into merge tag format.
   *
   * ── FundingApproval ───────────────────────────────────────────────────────
   * FundingApproval has NO direct Booking FK (belongs to Guest, not Booking).
   * BookingEmailDataService.getFullBookingData() includes it nested under
   * Guest as 'fundingApprovals'. This method reads it from:
   *   bookingData.Guest?.fundingApprovals
   *
   * ── Course / Package ──────────────────────────────────────────────────────
   * No direct Booking FK for either. Attached to the booking object by
   * enrichCourseData / enrichPackageData (called by getFullBookingData).
   * Read here via bookingData.Course / bookingData.Package.
   *
   * @param {Object} bookingData - Full booking with all relations
   * @returns {Object} All tag values combined
   */
  static parseAllData(bookingData) {
    const tagValues = {};

    Object.assign(tagValues, this.parseBookingData(bookingData));
    Object.assign(tagValues, this.parseGuestData(bookingData.Guest));
    Object.assign(tagValues, this.parseRoomData(bookingData.Rooms));
    Object.assign(tagValues, this.parsePropertyData());

    if (bookingData.Sections) {
      const qaPairs = bookingData.Sections.flatMap(s => s.QaPairs || []);
      Object.assign(tagValues, this.parseBookingQuestions(qaPairs));
    }

    // Course — attached by enrichCourseData (no direct FK) via setDataValue('Course', ...)
    // Must read via dataValues because there is no defined Sequelize association getter.
    const courseData = bookingData.dataValues?.Course ?? bookingData.Course ?? bookingData.Courses;
    if (courseData) {
      Object.assign(tagValues, this.parseCourseData(courseData));
    }

    // Package — attached by enrichPackageData (no direct FK) via setDataValue('Package', ...)
    // Must read via dataValues because there is no defined Sequelize association getter.
    const packageData = bookingData.dataValues?.Package ?? bookingData.Package ?? bookingData.Packages;
    if (packageData) {
      Object.assign(tagValues, this.parsePackageData(packageData));
    }

    if (bookingData.Promotion || bookingData.Promotions) {
      Object.assign(tagValues, this.parsePromotionData(bookingData.Promotion || bookingData.Promotions));
    }

    if (bookingData.RoomType || bookingData.Rooms?.[0]?.RoomType) {
      Object.assign(
        tagValues,
        this.parseRoomTypeData(bookingData.RoomType || bookingData.Rooms[0].RoomType)
      );
    }

    // FundingApproval belongs to Guest (no direct Booking FK).
    // Loaded as Guest.fundingApprovals via getFullBookingData().
    const fundingApproval =
      bookingData.FundingApproval           ||   // direct attach (legacy / manual)
      bookingData.FundingApprovals          ||   // direct attach (legacy / manual)
      bookingData.Guest?.fundingApprovals;        // ✅ correct path via Guest association
    if (fundingApproval) {
      Object.assign(tagValues, this.parseFundingApprovalData(fundingApproval));
    }

    // ── Legacy / alias tags ──────────────────────────────────────────────────
    // Migrated templates use camelCase or shorthand tag names from the old system.
    // These aliases let every template work without editing the HTML.
    // Rule: only set the alias if it isn't already present (a template that was
    // already updated to use the canonical name won't be overwritten).
    const alias = (aliasKey, canonicalKey) => {
      if (!tagValues[aliasKey] && tagValues[canonicalKey]) {
        tagValues[aliasKey] = tagValues[canonicalKey];
      }
    };

    // ── Date aliases (used by IDs 7,17,18,19,20,22,35,36 and the migrated set) ──
    alias('arrivalDate',    'preferred_arrival_date');
    alias('departureDate',  'preferred_departure_date');
    alias('check_in_date',  'preferred_arrival_date');
    alias('check_out_date', 'preferred_departure_date');
    alias('checkin_date',   'preferred_arrival_date');
    alias('checkout_date',  'preferred_departure_date');
    // "dateOfStay" used by ID22 — combined range string
    if (!tagValues.dateOfStay && tagValues.preferred_arrival_date && tagValues.preferred_departure_date) {
      tagValues.dateOfStay = `${tagValues.preferred_arrival_date} – ${tagValues.preferred_departure_date}`;
    }

    // ── Booking ID / link (used by ID19,20,14) ────────────────────────────────
    alias('booking_id',   'booking_reference');
    // booking_link is injected by the dispatch layer (EmailTriggerService); alias just in case
    if (!tagValues.booking_link && tagValues.booking_url) {
      tagValues.booking_link = tagValues.booking_url;
    }

    // ── Room / accommodation aliases (used by ID19,20, migrated set) ─────────
    // "accommodation" → room type name (e.g. "studio")
    alias('accommodation', 'room_name');
    // "room_type" in ID4 refers to the room type string, which is also room_name
    alias('room_type',     'room_name');

    // ── Package aliases (used by ID7,19,20, migrated set) ────────────────────
    alias('booking_package', 'package_name');
    alias('package',         'package_name');
    alias('package_type',    'package_name');

    // ── Guest aliases ─────────────────────────────────────────────────────────
    alias('guestName', 'guest_name');
    alias('dob',       'guest_dob');

    // ── Funder alias ─────────────────────────────────────────────────────────
    // "funder" in migrated templates = the funding source answer from QaPairs
    // (question_key: "how-will-your-stay-be-funded", answer: "icare", "ndis", etc.)
    // QaPair parser stores it under its question_key. Map common known keys.
    alias('funder',         'how-will-your-stay-be-funded');
    alias('funder',         'how_will_your_stay_be_funded');
    alias('funding_source', 'how-will-your-stay-be-funded');
    alias('funding_source', 'how_will_your_stay_be_funded');
    // Also fall back to package_funder if no QaPair answer was found
    if (!tagValues.funder) alias('funder', 'package_funder');

    // ── iCare aliases (used by ID4,32) ────────────────────────────────────────
    alias('icare_participant_number', 'icare-participant-number');
    alias('icare_participant_number', 'icare_participant_number_qa'); // question_key variant
    alias('coordinator_name',         'icare-coordinator-name');
    alias('coordinator_name',         'icare_coordinator_name');

    // ── Funding approval aliases (used by ID32 Icare Nights Update) ──────────
    alias('nights_approved',  'funding_nights_approved');
    alias('nights_used',      'funding_nights_used');
    alias('nights_remaining', 'funding_nights_remaining');
    // "nights_requested" — stored as QaPair answer; try common question_key shapes
    alias('nights_requested', 'number-of-nights-requested');
    alias('nights_requested', 'number_of_nights_requested');

    return tagValues;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWER FORMATTING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Format answer for Handlebars rendering.
   * Preserves arrays/objects so {{#each tag}} loops work.
   * Use formatAnswerForDisplay() when you need a plain string for {{tag}}.
   */
  static formatAnswerForEmail(answer) {
    if (answer === null || answer === undefined) return '';
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';
    if (typeof answer === 'object') return answer;

    if (typeof answer === 'string') {
      if (
        (answer.startsWith('[') && answer.endsWith(']')) ||
        (answer.startsWith('{') && answer.endsWith('}'))
      ) {
        try {
          const parsed = JSON.parse(answer);
          if (Array.isArray(parsed) || typeof parsed === 'object') return parsed;
          return answer;
        } catch (e) { /* fall through */ }
      }
      return answer.trim();
    }

    return String(answer);
  }

  /**
   * Format answer as a display-safe string for simple {{tag}} Handlebars usage.
   * ALWAYS returns a string — never "[object Object]".
   *
   *   boolean              → "Yes" / "No"
   *   service-cards object → "Service One, Service Two (Sub A, Sub B)"
   *   generic object       → label/name/value/text, or JSON.stringify
   *   array of strings     → "Item 1, Item 2"
   *   array of objects     → extracts label/name/value/text, joins with ", "
   *   primitive            → String(value)
   */
  static formatAnswerForDisplay(answer) {
    if (answer === null || answer === undefined) return '';
    if (typeof answer === 'boolean') return answer ? 'Yes' : 'No';

    let parsed = answer;
    if (typeof answer === 'string') {
      if (
        (answer.startsWith('[') && answer.endsWith(']')) ||
        (answer.startsWith('{') && answer.endsWith('}'))
      ) {
        try { parsed = JSON.parse(answer); } catch (e) { /* fall through */ }
      }
    }

    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      const isServiceMap =
        entries.length > 0 &&
        entries.some(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);

      if (isServiceMap) {
        const selectedServices = entries
          .filter(([, v]) => v.selected === true)
          .map(([key, v]) => {
            const label = key
              .split('-')
              .map(word => word.charAt(0).toUpperCase() + word.slice(1))
              .join(' ');

            if (Array.isArray(v.subOptions) && v.subOptions.length > 0) {
              const subLabels = v.subOptions.map(sub => {
                if (typeof sub === 'object' && sub !== null) {
                  return sub.label || sub.name || sub.value || JSON.stringify(sub);
                }
                return String(sub).split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              });
              return `${label} (${subLabels.join(', ')})`;
            }

            return label;
          });

        return selectedServices.length > 0 ? selectedServices.join(', ') : 'None selected';
      }

      return parsed.label || parsed.name || parsed.value || parsed.text || JSON.stringify(parsed);
    }

    if (Array.isArray(parsed)) {
      return parsed
        .map(item => {
          if (item === null || item === undefined) return '';
          if (typeof item === 'object') {
            return item.label || item.name || item.value || item.text || JSON.stringify(item);
          }
          return String(item);
        })
        .filter(Boolean)
        .join(', ');
    }

    return String(parsed).trim();
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ANSWER MATCHING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Compare an actual booking answer against an expected trigger answer.
   *
   * Handles: service-cards objects, JSON arrays/strings, comma-separated strings,
   * plain strings, integers, booleans.
   *
   * Returns true if ANY expected value is contained in (or contains) ANY actual value.
   */
  static answersMatch(actualAnswer, expectedAnswer) {
    console.log('      🔍 Comparing answers...');

    // ── Detect service-cards object ──────────────────────────────────────────
    let parsedActual = actualAnswer;
    if (typeof actualAnswer === 'string') {
      if (actualAnswer.startsWith('{') && actualAnswer.endsWith('}')) {
        try { parsedActual = JSON.parse(actualAnswer); } catch (e) { /* keep original */ }
      }
    }

    if (
      typeof parsedActual === 'object' &&
      parsedActual !== null &&
      !Array.isArray(parsedActual)
    ) {
      const entries = Object.entries(parsedActual);
      const isServiceMap =
        entries.length > 0 &&
        entries.some(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);

      if (isServiceMap) {
        console.log('      📦 Detected service-cards object format');

        const parseExpectedValues = (expected) => {
          if (Array.isArray(expected)) return expected.map(e => String(e).trim().toLowerCase());
          if (typeof expected === 'string') {
            if (expected.includes(',')) return expected.split(',').map(e => e.trim().toLowerCase()).filter(e => e);
            return [expected.trim().toLowerCase()];
          }
          return [String(expected).trim().toLowerCase()];
        };

        const expectedServices = parseExpectedValues(expectedAnswer);
        console.log(`      Expected services: [${expectedServices.join(', ')}]`);

        const matchedServices = [];
        for (const expectedService of expectedServices) {
          for (const [serviceKey, serviceValue] of entries) {
            const normalizedKey = serviceKey.toLowerCase().trim();
            const isMatch =
              normalizedKey === expectedService ||
              normalizedKey.includes(expectedService) ||
              expectedService.includes(normalizedKey);

            if (isMatch && serviceValue.selected === true) {
              matchedServices.push(serviceKey);
              console.log(`      ✓ Service matched and selected: ${serviceKey}`);
              break;
            } else if (isMatch && serviceValue.selected === false) {
              console.log(`      ⚠️ Service matched but NOT selected: ${serviceKey}`);
            }
          }
        }

        if (matchedServices.length > 0) {
          console.log(`      ✓ Service-cards match found: ${matchedServices.join(', ')}`);
          return true;
        }

        console.log('      ✗ No selected services matched');
        return false;
      }
    }

    // ── Standard value comparison ────────────────────────────────────────────
    const parseAnswer = (answer) => {
      if (Array.isArray(answer)) {
        return answer.map(a => {
          if (typeof a === 'object' && a !== null) {
            // For complex objects, extract meaningful string values to match against
            return (a.label || a.name || a.value || a.service || a.goal || JSON.stringify(a))
              .trim().toLowerCase();
          }
          return String(a).trim().toLowerCase();
        });
      }
      if (typeof answer === 'boolean') return [answer ? 'yes' : 'no'];
      if (typeof answer === 'string') {
        if (answer.startsWith('[') && answer.endsWith(']')) {
          try {
            const p = JSON.parse(answer);
            if (Array.isArray(p)) return p.map(a => String(a).trim().toLowerCase());
          } catch (e) { /* fall through */ }
        }
        if (answer.includes(',')) return answer.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
        return [answer.trim().toLowerCase()];
      }
      return [String(answer).trim().toLowerCase()];
    };

    const actualValues   = parseAnswer(actualAnswer);
    const expectedValues = parseAnswer(expectedAnswer);

    console.log(`      Actual values:   [${actualValues.join(', ')}]`);
    console.log(`      Expected values: [${expectedValues.join(', ')}]`);

    const hasAnyMatch = expectedValues.some(expected =>
      actualValues.some(
        actual => actual === expected || actual.includes(expected) || expected.includes(actual)
      )
    );

    if (hasAnyMatch) {
      const matchedValues = expectedValues.filter(exp =>
        actualValues.some(act => act.includes(exp) || exp.includes(act))
      );
      console.log(`      ✓ Partial match found: ${matchedValues.join(', ')}`);
      return true;
    }

    const normalizedActual   = [...actualValues].sort().join(',');
    const normalizedExpected = [...expectedValues].sort().join(',');
    if (normalizedActual === normalizedExpected) {
      console.log('      ✓ Exact match');
      return true;
    }

    console.log('      ✗ No match found');
    return false;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // QAPAIR LOOKUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Find a QaPair using a 5-step fallback chain:
   *   1. question_id
   *   2. question_key
   *   3. Exact question text
   *   4. Case-insensitive question text
   *   5. Partial / contains question text
   */
  static findQaPairWithFallback(qaPairs, triggerQuestion) {
    console.log('\n🔍 Finding QaPair with fallback...');

    const question     = triggerQuestion.question;
    const questionId   = question?.id || triggerQuestion.question_id;
    const questionText = question?.question || triggerQuestion.question_text;
    const questionKey  = question?.question_key;

    console.log('   Searching for:', { questionId, questionKey, questionText: questionText?.substring(0, 50) });

    let qaPair = null;

    if (questionId) {
      console.log('   📌 Step 1: Trying question_id match...');
      qaPair = qaPairs.find(qa => qa.question_id === questionId);
      if (qaPair) { console.log('   ✅ Found by question_id:', questionId); return qaPair; }
      console.log('   ⚠️ No match by question_id:', questionId);
    }

    if (questionKey) {
      console.log('   📌 Step 2: Trying question_key match...');
      qaPair = qaPairs.find(qa => (qa.Question?.question_key || qa.question_key) === questionKey);
      if (qaPair) { console.log('   ✅ Found by question_key:', questionKey); return qaPair; }
      console.log('   ⚠️ No match by question_key:', questionKey);
    }

    if (!questionText) {
      console.log('   ❌ No question text available for fallback');
      return null;
    }

    console.log('   📌 Step 3: Trying exact question text match...');
    qaPair =
      qaPairs.find(qa => qa.question === questionText) ||
      qaPairs.find(qa => qa.Question?.question === questionText);
    if (qaPair) { console.log('   ✅ Found by exact question text'); return qaPair; }

    console.log('   📌 Step 4: Trying case-insensitive question text match...');
    const questionTextLower = questionText.toLowerCase().trim();
    qaPair = qaPairs.find(
      qa =>
        qa.question?.toLowerCase().trim() === questionTextLower ||
        qa.Question?.question?.toLowerCase().trim() === questionTextLower
    );
    if (qaPair) { console.log('   ✅ Found by case-insensitive question text'); return qaPair; }

    console.log('   📌 Step 5: Trying partial question text match...');
    qaPair = qaPairs.find(qa => {
      const qaQuestion = (qa.question || qa.Question?.question || '').toLowerCase();
      return qaQuestion.includes(questionTextLower) || questionTextLower.includes(qaQuestion);
    });
    if (qaPair) { console.log('   ✅ Found by partial question text match'); return qaPair; }

    console.log(`   ❌ No QaPair found after all fallback attempts (${qaPairs.length} pairs checked)`);
    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // TEMPLATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static resolveTemplate(template, tagValues) {
    if (!template || !tagValues) return template;
    let resolved = template;
    Object.entries(tagValues).forEach(([tag, value]) => {
      resolved = resolved.replace(new RegExp(`{{${tag}}}`, 'g'), value || '');
    });
    return resolved;
  }

  static getAvailableTags(tagValues) {
    return Object.keys(tagValues);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  static _buildRawData(formattedAnswer) {
    if (Array.isArray(formattedAnswer)) return formattedAnswer;

    if (typeof formattedAnswer === 'object' && formattedAnswer !== null) {
      const entries = Object.entries(formattedAnswer);
      const isServiceMap =
        entries.length > 0 &&
        entries.every(([, v]) => typeof v === 'object' && v !== null && 'selected' in v);

      if (isServiceMap) {
        return entries
          .filter(([, v]) => v.selected === true)
          .map(([key, v]) => ({
            key,
            label: key.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
            subOptions: (v.subOptions || []).map(sub => {
              if (typeof sub === 'string') {
                return sub.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
              }
              return sub.label || sub.name || sub.value || String(sub);
            })
          }));
      }

      return formattedAnswer;
    }

    return null;
  }
}

export default EmailDataParsingService;