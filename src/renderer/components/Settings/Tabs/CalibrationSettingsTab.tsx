import React from 'react';
import { useSettings } from '../../../contexts/SettingsContext';

export function CalibrationSettingsTab() {
  const { settings, updateSettings } = useSettings();
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
          <label>
            <input
              type="checkbox"
              checked={calibration.textlint}
              onChange={() => handleToggle('textlint')}
            />
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
          <label>
            <input
              type="checkbox"
              disabled={!calibration.textlint}
              checked={calibration.noDroppingTheRa}
              onChange={() => handleToggle('noDroppingTheRa')}
            />
            ら抜き言葉（ら抜き言葉をチェックします）
          </label>
        </div>
        <div className="settings-item">
          <label>
            <input
              type="checkbox"
              disabled={!calibration.textlint}
              checked={calibration.noDoubledJoshi}
              onChange={() => handleToggle('noDoubledJoshi')}
            />
            助詞の連続使用（「の」「が」などが連続するのをチェックします）
          </label>
        </div>
        <div className="settings-item">
          <label>
            <input
              type="checkbox"
              disabled={!calibration.textlint}
              checked={calibration.jaSpacing}
              onChange={() => handleToggle('jaSpacing')}
            />
            日本語の余白と記号（全角と半角の間のスペースなどをチェックします）
          </label>
        </div>
      </div>

      <div className="settings-section">
        <h3>内製チェック</h3>
        <div className="settings-item">
          <label>
            <input
              type="checkbox"
              checked={calibration.kanjiOpenClose}
              onChange={() => handleToggle('kanjiOpenClose')}
            />
            漢字の開き（「事」→「こと」などの一般的な表記を推奨します）
          </label>
        </div>
      </div>
    </div>
  );
}
