import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Clock, X, Book } from 'lucide-react';
import { useGit } from '../../contexts/GitContext';
import { useSettings } from '../../contexts/SettingsContext';
import './ProjectLauncher.css';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export default function ProjectLauncher() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [version, setVersion] = useState<string>('');
  const { currentDir, setCurrentDir } = useGit();
  const { loadProjectSettings } = useSettings();
  const navigate = useNavigate();

  const loadRecent = useCallback(async () => {
    if (!window.electron?.ipcRenderer) return;
    try {
      const projects = await window.electron.ipcRenderer.invoke('recent:get');
      if (Array.isArray(projects)) {
        setRecentProjects(projects);
      }
    } catch (e) {
      console.error('Failed to load recent projects', e);
    }
  }, []);

  const openProject = useCallback(
    async (path: string) => {
      // 現在開いているフォルダと同じなら、読み込み処理をスキップしてエディタに戻る
      if (currentDir === path) {
        navigate('/editor');
        return;
      }

      await window.electron.ipcRenderer.invoke('recent:add', path);
      setCurrentDir(path);
      await loadProjectSettings(path);
      navigate('/editor');
    },
    [currentDir, setCurrentDir, loadProjectSettings, navigate],
  );

  useEffect(() => {
    loadRecent();
    (async () => {
      const v = await window.electron.app.getVersion();
      setVersion(v);
    })();
  }, [loadRecent]);

  const handleOpenFolder = async () => {
    const path = await window.electron.ipcRenderer.invoke(
      'dialog:openDirectory',
    );
    if (path) {
      await openProject(path);
    }
  };

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await window.electron.ipcRenderer.invoke('recent:remove', path);
    loadRecent();
  };

  const handleKeyDown = (e: React.KeyboardEvent, path: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      openProject(path);
    }
  };

  return (
    <div className="launcher-container">
      <div className="launcher-card">
        <div className="launcher-header">
          {currentDir && (
            <button
              type="button"
              className="launcher-close-btn"
              onClick={() => navigate('/editor')}
              title="エディタに戻る"
            >
              <X size={20} />
            </button>
          )}
          <Book size={48} className="logo-icon" />
          <h1>novelaid-editor</h1>
          <p className="subtitle">小説執筆のための書庫を選択</p>
        </div>

        <div className="launcher-content">
          <div className="recent-section">
            <div className="section-header">
              <Clock size={16} />
              <span>最近使った書庫</span>
            </div>
            <div className="recent-list">
              {recentProjects.length > 0 ? (
                recentProjects.map((project) => (
                  <div
                    key={project.path}
                    className="recent-item"
                    onClick={() => openProject(project.path)}
                    onKeyDown={(e) => handleKeyDown(e, project.path)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="item-info">
                      <span className="item-name">{project.name}</span>
                      <span className="item-path">{project.path}</span>
                    </div>
                    <button
                      type="button"
                      className="remove-recent"
                      onClick={(e) => handleRemoveRecent(e, project.path)}
                      title="一覧から削除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="empty-recent">最近使った書庫はありません</div>
              )}
            </div>
          </div>

          <div className="actions-section">
            <button
              type="button"
              className="action-button primary"
              onClick={handleOpenFolder}
            >
              <FolderOpen size={20} />
              <div className="button-text">
                <span className="label">既存のフォルダを開く</span>
                <span className="desc">
                  PC上の既存のプロジェクトを選択します
                </span>
              </div>
            </button>
            <button
              type="button"
              className="action-button"
              onClick={handleOpenFolder}
            >
              <Plus size={20} />
              <div className="button-text">
                <span className="label">新しい書庫を作成</span>
                <span className="desc">
                  新しい小説執筆環境をセットアップします
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="launcher-footer">
          <span>Version {version}</span>
        </div>
      </div>
    </div>
  );
}
