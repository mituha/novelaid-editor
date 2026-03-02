import { Monaco } from '@monaco-editor/react';
import {
  NOVEL_MONARCH_PATTERNS,
  NOVEL_PATTERNS,
} from '../../../common/constants/novel';

/**
 * エディターのドキュメントタイプ別の機能を管理するクラス
 */
export class EditorSupport {
  /**
   * Monacoのグローバル設定（言語定義やテーマ）を登録します
   */
  public static registerLanguages(monaco: Monaco) {
    if (monaco.languages.getLanguages().some((lang: any) => lang.id === 'novel')) {
        return;
    }

    monaco.languages.register({ id: 'novel' });

    monaco.languages.setMonarchTokensProvider('novel', {
      tokenizer: {
        root: [
          [
            NOVEL_MONARCH_PATTERNS.DIALOGUE_START,
            { token: 'novel.dialogue', next: '@dialogue' },
          ],
          [
            NOVEL_MONARCH_PATTERNS.DIALOGUE_DOUBLE_START,
            { token: 'novel.dialogue', next: '@dialogue_double' },
          ],
          [NOVEL_MONARCH_PATTERNS.RUBY_PIPE, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.RUBY_KANJI, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.BOUTEN, 'novel.bouten'],
          { include: '@whitespace' },
        ],
        dialogue: [
          [
            NOVEL_MONARCH_PATTERNS.DIALOGUE_END,
            { token: 'novel.dialogue', next: '@pop' },
          ],
          [NOVEL_MONARCH_PATTERNS.RUBY_PIPE, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.RUBY_KANJI, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.BOUTEN, 'novel.bouten'],
          [/./, 'novel.dialogue'],
        ],
        dialogue_double: [
          [
            NOVEL_MONARCH_PATTERNS.DIALOGUE_DOUBLE_END,
            { token: 'novel.dialogue', next: '@pop' },
          ],
          [NOVEL_MONARCH_PATTERNS.RUBY_PIPE, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.RUBY_KANJI, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.BOUTEN, 'novel.bouten'],
          [/./, 'novel.dialogue'],
        ],
        whitespace: [[/[ \t\r\n]+/, 'white']],
      },
    });

    monaco.editor.defineTheme('novel-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'novel.dialogue', foreground: 'A6E22E' },
        { token: 'novel.ruby', foreground: '66D9EF' },
        { token: 'novel.bouten', foreground: 'FD971F' },
      ],
      colors: {},
    });

    monaco.editor.defineTheme('novel-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'novel.dialogue', foreground: '008000' },
        { token: 'novel.ruby', foreground: '0000FF' },
        { token: 'novel.bouten', foreground: 'FF8C00' },
      ],
      colors: {},
    });

    // 小説モード専用の補完
    monaco.languages.registerCompletionItemProvider('novel', {
      provideCompletionItems: async (model: any, position: any) => {
        // カーソル位置の直前の文字を確認
        const lineContent = model.getLineContent(position.lineNumber);
        const charBefore =
          position.column > 1 ? lineContent[position.column - 2] : '';

        // 句読点や閉じ括弧の直後には表示しない (novel のみ)
        const silentChars = ['。', '、', '」', '』'];
        if (silentChars.includes(charBefore)) {
          return { suggestions: [] };
        }

        const suggestions: any[] = [
          {
            label: '……',
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: '……',
            detail: '三点リーダー',
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column,
              endColumn: position.column,
            },
          },
          {
            label: '――',
            kind: monaco.languages.CompletionItemKind.Text,
            insertText: '――',
            detail: 'ダッシュ',
            range: {
              startLineNumber: position.lineNumber,
              endLineNumber: position.lineNumber,
              startColumn: position.column,
              endColumn: position.column,
            },
          },
        ];

        // 閉じ括弧の補完ロジック
        const textBefore = model.getValueInRange({
          startLineNumber: 1,
          startColumn: 1,
          endLineNumber: position.lineNumber,
          endColumn: position.column,
        });
        const textAfter = model.getValueInRange({
          startLineNumber: position.lineNumber,
          startColumn: position.column,
          endLineNumber: model.getLineCount(),
          endColumn: model.getLineMaxColumn(model.getLineCount()),
        });

        const bracketPairs = [
          { open: '「', close: '」', label: '」 を閉じる' },
          { open: '『', close: '』', label: '』 を閉じる' },
          { open: '（', close: '）', label: '） を閉じる' },
          { open: '［', close: '］', label: '］ を閉じる' },
          { open: '【', close: '】', label: '】 を閉じる' },
        ];

        for (const pair of bracketPairs) {
          const lastOpenIdx = textBefore.lastIndexOf(pair.open);
          const lastCloseIdx = textBefore.lastIndexOf(pair.close);

          if (lastOpenIdx > lastCloseIdx) {
            const nextOpenIdx = textAfter.indexOf(pair.open);
            const nextCloseIdx = textAfter.indexOf(pair.close);

            if (
              nextCloseIdx === -1 ||
              (nextOpenIdx !== -1 && nextCloseIdx > nextOpenIdx)
            ) {
              suggestions.push({
                label: pair.close,
                kind: monaco.languages.CompletionItemKind.Text,
                insertText: pair.close,
                detail: pair.label,
                range: {
                  startLineNumber: position.lineNumber,
                  endLineNumber: position.lineNumber,
                  startColumn: position.column,
                  endColumn: position.column,
                },
              });
            }
          }
        }

        return { suggestions };
      },
    });

    // 小説・マークダウン共通のメタデータ補完
    const sharedLangs = ['novel', 'markdown'];
    sharedLangs.forEach((lang) => {
      monaco.languages.registerCompletionItemProvider(lang, {
        provideCompletionItems: async (model: any, position: any) => {
          const suggestions: any[] = [];
          try {
            const charTags = ['character', '登場人物', '人名', '人物', 'chara'];
            const placeTags = [
              'places',
              'location',
              '地名',
              '施設',
              '場所',
              'place',
              'geo',
              'geography',
            ];

            const [charEntries, placeEntries] = await Promise.all([
              (window as any).electron.metadata.queryByTag(charTags),
              (window as any).electron.metadata.queryByTag(placeTags),
            ]);

            const addedNames = new Set<string>();
            const stripExt = (name: string) => name.replace(/\.[^/.]+$/, '');

            charEntries.forEach((entry: any) => {
              const name = stripExt(entry.name);
              if (!addedNames.has(name)) {
                suggestions.push({
                  label: name,
                  kind: monaco.languages.CompletionItemKind.User,
                  insertText: name,
                  detail: '登場人物',
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endColumn: position.column,
                  },
                });
                addedNames.add(name);
              }
            });

            placeEntries.forEach((entry: any) => {
              const name = stripExt(entry.name);
              if (!addedNames.has(name)) {
                suggestions.push({
                  label: name,
                  kind: monaco.languages.CompletionItemKind.Map,
                  insertText: name,
                  detail: '地名・場所',
                  range: {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: position.column,
                    endColumn: position.column,
                  },
                });
                addedNames.add(name);
              }
            });
          } catch (err) {
            console.error('Failed to fetch metadata for completions:', err);
          }
          return { suggestions };
        },
      });
    });
  }

  /**
   * エディターのデコレーションを更新するためのデータを生成します
   */
  public static getEditorDecorations(
    model: any,
    editorConfig: any,
  ): any[] {
    const newDecorations: any[] = [];
    const text = model.getValue();

    // 1. 全角スペースの可視化
    if (editorConfig.showFullWidthSpace !== false) {
      NOVEL_PATTERNS.FULL_WIDTH_SPACE.lastIndex = 0;
      let match;
      while ((match = NOVEL_PATTERNS.FULL_WIDTH_SPACE.exec(text)) !== null) {
        const startPos = model.getPositionAt(match.index);
        const endPos = model.getPositionAt(match.index + 1);
        newDecorations.push({
          range: {
            startLineNumber: startPos.lineNumber,
            startColumn: startPos.column,
            endLineNumber: endPos.lineNumber,
            endColumn: endPos.column,
          },
          options: {
            inlineClassName: 'full-width-space-decoration',
            stickiness: 1,
          },
        });
      }
    }

    // 2. ルビのハイライト (マークダウンと小説両方)
    // 重複を避けるため、まずパイプありを検索し、その箇所のインデックスを記録する
    const usedRanges: { start: number; end: number }[] = [];

    const rubyPipePattern = new RegExp(NOVEL_PATTERNS.RUBY_WITH_PIPE.source, 'g');
    let match;
    while ((match = rubyPipePattern.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      usedRanges.push({ start: match.index, end: match.index + match[0].length });
      newDecorations.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        },
        options: {
          inlineClassName: 'novel-ruby-decoration',
          hoverMessage: { value: 'ルビ' },
        },
      });
    }

    // パイプなしルビ（漢字の直後にルビ）
    const rubyKanjiPattern = new RegExp(NOVEL_PATTERNS.RUBY_WITHOUT_PIPE.source, 'g');
    while ((match = rubyKanjiPattern.exec(text)) !== null) {
      // すでにパイプありの方でカバーされている範囲ならスキップ
      if (usedRanges.some(r => match!.index >= r.start && match!.index < r.end)) {
        continue;
      }
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      newDecorations.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        },
        options: {
          inlineClassName: 'novel-ruby-decoration',
          hoverMessage: { value: 'ルビ' },
        },
      });
    }

    // 3. 傍点のハイライト
    const boutenPattern = new RegExp(NOVEL_PATTERNS.BOUTEN.source, 'g');
    while ((match = boutenPattern.exec(text)) !== null) {
      const startPos = model.getPositionAt(match.index);
      const endPos = model.getPositionAt(match.index + match[0].length);
      newDecorations.push({
        range: {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        },
        options: {
          inlineClassName: 'novel-bouten-decoration',
          hoverMessage: { value: '傍点' },
        },
      });
    }

    return newDecorations;
  }

  /**
   * 指定記号で選択領域を囲みます
   */
  private static wrapSelection(
    editor: any,
    prefix: string,
    suffix: string,
    label: string = 'wrap-action',
  ) {
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (!selection || !model) return;

    const text = model.getValueInRange(selection);
    const range = {
      startLineNumber: selection.startLineNumber,
      startColumn: selection.startColumn,
      endLineNumber: selection.endLineNumber,
      endColumn: selection.endColumn,
    };

    const newText = `${prefix}${text}${suffix}`;
    const op = {
      identifier: { major: 1, minor: 1 },
      range,
      text: newText,
      forceMoveMarkers: true,
    };

    editor.executeEdits(label, [op]);

    if (text === '') {
      const newColumn = selection.startColumn + prefix.length;
      editor.setPosition({
        lineNumber: selection.startLineNumber,
        column: newColumn,
      });
    }
  }

  /**
   * カーソル位置に単語を挿入します（選択範囲を上書き）
   */
  private static insertWord(
    editor: any,
    word: string,
    label: string = 'insert-word',
  ) {
    const selection = editor.getSelection();
    if (!selection) return;

    const op = {
      identifier: { major: 1, minor: 1 },
      range: selection,
      text: word,
      forceMoveMarkers: true,
    };
    editor.executeEdits(label, [op]);
  }

  /**
   * エディターインスタンスごとの設定を適用します
   */
  public static setupEditorInstance(
    editor: any,
    monaco: Monaco,
    docType: string,
    callbacks: {
      onOpenRubyDialog: (selectedText: string) => void;
    }
  ) {
    const isNovel = docType === 'novel';
    const isMarkdown = docType === 'markdown';

    if (isNovel || isMarkdown) {
      editor.addAction({
        id: 'insert-ruby',
        label: 'ルビを振る',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.5,
        run: () => {
          const selection = editor.getSelection();
          const model = editor.getModel();
          if (selection && model) {
            const text = model.getValueInRange(selection);
            if (text) {
              callbacks.onOpenRubyDialog(text);
            }
          }
        },
      });

      editor.addAction({
        id: 'insert-bouten',
        label: '傍点を振る',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.6,
        run: () => this.wrapSelection(editor, '《《', '》》', 'insert-bouten'),
      });
    }

    if (isNovel) {
      editor.addAction({
        id: 'insert-corner-brackets',
        label: '「」を追加',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.7,
        run: () => this.wrapSelection(editor, '「', '」', 'insert-corner-brackets'),
      });

      editor.addAction({
        id: 'insert-corner-brackets2',
        label: '『』を追加',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 1.8,
        run: () => this.wrapSelection(editor, '『', '』', 'insert-corner-brackets2'),
      });

      editor.addAction({
        id: 'insert-dash',
        label: '―― を追加',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 2.1,
        run: () => this.insertWord(editor, '――', 'insert-dash'),
      });

      editor.addAction({
        id: 'insert-ellipsis',
        label: '…… を追加',
        contextMenuGroupId: 'navigation',
        contextMenuOrder: 2.2,
        run: () => this.insertWord(editor, '……', 'insert-ellipsis'),
      });
    }
  }
}
