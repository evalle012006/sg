import { ChecklistTemplate, Page, Question, Section, Setting, Template } from "../../../models"

export default async function handler(req, res) {
    const selected = req.body;

    await Setting.update({ value: selected.id }, { where: { attribute: 'default_template' } });

    return res.status(200).json();
}
