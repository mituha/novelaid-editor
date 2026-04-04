import { NOVEL_PATTERNS } from '../../common/constants/novel';
import { MarkdownPlugin } from '../types';

/**
 * カクヨム記法のルビと傍点を処理するプラグイン
 */
export const novelSyntaxPlugin: MarkdownPlugin = {
  name: 'novel-syntax',
  preprocessors: [
    (text: string): string => {
      if (!text) return '';

      let processed = text;

      // 1. ルビのパース (Ruby)
      // パイプありの記法 (|漢字《かんじ》) を先に置換し、次にパイプなしの記法 (漢字《かんじ》) を置換する
      processed = processed.replace(
        NOVEL_PATTERNS.RUBY_WITH_PIPE,
        '<ruby>$1<rt>$2</rt></ruby>',
      );
      processed = processed.replace(
        NOVEL_PATTERNS.RUBY_WITHOUT_PIPE,
        '<ruby>$1<rt>$2</rt></ruby>',
      );

      // 2. 傍点のパース (Bouten)
      // 《《強調》》 のような記法を span タグに変換する
      processed = processed.replace(
        NOVEL_PATTERNS.BOUTEN,
        '<span class="bouten">$1</span>',
      );

      return processed;
    },
  ],
};
