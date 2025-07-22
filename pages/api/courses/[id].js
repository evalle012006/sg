import { Course } from '../../../models'
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
    // Only allow GET and DELETE methods
    if (req.method !== 'GET' && req.method !== 'DELETE') {
        return res.status(405).json({ 
            error: 'Method not allowed',
            message: 'Only GET and DELETE methods are supported'
        });
    }

    const { id } = req.query;
    const storage = new StorageService({ bucketType: 'restricted' });

    try {
        if (req.method === 'GET') {
            // Get single course by ID
            const course = await Course.findByPk(id);
            
            if (!course) {
                return res.status(404).json({
                    error: 'Course not found',
                    message: `Course with ID ${id} does not exist`
                });
            }

            let courseData = { ...course.dataValues };
            
            // Generate signed URL for image if it exists
            if (course.image_filename) {
                try {
                    courseData.imageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
                } catch (error) {
                    console.error('Error generating signed URL for course image:', error);
                    courseData.imageUrl = null; // Fallback if URL generation fails
                }
            }

            return res.status(200).json({
                success: true,
                data: courseData
            });
        }

        if (req.method === 'DELETE') {
            // Delete course by ID
            const course = await Course.findByPk(id);
            
            if (!course) {
                return res.status(404).json({
                    error: 'Course not found',
                    message: `Course with ID ${id} does not exist`
                });
            }

            // Delete associated image file if it exists
            if (course.image_filename) {
                try {
                    await storage.deleteFile('courses/', course.image_filename);
                } catch (error) {
                    console.error('Error deleting course image:', error);
                    // Continue with course deletion even if image deletion fails
                }
            }

            // Delete the course
            await course.destroy();

            return res.status(200).json({
                success: true,
                message: 'Course deleted successfully'
            });
        }

    } catch (error) {
        console.error('Course API error:', error);

        // Handle Sequelize errors
        if (error.name?.startsWith('Sequelize')) {
            return res.status(500).json({
                error: 'Database error',
                message: 'An error occurred while processing the course'
            });
        }

        // Handle unexpected errors
        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
}