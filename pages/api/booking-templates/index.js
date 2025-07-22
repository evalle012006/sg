import { ChecklistTemplate, Page, Question, Section, Template } from "../../../models"

export default async function handler(req, res) {

    const templates = await Template.findAll({
        include: [{
            model: Page, include: [
                { model: Section, include: [Question], order: [['order', 'ASC']] }],
            order: [['order', 'ASC']]
        }, ChecklistTemplate]
    })

    return res.status(200).json(templates)
}
