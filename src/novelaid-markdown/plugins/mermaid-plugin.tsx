import React, { useEffect, useRef, useState } from 'react';
import { MarkdownPlugin } from '../types';

/**
 * Mermaid インスタンスのシングルトン保持用
 */
let sharedMermaidInstance: any = null;
let mermaidPromise: Promise<any> | null = null;

const getMermaidInstance = async () => {
  if (sharedMermaidInstance) return sharedMermaidInstance;
  if (!mermaidPromise) {
    mermaidPromise = (async () => {
      try {
        const m = await import('mermaid');
        sharedMermaidInstance = m.default || m;
        return sharedMermaidInstance;
      } catch (err) {
        mermaidPromise = null;
        throw err;
      }
    })();
  }
  return mermaidPromise;
};

/**
 * Mermaid は内部で共有 DOM 要素を使用するため、並列レンダリングが衝突し、
 * エラーが他の図に波及したり描画が止まったりすることがあります。
 * これを防ぐため、アプリ全体で描画を直列化（排他制御）するためのロックです。
 */
let globalRenderLock = Promise.resolve();

/**
 * Mermaid グラフをレンダリングするコンポーネント
 */
const MermaidComponent: React.FC<{
  value: string;
  attributes?: Record<string, any>;
}> = ({ value, attributes = {} }) => {
  const [svg, setSvg] = useState<string>('');

  // 属性からサイズを取得
  const { width, height } = attributes;

  useEffect(() => {
    let active = true;

    /**
     * Mermaid が解析エラー時に作成する可能性のあるデバッグ用 DOM 要素を削除する
     */
    const cleanupStrayElements = () => {
      const strayIds = ['dmermaid-debug', 'mermaid-error-container'];
      strayIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });

      // ID が dmermaid- で始まる動的な要素も一掃する
      document.querySelectorAll('[id^="dmermaid-"]').forEach((el) => {
        if (el.parentNode === document.body) {
          el.remove();
        }
      });
    };

    const renderDiagram = async () => {
      if (!value || value.trim() === '') {
        setSvg('');
        return;
      }

      const valueSnippet = value.substring(0, 20).replace(/\n/g, ' ');

      // レンダリング開始時に一時的に表示をクリア（ハング対策）
      setSvg(
        '<div class="mermaid-loading" style="opacity: 0.6; padding: 1em; font-size: 12px; color: gray;">Mermaid rendering...</div>',
      );

      // 前のレンダリングが終わるまで待機し、自分の番を予約する (Mutex)
      // eslint-disable-next-line no-console
      //console.log(`[Mermaid] Queued: ${valueSnippet}...`);

      const currentTask = (async () => {
        // 先行する描画タスクを待機
        await globalRenderLock;
        if (!active) return;

        try {
          // eslint-disable-next-line no-console
          //console.log(`[Mermaid] Start rendering (Lock acquired): ${valueSnippet}...`);

          // timeout 処理のための Promise
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Rendering Timeout (5s)')), 5000),
          );

          // レンダリング処理全体をタイムアウト付きで実行
          await Promise.race([
            (async () => {
              // シングルトンインスタンスを取得
              const mermaid = await getMermaidInstance();
              if (!active) return;

              // レンダリング前にクリーンアップ（前回の失敗の影響を排除）
              cleanupStrayElements();

              // 1. まず構文チェックを行う
              // eslint-disable-next-line no-console
              //console.log(`[Mermaid] Parsing: ${valueSnippet}...`);
              await mermaid.parse(value);
              if (!active) return;

              // 2. 問題なければレンダリング
              // eslint-disable-next-line no-console
              console.log(`[Mermaid] Executing render: ${valueSnippet}...`);
              const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
              const { svg: renderedSvg } = await mermaid.render(id, value);
              if (!active) return;

              // eslint-disable-next-line no-console
              //console.log(`[Mermaid] Render success: ${valueSnippet}`);
              setSvg(renderedSvg);
            })(),
            timeoutPromise,
          ]);
        } catch (error) {
          if (!active) return;

          // eslint-disable-next-line no-console
          console.error(`[Mermaid] Render failed: ${value}`, error);

          // 失敗時にもクリーンアップを行う
          cleanupStrayElements();

          // エラーメッセージの表示
          const errorMessage =
            error instanceof Error ? error.message : 'Invalid Mermaid syntax';
          setSvg(
            `<pre class="mermaid-error" style="color: #f44336; padding: 1em; border: 1px solid #f44336; border-radius: 4px; background: rgba(244, 67, 54, 0.05); font-size: 13px; white-space: pre-wrap; word-break: break-all;">Mermaid Syntax Error:\n${errorMessage}</pre>`,
          );
        }
      })();

      // 次の人が待てるようにグローバルロックを更新（成功失敗にかかわらず完了を待つPromiseにする）
      globalRenderLock = (async () => {
        try {
          await currentTask;
        } catch (e) {
          // ignore error to unblock next render
        }
      })();

      await currentTask;
    };

    renderDiagram();

    return () => {
      active = false;
    };
  }, [value]);

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
