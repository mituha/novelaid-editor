import React from 'react';
import './StatusBar.css';
import { CountMetric } from '../../utils/CharCounter';

interface StatusBarProps {
  metrics: CountMetric[];
  activePath: string | null;
}

export function StatusBar({ metrics, activePath }: StatusBarProps) {
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
      </div>
    </div>
  );
}
