import { Course, CourseRate } from '../../../models'
import { v4 as uuidv4 } from 'uuid'
import { calculateCoursePrice } from '../../../services/courses/server-course-calculator';
import moment from 'moment';

export default async function handler(req, res) {
  // Only allow POST and PUT methods
  if (req.method !== 'POST' && req.method !== 'PUT') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST and PUT methods are supported'
    });
  }

  try {
    const { 
      id, 
      uuid, 
      title,
      description,
      start_date,
      end_date,
      min_start_date,
      min_end_date,
      duration_hours,
      image_filename,
      status,
      recalculate_prices = true // Option to skip price recalculation
    } = req.body;

    // Validate required fields
    if (!title || !start_date || !end_date || !min_start_date || !min_end_date) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Title, start_date, end_date, min_start_date, and min_end_date are required fields'
      });
    }

    // Simple date format validation (YYYY-MM-DD)
    const isValidDateFormat = (dateString) => {
      if (!dateString) return false;
      const regex = /^\d{4}-\d{2}-\d{2}$/;
      if (!regex.test(dateString)) return false;
      const date = moment(dateString, 'YYYY-MM-DD', true);
      return date.isValid();
    };

    // Validate date formats
    if (!isValidDateFormat(start_date) || !isValidDateFormat(end_date) || 
        !isValidDateFormat(min_start_date) || !isValidDateFormat(min_end_date)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'All date fields must be valid dates in YYYY-MM-DD format'
      });
    }

    // Use moment for date comparisons
    const startMoment = moment(start_date);
    const endMoment = moment(end_date);
    const minStartMoment = moment(min_start_date);
    const minEndMoment = moment(min_end_date);

    // Date validation logic
    if (startMoment.isAfter(endMoment)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'End date must be after or same as start date'
      });
    }

    if (minStartMoment.isAfter(minEndMoment)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Minimum end date must be after or same as minimum start date'
      });
    }

    if (minStartMoment.isAfter(startMoment)) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Minimum start date must be before or on the course start date'
      });
    }

    // Validate status
    if (status !== undefined && status !== null) {
      const validStatuses = ['pending', 'active', 'archived'];
      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Status must be one of: pending, active, archived'
        });
      }
    }

    // Prepare base course data - pass date strings directly (no conversion)
    const courseData = {
      title: title.trim(),
      description: description?.trim() || null,
      start_date: start_date,
      end_date: end_date,
      min_start_date: min_start_date,
      min_end_date: min_end_date,
      duration_hours: duration_hours?.trim() || null,
      image_filename: image_filename?.trim() || null,
      status: status || 'pending'
    };

    // Calculate pricing if requested, otherwise use prices from request body
    let priceData = {
      holiday_price: null,
      sta_price: null,
      price_calculated_at: null,
      rate_snapshot: null
    };

    if (recalculate_prices) {
      try {
        // Get current course rates
        const courseRates = await CourseRate.findAll({
          order: [
            ['category', 'ASC'],
            ['day_type', 'ASC'],
            ['order', 'ASC']
          ]
        });

        // Calculate prices
        priceData = await calculateCoursePrice(courseData, courseRates);
        
        console.log('Price calculation result:', priceData);
      } catch (error) {
        console.error('Error calculating prices during save:', error);
        priceData.price_calculated_at = new Date();
        priceData.rate_snapshot = {
          calculated_at: new Date().toISOString(),
          error: error.message
        };
      }
    } else {
      // Use prices from the request body (already calculated on frontend)
      const { holiday_price, sta_price, price_calculated_at, rate_snapshot } = req.body;
      priceData = {
        holiday_price: holiday_price ?? null,
        sta_price: sta_price ?? null,
        price_calculated_at: price_calculated_at ?? null,
        rate_snapshot: rate_snapshot ?? null
      };
      console.log('Using prices from request body:', priceData);
    }

    // Merge course data with price data
    const finalCourseData = { ...courseData, ...priceData };

    let course;
    let isUpdate = false;

    // Determine if this is an update or create operation
    if (id) {
      // Update existing course
      const existingCourse = await Course.findByPk(id);
      
      if (!existingCourse) {
        return res.status(404).json({
          error: 'Course not found',
          message: `Course with ID ${id} does not exist`
        });
      }

      // Check if dates changed using moment for comparison
      const existingStartDate = moment(existingCourse.start_date).format('YYYY-MM-DD');
      const existingEndDate = moment(existingCourse.end_date).format('YYYY-MM-DD');
      
      const datesChanged = existingStartDate !== start_date || existingEndDate !== end_date;

      if (datesChanged && !recalculate_prices) {
        console.log('Course dates changed, forcing price recalculation');
        // Recalculate prices since dates changed
        try {
          const courseRates = await CourseRate.findAll({
            order: [['category', 'ASC'], ['day_type', 'ASC'], ['order', 'ASC']]
          });
          const newPriceData = await calculateCoursePrice(courseData, courseRates);
          Object.assign(finalCourseData, newPriceData);
        } catch (error) {
          console.error('Error recalculating prices after date change:', error);
        }
      }

      // Update the course
      await existingCourse.update(finalCourseData);
      course = existingCourse;
      isUpdate = true;
    } else {
      // Create new course - generate UUID if not provided
      finalCourseData.uuid = uuid?.trim() || uuidv4();
      
      // Check if UUID already exists (if provided)
      if (uuid) {
        const existingCourseWithUuid = await Course.findOne({ 
          where: { uuid: finalCourseData.uuid } 
        });
        
        if (existingCourseWithUuid) {
          return res.status(409).json({
            error: 'Conflict error',
            message: 'A course with this UUID already exists'
          });
        }
      }

      course = await Course.create(finalCourseData);
    }

    // Return success response
    return res.status(isUpdate ? 200 : 201).json({
      success: true,
      message: isUpdate ? 'Course updated successfully' : 'Course created successfully',
      data: course,
      pricing: priceData.holiday_price !== null ? {
        holiday_price: priceData.holiday_price,
        sta_price: priceData.sta_price,
        calculated_at: priceData.price_calculated_at
      } : null
    });

  } catch (error) {
    console.error('Course save/update error:', error);

    // Handle Sequelize validation errors
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Invalid data provided',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    // Handle Sequelize unique constraint errors
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({
        error: 'Conflict error',
        message: 'Course with this data already exists',
        details: error.errors.map(err => ({
          field: err.path,
          message: err.message
        }))
      });
    }

    // Handle foreign key constraint errors
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        error: 'Foreign key error',
        message: 'Invalid foreign key provided'
      });
    }

    // Handle other database errors
    if (error.name?.startsWith('Sequelize')) {
      return res.status(500).json({
        error: 'Database error',
        message: 'An error occurred while saving the course'
      });
    }

    // Handle unexpected errors
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred'
    });
  }
}