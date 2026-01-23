import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export const EditorSettingsTab = () => {
  const { settings, updateSettings } = useSettings();
  const editorConfig = settings.editor || {};

  const handleChange = (key: string, value: any) => {
    updateSettings({
      editor: {
        ...editorConfig,
        [key]: value
      }
    });
  };

  return (
    <div>
      <div className="setting-item">
        <label className="setting-label">Font Size</label>
        <div className="setting-desc">Control the font size in pixels.</div>
        <input
          type="number"
          className="setting-input"
          value={editorConfig.fontSize || 14}
          onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
        />
      </div>

      <div className="setting-item">
        <label className="setting-label">Show Line Numbers</label>
        <div className="setting-toggle">
          <input
            type="checkbox"
            checked={!!editorConfig.showLineNumbers}
            onChange={(e) => handleChange('showLineNumbers', e.target.checked)}
          />
          <span>Enable line numbers</span>
        </div>
      </div>

      <div className="setting-item">
        <label className="setting-label">Word Wrap</label>
        <select
          className="setting-select"
          value={editorConfig.wordWrap || 'on'}
          onChange={(e) => handleChange('wordWrap', e.target.value)}
        >
          <option value="on">On</option>
          <option value="off">Off</option>
          <option value="wordWrapColumn">Word Wrap Column</option>
          <option value="bounded">Bounded</option>
        </select>
      </div>
    </div>
  );
};
