import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../renderer/contexts/ThemeContext';
import { MarkdownPlugin } from '../types';

/**
 * Mermaid グラフをレンダリングするコンポーネント
 */
const MermaidComponent: React.FC<{ value: string }> = ({ value }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const initialized = useRef(false);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!value) return;

      try {
        // mermaid は ESM のため動的インポートを使用
        const { default: mermaid } = await import('mermaid');

        // テーマに合わせて初期化
        mermaid.initialize({
          startOnLoad: false,
          theme: theme === 'dark' ? 'dark' : 'default',
          securityLevel: 'loose',
          fontFamily: 'Inter, system-ui, sans-serif',
        });
        initialized.current = true;

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg: renderedSvg } = await mermaid.render(id, value);
        setSvg(renderedSvg);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Mermaid rendering failed:', error);
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
        margin: '1.5em 0',
        maxWidth: '100%',
        overflow: 'auto',
      }}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
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
