import { RoleHasPermission, Permission, Role } from "../../../../models";
export default async function handler(req, res) {
    if (req.method === "POST") {
        const { permission, role } = JSON.parse(req.body)
        const roleHasPermissionData = await RoleHasPermission.findOne({ where: { permission_id: permission.id, role_id: role.id } });

        if (roleHasPermissionData) {
            await RoleHasPermission.destroy({ where: { permission_id: permission.id, role_id: role.id } });
        } else {
            await RoleHasPermission.create({ permission_id: permission.id, role_id: role.id });
        }

        const rolesAndPermissions = await Permission.findAll({ include: [{ model: Role }] });
        const roles = await Role.findAll();

        return res.status(201).json({ permissions: rolesAndPermissions, roles: roles });
    }
}
