import React from 'react';
import BaseMarkdown from '../Common/BaseMarkdown';

interface MessageMarkdownProps {
  content: string;
}

export default function MessageMarkdown({ content }: MessageMarkdownProps) {
  return (
    <BaseMarkdown
      content={content}
      // メッセージ領域（吹き出し領域）用のスタイル指定
      className="message-markdown-body"
    />
  );
}
