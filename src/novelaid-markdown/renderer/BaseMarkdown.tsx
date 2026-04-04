import React, { useEffect, useState, useMemo } from 'react';
import { defaultProcessor } from '../index';
import { parseAttributes } from '../utils/attribute-parser';

export interface BaseMarkdownProps {
  content: string;
  filePath?: string;
  className?: string; // e.g. "markdown-body" or "message-body"
  onLinkClick?: (url: string, options?: { newTab?: boolean }) => void;
}

// 共通の画像コンポーネント（Obsidian風サイズ指定対応＋ローカルパス解決）
function BaseMarkdownImage({
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
  let finalAlt = alt;
  let imgWidth: number | string | undefined;
  let imgHeight: number | string | undefined;

  // Obsidian style image size parsing: ![alt|100](url) or ![alt|100x200](url)
  if (finalAlt && finalAlt.includes('|')) {
    const lastPipeIndex = finalAlt.lastIndexOf('|');
    const potentialSize = finalAlt.substring(lastPipeIndex + 1).trim();

    if (/^\d+$/.test(potentialSize)) {
      imgWidth = parseInt(potentialSize, 10);
      finalAlt = finalAlt.substring(0, lastPipeIndex);
    } else if (/^\d+x\d+$/.test(potentialSize)) {
      const [w, h] = potentialSize.split('x');
      imgWidth = parseInt(w, 10);
      imgHeight = parseInt(h, 10);
      finalAlt = finalAlt.substring(0, lastPipeIndex);
    }
  }

  if (
    src &&
    !src.startsWith('http') &&
    !src.startsWith('data:') &&
    !src.startsWith('nvfs:') &&
    filePath
  ) {
    try {
      const decodedSrc = decodeURIComponent(src);

      const isAbsolute =
        decodedSrc.startsWith('/') || /^[a-zA-Z]:/.test(decodedSrc);

      let fullPath = decodedSrc;
      if (!isAbsolute) {
        // basePath resolution
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

  return (
    <img
      src={finalSrc}
      alt={finalAlt}
      title={title}
      width={imgWidth}
      height={imgHeight}
    />
  );
}

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode; content: string; filePath?: string },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.group('Markdown Rendering Error');
    // eslint-disable-next-line no-console
    console.error('Error:', error);
    // eslint-disable-next-line no-console
    console.error('File Path:', this.props.filePath);
    // eslint-disable-next-line no-console
    console.groupCollapsed('Original Content');
    // eslint-disable-next-line no-console
    console.log(this.props.content);
    // eslint-disable-next-line no-console
    console.groupEnd();
    // eslint-disable-next-line no-console
    console.groupEnd();
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="markdown-error-state" style={{ padding: '20px', border: '1px solid #f44336', backgroundColor: 'rgba(244, 67, 54, 0.1)', borderRadius: '4px' }}>
          <h3>Markdown Rendering Error</h3>
          <p>プレビューのレンダリング中にエラーが発生しました。詳細は開発者ツールのコンソールを確認してください。</p>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function BaseMarkdown({
  content,
  filePath,
  className = '',
  onLinkClick,
}: BaseMarkdownProps) {
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
      img: (props: any) => <BaseMarkdownImage {...props} filePath={filePath} />,
      a: (props: any) => (
        <a
          {...props}
          onClick={(e) => {
            if (onLinkClick && props.href) {
              e.preventDefault();
              onLinkClick(props.href, { newTab: false });
            }
          }}
          onAuxClick={(e) => {
            // 中ボタンクリック (button === 1) は新しいタブで開く挙動として扱う
            if (e.button === 1 && onLinkClick && props.href) {
              e.preventDefault();
              onLinkClick(props.href, { newTab: true });
            }
          }}
        />
      ),
      code: (props: any) => {
        const { children, className, node, ...rest } = props;
        const match = /language-([^ \n\r\t]+)/.exec(className || '');
        const fullLang = match ? match[1] : undefined;

        let language = fullLang;
        let metaString = (node as any)?.meta || '';

        // 言語名に { が含まれる場合 (例: mermaid{width=100})
        if (fullLang && fullLang.includes('{')) {
          const bracketIndex = fullLang.indexOf('{');
          language = fullLang.substring(0, bracketIndex);
          if (!metaString) {
            metaString = fullLang.substring(bracketIndex);
          }
        }

        // 属性のパース
        const attributes = parseAttributes(metaString);

        let currentLanguage = language || '';
        let currentCode = String(children).replace(/\n$/, '');
        let currentAttributes = { ...attributes };

        // 登録されているコードプレプロセッサを実行
        const preprocessors = defaultProcessor.getCodePreprocessors();
        for (const preprocessor of preprocessors) {
          if (
            preprocessor.languages.includes(currentLanguage) ||
            preprocessor.languages.includes('*')
          ) {
            const result = preprocessor.preprocess({
              language: currentLanguage,
              code: currentCode,
              attributes: currentAttributes,
            });
            currentLanguage = result.language;
            currentCode = result.code;
            currentAttributes = result.attributes;
          }
        }

        // 登録されているコードプロセッサを探す
        const processors = defaultProcessor.getCodeProcessors();
        const processor = processors.find((p) => p.language === currentLanguage);

        if (processor) {
          const ProcessorComponent = processor.component;
          return (
            <ProcessorComponent
              value={currentCode}
              language={currentLanguage}
              attributes={currentAttributes}
              {...rest}
            />
          );
        }

        // デフォルトの表示
        return (
          <code className={className} {...rest}>
            {children}
          </code>
        );
      },
    }),
    [filePath, onLinkClick],
  );

  if (!ReactMarkdown || !remarkGfm || !rehypeRaw) {
    return <div>Loading preview...</div>;
  }

  const transformedContent = defaultProcessor.preprocess(content);

  return (
    <div className={className}>
      <MarkdownErrorBoundary content={transformedContent} filePath={filePath}>
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw as any]}
          components={components}
        >
          {transformedContent}
        </ReactMarkdown>
      </MarkdownErrorBoundary>
    </div>
  );
}
