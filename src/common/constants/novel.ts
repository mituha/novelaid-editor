/**
 * 小説特有の記法（ルビ、傍点、セリフなど）に関する正規表現定数
 */

export const NOVEL_PATTERNS = {
  /**
   * ルビ記法: |漢字《かんじ》 or ｜漢字《かんじ》
   * 1番目のグループに本文、2番目のグループにルビが選ばれます
   */
  RUBY_WITH_PIPE: /[|｜]([^|｜\n《》]+)《([^《》\n]+)》/g,

  /**
   * 一般的なルビ記法（パイプなし）: 漢字《かんじ》
   * カクヨム記法に準拠し、漢字（々〇含む）の直後に《ルビ》が来る場合のみマッチ
   */
  RUBY_WITHOUT_PIPE: /([々〇\u4e00-\u9fcf\u3400-\u4dbf]+)《([^《》\n]+)》/g,

  /**
   * 傍点（圏点）: 《《傍点》》
   */
  BOUTEN: /《《([^《》\n]+)》》/g,

  /**
   * セリフ（鉤括弧）: 「セリフ」
   */
  DIALOGUE: /「(.*?)」/g,

  /**
   * セリフ（二重鉤括弧）: 『セリフ』
   */
  DIALOGUE_DOUBLE: /『(.*?)』/g,

  /**
   * 全角スペース: \u3000
   */
  FULL_WIDTH_SPACE: /\u3000/g,
};

/**
 * Monaco Editor (Monarch) 用のトークナイザ定義で使いやすい形式
 * Monarch では正規表現リテラルをそのまま渡すことが多いため、
 * 必要に応じてここから参照、または再定義します。
 */
export const NOVEL_MONARCH_PATTERNS = {
  RUBY_PIPE: /[|｜]([^|｜\n《》]+)《([^《》\n]+)》/,
  RUBY_KANJI: /([々〇\u4e00-\u9fcf\u3400-\u4dbf]+)《([^《》\n]+)》/,
  BOUTEN: /《《[^》]*》》/,
  DIALOGUE_START: /「/,
  DIALOGUE_END: /」/,
  DIALOGUE_DOUBLE_START: /『/,
  DIALOGUE_DOUBLE_END: /』/,
};
