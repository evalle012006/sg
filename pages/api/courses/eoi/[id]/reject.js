import { CourseEOI, Guest } from "../../../../../models";


export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({
            success: false,
            message: 'Method not allowed'
        });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'EOI ID is required'
        });
    }

    try {
        // Find the EOI
        const eoi = await CourseEOI.findByPk(id, {
            include: [
                {
                    model: Guest,
                    as: 'guest',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                }
            ]
        });

        if (!eoi) {
            return res.status(404).json({
                success: false,
                message: 'EOI not found'
            });
        }

        // Check if already processed
        if (eoi.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: `EOI has already been ${eoi.status}`
            });
        }

        // Update EOI status to rejected
        await eoi.update({
            status: 'rejected',
            contacted_at: new Date()
        });

        return res.status(200).json({
            success: true,
            message: 'EOI rejected successfully',
            data: eoi
        });

    } catch (error) {
        console.error('Error rejecting EOI:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to reject EOI',
            error: error.message
        });
    }
}