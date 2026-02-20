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
      alert('モデルの取得に失敗しました。詳細はコンソールを確認してください。');
    } finally {
      setIsFetching(false);
    }
  };

  const renderModelSelection = (
    currentModel: string,
    onChange: (val: string) => void,
  ) => {
    return (
      <div className="settings-field">
        <label htmlFor="ai-model-input">モデル</label>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <input
              id="ai-model-input"
              type="text"
              value={currentModel}
              onChange={(e) => onChange(e.target.value)}
              placeholder="モデルIDを入力するか、リストから選択してください"
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
            {isFetching ? '取得中...' : 'モデル一覧を取得'}
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
              <option value="" disabled>
                取得されたモデルを選択...
              </option>
              {availableModels.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        )}
        <p className="settings-description">
          モデルIDを直接入力するか、プロバイダーから利用可能なモデルを取得します。
        </p>
      </div>
    );
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-group">
        <label htmlFor="ai-provider-select">AIプロバイダー</label>
        <select
          id="ai-provider-select"
          value={aiConfig.provider || 'lmstudio'}
          onChange={handleProviderChange}
          className="settings-select"
        >
          <option value="lmstudio">LMStudio (ローカル)</option>
          <option value="gemini">Google GenAI (Gemini)【未検証】</option>
          <option value="openai">OpenAI互換 (汎用)【未検証】</option>
          <option value="none">なし - AI機能を無効にする</option>
        </select>
        <p className="settings-description">
          生成に使用するAIバックエンドを選択します。
        </p>
      </div>

      {aiConfig.provider === 'lmstudio' && (
        <div className="settings-subgroup">
          <h4>LMStudio 設定</h4>
          <div className="settings-field">
            <label htmlFor="lmstudio-base-url">ベースURL</label>
            <input
              id="lmstudio-base-url"
              type="text"
              value={aiConfig.lmstudio?.baseUrl || 'http://127.0.0.1:1234'}
              onChange={(e) => handleLMStudioChange('baseUrl', e.target.value)}
              placeholder="http://127.0.0.1:1234"
              className="settings-input"
            />
          </div>
          {renderModelSelection(aiConfig.lmstudio?.model || '', (val) =>
            handleLMStudioChange('model', val),
          )}
        </div>
      )}

      {aiConfig.provider === 'gemini' && (
        <div className="settings-subgroup">
          <h4>Gemini 設定</h4>
          <div className="settings-field">
            <label htmlFor="gemini-api-key">APIキー</label>
            <input
              id="gemini-api-key"
              type="password"
              value={aiConfig.gemini?.apiKey || ''}
              onChange={(e) => handleGeminiChange('apiKey', e.target.value)}
              placeholder="Google GenAIのAPIキーを入力してください"
              className="settings-input"
            />
          </div>
          {renderModelSelection(
            aiConfig.gemini?.model || 'gemini-1.5-flash',
            (val) => handleGeminiChange('model', val),
          )}
        </div>
      )}

      {aiConfig.provider === 'openai' && (
        <div className="settings-subgroup">
          <h4>OpenAI互換 設定</h4>
          <div className="settings-field">
            <label htmlFor="openai-base-url">ベースURL</label>
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
            <label htmlFor="openai-api-key">
              APIキー (ローカルの場合は任意)
            </label>
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
            (val) => handleOpenAIChange('model', val),
          )}
        </div>
      )}
    </div>
  );
}
