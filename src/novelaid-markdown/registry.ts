import { MarkdownPlugin, MarkdownPreprocessor, MarkdownCodeProcessor, MarkdownCodePreprocessor } from './types';

/**
 * マークダウンプロセッサのレジストリ
 */
export class MarkdownProcessorRegistry {
  private plugins: MarkdownPlugin[] = [];

  /**
   * プラグインを登録
   */
  register(plugin: MarkdownPlugin) {
    this.plugins.push(plugin);
  }

  /**
   * 全てのプレプロセッサを取得
   */
  getPreprocessors(): MarkdownPreprocessor[] {
    return this.plugins.flatMap((p) => p.preprocessors || []);
  }

  /**
   * 全てのコードプレプロセッサを取得
   */
  getCodePreprocessors(): MarkdownCodePreprocessor[] {
    return this.plugins.flatMap((p) => p.codePreprocessors || []);
  }

  /**
   * 全てのコードプロセッサを取得
   */
  getCodeProcessors(): MarkdownCodeProcessor[] {
    return this.plugins.flatMap((p) => p.codeProcessors || []);
  }

  /**
   * 日本語小説向けのデフォルトプラグインを登録したレジストリを取得
   */
  static getDefault() {
    const registry = new MarkdownProcessorRegistry();
    // 循環参照を避けるため、個別のインポートは index.ts または外部で行う
    return registry;
  }
}
