import { Settings as SettingsIcon, PanelLeft, PanelRight } from 'lucide-react';
import './StatusBar.css';
import { CountMetric } from '../../utils/CharCounter';

interface StatusBarProps {
  metrics: CountMetric[];
  activePath: string | null;
  openSettings: () => void;
  onToggleLeftPane: () => void;
  onToggleRightPane: () => void;
  isLeftPaneVisible: boolean;
  isRightPaneVisible: boolean;
}

export function StatusBar({
  metrics,
  activePath,
  openSettings,
  onToggleLeftPane,
  onToggleRightPane,
  isLeftPaneVisible,
  isRightPaneVisible,
}: StatusBarProps) {
  const fileName = activePath ? activePath.split('\\').pop() : 'No file open';

  return (
    <div className="status-bar">
      <div className="status-item left-group">
        <button
          type="button"
          className={`status-pane-toggle-btn ${!isLeftPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleLeftPane}
          title="Toggle Sidebar"
        >
          <PanelLeft size={14} />
        </button>
        <div className="status-item file-info">
          <span>{fileName}</span>
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
          className="status-bar-settings-btn"
          onClick={(e) => {
            e.stopPropagation();
            openSettings();
          }}
          title="Settings"
        >
          <SettingsIcon size={14} />
        </button>
        <button
          type="button"
          className={`status-pane-toggle-btn ${!isRightPaneVisible ? 'inactive' : ''}`}
          onClick={onToggleRightPane}
          title="Toggle Right Pane"
        >
          <PanelRight size={14} />
        </button>
      </div>
    </div>
  );
}
