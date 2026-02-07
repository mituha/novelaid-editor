import React, { useMemo } from 'react';
import './RightPane.css';
import { usePanel } from '../../contexts/PanelContext';

interface RightPaneProps {
  activeContent?: string;
  activePath?: string | null;
}

export function RightPane({ activeContent, activePath }: RightPaneProps) {
  const { getPanels, activeRightPanelId } = usePanel();

  const panels = useMemo(
    () => getPanels().filter((p) => p.defaultLocation === 'right'),
    [getPanels],
  );

  const activePanel = useMemo(
    () => panels.find((p) => p.id === activeRightPanelId),
    [panels, activeRightPanelId],
  );

  if (!activePanel) return null;

  return (
    <div className="right-pane">
      <div className="right-pane-header">{activePanel.title}</div>
      <div className="right-pane-content-container">
        <activePanel.component
          activeContent={activeContent}
          activePath={activePath}
        />
      </div>
    </div>
  );
}
