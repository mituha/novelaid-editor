import {
  Settings as SettingsIcon,
  PanelLeft,
  PanelRight,
  Home,
  HelpCircle,
  Maximize,
  Minimize,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import './StatusBar.css';
import { DetailedCountResult } from 'novelaid-ruby';
import DocumentIcon from '../../utils/DocumentIcon';
import { NovelaidDocumentType } from '../../../common/types';

interface StatusBarProps {
  detailedMetrics: DetailedCountResult | null;
  selectedMetrics: DetailedCountResult | null;
  activePath: string | null;
  documentType?: NovelaidDocumentType;
  metadata?: Record<string, any>;
  openSettings: () => void;
  onGoHome: () => void;
  onToggleLeftPane: () => void;
  onToggleRightPane: () => void;
  isLeftPaneVisible: boolean;
  isRightPaneVisible: boolean;
}

export default function StatusBar({
  detailedMetrics,
  selectedMetrics,
  activePath,
  documentType,
  metadata = {},
  openSettings,
  onGoHome,
  onToggleLeftPane,
  onToggleRightPane,
  isLeftPaneVisible,
  isRightPaneVisible,
}: StatusBarProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkFullScreen = async () => {
      const fs = await window.electron.window.isFullScreen();
      setIsFullScreen(fs);
    };
    checkFullScreen();
  }, []);

  // ポップアップの外側をクリックしたときに閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showPopup &&
        popupRef.current &&
        !popupRef.current.contains(event.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node)
      ) {
        setShowPopup(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPopup]);

  const handleToggleFullScreen = async () => {
    const fs = await window.electron.window.toggleFullScreen();
    setIsFullScreen(fs);
  };

  const fileName = activePath ? activePath.split('\\').pop() : 'No file open';

  // セリフと地の文の比率計算
  const dialogueCharCount = detailedMetrics?.dialogue.charCount || 0;
  const narrativeCharCount = detailedMetrics?.narrative.charCount || 0;
  const totalStyleChar = dialogueCharCount + narrativeCharCount;
  const dialogueRatio = totalStyleChar > 0 ? (dialogueCharCount / totalStyleChar) * 100 : 0;
  const narrativeRatio = totalStyleChar > 0 ? (narrativeCharCount / totalStyleChar) * 100 : 0;

  // 表示する文字数情報の構築
  const charDisplay = (() => {
    if (!detailedMetrics) return null;

    if (selectedMetrics) {
      return (
        <span className="metric-item highlight">
          選択中: {selectedMetrics.charCount.toLocaleString()} / {detailedMetrics.charCount.toLocaleString()}
        </span>
      );
    }

    return (
      <>
        <span className="metric-item">
          文字数: {detailedMetrics.charCount.toLocaleString()}
        </span>
        <span className="metric-item">
          行数: {detailedMetrics.lineCount.toLocaleString()}
        </span>
      </>
    );
  })();

  return (
    <div className="status-bar">
      <div className="status-item left-group">
        <button
          type="button"
          className="status-bar-home-btn"
          onClick={(e) => {
            e.stopPropagation();
            onGoHome();
          }}
          title="書庫一覧へ戻る"
        >
          <Home size={14} />
        </button>
        <button
          type="button"
          className={`status-pane-toggle-btn ${!isLeftPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleLeftPane}
          title="Toggle Sidebar"
        >
          <PanelLeft size={14} />
        </button>
        <button
          type="button"
          className="status-bar-settings-btn"
          onClick={(e) => {
            e.stopPropagation();
            openSettings();
          }}
          title="Settings"
        >
          <SettingsIcon size={14} />
        </button>
        <div className="status-item file-info">
          {activePath && (
            <div className="status-file-icon">
              <DocumentIcon
                name={fileName || ''}
                path={activePath}
                documentType={documentType}
                metadata={metadata}
                size={14}
              />
            </div>
          )}
          <span className="file-name">{fileName}</span>
          {documentType && (
            <span className="document-type">
              {documentType.charAt(0).toUpperCase() + documentType.slice(1)}
            </span>
          )}
        </div>
      </div>
      <div className="status-item right-info">
        {detailedMetrics && (
          <div
            className="char-count-trigger"
            ref={triggerRef}
            onClick={() => setShowPopup(!showPopup)}
            title="クリックして文字数詳細を表示"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setShowPopup(!showPopup);
              }
            }}
          >
            {charDisplay}
          </div>
        )}

        {showPopup && detailedMetrics && (
          <div className="char-count-popup" ref={popupRef}>
            <div className="popup-header">
              <span className="popup-title">文字数詳細分析</span>
              <button
                type="button"
                className="popup-close-btn"
                onClick={() => setShowPopup(false)}
              >
                &times;
              </button>
            </div>
            <div className="popup-body">
              <div className="popup-section">
                <div className="section-title">基本カウント</div>
                <table className="popup-table">
                  <tbody>
                    <tr>
                      <td className="col-label">基本文字数 (空白・改行除く)</td>
                      <td className="col-value">{detailedMetrics.charCount.toLocaleString()} 字</td>
                    </tr>
                    <tr>
                      <td className="col-label">文字数 (空白・改行含む)</td>
                      <td className="col-value">{detailedMetrics.charCountWithSpaces.toLocaleString()} 字</td>
                    </tr>
                    <tr>
                      <td className="col-label">総文字数 (RAW)</td>
                      <td className="col-value">{detailedMetrics.rawLength.toLocaleString()} 字</td>
                    </tr>
                    <tr>
                      <td className="col-label">総行数</td>
                      <td className="col-value">{detailedMetrics.lineCount.toLocaleString()} 行</td>
                    </tr>
                    <tr>
                      <td className="col-label">原稿用紙換算 (400字詰め)</td>
                      <td className="col-value">{detailedMetrics.manuscriptSheets.toFixed(1)} 枚</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="popup-section">
                <div className="section-title">文体分析 (セリフ / 地の文)</div>
                <div className="ratio-bar-container">
                  <div className="ratio-bar">
                    <div
                      className="ratio-dialogue"
                      style={{ width: `${dialogueRatio}%` }}
                      title={`セリフ: ${dialogueRatio.toFixed(1)}%`}
                    />
                    <div
                      className="ratio-narrative"
                      style={{ width: `${narrativeRatio}%` }}
                      title={`地の文: ${narrativeRatio.toFixed(1)}%`}
                    />
                  </div>
                  <div className="ratio-labels">
                    <span className="label-dialogue">
                      セリフ: {dialogueRatio.toFixed(1)}% ({dialogueCharCount.toLocaleString()}字 / {detailedMetrics.dialogue.lineCount}行)
                    </span>
                    <span className="label-narrative">
                      地の文: {narrativeRatio.toFixed(1)}% ({narrativeCharCount.toLocaleString()}字 / {detailedMetrics.narrative.lineCount}行)
                    </span>
                  </div>
                </div>
              </div>

              <div className="popup-section">
                <div className="section-title">空白・改行内訳</div>
                <table className="popup-table">
                  <tbody>
                    <tr>
                      <td className="col-label">全角スペース</td>
                      <td className="col-value">{detailedMetrics.spaces.fullWidth.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="col-label">半角スペース</td>
                      <td className="col-value">{detailedMetrics.spaces.halfWidth.toLocaleString()}</td>
                    </tr>
                    <tr>
                      <td className="col-label">改行コード</td>
                      <td className="col-value">{detailedMetrics.newlines.toLocaleString()}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <button
          type="button"
          className={`status-pane-toggle-btn ${!isRightPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleRightPane}
          title="Toggle Right Pane"
        >
          <PanelRight size={14} />
        </button>
        <button
          type="button"
          className="status-bar-fullscreen-btn"
          onClick={handleToggleFullScreen}
          title="フルスクリーン切り替え"
        >
          {isFullScreen ? <Minimize size={14} /> : <Maximize size={14} />}
        </button>
        <button
          type="button"
          className="status-bar-manual-btn"
          onClick={() =>
            window.electron.shell.openExternal(
              'https://mituha.github.io/novelaid-editor/',
            )
          }
          title="オンラインマニュアルを開く"
        >
          <HelpCircle size={14} />
        </button>
      </div>
    </div>
  );
}
