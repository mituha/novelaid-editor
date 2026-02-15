import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export function EditorSettingsTab() {
  const { settings, updateSettings } = useSettings();
  const editorConfig = settings.editor || {};

  const handleChange = (key: string, value: any) => {
    updateSettings({
      editor: {
        ...editorConfig,
        [key]: value,
      },
    });
  };

  return (
    <div>
      <div className="setting-item">
        <label className="setting-label" htmlFor="font-size">
          Font Size
        </label>
        <div className="setting-desc">Control the font size in pixels.</div>
        <input
          id="font-size"
          type="number"
          className="setting-input"
          value={editorConfig.fontSize || 14}
          onChange={(e) => handleChange('fontSize', parseInt(e.target.value))}
        />
      </div>

      <div className="setting-item">
        <div className="setting-toggle">
          <input
            id="show-line-numbers"
            type="checkbox"
            checked={!!editorConfig.showLineNumbers}
            onChange={(e) => handleChange('showLineNumbers', e.target.checked)}
          />
          <span>行番号表示</span>
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-toggle">
          <input
            id="show-minimap"
            type="checkbox"
            checked={!!editorConfig.showMinimap}
            onChange={(e) => handleChange('showMinimap', e.target.checked)}
          />
          <span>ミニマップ表示</span>
        </div>
      </div>

      <div className="setting-item">
        <label className="setting-label" htmlFor="word-wrap">
          Word Wrap
        </label>
        <select
          id="word-wrap"
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

      <div className="setting-item">
        <label className="setting-label" htmlFor="selection-highlight">
          Selection Highlight
        </label>
        <div className="setting-toggle">
          <input
            id="selection-highlight"
            type="checkbox"
            checked={editorConfig.selectionHighlight !== false}
            onChange={(e) =>
              handleChange('selectionHighlight', e.target.checked)
            }
          />
          <span>Highlight same words on selection</span>
        </div>
      </div>

      <div className="setting-item">
        <label className="setting-label" htmlFor="occurrences-highlight">
          Occurrences Highlight
        </label>
        <div className="setting-toggle">
          <input
            id="occurrences-highlight"
            type="checkbox"
            checked={editorConfig.occurrencesHighlight !== false}
            onChange={(e) =>
              handleChange('occurrencesHighlight', e.target.checked)
            }
          />
          <span>Highlight symbol occurrences</span>
        </div>
      </div>
    </div>
  );
}
