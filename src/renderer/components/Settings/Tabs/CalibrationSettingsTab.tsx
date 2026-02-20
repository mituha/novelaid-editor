import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export function CalibrationSettingsTab() {
  const { settings, updateSettings, closeSettings } = useSettings();
  const calibration = settings.calibration || {
    textlint: true,
    noDroppingTheRa: true,
    noDoubledJoshi: true,
    jaSpacing: true,
    kanjiOpenClose: true,
  };

  const handleToggle = (key: keyof typeof calibration) => {
    updateSettings({
      calibration: {
        ...calibration,
        [key]: !calibration[key],
      },
    });
  };

  return (
    <div className="settings-tab-content">
      <div className="settings-section">
        <h3>全般</h3>
        <div className="settings-item">
          <input
            id="calib-textlint"
            type="checkbox"
            checked={calibration.textlint}
            onChange={() => handleToggle('textlint')}
          />
          <label htmlFor="calib-textlint">
            textlint（外部ルールエンジン）を有効にする
          </label>
          <p className="settings-hint">
            日本語の文法や表記揺れを高度にチェックします。
          </p>
        </div>
      </div>

      <div className="settings-section">
        <h3>textlint ルール</h3>
        <div className="settings-item">
          <input
            id="calib-ra"
            type="checkbox"
            disabled={!calibration.textlint}
            checked={calibration.noDroppingTheRa}
            onChange={() => handleToggle('noDroppingTheRa')}
          />
          <label htmlFor="calib-ra">
            ら抜き言葉（ら抜き言葉をチェックします）
          </label>
        </div>
        <div className="settings-item">
          <input
            id="calib-joshi"
            type="checkbox"
            disabled={!calibration.textlint}
            checked={calibration.noDoubledJoshi}
            onChange={() => handleToggle('noDoubledJoshi')}
          />
          <label htmlFor="calib-joshi">
            助詞の連続使用（「の」「が」などが連続するのをチェックします）
          </label>
        </div>
        <div className="settings-item">
          <input
            id="calib-spacing"
            type="checkbox"
            disabled={!calibration.textlint}
            checked={calibration.jaSpacing}
            onChange={() => handleToggle('jaSpacing')}
          />
          <label htmlFor="calib-spacing">
            日本語の余白と記号（全角と半角の間のスペースなどをチェックします）
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>内製チェック</h3>
        <div className="settings-item">
          <input
            id="calib-kanji"
            type="checkbox"
            checked={calibration.kanjiOpenClose}
            onChange={() => handleToggle('kanjiOpenClose')}
          />
          <label htmlFor="calib-kanji">
            漢字の開き（「事」→「こと」などの一般的な表記を推奨します）
          </label>
        </div>
        <div className="settings-item">
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              try {
                const path = await window.electron.calibration.getKanjiRulesPath();
                window.electron.ipcRenderer.sendMessage('app:open-file', path);
                closeSettings();
              } catch (error) {
                console.error('Failed to get rules path:', error);
              }
            }}
          >
            カスタムルールを編集
          </button>
          <p className="settings-hint">
            独自のルール追加や、デフォルトルールの除外設定（!単語）を行えます。
          </p>
        </div>
      </div>
    </div>
  );
}
