import {
  FileText,
  FileJson,
  BookText,
  Image as ImageIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React from 'react';

/**
 * ファイルのアイコンを表示する共通コンポーネント
 */
interface FileIconProps {
  name: string;
  path?: string;
  language?: string;
  metadata?: Record<string, any>;
  size?: number;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  path,
  language,
  metadata,
  size = 16,
}) => {
  if (metadata?.icon) {
    const { icon } = metadata;
    if (icon.type === 'lucide') {
      const LucideIcon = (LucideIcons as any)[icon.value];
      if (LucideIcon) return <LucideIcon size={size} />;
    }
    if (icon.value && (icon.type === 'local' || icon.type === 'url')) {
      let src = icon.value;
      const isAbsolute =
        icon.value.startsWith('/') ||
        /^[a-zA-Z]:/.test(icon.value) ||
        icon.value.startsWith('http');

      if (icon.type === 'local' || !isAbsolute) {
        let fullPath = icon.value;
        if (!isAbsolute && path) {
          const dir = path.replace(/[\\/][^\\/]+$/, '');
          const separator = path.includes('\\') ? '\\' : '/';
          fullPath = `${dir}${separator}${icon.value}`;
        }

        const normalized = fullPath.replace(/\\/g, '/');
        const encodedPath = normalized
          .split('/')
          .map((segment: string) => encodeURIComponent(segment))
          .join('/');
        src = `nvfs://local/${encodedPath}`;
      }

      return (
        <div className="file-custom-icon" style={{ width: size, height: size }}>
          <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      );
    }
  }

  if (name.endsWith('.json')) return <FileJson size={size} />;
  if (language === 'novel') return <BookText size={size} />;
  if (language === 'image') return <ImageIcon size={size} />;
  return <FileText size={size} />;
};
