import { Guest, User, Booking } from '../../../models'; 
import { Op } from 'sequelize';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_OFFSET = 0;

export default async function handler(req, res) {
  const { method } = req;

  try {
    switch (method) {
      case 'GET':
        return await getGuests(req, res);
      default:
        return res.status(405).json({
          error: 'Method not allowed',
          message: `Method ${method} is not supported`
        });
    }
  } catch (error) {
    console.error('Guests API error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}

// Get guests with search, pagination, and filtering
async function getGuests(req, res) {
  const {
    limit = DEFAULT_LIMIT,
    offset = DEFAULT_OFFSET,
    search = '',
    active = null,
    include_bookings = 'false',
    include_profile_urls = 'false',
    lightweight = 'false',
    order_by = 'created_at',
    order_direction = 'DESC'
  } = req.query;

  try {
    // Validate and sanitize pagination parameters
    const parsedLimit = Math.min(parseInt(limit) || DEFAULT_LIMIT, MAX_LIMIT);
    const parsedOffset = Math.max(parseInt(offset) || DEFAULT_OFFSET, 0);

    // Build where clause
    const whereClause = {};
    
    // Active filter
    if (active !== null && active !== undefined && active !== '') {
      const isActive = active === 'true' || active === '1';
      whereClause.active = isActive;
    }

    // Search functionality - MySQL compatible (using LIKE instead of ILIKE)
    if (search && search.trim()) {
      const searchTerm = search.trim();
      
      // Use LIKE for MySQL compatibility (case sensitivity depends on MySQL collation)
      whereClause[Op.or] = [
        {
          first_name: {
            [Op.like]: `%${searchTerm}%`
          }
        },
        {
          last_name: {
            [Op.like]: `%${searchTerm}%`
          }
        },
        {
          email: {
            [Op.like]: `%${searchTerm}%`
          }
        }
      ];

      // If search looks like a phone number, include phone search
      if (/[\d\-\+\(\)\s]+/.test(searchTerm)) {
        whereClause[Op.or].push({
          phone_number: {
            [Op.like]: `%${searchTerm.replace(/[\s\-\(\)]/g, '')}%`
          }
        });
      }

      // Search for full name combinations
      const nameParts = searchTerm.split(' ').filter(part => part.length > 0);
      if (nameParts.length >= 2) {
        whereClause[Op.or].push({
          [Op.and]: [
            { first_name: { [Op.like]: `%${nameParts[0]}%` } },
            { last_name: { [Op.like]: `%${nameParts[nameParts.length - 1]}%` } }
          ]
        });
      }
    }

    // Build include clause based on request parameters
    const includeClause = [];
    
    if (include_bookings === 'true') {
      includeClause.push({
        model: Booking,
        as: 'Bookings',
        attributes: ['id', 'reference_id', 'status', 'check_in_date', 'check_out_date', 'created_at'],
        required: false
      });
    }

    // Determine attributes to return
    let attributes;
    if (lightweight === 'true') {
      // Minimal data for performance
      attributes = [
        'id', 'uuid', 'first_name', 'last_name', 'email', 'phone_number', 
        'active', 'created_at', 'updated_at'
      ];
    } else {
      // Full guest data based on actual model
      attributes = [
        'id', 'uuid', 'first_name', 'last_name', 'email', 'phone_number',
        'profile_filename', 'gender', 'dob', 'email_verified', 'flags',
        'address_street1', 'address_street2', 'address_city', 
        'address_state_province', 'address_postal', 'address_country',
        'active', 'created_at', 'updated_at'
      ];
    }

    // Execute query with count for pagination
    const { count, rows: guests } = await Guest.findAndCountAll({
      where: whereClause,
      include: includeClause,
      attributes,
      order: [['first_name', 'ASC'], ['last_name', 'ASC']], // Always order by name alphabetically
      limit: parsedLimit,
      offset: parsedOffset,
      distinct: true // Important when using includes
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(count / parsedLimit);
    const currentPage = Math.floor(parsedOffset / parsedLimit) + 1;
    const hasMore = (parsedOffset + parsedLimit) < count;

    // Process guests for additional data if needed
    const processedGuests = guests.map(guest => {
      const guestData = guest.toJSON();
      
      // Add computed fields
      guestData.full_name = `${guestData.first_name} ${guestData.last_name}`;
      
      // Add profile URL if requested (placeholder implementation)
      if (include_profile_urls === 'true') {
        guestData.profile_url = `/guests/${guestData.uuid}`;
      }

      return guestData;
    });

    return res.status(200).json({
      success: true,
      data: processedGuests,
      pagination: {
        total: count,
        limit: parsedLimit,
        offset: parsedOffset,
        page: currentPage,
        totalPages,
        hasMore,
        showing: `${parsedOffset + 1}-${Math.min(parsedOffset + parsedLimit, count)} of ${count}`
      },
      filters: {
        search: search || null,
        active: active !== null ? (active === 'true' || active === '1') : null,
        include_bookings: include_bookings === 'true',
        lightweight: lightweight === 'true'
      }
    });

  } catch (error) {
    console.error('Error fetching guests:', error);
    
    if (error.name === 'SequelizeDatabaseError') {
      return res.status(400).json({
        error: 'Database error',
        message: 'Invalid query parameters or database constraint violation'
      });
    }

    throw error;
  }
}