import React from 'react';

/**
 * プレプロセッサ: マークダウン解析前に文字列を変換するプラグイン
 */
export type MarkdownPreprocessor = (text: string) => string;

/**
 * コードブロック・プレプロセッサ: 特定の言語のコードブロックを解析・変換するプラグイン
 * 言語名、コード本体、解析済みの属性を受け取り、それらを更新して返す
 */
export interface MarkdownCodePreprocessor {
  languages: string[];
  preprocess: (args: {
    language: string;
    code: string;
    attributes: Record<string, any>;
  }) => {
    language: string;
    code: string;
    attributes: Record<string, any>;
  };
}

/**
 * コードプロセッサ: 特定の言語のコードブロックをレンダリングするプラグイン
 */
export interface MarkdownCodeProcessor {
  language: string;
  component: React.ComponentType<{
    value: string;
    language?: string;
    attributes?: Record<string, any>;
  }>;
}

/**
 * マークダウンプラグインの定義
 */
export interface MarkdownPlugin {
  name: string;
  preprocessors?: MarkdownPreprocessor[];
  codePreprocessors?: MarkdownCodePreprocessor[];
  codeProcessors?: MarkdownCodeProcessor[];
}
