import { Setting } from './../../../models';

export default async function handler(request, response) {
    const { attribute } = request.query;

    const attributeSettings = await Setting.findAll({ where: { attribute } });
    return response.status(200).json(attributeSettings);
}