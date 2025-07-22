import { Template, Page } from "./../../../../../models"

export default async function handler(req, res) {
    const { uuid, id } = req.query;

    if (req.method === "POST") {
        const template = await Template.findOne({ where: { uuid } });

        const page = await Page.create({ ...req.body, template_id: template.id });

        return res.status(201).json(page);
    }

    return req.status(405).json({ message: "Method not allowed" });
}

