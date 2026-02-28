import React, { MouseEvent, useRef, useState, useEffect } from 'react';
import { X, Columns, Eye, BookOpen, Edit3, LayoutDashboard, ChevronDown } from 'lucide-react';
import { DocumentType, DocumentViewType } from '../../../common/types';
import './TabBar.css';
import FileIcon from '../../utils/FileIcon';


export interface Tab {
  path: string;
  name: string;
  documentType?: DocumentType;
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
  activeDocumentType?: DocumentType;
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
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    if (isDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen]);

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

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
    if (!activeTab || activeTab.viewType === 'preview' || activeTab.documentType === 'git-diff' || activeTab.documentType === 'browser') return null;
    if (activeDocumentType === 'image') return null;

    const isEditor = activeViewType === 'editor';
    const toggleTarget = activeDocumentType === 'chat' ? 'canvas' : 'reader';

    return (
      <>
        <button
          type="button"
          className={`pane-toggle-btn ${isEditor ? 'active' : ''}`}
          onClick={() => activeTabPath && onChangeViewType?.(activeTabPath, 'editor')}
          title="編集"
        >
          <Edit3 size={16} />
        </button>
        <button
          type="button"
          className={`pane-toggle-btn ${!isEditor ? 'active' : ''}`}
          onClick={() => activeTabPath && onChangeViewType?.(activeTabPath, toggleTarget)}
          title="閲覧"
        >
          {toggleTarget === 'canvas' ? <LayoutDashboard size={16} /> : <BookOpen size={16} />}
        </button>
      </>
    );
  };

  return (
    <div className="tab-bar">

      {tabs.length > 0 && (
        <div className="tab-dropdown-container" ref={dropdownRef}>
          <button
            type="button"
            className="pane-toggle-btn tab-dropdown-btn"
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            title="開いているタブ一覧"
          >
            <ChevronDown size={16} />
          </button>
          {isDropdownOpen && (
            <div className="tab-dropdown-menu">
              {tabs.map(tab => (
                <div
                  key={tab.path}
                  className={`tab-dropdown-item ${tab.path === activeTabPath ? 'active' : ''}`}
                  onClick={() => {
                    onTabClick(tab.path);
                    setIsDropdownOpen(false);
                  }}
                >
                  <FileIcon name={tab.name} isDirectory={false} className="tab-file-icon" />
                  <span className="tab-dropdown-name">{tab.name}</span>
                  {tab.isDirty && <span className="tab-dirty-indicator" />}
                  <button
                    type="button"
                    className="tab-close-btn dropdown-close-btn"
                    onClick={(e) => {
                      handleClose(e, tab.path);
                      if (tabs.length <= 1) setIsDropdownOpen(false);
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="tabs-container" ref={tabsContainerRef} onWheel={handleWheel}>
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
            <FileIcon name={tab.name} isDirectory={false} className="tab-file-icon" />
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

      <div className="tab-bar-actions">
        {renderViewToggle()}

        {onToggleSplit && (
          <button
            type="button"
            className={`pane-toggle-btn ${isSplit ? 'active' : ''}`}
            onClick={onToggleSplit}
            title={isSplit ? 'Unsplit Editor' : 'Split Editor'}
          >
            <Columns size={16} />
          </button>
        )}

        {onOpenPreview &&
          activeTab &&
          activeTab.viewType !== 'preview' && (
            <button
              type="button"
              className="pane-toggle-btn"
              onClick={() => onOpenPreview(activeTabPath!)}
              title="プレビュー(別タブ)を開く"
            >
              <Eye size={16} />
            </button>
          )}
      </div>
    </div>
  );
}
