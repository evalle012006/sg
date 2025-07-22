import { Setting } from './../../../models';

export default async function handler(request, response) {
    const defaultTemplateSettings = await Setting.findOne({ where: { attribute: 'default_template' } });
    response.status(200).json(defaultTemplateSettings);
}