import { QaPair, Question, QuestionDependency, Section, sequelize } from "../../../../../../../../models";
import { arrayMoveImmutable } from 'array-move';
import { Op } from 'sequelize'

export default async function handler(req, res) {
    const { id, section_id } = req.query;

    if (req.method === "POST") {
        if ('order' in req.body) {
            const sections = await Section.findAll({ where: { model_id: id, model_type: 'page' }, order: [['order', 'ASC']], raw: true });
            const currentSection = sections.find(section => section.id === parseInt(section_id));

            const newSections = arrayMoveImmutable(sections, currentSection.order - 1, req.body.order - 1);

            newSections.forEach(async (section, index) => {
                await Section.update({ order: index + 1 }, { where: { id: section.id } });
            })
        }

        await Section.update(req.body, { where: { id: section_id } });

        return res.status(200).json({ message: "Section updated" });
    }

    if (req.method === "DELETE") {
        const section = await Section.findOne({ 
          where: { id: section_id }, 
          include: [Question] 
        });
        
        if (section) {
          await sequelize.transaction(async (t) => {
            // Get all question IDs from this section
            const questionIds = section.Questions.map(q => q.id);
            
            // First delete QA pairs
            await QaPair.destroy({ 
              where: { question_id: questionIds },
              transaction: t
            });
            
            // Then delete question dependencies
            await QuestionDependency.destroy({ 
              where: { 
                [Op.or]: [
                  { question_id: questionIds },
                  { dependence_id: questionIds }
                ] 
              },
              transaction: t 
            });
            
            // Then delete questions
            await Question.destroy({ 
              where: { section_id: section.id },
              transaction: t 
            });
            
            // Finally delete the section
            await Section.destroy({ 
              where: { id: section_id },
              transaction: t 
            });
            
            return res.status(200).json({ message: "success" });
          });
        }
      }

    const section = await Section.findOne({ where: { id: section_id } });

    return res.status(200).json(section);
}
