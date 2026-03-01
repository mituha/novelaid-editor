import React, { useEffect, useState, useMemo } from 'react';
import PropTypes from 'prop-types';
import { useSettings } from '../../contexts/SettingsContext';
import { transformNovelSyntax } from '../../../common/utils/novelUtils';
import './MarkdownPreview.css';

interface MarkdownPreviewProps {
  content: string;
  filePath?: string;
}

function MarkdownImage({
  src,
  alt,
  filePath,
  title,
}: {
  src: string;
  alt?: string;
  filePath?: string;
  title?: string;
}) {
  let finalSrc = src;

  if (
    src &&
    !src.startsWith('http') &&
    !src.startsWith('data:') &&
    !src.startsWith('nvfs:') &&
    filePath
  ) {
    try {
      // react-markdown は src をエンコードしてしまうためデコードする
      const decodedSrc = decodeURIComponent(src);

      const isAbsolute =
        decodedSrc.startsWith('/') || /^[a-zA-Z]:/.test(decodedSrc);

      let fullPath = decodedSrc;
      if (!isAbsolute) {
        // filePath のディレクトリを基準に解決
        const dir = filePath.replace(/[\\/][^\\/]+$/, '');
        const separator = filePath.includes('\\') ? '\\' : '/';
        fullPath = `${dir}${separator}${decodedSrc}`;
      }

      const normalized = fullPath.replace(/\\/g, '/');
      const encodedPath = normalized
        .split('/')
        .map((segment) => encodeURIComponent(segment))
        .join('/');
      finalSrc = `nvfs://local/${encodedPath}`;
    } catch (err) {
      console.error('Failed to resolve image path synchronously:', err);
    }
  }

  return <img src={finalSrc} alt={alt} title={title} />;
}

export default function MarkdownPreview({
  content,
  filePath,
}: MarkdownPreviewProps) {
  const { settings } = useSettings();
  const theme = settings.theme || 'dark';

  const [ReactMarkdown, setReactMarkdown] = useState<any>(null);
  const [remarkGfm, setRemarkGfm] = useState<any>(null);
  const [rehypeRaw, setRehypeRaw] = useState<any>(null);

  useEffect(() => {
    Promise.all([
      import('react-markdown'),
      import('remark-gfm'),
      import('rehype-raw'),
    ])
      .then(([markdownModule, gfmModule, rehypeRawModule]) => {
        setReactMarkdown(() => markdownModule.default);
        setRemarkGfm(() => gfmModule.default);
        setRehypeRaw(() => rehypeRawModule.default);
        return null;
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error('Failed to load markdown modules:', err);
      });
  }, []);

  const components = useMemo(
    () => ({
      img: (props: any) => <MarkdownImage {...props} filePath={filePath} />,
    }),
    [filePath],
  );

  return (
    <div className="markdown-preview-container" data-theme={theme}>
      <div className="markdown-preview-content">
        <div className="markdown-body">
          {ReactMarkdown && remarkGfm && rehypeRaw ? (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw as any]}
              components={components}
            >
              {transformNovelSyntax(content)}
            </ReactMarkdown>
          ) : (
            <div>Loading preview...</div>
          )}
        </div>
      </div>
    </div>
  );
}

MarkdownImage.propTypes = {
  src: PropTypes.string.isRequired,
  alt: PropTypes.string,
  filePath: PropTypes.string,
  title: PropTypes.string,
};

MarkdownImage.defaultProps = {
  alt: '',
  filePath: '',
  title: '',
};

MarkdownPreview.propTypes = {
  content: PropTypes.string.isRequired,
  filePath: PropTypes.string,
};

MarkdownPreview.defaultProps = {
  filePath: '',
};
