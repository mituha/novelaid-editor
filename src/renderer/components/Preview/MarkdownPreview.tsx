import React, { useEffect, useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const { settings } = useSettings();
  const theme = settings.theme || 'dark';

  const [ReactMarkdown, setReactMarkdown] = useState<any>(null);
  const [remarkGfm, setRemarkGfm] = useState<any>(null);

  useEffect(() => {
    Promise.all([import('react-markdown'), import('remark-gfm')])
      .then(([markdownModule, gfmModule]) => {
        setReactMarkdown(() => markdownModule.default);
        setRemarkGfm(() => gfmModule.default);
        return null;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load markdown modules:', err);
      });
  }, []);

  return (
    <div className="markdown-preview-container" data-theme={theme}>
      <div className="markdown-preview-content">
        <div className="markdown-body">
          {ReactMarkdown && remarkGfm ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          ) : (
            <div>Loading preview...</div>
          )}
        </div>
      </div>
    </div>
  );
}
