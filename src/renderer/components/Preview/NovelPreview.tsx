import React, { useState } from 'react';
import { Languages, Type } from 'lucide-react';
import './NovelPreview.css';

interface NovelPreviewProps {
  content: string;
}

export default function NovelPreview({ content }: NovelPreviewProps) {
  const [isVertical, setIsVertical] = useState(true);

  const parseNovelContent = (text: string) => {
    if (!text) return [];

    // 1. Handle Ruby
    const rubyRegex = /[|｜]?([^|｜\n《》]+)《([^《》\n]+)》/g;
    let processed = text.replace(rubyRegex, '<ruby>$1<rt>$2</rt></ruby>');

    // 2. Handle Bouten (Double brackets)
    const boutenRegex = /《《([^《》\n]+)》》/g;
    processed = processed.replace(
      boutenRegex,
      '<span class="bouten">$1</span>',
    );

    // 3. Handle newlines
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
          {lines.map((line, i) => (
            <p
              key={`${i}-${line.substring(0, 10)}`}
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: line || '&nbsp;' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
