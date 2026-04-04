import React from 'react';

/**
 * プレプロセッサ: マークダウン解析前に文字列を変換するプラグイン
 */
export type MarkdownPreprocessor = (text: string) => string;

/**
 * コードプロセッサ: 特定の言語のコードブロックをレンダリングするプラグイン
 */
export interface MarkdownCodeProcessor {
  language: string;
  component: React.ComponentType<{
    value: string;
    language?: string;
  }>;
}

/**
 * マークダウンプラグインの定義
 */
export interface MarkdownPlugin {
  name: string;
  preprocessors?: MarkdownPreprocessor[];
  codeProcessors?: MarkdownCodeProcessor[];
}
