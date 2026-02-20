import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus, Clock, X, Book } from 'lucide-react';
import { useGit } from '../../contexts/GitContext';
import { useSettings } from '../../contexts/SettingsContext';
import { useApp } from '../../contexts/AppContext';
import './ProjectLauncher.css';

interface RecentProject {
  path: string;
  name: string;
  lastOpened: number;
}

export default function ProjectLauncher() {
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const { currentDir, setCurrentDir } = useGit();
  const { loadProjectSettings } = useSettings();
  const { version, setActiveProject } = useApp();
  const navigate = useNavigate();

  // Create project state
  const [isCreating, setIsCreating] = useState(false);
  const [parentDir, setParentDir] = useState('');
  const [projectName, setProjectName] = useState('');
  const [cloneUrl, setCloneUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const loadRecent = useCallback(async () => {
    if (!window.electron?.ipcRenderer) return;
    try {
      const projects = await window.electron.ipcRenderer.invoke('recent:get');
      if (Array.isArray(projects)) {
        setRecentProjects(projects);
      }
    } catch {
      // Ignored
    }
  }, []);

  const openProject = useCallback(
    async (path: string) => {
      if (currentDir === path) {
        navigate('/editor');
        return;
      }

      await window.electron?.ipcRenderer.invoke('recent:add', path);
      setCurrentDir(path);
      setActiveProject(path);
      await loadProjectSettings(path);
      navigate('/editor');
    },
    [currentDir, setCurrentDir, setActiveProject, loadProjectSettings, navigate],
  );

  useEffect(() => {
    loadRecent();
  }, [loadRecent]);

  const handleOpenFolder = async () => {
    const path = await window.electron?.ipcRenderer.invoke(
      'dialog:openDirectory',
    );
    if (path) {
      await openProject(path);
    }
  };

  const handlePickParentDir = async () => {
    const path = await window.electron?.ipcRenderer.invoke(
      'dialog:openDirectory',
    );
    if (path) {
      setParentDir(path);
    }
  };

  const handleCreateProject = async () => {
    if (!parentDir || !projectName) return;
    setIsProcessing(true);
    try {
      const targetPath = await window.electron?.ipcRenderer.invoke(
        'project:create',
        {
          parentDir,
          name: projectName,
          cloneUrl: cloneUrl.trim() || undefined,
        },
      );
      if (targetPath) {
        await openProject(targetPath);
      }
    } catch {
      // Failed to create project
    } finally {
      setIsProcessing(false);
    }
  };

  let submitButtonText = '作成';
  if (isProcessing) {
    submitButtonText = '処理中...';
  } else if (cloneUrl.trim()) {
    submitButtonText = 'クローンして作成';
  }

  const handleRemoveRecent = async (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    await window.electron?.ipcRenderer.invoke('recent:remove', path);
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
            {!isCreating ? (
              <>
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
                  onClick={() => setIsCreating(true)}
                >
                  <Plus size={20} />
                  <div className="button-text">
                    <span className="label">新しい書庫を作成</span>
                    <span className="desc">
                      新しい小説執筆環境をセットアップします
                    </span>
                  </div>
                </button>
              </>
            ) : (
              <div className="creation-section">
                <div className="section-header">
                  <Plus size={16} />
                  <span>新しい書庫を作成 / クローン</span>
                </div>

                <div className="form-group">
                  <label htmlFor="parent-dir">
                    保存先フォルダー
                    <div className="input-with-button">
                      <input
                        id="parent-dir"
                        type="text"
                        className="launcher-input"
                        value={parentDir}
                        readOnly
                        placeholder="フォルダーを選択してください"
                      />
                      <button
                        type="button"
                        className="browse-btn"
                        onClick={handlePickParentDir}
                      >
                        参照
                      </button>
                    </div>
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="project-name">
                    書庫名（フォルダー名）
                    <input
                      id="project-name"
                      type="text"
                      className="launcher-input"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="MyNovel"
                    />
                  </label>
                </div>

                <div className="form-group">
                  <label htmlFor="clone-url">
                    クローンURL（オプション）
                    <input
                      id="clone-url"
                      type="text"
                      className="launcher-input"
                      value={cloneUrl}
                      onChange={(e) => setCloneUrl(e.target.value)}
                      placeholder="https://github.com/user/repo.git"
                    />
                  </label>
                </div>

                <div className="form-actions">
                  <button
                    type="button"
                    className="form-btn cancel"
                    onClick={() => setIsCreating(false)}
                    disabled={isProcessing}
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    className="form-btn submit"
                    onClick={handleCreateProject}
                    disabled={isProcessing || !parentDir || !projectName}
                  >
                    {submitButtonText}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="launcher-footer">
          <span>Version {version}</span>
        </div>
      </div>
    </div>
  );
}
