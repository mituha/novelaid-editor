import React, { useState, useCallback, useEffect } from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { FileExplorer } from '../components/Sidebar/FileExplorer';
import { CodeEditor } from '../components/Editor/CodeEditor';
import { TabBar, Tab } from '../components/TabBar/TabBar';
import { SettingsModal } from '../components/Settings/SettingsModal';
import { useSettings } from '../contexts/SettingsContext';
import { EditorSettingsTab } from '../components/Settings/Tabs/EditorSettingsTab';
import { AISettingsTab } from '../components/Settings/Tabs/AISettingsTab';
import { RightPane } from '../components/RightPane/RightPane';
import { Resizer } from '../components/Common/Resizer';
import { StatusBar } from '../components/Common/StatusBar';
import { CharCounter } from '../utils/CharCounter';
import NovelPreview from '../components/Preview/NovelPreview';
import './MainLayout.css';

export default function MainLayout() {
  const [leftTabs, setLeftTabs] = useState<Tab[]>([]);
  const [rightTabs, setRightTabs] = useState<Tab[]>([]);
  const [leftActivePath, setLeftActivePath] = useState<string | null>(null);
  const [rightActivePath, setRightActivePath] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [isSplit, setIsSplit] = useState(false);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const { openSettings, registerSettingTab, loadProjectSettings } =
    useSettings();

  const [leftPaneWidth, setLeftPaneWidth] = useState(250);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [editorSplitRatio, setEditorSplitRatio] = useState(0.5);
  const [isLeftPaneVisible, setIsLeftPaneVisible] = useState(true);
  const [isRightPaneVisible, setIsRightPaneVisible] = useState(true);

  const activeTabPath = activeSide === 'left' ? leftActivePath : rightActivePath;

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPaneWidth((prev) => Math.max(150, Math.min(600, prev + delta)));
  }, []);

  const handleEditorSplitResize = useCallback((delta: number) => {
    // We need to account for the actual width of the editors container to make ratio-based resize accurate.
    // For now, using a slightly better multiplier.
    setEditorSplitRatio((prev) => Math.max(0.1, Math.min(0.9, prev + delta / 800)));
  }, []);

  const handleRightResize = useCallback((delta: number) => {
    setRightPaneWidth((prev) => Math.max(200, Math.min(600, prev - delta))); // Negative delta because resizing from left edge
  }, []);

  const toggleLeftPane = useCallback(
    () => setIsLeftPaneVisible((prev) => !prev),
    [],
  );
  const toggleRightPane = useCallback(
    () => setIsRightPaneVisible((prev) => !prev),
    [],
  );

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
  }, [registerSettingTab]);

  const handleFileSelect = useCallback(
    (path: string, content: string) => {
      const setTabs = activeSide === 'left' ? setLeftTabs : setRightTabs;
      const setActivePath = activeSide === 'left' ? setLeftActivePath : setRightActivePath;

      setTabs((prev) => {
        if (prev.find((tab) => tab.path === path)) {
          return prev;
        }
        const name = path.split('\\').pop() || 'Untitled';
        return [...prev, { path, name }];
      });
      setTabContents((prev) => {
        return { ...prev, [path]: content };
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
        [path]: value || '',
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

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        if (activeTabPath) {
          try {
            const content = tabContents[activeTabPath];
            await window.electron.ipcRenderer.invoke(
              'fs:writeFile',
              activeTabPath,
              content,
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
    ? tabContents[getOriginalPath(activeTabPath) || '']
    : '';

  const renderEditorOrPreview = (side: 'left' | 'right') => {
    const activePath = side === 'left' ? leftActivePath : rightActivePath;
    const content = activePath ? tabContents[activePath] : '';

    if (!activePath) {
      return (
        <div className="empty-editor-state">
          <p>Select a file to edit ({side === 'left' ? 'Left' : 'Right'})</p>
        </div>
      );
    }

    if (activePath.startsWith('preview://')) {
      const originalPath = activePath.replace('preview://', '');
      return <NovelPreview content={tabContents[originalPath] || ''} />;
    }

    return (
      <CodeEditor
        key={`${side}-${activePath}`}
        value={content}
        onChange={handleContentChange(activePath)}
        onFocus={() => setActiveSide(side)}
      />
    );
  };

  return (
    <div className="layout-wrapper">
      <div className="main-layout">
        {isLeftPaneVisible && (
          <div
            className="sidebar-container"
            style={{
              display: 'flex',
              flexDirection: 'column',
              width: `${leftPaneWidth}px`,
              backgroundColor: '#252526',
              borderRight: '1px solid #333',
            }}
          >
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <FileExplorer
                onFileSelect={handleFileSelect}
                onProjectOpened={loadProjectSettings}
              />
            </div>
            <div
              className="sidebar-footer"
              style={{
                padding: '10px',
                borderTop: '1px solid #333',
                display: 'flex',
                justifyContent: 'flex-end',
              }}
            >
              <button
                type="button"
                onClick={openSettings}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ccc',
                  cursor: 'pointer',
                }}
                title="Settings"
              >
                <SettingsIcon size={20} />
              </button>
            </div>
          </div>
        )}
        {isLeftPaneVisible && <Resizer onResize={handleLeftResize} />}

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
                onToggleLeftPane={toggleLeftPane}
                isLeftPaneVisible={isLeftPaneVisible}
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
                    onToggleRightPane={toggleRightPane}
                    isRightPaneVisible={isRightPaneVisible}
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

        {isRightPaneVisible && <Resizer onResize={handleRightResize} />}
        {isRightPaneVisible && (
          <div
            style={{
              width: `${rightPaneWidth}px`,
              display: 'flex',
              flexDirection: 'column',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <RightPane
              activeContent={activeContent}
              activePath={activeTabPath}
            />
          </div>
        )}
      </div>
      <StatusBar
        metrics={CharCounter.getMetrics(
          activeContent,
          getOriginalPath(activeTabPath),
        )}
        activePath={getOriginalPath(activeTabPath)}
      />
      <SettingsModal />
    </div>
  );
}
