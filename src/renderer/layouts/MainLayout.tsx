import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CodeEditor from '../components/Editor/CodeEditor';
import { TabBar, Tab } from '../components/TabBar/TabBar';
import { SettingsModal } from '../components/Settings/SettingsModal';
import { useSettings } from '../contexts/SettingsContext';
import EditorSettingsTab from '../components/Settings/Tabs/EditorSettingsTab';
import AISettingsTab from '../components/Settings/Tabs/AISettingsTab';
import { AppearanceSettingsTab } from '../components/Settings/Tabs/AppearanceSettingsTab';
import { CalibrationSettingsTab } from '../components/Settings/Tabs/CalibrationSettingsTab';
import { RightPane } from '../components/RightPane/RightPane';
import Resizer from '../components/Common/Resizer';
import { StatusBar } from '../components/Common/StatusBar';
import { CharCounter } from '../utils/CharCounter';
import NovelPreview from '../components/Preview/NovelPreview';
import MarkdownPreview from '../components/Preview/MarkdownPreview';
import DiffViewer from '../components/Git/DiffViewer';
import { usePanel } from '../contexts/PanelContext';
import WebBrowser from '../components/Common/WebBrowser';
import { FileNameHeader } from '../components/Editor/FileNameHeader';
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
    Record<
      string,
      {
        content: string;
        metadata: Record<string, any>;
        lastSource?: 'user' | 'external';
        initialLine?: number;
        initialColumn?: number;
        searchQuery?: string;
        language?: string;
      }
    >
  >({});
  const navigate = useNavigate();
  const {
    settings,
    updateSettings,
    openSettings,
    registerSettingTab,
    loadProjectSettings,
    projectPath,
  } = useSettings();

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
  const savingPaths = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<Record<string, NodeJS.Timeout>>({});
  const restoredRef = useRef<string | null>(null);

  // Restore open files from settings
  useEffect(() => {
    if (
      !projectPath ||
      !settings.lastOpenFiles ||
      restoredRef.current === projectPath
    ) {
      return;
    }

    const restore = async () => {
      const previousProject = restoredRef.current;
      restoredRef.current = projectPath;

      // If switching to a NEW project, clear current tabs first
      if (previousProject && previousProject !== projectPath) {
        setLeftTabs([]);
        setRightTabs([]);
        setLeftActivePath(null);
        setRightActivePath(null);
        setTabContents({});
      }

      const {
        left,
        right,
        leftActive,
        rightActive,
        isSplit: savedSplit,
        activeSide: savedSide,
      } = settings.lastOpenFiles!;

      if (savedSplit !== undefined) setIsSplit(savedSplit);
      if (savedSide !== undefined) setActiveSide(savedSide);

      const restoreFiles = async (files: { path: string; name: string }[]) => {
        const results = await Promise.all(
          files.map(async (t) => {
            try {
              const data = await window.electron.ipcRenderer.invoke(
                'fs:readDocument',
                t.path,
              );
              return { path: t.path, name: t.name, data };
            } catch (e) {
              // eslint-disable-next-line no-console
              console.error(`Failed to restore ${t.path}`, e);
              return null;
            }
          }),
        );
        return results.filter(
          (r): r is { path: string; name: string; data: any } => r !== null,
        );
      };

      const [leftResults, rightResults] = await Promise.all([
        restoreFiles(left),
        restoreFiles(right),
      ]);

      const contentsUpdate: any = {};
      [...leftResults, ...rightResults].forEach((r) => {
        contentsUpdate[r.path] = { ...r.data, lastSource: 'external' };
      });

      setTabContents((prevContent) => ({ ...prevContent, ...contentsUpdate }));

      if (leftResults.length > 0) {
        setLeftTabs(
          leftResults.map((r) => ({
            name: r.name,
            path: r.path,
            isDirty: false,
          })),
        );
        if (leftActive) setLeftActivePath(leftActive);
      }

      if (rightResults.length > 0) {
        setRightTabs(
          rightResults.map((r) => ({
            name: r.name,
            path: r.path,
            isDirty: false,
          })),
        );
        if (rightActive) setRightActivePath(rightActive);
      }
    };

    restore();
  }, [projectPath, settings.lastOpenFiles]);

  // Persist open files to settings
  useEffect(() => {
    // Only save if we have finished restoring for the current project
    if (!projectPath || restoredRef.current !== projectPath) return;

    const lastOpenFiles = {
      left: leftTabs.map((t) => ({ path: t.path, name: t.name })),
      right: rightTabs.map((t) => ({ path: t.path, name: t.name })),
      leftActive: leftActivePath,
      rightActive: rightActivePath,
      activeSide,
      isSplit,
    };

    // Deep compare to avoid unnecessary writes
    const currentSerialized = JSON.stringify(lastOpenFiles);
    const savedSerialized = JSON.stringify(settings.lastOpenFiles);

    if (currentSerialized !== savedSerialized) {
      updateSettings({ lastOpenFiles });
    }
  }, [
    leftTabs,
    rightTabs,
    leftActivePath,
    rightActivePath,
    activeSide,
    isSplit,
    projectPath,
    updateSettings,
    settings.lastOpenFiles,
  ]);

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


  // Refs for accessing latest state in callbacks without re-subscribing
  const tabsRef = useRef({ left: leftTabs, right: rightTabs });
  const tabContentsRef = useRef(tabContents);

  useEffect(() => {
    tabsRef.current = { left: leftTabs, right: rightTabs };
  }, [leftTabs, rightTabs]);

  useEffect(() => {
    tabContentsRef.current = tabContents;
  }, [tabContents]);

  // Handle external file changes
  useEffect(() => {
    const cleanup = window.electron.fs.onFileChange(async ({ event, path }) => {
      console.log(`[MainLayout] FS Event: ${event} ${path}`);
      const { left: currentLeftTabs, right: currentRightTabs } = tabsRef.current;
      const currentTabContents = tabContentsRef.current;

      if (event === 'change') {
        const findTab = (tabs: Tab[]) => tabs.find((t) => t.path === path);
        const lTab = findTab(currentLeftTabs);
        const rTab = findTab(currentRightTabs);
        const targetTab = lTab || rTab;

        if (targetTab) {
          if (savingPaths.current.has(path)) {
            console.log(`[MainLayout] Ignoring self-save: ${path}`);
            return;
          }

          // Check against the latest content implementation if possible,
          // but relying on isDirty from refs is safer.
          // Note: isDirty might be true if user typed but haven't saved.
          if (targetTab.isDirty) {
              // Confirm dialog ...
             const confirmed = await window.electron.ipcRenderer.invoke(
              'dialog:confirm',
              `${targetTab.name} は外部で変更されました。ローカルの変更を破棄して再読み込みしますか？`,
            );
            if (!confirmed) return;
          }

          try {
            const data = await window.electron.ipcRenderer.invoke(
              'fs:readDocument',
              path,
            );

            // Note: We need to use function updates for state setters to ensure we don't clobber other concurrent updates,
            // even though we are inside an event handler.
            setTabContents((prev) => ({ ...prev, [path]: data }));

            // Mark as not dirty
            setLeftTabs((prev) =>
              prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
            );
            setRightTabs((prev) =>
              prev.map((t) => (t.path === path ? { ...t, isDirty: false } : t)),
            );
          } catch (err) {
            console.error('Failed to reload file', err);
          }
        }
      } else if (event === 'unlink') {
        // Handle file deletion
        setLeftTabs((prev) => prev.filter((t) => t.path !== path));
        setRightTabs((prev) => prev.filter((t) => t.path !== path));
        setTabContents((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
      }
    });

    return () => {
      cleanup();
    };
  }, []); // Run once on mount

  // Apply theme to body
  useEffect(() => {
    const theme = settings.theme || 'dark';
    document.body.setAttribute('data-theme', theme);
  }, [settings.theme]);

  const handleFileSelect = useCallback(
    (path: string, data: { content: string; metadata: Record<string, any> }) => {
      const fileName =
        path.split('\\').pop() || path.split('/').pop() || 'Untitled';

      setTabContents((prev) => ({
        ...prev,
        [path]: { ...data, lastSource: 'external' }, // Initial load is external
      }));

      // Check where to open
      if (activeSide === 'left') {
        setLeftTabs((prev) => {
          if (prev.find((t) => t.path === path)) return prev;
          return [...prev, { name: fileName, path, isDirty: false }];
        });
        setLeftActivePath(path);
      } else {
        setRightTabs((prev) => {
          if (prev.find((t) => t.path === path)) return prev;
          return [...prev, { name: fileName, path, isDirty: false }];
        });
        setRightActivePath(path);
      }
    },
    [activeSide],
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
    registerSettingTab({
      id: 'calibration',
      name: '校正',
      render: () => <CalibrationSettingsTab />,
    });
    registerSettingTab({
      id: 'appearance',
      name: 'Appearance',
      render: () => <AppearanceSettingsTab />,
    });

    const ipcRenderer = window.electron?.ipcRenderer;
    if (ipcRenderer) {
      const removeSettingsListener = ipcRenderer.on('menu:open-settings', () => {
        openSettings();
      });
      const removeOpenListener = ipcRenderer.on('app:open-file', async (path: any) => {
        try {
          const data = await window.electron.ipcRenderer.invoke(
            'fs:readDocument',
            path,
          );
          handleFileSelect(path, data);
        } catch (error) {
          console.error('Failed to open file via app:open-file:', error);
        }
      });
      return () => {
        if (removeSettingsListener) removeSettingsListener();
        if (removeOpenListener) removeOpenListener();
      };
    }
    return () => {};
  }, [registerSettingTab, openSettings, handleFileSelect]);

  const handleTabClick = useCallback(
    (side: 'left' | 'right') => (path: string) => {
      setActiveSide(side);
      if (side === 'left') {
        setLeftActivePath(path);
      } else {
        setRightActivePath(path);
      }
    },
    [],
  );

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

  // 指定ファイル用のプレビュー画面を開きます
  const handleOpenPreview = (path: string) => {
    const previewPath = `preview://${path}`;
    const previewName = `Preview: ${path.split('\\').pop() || 'Untitled'}`;

    // プレビュー画面は元となるファイルの逆側に開く事で同時に閲覧可能とします。
    const setTabs = activeSide === 'left' ? setRightTabs : setLeftTabs;
    const setActivePath =
      activeSide === 'left' ? setRightActivePath : setLeftActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === previewPath)) {
        return prev;
      }
      return [
        ...prev,
        { path: previewPath, name: previewName, isDirty: false },
      ];
    });
    setActivePath(previewPath);
    // 分割画面を表示します
    setIsSplit(true);
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
      return [...prev, { path: diffPath, name: diffName, isDirty: false }];
    });
    setActivePath(diffPath);
  };

  // 投稿用に指定URL用のブラウザ画面を開きます
  const handleOpenWebBrowser = (url: string, title: string) => {
    const webPath = `web-browser://${url}`;
    const webName = `Web: ${title}`;

    // ブラウザ画面は投稿、参照用であるためファイルの逆側に開く事で同時に閲覧可能とします。
    const setTabs = activeSide === 'left' ? setRightTabs : setLeftTabs;
    const setActivePath =
      activeSide === 'left' ? setRightActivePath : setLeftActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === webPath)) {
        return prev;
      }
      return [...prev, { path: webPath, name: webName, isDirty: false }];
    });
    setActivePath(webPath);

    // 分割画面を表示します
    setIsSplit(true);
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

  const handleTabClose = useCallback(
    (side: 'left' | 'right') => (path: string) => {
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

        // If the path is not open in the other pane, clear content
        const otherTabs = side === 'left' ? tabsRef.current.right : tabsRef.current.left;
        if (!otherTabs.find((t) => t.path === path)) {
             setTabContents((prevContents) => {
                const newContents = { ...prevContents };
                delete newContents[path];
                return newContents;
             });
        }

        return newTabs;
      });
    },
    [leftActivePath, rightActivePath],
  );

  const handleSaveByPath = useCallback(async (path: string) => {
    const data = tabContentsRef.current[path];
    if (!path || !data) return;

    try {
      console.log(`[MainLayout] Saving ${path}...`);
      savingPaths.current.add(path);
      await window.electron.ipcRenderer.invoke('fs:saveDocument', path, data);

      // Update dirty state
      const updateClean = (tabs: Tab[]) =>
        tabs.map((tab) => (tab.path === path ? { ...tab, isDirty: false } : tab));

      setLeftTabs(updateClean);
      setRightTabs(updateClean);

      // Wait a bit to ensure watcher event is ignored
      setTimeout(() => {
        savingPaths.current.delete(path);
      }, 500);

      // If the rules file was saved, reload rules in CalibrationService
      if (path.endsWith('kanji-rules.txt')) {
        await window.electron.calibration.reloadRules();
      }
    } catch (err) {
      console.error(err);
      savingPaths.current.delete(path);
    }
  }, []);

  const triggerAutoSave = useCallback(
    (path: string) => {
      if (autoSaveTimerRef.current[path]) {
        clearTimeout(autoSaveTimerRef.current[path]);
      }
      autoSaveTimerRef.current[path] = setTimeout(() => {
        handleSaveByPath(path);
        delete autoSaveTimerRef.current[path];
      }, 3000); // 3 seconds idle
    },
    [handleSaveByPath],
  );

  const handleContentChange = (path: string | null) => (value: string | undefined) => {
    if (path) {
      setTabContents((prev) => ({
        ...prev,
        [path]: { ...prev[path], content: value || '', lastSource: 'user' }, // Mark as user
      }));
      // Mark as dirty in both lists
      setLeftTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );
      setRightTabs((prev) =>
        prev.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab)),
      );

      triggerAutoSave(path);
    }
  };

  const handleMetadataChange = useCallback(
    (path: string | null, metadata: Record<string, any>) => {
      if (path) {
        setTabContents((prev) => ({
          ...prev,
          [path]: {
            ...prev[path],
            metadata: { ...prev[path]?.metadata, ...metadata },
          }, // Keep lastSource
        }));
        setLeftTabs((prev) =>
          prev.map((tab) =>
            tab.path === path ? { ...tab, isDirty: true } : tab,
          ),
        );
        setRightTabs((prev) =>
          prev.map((tab) =>
            tab.path === path ? { ...tab, isDirty: true } : tab,
          ),
        );

        triggerAutoSave(path);
      }
    },
    [],
  );

  const handleSave = useCallback(async () => {
    if (!activeTabPath) return;
    // Clear any pending auto-save for this path
    if (autoSaveTimerRef.current[activeTabPath]) {
      clearTimeout(autoSaveTimerRef.current[activeTabPath]);
      delete autoSaveTimerRef.current[activeTabPath];
    }
    await handleSaveByPath(activeTabPath);
  }, [activeTabPath, handleSaveByPath]);

  React.useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

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
          <p>ファイルを選択してください</p>
        </div>
      );
    }

    if (activePath.startsWith('preview://')) {
      const originalPath = activePath.replace('preview://', '');
      const data = tabContents[originalPath];
      if (data?.language === 'markdown') {
        return <MarkdownPreview content={data.content || ''} />;
      }
      return (
        <NovelPreview content={data?.content || ''} />
      );
    }

    if (activePath.startsWith('git-diff://')) {
      const parts = activePath.replace('git-diff://', '').split('/');
      const staged = parts[0] === 'staged';
      const filePath = parts.slice(1).join('/');
      return <DiffViewer path={filePath} staged={staged} />;
    }

    if (activePath.startsWith('web-browser://')) {
      const url = activePath.replace('web-browser://', '');
      return <WebBrowser initialUrl={url} />;
    }

    const data = tabContents[activePath];
    if (!data) {
      return (
        <div className="loading-editor">
          <p>読み込み中...</p>
        </div>
      );
    }

    if (data.language === 'image') {

      const normalized = activePath.replace(/\\/g, '/');
      const encodedPath = normalized
        .split('/')
        .map((segment: string) => encodeURIComponent(segment))
        .join('/');
      const src = `nvfs://local/${encodedPath}`;

      return (

        <div
          className="image-viewer-container"
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100%',
            overflow: 'auto',
            backgroundColor: 'var(--vscode-editor-background, #1e1e1e)',
          }}
        >
          <img
            src={src}
            alt={activePath}
            style={{
              maxWidth: '100%',
              maxHeight: '100%',
              objectFit: 'contain',
            }}
          />
        </div>
      );
    }



    // Extract filename and extension for header
    const fileNameWithExt = activePath.split('\\').pop() || '';
    const lastDotIndex = fileNameWithExt.lastIndexOf('.');
    const fileName = lastDotIndex !== -1 ? fileNameWithExt.substring(0, lastDotIndex) : fileNameWithExt;
    const fileExt = lastDotIndex !== -1 ? fileNameWithExt.substring(lastDotIndex) : '';

    const handleRename = async (newName: string) => {
        if (!newName || newName === fileName) return;

        const dir = activePath.substring(0, activePath.lastIndexOf('\\'));
        const newPath = `${dir}\\${newName}${fileExt}`;

        try {
            await window.electron.ipcRenderer.invoke('fs:rename', activePath, newPath);
            // The file watcher or onFileChange might handle the update,
            // but we should probably update local state optimistically or wait for event.
            // Actually, `fs:rename` usually triggers `unlink` (old) and `add` (new) events from watcher.
            // But we want to keep the tab open and just update its path.

            // Let's update the tab state directly to reflect the new path immediately

            const updateTabs = (tabs: Tab[]) => tabs.map(t => t.path === activePath ? { ...t, path: newPath, name: `${newName}${fileExt}` } : t);

            setLeftTabs(prev => updateTabs(prev));
            setRightTabs(prev => updateTabs(prev));

            if (leftActivePath === activePath) setLeftActivePath(newPath);
            if (rightActivePath === activePath) setRightActivePath(newPath);

            setTabContents(prev => {
                const newContents = { ...prev };
                newContents[newPath] = newContents[activePath];
                delete newContents[activePath];
                return newContents;
            });

        } catch (error) {
            console.error('Failed to rename file:', error);
            // Show error notification?
        }
    };

    const handleNavigated = () => {
        // Clear navigation props to prevent re-triggering on remount/updates
        setTabContents((current) => {
            const currentTab = current[activePath];
            if (!currentTab) return current;

            // Create a new object without the navigation props
            const { initialLine, initialColumn, searchQuery, ...rest } = currentTab as any;
            return {
                ...current,
                [activePath]: { ...rest }
            };
        });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
          <FileNameHeader
            fileName={fileName}
            onRename={handleRename}
          />
          <CodeEditor
            key={`${side}-${activePath}`}
            value={data.content}
            language={data.language}
            lastSource={data.lastSource}
            onChange={handleContentChange(activePath)}
            onFocus={() => setActiveSide(side)}
            onBlur={() => handleSaveByPath(activePath)}
            initialLine={(data as any).initialLine}
            initialColumn={(data as any).initialColumn}
            searchQuery={(data as any).searchQuery}
            onNavigated={handleNavigated}
          />
      </div>
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
            onOpenWebBrowser={handleOpenWebBrowser}
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
            onFileSelect={handleFileSelect}
            activeContent={activeContent}
            activePath={activeTabPath}
            metadata={activeTabPath ? tabContents[activeTabPath]?.metadata : undefined}
            onMetadataChange={(metadata) => handleMetadataChange(activeTabPath, metadata)}
            onOpenWebBrowser={handleOpenWebBrowser}
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
