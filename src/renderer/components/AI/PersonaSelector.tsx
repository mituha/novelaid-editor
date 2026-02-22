import React, { useMemo } from 'react';
import { Persona } from '../../../common/constants/personas';
import PersonaIcon from './PersonaIcon';

interface PersonaSelectorProps {
  selectedPersonaId: string;
  onPersonaChange: (personaId: string) => void;
  staticPersonas: Persona[];
  dynamicPersonas: Persona[];
}

export default function PersonaSelector({
  selectedPersonaId,
  onPersonaChange,
  staticPersonas,
  dynamicPersonas,
}: PersonaSelectorProps) {
  const allPersonas = useMemo(
    () => [...staticPersonas, ...dynamicPersonas],
    [staticPersonas, dynamicPersonas]
  );

  const activePersona = allPersonas.find((p) => p.id === selectedPersonaId);

  return (
    <div className="persona-selector">
      <PersonaIcon persona={activePersona} size={20} />
      <select
        value={selectedPersonaId}
        onChange={(e) => onPersonaChange(e.target.value)}
        title="会話の相手（ペルソナ）を選択します"
      >
        <option value="">ペルソナなし</option>
        {staticPersonas.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
        {dynamicPersonas.length > 0 && (
          <>
            <option disabled>──────────</option>
            {dynamicPersonas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </>
        )}
      </select>
    </div>
  );
}
