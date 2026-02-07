import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import './StatusBar.css';
import { CountMetric } from '../../utils/CharCounter';

interface StatusBarProps {
  metrics: CountMetric[];
  activePath: string | null;
  openSettings: () => void;
}



export function StatusBar({ metrics, activePath, openSettings }: StatusBarProps) {
  const fileName = activePath ? activePath.split('\\').pop() : 'No file open';

  return (
    <div className="status-bar">
      <div className="status-item file-info">
        <span>{fileName}</span>
      </div>
      <div className="status-item right-info">
        {metrics.map((metric) => (
          <span key={metric.label} className="metric-item">
            {metric.label}: {metric.value.toLocaleString()}
          </span>
        ))}
         <button
            type="button"
            onClick={openSettings}
            className="status-bar-settings-btn"
            title="Settings"
            style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '10px',
                padding: '0 5px'
            }}
          >
            <SettingsIcon size={14} />
          </button>
      </div>
    </div>
  );
}
