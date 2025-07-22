import { Supplier } from '../../../models'
export default async function handler(req, res) {
    const { id } = req.query;

    const supplier = await Supplier.findOne({ where: { id: id } });

    return res.status(200).json({ success: true, data: supplier });
}
