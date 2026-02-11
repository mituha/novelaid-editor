import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Minus, GitCommit, Database } from 'lucide-react';
import { useGit } from '../../contexts/GitContext';
import './GitPanel.css';

export const GitPanel: React.FC = () => {
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

  const handleStageAll = async () => {
    const files = unstagedFiles.map((s) => s.path);
    if (files.length > 0) {
      await stageFiles(files);
    }
  };

  const handleUnstageAll = async () => {
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

      <div className="git-panel-section">
        <div className="section-title-row">
          <h4>ステージ済みの変更</h4>
          {stagedFiles.length > 1 && (
            <button
              type="button"
              onClick={handleUnstageAll}
              className="git-panel-action-link"
              title="すべてステージ解除"
            >
              <Minus size={14} />
            </button>
          )}
        </div>
        {stagedFiles.length === 0 ? (
          <div className="git-panel-empty">ステージされたファイルはありません</div>
        ) : (
          <ul className="git-panel-fileList">
            {stagedFiles.map((file) => (
              <li key={file.path} className="git-panel-fileItem staged">
                <span className={`git-panel-status status-${getStatusLabel(file)}`}>
                  {getStatusLabel(file)}
                </span>
                <span className="git-panel-path" title={file.path}>
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

      <div className="git-panel-section">
        <div className="section-title-row">
          <h4>変更</h4>
          {unstagedFiles.length > 0 && (
            <button
              type="button"
              onClick={handleStageAll}
              className="git-panel-action-link"
              title="すべてステージに追加"
            >
              <Plus size={14} />
            </button>
          )}
        </div>
        {unstagedFiles.length === 0 ? (
          <div className="git-panel-empty">変更はありません</div>
        ) : (
          <ul className="git-panel-fileList">
            {unstagedFiles.map((file) => (
              <li key={file.path} className="git-panel-fileItem">
                <span className={`git-panel-status status-${getStatusLabel(file)}`}>
                  {getStatusLabel(file)}
                </span>
                <span className="git-panel-path" title={file.path}>
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

      <div className="git-panel-section commit-section">
        <h4>コミット</h4>
        <textarea
          className="git-panel-commitInput"
          value={commitMessage}
          onChange={(e) => setCommitMessage(e.target.value)}
          placeholder="コミットメッセージを入力..."
          rows={3}
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
          <button type="button" onClick={initRepo} className="git-panel-initBtn">
            <Database size={14} />
            リポジトリを初期化
          </button>
        )}
      </div>

      <div className="git-panel-section">
        <h4>履歴</h4>
        <ul className="git-panel-historyList">
          {history.slice(0, 5).map((entry) => (
            <li key={entry.hash} className="git-panel-historyItem">
              <div className="git-panel-historyMessage">{entry.message}</div>
              <div className="git-panel-historyMeta">
                {entry.author_name} - {new Date(entry.date).toLocaleDateString()}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
