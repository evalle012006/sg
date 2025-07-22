import { Course, CourseRate } from '../../../models'
import { calculateCoursePrice } from '../../../services/courses/server-course-calculator';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed',
      message: 'Only POST method is supported'
    });
  }

  try {
    const { courseId, allCourses } = req.body;

    // Get current course rates
    const courseRates = await CourseRate.findAll({
      order: [
        ['category', 'ASC'],
        ['day_type', 'ASC'],
        ['order', 'ASC']
      ]
    });

    if (courseRates.length === 0) {
      return res.status(400).json({
        error: 'No rates configured',
        message: 'Please configure course rates before calculating prices'
      });
    }

    let results = [];

    if (allCourses) {
      // Recalculate prices for all courses
      const courses = await Course.findAll({
        where: {
          start_date: { [require('sequelize').Op.ne]: null },
          end_date: { [require('sequelize').Op.ne]: null }
        }
      });

      for (const course of courses) {
        try {
          const priceData = await calculateCoursePrice(course.dataValues, courseRates);
          
          await course.update({
            holiday_price: priceData.holiday_price,
            sta_price: priceData.sta_price,
            price_calculated_at: priceData.price_calculated_at,
            rate_snapshot: priceData.rate_snapshot
          });

          results.push({
            id: course.id,
            title: course.title,
            holiday_price: priceData.holiday_price,
            sta_price: priceData.sta_price,
            success: true
          });
        } catch (error) {
          console.error(`Error recalculating prices for course ${course.id}:`, error);
          results.push({
            id: course.id,
            title: course.title,
            success: false,
            error: error.message
          });
        }
      }

      return res.status(200).json({
        success: true,
        message: `Recalculated prices for ${results.filter(r => r.success).length} out of ${results.length} courses`,
        results
      });

    } else if (courseId) {
      // Recalculate prices for specific course
      const course = await Course.findByPk(courseId);
      
      if (!course) {
        return res.status(404).json({
          error: 'Course not found',
          message: `Course with ID ${courseId} does not exist`
        });
      }

      const priceData = await calculateCoursePrice(course.dataValues, courseRates);
      
      await course.update({
        holiday_price: priceData.holiday_price,
        sta_price: priceData.sta_price,
        price_calculated_at: priceData.price_calculated_at,
        rate_snapshot: priceData.rate_snapshot
      });

      return res.status(200).json({
        success: true,
        message: 'Course prices recalculated successfully',
        data: {
          id: course.id,
          title: course.title,
          holiday_price: priceData.holiday_price,
          sta_price: priceData.sta_price,
          price_calculated_at: priceData.price_calculated_at
        }
      });

    } else {
      return res.status(400).json({
        error: 'Missing parameter',
        message: 'Please provide either courseId or set allCourses to true'
      });
    }

  } catch (error) {
    console.error('Error recalculating course prices:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'An error occurred while recalculating prices',
      details: error.message
    });
  }
}