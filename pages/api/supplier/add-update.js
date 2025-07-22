import { Supplier } from '../../../models';

export default async function handler(req, res) {
    const supplier = req.body;

    const [data, created] = await Supplier.upsert({
        ...supplier
    });

    return res.status(200).json({ success: true,  supplier: data});
}
