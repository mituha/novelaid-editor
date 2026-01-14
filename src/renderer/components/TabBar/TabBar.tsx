import React, { MouseEvent } from 'react';
import { X } from 'lucide-react';
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
}

export const TabBar = ({ tabs, activeTabPath, onTabClick, onTabClose }: TabBarProps) => {
  const handleClose = (e: MouseEvent, path: string) => {
    e.stopPropagation();
    onTabClose(path);
  };

  return (
    <div className="tab-bar">
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
            className="tab-close-btn"
            onClick={(e) => handleClose(e, tab.path)}
            aria-label="Close tab"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
};
