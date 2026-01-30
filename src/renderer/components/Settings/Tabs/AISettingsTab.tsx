import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export function AISettingsTab() {
  const { settings, updateSettings } = useSettings();
  const aiConfig = settings.ai || {};

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({
      ai: {
        ...aiConfig,
        provider: e.target.value as 'lmstudio' | 'gemini',
      },
    });
  };

  const handleLMStudioChange = (field: string, value: string) => {
    updateSettings({
      ai: {
        ...aiConfig,
        lmstudio: {
          ...aiConfig.lmstudio,
          [field]: value,
        },
      },
    });
  };

  const handleGeminiChange = (field: string, value: string) => {
    updateSettings({
      ai: {
        ...aiConfig,
        gemini: {
          ...aiConfig.gemini,
          [field]: value,
        },
      },
    });
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <label>AI Provider</label>
        <select
          value={aiConfig.provider || 'lmstudio'}
          onChange={handleProviderChange}
          className="settings-select"
        >
          <option value="lmstudio">LMStudio (Local)</option>
          <option value="gemini">Google GenAI (Gemini)</option>
        </select>
        <p className="settings-description">
          Select the AI backend to use for generation.
        </p>
      </div>

      {aiConfig.provider === 'lmstudio' && (
        <div className="settings-subgroup">
          <h4>LMStudio Settings</h4>
          <div className="settings-field">
            <label>Base URL</label>
            <input
              type="text"
              value={aiConfig.lmstudio?.baseUrl || 'http://127.0.0.1:1234'}
              onChange={(e) => handleLMStudioChange('baseUrl', e.target.value)}
              placeholder="http://127.0.0.1:1234"
              className="settings-input"
            />
          </div>
          <div className="settings-field">
            <label>Model Identifier (Optional)</label>
            <input
              type="text"
              value={aiConfig.lmstudio?.model || ''}
              onChange={(e) => handleLMStudioChange('model', e.target.value)}
              placeholder="e.g. local-model"
              className="settings-input"
            />
            <p className="settings-description">
              Leave empty to use the currently loaded model in LMStudio.
            </p>
          </div>
        </div>
      )}

      {aiConfig.provider === 'gemini' && (
        <div className="settings-subgroup">
          <h4>Gemini Settings</h4>
          <div className="settings-field">
            <label>API Key</label>
            <input
              type="password"
              value={aiConfig.gemini?.apiKey || ''}
              onChange={(e) => handleGeminiChange('apiKey', e.target.value)}
              placeholder="Enter your Google GenAI API Key"
              className="settings-input"
            />
          </div>
          <div className="settings-field">
            <label>Model Name</label>
            <input
              type="text"
              value={aiConfig.gemini?.model || 'gemini-1.5-flash'}
              onChange={(e) => handleGeminiChange('model', e.target.value)}
              placeholder="e.g. gemini-1.5-flash"
              className="settings-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
