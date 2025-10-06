import { Course } from '../../../models'
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
    // Only allow GET method
    if (req.method !== 'GET') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only GET method is supported'
        });
    }

    const storage = new StorageService({ bucketType: 'restricted' });

    try {
        // Get query parameters
        const { active } = req.query;

        // Build where clause for filtering
        let whereClause = { deleted_at: null }; // Exclude soft-deleted courses by default
        
        // Filter for active courses if parameter is provided
        if (active === 'true') {
            whereClause.status = 'active';
        }

        // Get courses with optional filtering
        const courses = await Course.findAll({
            where: whereClause,
            order: [['created_at', 'DESC']] // Order by newest first
        });

        const updatedCourses = await Promise.all(
            courses.map(async course => {
                let temp = { ...course.dataValues };
                if (course.image_filename) {
                    try {
                        // Generate signed URL for course image (matching existing path structure)
                        temp.imageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
                    } catch (error) {
                        console.error('Error generating signed URL for course image:', error);
                        temp.imageUrl = null; // Fallback if URL generation fails
                    }
                }
                return temp;
            })
        );

        return res.status(200).json({
            success: true,
            courses: updatedCourses,
            total: updatedCourses.length,
            filtered: active === 'true' // Indicate if results were filtered
        });

    } catch (error) {
        console.error('Course API error:', error);

        // Handle Sequelize errors
        if (error.name?.startsWith('Sequelize')) {
            return res.status(500).json({
                error: 'Database error',
                message: 'An error occurred while fetching courses'
            });
        }

        // Handle unexpected errors
        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
}