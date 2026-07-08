import { Setting } from "../../../models"

const ALLOWED_ATTRIBUTES = ['default_template', 'accommodation_only_template'];

export default async function handler(req, res) {
    const { id, settingAttribute = 'default_template' } = req.body;

    if (!ALLOWED_ATTRIBUTES.includes(settingAttribute)) {
        return res.status(400).json({ message: 'Invalid setting attribute' });
    }

    await Setting.upsert({
        attribute: settingAttribute,
        value: id,
    });

    return res.status(200).json();
}