import React from 'react';
import { AIChatPanel } from '../AI/AIChatPanel';
import './RightPane.css';

interface RightPaneProps {
  activeContent?: string;
  activePath?: string | null;
}

export function RightPane({ activeContent, activePath }: RightPaneProps) {
  return (
    <div className="right-pane">
      <div className="right-pane-header">AI Agent</div>
      <div className="right-pane-content-container">
        <AIChatPanel activeContent={activeContent} activePath={activePath} />
      </div>
    </div>
  );
}
