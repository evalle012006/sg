import { Setting } from './../../../models';

export default async function handler(request, response) {
    const sectionTypes = await Setting.findAll({ where: { attribute: 'section_type' } });
    response.status(200).json(sectionTypes);
}