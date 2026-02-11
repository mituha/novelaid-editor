import React, { useState, useCallback, useRef } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { useSettings } from '../../contexts/SettingsContext';
import {
  NOVEL_PATTERNS,
  NOVEL_MONARCH_PATTERNS,
} from '../../../common/constants/novel';
import RubyDialog from './RubyDialog';
import './CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
  onFocus?: () => void;
}

export default function CodeEditor({
  value,
  onChange,
  onFocus = () => {},
}: CodeEditorProps) {
  const { settings } = useSettings();
  const editorConfig = settings.editor || {};
  const [isRubyDialogOpen, setIsRubyDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const editorRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);

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

  const handleBoutenAction = useCallback((editor: any) => {
    const selection = editor.getSelection();
    const model = editor.getModel();
    if (selection && model) {
      const text = model.getValueInRange(selection);
      if (text) {
        const range = {
          startLineNumber: selection.startLineNumber,
          startColumn: selection.startColumn,
          endLineNumber: selection.endLineNumber,
          endColumn: selection.endColumn,
        };
        const id = { major: 1, minor: 2 };
        const newText = `《《${text}》》`;
        const op = {
          identifier: id,
          range,
          text: newText,
          forceMoveMarkers: true,
        };
        editor.executeEdits('bouten-insertion', [op]);
      }
    }
  }, []);

  const updateDecorations = useCallback((editor: any) => {
    const model = editor.getModel();
    if (!model) return;

    const newDecorations: any[] = [];
    const text = model.getValue();

    // Visualize full-width spaces
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

    decorationsRef.current = editor.deltaDecorations(
      decorationsRef.current,
      newDecorations,
    );
  }, []);

  const handleEditorOnMount: OnMount = (editor) => {
    editorRef.current = editor;

    editor.onDidFocusEditorText(() => {
      onFocus?.();
    });

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
      run: () => handleBoutenAction(editor),
    });

    // Initial decorations
    updateDecorations(editor);

    // Update decorations on change
    editor.onDidChangeModelContent(() => {
      updateDecorations(editor);
    });
  };

  const handleBeforeMount: BeforeMount = (monaco) => {
    // Register custom language for novels
    monaco.languages.register({ id: 'novel' });

    monaco.languages.setMonarchTokensProvider('novel', {
      tokenizer: {
        root: [
          [NOVEL_MONARCH_PATTERNS.DIALOGUE, 'novel.dialogue'],
          [NOVEL_MONARCH_PATTERNS.DIALOGUE_DOUBLE, 'novel.dialogue'],
          [NOVEL_MONARCH_PATTERNS.RUBY, 'novel.ruby'],
          [NOVEL_MONARCH_PATTERNS.BOUTEN, 'novel.bouten'],
          { include: '@whitespace' },
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
        defaultLanguage="novel"
        language="novel"
        value={value}
        onChange={onChange}
        onMount={handleEditorOnMount}
        beforeMount={handleBeforeMount}
        theme={getTheme()}
        options={{
          wordWrap: editorConfig.wordWrap || 'on',
          minimap: { enabled: false },
          fontSize: editorConfig.fontSize || 14,
          lineNumbers: editorConfig.showLineNumbers ? 'on' : 'off',
          selectionHighlight: editorConfig.selectionHighlight !== false,
          occurrencesHighlight:
            editorConfig.occurrencesHighlight !== false ? 'singleFile' : 'off',
          renderLineHighlight: 'all',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 20 },
          fontFamily: "'Yu Gothic', 'Meiryo', sans-serif", // Japanese fonts
          renderWhitespace: 'all', // Show tabs and spaces
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
