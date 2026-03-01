import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { transformNovelSyntax } from '../../../common/utils/novelUtils';

interface NovelMarkdownProps {
  content: string;
}

export default function NovelMarkdown({ content }: NovelMarkdownProps) {
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
