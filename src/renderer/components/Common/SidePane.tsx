import React, { useMemo } from 'react';
import './SidePane.css';
import { usePanel } from '../../contexts/PanelContext';
import { PanelLocation } from '../../types/panel';

interface SidePaneProps {
  location: PanelLocation;
  // Panel specific props that might be passed to children
  componentProps?: Record<string, unknown>;
}

export const SidePane: React.FC<SidePaneProps> = ({
  location,
  componentProps,
}) => {
  const { getPanels, activeLeftPanelId, activeRightPanelId, setActivePanel } =
    usePanel();

  const activePanelId =
    location === 'left' ? activeLeftPanelId : activeRightPanelId;

  const panels = useMemo(
    () => getPanels().filter((p) => p.defaultLocation === location),
    [getPanels, location],
  );

  return (
    <div className={`side-pane ${location}-pane`}>
      <div className="activity-bar">
        {panels.map((panel) => (
          <div
            key={panel.id}
            className={`activity-icon ${activePanelId === panel.id ? 'active' : ''}`}
            onClick={() =>
              setActivePanel(
                location,
                panel.id === activePanelId && location === 'right'
                  ? null
                  : panel.id,
              )
            }
            title={panel.title}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setActivePanel(
                  location,
                  panel.id === activePanelId && location === 'right'
                    ? null
                    : panel.id,
                );
              }
            }}
          >
            {panel.icon}
          </div>
        ))}
      </div>
      <div className="pane-container">
        {panels.map((panel) => {
          const isActive = panel.id === activePanelId;
          const isDefaultAndNoneActive =
            !activePanelId && location === 'left' && panel.id === panels[0]?.id;

          const shouldShow = isActive || isDefaultAndNoneActive;

          return (
            <div
              key={panel.id}
              className="pane-content-wrapper"
              style={{
                display: shouldShow ? 'flex' : 'none',
                flexDirection: 'column',
                height: '100%',
                overflow: 'hidden',
              }}
            >
              <div className="pane-header">{panel.title}</div>
              <div className="pane-content">
                <panel.component {...(componentProps as any)} />
              </div>
            </div>
          );
        })}
        {!activePanelId && location === 'right' && (
          <div className="empty-state-placeholder" />
        )}
      </div>
    </div>
  );
};
