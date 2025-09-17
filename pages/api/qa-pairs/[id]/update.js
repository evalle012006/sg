import { QaPair, Booking, Guest, Log, Section } from '../../../../models';

export default async function handler(req, res) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ 
            success: false, 
            message: 'Method not allowed' 
        });
    }

    const { id } = req.query;
    const { answer, oldAnswer } = req.body;

    if (!id) {
        return res.status(400).json({
            success: false,
            message: 'QA Pair ID is required'
        });
    }

    if (answer === undefined || answer === null) {
        return res.status(400).json({
            success: false,
            message: 'Answer is required'
        });
    }

    try {
        // Find the QA Pair with related data
        const qaPair = await QaPair.findOne({
            where: { id },
            include: [
                {
                    model: Section,
                    include: [
                        {
                            model: Booking,
                            include: [Guest]
                        }
                    ]
                }
            ]
        });

        if (!qaPair) {
            return res.status(404).json({
                success: false,
                message: 'QA Pair not found'
            });
        }

        const booking = qaPair.Section?.Booking;
        if (!booking) {
            return res.status(404).json({
                success: false,
                message: 'Associated booking not found'
            });
        }

        // Store the old answer for amendment tracking
        const previousAnswer = qaPair.answer;

        // Update the QA Pair
        await qaPair.update({
            answer: answer,
            updated_at: new Date()
        });

        // Create amendment log if booking is complete (for audit trail)
        if (booking.complete && previousAnswer !== answer) {
            const amendmentData = {
                approved: true, // Auto-approve admin updates
                approved_by: 'admin',
                approval_date: new Date(),
                modifiedBy: 'admin',
                modifiedDate: new Date(),
                qa_pair: {
                    id: qaPair.id,
                    question: qaPair.question,
                    answer: answer,
                    question_type: qaPair.question_type,
                    oldAnswer: previousAnswer,
                    question_key: qaPair.question_key
                }
            };

            await Log.create({
                data: amendmentData,
                type: 'qa_pair',
                loggable_type: 'booking',
                loggable_id: booking.id,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        return res.status(200).json({
            success: true,
            message: 'QA Pair updated successfully',
            data: {
                id: qaPair.id,
                question: qaPair.question,
                answer: answer,
                oldAnswer: previousAnswer,
                bookingId: booking.id,
                amendmentCreated: booking.complete && previousAnswer !== answer
            }
        });

    } catch (error) {
        console.error('Error updating QA Pair:', error);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
}