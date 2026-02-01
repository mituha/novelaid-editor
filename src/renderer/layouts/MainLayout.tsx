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
import './MainLayout.css';

export function MainLayout() {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});
  const { openSettings, registerSettingTab, loadProjectSettings } =
    useSettings();

  const [leftPaneWidth, setLeftPaneWidth] = useState(250);
  const [rightPaneWidth, setRightPaneWidth] = useState(300);
  const [isLeftPaneVisible, setIsLeftPaneVisible] = useState(true);
  const [isRightPaneVisible, setIsRightPaneVisible] = useState(true);

  const handleLeftResize = useCallback((delta: number) => {
    setLeftPaneWidth((prev) => Math.max(150, Math.min(600, prev + delta)));
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

  const handleFileSelect = useCallback((path: string, content: string) => {
    setTabs((prev) => {
      if (prev.find((tab) => tab.path === path)) {
        return prev;
      }
      const name = path.split('\\').pop() || 'Untitled';
      return [...prev, { path, name }];
    });
    setTabContents((prev) => {
      // Only set content if we don't have it (or to update it on open, but here we assume open means read from disk)
      // If we want to keep unsaved changes, we should be careful.
      // For now, simple approach: Always update content on file select (re-read) if not dirty?
      // But handleFileSelect usually comes from reading file.
      return { ...prev, [path]: content };
    });
    setActiveTabPath(path);
  }, []);

  const handleTabClick = (path: string) => {
    setActiveTabPath(path);
  };

  const handleTabClose = (path: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((tab) => tab.path !== path);
      if (activeTabPath === path) {
        // If closing active tab, switch to the last one or null
        const closedTabIndex = prev.findIndex((tab) => tab.path === path);
        // Try to go to the left tab, or the new first tab, or null
        if (newTabs.length > 0) {
          // If we closed the last tab, go to previous last.
          // If we closed a middle tab, stay at same index (which is now next tab) or go back?
          // VSCode usually goes to most recently used, but simplistic approach:
          // Go to the tab that took the place of closed one, or the one before it.
          const nextIndex = Math.min(closedTabIndex, newTabs.length - 1);
          setActiveTabPath(newTabs[nextIndex].path);
        } else {
          setActiveTabPath(null);
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

  const handleContentChange = (value: string | undefined) => {
    if (activeTabPath) {
      setTabContents((prev) => ({
        ...prev,
        [activeTabPath]: value || '',
      }));
      // Mark as dirty
      setTabs((prev) =>
        prev.map((tab) =>
          tab.path === activeTabPath ? { ...tab, isDirty: true } : tab,
        ),
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
            isLeftPaneVisible={isLeftPaneVisible}
            isRightPaneVisible={isRightPaneVisible}
          />
          {activeTabPath ? (
            <CodeEditor
              key={activeTabPath}
              value={activeContent}
              onChange={handleContentChange}
            />
          ) : (
            <div className="empty-editor-state">
              <p>Select a file to edit</p>
            </div>
          )}
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
        charCount={activeContent.length}
        activePath={activeTabPath}
      />
      <SettingsModal />
    </div>
  );
}
