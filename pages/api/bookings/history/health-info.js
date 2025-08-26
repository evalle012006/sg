import { Booking, Guest, QaPair, Section, Question } from "../../../../models";
import { QUESTION_KEYS } from "../../../../services/booking/question-helper";

export default async function handler(req, res) {
    if (req.method === "POST") {
        const { uuid } = req.body;

        const guest = await Guest.findOne({ 
            where: { uuid: uuid }, 
            include: [Booking], 
            order: [["createdAt", "DESC"]] 
        });

        if (guest?.Bookings.length > 0) {
            const prevBooking = await Booking.findOne({ 
                where: { id: guest.Bookings[0].id }, 
                include: [{ 
                    model: Section, 
                    include: [{ 
                        model: QaPair, 
                        include: [Question] 
                    }] 
                }] 
            });

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

            return res.status(200).json(responseData);
        }

        return res.status(404).json({ message: "No previous booking found" });
    }
    
    return res.status(405).json({ message: "Method not allowed" });
}