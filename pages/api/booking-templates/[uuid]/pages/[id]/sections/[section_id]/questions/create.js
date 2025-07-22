import { Section, Question } from "./../../../../../../../../../models"

export default async function handler(req, res) {
    const { section_id } = req.query;

    if (req.method === "POST") {

        const section = await Section.findOne({ where: { id: section_id }, include: [Question] });
        const question = await Question.create({ ...req.body, options: req.body.options, order: req.body.order ? req.body.order : section.Questions.length, section_id: section.id });
        return res.status(201).json(question);
    }

    return req.status(405).json({ message: "Method not allowed" });
}

