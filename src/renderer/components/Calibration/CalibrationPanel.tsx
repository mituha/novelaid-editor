import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Repeat,
  CheckCircle,
  BarChart2,
  AlertCircle,
} from 'lucide-react';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import './CalibrationPanel.css';

interface FrequencyResult {
  word: string;
  count: number;
  pos: string;
}

interface CalibrationIssue {
  id: string;
  type:
    | 'particle_repetition'
    | 'word_frequency'
    | 'consistency'
    | 'kanji_open_close'
    | 'textlint';
  message: string;
  range: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  };
  ranges?: {
    startLine: number;
    startColumn: number;
    endLine: number;
    endColumn: number;
  }[];
  suggestion?: string;
}

interface CalibrationPanelProps {
  content: string;
  activePath?: string | null;
  documentType?: string;
}

export default function CalibrationPanel({ content, activePath, documentType }: CalibrationPanelProps) {
  const { settings } = useSettings();
  const calibration = settings.calibration;

  const handleIssueClick = (range: any) => {
    window.dispatchEvent(
      new CustomEvent('calibration-jump', { detail: { ...range, path: activePath } }),
    );
  };

  const [activeTab, setActiveTab] = useState<'frequency' | 'issues'>('issues');
  const [frequency, setFrequency] = useState<FrequencyResult[]>([]);
  const [issues, setIssues] = useState<CalibrationIssue[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const analyze = async () => {
      if (!content || documentType !== 'novel') return;
      setLoading(true);
      try {
        const result = await window.electron.calibration.analyze(content, calibration);
        if (isMounted) {
          setFrequency(result.frequency);
          setIssues(result.issues);

          window.dispatchEvent(
            new CustomEvent('calibration-update', {
              detail: result.issues,
            }),
          );
        }
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Calibration failed', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    // Debounce
    const timer = setTimeout(() => {
      analyze();
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [content, calibration, documentType]);

  const particleIssues = issues.filter((i) => i.type === 'particle_repetition');
  const consistencyIssues = issues.filter(
    (i) => i.type === 'consistency' || i.type === 'kanji_open_close',
  );
  const textlintIssues = issues.filter((i) => i.type === 'textlint');

  // ファイル名を取得
  const fileName = activePath ? activePath.split('\\').pop() || activePath.split('/').pop() : '';

  if (documentType !== 'novel') {
    return (
      <div className="calibration-panel empty-container">
        <div className="empty-state">小説ドキュメントを開いてください</div>
      </div>
    );
  }

  return (
    <div className="calibration-panel">
      <div className="calibration-header">
        <div className="calibration-target-file" title={activePath || ''}>
          {fileName}
        </div>
        <div className="calibration-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'issues' ? 'active' : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            <AlertTriangle size={14} />
            <span>指摘 ({issues.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'frequency' ? 'active' : ''}`}
            onClick={() => setActiveTab('frequency')}
          >
            <BarChart2 size={14} />
            <span>頻出語</span>
          </button>
        </div>
      </div>

      <div className="calibration-content">
        {loading && <div className="loading-indicator">解析中...</div>}

        {!loading && activeTab === 'issues' && (
          <div className="issues-list">
            {issues.length === 0 && (
              <div className="empty-state">指摘事項はありません</div>
            )}

            {particleIssues.length > 0 && (
              <div className="issue-group">
                <div className="group-header">
                  <Repeat size={14} />
                  <span>助詞の連続</span>
                </div>
                {particleIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="issue-item"
                    onClick={() => handleIssueClick(issue.range)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleIssueClick(issue.range);
                      }
                    }}
                  >
                    <div className="issue-message">{issue.message}</div>
                    <div className="issue-location">
                      Line{' '}
                      {issue.ranges
                        ? issue.ranges.map((r) => r.startLine).join(', ')
                        : issue.range.startLine}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {textlintIssues.length > 0 && (
              <div className="issue-group">
                <div className="group-header">
                  <AlertTriangle size={14} />
                  <span>文章チェック (textlint)</span>
                </div>
                {textlintIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="issue-item"
                    onClick={() => handleIssueClick(issue.range)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleIssueClick(issue.range);
                      }
                    }}
                  >
                    <div className="issue-message">{issue.message}</div>
                    {issue.suggestion && (
                      <div className="issue-suggestion">
                        提案: {issue.suggestion}
                      </div>
                    )}
                    <div className="issue-location">
                      Line {issue.range.startLine}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {consistencyIssues.length > 0 && (
              <div className="issue-group">
                <div className="group-header">
                  <AlertCircle size={14} />
                  <span>表記ゆれ・漢字</span>
                </div>
                {consistencyIssues.map((issue) => (
                  <div
                    key={issue.id}
                    className="issue-item"
                    onClick={() => handleIssueClick(issue.range)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        handleIssueClick(issue.range);
                      }
                    }}
                  >
                    <div className="issue-message">{issue.message}</div>
                    {issue.suggestion && (
                      <div className="issue-suggestion">
                        提案: {issue.suggestion}
                      </div>
                    )}
                    <div className="issue-location">
                      Line {issue.range.startLine}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!loading && activeTab === 'frequency' && (
          <div className="frequency-list">
            <div className="freq-header">
              <span>単語</span>
              <span>品詞</span>
              <span>回数</span>
            </div>
            {frequency.slice(0, 100).map((item) => (
              <div key={`${item.word}-${item.pos}`} className="freq-item">
                <span className="freq-word">{item.word}</span>
                <span className="freq-pos">{item.pos}</span>
                <span className="freq-count">{item.count}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const calibrationPanelConfig: Panel = {
  id: 'calibration',
  title: '文章校正',
  icon: <CheckCircle size={24} strokeWidth={1.5} />,
  component: ({ activeContent, activePath, documents }: any) => {
    const documentType = activePath ? documents?.[activePath]?.documentType : undefined;
    
    return (
      <CalibrationPanel 
        content={activeContent || ''} 
        activePath={activePath}
        documentType={documentType}
      />
    );
  },
  defaultLocation: 'right',
};
