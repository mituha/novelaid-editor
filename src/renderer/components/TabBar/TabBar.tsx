import React, { MouseEvent } from 'react';
import { X, PanelLeft, PanelRight, Columns } from 'lucide-react';
import './TabBar.css';

export interface Tab {
  path: string;
  name: string;
  isDirty?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onToggleLeftPane?: () => void;
  onToggleRightPane?: () => void;
  onToggleSplit?: () => void;
  isLeftPaneVisible?: boolean;
  isRightPaneVisible?: boolean;
  isSplit?: boolean;
}

export function TabBar({
  tabs,
  activeTabPath,
  onTabClick,
  onTabClose,
  onToggleLeftPane,
  onToggleRightPane,
  onToggleSplit,
  isLeftPaneVisible = true,
  isRightPaneVisible = true,
  isSplit = false,
}: TabBarProps) {
  const handleClose = (e: MouseEvent, path: string) => {
    e.stopPropagation();
    onTabClose(path);
  };

  return (
    <div className="tab-bar">
      {onToggleLeftPane && (
        <button
          type="button"
          className={`pane-toggle-btn ${!isLeftPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleLeftPane}
          title="Toggle Sidebar"
        >
          <PanelLeft size={16} />
        </button>
      )}

      <div className="tabs-container">
        {tabs.map((tab) => (
          <div
            key={tab.path}
            className={`tab-item ${tab.path === activeTabPath ? 'active' : ''}`}
            onClick={() => onTabClick(tab.path)}
            title={tab.path}
          >
            <span className="tab-name">{tab.name}</span>
            {tab.isDirty && <span className="tab-dirty-indicator" />}
            <button
              type="button"
              className="tab-close-btn"
              onClick={(e) => handleClose(e, tab.path)}
              aria-label="Close tab"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {onToggleSplit && (
        <button
          type="button"
          className={`pane-toggle-btn ${isSplit ? 'active' : ''}`}
          onClick={onToggleSplit}
          title={isSplit ? 'Unsplit Editor' : 'Split Editor'}
          style={{ marginLeft: '10px' }}
        >
          <Columns size={16} />
        </button>
      )}

      {onToggleRightPane && (
        <button
          type="button"
          className={`pane-toggle-btn ${!isRightPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleRightPane}
          title="Toggle Right Pane"
          style={{ marginLeft: 'auto' }}
        >
          <PanelRight size={16} />
        </button>
      )}
    </div>
  );
}
