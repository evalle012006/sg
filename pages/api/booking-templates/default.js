import { ChecklistAction, ChecklistTemplate, Page, Question, Section, Setting, Template } from "../../../models"

export default async function handler(req, res) {

    const defaultTemplate = await Setting.findOne({ where: { attribute: 'default_template' } });

    const template = await Template.findAll({ where: { id: defaultTemplate.value }, include: [{ model: Page, include: [{model: Section, include: [Question]}] }, ChecklistTemplate] });

    return res.status(200).json(template)
}
