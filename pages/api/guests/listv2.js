const { Guest, Booking } = require("../../../models");
import StorageService from "../../../services/storage/storage";
import { Op } from 'sequelize';

// Performance constants
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

async function handler(req, res) {
  if (req.method === "GET") {
    const {
      // Pagination parameters
      limit,
      offset,
      page,
      
      // Search parameters
      search,
      
      // Filter parameters
      active_only,
      email_verified_only,
      
      // Include parameters (for backward compatibility)
      include_bookings,
      include_profile_urls,
      
      // Performance mode (lightweight for course offers)
      lightweight
    } = req.query;

    try {
      // Determine if this is a lightweight request (for course offers)
      const isLightweight = lightweight === 'true';
      
      // Calculate pagination
      let processedLimit, processedOffset;
      
      if (limit || offset || page) {
        // Pagination requested
        processedLimit = limit ? Math.min(parseInt(limit), MAX_LIMIT) : DEFAULT_LIMIT;
        processedOffset = offset ? parseInt(offset) : 
                         page ? (parseInt(page) - 1) * processedLimit : 0;
      } else if (isLightweight) {
        // Default pagination for lightweight mode
        processedLimit = DEFAULT_LIMIT;
        processedOffset = 0;
      }
      // If no pagination params and not lightweight, use original behavior (no pagination)

      // Build where clause
      const whereClause = {};
      
      if (active_only === 'true') {
        whereClause.active = true;
      }
      
      if (email_verified_only === 'true') {
        whereClause.email_verified = true;
      }

      // Add search functionality
      if (search && search.trim()) {
        const searchTerm = search.trim();
        whereClause[Op.or] = [
          {
            first_name: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
          {
            last_name: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
          {
            email: {
              [Op.iLike]: `%${searchTerm}%`
            }
          },
          // Search full name
          {
            [Op.or]: [
              {
                [Op.and]: [
                  { first_name: { [Op.iLike]: `%${searchTerm.split(' ')[0]}%` } },
                  { last_name: { [Op.iLike]: `%${searchTerm.split(' ').slice(-1)[0]}%` } }
                ]
              }
            ]
          }
        ];
      }

      // Build include array
      const includeArray = [];
      
      // Include bookings if requested (default true for backward compatibility)
      if (include_bookings !== 'false' && !isLightweight) {
        includeArray.push(Booking);
      }

      // Build query options
      const queryOptions = {
        where: whereClause,
        order: [['first_name', 'ASC'], ['last_name', 'ASC']],
        include: includeArray
      };

      // Add pagination if specified
      if (processedLimit !== undefined) {
        queryOptions.limit = processedLimit;
        queryOptions.offset = processedOffset;
      }

      // Choose appropriate query method
      let guests, totalCount;
      
      if (processedLimit !== undefined) {
        // Use findAndCountAll for paginated results
        const result = await Guest.findAndCountAll(queryOptions);
        guests = result.rows;
        totalCount = result.count;
      } else {
        // Use original findAll for backward compatibility
        guests = await Guest.findAll(queryOptions);
        totalCount = guests.length;
      }

      // Process guests based on request type
      let processedGuests;
      
      if (isLightweight) {
        // Lightweight processing for course offers (minimal data)
        processedGuests = guests.map(guest => {
          const temp = {
            id: guest.id,
            first_name: guest.first_name,
            last_name: guest.last_name,
            email: guest.email,
            phone_number: guest.phone_number,
            active: guest.active,
            email_verified: guest.email_verified == null ? (guest.password ? true : false) : guest.email_verified
          };
          return temp;
        });
      } else {
        // Full processing for backward compatibility
        const storage = new StorageService({ bucketType: 'restricted' });
        
        processedGuests = await Promise.all(
          guests.map(async guest => {
            let temp = { ...guest.dataValues };
            temp.email_verified = guest.email_verified == null ? guest.password ? true : false : guest.email_verified;
            
            // Get profile URL only if requested (default true for backward compatibility)
            if ((include_profile_urls !== 'false') && guest.profile_filename) {
              try {
                temp.profileUrl = await storage.getSignedUrl('profile-photo' + '/' + guest.profile_filename);
              } catch (error) {
                console.error('Error getting profile URL for guest:', guest.id, error);
                // Continue without profile URL
              }
            }
            
            // Process bookings if included
            if (temp.Bookings && Array.isArray(temp.Bookings)) {
              temp.Bookings = temp.Bookings.map(booking => {
                const bookingData = booking.dataValues || booking;
                const { signature, ...bookingWithoutSignature } = bookingData;
                return bookingWithoutSignature;
              });
            }
            
            delete temp.password;
            return temp;
          })
        );
      }

      // Build response
      const response = {
        message: "Successfully Fetched",
        users: processedGuests,
        // Backward compatibility - always include 'users' field
        ...(search && { searchTerm: search.trim() })
      };

      // Add pagination info if pagination was used
      if (processedLimit !== undefined) {
        const currentPage = Math.floor(processedOffset / processedLimit) + 1;
        const totalPages = Math.ceil(totalCount / processedLimit);
        const hasMore = (processedOffset + processedLimit) < totalCount;

        response.pagination = {
          total: totalCount,
          limit: processedLimit,
          offset: processedOffset,
          currentPage,
          totalPages,
          hasMore,
          showing: {
            from: processedOffset + 1,
            to: Math.min(processedOffset + processedLimit, totalCount),
            of: totalCount
          }
        };

        // Also add data field for consistency with new pattern
        response.data = processedGuests;
      }

      return res.status(200).json(response);

    } catch (error) {
      console.error('Error fetching guests:', error);
      
      return res.status(500).json({
        message: "Internal server error",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

  } else {
    return res.status(405).json({ message: "Method Not Allowed" });
  }
}

export default handler;