import React, { useMemo } from 'react';
import './LeftPane.css';
import { usePanel } from '../../contexts/PanelContext';

interface LeftPaneProps {
  onFileSelect: (path: string, content: string) => void;
  onProjectOpened: () => void;
}

export const LeftPane: React.FC<LeftPaneProps> = (props) => {
  const { getPanels, activeLeftPanelId, setActivePanel } = usePanel();

  const panels = useMemo(
    () => getPanels().filter((p) => p.defaultLocation === 'left'),
    [getPanels],
  );

  const activePanel = useMemo(
    () => panels.find((p) => p.id === activeLeftPanelId) || panels[0],
    [panels, activeLeftPanelId],
  );

  return (
    <div className="left-pane">
      <div className="activity-bar">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`activity-icon ${activeLeftPanelId === panel.id ? 'active' : ''}`}
            onClick={() => setActivePanel('left', panel.id)}
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
