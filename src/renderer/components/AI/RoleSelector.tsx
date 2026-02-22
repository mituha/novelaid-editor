import React from 'react';
import { UserSquare2 } from 'lucide-react';
import { CHAT_ROLES } from '../../../common/constants/personas';

interface RoleSelectorProps {
  selectedRoleId: string;
  onRoleChange: (roleId: string) => void;
}

export default function RoleSelector({
  selectedRoleId,
  onRoleChange,
}: RoleSelectorProps) {
  return (
    <div className="role-selector">
      <UserSquare2 size={20} />
      <select
        value={selectedRoleId}
        onChange={(e) => onRoleChange(e.target.value)}
        title="AIの役割（視点）を選択します"
      >
        {CHAT_ROLES.map((role) => (
          <option key={role.id} value={role.id}>
            {role.name}
          </option>
        ))}
      </select>
    </div>
  );
}
