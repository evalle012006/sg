import { Op } from 'sequelize';
import { Booking, BookingEquipment, EmailTrigger, Equipment, Guest, Log, QaPair, Question, QuestionDependency, Room, RoomType, Section } from '../../../../models';
import { dispatchHttpTaskHandler } from '../../../../services/queues/dispatchHttpTask';

export default async function handler(req, res) {

    if (req.method === 'POST') {
        const data = req.body;

        const currentLog = await Log.findOne({where: {id: data.id}});

        if (!currentLog) {
            return res.status(404).json({ message: 'Log not found' });
        }

        const booking = await Booking.findOne({ 
            where: { id: currentLog.loggable_id }, 
            include: [
                {
                    model: Section,
                    include: [QaPair],
                    order: [['order', 'ASC']]
                },
                { 
                    model: Room, 
                    include: [{ model: RoomType }] 
                }, 
                Guest
            ]
        });

        const emailTriggers = await EmailTrigger.findAll({ where: { enabled: true } });

        let updatedData = {
            ...currentLog.data,
            ...data,
        }

        if (booking) {
            const dataObj = { ...updatedData };

            if (data.approved) {
               // should get the current email triggers and check if the question is included in the email triggers
                for (let i = 0; i < emailTriggers.length; i++) {
                    const emailTrigger = emailTriggers[i];
                    if (emailTrigger.question && emailTrigger.question.includes(dataObj?.qa_pair?.question)) {
                        dispatchHttpTaskHandler('booking', { type: 'triggerEmailPerQuestion', payload: { booking: booking, question: dataObj?.qa_pair?.question, answer: dataObj?.qa_pair?.answer } });
                    }
                }
                
                const updatedLog = await Log.update({data: updatedData}, {where: {id: data.id}});

                if (updatedLog) {
                    return res.status(200).json({ message: 'Log updated successfully' });
                }
            } else { // need to cater all question type
                updatedData = {
                    ...updatedData,
                    answer: currentLog.data.oldAnswer
                }

                const parsedOldAnswer = parseOldAnswer(dataObj);
                
                const { qa_pair } = dataObj;
                // console.log(qa_pair)
                if (currentLog.type == 'equipment' || qa_pair?.question?.includes('Equipment')) {
                    let equipmentId = null;
                    if (dataObj?.id) {
                        equipmentId = dataObj.id;
                    } else {
                        const equipment = await Equipment.findOne({ where: { name: dataObj.oldAnswer } });
                        if (equipment) {
                            equipmentId = equipment.id;
                        }
                    }

                    const bookingEquipment = await BookingEquipment.findOne({ where: { equipment_id: equipmentId, booking_id: booking.id } });
                    if (bookingEquipment) {
                        await BookingEquipment.update({ equipment_id: equipmentId }, { where: { id: bookingEquipment.id } });
                    }
                } else {
                    const qaPair = getQaPairFromBooking(booking, qa_pair.question);
                    if (qaPair) {
                        const questionDepencies = await QuestionDependency.findAll({ where: { dependence_id: qaPair.id } });
                        const questionDepenciesIds = questionDepencies.map(qd => qd.question_id);
                        if (questionDepenciesIds.length > 0) {
                            console.log('deleting question dependencies', questionDepenciesIds);
                            // await QaPair.destroy({ where: { questionId: { [Op.in] : questionDepenciesIds } } });
                        }
                        await QaPair.update({ answer: parsedOldAnswer }, { where: { id: qaPair.id } });
                    }
                }

                const deletedLog = await Log.destroy({where: {id: data.id}});

                if (deletedLog) {
                    return res.status(200).json({ message: 'Answer to the question reverted due to declining of changes.' });
                }
            }
        }

        return res.status(400).json({ message: 'Error updating log' });
    }

    return res.status(401).json({ message: 'Method not allowed' });
}

const getQaPairFromBooking = (booking, question) => {
    if (!booking || (!booking.Sections && booking.Sections.length > 0)) {
        console.log("no booking or sections")
        return null;
    }

    const qaPairs = booking.Sections.map(section => section.QaPairs).flat();
  
    const qa_Pair = qaPairs.find(qa => 
        qa.question.toLowerCase() == question.toLowerCase()
    );

    if (qa_Pair) {
        return qa_Pair;
    }
  
    return null;
};

const parseOldAnswer = (logData) => {
    const { qa_pair } = logData;

    if (!qa_pair || !qa_pair.oldAnswer) {
      return null;
    }
  
    try {
      switch (qa_pair.question_type) {
        case 'data':
        case 'date-range':
        case 'text':
        case 'phone-number':
        case 'email':
        case 'year':
          return String(qa_pair.oldAnswer);
  
        case 'radio':
        case 'select':
          if (typeof qa_pair.oldAnswer === 'string') {
            try {
              const parsed = JSON.parse(qa_pair.oldAnswer);
              return typeof parsed === 'object' ? parsed.value || parsed.name || parsed : qa_pair.oldAnswer;
            } catch {
              return qa_pair.oldAnswer;
            }
          }
          return String(qa_pair.oldAnswer);
  
        case 'checkbox':
          try {
            const parsed = typeof qa_pair.oldAnswer === 'string' 
              ? JSON.parse(qa_pair.oldAnswer) 
              : qa_pair.oldAnswer;
            
            if (Array.isArray(parsed)) {
              return JSON.stringify(parsed);
            }
            return String(parsed);
          } catch {
            return String(qa_pair.oldAnswer);
          }
  
        default:
          return String(qa_pair.oldAnswer);
      }
    } catch (error) {
      console.error(`Error parsing oldAnswer for type ${qa_pair.question_type}:`, error);
      return String(qa_pair.oldAnswer);
    }
  };