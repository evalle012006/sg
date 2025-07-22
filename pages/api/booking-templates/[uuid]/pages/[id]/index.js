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
        const page = await Page.findOne({ where: { id: id }, include: [{ model: Section, include: [Question] }] });

        if (page) {
            await sequelize.transaction(async (t) => {
                page.Sections.map(async section => {
                    section.Questions.map(async question => {
                        await QaPair.destroy({ where: { question_id: question.id } },{ transaction: t});
                        await QuestionDependency.destroy({ where: { [Op.or]: [
                            { question_id: question.id },
                            { dependence_id: question.id }
                        ] } }, { transaction: t });
                    });
                    
                    await Question.destroy({ where: { section_id: section.id } },{ transaction: t});
                });
                await Section.destroy({ where: { model_type: "page", model_id: page.id } }, { transaction: t });
                const deletePage = await Page.destroy({
                    where: {
                        id: id
                    },
                }, { transaction: t });

                if (deletePage) return res.status(200).json({ message: "success" });
            });
        }
    }
}
