import React, { useEffect, useState } from 'react';
import { useGit } from '../../contexts/GitContext';
import './DiffViewer.css';

interface DiffViewerProps {
  path: string;
  staged: boolean;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ path, staged }) => {
  const { currentDir } = useGit();
  const [diff, setDiff] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchDiff = async () => {
      if (!currentDir) return;
      setLoading(true);
      try {
        const result = await window.electron.git.diff(currentDir, path, staged);
        setDiff(result);
      } catch (error) {
        console.error('Failed to fetch diff:', error);
        setDiff('Error loading diff');
      } finally {
        setLoading(false);
      }
    };

    fetchDiff();
  }, [currentDir, path, staged]);

  if (loading) {
    return <div className="diff-viewer-loading">読み込み中...</div>;
  }

  if (!diff) {
    return <div className="diff-viewer-empty">差分はありません</div>;
  }

  const lines = diff.split(/\r?\n/);

  return (
    <div className="diff-viewer-container">
      <div className="diff-viewer-header">
        <span className="diff-file-path">{path}</span>
        <span className="diff-staged-tag">{staged ? 'ステージ済み' : '未ステージ'}</span>
      </div>
      <div className="diff-content">
        {lines.map((line, index) => {
          let type = 'normal';
          if (line.startsWith('+')) type = 'add';
          else if (line.startsWith('-')) type = 'remove';
          else if (line.startsWith('@@')) type = 'hunk';

          return (
            <div key={index} className={`diff-line ${type}`}>
              <span className="line-number">{index + 1}</span>
              <pre className="line-text">{line}</pre>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default DiffViewer;
