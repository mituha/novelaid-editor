import React, { useState, useCallback, useRef } from 'react';
import Editor, { OnMount } from '@monaco-editor/react';
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
  const [isRubyDialogOpen, setIsRubyDialogOpen] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const editorRef = useRef<any>(null);

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
  };

  return (
    <div className="code-editor-wrapper">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={value}
        onChange={onChange}
        onMount={handleEditorOnMount}
        theme="vs-dark"
        options={{
          wordWrap: 'on',
          minimap: { enabled: false },
          fontSize: 14,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          padding: { top: 20 },
          fontFamily: "'Yu Gothic', 'Meiryo', sans-serif", // Japanese fonts
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
