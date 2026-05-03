import React, { useState } from 'react';
import { Languages, Type } from 'lucide-react';
import { NOVEL_PATTERNS } from '../../../common/constants/novel';
import './NovelPreview.css';

interface NovelPreviewProps {
  content: string;
}

export default function NovelPreview({ content }: NovelPreviewProps) {
  const [isVertical, setIsVertical] = useState(true);

  const parseNovelContent = (text: string) => {
    if (!text) return [];

    // 小説特有の記法（ルビ・傍点）をHTMLタグに置換
    let processed = text;

    // 1. ルビ (|漢字《かんじ》 or 漢字《かんじ》)
    processed = processed.replace(
      NOVEL_PATTERNS.RUBY_WITH_PIPE,
      '<ruby>$1<rt>$2</rt></ruby>',
    );
    processed = processed.replace(
      NOVEL_PATTERNS.RUBY_WITHOUT_PIPE,
      '<ruby>$1<rt>$2</rt></ruby>',
    );

    // 2. 傍点 (《《強調》》)
    processed = processed.replace(
      NOVEL_PATTERNS.BOUTEN,
      '<span class="bouten">$1</span>',
    );

    // 3. 改行で分割
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
