import { Course, CourseOffer, Guest } from '../../../models';
import StorageService from '../../../services/storage/storage';

export default async function handler(req, res) {
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
            // GET logic - exclude soft-deleted courses
            const course = await Course.findByPk(id);
            
            if (!course || course.deleted_at) {
                return res.status(404).json({
                    error: 'Course not found',
                    message: `Course with ID ${id} does not exist`
                });
            }

            let courseData = { ...course.dataValues };
            
            if (course.image_filename) {
                try {
                    courseData.imageUrl = await storage.getSignedUrl('courses/' + course.image_filename);
                } catch (error) {
                    console.error('Error generating signed URL:', error);
                    courseData.imageUrl = null;
                }
            }

            return res.status(200).json({
                success: true,
                data: courseData
            });
        }

        if (req.method === 'DELETE') {
            // ✅ SIMPLIFIED SOFT DELETE - Only check course offers
            const course = await Course.findOne({
                where: { id },
                paranoid: false, // Include soft-deleted records
                include: [{
                    model: CourseOffer,
                    as: 'offers',
                    include: [{
                        model: Guest,
                        as: 'guest'
                    }]
                }]
            });
            
            if (!course) {
                return res.status(404).json({
                    error: 'Course not found',
                    message: `Course with ID ${id} does not exist`
                });
            }

            if (course.deleted_at) {
                return res.status(400).json({
                    error: 'Course already deleted',
                    message: 'This course has already been deleted'
                });
            }

            // ✅ CHECK: Active course offers
            const activeOffers = course.offers?.filter(offer => 
                ['offered', 'accepted'].includes(offer.status) &&
                !offer.deleted_at
            ) || [];

            // ✅ CHECK: Course offers linked to bookings
            const linkedOffers = course.offers?.filter(offer => 
                offer.booking_id !== null &&
                !offer.deleted_at
            ) || [];

            // If there are active or linked offers, warn about deletion
            if (activeOffers.length > 0 || linkedOffers.length > 0) {
                const affectedGuests = new Map();
                
                [...activeOffers, ...linkedOffers].forEach(offer => {
                    if (offer.guest && !affectedGuests.has(offer.guest.id)) {
                        affectedGuests.set(offer.guest.id, {
                            id: offer.guest.id,
                            name: `${offer.guest.first_name} ${offer.guest.last_name}`,
                            email: offer.guest.email,
                            offerStatus: offer.status
                        });
                    }
                });

                return res.status(400).json({
                    error: 'Cannot delete course',
                    message: `This course has ${activeOffers.length + linkedOffers.length} active offer(s). Deleting this course may affect guest bookings.`,
                    details: {
                        activeOffers: activeOffers.length,
                        linkedOffers: linkedOffers.length,
                        affectedGuests: Array.from(affectedGuests.values())
                    },
                    recommendation: 'Any guests who selected this course in their booking forms will see a message to update their selection when they next access the form.'
                });
            }

            // ✅ PERFORM SOFT DELETE
            await course.update({ 
                deleted_at: new Date(),
                status: 'deleted'
            });

            console.log(`✅ Course ${id} (${course.title}) soft deleted successfully`);

            return res.status(200).json({
                success: true,
                message: 'Course deleted successfully',
                data: {
                    id: course.id,
                    title: course.title,
                    deleted_at: course.deleted_at
                }
            });
        }

    } catch (error) {
        console.error('Course API error:', error);

        if (error.name?.startsWith('Sequelize')) {
            return res.status(500).json({
                error: 'Database error',
                message: 'An error occurred while processing the course'
            });
        }

        return res.status(500).json({
            error: 'Internal server error',
            message: 'An unexpected error occurred'
        });
    }
}