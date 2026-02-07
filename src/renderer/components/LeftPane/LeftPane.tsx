import React, { useState } from 'react';

import { FileExplorer } from '../Sidebar/FileExplorer';
import { GitPanel } from '../Git/GitPanel';
import './LeftPane.css';

interface LeftPaneProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened: () => void;
}

export const LeftPane: React.FC<LeftPaneProps> = ({
  onFileSelect,
  onProjectOpened,
}) => {
  const [activeSidebarTab, setActiveSidebarTab] = useState<'files' | 'git'>('files');

  return (
    <div className="left-pane">
      <div className="activity-bar">
        <div
          className={`activity-icon ${activeSidebarTab === 'files' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('files')}
          title="Files"
        >
          📁
        </div>
        <div
          className={`activity-icon ${activeSidebarTab === 'git' ? 'active' : ''}`}
          onClick={() => setActiveSidebarTab('git')}
          title="Git"
        >
          <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>S</span>
        </div>
      </div>
      <div className="sidebar-container">
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activeSidebarTab === 'files' ? (
            <FileExplorer
              onFileSelect={onFileSelect}
              onProjectOpened={onProjectOpened}
            />
          ) : (
            <GitPanel />
          )}
        </div>
      </div>
    </div>
  );
};
