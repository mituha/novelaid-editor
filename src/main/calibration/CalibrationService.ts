import kuromoji from 'kuromoji';
import { createLinter } from 'textlint';
import type { TextlintResult } from '@textlint/kernel';
import path from 'path';
import { app } from 'electron';

// Import rules programmatically
import presetJaSpacing from 'textlint-rule-preset-ja-spacing';
import noDroppingTheRa from 'textlint-rule-no-dropping-the-ra';
import noDoubledJoshi from 'textlint-rule-no-doubled-joshi';

// Import plugins programmatically
import textPlugin from '@textlint/textlint-plugin-text';
import markdownPlugin from '@textlint/textlint-plugin-markdown';

export interface CalibrationIssue {
  id: string;
  type:
    | 'particle_repetition'
    | 'word_frequency'
    | 'consistency'
    | 'kanji_open_close'
    | 'textlint';
  message: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  ranges?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }[];
  suggestion?: string;
  source?: string;
}

export interface FrequencyResult {
  word: string;
  count: number;
  pos: string;
}

export class CalibrationService {
  private static instance: CalibrationService;

  private tokenizer: kuromoji.Tokenizer<kuromoji.IpadicFeatures> | null = null;
  private linter: ReturnType<typeof createLinter> | null = null;

  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): CalibrationService {
    if (!CalibrationService.instance) {
      CalibrationService.instance = new CalibrationService();
    }
    return CalibrationService.instance;
  }

  public async initialize(dicPath: string): Promise<void> {
    if (this.tokenizer && this.linter) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = new Promise((resolve, reject) => {
      // Initialize Kuromoji
      const kuromojiPromise = new Promise<void>((resolveKuromoji, rejectKuromoji) => {
        kuromoji.builder({ dicPath }).build((err, tokenizer) => {
          if (err) {
            console.error('Kuromoji initialization failed:', err);
            rejectKuromoji(err);
          } else {
            this.tokenizer = tokenizer;
            resolveKuromoji();
          }
        });
      });

      // Initialize TextLint
      const textLintPromise = new Promise<void>(async (resolveTextLint) => {
        try {
          console.log(`[Textlint] Initializing manually (without .textlintrc)`);
          console.log(`[Textlint] Execution context: ${process.type}, Packaged: ${app.isPackaged}`);

          // Helper to handle both ESM and CJS imports
          const getModule = (mod: any) => (mod && mod.default ? mod.default : mod);

          // Manual rule setup
          const rules: any[] = [];

          const raRule = getModule(noDroppingTheRa);
          if (raRule) {
            rules.push({ ruleId: 'no-dropping-the-ra', rule: raRule });
          }

          const joshiRule = getModule(noDoubledJoshi);
          if (joshiRule) {
            rules.push({ ruleId: 'no-doubled-joshi', rule: joshiRule });
          }

          const spacingPreset = getModule(presetJaSpacing);
          if (spacingPreset && spacingPreset.rules) {
            Object.keys(spacingPreset.rules).forEach((key) => {
              rules.push({
                ruleId: `preset-ja-spacing/${key}`,
                rule: spacingPreset.rules[key],
                options: spacingPreset.rulesConfig ? spacingPreset.rulesConfig[key] : true,
              });
            });
          }

          // Manual plugin setup
          const plugins: any[] = [
            {
              pluginId: 'text',
              plugin: getModule(textPlugin),
            },
            {
              pluginId: 'markdown',
              plugin: getModule(markdownPlugin),
            },
          ];

          console.log(`[Textlint] Registering ${rules.length} rules and ${plugins.length} plugins.`);

          const { TextlintKernelDescriptor } = await import('@textlint/kernel');

          const descriptor = new TextlintKernelDescriptor({
            rules: rules,
            filterRules: [],
            plugins: plugins,
          });

          const ruleIds = descriptor.rule.descriptors.map((r: any) => r.id);
          const pluginIds = descriptor.plugin.descriptors.map((p: any) => p.id);
          console.log(`[Textlint] Manual config applied. Rules: [${ruleIds.join(', ')}], Plugins: [${pluginIds.join(', ')}]`);

          this.linter = createLinter({ descriptor });

          console.log('[Textlint] Linter created successfully (Manual)');
          resolveTextLint();
        } catch (e) {
          console.error('[Textlint] Manual initialization failed:', e);
          resolveTextLint();
        }
      });

      Promise.all([kuromojiPromise, textLintPromise])
        .then(() => resolve())
        .catch((err) => reject(err));
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

  public async runTextlint(
    text: string,
    settings: any,
  ): Promise<CalibrationIssue[]> {
    if (!this.linter || !settings?.textlint) {
      return [];
    }

    try {
      console.log(`[Textlint] Running check on ${text.length} characters.`);
      const result: TextlintResult = await this.linter.lintText(text, 'text.txt');
      const issues: CalibrationIssue[] = [];

      if (result.messages.length > 0) {
        result.messages.forEach((msg) => {
          // Filter based on settings
          let isEnabled = true;
          if (msg.ruleId === 'no-dropping-the-ra') isEnabled = !!settings.noDroppingTheRa;
          else if (msg.ruleId === 'no-doubled-joshi') isEnabled = !!settings.noDoubledJoshi;
          else if (msg.ruleId.startsWith('preset-ja-spacing')) isEnabled = !!settings.jaSpacing;

          if (!isEnabled) return;

          issues.push({
            id: `textlint-${msg.line}-${msg.column}-${msg.ruleId}`,
            type: msg.ruleId === 'no-doubled-joshi' ? 'particle_repetition' : 'textlint',
            message: msg.message,
            range: {
              startLine: msg.line,
              startColumn: msg.column,
              endLine: msg.line,
              endColumn: msg.column + 1,
            },
            suggestion: msg.fix ? msg.fix.text : undefined,
            source: msg.ruleId,
          });
        });
      }
      return issues;
    } catch (error) {
      console.error('[Textlint] Error during lintText:', error);
      return [];
    }
  }

  public async checkConsistency(
    text: string,
    enabled: boolean = true,
  ): Promise<CalibrationIssue[]> {
    if (!enabled) return [];

    const { cleanText, getLineCol } = this.prepareAnalysis(text);
    const tokens = await this.analyze(cleanText);
    const issues: CalibrationIssue[] = [];

    const checkMap: Record<string, string> = {
      事: 'こと',
      時: 'とき',
      所: 'ところ',
      他: 'ほか',
      等: 'など',
      為: 'ため',
      故: 'ゆえ',
      或いは: 'あるいは',
      貴方: 'あなた',
      何時: 'いつ',
      何処: 'どこ',
      此処: 'ここ',
      其処: 'そこ',
      彼処: 'あそこ',
      何故: 'なぜ',
      殆ど: 'ほとんど',
      滅多に: 'めったに',
      居る: 'いる', // 補助動詞
      或る: 'ある',
      無く: 'なく', // 補助形容詞など
      無い: 'ない',
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
