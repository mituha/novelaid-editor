import React, { useState } from 'react';
import { useSettings } from '../../contexts/SettingsContext';
import './SettingsModal.css';

export function SettingsModal() {
  const { isSettingsOpen, closeSettings, settingTabs } = useSettings();
  const [activeTabId, setActiveTabId] = useState<string>(
    settingTabs[0]?.id || 'editor',
  );

  if (!isSettingsOpen) return null;

  const activeTab = settingTabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="settings-modal-overlay" onClick={closeSettings}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-sidebar">
          {settingTabs.map((tab) => (
            <div
              key={tab.id}
              className={`settings-tab-item ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              {tab.name}
            </div>
          ))}
        </div>
        <div className="settings-content">
          {activeTab ? (
            <>
              <h2>{activeTab.name}</h2>
              <div className="settings-body">{activeTab.render()}</div>
            </>
          ) : (
            <div className="settings-empty">Select a category</div>
          )}
        </div>
        <button className="settings-close-btn" onClick={closeSettings}>
          ×
        </button>
      </div>
    </div>
  );
}
