import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  charCount: number;
  activePath: string | null;
}

export function StatusBar({ charCount, activePath }: StatusBarProps) {
  const fileName = activePath ? activePath.split('\\').pop() : 'No file open';

  return (
    <div className="status-bar">
      <div className="status-item file-info">
        <span>{fileName}</span>
      </div>
      <div className="status-item right-info">
        <span className="char-count">文字数: {charCount.toLocaleString()}</span>
      </div>
    </div>
  );
}
