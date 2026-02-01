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
import './MainLayout.css';

export function MainLayout() {
  const [tabs, setTabs] = useState<Tab[]>([]);
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

      if (activeSide === 'left') {
        setLeftActivePath(path);
      } else {
        setRightActivePath(path);
      }
    },
    [activeSide],
  );

  const handleTabClick = (path: string) => {
    if (activeSide === 'left') {
      setLeftActivePath(path);
    } else {
      setRightActivePath(path);
    }
  };

  const handleToggleSplit = () => {
    setIsSplit((prev) => {
      const next = !prev;
      if (next && !rightActivePath) {
        setRightActivePath(leftActivePath);
      }
      return next;
    });
  };

  const handleTabClose = (path: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.path !== path);

      // Handle left active path
      if (leftActivePath === path) {
        const closedTabIndex = prev.findIndex((tab) => tab.path === path);
        if (newTabs.length > 0) {
          const nextIndex = Math.min(closedTabIndex, newTabs.length - 1);
          setLeftActivePath(newTabs[nextIndex].path);
        } else {
          setLeftActivePath(null);
        }
      }

      // Handle right active path
      if (rightActivePath === path) {
        const closedTabIndex = prev.findIndex((tab) => tab.path === path);
        if (newTabs.length > 0) {
          const nextIndex = Math.min(closedTabIndex, newTabs.length - 1);
          setRightActivePath(newTabs[nextIndex].path);
        } else {
          setRightActivePath(null);
        }
      }

      return newTabs;
    });
    // Optional: cleanup content memory if closed
    setTabContents((prev) => {
      const newContents = { ...prev };
      delete newContents[path];
      return newContents;
    });
  };

  const handleContentChange = (path: string | null) => (value: string | undefined) => {
    if (path) {
      setTabContents((prev) => ({
        ...prev,
        [path]: value || '',
      }));
      // Mark as dirty
      setTabs((prev) =>
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
            console.log('Saved:', activeTabPath);
            setTabs((prev) =>
              prev.map((tab) =>
                tab.path === activeTabPath ? { ...tab, isDirty: false } : tab,
              ),
            );
          } catch (error) {
            console.error('Save failed:', error);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabPath, tabContents]);

  const leftContent = leftActivePath ? tabContents[leftActivePath] : '';
  const rightContent = rightActivePath ? tabContents[rightActivePath] : '';
  const activeContent = activeTabPath ? tabContents[activeTabPath] : '';

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
          <TabBar
            tabs={tabs}
            activeTabPath={activeTabPath}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onToggleLeftPane={toggleLeftPane}
            onToggleRightPane={toggleRightPane}
            onToggleSplit={handleToggleSplit}
            isLeftPaneVisible={isLeftPaneVisible}
            isRightPaneVisible={isRightPaneVisible}
            isSplit={isSplit}
          />
          <div
            className="editors-container"
            style={{
              display: 'flex',
              flex: 1,
              overflow: 'hidden',
              position: 'relative',
            }}
          >
            <div
              className={`editor-pane ${activeSide === 'left' ? 'active' : ''}`}
              style={{
                flex: isSplit ? `${editorSplitRatio} 1 0%` : '1 1 0%',
                display: 'flex',
                flexDirection: 'column',
                minWidth: 0,
              }}
              onFocus={() => setActiveSide('left')}
              onClick={() => setActiveSide('left')}
            >
              {leftActivePath ? (
                <CodeEditor
                  key={`left-${leftActivePath}`}
                  value={leftContent}
                  onChange={handleContentChange(leftActivePath)}
                  onFocus={() => setActiveSide('left')}
                />
              ) : (
                <div className="empty-editor-state">
                  <p>Select a file to edit (Left)</p>
                </div>
              )}
            </div>

            {isSplit && (
              <>
                <Resizer onResize={handleEditorSplitResize} />
                <div
                  className={`editor-pane ${activeSide === 'right' ? 'active' : ''}`}
                  style={{
                    flex: `${1 - editorSplitRatio} 1 0%`,
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                  }}
                  onFocus={() => setActiveSide('right')}
                  onClick={() => setActiveSide('right')}
                >
                  {rightActivePath ? (
                    <CodeEditor
                      key={`right-${rightActivePath}`}
                      value={rightContent}
                      onChange={handleContentChange(rightActivePath)}
                      onFocus={() => setActiveSide('right')}
                    />
                  ) : (
                    <div className="empty-editor-state">
                      <p>Select a file to edit (Right)</p>
                    </div>
                  )}
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
        metrics={CharCounter.getMetrics(activeContent, activeTabPath)}
        activePath={activeTabPath}
      />
      <SettingsModal />
    </div>
  );
}
