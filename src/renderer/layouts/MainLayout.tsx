import React, { useState, useCallback } from 'react';
import { FileExplorer } from '../components/Sidebar/FileExplorer';
import { CodeEditor } from '../components/Editor/CodeEditor';
import { TabBar, Tab } from '../components/TabBar/TabBar';
import './MainLayout.css';

export const MainLayout = () => {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabPath, setActiveTabPath] = useState<string | null>(null);
  const [tabContents, setTabContents] = useState<Record<string, string>>({});

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
          tab.path === activeTabPath ? { ...tab, isDirty: true } : tab
        )
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
            await window.electron.ipcRenderer.invoke('fs:writeFile', activeTabPath, content);
            console.log('Saved:', activeTabPath);
            setTabs((prev) =>
                prev.map((tab) =>
                  tab.path === activeTabPath ? { ...tab, isDirty: false } : tab
                )
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
    <div className="main-layout">
      <FileExplorer onFileSelect={handleFileSelect} />
      <div className="editor-area">
        <TabBar
            tabs={tabs}
            activeTabPath={activeTabPath}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
        />
        {activeTabPath ? (
            <CodeEditor
                key={activeTabPath} // Force re-mount or at least ensure clean update when switching files?
                // Actually Monaco controls value well if just value prop changes, but key helps ensure completely fresh state if needed.
                // However, preserving scroll position might be desired. Providing key resets state.
                // Let's try without key first if we want to preserve internal editor state (like undo history?)
                // Monaco instance is shared if component stays.
                // Undo stack is usually per model.
                // For a simple implementation, adding `path` prop to CodeEditor to handle model creation might be better,
                // but effectively `value` update works for simple cases.
                value={activeContent}
                onChange={handleContentChange}
            />
        ) : (
            <div className="empty-editor-state">
                <p>Select a file to edit</p>
            </div>
        )}
      </div>
    </div>
  );
};
