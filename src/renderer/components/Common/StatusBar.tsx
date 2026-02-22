import {
  Settings as SettingsIcon,
  PanelLeft,
  PanelRight,
  Home,
  HelpCircle,
  Maximize,
  Minimize,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import './StatusBar.css';
import { CountMetric } from '../../utils/CharCounter';
import FileIcon from '../../utils/FileIcon';

interface StatusBarProps {
  metrics: CountMetric[];
  activePath: string | null;
  language?: string;
  metadata?: Record<string, any>;
  openSettings: () => void;
  onGoHome: () => void;
  onToggleLeftPane: () => void;
  onToggleRightPane: () => void;
  isLeftPaneVisible: boolean;
  isRightPaneVisible: boolean;
}

export default function StatusBar({
  metrics,
  activePath,
  language = '',
  metadata = {},
  openSettings,
  onGoHome,
  onToggleLeftPane,
  onToggleRightPane,
  isLeftPaneVisible,
  isRightPaneVisible,
}: StatusBarProps) {
  const [isFullScreen, setIsFullScreen] = useState(false);

  useEffect(() => {
    const checkFullScreen = async () => {
      const fs = await window.electron.window.isFullScreen();
      setIsFullScreen(fs);
    };
    checkFullScreen();
  }, []);

  const handleToggleFullScreen = async () => {
    const fs = await window.electron.window.toggleFullScreen();
    setIsFullScreen(fs);
  };

  const fileName = activePath ? activePath.split('\\').pop() : 'No file open';

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
              <FileIcon
                name={fileName || ''}
                path={activePath}
                language={language}
                metadata={metadata}
                size={14}
              />
            </div>
          )}
          <span className="file-name">{fileName}</span>
          {language && (
            <span className="document-type">
              {language.charAt(0).toUpperCase() + language.slice(1)}
            </span>
          )}
        </div>
      </div>
      <div className="status-item right-info">
        {metrics.map((metric) => (
          <span key={metric.label} className="metric-item">
            {metric.label}: {metric.value.toLocaleString()}
          </span>
        ))}
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
