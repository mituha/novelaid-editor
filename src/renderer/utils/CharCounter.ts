import { stripRuby, NOVEL_PATTERNS } from 'novelaid-ruby';

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
    // 1 & 2. Remove Emphasis Dots and Ruby syntax using novelaid-ruby
    let processed = stripRuby(text);

    // 3. Remove whitespace, newlines, and full-width spaces
    processed = processed.replace(/[\s]/g, ''); // \s includes \r\n\t
    processed = processed.replace(NOVEL_PATTERNS.FULL_WIDTH_SPACE, '');

    return [
      {
        label: '行数',
        value: text.split('\n').filter((line) => line.trim().length > 0).length,
      },
      {
        label: '文字数',
        value: processed.length,
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

