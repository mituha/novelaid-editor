import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../renderer/contexts/ThemeContext';
import { MarkdownPlugin } from '../types';

/**
 * Mermaid グラフをレンダリングするコンポーネント
 */
const MermaidComponent: React.FC<{
  value: string;
  attributes?: Record<string, any>;
}> = ({ value, attributes = {} }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const initialized = useRef(false);

  // 属性からサイズを取得
  const { width, height } = attributes;

  useEffect(() => {
    const renderDiagram = async () => {
      if (!value) return;

      try {
        // mermaid は ESM のため動的インポートを使用
        const { default: mermaid } = await import('mermaid');

        // テーマに合わせて初期化
        // Note: Mermaid 11では内部型定義が厳格なため、suppressErrorを指定するために as any を使用
        (mermaid as any).initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
          suppressError: true, // 自動エラー表示を抑制
        });
        initialized.current = true;

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg: renderedSvg } = await mermaid.render(id, value);
        setSvg(renderedSvg);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Mermaid rendering failed:', error);
        
        // Mermaidが作成した可能性のあるデバッグ要素を削除（レイアウト崩れ対策）
        // Mermaidは解析エラー時に document.body に要素を追加することがあるため、それを除去
        const strayElements = [
          document.getElementById('dmermaid-debug'),
          document.querySelector('.mermaid-error-container'),
          document.querySelector('[id^="dmermaid-"]')
        ];
        
        strayElements.forEach(el => {
          if (el && el.parentNode === document.body) {
            el.remove();
          }
        });

        // エラー時は元のテキストを pre で表示するか、エラーメッセージを表示
        setSvg(`<pre class="mermaid-error" style="color: #f44336; padding: 1em; border: 1px solid #f44336; border-radius: 4px;">Mermaid Error: ${error instanceof Error ? error.message : 'Invalid syntax'}</pre>`);
      }
    };

    renderDiagram();
  }, [value, theme]);

  return (
    <div
      className="mermaid-container"
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '1.5em 0',
        maxWidth: '100%',
        overflow: 'auto',
        width: width || '100%',
        height: height || 'auto',
      }}
    >
      <style>{`
        .mermaid-container svg {
          max-width: 100%;
          max-height: 100%;
          height: auto;
        }
      `}</style>
      <div 
        style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center' }}
        dangerouslySetInnerHTML={{ __html: svg }} 
      />
    </div>
  );
};

/**
 * Mermaid コードブロック用のプラグイン定義
 */
export const mermaidPlugin: MarkdownPlugin = {
  name: 'mermaid',
  codeProcessors: [
    {
      language: 'mermaid',
      component: MermaidComponent,
    },
  ],
};
