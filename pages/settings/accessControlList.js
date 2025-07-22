import { useState } from "react";
import { useEffect } from "react";
import ToggleButton from './../../components/ui/toggle'
import PermissionToggle from "../../components/users/permissionsToggle";
export default function AccessControlList() {
    const [permissions, setPermissions] = useState([]);
    const [roles, setRoles] = useState([]);
    const styles = [];

    async function fetchRolesAndPermissions() {
        const response = await fetch('/api/acl/roles-and-permissions');
        let data = await response.json();
        setPermissions(data.permissions);
        setRoles(data.roles);
    }

    async function updateRoleHasPermissions(permission, role) {

        const response = await fetch('/api/acl/roles-and-permissions/update',
            {
                method: 'POST',
                body: JSON.stringify({ permission: permission, role: role })
            });

        let data = await response.json();
        setPermissions(data.permissions);
        setRoles(data.roles);
    }

    useEffect(() => {
        fetchRolesAndPermissions();
    }, [])

    return (
        <table className="w-full">
            <thead className="">
                <tr className="">
                    <th className="max-w-sm py-5 text-left text-sm bg-yellow-500 font-bold rounded-tl-2xl pl-4 text-neutral-700">Permissions</th>
                    {roles.map((role, index) => { return role.name != 'Administrator' && <th key={index} className={`max-w-sm py-5 text-sm text-left bg-yellow-500 font-bold text-neutral-700 ${index === roles.length - 1 && 'rounded-tr-2xl'}`}>{role.name}</th> }
                    )}
                </tr>
            </thead>
            <tbody className={`${styles && styles.tbody}`}>
                {permissions.map((permission, permissionIndex) => (
                    <tr key={permissionIndex} onClick={(e) => e.stopPropagation()}>
                        <td className={`max-w-sm py-6 pl-4 text-left ${permissionIndex == permissions.length - 1 && 'rounded-bl-2xl'} ${permissionIndex % 2 && 'bg-zinc-100'}`}>{permission.action + ' ' + permission.subject}</td>
                        {roles.map((role, roleIndex) => {
                            return role.name != 'Administrator' && <td key={permissionIndex + roleIndex} className={`max-w-sm py-6 text-left ${permissionIndex == permissions.length - 1 && roleIndex == 0 && 'rounded-bl-2xl'} ${permissionIndex == permissions.length - 1 && roleIndex == roles.length - 1 && 'rounded-br-2xl'} ${permissionIndex % 2 && 'bg-zinc-100'}`}>
                                <div className="w-fit" onClick={() => updateRoleHasPermissions(permission, role)}>
                                    <ToggleButton status={(permission.Roles.map(rawItem => rawItem.name)).includes(role.name)} />
                                </div>
                            </td>
                        })}
                    </tr>
                )
                )}
            </tbody>
        </table>
    )
}