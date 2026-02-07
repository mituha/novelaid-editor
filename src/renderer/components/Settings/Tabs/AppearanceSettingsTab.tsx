import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export function AppearanceSettingsTab() {
  const { settings, updateSettings } = useSettings();
  const theme = settings.theme || 'dark';

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    updateSettings({
      ...settings,
      theme: newTheme,
    });
  };

  return (
    <div className="appearance-settings">
      <div className="setting-item">
        <label className="setting-label">Theme</label>
        <div className="setting-desc">Overall color theme of the application.</div>
        <div className="theme-options">
          <label className={`theme-option ${theme === 'dark' ? 'active' : ''}`}>
            <input
              type="radio"
              name="theme"
              value="dark"
              checked={theme === 'dark'}
              onChange={() => handleThemeChange('dark')}
            />
            <span>Dark</span>
          </label>
          <label className={`theme-option ${theme === 'light' ? 'active' : ''}`}>
            <input
              type="radio"
              name="theme"
              value="light"
              checked={theme === 'light'}
              onChange={() => handleThemeChange('light')}
            />
            <span>Light</span>
          </label>
        </div>
      </div>
    </div>
  );
}
