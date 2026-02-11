
/**
 * Fetch guest list with advanced filtering and pagination
 * Uses the optimized /api/guests/listv2 endpoint
 * 
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number (1-based)
 * @param {number} params.limit - Items per page (max 100)
 * @param {number} params.offset - Skip N items (alternative to page)
 * @param {string} params.search - Search term for name/email
 * @param {boolean} params.active_only - Only return active guests
 * @param {boolean} params.email_verified_only - Only return verified guests
 * @param {boolean} params.include_bookings - Include booking data (default: false for performance)
 * @param {boolean} params.include_profile_urls - Include signed profile URLs (default: true)
 * @param {boolean} params.lightweight - Minimal data mode for dropdowns/selects
 * @returns {Promise<Object>} Guest list with optional pagination info
 */
export async function getGuestList(params = {}) {
  const {
    page,
    limit,
    offset,
    search,
    active_only,
    email_verified_only,
    include_bookings,
    include_profile_urls,
    lightweight
  } = params;
  
  const queryParams = new URLSearchParams();
  
  // Add pagination parameters
  if (page !== undefined) queryParams.append('page', page.toString());
  if (limit !== undefined) queryParams.append('limit', limit.toString());
  if (offset !== undefined) queryParams.append('offset', offset.toString());
  
  // Add search parameter
  if (search) queryParams.append('search', search);
  
  // Add filter parameters
  if (active_only !== undefined) queryParams.append('active_only', active_only.toString());
  if (email_verified_only !== undefined) queryParams.append('email_verified_only', email_verified_only.toString());
  
  // Add include parameters
  if (include_bookings !== undefined) queryParams.append('include_bookings', include_bookings.toString());
  if (include_profile_urls !== undefined) queryParams.append('include_profile_urls', include_profile_urls.toString());
  
  // Add performance mode
  if (lightweight !== undefined) queryParams.append('lightweight', lightweight.toString());

  const url = `/api/guests/listv2${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error('Failed to fetch guest list');
  }
  
  return response.json();
}

/**
 * Update guest email verification status
 * @param {string} uuid - Guest UUID
 * @param {boolean} emailVerified - New verification status
 * @returns {Promise<Object>} Updated guest data
 */
export async function updateGuestEmailVerification(uuid, emailVerified) {
  const response = await fetch(`/api/guests/${uuid}/verify-email`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ email_verified: emailVerified })
  });
  
  if (!response.ok) {
    throw new Error('Failed to update email verification status');
  }
  
  return response.json();
}

/**
 * Lightweight guest fetch for dropdowns and selects
 * Returns minimal data for performance
 * @param {Object} params - Optional filter parameters
 * @returns {Promise<Array>} Array of guest objects with minimal data
 */
export async function getGuestsLightweight(params = {}) {
  const result = await getGuestList({
    ...params,
    lightweight: true,
    include_bookings: false,
    include_profile_urls: false
  });
  
  return result.users || result.data || [];
}

/**
 * Search guests by name, email, or phone
 * @param {string} searchTerm - Search query
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Filtered guest list
 */
export async function searchGuests(searchTerm, options = {}) {
  return getGuestList({
    search: searchTerm,
    ...options
  });
}

/**
 * Get paginated guest list
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @param {Object} filters - Additional filters
 * @returns {Promise<Object>} Paginated guest list with metadata
 */
export async function getGuestsPaginated(page = 1, limit = 15, filters = {}) {
  return getGuestList({
    page,
    limit,
    ...filters
  });
}

/**
 * Get active guests only
 * Useful for course offers, bookings, etc.
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} Active guests
 */
export async function getActiveGuests(params = {}) {
  return getGuestList({
    active_only: true,
    ...params
  });
}

/**
 * Get verified guests only
 * @param {Object} params - Additional parameters
 * @returns {Promise<Object>} Verified guests
 */
export async function getVerifiedGuests(params = {}) {
  return getGuestList({
    email_verified_only: true,
    ...params
  });
}


export async function forgotPassword(email) {

  const response = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({email: email, usertype:'guest'}),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  
    const data = await response.json();
  
    if(!response.ok){
      throw new Error(data.message || 'Something went wrong');
    }
    
    return data;
}