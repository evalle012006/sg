/**
 * Global Email Merge Tag Registry - DATABASE SCHEMA BASED
 * 
 * ✅ Tags based on actual database table schemas
 * ✅ No redundant or duplicate tags
 * ✅ Clean, organized structure matching database
 */

export const GLOBAL_MERGE_TAGS = {
  // ==================== BOOKING INFORMATION ====================
  // Based on 'bookings' table schema
  booking: {
    category: 'Booking Information',
    tags: [
      { key: 'booking_reference', label: 'Booking Reference', description: 'Unique reference ID', example: 'BK-2024-001' },
      { key: 'booking_status', label: 'Status', description: 'Current booking status', example: 'Confirmed' },
      { key: 'booking_status_name', label: 'Status Name', description: 'Display name of status', example: 'Booking Confirmed' },
      { key: 'booking_type', label: 'Booking Type', description: 'Type of booking', example: 'Respite' },
      { key: 'booking_name', label: 'Booking Name', description: 'Name/title of booking', example: 'Smith Family Stay' },
      { key: 'alternate_contact_name', label: 'Alternate Contact Name', description: 'Additional contact person', example: 'Jane Doe' },
      { key: 'alternate_contact_number', label: 'Alternate Contact Number', description: 'Additional contact phone', example: '0412 345 678' },
      { key: 'type_of_spinal_injury', label: 'Type of Spinal Injury', description: 'SCI classification', example: 'T6 Complete' },
      { key: 'preferred_arrival_date', label: 'Preferred Arrival Date', description: 'Requested check-in date', example: '15/04/2024' },
      { key: 'preferred_departure_date', label: 'Preferred Departure Date', description: 'Requested check-out date', example: '22/04/2024' },
      { key: 'eligibility', label: 'Eligibility', description: 'Eligibility status', example: 'Eligible' },
      { key: 'eligibility_name', label: 'Eligibility Name', description: 'Display name of eligibility', example: 'Eligible - NDIS' },
      { key: 'notes', label: 'Booking Notes', description: 'Internal booking notes', example: 'Special care requirements' },
      { key: 'checklist_notes', label: 'Checklist Notes', description: 'Checklist/preparation notes', example: 'Room setup complete' },
      { key: 'late_arrival', label: 'Late Arrival', description: 'Arriving after hours', example: 'Yes' },
      { key: 'cancellation_type', label: 'Cancellation Type', description: 'Type of cancellation if cancelled', example: 'Guest Request' },
      { key: 'booking_complete', label: 'Booking Complete', description: 'Completion status', example: 'Yes' },
      { key: 'booking_created_date', label: 'Created Date', description: 'When booking was created', example: '10/03/2024' },
      { key: 'booking_updated_date', label: 'Last Updated Date', description: 'When booking was last modified', example: '12/03/2024' },
    ]
  },

  // ==================== GUEST INFORMATION ====================
  // Based on 'guests' table schema
  guest: {
    category: 'Guest Information',
    tags: [
      { key: 'guest_first_name', label: 'First Name', description: 'Guest first name', example: 'John' },
      { key: 'guest_last_name', label: 'Last Name', description: 'Guest last name', example: 'Smith' },
      { key: 'guest_name', label: 'Full Name', description: 'Guest full name', example: 'John Smith' },
      { key: 'guest_email', label: 'Email', description: 'Guest email address', example: 'john@example.com' },
      { key: 'guest_phone', label: 'Phone', description: 'Guest phone number', example: '0412 345 678' },
      { key: 'guest_gender', label: 'Gender', description: 'Guest gender', example: 'Male' },
      { key: 'guest_dob', label: 'Date of Birth', description: 'Guest date of birth', example: '15/03/1985' },
      { key: 'guest_age', label: 'Age', description: 'Guest age', example: '38' },
      { key: 'guest_address_street1', label: 'Address Street 1', description: 'Street address line 1', example: '123 Main St' },
      { key: 'guest_address_street2', label: 'Address Street 2', description: 'Street address line 2', example: 'Unit 5' },
      { key: 'guest_address_city', label: 'City', description: 'City', example: 'Sydney' },
      { key: 'guest_address_state', label: 'State/Province', description: 'State or province', example: 'NSW' },
      { key: 'guest_address_postal', label: 'Postal Code', description: 'Postal/ZIP code', example: '2000' },
      { key: 'guest_address_country', label: 'Country', description: 'Country', example: 'Australia' },
      { key: 'guest_address_full', label: 'Full Address', description: 'Complete formatted address', example: '123 Main St, Sydney NSW 2000, Australia' },
      { key: 'guest_email_verified', label: 'Email Verified', description: 'Email verification status', example: 'Yes' },
      { key: 'guest_active', label: 'Account Active', description: 'Account active status', example: 'Yes' },
    ]
  },

  // ==================== COURSE INFORMATION ====================
  // Based on 'courses' table schema
  course: {
    category: 'Course Information',
    tags: [
      { key: 'course_title', label: 'Course Title', description: 'Name of the course', example: 'Adaptive Sports Program' },
      { key: 'course_description', label: 'Description', description: 'Course description', example: 'Learn adaptive sports techniques' },
      { key: 'course_start_date', label: 'Start Date', description: 'Course start date', example: '01/05/2024' },
      { key: 'course_end_date', label: 'End Date', description: 'Course end date', example: '05/05/2024' },
      { key: 'course_duration_hours', label: 'Duration (Hours)', description: 'Course length in hours', example: '40' },
      { key: 'course_status', label: 'Status', description: 'Course status', example: 'Published' },
      { key: 'course_ndis_sta_price', label: 'NDIS STA Price', description: 'NDIS Short Term Accommodation price', example: '$850.00' },
      { key: 'course_ndis_hsp_price', label: 'NDIS HSP Price', description: 'NDIS Holiday Support Package price', example: '$750.00' },
      { key: 'course_holiday_price', label: 'Holiday Price', description: 'Standard holiday price', example: '$950.00' },
      { key: 'course_sta_price', label: 'STA Price', description: 'Short Term Accommodation price', example: '$850.00' },
    ]
  },

  // ==================== PACKAGE INFORMATION ====================
  // Based on 'packages' table schema
  package: {
    category: 'Package Information',
    tags: [
      { key: 'package_name', label: 'Package Name', description: 'Name of the package', example: 'Full Stay Package' },
      { key: 'package_code', label: 'Package Code', description: 'Package identifier code', example: 'FSP-001' },
      { key: 'package_funder', label: 'Funder', description: 'NDIS or Non-NDIS', example: 'NDIS' },
      { key: 'package_ndis_type', label: 'NDIS Package Type', description: 'STA, Holiday, or Holiday-Plus', example: 'STA' },
      { key: 'package_description', label: 'Description', description: 'Package description', example: 'Comprehensive accommodation package' },
      { key: 'package_price', label: 'Price', description: 'Package price', example: '$4,500.00' },
    ]
  },

  // ==================== PROMOTIONS INFORMATION ====================
  // Based on 'promotions' table schema
  promotions: {
    category: 'Promotions Information',
    tags: [
      { key: 'promotion_title', label: 'Promotion Title', description: 'Promotion name', example: 'Summer Special 2024' },
      { key: 'promotion_description', label: 'Description', description: 'Promotion details', example: 'Save 10% on all bookings' },
      { key: 'promotion_availability', label: 'Availability', description: 'Who can use this promotion', example: 'All Guests' },
      { key: 'promotion_terms', label: 'Terms & Conditions', description: 'Promotion terms', example: 'Valid until June 30' },
      { key: 'promotion_start_date', label: 'Start Date', description: 'Promotion begins', example: '01/12/2023' },
      { key: 'promotion_end_date', label: 'End Date', description: 'Promotion expires', example: '30/06/2024' },
      { key: 'promotion_status', label: 'Status', description: 'Promotion status', example: 'Published' },
    ]
  },

  // ==================== ROOM TYPES ====================
  // Based on 'room_types' table schema
  room: {
    category: 'Room Types',
    tags: [
      { key: 'room_type', label: 'Room Type', description: 'Type of room', example: 'Accessible Suite' },
      { key: 'room_name', label: 'Room Name', description: 'Room name', example: 'Ocean View Suite' },
      { key: 'room_bedrooms', label: 'Bedrooms', description: 'Number of bedrooms', example: '2' },
      { key: 'room_bathrooms', label: 'Bathrooms', description: 'Number of bathrooms', example: '1' },
      { key: 'room_ergonomic_king_beds', label: 'Ergonomic King Beds', description: 'Number of ergonomic king beds', example: '1' },
      { key: 'room_king_single_beds', label: 'King Single Beds', description: 'Number of king single beds', example: '2' },
      { key: 'room_queen_sofa_beds', label: 'Queen Sofa Beds', description: 'Number of queen sofa beds', example: '1' },
      { key: 'room_ocean_view', label: 'Ocean View', description: 'Has ocean view', example: 'Yes' },
      { key: 'room_max_guests', label: 'Maximum Guests', description: 'Maximum occupancy', example: '4' },
      { key: 'room_price_per_night', label: 'Price Per Night', description: 'Nightly rate', example: '$350.00' },
      { key: 'room_peak_rate', label: 'Peak Rate', description: 'Peak season rate', example: '$450.00' },
      { key: 'room_hsp_pricing', label: 'HSP Pricing', description: 'Holiday Support Package pricing', example: '$400.00' },
    ]
  },

  // ==================== FUNDING APPROVALS ====================
  // Based on 'funding_approvals' table schema
  funding: {
    category: 'Funding Approvals',
    tags: [
      { key: 'funding_approval_name', label: 'Approval Name', description: 'Name of funding approval', example: 'NDIS Plan 2024' },
      { key: 'funding_approval_number', label: 'Approval Number', description: 'Funding approval reference', example: 'APP-123456' },
      { key: 'funding_type', label: 'Funding Type', description: 'iCare, NDIS, Private, DVA, Other', example: 'NDIS' },
      { key: 'funding_nights_approved', label: 'Nights Approved', description: 'Total nights approved', example: '14' },
      { key: 'funding_nights_used', label: 'Nights Used', description: 'Nights already used', example: '7' },
      { key: 'funding_nights_remaining', label: 'Nights Remaining', description: 'Nights left', example: '7' },
      { key: 'funding_approval_from', label: 'Approval From Date', description: 'Approval start date', example: '01/01/2024' },
      { key: 'funding_approval_to', label: 'Approval To Date', description: 'Approval end date', example: '31/12/2024' },
      { key: 'funding_additional_room_nights_approved', label: 'Additional Room Nights Approved', description: 'Extra room nights approved', example: '5' },
      { key: 'funding_additional_room_nights_used', label: 'Additional Room Nights Used', description: 'Extra room nights used', example: '2' },
      { key: 'funding_status', label: 'Status', description: 'Approval status', example: 'Active' },
      { key: 'funding_notes', label: 'Notes', description: 'Funding notes', example: 'Approved for respite care' },
    ]
  },

  // ==================== PROPERTY INFORMATION ====================
  property: {
    category: 'Property Information',
    tags: [
      { key: 'property_name', label: 'Property Name', description: 'Facility name', example: 'Sargood on Collaroy' },
      { key: 'property_address', label: 'Address', description: 'Full property address', example: '1 Pittwater Road, Collaroy NSW 2097' },
      { key: 'property_phone', label: 'Phone', description: 'Main phone number', example: '(02) 9972 9999' },
      { key: 'property_email', label: 'Email', description: 'Main email address', example: 'info@sargoodoncollaroy.com.au' },
      { key: 'property_website', label: 'Website', description: 'Website URL', example: 'www.sargoodoncollaroy.com.au' },
    ]
  }
};

/**
 * Get all merge tags organized by category
 */
export function getAllMergeTags() {
  const organized = {};
  
  Object.values(GLOBAL_MERGE_TAGS).forEach(entity => {
    if (!organized[entity.category]) {
      organized[entity.category] = [];
    }
    
    entity.tags.forEach(tag => {
      organized[entity.category].push({
        label: tag.label,
        value: `{{${tag.key}}}`,
        description: tag.description,
        example: tag.example,
        key: tag.key
      });
    });
  });
  
  return organized;
}

/**
 * Get merge tags for specific entity types
 */
export function getMergeTagsForEntity(entityType) {
  const entity = GLOBAL_MERGE_TAGS[entityType];
  if (!entity) return [];
  
  return entity.tags.map(tag => ({
    label: tag.label,
    value: `{{${tag.key}}}`,
    description: tag.description,
    example: tag.example,
    key: tag.key
  }));
}

/**
 * Search merge tags by keyword
 */
export function searchMergeTags(searchTerm) {
  const allTags = getAllMergeTags();
  const searchLower = searchTerm.toLowerCase();
  const results = {};
  
  Object.entries(allTags).forEach(([category, tags]) => {
    const matching = tags.filter(tag => 
      tag.label.toLowerCase().includes(searchLower) ||
      tag.key.toLowerCase().includes(searchLower) ||
      tag.description.toLowerCase().includes(searchLower)
    );
    
    if (matching.length > 0) {
      results[category] = matching;
    }
  });
  
  return results;
}

/**
 * Validate if a merge tag key exists
 */
export function isValidMergeTag(tagKey) {
  for (const entity of Object.values(GLOBAL_MERGE_TAGS)) {
    if (entity.tags.some(tag => tag.key === tagKey)) {
      return true;
    }
  }
  return false;
}

/**
 * Get tag metadata by key
 */
export function getTagMetadata(tagKey) {
  for (const entity of Object.values(GLOBAL_MERGE_TAGS)) {
    const tag = entity.tags.find(t => t.key === tagKey);
    if (tag) {
      return {
        ...tag,
        category: entity.category
      };
    }
  }
  return null;
}