import { countCharacters, DetailedCountResult, CountOptions } from 'novelaid-ruby';

/**
 * 文字数カウントを実行するユーティリティクラス。
 * ロジックの実体は novelaid-ruby に委譲しています。
 */
export class CharCounter {
  /**
   * テキストの詳細な文字数カウントメトリクスを算出します。
   * 
   * @param text 対象のテキスト
   * @param options オプション（原稿用紙換算用の行数・文字数など）
   * @returns DetailedCountResult
   */
  static getDetailedMetrics(text: string, options?: CountOptions): DetailedCountResult {
    return countCharacters(text, options);
  }
}


