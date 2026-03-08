import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { NOVEL_PATTERNS } from '../../../common/constants/novel';
import RubyDialog from './RubyDialog';
import { EditorSupport } from './EditorSupport';
import './CodeEditor.css';
import './CalibrationMarkers.css';

interface CodeEditorProps {
  value: string;
  lastSource?: string; // 'user' | 'user-left' | 'user-right' | 'external'
  side?: 'left' | 'right'; // このエディターがどちらのペインか
  activePath?: string; // 対象のパス (calibration-jump のフィルタ用など)
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
  side,
  activePath,
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
  const { theme } = useTheme();
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

        // 自分自身の入力（loopback）を除外し、外部または反対側のペインからの更新を反映する
        const isExternal = lastSource === 'external';
        const isOppositeSide =
          (side === 'left' && lastSource === 'user-right') ||
          (side === 'right' && lastSource === 'user-left');

        if (isExternal || isOppositeSide) {
          if (value !== currentValue) {
            if (isComposingRef.current) {
              console.log('[CodeEditor] Update ignored (IME composing)');
              return;
            }
            console.log(`[CodeEditor] Applying update from ${lastSource}`);
            editorRef.current.setValue(value || '');
            lastEmittedValueRef.current = value;
          }
        }
    }
  }, [value, lastSource, side]);

  // handleRubyAction は EditorSupport 内に移動しました

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

  // ――を追加
  // ……を追加
  // これらのロジックは EditorSupport.ts へ移動しました

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
          const { path, ...range } = e.detail;

          // 他ドキュメント用のjump指示なら何もしない
          if (path && activePath && path !== activePath) return;

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

    // デコレーションの生成を EditorSupport へ委譲
    const newDecorations = EditorSupport.getEditorDecorations(model, editorConfig);

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, [editorConfig]);

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

  const handleEditorOnMount: OnMount = (editor, monaco) => {
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
        async (e: DragEvent) => {
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

          // マークダウンの場合は相対パスでのリンク形式、それ以外はファイル名のみ
          let textToInsert = fileName;
          if (language === 'markdown' && activePath) {
            try {
              // activePath のディレクトリからの相対パスを計算
              // (activePath がファイルパスなので、一つ上の階層を基準にする)
              const lastSep = activePath.lastIndexOf('\\') !== -1
                ? activePath.lastIndexOf('\\')
                : activePath.lastIndexOf('/');
              const parentDir = activePath.substring(0, lastSep);
              const relativePath = await window.electron.path.relative(parentDir, filePath);

              // .md, .txt 等は画像ではないとして事前に弾く
              const ext = fullName.substring(fullName.lastIndexOf('.')).toLowerCase();
              let isImage = false;
              if (!['.md', '.markdown', '.txt'].includes(ext)) {
                // ドキュメントタイプを取得して画像かどうかを判定
                const docType = await window.electron.fs.getDocumentType(filePath);
                isImage = docType === 'image';
              }

              textToInsert = `${isImage ? '!' : ''}[${fileName}](${relativePath})`;
            } catch (err) {
              console.error('Failed to calculate relative path:', err);
              textToInsert = `[${fileName}](${fullName})`;
            }
          }

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
              text: textToInsert,
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

    // エディタータイプに応じたセットアップを委譲
    EditorSupport.setupEditorInstance(editor, monaco, language, {
      onOpenRubyDialog: (text) => {
        setSelectedText(text);
        setIsRubyDialogOpen(true);
      },
    });

    updateDecorations(editor);

    // 内容変更時にデコレーションを再計算するためのリスナーを追加
    editor.onDidChangeModelContent(() => {
      updateDecorations(editor);
    });
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    // 言語設定やテーマの登録を委譲
    EditorSupport.registerLanguages(monaco);
  };

  const getTheme = () => {
    if (theme === 'light') return 'novel-light';
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
