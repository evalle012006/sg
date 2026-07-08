import { Page, Section, Question, QaPair, QuestionDependency, sequelize } from "./../../../../../../models"
import { Op } from 'sequelize'

export default async function handler(req, res) {
    const { id } = req.query;

    if (req.method === "POST") {
        await Page.update(req.body, { where: { id } });

        const page = await Page.findOne({ where: { id }, include: [{ model: Section, include: [Question]}] });
        return res.status(200).json(page);
    }

    if (req.method === "DELETE") {
        const page = await Page.findOne({ 
            where: { id: id }, 
            include: [{ model: Section, include: [Question] }] 
        });

        if (page) {
            await sequelize.transaction(async (t) => {
                // Collect all question IDs across all sections up front
                const allQuestionIds = page.Sections.flatMap(
                    section => section.Questions.map(q => q.id)
                );

                // Delete QaPairs and QuestionDependencies for all questions in one query each
                if (allQuestionIds.length > 0) {
                    await QaPair.destroy({ 
                        where: { question_id: allQuestionIds }, 
                        transaction: t 
                    });
                    await QuestionDependency.destroy({ 
                        where: { 
                            [Op.or]: [
                                { question_id: allQuestionIds },
                                { dependence_id: allQuestionIds }
                            ] 
                        }, 
                        transaction: t 
                    });
                    // Delete all questions in the sections
                    const sectionIds = page.Sections.map(s => s.id);
                    await Question.destroy({ 
                        where: { section_id: sectionIds }, 
                        transaction: t 
                    });
                }

                // Delete all sections belonging to this page
                await Section.destroy({ 
                    where: { model_type: 'page', model_id: page.id }, 
                    transaction: t 
                });

                // Delete the page itself
                const deletePage = await Page.destroy({ 
                    where: { id: id }, 
                    transaction: t 
                });

                if (deletePage) return res.status(200).json({ message: "success" });
            });
        }
    }
}
