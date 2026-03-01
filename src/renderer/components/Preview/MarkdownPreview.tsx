import React from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../contexts/SettingsContext';
import BaseMarkdown from '../Common/BaseMarkdown';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
}

export default function MarkdownPreview({
  content,
  filePath,
}: MarkdownPreviewProps) {
  const { settings } = useSettings();
  const theme = settings.theme || 'dark';

  return (
    <div className="markdown-preview-container" data-theme={theme}>
      <div className="markdown-preview-content">
        <BaseMarkdown
          content={content}
          filePath={filePath}
          className="markdown-body"
        />
      </div>
    </div>
  );
}

MarkdownPreview.propTypes = {
  content: PropTypes.string.isRequired,
  filePath: PropTypes.string,
};

MarkdownPreview.defaultProps = {
  filePath: '',
};
