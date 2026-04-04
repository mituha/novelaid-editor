import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../renderer/contexts/ThemeContext';
import { MarkdownPlugin } from '../types';

/**
 * D2 ダイアグラムをレンダリングするコンポーネント
 */
const D2Component: React.FC<{ value: string }> = ({ value }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!value) return;

      setLoading(true);
      setError(null);

      try {
        // @terrastruct/d2 は WASM/Worker を含むため動的インポートを使用
        const { D2 } = await import('@terrastruct/d2');
        const d2 = new D2();

        // テーマの設定 (0: ライト/デフォルト, 200: ダーク)
        const themeId = theme === 'dark' ? 200 : 0;

        // コンパイル
        const compileResult = await d2.compile(value);

        // レンダリングオプションの設定
        const renderOptions = {
          ...compileResult.renderOptions,
          theme: themeId,
          transparent: true, // 背景を透明に設定
        };

        // レンダリング
        const renderedSvg = await d2.render(compileResult.diagram, renderOptions);

        if (isMounted) {
          setSvg(renderedSvg);
          setLoading(false);
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('D2 rendering failed:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Invalid D2 syntax');
          setLoading(false);
        }
      }
    };

    renderDiagram();

    return () => {
      isMounted = false;
    };
  }, [value, theme]);

  return (
    <div
      className="d2-container"
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        margin: '1.5em 0',
        maxWidth: '100%',
        overflow: 'auto',
        minHeight: loading ? '100px' : 'auto',
      }}
    >
      {/* 背景を透明にするためのスタイル注入 */}
      <style>{`
        .d2-container svg rect.d2-background {
          fill: none !important;
        }
        /* ダークモード時はデフォルトでテキストが黒い場合があるため微調整が必要な場合があるが、
           theme: 200 を指定していれば D2 側で白に近い色にしてくれるはず */
      `}</style>
      {loading && (
        <div style={{ padding: '1em', color: 'var(--text-muted)' }}>
          Rendering D2 diagram...
        </div>
      )}
      {error ? (
        <pre
          className="d2-error"
          style={{
            color: '#f44336',
            padding: '1em',
            border: '1px solid #f44336',
            borderRadius: '4px',
            maxWidth: '100%',
            overflow: 'auto',
          }}
        >
          D2 Error: {error}
        </pre>
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ width: '100%', display: 'flex', justifyContent: 'center' }}
        />
      )}
    </div>
  );
};

/**
 * D2 コードブロック用のプラグイン定義
 */
export const d2Plugin: MarkdownPlugin = {
  name: 'd2',
  codeProcessors: [
    {
      language: 'd2',
      component: D2Component,
    },
  ],
};
