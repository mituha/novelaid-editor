import React, { useEffect, useState, useMemo } from 'react';
import { transformNovelSyntax } from '../../../common/utils/novelUtils';

export interface BaseMarkdownProps {
  content: string;
  filePath?: string;
  className?: string; // e.g. "markdown-body" or "message-body"
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

export default function BaseMarkdown({
  content,
  filePath,
  className = '',
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
      // TODO: コードブロックなどの共通拡張処理が必要になればここに追加する
    }),
    [filePath],
  );

  if (!ReactMarkdown || !remarkGfm || !rehypeRaw) {
    return <div>Loading preview...</div>;
  }

  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw as any]}
        components={components}
      >
        {transformNovelSyntax(content)}
      </ReactMarkdown>
    </div>
  );
}
