import React, { useState, useCallback, useRef, useEffect } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useProject } from '../../contexts/ProjectContext';
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
  const { projectConfig: settings } = useProject();
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

  // Synchronize external value changes
  useEffect(() => {
    if (editorRef.current) {
        const currentValue = editorRef.current.getValue();
        const isExternal = lastSource === 'external';
        const isOppositeSide =
          (side === 'left' && lastSource === 'user-right') ||
          (side === 'right' && lastSource === 'user-left');

        if (isExternal || isOppositeSide) {
          if (value !== currentValue) {
            if (isComposingRef.current) {
              return;
            }
            editorRef.current.setValue(value || '');
            lastEmittedValueRef.current = value;
          }
        }
    }
  }, [value, lastSource, side]);

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

  const calibrationDecorationsRef = useRef<string[]>([]);

  useEffect(() => {
      const handleCalibrationUpdate = (e: CustomEvent<any[]>) => {
        if (!editorRef.current) return;

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
  }, [activePath]);

  const updateDecorations = useCallback((editor: any) => {
    const model = editor.getModel();
    if (!model) return;

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
    performNavigation(editor);

    editor.onDidFocusEditorText(() => {
      onFocus?.();
    });

    editor.onDidBlurEditorText(() => {
      onBlur?.();
    });

    const domNode = editor.getDomNode();
    if (domNode) {
      domNode.addEventListener(
        'drop',
        async (e: DragEvent) => {
          const filePath = e.dataTransfer?.getData('text/plain');
          if (!filePath) return;

          const isFilePath =
            filePath.includes('/') || filePath.includes('\\');
          if (!isFilePath) return;

          e.preventDefault();
          e.stopPropagation();

          const fullName = filePath.split(/[/\\]/).pop() ?? filePath;
          const dotIndex = fullName.lastIndexOf('.');
          const fileName = dotIndex > 0 ? fullName.slice(0, dotIndex) : fullName;

          let textToInsert = fileName;
          if (language === 'markdown' && activePath) {
            try {
              const lastSep = activePath.lastIndexOf('\\') !== -1
                ? activePath.lastIndexOf('\\')
                : activePath.lastIndexOf('/');
              const parentDir = activePath.substring(0, lastSep);
              const relativePath = await window.electron.path.relative(parentDir, filePath);

              const ext = fullName.substring(fullName.lastIndexOf('.')).toLowerCase();
              let isImage = false;
              if (!['.md', '.markdown', '.txt'].includes(ext)) {
                const docType = await window.electron.fs.getDocumentType(filePath);
                isImage = docType === 'image';
              }

              textToInsert = `${isImage ? '!' : ''}[${fileName}](${relativePath})`;
            } catch (err) {
              console.error('Failed to calculate relative path:', err);
              textToInsert = `[${fileName}](${fullName})`;
            }
          }

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
        true,
      );
    }

    EditorSupport.setupEditorInstance(editor, monaco, language, {
      onOpenRubyDialog: (text) => {
        setSelectedText(text);
        setIsRubyDialogOpen(true);
      },
    });

    updateDecorations(editor);

    editor.onDidChangeModelContent(() => {
      updateDecorations(editor);
    });
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
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
          scrollBeyondLastLine: true,
          smoothScrolling: true,
          cursorSurroundingLines: 5,
          automaticLayout: true,
          padding: { top: 20 },
          fontFamily: "'Yu Gothic', 'Meiryo', sans-serif",
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
