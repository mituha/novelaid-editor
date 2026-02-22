import React, { useState } from 'react';
import { Bot } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { Persona } from '../../../common/constants/personas';

interface PersonaIconProps {
  persona?: Persona;
  size?: number;
}

export default function PersonaIcon({
  persona,
  size = 36,
}: PersonaIconProps) {
  const [imgError, setImgError] = useState(false);

  const fallback = (
    <div className="persona-icon-default" style={{ width: size, height: size }}>
      <Bot size={size * 0.7} />
    </div>
  );

  if (!persona || imgError) return fallback;

  const { icon } = persona;
  if (!icon || !icon.value) return fallback;

  if (icon.type === 'lucide') {
    const LucideIcon = (LucideIcons as any)[icon.value] || Bot;
    return (
      <div
        className="persona-icon-lucide"
        style={{ width: size, height: size }}
      >
        <LucideIcon size={size * 0.7} />
      </div>
    );
  }

  let src = icon.value;
  if (icon.type === 'local-asset') {
    src = `app-asset://${icon.value}`;
  } else if (
    icon.type === 'local-file' ||
    (icon.type as string) === 'local' ||
    icon.type === 'url'
  ) {
    const isAbsolute =
      icon.value.startsWith('/') ||
      /^[a-zA-Z]:/.test(icon.value) ||
      icon.value.startsWith('http');

    if (icon.type === 'url' && isAbsolute) {
      src = icon.value;
    } else {
      // ローカルファイルまたは相対パスのURL
      let fullPath = icon.value;
      if (!isAbsolute && persona.filePath) {
        // キャラクターファイルの場所を基準に解決
        const dir = persona.filePath.replace(/[\\/][^\\/]+$/, '');
        const separator = persona.filePath.includes('\\') ? '\\' : '/';
        fullPath = `${dir}${separator}${icon.value}`;
      }

      const normalized = fullPath.replace(/\\/g, '/');
      const encodedPath = normalized
        .split('/')
        .map((segment: string) => encodeURIComponent(segment))
        .join('/');
      src = `nvfs://local/${encodedPath}`;
    }
  }

  return (
    <div className="persona-icon-img" style={{ width: size, height: size }}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        onError={() => setImgError(true)}
      />
    </div>
  );
}
