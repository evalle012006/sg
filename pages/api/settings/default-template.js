import { Setting } from "../../../models"

export default async function handler(req, res) {
    const settings = await Setting.findAll({
        where: {
            attribute: ['default_template', 'accommodation_only_template']
        },
        raw: true,
    });

    // Return as a map for easy lookup: { default_template: {id, value}, accommodation_only_template: {id, value} }
    const result = {};
    settings.forEach(s => {
        result[s.attribute] = s;
    });

    return res.status(200).json(result);
}