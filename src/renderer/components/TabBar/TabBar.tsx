import React, { MouseEvent } from 'react';
import { X, Columns, Eye, BookOpen, Edit3, LayoutDashboard } from 'lucide-react';
import './TabBar.css';

export type DocumentViewType = 'editor' | 'canvas' | 'reader';

export interface Tab {
  path: string;
  name: string;
  isDirty?: boolean;
  viewType?: DocumentViewType;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabPath: string | null;
  onTabClick: (path: string) => void;
  onTabClose: (path: string) => void;
  onToggleSplit?: () => void;
  onOpenPreview?: (path: string) => void;
  onChangeViewType?: (path: string, viewType: DocumentViewType) => void;
  activeDocumentType?: string;
  isSplit?: boolean;
}

export function TabBar({
  tabs,
  activeTabPath,
  onTabClick,
  onTabClose,
  onToggleSplit,
  onOpenPreview,
  onChangeViewType,
  activeDocumentType,
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

  const activeTab = tabs.find(t => t.path === activeTabPath);
  const activeViewType = activeTab?.viewType || 'editor';

  const renderViewToggle = () => {
    if (!activeTabPath || activeTabPath.startsWith('preview://') || activeTabPath.startsWith('git-diff://') || activeTabPath.startsWith('web-browser://')) return null;
    if (activeDocumentType === 'image') return null;

    const isEditor = activeViewType === 'editor';
    const toggleTarget = activeDocumentType === 'chat' ? 'canvas' : 'reader';

    return (
      <div className="view-type-toggles" style={{ display: 'flex', gap: '4px', marginLeft: 'auto', marginRight: '8px' }}>
        <button
          type="button"
          className={`pane-toggle-btn ${isEditor ? 'active' : ''}`}
          onClick={() => onChangeViewType?.(activeTabPath, 'editor')}
          title="編集"
        >
          <Edit3 size={16} />
        </button>
        <button
          type="button"
          className={`pane-toggle-btn ${!isEditor ? 'active' : ''}`}
          onClick={() => onChangeViewType?.(activeTabPath, toggleTarget)}
          title="閲覧"
        >
          {toggleTarget === 'canvas' ? <LayoutDashboard size={16} /> : <BookOpen size={16} />}
        </button>
      </div>
    );
  };

  return (
    <div className="tab-bar">

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

      {renderViewToggle()}

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
            title="プレビュー(別タブ)を開く"
            style={{ marginLeft: '8px' }}
          >
            <Eye size={16} />
          </button>
        )}

    </div>
  );
}
