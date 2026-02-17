import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export default function AISettingsTab() {
  const { settings, updateSettings } = useSettings();
  const aiConfig = settings.ai || {};
  const [availableModels, setAvailableModels] = React.useState<string[]>([]);
  const [isFetching, setIsFetching] = React.useState(false);

  const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    updateSettings({
      ai: {
        ...aiConfig,
        provider: e.target.value as 'lmstudio' | 'gemini' | 'openai' | 'none',
      },
    });
    setAvailableModels([]); // Reset models on provider change
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

  const handleOpenAIChange = (field: string, value: string) => {
    updateSettings({
      ai: {
        ...aiConfig,
        openai: {
          ...aiConfig.openai,
          [field]: value,
        },
      },
    });
  };

  const fetchModels = async () => {
    setIsFetching(true);
    try {
      // Pass the current AI config to the main process
      // We need to ensure we pass the *latest* settings.
      // aiConfig comes from context, so it should be relatively fresh.
      const models = await window.electron.ipcRenderer.invoke(
        'ai:listModels',
        settings.ai || {},
      );
      setAvailableModels(models);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      alert('Failed to fetch models. Check console for details.');
    } finally {
      setIsFetching(false);
    }
  };

  const renderModelSelection = (
    currentModel: string,
    onChange: (val: string) => void
  ) => {
    return (
      <div className="settings-field">
        <label htmlFor="ai-model-input">Model</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input
              id="ai-model-input"
              type="text"
              value={currentModel}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Enter model identifier or select from list"
              className="settings-input"
              style={{ width: '100%' }}
            />
          </div>
          <button
            type="button"
            onClick={fetchModels}
            disabled={isFetching}
            className="settings-button"
            style={{ padding: '8px 12px', height: '38px', marginBottom: '2px' }}
          >
            {isFetching ? 'Fetching...' : 'Fetch Models'}
          </button>
        </div>

        {availableModels.length > 0 && (
          <div style={{ marginTop: '5px' }}>
            <select
                className="settings-select"
                onChange={(e) => {
                    if (e.target.value) {
                         onChange(e.target.value);
                    }
                }}
                value="" // Always show placeholder so user can re-select same item if they changed text
            >
                <option value="" disabled>Select a fetched model...</option>
                {availableModels.map(m => (
                    <option key={m} value={m}>{m}</option>
                ))}
            </select>
          </div>
        )}
        <p className="settings-description">
             Manually enter the model ID or fetch available models from the provider.
        </p>
      </div>
    );
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <label htmlFor="ai-provider-select">AI Provider</label>
        <select
          id="ai-provider-select"
          value={aiConfig.provider || 'lmstudio'}
          onChange={handleProviderChange}
          className="settings-select"
        >
          <option value="lmstudio">LMStudio (Local)</option>
          <option value="gemini">Google GenAI (Gemini)</option>
          <option value="openai">OpenAI Compatible (Generic)</option>
          <option value="none">なし (None) - AI機能を無効にする</option>
        </select>
        <p className="settings-description">
          Select the AI backend to use for generation.
        </p>
      </div>

      {aiConfig.provider === 'lmstudio' && (
        <div className="settings-subgroup">
          <h4>LMStudio Settings</h4>
          <div className="settings-field">
            <label htmlFor="lmstudio-base-url">Base URL</label>
            <input
              id="lmstudio-base-url"
              type="text"
              value={aiConfig.lmstudio?.baseUrl || 'http://127.0.0.1:1234'}
              onChange={(e) => handleLMStudioChange('baseUrl', e.target.value)}
              placeholder="http://127.0.0.1:1234"
              className="settings-input"
            />
          </div>
          {renderModelSelection(
              aiConfig.lmstudio?.model || '',
              (val) => handleLMStudioChange('model', val)
          )}
        </div>
      )}

      {aiConfig.provider === 'gemini' && (
        <div className="settings-subgroup">
          <h4>Gemini Settings</h4>
          <div className="settings-field">
            <label htmlFor="gemini-api-key">API Key</label>
            <input
              id="gemini-api-key"
              type="password"
              value={aiConfig.gemini?.apiKey || ''}
              onChange={(e) => handleGeminiChange('apiKey', e.target.value)}
              placeholder="Enter your Google GenAI API Key"
              className="settings-input"
            />
          </div>
           {renderModelSelection(
              aiConfig.gemini?.model || 'gemini-1.5-flash',
              (val) => handleGeminiChange('model', val)
          )}
        </div>
      )}

      {aiConfig.provider === 'openai' && (
        <div className="settings-subgroup">
          <h4>OpenAI Compatible Settings</h4>
          <div className="settings-field">
             <label htmlFor="openai-base-url">Base URL</label>
             <input
              id="openai-base-url"
              type="text"
              value={aiConfig.openai?.baseUrl || ''}
              onChange={(e) => handleOpenAIChange('baseUrl', e.target.value)}
              placeholder="http://localhost:1234/v1"
              className="settings-input"
             />
          </div>
          <div className="settings-field">
            <label htmlFor="openai-api-key">API Key (Optional for local)</label>
            <input
              id="openai-api-key"
              type="password"
              value={aiConfig.openai?.apiKey || ''}
              onChange={(e) => handleOpenAIChange('apiKey', e.target.value)}
              placeholder="sk-..."
              className="settings-input"
            />
          </div>
           {renderModelSelection(
              aiConfig.openai?.model || 'gpt-3.5-turbo',
              (val) => handleOpenAIChange('model', val)
          )}
        </div>
      )}
    </div>
  );
}
