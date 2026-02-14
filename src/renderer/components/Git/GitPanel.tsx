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
import { GitGraph } from './GitGraph';
import './GitPanel.css';

interface GitPanelProps {
  onOpenDiff?: (path: string, staged: boolean) => void;
}

export const GitPanel: React.FC<GitPanelProps> = ({ onOpenDiff }) => {
  const {
    status,
    history,
    currentDir,
    remotes,
    currentBranch,
    refreshStatus,
    refreshHistory,
    initRepo,
    stageFiles,
    unstageFiles,
    commitChanges,
    pushChanges,
  } = useGit();
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommiting, setIsCommiting] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [selectedRemote, setSelectedRemote] = useState('origin');

  useEffect(() => {
    if (remotes.length > 0 && !remotes.includes(selectedRemote)) {
      setSelectedRemote(remotes[0]);
    }
  }, [remotes]);

  const handlePush = async () => {
    if (!selectedRemote) return;
    setIsPushing(true);
    try {
      await pushChanges(selectedRemote);
    } catch (error) {
      console.error('Push failed', error);
      alert('Push failed. Check console for details.');
    } finally {
      setIsPushing(false);
    }
  };

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
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            overflow: 'hidden',
          }}
        >
          <h3 style={{ margin: 0, flexShrink: 0 }}>Git 管理</h3>
          {currentBranch && (
            <span
              style={{
                fontSize: '11px',
                padding: '1px 6px',
                borderRadius: '4px',
                backgroundColor: 'var(--button-bg)',
                border: '1px solid var(--border-color)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                maxWidth: '100%',
              }}
              title={currentBranch}
            >
              {currentBranch}
            </span>
          )}
        </div>
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
        <div
          style={{
            display: 'flex',
            gap: '4px',
            marginBottom: '8px',
            alignItems: 'center',
          }}
        >
          <input
            type="text"
            className="git-panel-commitInput"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="メッセージ (Ctrl+Enter でコミット)"
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === 'Enter') handleCommit();
            }}
            style={{ flex: 1, height: '32px', resize: 'none' }}
          />
          <button
            type="button"
            className="git-panel-iconBtn"
            title="日時を挿入"
            onClick={() => {
              const now = new Date();
              const dateStr = `${now.getFullYear()}/${String(
                now.getMonth() + 1,
              ).padStart(2, '0')}/${String(now.getDate()).padStart(
                2,
                '0',
              )} ${String(now.getHours()).padStart(2, '0')}:${String(
                now.getMinutes(),
              ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
              setCommitMessage((prev) =>
                prev ? `${prev} ${dateStr}` : dateStr,
              );
            }}
            style={{
              height: '32px',
              padding: '0 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div style={{ fontSize: '12px', whiteSpace: 'nowrap' }}>日時</div>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="git-panel-commitBtn"
            type="button"
            onClick={handleCommit}
            disabled={isCommiting || !commitMessage || stagedFiles.length === 0}
            style={{ flex: 1 }}
          >
            <GitCommit size={16} />
            {isCommiting ? 'コミット中...' : 'コミット'}
          </button>
        </div>

        {/* Push Section */}
        {remotes.length > 0 && (
          <div
            style={{
              marginTop: '12px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '12px',
            }}
          >
            <div
              style={{
                marginBottom: '4px',
                fontSize: '12px',
                color: 'var(--text-secondary)',
              }}
            >
              Push to Remote ({currentBranch})
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                style={{
                  flex: 1,
                  backgroundColor: 'var(--input-bg)',
                  color: 'var(--text-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  padding: '4px',
                }}
                value={selectedRemote}
                onChange={(e) => setSelectedRemote(e.target.value)}
              >
                {remotes.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="git-panel-commitBtn" // Reuse style
                onClick={handlePush}
                disabled={isPushing}
                style={{ flex: 0.8 }}
              >
                {isPushing ? <RefreshCw size={14} className="spin" /> : 'Push'}
              </button>
            </div>
          </div>
        )}

        {history.length === 0 && (
          <button
            type="button"
            onClick={initRepo}
            className="git-panel-initBtn"
            style={{ marginTop: '12px' }}
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
                      className={`git-panel-status status-${getStatusLabel(
                        file,
                      )}`}
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
                      className={`git-panel-status status-${getStatusLabel(
                        file,
                      )}`}
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
      <div
        className="git-panel-section"
        style={{
          display: 'flex',
          flexDirection: 'column',
          flex: 1,
          overflow: 'hidden',
        }}
      >
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
          <div
            className="section-content"
            style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            {/* Graph Container */}
            <div style={{ flexShrink: 0, overflow: 'hidden' }}>
              <GitGraph
                history={history}
                height={40}
                spacing={12}
                dotSize={8}
              />
            </div>

            {/* Text List */}
            <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
              <ul
                className="git-panel-historyList"
                style={{ margin: 0, padding: 0, listStyle: 'none' }}
              >
                {history.map((entry) => (
                  <li
                    key={entry.hash}
                    className="git-panel-historyItem"
                    style={{ height: '40px', boxSizing: 'border-box' }}
                  >
                    <div className="git-panel-historyContent">
                      <div className="git-panel-historyMessage">
                        <span
                          style={{ fontWeight: 'bold', marginRight: '4px' }}
                        >
                          {entry.message}
                        </span>
                        {entry.refs && (
                          <span
                            style={{
                              display: 'inline-flex',
                              gap: '4px',
                              flexWrap: 'wrap',
                            }}
                          >
                            {entry.refs.split(', ').map((ref: string) => {
                              const cleanRef = ref.trim();
                              let color = '#4caf50'; // default green (local)
                              if (cleanRef.includes('HEAD ->')) {
                                color = '#00bcd4'; // cyan (current branch)
                              } else if (
                                cleanRef.includes('origin/') ||
                                cleanRef.includes('/')
                              ) {
                                color = '#2196f3'; // blue (remote)
                              } else if (cleanRef === 'HEAD') {
                                color = '#ff9800'; // orange (detached HEAD)
                              } else if (cleanRef.startsWith('tag: ')) {
                                color = '#9c27b0'; // purple (tag)
                              }

                              return (
                                <span
                                  key={cleanRef}
                                  style={{
                                    fontSize: '10px',
                                    padding: '1px 4px',
                                    borderRadius: '4px',
                                    backgroundColor: color,
                                    color: 'white',
                                    border: '1px solid rgba(255,255,255,0.2)',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {cleanRef}
                                </span>
                              );
                            })}
                          </span>
                        )}
                      </div>
                      <div className="git-panel-historyMeta">
                        {entry.author_name} -{' '}
                        {new Date(entry.date).toLocaleString()}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
