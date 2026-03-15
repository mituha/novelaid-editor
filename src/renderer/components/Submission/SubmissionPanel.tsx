import React from 'react';
import { ExternalLink, BookOpen, Send, Share2 } from 'lucide-react';
import { Panel } from '../../types/panel';
import { useProject } from '../../contexts/ProjectContext';
import './SubmissionPanel.css';

interface SubmissionPanelProps {
  onOpenWeb: (url: string, title: string) => void;
}

export function SubmissionPanel({ onOpenWeb }: SubmissionPanelProps) {
  const { projectConfig } = useProject();
  const submission = projectConfig.submission || {};

  const handleOpenKakuyomu = () => {
    onOpenWeb(submission.kakuyomuUrl || 'https://kakuyomu.jp/my', 'カクヨム');
  };

  const handleOpenNaro = () => {
    onOpenWeb(submission.naroUrl || 'https://syosetu.com/', '小説家になろう');
  };

  return (
    <div className="submission-panel">
      <div className="submission-section">
        <h3>クイックアクセス</h3>
        <button
          type="button"
          className="submission-btn"
          onClick={handleOpenKakuyomu}
        >
          <BookOpen size={18} />
          <span>カクヨムを開く</span>
        </button>
        <button
          type="button"
          className="submission-btn"
          onClick={handleOpenNaro}
        >
          <Send size={18} />
          <span>なろうを開く</span>
        </button>
      </div>

      <div className="submission-info">
        <p>
          アプリ内で各サイトを開くことで、執筆した小説をスムーズに投稿できます。
        </p>
        <div className="info-item">
          <ExternalLink size={14} />
          <span>クリップボード経由での貼り付けに対応しています。</span>
        </div>
      </div>
    </div>
  );
}

export const submissionPanelConfig: Panel = {
  id: 'submission',
  title: '投稿補助',
  icon: <Share2 size={24} strokeWidth={1.5} />,
  component: ({ onOpenWebBrowser }: any) => (
    <SubmissionPanel onOpenWeb={onOpenWebBrowser} />
  ),
  defaultLocation: 'left',
};

export default SubmissionPanel;
