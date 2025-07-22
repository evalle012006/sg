import { Supplier } from '../../../models'

export default async function handler(req, res) {

    const suppliers = await Supplier.findAll();

    return res.status(200).json(suppliers);
}