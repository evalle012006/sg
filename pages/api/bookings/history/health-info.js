import { Booking, Guest, QaPair, Section, Question } from "../../../../models";
import { QUESTION_KEYS } from "../../../../services/booking/question-helper";
import { Op } from 'sequelize';

export default async function handler(req, res) {
    if (req.method === "POST") {
        const { uuid } = req.body;

        const guest = await Guest.findOne({ 
            where: { uuid: uuid }
        });

        if (!guest) {
            return res.status(404).json({ message: "Guest not found" });
        }

        // Find the most recent COMPLETED booking, or the latest booking if no completed ones exist
        const prevBooking = await Booking.findOne({ 
            where: { 
                guest_id: guest.id,
                deleted_at: null,
                // Get completed bookings OR the most recent one
                [Op.or]: [
                    { complete: true },
                    { 
                        id: {
                            [Op.eq]: Booking.sequelize.literal(
                                `(SELECT id FROM bookings WHERE guest_id = ${guest.id} AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1)`
                            )
                        }
                    }
                ]
            },
            include: [{ 
                model: Section, 
                include: [{ 
                    model: QaPair, 
                    include: [Question] 
                }] 
            }],
            order: [
                ['complete', 'DESC'], // Completed bookings first
                ['updated_at', 'DESC'] // Then most recently updated
            ]
        });

        if (!prevBooking) {
            return res.status(404).json({ message: "No previous booking found" });
        }

        let healthInfoQuestion;
        let fundingSourceQuestion;
        let ndisParticipantQuestion;
        let icareParticipantQuestion;

        // Search through all sections and QaPairs
        prevBooking.Sections.forEach(section => {
            section.QaPairs.forEach(qaPair => {
                const question = qaPair.Question;
                
                if (question && question.question_key) {
                    // Health information question
                    if (question.question_key === QUESTION_KEYS.HEALTH_CONDITIONS) {
                        healthInfoQuestion = qaPair;
                    }
                    // Funding source question
                    else if (question.question_key === QUESTION_KEYS.FUNDING_SOURCE) {
                        fundingSourceQuestion = qaPair;
                    }
                    // NDIS participant number
                    else if (question.question_key === QUESTION_KEYS.NDIS_PARTICIPANT_NUMBER) {
                        ndisParticipantQuestion = qaPair;
                    }
                    // iCare participant number
                    else if (question.question_key === QUESTION_KEYS.ICARE_PARTICIPANT_NUMBER) {
                        icareParticipantQuestion = qaPair;
                    }
                }
            });
        });

        // Prepare response data
        const responseData = {};

        // Health information
        if (healthInfoQuestion) {
            responseData.info = JSON.parse(healthInfoQuestion.answer || '[]');
            responseData.lastUpdated = healthInfoQuestion.updatedAt;
        } else {
            responseData.info = [];
            responseData.lastUpdated = null;
        }

        // Funding source
        responseData.funding_source = fundingSourceQuestion ? fundingSourceQuestion.answer : null;

        // Participant numbers
        responseData.ndis_participant_number = ndisParticipantQuestion ? ndisParticipantQuestion.answer : null;
        responseData.icare_participant_number = icareParticipantQuestion ? icareParticipantQuestion.answer : null;
        responseData.bookingId = prevBooking.uuid;

        return res.status(200).json(responseData);
    }
    
    return res.status(405).json({ message: "Method not allowed" });
}