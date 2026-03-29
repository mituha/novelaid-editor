import React from 'react';
import { ExternalLink, BookOpen, Send, Share2, Book } from 'lucide-react';
import { Panel } from '../../types/panel';
import { useProject } from '../../contexts/ProjectContext';
import { useDocument } from '../../contexts/DocumentContext';
import './SubmissionPanel.css';

export function SubmissionPanel() {
  const { projectConfig } = useProject();
  const { openDocument } = useDocument();
  const submission = projectConfig.submission || {};

  const handleOpenKakuyomu = () => {
    openDocument(submission.kakuyomuUrl || 'https://kakuyomu.jp/my', {
      title: 'カクヨム',
    });
  };

  const handleOpenNaro = () => {
    openDocument(submission.naroUrl || 'https://syosetu.com/', {
      title: '小説家になろう',
    });
  };

  const handleOpenTalesNote = () => {
    openDocument(submission.talesNoteUrl || 'https://tales.note.com/posts/works', {
      title: 'TALES(物語投稿サイト)',
    });
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
          <span>小説家になろうを開く</span>
        </button>
        <button
          type="button"
          className="submission-btn"
          onClick={handleOpenTalesNote}
        >
          <Book size={18} />
          <span>TALESを開く</span>
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
  component: () => (
    <SubmissionPanel />
  ),
  defaultLocation: 'left',
};

export default SubmissionPanel;
