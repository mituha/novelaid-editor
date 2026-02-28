import {
  FileText,
  FileJson,
  BookText,
  Image as ImageIcon,
  MessageSquare,
  Folder,
  LibraryBig,
  BookImage,
  FileCog as FileCogIcon,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React from 'react';
import { DocumentType } from '../../common/types';

/**
 * ファイルやフォルダーのアイコンを表示する共通コンポーネント
 */
interface FileIconProps {
  name: string;
  path?: string;
  documentType?: DocumentType;
  metadata?: Record<string, any>;
  size?: number;
  isDirectory?: boolean;
  isOpen?: boolean;
  className?: string;
}

export default function FileIcon({
  name,
  path,
  documentType,
  metadata,
  size = 16,
  isDirectory = false,
  isOpen = false,
  className = '',
}: FileIconProps) {
  // 1. メタデータにカスタムアイコンが指定されている場合を最優先
  if (metadata?.icon) {
    const { icon } = metadata;
    if (icon.type === 'lucide') {
      const LucideIcon = (LucideIcons as any)[icon.value];
      if (LucideIcon) return <LucideIcon size={size} className={className} />;
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
        <div
          className={`file-custom-icon ${className}`}
          style={{ width: size, height: size }}
        >
          <img
            src={src}
            alt=""
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        </div>
      );
    }
  }

  // 2. フォルダーの場合の判定
  if (isDirectory) {
    const stateClass = isOpen ? 'folder-open' : 'folder-closed';
    const typeClass = documentType ? `folder-type-${documentType}` : '';
    const fullClassName = `${stateClass} ${typeClass} ${className}`.trim();

    if (documentType === 'novel') {
      return <LibraryBig size={size} className={fullClassName} />;
    }
    if (documentType === 'image') {
      return <BookImage size={size} className={fullClassName} />;
    }
    if (documentType === 'chat') {
      return <MessageSquare size={size} className={fullClassName} />;
    }
    return <Folder size={size} className={fullClassName} />;
  }

  // 3. ファイルの場合の判定（拡張子やドキュメントタイプに基づく）
  if (documentType === 'chat' || name.endsWith('.ch')) {
    return <MessageSquare size={size} className={className} />;
  }
  if (documentType === 'novel') {
    return <BookText size={size} className={className} />;
  }
  if (documentType === 'image') {
    return <ImageIcon size={size} className={className} />;
  }
  if (name.endsWith('.json')) {
    return <FileJson size={size} className={className} />;
  }
  // .gitignore や .novelaidattributes 等、ドットで始まるファイル
  if (name.startsWith('.')) {
    return <FileCogIcon size={size} className={className} />;
  }

  // デフォルト
  return <FileText size={size} className={className} />;
}
