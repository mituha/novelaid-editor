import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../renderer/contexts/ThemeContext';
import { MarkdownPlugin } from '../types';

/**
 * D2 インスタンスのシングルトン保持用（WASM の多重ロードを避けるため）
 */
let sharedD2Instance: any = null;
let d2Promise: Promise<any> | null = null;

const getD2Instance = async () => {
  if (sharedD2Instance) return sharedD2Instance;
  if (!d2Promise) {
    d2Promise = (async () => {
      try {
        const { D2 } = await import('@terrastruct/d2');
        sharedD2Instance = new D2();
        // 初期化待ち
        await sharedD2Instance.ready;
        return sharedD2Instance;
      } catch (err) {
        d2Promise = null;
        throw err;
      }
    })();
  }
  return d2Promise;
};

/**
 * D2 は WASM エンジンを共有するため、複数を同時に実行するとハングする可能性がある。
 * そのため、レンダリング処理を直列化するためのキューを設ける。
 */
let globalRenderQueue = Promise.resolve();

/**
 * 戻り値（SVG）が文字列でない場合に、適切に抽出またはデコードする
 */
const extractSvg = (val: any): string => {
  if (typeof val === 'string') return val;
  if (!val) return '';

  // Uint8Array (バイナリ) の場合
  if (val instanceof Uint8Array || (val.buffer && val.byteLength !== undefined)) {
    try {
      return new TextDecoder().decode(val);
    } catch {
      return 'Error: Failed to decode D2 binary output';
    }
  }

  // オブジェクトの場合
  if (typeof val === 'object') {
    // 可能性のあるプロパティをチェック
    const svg = val.contents || val.svg || val.data;
    if (typeof svg === 'string') return svg;
    if (svg instanceof Uint8Array) return new TextDecoder().decode(svg);

    // 最終手段として JSON 文字列化（デバッグ用）
    try {
      return JSON.stringify(val);
    } catch {
      return 'Error: D2 returned an un-stringifiable object';
    }
  }

  return String(val);
};

/**
 * 任意のエラー値を文字列に変換する
 */
const stringifyError = (err: any): string => {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  try {
    const stringified = JSON.stringify(err);
    if (stringified === '{}' && err.toString) return err.toString();
    return stringified;
  } catch {
    return 'Unknown D2 error';
  }
};

/**
 * D2 ダイアグラムをレンダリングするコンポーネント
 */
const D2Component: React.FC<{
  value: string;
  attributes?: Record<string, any>;
}> = ({ value, attributes = {} }) => {
  const { theme } = useTheme();
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // 属性からサイズを取得
  const { width, height, pad } = attributes;

  useEffect(() => {
    let isMounted = true;

    const renderDiagram = async () => {
      if (!value) return;

      setLoading(true);
      setError(null);

      // キューに入れて順番に処理する
      globalRenderQueue = globalRenderQueue
        .catch(() => {}) // 前の処理が失敗しても次へ
        .then(async () => {
          if (!isMounted) return;

          try {
            // インスタンス取得
            const d2 = await getD2Instance();

            // コンパイル
            const compileResult = await d2.compile(value);

            // エラーチェック
            if (compileResult && compileResult.errors && compileResult.errors.length > 0) {
              throw new Error(compileResult.errors[0].message || 'D2 Syntax Error');
            }

            // テーマ設定
            const themeId = theme === 'dark' ? 200 : 0;
            const renderOptions = {
              ...compileResult.renderOptions,
              themeID: themeId,
              noXMLTag: true,
              pad: pad !== undefined ? parseInt(String(pad), 10) : 20,
            };

            // レンダリング実行
            const result = await d2.render(compileResult.diagram, renderOptions);

            if (isMounted) {
              const svgString = extractSvg(result);
              // 万が一空だったり、[object Object] の名残がある場合はエラーとする
              if (!svgString || svgString.startsWith('[object Object]')) {
                throw new Error('D2 rendering failed to produce a valid SVG string');
              }
              setSvg(svgString);
              setLoading(false);
              setError(null);
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error('D2 rendering failed:', err);
            if (isMounted) {
              setError(stringifyError(err));
              setLoading(false);
            }
          }
        });
    };

    // デバウンス
    const timer = setTimeout(() => {
      renderDiagram();
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
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
        width: width || '100%',
        height: height || 'auto',
        minHeight: loading ? '100px' : 'auto',
      }}
    >
      {/* 背景を透明にするためのスタイル注入 */}
      <style>{`
        .d2-container svg {
          max-width: 100%;
          max-height: 100%;
          height: auto;
        }
        .d2-container svg rect.d2-background {
          fill: none !important;
        }
      `}</style>
      {loading && !error && (
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
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-all',
          }}
        >
          D2 Error: {error}
        </pre>
      ) : (
        <div
          dangerouslySetInnerHTML={{ __html: svg }}
          style={{ 
            width: '100%', 
            flex: 1, 
            minHeight: 0, 
            display: 'flex', 
            justifyContent: 'center',
            alignItems: 'center'
          }}
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
