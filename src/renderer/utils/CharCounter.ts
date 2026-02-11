import { NOVEL_PATTERNS } from '../../common/constants/novel';

export interface CountMetric {
  label: string;
  value: number;
}

export interface CountStrategy {
  count(text: string): CountMetric[];
}

/**
 * Standard character counter (raw count including everything)
 */
export class DefaultCountStrategy implements CountStrategy {
  count(text: string): CountMetric[] {
    return [
      {
        label: '文字数(全)',
        value: text.length,
      },
    ];
  }
}

/**
 * Novel-specific counter
 * Excludes ruby syntax, whitespace, and empty lines.
 */
export class NovelCountStrategy implements CountStrategy {
  count(text: string): CountMetric[] {
    // 1. Remove Emphasis Dots: 《《傍点》》 -> 傍点
    let processed = text.replace(NOVEL_PATTERNS.BOUTEN, '$1');

    // 2. Remove Ruby syntax: |漢字《かんじ》 or ｜漢字《かんじ》 or 漢字《かんじ》
    // We want to keep the "Body" (漢字), not the ruby (かんじ) or the prefix pipe.
    processed = processed.replace(NOVEL_PATTERNS.RUBY_WITH_PIPE, '$1'); // With pipe
    processed = processed.replace(NOVEL_PATTERNS.RUBY_WITHOUT_PIPE, '$1'); // Without pipe (general ruby)

    // 3. Remove whitespace, newlines, and full-width spaces
    processed = processed.replace(/[\s]/g, ''); // \s includes \r\n\t
    processed = processed.replace(NOVEL_PATTERNS.FULL_WIDTH_SPACE, '');

    return [
      {
        label: '文字数',
        value: processed.length,
      },
      {
        label: '行数',
        value: text.split('\n').filter((line) => line.trim().length > 0).length,
      },
    ];
  }
}

export class CharCounter {
  private static strategies: Record<string, CountStrategy> = {
    default: new DefaultCountStrategy(),
    novel: new NovelCountStrategy(),
  };

  static getMetrics(text: string, path: string | null): CountMetric[] {
    if (!text) return [];

    // For now, use novel strategy for all files, or detect by extension
    const extension = path?.split('.').pop()?.toLowerCase();
    const strategy =
      extension === 'txt' || extension === 'md'
        ? this.strategies.novel
        : this.strategies.default;

    return strategy.count(text);
  }
}
