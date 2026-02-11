import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import CodeEditor from '../components/Editor/CodeEditor';
import { TabBar, Tab } from '../components/TabBar/TabBar';
import { SettingsModal } from '../components/Settings/SettingsModal';
import { useSettings } from '../contexts/SettingsContext';
import { EditorSettingsTab } from '../components/Settings/Tabs/EditorSettingsTab';
import { AISettingsTab } from '../components/Settings/Tabs/AISettingsTab';
import { AppearanceSettingsTab } from '../components/Settings/Tabs/AppearanceSettingsTab';
import { RightPane } from '../components/RightPane/RightPane';
import { Resizer } from '../components/Common/Resizer';
import { StatusBar } from '../components/Common/StatusBar';
import { CharCounter } from '../utils/CharCounter';
import NovelPreview from '../components/Preview/NovelPreview';
import DiffViewer from '../components/Git/DiffViewer';
import { usePanel } from '../contexts/PanelContext';
import './MainLayout.css';

import { LeftPane } from '../components/LeftPane/LeftPane';

export default function MainLayout() {
  const [leftTabs, setLeftTabs] = useState<Tab[]>([]);
  const [rightTabs, setRightTabs] = useState<Tab[]>([]);
  const [leftActivePath, setLeftActivePath] = useState<string | null>(null);
  const [rightActivePath, setRightActivePath] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [isSplit, setIsSplit] = useState(false);
  const [tabContents, setTabContents] = useState<
    Record<string, { content: string; metadata: Record<string, any> }>
  >({});
  const navigate = useNavigate();
  const { settings, openSettings, registerSettingTab, loadProjectSettings } =
    useSettings();

  const { activeLeftPanelId, activeRightPanelId, setActivePanel, getPanels } =
    usePanel();

  const [leftPaneWidth, setLeftPaneWidth] = useState(250);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [editorSplitRatio, setEditorSplitRatio] = useState(0.5);

  const isLeftPaneNarrow = !activeLeftPanelId;
  const isRightPaneNarrow = !activeRightPanelId;

  const leftDisplayWidth = isLeftPaneNarrow ? 50 : leftPaneWidth;
  const rightDisplayWidth = isRightPaneNarrow ? 50 : rightPaneWidth;

  const activeTabPath = activeSide === 'left' ? leftActivePath : rightActivePath;

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPaneWidth((prev) => Math.max(150, Math.min(600, prev + delta)));
  }, []);

  const handleEditorSplitResize = useCallback((delta: number) => {
    setEditorSplitRatio((prev) =>
      Math.max(0.1, Math.min(0.9, prev + delta / 800)),
    );
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPaneWidth((prev) => Math.max(200, Math.min(600, prev - delta)));
  }, []);

  const handleToggleLeftPane = useCallback(() => {
    if (isLeftPaneNarrow) {
      const panels = getPanels().filter((p) => p.defaultLocation === 'left');
      if (panels.length > 0) {
        setActivePanel('left', panels[0].id);
      }
    } else {
      setActivePanel('left', null);
    }
  }, [isLeftPaneNarrow, getPanels, setActivePanel]);

  const handleToggleRightPane = useCallback(() => {
    if (isRightPaneNarrow) {
      const panels = getPanels().filter((p) => p.defaultLocation === 'right');
      if (panels.length > 0) {
        setActivePanel('right', panels[0].id);
      }
    } else {
      setActivePanel('right', null);
    }
  }, [isRightPaneNarrow, getPanels, setActivePanel]);

  useEffect(() => {
    registerSettingTab({
      id: 'editor',
      name: 'Editor',
      render: () => <EditorSettingsTab />,
    });
    registerSettingTab({
      id: 'ai',
      name: 'AI',
      render: () => <AISettingsTab />,
    });
    registerSettingTab({
      id: 'appearance',
      name: 'Appearance',
      render: () => <AppearanceSettingsTab />,
    });

    const ipcRenderer = window.electron?.ipcRenderer;
    if (ipcRenderer) {
        const removeListener = ipcRenderer.on('menu:open-settings', () => {
            openSettings();
        });
        return () => {
            if (removeListener) removeListener();
        };
    }
    return () => {};
  }, [registerSettingTab, openSettings]);

  // Apply theme to body
  useEffect(() => {
    const theme = settings.theme || 'dark';
    document.body.setAttribute('data-theme', theme);
  }, [settings.theme]);

  const handleFileSelect = useCallback(
    (path: string, data: { content: string; metadata: Record<string, any> }) => {
      const setTabs =
        activeSide === 'left' ? setLeftTabs : setRightTabs;
      const setActivePath =
        activeSide === 'left' ? setLeftActivePath : setRightActivePath;

      setTabs((prev) => {
        if (prev.find((tab) => tab.path === path)) {
          return prev;
        }
        const name = path.split('\\').pop() || 'Untitled';
        return [...prev, { path, name }];
      });
      setTabContents((prev) => {
        return { ...prev, [path]: data };
      });

      setActivePath(path);
    },
    [activeSide],
  );

  const handleTabClick = (side: 'left' | 'right') => (path: string) => {
    setActiveSide(side);
    if (side === 'left') {
      setLeftActivePath(path);
    } else {
      setRightActivePath(path);
    }
  };

  const handleToggleSplit = () => {
    setIsSplit((prev) => {
      const next = !prev;
      if (next) {
        // When splitting, if the right side is empty, clone the current active tab to the right side
        if (rightTabs.length === 0 && leftActivePath) {
          const activeTab = leftTabs.find((t) => t.path === leftActivePath);
          if (activeTab) {
            setRightTabs([activeTab]);
            setRightActivePath(leftActivePath);
          }
        } else if (!rightActivePath && leftActivePath) {
          setRightActivePath(leftActivePath);
        }
      }
      return next;
    });
  };

  const handleOpenPreview = (path: string) => {
    const previewPath = `preview://${path}`;
    const previewName = `Preview: ${path.split('\\').pop() || 'Untitled'}`;
    const setTabs = activeSide === 'left' ? setLeftTabs : setRightTabs;
    const setActivePath = activeSide === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === previewPath)) {
        return prev;
      }
      return [...prev, { path: previewPath, name: previewName }];
    });
    setActivePath(previewPath);
  };

  const handleOpenDiff = (path: string, staged: boolean) => {
    const diffPath = `git-diff://${staged ? 'staged' : 'unstaged'}/${path}`;
    const diffName = `Diff: ${path.split('\\').pop() || 'Untitled'} (${
      staged ? 'Staged' : 'Changes'
    })`;
    const setTabs = activeSide === 'left' ? setLeftTabs : setRightTabs;
    const setActivePath =
      activeSide === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === diffPath)) {
        return prev;
      }
      return [...prev, { path: diffPath, name: diffName }];
    });
    setActivePath(diffPath);
  };

  // Auto-unsplit when one side becomes empty
  useEffect(() => {
    if (isSplit) {
      if (leftTabs.length === 0 && rightTabs.length > 0) {
        // Move right tabs to left if left is empty
        setLeftTabs(rightTabs);
        setLeftActivePath(rightActivePath);
        setRightTabs([]);
        setRightActivePath(null);
        setIsSplit(false);
        setActiveSide('left');
      } else if (rightTabs.length === 0) {
        // Just unsplit if right is empty
        setIsSplit(false);
        setActiveSide('left');
      }
    }
  }, [isSplit, leftTabs, rightTabs, rightActivePath]);

  const handleTabClose = (side: 'left' | 'right') => (path: string) => {
    const setTabs = side === 'left' ? setLeftTabs : setRightTabs;
    const activePath = side === 'left' ? leftActivePath : rightActivePath;
    const setActivePath = side === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.path !== path);

      if (activePath === path) {
        const closedTabIndex = prev.findIndex((tab) => tab.path === path);
        if (newTabs.length > 0) {
          const nextIndex = Math.min(closedTabIndex, newTabs.length - 1);
          setActivePath(newTabs[nextIndex].path);
        } else {
          setActivePath(null);
        }
      }

      return newTabs;
    });

    // Optional: cleanup content memory if closed in BOTH sides
    // (A bit complex, maybe skip for now or check if it exists in the other side)
  };

  const handleContentChange = (path: string | null) => (value: string | undefined) => {
    if (path) {
      setTabContents((prev) => ({
        ...prev,
        [path]: { ...prev[path], content: value || '' },
      }));
      // Mark as dirty in both lists
      setLeftTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );
      setRightTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );
    }
  };

  const handleMetadataChange = useCallback((path: string | null, metadata: Record<string, any>) => {
    if (path) {
      setTabContents((prev) => ({
        ...prev,
        [path]: { ...prev[path], metadata },
      }));
      setLeftTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );
      setRightTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );
    }
  }, []);

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTabPath) {
          try {
            const data = tabContents[activeTabPath];
            await window.electron.ipcRenderer.invoke(
              'fs:saveDocument',
              activeTabPath,
              data,
            );
            // console.log('Saved:', activeTabPath);
            setLeftTabs((prev) =>
              prev.map((tab) =>
                tab.path === activeTabPath ? { ...tab, isDirty: false } : tab,
              ),
            );
            setRightTabs((prev) =>
              prev.map((tab) =>
                tab.path === activeTabPath ? { ...tab, isDirty: false } : tab,
              ),
            );
          } catch (error) {
            // console.error('Save failed:', error);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, tabContents]);

  const getOriginalPath = (path: string | null) =>
    path?.startsWith('preview://') ? path.replace('preview://', '') : path;

  const activeContent = activeTabPath
    ? tabContents[getOriginalPath(activeTabPath) || '']?.content
    : '';

  const renderEditorOrPreview = (side: 'left' | 'right') => {
    const activePath = side === 'left' ? leftActivePath : rightActivePath;

    if (!activePath) {
      return (
        <div className="empty-editor-state">
          <p>Select a file to edit ({side === 'left' ? 'Left' : 'Right'})</p>
        </div>
      );
    }

    if (activePath.startsWith('preview://')) {
      const originalPath = activePath.replace('preview://', '');
      return (
        <NovelPreview content={tabContents[originalPath]?.content || ''} />
      );
    }

    if (activePath.startsWith('git-diff://')) {
      const parts = activePath.replace('git-diff://', '').split('/');
      const staged = parts[0] === 'staged';
      const filePath = parts.slice(1).join('/');
      return <DiffViewer path={filePath} staged={staged} />;
    }

    const data = tabContents[activePath];
    if (!data) {
      return (
        <div className="loading-editor">
          <p>読み込み中...</p>
        </div>
      );
    }

    return (
      <CodeEditor
        key={`${side}-${activePath}`}
        value={data.content}
        onChange={handleContentChange(activePath)}
        onFocus={() => setActiveSide(side)}
      />
    );
  };

  return (
    <div className="layout-wrapper">
      <div className="main-layout">
        <div
          style={{
            width: `${leftDisplayWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <LeftPane
            onFileSelect={handleFileSelect}
            onProjectOpened={(path) => loadProjectSettings(path)}
            onOpenDiff={handleOpenDiff}
          />
        </div>
        {!isLeftPaneNarrow && <Resizer onResize={handleLeftResize} />}

        <div className="editor-area">
          <div
            className="editors-container"
            style={{
              display: 'flex',
              flex: 1,
              width: '100%',
              height: '100%',
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              className={`editor-group ${activeSide === 'left' ? 'active' : ''}`}
              style={{
                flex: isSplit ? `${editorSplitRatio} 1 0%` : '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
              onFocus={() => setActiveSide('left')}
              onClick={() => setActiveSide('left')}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setActiveSide('left');
                }
              }}
              role="region"
              aria-label="Left Editor Group"
              tabIndex={0}
            >
              <TabBar
                tabs={leftTabs}
                activeTabPath={leftActivePath}
                onTabClick={handleTabClick('left')}
                onTabClose={handleTabClose('left')}
                onToggleSplit={handleToggleSplit}
                isSplit={isSplit}
                onOpenPreview={handleOpenPreview}
              />
              <div className="editor-pane">{renderEditorOrPreview('left')}</div>
            </div>

            {isSplit && (
              <>
                <Resizer onResize={handleEditorSplitResize} />
                <div
                  className={`editor-group ${activeSide === 'right' ? 'active' : ''}`}
                  style={{
                    flex: `${1 - editorSplitRatio} 1 0%`,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                  onFocus={() => setActiveSide('right')}
                  onClick={() => setActiveSide('right')}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setActiveSide('right');
                    }
                  }}
                  role="region"
                  aria-label="Right Editor Group"
                  tabIndex={0}
                >
                  <TabBar
                    tabs={rightTabs}
                    activeTabPath={rightActivePath}
                    onTabClick={handleTabClick('right')}
                    onTabClose={handleTabClose('right')}
                    onToggleSplit={handleToggleSplit}
                    isSplit={isSplit}
                    onOpenPreview={handleOpenPreview}
                  />
                  <div className="editor-pane">
                    {renderEditorOrPreview('right')}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {!isRightPaneNarrow && <Resizer onResize={handleRightResize} />}
        <div
          style={{
            width: `${rightDisplayWidth}px`,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            overflow: 'hidden',
          }}
        >
          <RightPane
            activeContent={activeContent}
            activePath={activeTabPath}
            metadata={activeTabPath ? tabContents[activeTabPath]?.metadata : undefined}
            onMetadataChange={(metadata) => handleMetadataChange(activeTabPath, metadata)}
          />
        </div>
      </div>
      <StatusBar
        metrics={CharCounter.getMetrics(
          activeTabPath && !activeTabPath.startsWith('preview://')
            ? tabContents[activeTabPath]?.content || ''
            : '',
          activeTabPath
        )}
        activePath={getOriginalPath(activeTabPath)}
        openSettings={openSettings}
        onGoHome={() => navigate('/')}
        onToggleLeftPane={handleToggleLeftPane}
        onToggleRightPane={handleToggleRightPane}
        isLeftPaneVisible={!isLeftPaneNarrow}
        isRightPaneVisible={!isRightPaneNarrow}
      />
      <SettingsModal />
    </div>
  );
}
