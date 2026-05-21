import React, { useState } from 'react';
import { Languages, Type } from 'lucide-react';
import { transformToHtml } from 'novelaid-ruby';
import './NovelPreview.css';

interface NovelPreviewProps {
  content: string;
}

export default function NovelPreview({ content }: NovelPreviewProps) {
  const [isVertical, setIsVertical] = useState(true);

  const parseNovelContent = (text: string) => {
    if (!text) return [];

    // 小説特有の記法（ルビ・傍点）をHTMLタグに置換
    const processed = transformToHtml(text);

    // 改行で分割
    const lines = processed.split('\n');
    return lines;
  };

  const lines = parseNovelContent(content);

  return (
    <div
      className={`novel-preview-container ${isVertical ? 'vertical' : 'horizontal'}`}
    >
      <div className="preview-toolbar">
        <button
          type="button"
          onClick={() => setIsVertical(!isVertical)}
          title={isVertical ? 'Switch to Horizontal' : 'Switch to Vertical'}
          className="preview-toggle-btn"
        >
          {isVertical ? <Type size={16} /> : <Languages size={16} />}
          <span>{isVertical ? '横書きへ' : '縦書きへ'}</span>
        </button>
      </div>
      <div className="preview-content">
        <div className="novel-page">
          {lines.map((line, i) => {
            const key = `line-${i}-${line.length}`;
            return (
              <p
                key={key}
                // eslint-disable-next-line react/no-danger
                dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

