import { transformToHtml } from 'novelaid-ruby';

/**
 * 小説特有の記法（ルビや傍点など）をHTMLタグに変換します。
 *
 * @param text 変換対象のテキスト
 * @returns HTMLタグに置換されたテキスト
 */
export const transformNovelSyntax = (text: string): string => {
  return transformToHtml(text);
};

