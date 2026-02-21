import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { NOVEL_PATTERNS } from '../../../common/constants/novel';

interface NovelMarkdownProps {
  content: string;
}

export default function NovelMarkdown({ content }: NovelMarkdownProps) {
  const transformNovelSyntax = (text: string) => {
    if (!text) return '';

    let processed = text;

    // 1. Handle Ruby
    // Replace pipe versions first, then non-pipe versions
    processed = processed.replace(
      NOVEL_PATTERNS.RUBY_WITH_PIPE,
      '<ruby>$1<rt>$2</rt></ruby>',
    );
    processed = processed.replace(
      NOVEL_PATTERNS.RUBY_WITHOUT_PIPE,
      '<ruby>$1<rt>$2</rt></ruby>',
    );

    // 2. Handle Bouten (Emphasis dots)
    processed = processed.replace(
      NOVEL_PATTERNS.BOUTEN,
      '<span class="bouten">$1</span>',
    );

    return processed;
  };

  const processedContent = transformNovelSyntax(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw as any]}
    >
      {processedContent}
    </ReactMarkdown>
  );
}
