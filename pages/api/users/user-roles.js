import { Role } from '../../../models';

export default async function handler(request, response) {
    const roles = await Role.findAll();
    response.status(200).json(roles);
}