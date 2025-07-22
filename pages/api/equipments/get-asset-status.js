import { Setting } from "../../../models";


export default async function handler(req, res) {
    const assetStatus = await Setting.findAll({ where: { attribute: 'asset_status' }});

    return res.status(200).json({ assetStatus: assetStatus });
}
