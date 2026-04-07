import React from 'react';
import { useTheme } from '../../renderer/contexts/ThemeContext';
import BaseMarkdown from './BaseMarkdown';
import { useDocument } from '../../renderer/contexts/DocumentContext';
import { DocumentViewMode } from '../../common/types';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
  viewMode?: DocumentViewMode;
}

export default function MarkdownPreview({
  content,
  filePath,
  viewMode,
}: MarkdownPreviewProps) {
  const { theme } = useTheme();
  const { openDocument, openWebBrowser, closeTab } = useDocument();

  const handleLinkClick = async (url: string, options?: { newTab?: boolean }) => {
    const { newTab = false } = options || {};

    if (url.startsWith('http://') || url.startsWith('https://')) {
      openWebBrowser(url, url);
    } else if (filePath) {
      let decodedUrl = url;
      try {
        decodedUrl = decodeURIComponent(url);
      } catch (err) {
        // デコード失敗時は現状維持
      }

      const isAbsolute = decodedUrl.startsWith('/') || /^[a-zA-Z]:/.test(decodedUrl);
      let resolvedPath = decodedUrl;

      // 相対パス内のディレクトリ遷移（/ や \）があるかどうか
      const hasDirectoryTraversal = decodedUrl.includes('/') || decodedUrl.includes('\\');

      if (!isAbsolute) {
        const dir = await window.electron.path.dirname(filePath);
        resolvedPath = await window.electron.path.join(dir, decodedUrl);
      }

      // POSIX と Windows のパス区切りを OS 側で適宜解決させるため、そのまま openDocument へ渡す
      openDocument(resolvedPath, { requestedViewMode: viewMode }).then(() => {
        // 同じディレクトリ階層の場合かつ新規タブ指定でない場合は、元のタブを閉じて「置き換え遷移」に見せる
        if (!isAbsolute && !hasDirectoryTraversal && !newTab && filePath) {
          const currentTabPath = viewMode === 'preview' ? `preview://${filePath}` : filePath;
          // ※side指定はcloseInSideが必要だが、closeTabは全ペインから消すため汎用的に機能する
          closeTab(currentTabPath);
        }
      });
    }
  };

  return (
    <div className="markdown-preview-container" data-theme={theme}>
      <div className="markdown-preview-content">
        <BaseMarkdown
          content={content}
          filePath={filePath}
          className="markdown-body"
          onLinkClick={handleLinkClick}
        />
      </div>
    </div>
  );
}



MarkdownPreview.defaultProps = {
  filePath: '',
  viewMode: 'editor',
};
