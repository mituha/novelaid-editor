import { useProject } from '../../../contexts/ProjectContext';
import { useTheme } from '../../../contexts/ThemeContext';

export function AppearanceSettingsTab() {
  const { projectConfig: settings, updateProjectConfig: updateSettings } = useProject();
  const { theme, setTheme } = useTheme();

  const handleThemeChange = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    // 後方互換性および既存プロジェクトへの反映のためにSettingsも更新しておく
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
