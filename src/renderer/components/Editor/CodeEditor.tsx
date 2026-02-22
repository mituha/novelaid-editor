import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useSettings } from '../../contexts/SettingsContext';
import {
  NOVEL_PATTERNS,
  NOVEL_MONARCH_PATTERNS,
} from '../../../common/constants/novel';
import RubyDialog from './RubyDialog';
import './CodeEditor.css';
import './CalibrationMarkers.css';

interface CodeEditorProps {
  value: string;
  lastSource?: 'user' | 'external';
  onChange: (value: string | undefined) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  initialLine?: number;
  initialColumn?: number;
  searchQuery?: string;
  onNavigated?: () => void;
  language?: string;
}

export default function CodeEditor({
  value,
  lastSource,
  onChange,
  onFocus = () => {},
  onBlur = () => {},
  initialLine,
  initialColumn,
  searchQuery,
  onNavigated,
  language = 'novel',
}: CodeEditorProps) {
  const { settings } = useSettings();
  const editorConfig = settings.editor || {};
  const [isRubyDialogOpen, setIsRubyDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

  // Track the last value emitted to the parent to avoid loopback cycles
  const lastEmittedValueRef = useRef<string | undefined>(value);
  // Track IME composition state
  const isComposingRef = useRef(false);

  // Handle value changes from Monaco
  const handleEditorChange = useCallback(
    (newValue: string | undefined) => {
      // console.log('[CodeEditor] handleEditorChange (Monaco -> React)', newValue?.length);
      lastEmittedValueRef.current = newValue;
      onChange(newValue);
    },
    [onChange]
  );

  const performNavigation = useCallback((editor: any) => {
      if (initialLine) {
        const lineNumber = initialLine;
        const column = initialColumn || 1;

        editor.setPosition({ lineNumber, column });
        editor.revealPositionInCenter({ lineNumber, column });
        editor.focus();

        if (searchQuery) {
            // Calculate selection range for the search query
            const endColumn = column + searchQuery.length;
            const range = {
                startLineNumber: lineNumber,
                startColumn: column,
                endLineNumber: lineNumber,
                endColumn: endColumn
            };
            editor.setSelection(range);

            // Trigger find widget with the query
            setTimeout(() => {
               editor.trigger('source', 'actions.find');
            }, 100);
        }

        // Notify parent that navigation is handled so it can clear the props
        onNavigated?.();
    }
  }, [initialLine, initialColumn, searchQuery, onNavigated]);

  // Attach composition listeners to the editor instance
  useEffect(() => {
    if (!editorRef.current) return;
    performNavigation(editorRef.current);

    // Monaco doesn't expose onCompositionStart/End directly in simple API,
    // but we can listen on the DOM node or use onDidCompositionStart if available.
    // Checking Monaco API... IStandaloneCodeEditor has onDidCompositionStart/End.

    const disposableStart = editorRef.current.onDidCompositionStart(() => {
      isComposingRef.current = true;
    });

    const disposableEnd = editorRef.current.onDidCompositionEnd(() => {
      isComposingRef.current = false;
    });

    return () => {
      disposableStart.dispose();
      disposableEnd.dispose();
    };
  }, [performNavigation]);

  // Synchronize external value changes (e.g. file reload, git revert)
  // But ignore updates that we just emitted ourselves (loopback)
  React.useEffect(() => {
    if (editorRef.current) {
        const currentValue = editorRef.current.getValue();
        console.log(`[CodeEditor] Prop value changed. Source: ${lastSource}, Prop: ${value?.length}, Current: ${currentValue?.length}, Composing: ${isComposingRef.current}`);

        // Only update if the source is external (e.g. file watcher, initial load)
        // or if it's the very first render and we need to set initial value?
        // Actually, defaultValue handles initial load.
        // But what if we switch tabs and remount?
        // If we remount, useEffect runs. lastSource might be 'user' from previous edits.
        // But defaultValue={value} handles the start.
        // So we only care about *updates* while mounted.

        if (lastSource === 'external') {
            if (value !== currentValue) {
                if (isComposingRef.current) {
                    console.log('[CodeEditor] External update ignored (IME composing)');
                    return;
                }
                console.log('[CodeEditor] External update applied to editor');
                editorRef.current.setValue(value || '');
                lastEmittedValueRef.current = value;
            }
        } else {
             // console.log('[CodeEditor] Ignoring user/loopback update');
        }
    }
  }, [value, lastSource]);

  const handleRubyAction = useCallback((editor: any) => {
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (selection && model) {
      const text = model.getValueInRange(selection);
      if (text) {
        setSelectedText(text);
        setIsRubyDialogOpen(true);
      }
    }
  }, []);

  const handleRubyConfirm = useCallback(
    (ruby: string) => {
      if (editorRef.current) {
        const selection = editorRef.current.getSelection();
        const range = {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        };
        const id = { major: 1, minor: 1 };
        const text = `|${selectedText}《${ruby}》`;
        const op = {
          identifier: id,
          range,
          text,
          forceMoveMarkers: true,
        };
        editorRef.current.executeEdits('ruby-insertion', [op]);
      }
      setIsRubyDialogOpen(false);
    },
    [selectedText],
  );

  // 指定記号で選択領域を囲みます
  const wrapSelection = useCallback(
    (
      editor: any,
      prefix: string,
      suffix: string,
      label: string = 'wrap-action',
    ) => {
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

      // 選択範囲がある場合：囲む
      // 選択範囲がない場合：空の記号を挿入する
      const newText = `${prefix}${text}${suffix}`;
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range,
        text: newText,
        forceMoveMarkers: true,
      };

      editor.executeEdits(label, [op]);

      // 【こだわりポイント】
      // 選択していなかった場合、カーソルを記号の「中」に戻すと親切だわん！
      if (text === '') {
        const newColumn = selection.startColumn + prefix.length;
        editor.setPosition({
          lineNumber: selection.startLineNumber,
          column: newColumn,
        });
      }
    },
    [],
  );

  const insertWord = useCallback(
    (
      editor: any,
      word: string,
      label: string = 'insert-word',
    ) => {
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

      // 選択範囲がある場合も上書きする形で実行
      const newText = `${word}`;
      const id = { major: 1, minor: 1 };
      const op = {
        identifier: id,
        range,
        text: newText,
        forceMoveMarkers: true,
      };

      editor.executeEdits(label, [op]);
    },
    [],
  );

  const calibrationDecorationsRef = useRef<string[]>([]);

  React.useEffect(() => {
      const handleCalibrationUpdate = (e: CustomEvent<any[]>) => {
        // Only update if editor is mounted and this editor is the active one?
        // Actually, the event is global. All editors might receive it.
        // But usually calibration is for the active document.
        // If we have multiple split editors, they might be different documents.
        // The event should probably carry the *path* or ID of the document.
        // For now, assuming single active document analysis or `CalibrationPanel` re-analyzes on focus.
        // Current `CalibrationPanel` takes `content` prop which comes from `RightPane` (active tab).
        // So `CalibrationPanel` analyzes the *active* tab.
        // If `CodeEditor` displays content effectively, it matches.

        if (!editorRef.current) return;

        // Check if the content matches? Or just trust the event?
        // Ideally we should check if the model matches the one analyzed.
        // But for MVP, let's just apply.

        const issues = e.detail;
        const newDecorations = issues.flatMap((issue: any) => {
            const ranges = issue.ranges || [issue.range];
            return ranges.map((r: any) => ({
                range: {
                    startLineNumber: r.startLine,
                    startColumn: r.startColumn,
                    endLineNumber: r.endLine,
                    endColumn: r.endColumn,
                },
                options: {
                    inlineClassName:
                    issue.type === 'particle_repetition'
                        ? 'calibration-marker-particle'
                        : 'calibration-marker-consistency',
                    hoverMessage: { value: issue.message },
                },
            }));
        });

        calibrationDecorationsRef.current = editorRef.current.deltaDecorations(
            calibrationDecorationsRef.current,
            newDecorations
        );
      };

      const handleCalibrationJump = (e: CustomEvent<any>) => {
          if (!editorRef.current) return;
          const range = e.detail;
          const monacoRange = {
              startLineNumber: range.startLine,
              startColumn: range.startColumn,
              endLineNumber: range.endLine,
              endColumn: range.endColumn
          };
          editorRef.current.revealRangeInCenter(monacoRange);
          editorRef.current.setPosition({ lineNumber: range.startLine, column: range.startColumn });
          editorRef.current.focus();
      };

      window.addEventListener('calibration-update', handleCalibrationUpdate as any);
      window.addEventListener('calibration-jump', handleCalibrationJump as any);
      return () => {
          window.removeEventListener('calibration-update', handleCalibrationUpdate as any);
          window.removeEventListener('calibration-jump', handleCalibrationJump as any);
      };
  }, []);

  const updateDecorations = useCallback((editor: any) => {
    const model = editor.getModel();
    if (!model) return;

    const newDecorations: any[] = [];
    const text = model.getValue();

    // Visualize full-width spaces
    NOVEL_PATTERNS.FULL_WIDTH_SPACE.lastIndex = 0;
    if (editorConfig.showFullWidthSpace !== false) {
      let match;
      // eslint-disable-next-line no-cond-assign
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
            stickiness: 1, // NeverGrowsWhenTypingAtEdges
          },
        });
      }
    }

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, [editorConfig.showFullWidthSpace]);

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.updateOptions({
        renderWhitespace: editorConfig.renderWhitespace || 'all',
        renderControlCharacters: editorConfig.renderControlCharacters !== false,
        wordWrap: editorConfig.wordWrap || 'on',
        minimap: { enabled: editorConfig.showMinimap ?? true },
        fontSize: editorConfig.fontSize || 14,
        lineNumbers: editorConfig.showLineNumbers ? 'on' : 'off',
        selectionHighlight: editorConfig.selectionHighlight !== false,
        occurrencesHighlight:
          editorConfig.occurrencesHighlight !== false ? 'singleFile' : 'off',
      });
      updateDecorations(editorRef.current);
    }
  }, [
    updateDecorations,
    editorConfig.renderWhitespace,
    editorConfig.renderControlCharacters,
    editorConfig.wordWrap,
    editorConfig.showMinimap,
    editorConfig.fontSize,
    editorConfig.showLineNumbers,
    editorConfig.selectionHighlight,
    editorConfig.occurrencesHighlight,
  ]);

  const handleEditorOnMount: OnMount = (editor) => {
    editorRef.current = editor;

    // Handle initial navigation if props are present on mount
    performNavigation(editor);

    editor.onDidFocusEditorText(() => {
      onFocus?.();
    });

    editor.onDidBlurEditorText(() => {
      onBlur?.();
    });

    // ファイルエクスプローラーからのドロップをインターセプトしてファイル名のみ挿入
    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener(
        'drop',
        (e: DragEvent) => {
          const filePath = e.dataTransfer?.getData('text/plain');
          if (!filePath) return;

          // パス区切り文字が含まれる場合のみ処理
          // （ファイルエクスプローラーからのドラッグと判断）
          const isFilePath =
            filePath.includes('/') || filePath.includes('\\');
          if (!isFilePath) return;

          // Monaco のデフォルトドロップ動作（フルパス挿入）を止める
          e.preventDefault();
          e.stopPropagation();

          // ファイル名のみ取得（拡張子なし）
          const fullName = filePath.split(/[/\\]/).pop() ?? filePath;
          const dotIndex = fullName.lastIndexOf('.');
          const fileName = dotIndex > 0 ? fullName.slice(0, dotIndex) : fullName;

          // ドロップ位置をカーソル位置として取得
          const target = editor.getTargetAtClientPoint(e.clientX, e.clientY);
          const position = target?.position ?? editor.getPosition();
          if (!position) return;

          editor.executeEdits('file-drop', [
            {
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
              text: fileName,
              forceMoveMarkers: true,
            },
          ]);
          editor.focus();
        },
        // キャプチャフェーズで捕捉することで Monaco の内部ハンドラーより先に実行
        true,
      );
    }

    // 補足:コンテキストメニューを標準では多層には出来ない模様。

    // Add Ruby action to context menu
    editor.addAction({

      id: 'insert-ruby',
      label: 'ルビを振る',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      run: () => handleRubyAction(editor),
    });

    // Add Bouten action to context menu
    editor.addAction({
      id: 'insert-bouten',
      label: '傍点を振る',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      run: () => wrapSelection(editor, '《《', '》》', 'insert-bouten'),
    });

    updateDecorations(editor);

    // 「」を追加
    editor.addAction({
      id: 'insert-corner-brackets',
      label: '「」を追加',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.7,
      run: () => wrapSelection(editor, '「', '」', 'insert-corner-brackets'),
    });

    // 『』を追加
    editor.addAction({
      id: 'insert-corner-brackets2',
      label: '『』を追加',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.8,
      run: () => wrapSelection(editor, '『', '』', 'insert-corner-brackets2'),
    });

    updateDecorations(editor);

    // ――を追加
    editor.addAction({
      id: 'insert-dash',
      label: '―― を追加',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2.1,
      run: () => insertWord(editor, '――', 'insert-dash'),
    });
    // ……を追加
    editor.addAction({
      id: 'insert-ellipsis',
      label: '…… を追加',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2.2,
      run: () => insertWord(editor, '……', 'insert-ellipsis'),
    });

    // Initial decorations
    updateDecorations(editor);

    // Update decorations on change
    editor.onDidChangeModelContent(() => {
      updateDecorations(editor);
      // Clear calibration on edit? Or let them stay?
      // Usually better to let them stay until re-analyzed, but positions might shift.
      // Monaco handles position shift if stickiness is set.
      // But if we edit the text that caused the issue, it might not be an issue anymore.
      // `CalibrationPanel` will re-analyze (debounced).
      // If we don't clear, we might have duplicates or stale markers for 1 sec.
      // Let's keep them, as Monaco moves them.
      // Reuse calibrationDecorationsRef? No, only `deltaDecorations` modifies it.
    });
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Register custom language for novels
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
        { token: 'novel.dialogue', foreground: 'A6E22E' }, // Light green
        { token: 'novel.ruby', foreground: '66D9EF' }, // Light blue
        { token: 'novel.bouten', foreground: 'FD971F' }, // Orange
      ],
      colors: {},
    });

    monaco.editor.defineTheme('novel-light', {
      base: 'vs',
      inherit: true,
      rules: [
        { token: 'novel.dialogue', foreground: '008000' }, // Dark green
        { token: 'novel.ruby', foreground: '0000FF' }, // Blue
        { token: 'novel.bouten', foreground: 'FF8C00' }, // Dark orange
      ],
      colors: {},
    });
  };

  const getTheme = () => {
    if (settings.theme === 'light') return 'novel-light';
    return 'novel-dark';
  };

  return (
    <div className="code-editor-wrapper">
      <Editor
        height="100%"
        defaultLanguage={language}
        language={language}
        defaultValue={value}
        onChange={handleEditorChange}
        onMount={handleEditorOnMount}
        beforeMount={handleBeforeMount}
        theme={getTheme()}
        options={{
          wordWrap: editorConfig.wordWrap || 'on',
          minimap: { enabled: editorConfig.showMinimap ?? true },
          fontSize: editorConfig.fontSize || 14,
          lineNumbers: editorConfig.showLineNumbers ? 'on' : 'off',
          selectionHighlight: editorConfig.selectionHighlight !== false,
          occurrencesHighlight:
            editorConfig.occurrencesHighlight !== false ? 'singleFile' : 'off',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: true, // 最終行を越えてスクロールを許可
          smoothScrolling: true, // スクロールを滑らかにする
          cursorSurroundingLines: 5, // カーソルの上下に常に数行の余白を保つ
          automaticLayout: true,
          padding: { top: 20 },
          fontFamily: "'Yu Gothic', 'Meiryo', sans-serif", // Japanese fonts
          renderWhitespace: editorConfig.renderWhitespace || 'all',
          renderControlCharacters: editorConfig.renderControlCharacters !== false,
          unicodeHighlight: {
            ambiguousCharacters: false,
            invisibleCharacters: false,
          },
        }}
      />
      <RubyDialog
        isOpen={isRubyDialogOpen}
        initialText={selectedText}
        onConfirm={handleRubyConfirm}
        onCancel={() => setIsRubyDialogOpen(false)}
      />
    </div>
  );
}
