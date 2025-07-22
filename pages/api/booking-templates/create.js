import { ChecklistTemplate, Page, Question, Section, Template } from "../../../models"

export default async function handler(req, res) {
    const { uuid } = req.query;

    if (req.method === "POST") {
        const template = await Template.create(req.body);

        return res.status(201).json(await Template.findOne({ where: { uuid: template.uuid }, include: [{ model: Page, include: [{ model: Section, include: [Question] }] }, ChecklistTemplate] }));
    }

    return res.status(400);
}
