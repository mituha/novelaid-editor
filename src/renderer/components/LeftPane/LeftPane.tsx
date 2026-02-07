import React, { useState } from 'react';

import { FileExplorerPanel } from '../FileExplorer/FileExplorerPanel';
import { GitPanel } from '../Git/GitPanel';
import './LeftPane.css';

import { Panel } from '../../types/panel';

interface LeftPaneProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened: () => void;
}

export const LeftPane: React.FC<LeftPaneProps> = (props) => {
  const [activePanelId, setActivePanelId] = useState<string>('files');

  const panels: Panel[] = [
    {
      id: 'files',
      title: 'Files',
      icon: <div className="activity-icon-content">📁</div>,
      component: FileExplorerPanel,
    },
    {
      id: 'git',
      title: 'Git',
      icon: (
        <div className="activity-icon-content">
          <span style={{ fontSize: '1.2em', fontWeight: 'bold' }}>S</span>
        </div>
      ),
      component: GitPanel,
    },
  ];

  const activePanel = panels.find((p) => p.id === activePanelId) || panels[0];

  return (
    <div className="left-pane">
      <div className="activity-bar">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`activity-icon ${activePanelId === panel.id ? 'active' : ''}`}
            onClick={() => setActivePanelId(panel.id)}
            title={panel.title}
          >
            {panel.icon}
          </div>
        ))}
      </div>
      <div className="sidebar-container">
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {activePanel && <activePanel.component {...props} />}
        </div>
      </div>
    </div>
  );
};
