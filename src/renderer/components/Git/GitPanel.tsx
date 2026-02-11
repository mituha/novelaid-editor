import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Plus,
  Minus,
  GitCommit,
  Database,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useGit } from '../../contexts/GitContext';
import './GitPanel.css';

interface GitPanelProps {
  onOpenDiff?: (path: string, staged: boolean) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ onOpenDiff }) => {
  const {
    status,
    history,
    currentDir,
    refreshStatus,
    refreshHistory,
    initRepo,
    stageFiles,
    unstageFiles,
    commitChanges,
  } = useGit();
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommiting, setIsCommiting] = useState(false);

  // 折れ畳み状態の管理
  const [expanded, setExpanded] = useState({
    staged: true,
    changes: true,
    history: true,
  });

  useEffect(() => {
    if (currentDir) {
      refreshStatus();
      refreshHistory();
    }
  }, [currentDir, refreshStatus, refreshHistory]);

  const stagedFiles = status.filter((f) => f.index !== ' ' && f.index !== '?');
  const unstagedFiles = status.filter(
    (f) => f.working_dir !== ' ' || f.index === '?',
  );

  const toggleSection = (section: keyof typeof expanded) => {
    setExpanded((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleStageAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const files = unstagedFiles.map((s) => s.path);
    if (files.length > 0) {
      await stageFiles(files);
    }
  };

  const handleUnstageAll = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const files = stagedFiles.map((s) => s.path);
    if (files.length > 0) {
      await unstageFiles(files);
    }
  };

  const handleStageFile = async (path: string) => {
    await stageFiles([path]);
  };

  const handleUnstageFile = async (path: string) => {
    await unstageFiles([path]);
  };

  const handleCommit = async () => {
    if (!commitMessage) return;
    setIsCommiting(true);
    try {
      await commitChanges(commitMessage);
      setCommitMessage('');
    } finally {
      setIsCommiting(false);
    }
  };

  if (!currentDir) {
    return <div className="git-panel-container">書庫が開かれていません。</div>;
  }

  const getStatusLabel = (file: any) => {
    if (file.index === '?' && file.working_dir === '?') return 'U'; // Untracked
    if (file.index === 'A' || file.working_dir === 'A') return 'A'; // Added
    if (file.index === 'D' || file.working_dir === 'D') return 'D'; // Deleted
    if (file.index === 'R' || file.working_dir === 'R') return 'R'; // Renamed
    return 'M'; // Modified
  };

  return (
    <div className="git-panel-container">
      <div className="git-panel-header">
        <h3>Git 管理</h3>
        <button
          className="git-panel-refresh-btn"
          type="button"
          onClick={() => {
            refreshStatus();
            refreshHistory();
          }}
          title="更新"
        >
          <RefreshCw size={14} />
        </button>
      </div>

      {/* コミットセクション (最上部) */}
      <div className="git-panel-section commit-section">
        <textarea
          className="git-panel-commitInput"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="メッセージ (Ctrl+Enter でコミット)"
          rows={3}
          onKeyDown={(e) => {
            if (e.ctrlKey && e.key === 'Enter') handleCommit();
          }}
        />
        <button
          className="git-panel-commitBtn"
          type="button"
          onClick={handleCommit}
          disabled={isCommiting || !commitMessage || stagedFiles.length === 0}
        >
          <GitCommit size={16} />
          {isCommiting ? 'コミット中...' : 'コミット'}
        </button>
        {history.length === 0 && (
          <button
            type="button"
            onClick={initRepo}
            className="git-panel-initBtn"
          >
            <Database size={14} />
            リポジトリを初期化
          </button>
        )}
      </div>

      {/* ステージ済みの変更 */}
      <div className="git-panel-section">
        <button
          className="section-header"
          type="button"
          onClick={() => toggleSection('staged')}
        >
          {expanded.staged ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          <span className="section-title">ステージ済みの変更</span>
          <span className="section-count">{stagedFiles.length}</span>
          <div className="section-actions">
            {stagedFiles.length > 0 && (
              <button
                type="button"
                onClick={handleUnstageAll}
                className="section-action-btn"
                title="すべてステージ解除"
              >
                <Minus size={14} />
              </button>
            )}
          </div>
        </button>
        {expanded.staged && (
          <div className="section-content">
            {stagedFiles.length === 0 ? (
              <div className="git-panel-empty">
                ステージされたファイルはありません
              </div>
            ) : (
              <ul className="git-panel-fileList">
                {stagedFiles.map((file) => (
                  <li key={file.path} className="git-panel-fileItem staged">
                    <span
                      className={`git-panel-status status-${getStatusLabel(file)}`}
                    >
                      {getStatusLabel(file)}
                    </span>
                    <span
                      className="git-panel-path"
                      title={file.path}
                      onClick={() => onOpenDiff?.(file.path, true)}
                      style={{ cursor: onOpenDiff ? 'pointer' : 'default' }}
                    >

                      {file.path}
                    </span>
                    <button
                      className="git-panel-item-action"
                      type="button"
                      onClick={() => handleUnstageFile(file.path)}
                      title="ステージ解除"
                    >
                      <Minus size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 変更 */}
      <div className="git-panel-section">
        <button
          className="section-header"
          type="button"
          onClick={() => toggleSection('changes')}
        >
          {expanded.changes ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          <span className="section-title">変更</span>
          <span className="section-count">{unstagedFiles.length}</span>
          <div className="section-actions">
            {unstagedFiles.length > 0 && (
              <button
                type="button"
                onClick={handleStageAll}
                className="section-action-btn"
                title="すべてステージに追加"
              >
                <Plus size={14} />
              </button>
            )}
          </div>
        </button>
        {expanded.changes && (
          <div className="section-content">
            {unstagedFiles.length === 0 ? (
              <div className="git-panel-empty">変更はありません</div>
            ) : (
              <ul className="git-panel-fileList">
                {unstagedFiles.map((file) => (
                  <li key={file.path} className="git-panel-fileItem">
                    <span
                      className={`git-panel-status status-${getStatusLabel(file)}`}
                    >
                      {getStatusLabel(file)}
                    </span>
                    <span
                      className="git-panel-path"
                      title={file.path}
                      onClick={() => onOpenDiff?.(file.path, false)}
                      style={{ cursor: onOpenDiff ? 'pointer' : 'default' }}
                    >

                      {file.path}
                    </span>
                    <button
                      className="git-panel-item-action"
                      type="button"
                      onClick={() => handleStageFile(file.path)}
                      title="ステージに追加"
                    >
                      <Plus size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* 履歴 */}
      <div className="git-panel-section">
        <button
          className="section-header"
          type="button"
          onClick={() => toggleSection('history')}
        >
          {expanded.history ? (
            <ChevronDown size={16} />
          ) : (
            <ChevronRight size={16} />
          )}
          <span className="section-title">履歴</span>
          <span className="section-count">{history.length}</span>
        </button>
        {expanded.history && (
          <div className="section-content">
            <ul className="git-panel-historyList">
              {history.slice(0, 10).map((entry) => (
                <li key={entry.hash} className="git-panel-historyItem">
                  <div className="git-panel-historyMessage">
                    {entry.message}
                  </div>
                  <div className="git-panel-historyMeta">
                    {entry.author_name} - {new Date(entry.date).toLocaleDateString()}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
