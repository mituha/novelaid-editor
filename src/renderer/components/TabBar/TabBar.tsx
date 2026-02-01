import React, { MouseEvent } from 'react';
import { X, PanelLeft, PanelRight, Columns, Eye } from 'lucide-react';
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
  onOpenPreview?: (path: string) => void;
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
  onOpenPreview,
  isLeftPaneVisible = true,
  isRightPaneVisible = true,
  isSplit = false,
}: TabBarProps) {
  const handleClose = (e: MouseEvent, path: string) => {
    e.stopPropagation();
    onTabClose(path);
  };

  const handleKeyDown = (path: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTabClick(path);
    }
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
            onKeyDown={handleKeyDown(tab.path)}
            title={tab.path}
            role="tab"
            aria-selected={tab.path === activeTabPath}
            tabIndex={0}
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
          style={{ marginLeft: '8px' }}
        >
          <Columns size={16} />
        </button>
      )}

      {onOpenPreview &&
        activeTabPath &&
        !activeTabPath.startsWith('preview://') && (
          <button
            type="button"
            className="pane-toggle-btn"
            onClick={() => onOpenPreview(activeTabPath)}
            title="Open Preview"
            style={{ marginLeft: '8px' }}
          >
            <Eye size={16} />
          </button>
        )}

      {!isSplit && onToggleRightPane && (
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
