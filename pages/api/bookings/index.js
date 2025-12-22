import { QUESTION_KEYS } from '../../../services/booking/question-helper';
import { Booking, Guest, QaPair, Section, Question, Package } from './../../../models'
import { Op } from 'sequelize'

// PRIMARY: Use predefined question keys as the authoritative list
const IMPORTANT_QUESTION_KEYS = [
  QUESTION_KEYS.CHECK_IN_OUT_DATE,
  QUESTION_KEYS.CHECK_IN_DATE,
  QUESTION_KEYS.CHECK_OUT_DATE,
  QUESTION_KEYS.ACCOMMODATION_PACKAGE_FULL,
  QUESTION_KEYS.ACCOMMODATION_PACKAGE_COURSES,
  QUESTION_KEYS.COURSE_SELECTION,
  QUESTION_KEYS.FUNDING_SOURCE
];

// SECONDARY: Exact question text matching for questions without proper question_keys
const IMPORTANT_QUESTION_TEXTS = [
  'Check In Date and Check Out Date',
  'Check In Date',
  'Check Out Date',
  'Please select your accommodation and assistance package below. By selecting a package type you are acknowledging that you are aware of the costs associated with your stay.',
  'Accommodation package options for Sargood Courses are:',
  'Which course?',
  'How will your stay be funded?'
];

const cache = {
  data: new Map(),
  ttl: 30 * 1000, // 30 seconds in milliseconds

  get(key) {
    if (this.data.has(key)) {
      const { value, timestamp } = this.data.get(key);
      if (Date.now() - timestamp < this.ttl) {
        return value;
      } else {
        this.data.delete(key);
      }
    }
    return null;
  },

  set(key, value) {
    this.data.set(key, {
      value,
      timestamp: Date.now()
    });
  },

  has(key) {
    if (!this.data.has(key)) return false;
    
    const { timestamp } = this.data.get(key);
    if (Date.now() - timestamp >= this.ttl) {
      this.data.delete(key);
      return false;
    }
    return true;
  },

  clear() {
    this.data.clear();
    return true;
  }
};

async function checkQuestionKeySupport() {
  try {
    const [columns] = await Question.sequelize.query(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'questions' AND column_name = 'question_key'`
    );
    const hasSupport = columns.length > 0;
    
    if (hasSupport) {
      const [keyCount] = await Question.sequelize.query(
        `SELECT COUNT(*) as count FROM questions WHERE question_key IS NOT NULL`
      );
    }
    
    return hasSupport;
  } catch (error) {
    console.error('Could not check question_key column existence:', error.message);
    return false;
  }
}

async function getImportantQuestions() {
  console.log('🔍 Finding important questions using precise matching...');
  
  try {
    const questionsByKey = await Question.findAll({
      where: {
        question_key: {
          [Op.in]: IMPORTANT_QUESTION_KEYS
        }
      },
      attributes: ['id', 'question', 'question_key'],
      include: [
        {
          model: QaPair,
          required: true,
          attributes: ['id']
        }
      ]
    });

    const questionsByText = await Question.findAll({
      include: [
        {
          model: QaPair,
          required: true,
          where: {
            question: {
              [Op.in]: IMPORTANT_QUESTION_TEXTS
            }
          },
          attributes: ['id']
        }
      ],
      attributes: ['id', 'question', 'question_key']
    });
    
    const allImportantQuestions = [];
    const seenIds = new Set();
    
    [...questionsByKey, ...questionsByText].forEach(q => {
      if (!seenIds.has(q.id)) {
        seenIds.add(q.id);
        allImportantQuestions.push(q);
      }
    });
    
    return {
      questions: allImportantQuestions,
      questionIds: allImportantQuestions.map(q => q.id),
      questionKeys: IMPORTANT_QUESTION_KEYS,
      questionTexts: IMPORTANT_QUESTION_TEXTS
    };
    
  } catch (error) {
    console.error('Error getting important questions:', error.message);
    return {
      questions: [],
      questionIds: [],
      questionKeys: IMPORTANT_QUESTION_KEYS,
      questionTexts: IMPORTANT_QUESTION_TEXTS
    };
  }
}

async function getImportantQAPairsPrecise(bookingIds) {
  const importantQuestionData = await getImportantQuestions();
  const { questionIds, questionKeys, questionTexts } = importantQuestionData;
  
  if (questionIds.length === 0) {
    console.log('No important questions found');
    return [];
  }
  
  const sectionsWithQaPairs = await Booking.sequelize.query(`
    SELECT DISTINCT s.id, s.model_id 
    FROM sections s
    JOIN qa_pairs qp ON qp.section_id = s.id
    LEFT JOIN questions q ON q.id = qp.question_id
    WHERE s.model_type = 'booking'
    AND s.model_id IN (:bookingIds)
    AND (
      -- Match by exact question IDs from our precise discovery
      q.id IN (:questionIds)
      OR
      -- Match by exact predefined question keys
      q.question_key IN (:questionKeys)
      OR
      -- Match by exact predefined question texts
      qp.question IN (:questionTexts)
      OR
      -- ADDED: Include package-selection question types
      q.type = 'package-selection'
    )
  `, {
    replacements: { 
      bookingIds: bookingIds,
      questionIds: questionIds,
      questionKeys: questionKeys,
      questionTexts: questionTexts
    },
    type: Booking.sequelize.QueryTypes.SELECT,
  });
  
  const results = Array.isArray(sectionsWithQaPairs) ? sectionsWithQaPairs : [];
  
  return results;
}

async function getImportantQAPairs(bookingIds, useQuestionKeys = true) {  
  if (useQuestionKeys) {
    const sectionsWithQaPairs = await Booking.sequelize.query(`
      SELECT DISTINCT s.id, s.model_id 
      FROM sections s
      JOIN qa_pairs qp ON qp.section_id = s.id
      JOIN questions q ON q.id = qp.question_id
      WHERE s.model_type = 'booking'
      AND s.model_id IN (:bookingIds)
      AND (
        q.question_key IN (:importantQuestionKeys)
        OR q.type = 'package-selection'
      )
    `, {
      replacements: { 
        bookingIds: bookingIds,
        importantQuestionKeys: IMPORTANT_QUESTION_KEYS
      },
      type: Booking.sequelize.QueryTypes.SELECT,
    });

    const results = Array.isArray(sectionsWithQaPairs) ? sectionsWithQaPairs : [];
    return results;
  } else {
    const sectionsWithQaPairs = await Booking.sequelize.query(`
      SELECT DISTINCT s.id, s.model_id 
      FROM sections s
      JOIN qa_pairs q ON q.section_id = s.id
      WHERE s.model_type = 'booking'
      AND s.model_id IN (:bookingIds)
      AND q.question IN (:importantQuestions)
    `, {
      replacements: { 
        bookingIds: bookingIds,
        importantQuestions: FALLBACK_IMPORTANT_QUESTIONS
      },
      type: Booking.sequelize.QueryTypes.SELECT,
    });

    const results = Array.isArray(sectionsWithQaPairs) ? sectionsWithQaPairs : [];
    return results;
  }
}

// Helper function to fetch package details for package-selection questions
async function enrichQAPairsWithPackageData(qaPairs) {
  if (!qaPairs || qaPairs.length === 0) {
    return qaPairs;
  }

  // Find all package-selection questions and collect package IDs
  const packageSelectionQAPairs = [];
  const packageIds = new Set();

  qaPairs.forEach(qaPair => {
    if (qaPair.Question?.type === 'package-selection' && qaPair.answer) {
      // Check if the answer looks like a package ID (numeric)
      const trimmedAnswer = qaPair.answer.toString().trim();
      if (/^\d+$/.test(trimmedAnswer)) {
        packageSelectionQAPairs.push(qaPair);
        packageIds.add(parseInt(trimmedAnswer));
      }
    }
  });

  if (packageIds.size === 0) {
    return qaPairs;
  }

  try {
    // Fetch package details for all found package IDs
    const packages = await Package.findAll({
      where: {
        id: {
          [Op.in]: Array.from(packageIds)
        }
      },
      attributes: ['id', 'name', 'package_code', 'funder', 'price', 'ndis_package_type', 'description', 'ndis_line_items', 'image_filename']
    });

    const packageMap = new Map();
    packages.forEach(pkg => {
      packageMap.set(pkg.id, pkg.toJSON ? pkg.toJSON() : {...pkg});
    });

    // Enrich the QA pairs with package information
    return qaPairs.map(qaPair => {
      if (qaPair.Question?.type === 'package-selection' && qaPair.answer) {
        const packageId = parseInt(qaPair.answer.toString().trim());
        if (packageMap.has(packageId)) {
          const packageData = packageMap.get(packageId);
          return {
            ...qaPair,
            packageDetails: packageData
          };
        }
      }
      return qaPair;
    });

  } catch (error) {
    console.error('Error fetching package details:', error.message);
    return qaPairs;
  }
}

// FIXED: Helper function to get section data with question key filtering
async function getSectionData(sectionIds, useQuestionKeys = true) {
  if (sectionIds.length === 0) {
    console.log('No section IDs provided, returning empty array');
    return [];
  }
  
  // Get important questions using precise matching
  const importantQuestionData = await getImportantQuestions();
  const { questionIds, questionKeys, questionTexts } = importantQuestionData;
  
  // Get all QA pairs for these sections first
  const result = await Section.findAll({
    include: [
      {
        model: QaPair,
        required: true,
        include: [
          {
            model: Question,
            required: false,
            attributes: ['id', 'question_key', 'question', 'type']
          }
        ],
        attributes: ['id', 'label', 'question', 'answer', 'question_type', 'question_id', 'section_id']
      }
    ],
    where: {
      id: {
        [Op.in]: sectionIds
      }
    },
    attributes: ['id', 'model_type', 'model_id', 'order', 'created_at', 'updated_at'],
  });
  
  const filteredResult = result.map(section => {
    const sectionData = section.toJSON ? section.toJSON() : {...section};
    
    if (sectionData.QaPairs) {
      sectionData.QaPairs = sectionData.QaPairs.filter(qaPair => {
        // Precise matching only - no pattern matching
        const matchesQuestionId = qaPair.question_id && questionIds.includes(qaPair.question_id);
        
        const matchesQuestionKey = qaPair.Question?.question_key && 
          questionKeys.includes(qaPair.Question.question_key);
        
        const matchesQuestionText = qaPair.question && 
          questionTexts.includes(qaPair.question);

        // ADDED: Check for package-selection question type
        const isPackageSelection = qaPair.Question?.question_type === 'package-selection';
        
        const isImportant = matchesQuestionId || matchesQuestionKey || matchesQuestionText || isPackageSelection;
        
        return isImportant;
      });
    }
    
    return sectionData;
  }).filter(section => section.QaPairs && section.QaPairs.length > 0);
  
  // Enrich QA pairs with package data for package-selection questions
  for (const section of filteredResult) {
    if (section.QaPairs) {
      section.QaPairs = await enrichQAPairsWithPackageData(section.QaPairs);
    }
  }
  
  return filteredResult;
}

async function getDirectSectionData(bookingIds) {
  const importantQuestionData = await getImportantQuestions();
  const { questionIds, questionKeys, questionTexts } = importantQuestionData;
  
  if (questionIds.length === 0) {
    console.log('No important questions found for direct approach');
    return {};
  }
  
  const sectionsWithQaPairs = await Booking.sequelize.query(`
    SELECT DISTINCT
      s.id as section_id,
      s.model_id as booking_id,
      s.model_type,
      s.order,
      s.created_at as section_created_at,
      s.updated_at as section_updated_at,
      qp.id as qa_pair_id,
      qp.label as qa_label,
      qp.question as qa_question,
      qp.answer as qa_answer,
      qp.question_type as qa_question_type,
      qp.question_id,
      q.question_key,
      q.type as question_question_type
    FROM sections s
    INNER JOIN qa_pairs qp ON qp.section_id = s.id
    LEFT JOIN questions q ON q.id = qp.question_id
    WHERE s.model_type = 'booking'
      AND s.model_id IN (:bookingIds)
      AND (
        -- Match by exact question IDs from precise discovery
        q.id IN (:questionIds)
        OR
        -- Match by exact predefined question keys
        q.question_key IN (:questionKeys)
        OR
        -- Match by exact predefined question texts
        qp.question IN (:questionTexts)
        OR
        -- ADDED: Include package-selection question types
        q.type = 'package-selection'
      )
    ORDER BY s.model_id, s.id, qp.id
  `, {
    replacements: { 
      bookingIds: bookingIds,
      questionIds: questionIds,
      questionKeys: questionKeys,
      questionTexts: questionTexts
    },
    type: Booking.sequelize.QueryTypes.SELECT,
  });
  
  // Handle the result properly
  const results = Array.isArray(sectionsWithQaPairs) ? sectionsWithQaPairs : [];
  
  if (results.length > 0) {
    const sectionsByBookingId = {};
    
    results.forEach(row => {
      const bookingId = row.booking_id;
      
      if (!sectionsByBookingId[bookingId]) {
        sectionsByBookingId[bookingId] = {};
      }
      
      const sectionId = row.section_id;
      if (!sectionsByBookingId[bookingId][sectionId]) {
        sectionsByBookingId[bookingId][sectionId] = {
          id: row.section_id,
          model_type: row.model_type,
          model_id: row.booking_id,
          order: row.order,
          created_at: row.section_created_at,
          updated_at: row.section_updated_at,
          QaPairs: []
        };
      }
      
      // Add QA pair
      if (row.qa_pair_id) {
        sectionsByBookingId[bookingId][sectionId].QaPairs.push({
          id: row.qa_pair_id,
          label: row.qa_label,
          question: row.qa_question,
          answer: row.qa_answer,
          question_type: row.qa_question_type,
          question_id: row.question_id,
          section_id: row.section_id,
          Question: {
            question_key: row.question_key,
            question_type: row.question_question_type
          }
        });
      }
    });
    
    // Convert to the expected format
    const result = {};
    Object.keys(sectionsByBookingId).forEach(bookingId => {
      result[bookingId] = Object.values(sectionsByBookingId[bookingId]);
    });
    
    // Enrich with package data
    for (const bookingId of Object.keys(result)) {
      for (const section of result[bookingId]) {
        if (section.QaPairs) {
          section.QaPairs = await enrichQAPairsWithPackageData(section.QaPairs);
        }
      }
    }
    
    return result;
  }
  
  console.log('getDirectSectionData: No data found');
  return {};
}

async function quickDataCheck(bookingIds) {
  try {
    // Check if bookings exist
    const bookings = await Booking.findAll({
      where: { id: { [Op.in]: bookingIds } },
      attributes: ['id', 'reference_id']
    });
    
    // Check sections for these bookings
    const sectionsResult = await Booking.sequelize.query(`
      SELECT s.id, s.model_id, COUNT(qp.id) as qa_count
      FROM sections s
      LEFT JOIN qa_pairs qp ON qp.section_id = s.id
      WHERE s.model_type = 'booking' AND s.model_id IN (:bookingIds)
      GROUP BY s.id, s.model_id
    `, {
      replacements: { bookingIds },
      type: Booking.sequelize.QueryTypes.SELECT
    });
    
    const sections = Array.isArray(sectionsResult) ? sectionsResult : [];
    
    if (sections.length == 0) {
      return false;
    }
    
    // Check question_key column
    const hasQuestionKeyResult = await Question.sequelize.query(`
      SELECT COUNT(*) as count FROM information_schema.columns 
      WHERE table_name = 'questions' AND column_name = 'question_key'
    `);
    const hasQuestionKey = hasQuestionKeyResult[0]?.[0]?.count > 0;
    
    if (hasQuestionKey) {
      const matchingKeysResult = await Question.sequelize.query(`
        SELECT q.question_key, COUNT(*) as count
        FROM questions q
        WHERE q.question_key IN (:keys)
        GROUP BY q.question_key
      `, {
        replacements: { keys: IMPORTANT_QUESTION_KEYS },
        type: Booking.sequelize.QueryTypes.SELECT
      });
    }
    
    const matchingTextsResult = await Booking.sequelize.query(`
      SELECT COUNT(*) as count
      FROM qa_pairs qp
      WHERE qp.question IN (:questions)
    `, {
      replacements: { questions: IMPORTANT_QUESTION_TEXTS },
      type: Booking.sequelize.QueryTypes.SELECT
    });

    return true;
    
  } catch (error) {
    console.error('Error in quickDataCheck:', error.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: `Method ${req.method} Not Allowed` });
  }

  try {
    const startTime = process.hrtime();
    
    const hasQuestionKeySupport = await checkQuestionKeySupport();
    
    // Parse pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;
    
    // Parse filter parameters
    const filterStatus = req.query.status || null;
    const filterEligibility = req.query.eligibility || null;
    const searchQuery = req.query.search || null;
    const isIncomplete = req.query.incomplete === 'true';
    const includeQA = req.query.include_qa === 'true';
    const invalidateCache = req.query.invalidate_cache === 'true';
    
    // If cache invalidation is requested, clear the cache
    if (invalidateCache) {
      cache.clear();
    }
    
    // Create a cache key based on all parameters (except invalidateCache)
    const cacheKey = JSON.stringify({
      page, limit, filterStatus, filterEligibility, searchQuery, isIncomplete, includeQA, hasQuestionKeySupport
    });
    
    // Try to get the data from cache first (but skip if invalidateCache is true)
    let processedBookings;
    let cachedData = null;
    
    if (!invalidateCache && cache.has(cacheKey)) {
      processedBookings = cache.get(cacheKey);
      cachedData = { cache: true };
    }
    
    // If we don't have cached data, fetch from the database
    if (!processedBookings) {
      // Check if optimized columns exist
      const [statusColumns] = await Booking.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'bookings' AND column_name = 'status_name'`
      );
      
      const [eligibilityColumns] = await Booking.sequelize.query(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'bookings' AND column_name = 'eligibility_name'`
      );
      
      const hasStatusName = statusColumns.length > 0;
      const hasEligibilityName = eligibilityColumns.length > 0;
      
      // Base query filters
      const where = {
        deleted_at: null,
      };
      
      if (!searchQuery) {
        // Add completion filter based on request type
        if (isIncomplete) {
          where[Op.or] = [
            { complete: false },
            { complete: null }
          ];
        } else {
          where[Op.or] = [
            { complete: true },
            { type: 'Enquiry' }
          ];
        }
        
        // Apply status filter if provided
        if (filterStatus && filterStatus !== 'all') {
          if (hasStatusName) {
            where.status_name = filterStatus;
          } else {
            where.status = {
              [Op.like]: `%"name":"${filterStatus}"%`
            };
          }
        }
        
        // Apply eligibility filter if provided
        if (filterEligibility && filterEligibility !== 'all') {
          if (hasEligibilityName) {
            where.eligibility_name = filterEligibility;
          } else {
            where.eligibility = {
              [Op.like]: `%"name":"${filterEligibility}"%`
            };
          }
        }
      }
      
      // THE KEY OPTIMIZATION: Only include what we absolutely need
      const queryAttributes = [
        'id', 'uuid', 'reference_id', 'status', 'status_name', 'eligibility', 
        'eligibility_name', 'type', 'type_of_spinal_injury', 'createdAt', 'updatedAt',
        'preferred_arrival_date', 'preferred_departure_date', 'label',
        'complete'
      ];
      
      // Build the query with limited attributes
      const query = {
        attributes: queryAttributes,
        where,
        include: [
          {
            model: Guest,
            required: false,
            // Only select the fields we need from Guest
            attributes: ['first_name', 'last_name', 'flags']
          }
        ],
        order: [["createdAt", "DESC"]]
      };
      
      // Execute the query without Sections
      const bookings = await Booking.findAll(query);
      
      // Process booking data
      let processedData = bookings.map(booking => {
        const bookingData = booking.toJSON ? booking.toJSON() : {...booking};
        
        // Add name property
        bookingData.name = bookingData?.Guest?.first_name + " " + bookingData?.Guest?.last_name;
        
        // Parse status once
        if (hasStatusName && bookingData.status_name) {
          bookingData.statusObj = { name: bookingData.status_name };
        } else {
          try {
            bookingData.statusObj = JSON.parse(bookingData.status || '{"name":"unknown"}');
          } catch (e) {
            bookingData.statusObj = { name: 'unknown' };
          }
        }
        
        // Initialize empty Sections array
        bookingData.Sections = [];
        
        return bookingData;
      });
      
      if (includeQA) {
        const bookingIds = processedData.map(b => b.id).filter(id => id);
        
        // Only proceed if we have bookingIds
        if (bookingIds && bookingIds.length > 0) {
          // Quick data verification
          await quickDataCheck(bookingIds);
          
          const sectionsWithQaPairs = await getImportantQAPairsPrecise(bookingIds);

          // Only fetch sections that we know have QaPairs
          if (sectionsWithQaPairs.length > 0) {
            const sectionIds = sectionsWithQaPairs.map(row => row.id);
            
            // Fetch sections with precise filtering
            const sectionsData = await getSectionData(sectionIds, hasQuestionKeySupport);
            // Map sections to bookings
            const sectionsByBookingId = {};
            sectionsData.forEach(section => {
              const bookingId = section.model_id;
              if (!sectionsByBookingId[bookingId]) {
                sectionsByBookingId[bookingId] = [];
              }
              sectionsByBookingId[bookingId].push(section.toJSON ? section.toJSON() : {...section});
            });
            
            // Add sections to the appropriate bookings
            processedData.forEach(booking => {
              booking.Sections = sectionsByBookingId[booking.id] || [];
            });
          } else {
            console.log('No sections with QA pairs found');
          }
        } else {
          console.log('No booking IDs available for section fetch');
        }
      }
      
      // Apply search filter if needed
      if (searchQuery) {
        const searchTermLower = searchQuery.toLowerCase();
        const originalCount = processedData.length;
        processedData = processedData.filter(booking => {
          return (
            (booking.reference_id && booking.reference_id.toLowerCase().includes(searchTermLower)) ||
            (booking.type && booking.type.toLowerCase().includes(searchTermLower)) ||
            (booking.type_of_spinal_injury && booking.type_of_spinal_injury.toLowerCase().includes(searchTermLower)) ||
            (booking.Guest?.first_name && booking.Guest.first_name.toLowerCase().includes(searchTermLower)) ||
            (booking.Guest?.last_name && booking.Guest.last_name.toLowerCase().includes(searchTermLower)) ||
            (booking.name && booking.name.toLowerCase().includes(searchTermLower))
          );
        });
        console.log(`Search filtered: ${originalCount} -> ${processedData.length} bookings`);
      }
      
      if (!searchQuery) {
        const sortByUpdatedAt = (a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt);
          const dateB = new Date(b.updatedAt || b.createdAt);
          return dateB - dateA; // Descending (latest first)
        };

        const guestCancelledBookings = processedData
          .filter(booking => booking.status && booking.status.includes('guest_cancelled'))
          .sort(sortByUpdatedAt);

        const amendedBookings = processedData
          .filter(booking => booking.status && booking.status.includes('booking_amended'))
          .sort(sortByUpdatedAt);

        const otherStatusBookings = processedData
          .filter(booking => 
            !booking.status || 
            (!booking.status.includes('guest_cancelled') && 
            !booking.status.includes('booking_amended'))
          )
          .sort(sortByUpdatedAt);
    
        const sortedData = [...guestCancelledBookings, ...amendedBookings, ...otherStatusBookings];
        
        // Apply final filters for status exclusion
        if (filterStatus && filterStatus !== 'all') {
          processedBookings = sortedData;
        } else {
          if (hasStatusName) {
            processedBookings = sortedData.filter(b => 
              b.status_name !== 'booking_confirmed' && 
              b.status_name !== 'booking_cancelled'
            );
          } else {
            processedBookings = sortedData.filter(b => 
              !(b.status && b.status.includes('booking_confirmed')) && 
              !(b.status && b.status.includes('booking_cancelled'))
            );
          }
        }
      } else {
        processedBookings = processedData;
      }
      
      // Cache the full results
      cache.set(cacheKey, processedBookings);
    }
    
    // Get total count
    const totalCount = processedBookings.length;
    
    // Apply pagination
    const startIndex = offset;
    const endIndex = offset + limit;
    const paginatedBookings = processedBookings.slice(startIndex, endIndex);
    
    // Ensure totalPages is at least 1
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    
    // Calculate execution time
    const hrtime = process.hrtime(startTime);
    const executionTimeMs = hrtime[0] * 1000 + hrtime[1] / 1000000;
    
    if (!includeQA && paginatedBookings.length > 0) {
      const bookingIds = paginatedBookings.map(b => b.id).filter(id => id);
      
      if (bookingIds.length > 0) {
        // Quick data verification
        const hasData = await quickDataCheck(bookingIds);
        
        if (!hasData) {
          paginatedBookings.forEach(booking => {
            booking.Sections = [];
          });
        } else {
          try {
            // Try the original approach first
            const sectionsWithQaPairs = await getImportantQAPairs(bookingIds, hasQuestionKeySupport);
            if (sectionsWithQaPairs.length > 0) {
              const sectionIds = sectionsWithQaPairs.map(row => row.id);
              const sectionsData = await getSectionData(sectionIds, hasQuestionKeySupport);
              
              if (sectionsData.length > 0) {
                // Map sections to bookings
                const sectionsByBookingId = {};
                sectionsData.forEach(section => {
                  const bookingId = section.model_id;
                  if (!sectionsByBookingId[bookingId]) {
                    sectionsByBookingId[bookingId] = [];
                  }
                  sectionsByBookingId[bookingId].push(section.toJSON ? section.toJSON() : {...section});
                });
                
                // Assign to bookings
                paginatedBookings.forEach(booking => {
                  booking.Sections = sectionsByBookingId[booking.id] || [];
                });
              } else {
                // Fallback to direct approach
                const directSections = await getDirectSectionData(bookingIds);
                paginatedBookings.forEach(booking => {
                  booking.Sections = directSections[booking.id] || [];
                });
              }
            } else {
              // Fallback to direct approach
              const directSections = await getDirectSectionData(bookingIds);
              paginatedBookings.forEach(booking => {
                booking.Sections = directSections[booking.id] || [];
              });
            }
          } catch (error) {
            console.error('Error in primary approach, trying direct approach:', error.message);
            
            // Final fallback to direct approach
            try {
              const directSections = await getDirectSectionData(bookingIds);
              paginatedBookings.forEach(booking => {
                booking.Sections = directSections[booking.id] || [];
              });
            } catch (directError) {
              console.error('Direct approach also failed:', directError.message);
              // Set empty sections as final fallback
              paginatedBookings.forEach(booking => {
                booking.Sections = [];
              });
            }
          }
        }
      }
    }
    
    // Set response headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    console.log('Response summary:', {
      bookings: paginatedBookings.length,
      totalSections: paginatedBookings.reduce((sum, b) => sum + (b.Sections?.length || 0), 0),
      executionTimeMs: Math.round(executionTimeMs),
      cached: !!cachedData
    });
    
    return res.status(200).json({
      data: paginatedBookings,
      meta: {
        total: totalCount,
        page,
        limit,
        totalPages,
        executionTimeMs,
        cached: !!cachedData,
        usingQuestionKeys: hasQuestionKeySupport
      }
    });
  } catch (error) {
    return res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}