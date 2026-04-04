import { MarkdownProcessorRegistry } from './registry';
import { novelSyntaxPlugin } from './plugins/novel-syntax';
import { mermaidPlugin } from './plugins/mermaid-plugin';
import { mapPlugin } from './plugins/map-plugin';
import { d2Plugin } from './plugins/d2-plugin';
import { MarkdownCodeProcessor } from './types';

/**
 * 日本語小説執筆向けに最適化されたマークダウンプロセッサ
 */
export class NovelaidMarkdownProcessor {
  private registry: MarkdownProcessorRegistry;

  constructor() {
    this.registry = new MarkdownProcessorRegistry();
    // デフォルトプラグインの登録
    this.registry.register(novelSyntaxPlugin);
    this.registry.register(mermaidPlugin);
    this.registry.register(mapPlugin);
    this.registry.register(d2Plugin);
  }

  /**
   * 追加のプラグインを登録
   */
  registerPlugin(plugin: any) {
    this.registry.register(plugin);
  }

  /**
   * マークダウン解析前の処理（プリプロセッサ）を実行
   */
  preprocess(content: string): string {
    let processed = content;
    const preprocessors = this.registry.getPreprocessors();
    for (const preprocessor of preprocessors) {
      processed = preprocessor(processed);
    }
    return processed;
  }

  /**
   * コードブロックプロセッサを取得
   */
  getCodeProcessors(): MarkdownCodeProcessor[] {
    return this.registry.getCodeProcessors();
  }
}

// シングルトンとしてデフォルトのプロセッサをエクスポート
export const defaultProcessor = new NovelaidMarkdownProcessor();
export * from './types';
export { default as BaseMarkdown } from './renderer/BaseMarkdown';
export { default as MarkdownPreview } from './renderer/MarkdownPreview';
