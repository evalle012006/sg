import dynamic from 'next/dynamic';
const ToggleButton = dynamic(() => import('../ui/toggle'));

export default function PermissionToggle({ permission, role, setPermissions, setRoles }) {

    async function updateRoleHasPermissions() {
        const response = await fetch('/api/acl/roles-and-permissions/update',
            {
                method: 'POST',
                body: JSON.stringify({ permission: permission, role: role })
            });

        let data = await response.json();
        setPermissions(data.permissions);
        setRoles(data.roles);
    }
    return (
        <ToggleButton status={(permission.Roles.map(rawItem => rawItem.name)).includes(role.name)} toggleStatus={() => updateRoleHasPermissions()} />
    )
}