import { Template, Page, Section } from "./../../../../../../../models"

export default async function handler(req, res) {
    const { id } = req.query;

    if (req.method === "POST") {
        const page = await Page.findOne({ where: { id }, include: [Section] });

        if (page) {

            const order = page.Sections.length + 1 || 1;
            const section = await Section.create({ ...req.body, order: order, model_id: page.id, model_type: 'page' });

            return res.status(201).json(section);
        } else
            return res.status(404).json({ message: "Page not found" });
    }

    return req.status(405).json({ message: "Method not allowed" });
}

