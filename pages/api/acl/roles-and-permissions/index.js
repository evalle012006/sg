import { RoleHasPermission, Permission, Role } from "../../../../models";
export default async function handler(req, res) {
    if (req.method === "GET") {
        const rolesAndPermissions = await Permission.findAll({ include: [{ model: Role }] });
        const roles = await Role.findAll();
        return res.status(200).json({ permissions: rolesAndPermissions, roles: roles });
    }
}
