import React from 'react';
import { NovelaidMarkdown } from 'novelaid-markdown';

interface MessageMarkdownProps {
  content: string;
}

export default function MessageMarkdown({ content }: MessageMarkdownProps) {
  return (
    <NovelaidMarkdown
      content={content}
      // メッセージ領域（吹き出し領域）用のスタイル指定
      className="message-markdown-body"
    />
  );
}
