import React, { useState, useEffect } from 'react';
import { useGit } from '../../contexts/GitContext';
import './GitPanel.css';

export const GitPanel: React.FC = () => {
  const { status, history, currentDir, refreshStatus, refreshHistory, initRepo, stageFiles, commitChanges } = useGit();
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommiting, setIsCommiting] = useState(false);

  useEffect(() => {
    if (currentDir) {
        refreshStatus();
        refreshHistory();
    }
  }, [currentDir, refreshStatus, refreshHistory]);

  const handleStageAll = async () => {
    const files = status.map(s => s.path);
    if (files.length > 0) {
        await stageFiles(files);
    }
  };

  const handleStageFile = async (path: string) => {
      await stageFiles([path]);
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
      return <div className="git-panel-container">No project open.</div>;
  }

  return (
    <div className="git-panel-container">
      <div className="git-panel-header">
        <h3>Git</h3>
        <button onClick={() => { refreshStatus(); refreshHistory(); }} title="Refresh">↻</button>
      </div>

      <div className="git-panel-section">
        <h4>Changes</h4>
        {status.length === 0 ? (
            <div className="git-panel-empty">No changes</div>
        ) : (
             <ul className="git-panel-fileList">
                {status.map((file) => (
                    <li key={file.path} className="git-panel-fileItem">
                        <span className="git-panel-status">{file.index === '?' ? 'U' : 'M'}</span>
                        <span className="git-panel-path" title={file.path}>{file.path}</span>
                        <button onClick={() => handleStageFile(file.path)}>+</button>
                    </li>
                ))}
            </ul>
        )}
        {status.length > 0 && (
             <button onClick={handleStageAll} className="git-panel-stageAllBtn">Stage All</button>
        )}
      </div>

      <div className="git-panel-section">
        <h4>Commit</h4>
        <textarea
            className="git-panel-commitInput"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message"
            rows={3}
        />
        <button
            className="git-panel-commitBtn"
            onClick={handleCommit}
            disabled={isCommiting || !commitMessage || status.length === 0}
        >
            {isCommiting ? 'Committing...' : 'Commit'}
        </button>
        {/* Simple check if repo exists: if status fails or returns specific error, functionality deals with it.
            For init, we might need a separate check "isRepo".
            But for now, if history is empty and status is empty, maybe offer init?
            Actually, let's add an Init button if we suspect no repo (e.g. error catching in context).
            Implemented simplistic 'init' button for now.
         */}
         <button onClick={initRepo} className="git-panel-initBtn">Init Repo</button>
      </div>

      <div className="git-panel-section">
        <h4>History</h4>
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
