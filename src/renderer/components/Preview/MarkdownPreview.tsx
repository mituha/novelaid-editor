import React from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../contexts/SettingsContext';
import BaseMarkdown from '../Common/BaseMarkdown';
import { useDocument } from '../../contexts/DocumentContext';
import { DocumentViewType } from '../../../common/types';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
  viewType?: DocumentViewType;
}

export default function MarkdownPreview({
  content,
  filePath,
  viewType,
}: MarkdownPreviewProps) {
  const { settings } = useSettings();
  const theme = settings.theme || 'dark';
  const { openDocument, openWebBrowser } = useDocument();

  const handleLinkClick = (url: string) => {
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

      if (!isAbsolute) {
        const dir = filePath.replace(/[\\/][^\\/]+$/, '');
        const separator = filePath.includes('\\') ? '\\' : '/';
        resolvedPath = `${dir}${separator}${decodedUrl}`;
      }

      // POSIX と Windows のパス区切りを OS 側で適宜解決させるため、そのまま openDocument へ渡す
      openDocument(resolvedPath, { requestedViewType: viewType });
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

MarkdownPreview.propTypes = {
  content: PropTypes.string.isRequired,
  filePath: PropTypes.string,
  viewType: PropTypes.string,
};

MarkdownPreview.defaultProps = {
  filePath: '',
  viewType: 'editor',
};
