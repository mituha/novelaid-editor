import kuromoji from 'kuromoji';
import path from 'path';

export interface CalibrationIssue {
  id: string;
  type:
    | 'particle_repetition'
    | 'word_frequency'
    | 'consistency'
    | 'kanji_open_close';
  message: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  suggestion?: string;
}

export interface FrequencyResult {
  word: string;
  count: number;
  pos: string;
}

export class CalibrationService {
  private static instance: CalibrationService;

  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;

  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): CalibrationService {
    if (!CalibrationService.instance) {
      CalibrationService.instance = new CalibrationService();
    }
    return CalibrationService.instance;
  }

  public async initialize(dicPath: string): Promise<void> {
    if (this.tokenizer) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) {
          // eslint-disable-next-line no-console
          console.error('Kuromoji initialization failed:', err);
          reject(err);
        } else {
          this.tokenizer = tokenizer;
          resolve();
        }
      });
    });

    return this.initializationPromise;
  }

  public async analyze(text: string): Promise<kuromoji.IpadicFeatures[]> {
    if (!this.tokenizer) {
      throw new Error('Tokenizer not initialized');
    }
    return this.tokenizer.tokenize(text);
  }

  private prepareAnalysis(text: string) {
    const cleanText = text.replace(/^\uFEFF/, '');
    const lineStarts: number[] = [0];
    for (let i = 0; i < cleanText.length; i++) {
      if (cleanText[i] === '\n') lineStarts.push(i + 1);
    }

    const getLineCol = (index: number) => {
      let line = 0;
      while (line + 1 < lineStarts.length && lineStarts[line + 1] <= index) {
        line++;
      }
      return {
        line: line + 1,
        col: index - lineStarts[line] + 1,
      };
    };

    return { cleanText, getLineCol };
  }

  public async getFrequentWords(text: string): Promise<FrequencyResult[]> {
    const cleanText = text.replace(/^\uFEFF/, '');
    const tokens = await this.analyze(cleanText);
    const frequencyMap = new Map<string, { count: number; pos: string }>();

    tokens.forEach((token) => {
      if (
        ['名詞', '動詞', '形容詞', '副詞', '連体詞', '接続詞', '感動詞'].includes(
          token.pos,
        )
      ) {
        if (
          token.pos === '名詞' &&
          ['非自立', '接尾', '代名詞', '数'].includes(token.pos_detail_1)
        ) {
          return;
        }
        if (token.surface_form.length <= 1) return; // Skip single characters

        const key = token.surface_form;
        const current = frequencyMap.get(key) || { count: 0, pos: token.pos };
        frequencyMap.set(key, { count: current.count + 1, pos: token.pos });
      }
    });

    return Array.from(frequencyMap.entries())
      .map(([word, { count, pos }]) => ({ word, count, pos }))
      .sort((a, b) => b.count - a.count);
  }

  public async checkParticles(text: string): Promise<CalibrationIssue[]> {
    const { cleanText, getLineCol } = this.prepareAnalysis(text);
    const tokens = await this.analyze(cleanText);
    const issues: CalibrationIssue[] = [];

    let currentSentenceParticles: {
      token: kuromoji.IpadicFeatures;
      index: number;
    }[] = [];

    for (let i = 0; i < tokens.length; i += 1) {
      const token = tokens[i];
      const surface = token.surface_form;

      if (surface === '。' || surface === '！' || surface === '？' || surface === '\n') {
        this.checkSentenceIssues(currentSentenceParticles, issues, getLineCol);
        currentSentenceParticles = [];
        continue;
      }

      if (
        token.pos === '助詞' &&
        ['の', 'が', 'に', 'を', 'と', 'で', 'や', 'も'].includes(surface)
      ) {
        currentSentenceParticles.push({
            token,
            index: token.word_position - 1 // kuromoji index is 1-based
        });
      }
    }
    // Check last sentence
    this.checkSentenceIssues(currentSentenceParticles, issues, getLineCol);

    return issues;
  }

  private checkSentenceIssues(
    particles: { token: kuromoji.IpadicFeatures; index: number }[],
    issues: CalibrationIssue[],
    getLineCol: (index: number) => { line: number; col: number },
  ) {
    const counts: Record<string, number> = {};

    particles.forEach((p) => {
      counts[p.token.surface_form] = (counts[p.token.surface_form] || 0) + 1;
    });

    Object.entries(counts).forEach(([pType, count]) => {
      if (count >= 3) {
        // Only mark if 3 or more of same particle in one sentence
        const relevantParticles = particles.filter(
          (p) => p.token.surface_form === pType,
        );

        relevantParticles.forEach((p) => {
          const { line, col } = getLineCol(p.index);
          issues.push({
            id: `particle-${p.index}`,
            type: 'particle_repetition',
            message: `助詞「${pType}」が文中で連続しています（${count}回）`,
            range: {
              startLine: line,
              startColumn: col,
              endLine: line,
              endColumn: col + pType.length,
            },
          });
        });
      }
    });
  }

  public async checkConsistency(text: string): Promise<CalibrationIssue[]> {
    const { cleanText, getLineCol } = this.prepareAnalysis(text);
    const tokens = await this.analyze(cleanText);
    const issues: CalibrationIssue[] = [];

    const checkMap: Record<string, string> = {
      '事': 'こと',
      '時': 'とき',
      '所': 'ところ',
      '他': 'ほか',
      '等': 'など',
      '為': 'ため',
      '故': 'ゆえ',
      '或いは': 'あるいは',
      '貴方': 'あなた',
      '何時': 'いつ',
      '何処': 'どこ',
      '此処': 'ここ',
      '其処': 'そこ',
      '彼処': 'あそこ',
      '何故': 'なぜ',
      '殆ど': 'ほとんど',
      '滅多に': 'めったに',
      '居る': 'いる', // 補助動詞
      '或る': 'ある',
      '無く': 'なく', // 補助形容詞など
      '無い': 'ない',
    };

    tokens.forEach((token) => {
      const surface = token.surface_form;
      if (checkMap[surface]) {
        let shouldWarn = true;

        // Refine rules:
        // '事' -> warn if noun (usually formal noun)
        if (surface === '事' && token.pos === '名詞') shouldWarn = true;
        // '時' -> warn if noun
        if (surface === '時' && token.pos === '名詞') shouldWarn = true;

        if (shouldWarn) {
             const suggestion = checkMap[surface];
             const { line, col } = getLineCol(token.word_position - 1); // kuromoji index is 1-based

             issues.push({
               id: `consistency-${token.word_position}`,
               type: 'kanji_open_close',
               message: `「${surface}」は「${suggestion}」と開くのが一般的です`,
               range: {
                 startLine: line,
                 startColumn: col,
                 endLine: line,
                 endColumn: col + surface.length,
               },
               suggestion,
             });
        }
      }
    });

    return issues;
  }
}
