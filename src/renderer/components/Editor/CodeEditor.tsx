import React from 'react';
import Editor from '@monaco-editor/react';
import './CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string | undefined) => void;
}

export function CodeEditor({ value, onChange }: CodeEditorProps) {
  return (
    <div className="code-editor-wrapper">
      <Editor
        height="100%"
        defaultLanguage="markdown"
        value={value}
        onChange={onChange}
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
    </div>
  );
}
