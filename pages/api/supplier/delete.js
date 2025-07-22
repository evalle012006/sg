import { Supplier } from '../../../models'
export default async function handler(req, res) {
    const data = JSON.parse(req.body);

    const supplier = await Supplier.destroy({ where: {id: data.id} });

    return res.status(200).end(JSON.stringify({ success: true }));
}
