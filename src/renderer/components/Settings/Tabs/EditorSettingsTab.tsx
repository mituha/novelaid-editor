import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export default function EditorSettingsTab() {
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
          onChange={(e) =>
            handleChange('fontSize', parseInt(e.target.value, 10))
          }
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

      <div className="setting-item">
        <label className="setting-label" htmlFor="render-whitespace">
          空白の表示
        </label>
        <select
          id="render-whitespace"
          className="setting-select"
          value={editorConfig.renderWhitespace || 'all'}
          onChange={(e) => handleChange('renderWhitespace', e.target.value)}
        >
          <option value="none">None</option>
          <option value="boundary">Boundary</option>
          <option value="selection">Selection</option>
          <option value="trailing">Trailing</option>
          <option value="all">All</option>
        </select>
      </div>

      <div className="setting-item">
        <div className="setting-toggle">
          <input
            id="render-control-characters"
            type="checkbox"
            checked={editorConfig.renderControlCharacters !== false}
            onChange={(e) =>
              handleChange('renderControlCharacters', e.target.checked)
            }
          />
          <span>制御文字を表示</span>
        </div>
      </div>

      <div className="setting-item">
        <div className="setting-toggle">
          <input
            id="show-full-width-space"
            type="checkbox"
            checked={editorConfig.showFullWidthSpace !== false}
            onChange={(e) =>
              handleChange('showFullWidthSpace', e.target.checked)
            }
          />
          <span>全角空白を可視化</span>
        </div>
      </div>
    </div>
  );
}
