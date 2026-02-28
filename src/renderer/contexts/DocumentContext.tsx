import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Tab } from '../components/TabBar/TabBar';
import { useSettings } from './SettingsContext';
import { DocumentType, DocumentViewType } from '../../common/types';

export interface DocumentData {
  content: string;
  metadata: Record<string, any>;
  lastSource?: 'user' | 'external' | 'user-left' | 'user-right' | string;
  initialLine?: number;
  initialColumn?: number;
  searchQuery?: string;
  documentType?: DocumentType;
  deleted?: boolean;
  isPanel?: boolean;
}

interface DocumentContextType {
  documents: Record<string, DocumentData>;
  leftTabs: Tab[];
  rightTabs: Tab[];
  leftActivePath: string | null;
  rightActivePath: string | null;
  activeSide: 'left' | 'right';
  isSplit: boolean;
  activeTabPath: string | null;

  openDocument: (
    path: string,
    options?: {
        data?: { content: string; metadata: Record<string, any>; documentType?: DocumentType };
        side?: 'left' | 'right';
      }
    ) => Promise<void>;
  openPanelDocument: (path: string, initialData?: { content: string; metadata: Record<string, any> }) => Promise<void>;
  closeTab: (path: string, side?: 'left' | 'right', reason?: string) => void;
  switchTab: (side: 'left' | 'right', path: string) => void;
  setActiveSide: (side: 'left' | 'right') => void;
  toggleSplit: () => void;
  openPreview: (path: string) => void;
  openDiff: (path: string, staged: boolean) => void;
  openWebBrowser: (url: string, title: string) => void;
  saveDocument: (path: string) => Promise<void>;
  renameDocument: (oldPath: string, newName: string) => Promise<void>;
  updateContent: (path: string, side: 'left' | 'right', value: string | undefined) => void;
  updateMetadata: (path: string, metadata: Record<string, any>) => void;
  markNavigated: (path: string) => void;
  changeViewType: (side: 'left' | 'right', path: string, viewType: DocumentViewType) => void;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [documents, setDocuments] = useState<Record<string, DocumentData>>({});
  const [leftTabs, setLeftTabs] = useState<Tab[]>([]);
  const [rightTabs, setRightTabs] = useState<Tab[]>([]);
  const [leftActivePath, setLeftActivePath] = useState<string | null>(null);
  const [rightActivePath, setRightActivePath] = useState<string | null>(null);
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [isSplit, setIsSplit] = useState(false);

  const { settings, updateSettings, projectPath, loadProjectSettings } = useSettings();
  const restoredRef = useRef<string | null>(null);
  const savingPaths = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<Record<string, any>>({});
  const tabsRef = useRef({ left: leftTabs, right: rightTabs });
  const documentsRef = useRef(documents);

  useEffect(() => {
    tabsRef.current = { left: leftTabs, right: rightTabs };
  }, [leftTabs, rightTabs]);

  useEffect(() => {
    documentsRef.current = documents;
  }, [documents]);

  const activeTabPath = activeSide === 'left' ? leftActivePath : rightActivePath;

  const clearTimer = useCallback((path: string) => {
    if (autoSaveTimerRef.current[path]) {
      clearTimeout(autoSaveTimerRef.current[path]);
      delete autoSaveTimerRef.current[path];
    }
  }, []);

  const closeTab = useCallback((path: string, side?: 'left' | 'right', reason?: string) => {
    clearTimer(path);

    if (reason === 'deleted') {
      if (documentsRef.current[path]) {
        documentsRef.current[path] = {
          ...documentsRef.current[path],
          deleted: true,
        };
      }
    }

    const closeInSide = (targetSide: 'left' | 'right', pathOrPreviewPath: string) => {
      const setTabs = targetSide === 'left' ? setLeftTabs : setRightTabs;
      const activePath = targetSide === 'left' ? leftActivePath : rightActivePath;
      const setActivePath = targetSide === 'left' ? setLeftActivePath : setRightActivePath;

      setTabs((prev) => {
        const newTabs = prev.filter((tab) => tab.path !== pathOrPreviewPath);
        if (activePath === pathOrPreviewPath) {
          const closedTabIndex = prev.findIndex((tab) => tab.path === pathOrPreviewPath);
          if (newTabs.length > 0) {
            const nextIndex = Math.min(closedTabIndex, newTabs.length - 1);
            setActivePath(newTabs[nextIndex].path);
          } else {
            setActivePath(null);
          }
        }
        return newTabs;
      });
    };

    if (!side || side === 'left') closeInSide('left', path);
    if (!side || side === 'right') closeInSide('right', path);

    if (!path.startsWith('preview://')) {
      const previewPath = `preview://${path}`;
      const previewInLeft = tabsRef.current.left.some(t => t.path === previewPath);
      const previewInRight = tabsRef.current.right.some(t => t.path === previewPath);
      if (previewInLeft) closeInSide('left', previewPath);
      if (previewInRight) closeInSide('right', previewPath);
    }

    setDocuments((prevContents) => {
      const stillInAnyTabs = () => {
        if (!side) return false;
        const otherSide = side === 'left' ? 'right' : 'left';
        const otherTabs = tabsRef.current[otherSide];
        return otherTabs.some((t) => t.path === path);
      };

      if (!stillInAnyTabs()) {
        const newContents = { ...prevContents };
        delete newContents[path];
        return newContents;
      }
      return prevContents;
    });
  }, [leftActivePath, rightActivePath, clearTimer]);

  const saveDocument = useCallback(async (path: string) => {
    const data = documentsRef.current[path];
    if (!path || !data) return;

    if (data.deleted) return;

    if (!data.isPanel) {
      const allTabs = [...tabsRef.current.left, ...tabsRef.current.right];
      if (!allTabs.find((t) => t.path === path)) return;
    }

    try {
      savingPaths.current.add(path);
      await window.electron.ipcRenderer.invoke('fs:saveDocument', path, data);

      const updateClean = (tabs: Tab[]) =>
        tabs.map((tab) => (tab.path === path ? { ...tab, isDirty: false } : tab));

      setLeftTabs(updateClean);
      setRightTabs(updateClean);

      setTimeout(() => {
        savingPaths.current.delete(path);
      }, 500);

      if (path.endsWith('kanji-rules.txt')) {
        await window.electron.calibration.reloadRules();
      }
    } catch (err) {
      console.error(err);
      savingPaths.current.delete(path);
    }
  }, [setLeftTabs, setRightTabs]);

  const triggerAutoSave = useCallback((path: string) => {
    if (autoSaveTimerRef.current[path]) {
      clearTimeout(autoSaveTimerRef.current[path]);
    }
    autoSaveTimerRef.current[path] = setTimeout(() => {
      saveDocument(path);
      delete autoSaveTimerRef.current[path];
    }, 3000);
  }, [saveDocument]);

  const openPanelDocument = useCallback(async (path: string, initialData?: { content: string; metadata: Record<string, any> }) => {
    try {
      if (!documentsRef.current[path]) {
        try {
          const data = await window.electron.ipcRenderer.invoke('fs:readDocument', path);
          setDocuments((prev) => ({
            ...prev,
            [path]: { ...data, lastSource: 'external', isPanel: true },
          }));
        } catch (e) {
          if (initialData) {
            setDocuments((prev) => ({
              ...prev,
              [path]: { ...initialData, lastSource: 'external', isPanel: true },
            }));
          }
        }
      } else {
        setDocuments((prev) => ({
          ...prev,
          [path]: { ...prev[path], isPanel: true },
        }));
      }
    } catch (err) {
      console.error('Failed to open panel document:', err);
    }
  }, []);

  const openDocument = useCallback(
    async (
      path: string,
      options?: {
        data?: { content: string; metadata: Record<string, any>; documentType?: DocumentType };
        side?: 'left' | 'right';
      }
    ) => {
      const fileName = path.split('\\').pop() || path.split('/').pop() || 'Untitled';
      const targetSide = options?.side || activeSide;

      let currentData = options?.data || documentsRef.current[path];

      if (!currentData) {
        try {
          currentData = await window.electron.ipcRenderer.invoke('fs:readDocument', path);
          setDocuments((prev) => ({
            ...prev,
            [path]: { ...currentData, lastSource: 'external' },
          }));
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error('Failed to load document:', err);
          return;
        }
      } else if (options?.data) {
        setDocuments((prev) => ({
          ...prev,
          [path]: { ...prev[path], ...options.data, lastSource: 'external' },
        }));
      }

      const getInitialViewType = (docType?: DocumentType): DocumentViewType => {
        if (docType === 'chat') return 'canvas';
        if (docType === 'image') return 'reader';
        return 'editor';
      };

      if (targetSide === 'left') {
        setLeftTabs((prev) => {
          if (prev.find((t) => t.path === path)) return prev;
          const currentType =
            currentData?.documentType || documentsRef.current[path]?.documentType;
          return [
            ...prev,
            { name: fileName, path, isDirty: false, viewType: getInitialViewType(currentType) },
          ];
        });
        setLeftActivePath(path);
        if (activeSide !== 'left') setActiveSide('left');
      } else {
        setRightTabs((prev) => {
          if (prev.find((t) => t.path === path)) return prev;
          const currentType =
            currentData?.documentType || documentsRef.current[path]?.documentType;
          return [
            ...prev,
            { name: fileName, path, isDirty: false, viewType: getInitialViewType(currentType) },
          ];
        });
        setRightActivePath(path);
        if (activeSide !== 'right') setActiveSide('right');
      }
    },
    [activeSide]
  );

  const switchTab = useCallback((side: 'left' | 'right', path: string) => {
    setActiveSide(side);
    if (side === 'left') {
      setLeftActivePath(path);
    } else {
      setRightActivePath(path);
    }
  }, []);

  const changeViewType = useCallback((side: 'left' | 'right', path: string, viewType: DocumentViewType) => {
    const updateTabs = (tabs: Tab[]) => tabs.map((t) => (t.path === path ? { ...t, viewType } : t));
    if (side === 'left') {
      setLeftTabs(updateTabs);
    } else {
      setRightTabs(updateTabs);
    }
  }, []);

  const toggleSplit = useCallback(() => {
    setIsSplit((prev) => {
      const next = !prev;
      if (next) {
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
  }, [leftTabs, rightTabs, leftActivePath, rightActivePath]);

  const openPreview = useCallback((path: string) => {
    const previewPath = `preview://${path}`;
    const previewName = `Preview: ${path.split('\\').pop() || 'Untitled'}`;
    const targetSide = activeSide === 'left' ? 'right' : 'left';
    const setTabs = targetSide === 'left' ? setLeftTabs : setRightTabs;
    const setActivePath = targetSide === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === previewPath)) return prev;
      return [...prev, { path: previewPath, name: previewName, isDirty: false, viewType: 'preview' }];
    });
    setActivePath(previewPath);
    setIsSplit(true);
  }, [activeSide]);

  const openDiff = useCallback((path: string, staged: boolean) => {
    const diffPath = `git-diff://${staged ? 'staged' : 'unstaged'}/${path}`;
    const diffName = `Diff: ${path.split('\\').pop() || 'Untitled'} (${staged ? 'Staged' : 'Changes'})`;
    const setTabs = activeSide === 'left' ? setLeftTabs : setRightTabs;
    const setActivePath = activeSide === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === diffPath)) return prev;
      return [...prev, { path: diffPath, name: diffName, isDirty: false, documentType: 'git-diff' }];
    });
    setActivePath(diffPath);
  }, [activeSide]);

  const openWebBrowser = useCallback((url: string, title: string) => {
    const webPath = `web-browser://${url}`;
    const webName = `Web: ${title}`;
    const targetSide = activeSide === 'left' ? 'right' : 'left';
    const setTabs = targetSide === 'left' ? setLeftTabs : setRightTabs;
    const setActivePath = targetSide === 'left' ? setLeftActivePath : setRightActivePath;

    setTabs((prev) => {
      if (prev.find((tab) => tab.path === webPath)) return prev;
      return [...prev, { path: webPath, name: webName, isDirty: false, documentType: 'browser', viewType: 'canvas' }];
    });
    setActivePath(webPath);
    setIsSplit(true);
  }, [activeSide]);

  const renameDocument = useCallback(async (oldPath: string, newName: string) => {
    if (!newName) return;
    const fileNameWithExt = oldPath.split('\\').pop() || '';
    const lastDotIndex = fileNameWithExt.lastIndexOf('.');
    const fileName = lastDotIndex !== -1 ? fileNameWithExt.substring(0, lastDotIndex) : fileNameWithExt;
    const fileExt = lastDotIndex !== -1 ? fileNameWithExt.substring(lastDotIndex) : '';

    if (newName === fileName) return;
    clearTimer(oldPath);

    const dir = oldPath.substring(0, oldPath.lastIndexOf('\\'));
    const newPath = `${dir}\\${newName}${fileExt}`;

    try {
      await window.electron.ipcRenderer.invoke('fs:rename', oldPath, newPath);

      const updateTabs = (tabs: Tab[]) =>
        tabs.map((t) => (t.path === oldPath ? { ...t, path: newPath, name: `${newName}${fileExt}` } : t));

      setLeftTabs(updateTabs);
      setRightTabs(updateTabs);

      if (leftActivePath === oldPath) setLeftActivePath(newPath);
      if (rightActivePath === oldPath) setRightActivePath(newPath);

      setDocuments((prev) => {
        const newContents = { ...prev };
        newContents[newPath] = newContents[oldPath];
        delete newContents[oldPath];
        return newContents;
      });
    } catch (error) {
      console.error('Failed to rename file:', error);
    }
  }, [clearTimer, leftActivePath, rightActivePath]);

  const updateContent = useCallback((path: string, side: 'left' | 'right', value: string | undefined) => {
    setDocuments((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        content: value || '',
        lastSource: `user-${side}`,
      },
    }));
    const updateDirty = (tabs: Tab[]) => tabs.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab));
    setLeftTabs(updateDirty);
    setRightTabs(updateDirty);
    triggerAutoSave(path);
  }, [triggerAutoSave]);

  const updateMetadata = useCallback((path: string, metadata: Record<string, any>) => {
    setDocuments((prev) => ({
      ...prev,
      [path]: {
        ...prev[path],
        metadata: { ...prev[path]?.metadata, ...metadata },
      },
    }));
    const updateDirty = (tabs: Tab[]) => tabs.map((tab) => (tab.path === path ? { ...tab, isDirty: true } : tab));
    setLeftTabs(updateDirty);
    setRightTabs(updateDirty);
    triggerAutoSave(path);
  }, [triggerAutoSave]);

  const markNavigated = useCallback((path: string) => {
    setDocuments((current) => {
      const currentTab = current[path];
      if (!currentTab) return current;
      const { initialLine: _, initialColumn: __, searchQuery: ___, ...rest } = currentTab as any;
      return { ...current, [path]: { ...rest } };
    });
  }, []);

  // Sync / Restore / Persist
  useEffect(() => {
    if (!projectPath || restoredRef.current === projectPath) return;

    const restore = async () => {
      const previousProject = restoredRef.current;
      restoredRef.current = projectPath;

      if (previousProject && previousProject !== projectPath) {
        setLeftTabs([]);
        setRightTabs([]);
        setLeftActivePath(null);
        setRightActivePath(null);
        setDocuments({});
        setIsSplit(false);
        setActiveSide('left');
      }

      if (!settings.lastOpenFiles) return;

      const { left, right, leftActive, rightActive, isSplit: savedSplit, activeSide: savedSide } = settings.lastOpenFiles;
      if (savedSplit !== undefined) setIsSplit(savedSplit);
      if (savedSide !== undefined) setActiveSide(savedSide);

      const restoreFiles = async (files: { path: string; name: string }[]) => {
        const results = await Promise.all(
          files.map(async (t) => {
            try {
              const data = await window.electron.ipcRenderer.invoke('fs:readDocument', t.path);
              return { path: t.path, name: t.name, data };
            } catch (e) {
              console.error(`Failed to restore ${t.path}`, e);
              return null;
            }
          }),
        );
        return results.filter((r): r is { path: string; name: string; data: any } => r !== null);
      };

      const [leftResults, rightResults] = await Promise.all([restoreFiles(left), restoreFiles(right)]);
      const contentsUpdate: any = {};
      [...leftResults, ...rightResults].forEach((r) => {
        contentsUpdate[r.path] = { ...r.data, lastSource: 'external' };
      });

      setDocuments((prev) => ({ ...prev, ...contentsUpdate }));
      if (leftResults.length > 0) {
        setLeftTabs(leftResults.map((r) => ({ name: r.name, path: r.path, isDirty: false })));
        if (leftActive) setLeftActivePath(leftActive);
      }
      if (rightResults.length > 0) {
        setRightTabs(rightResults.map((r) => ({ name: r.name, path: r.path, isDirty: false })));
        if (rightActive) setRightActivePath(rightActive);
      }
    };
    restore();
  }, [projectPath, settings.lastOpenFiles]);

  useEffect(() => {
    if (!projectPath || restoredRef.current !== projectPath) return;
    const lastOpenFiles = {
      left: leftTabs.map((t) => ({ path: t.path, name: t.name })),
      right: rightTabs.map((t) => ({ path: t.path, name: t.name })),
      leftActive: leftActivePath,
      rightActive: rightActivePath,
      activeSide,
      isSplit,
    };
    if (JSON.stringify(lastOpenFiles) !== JSON.stringify(settings.lastOpenFiles)) {
      updateSettings({ lastOpenFiles });
    }
  }, [leftTabs, rightTabs, leftActivePath, rightActivePath, activeSide, isSplit, projectPath, updateSettings, settings.lastOpenFiles]);

  // FS Watcher
  useEffect(() => {
    const cleanup = window.electron.fs.onFileChange(async ({ event, path }) => {
      const { left: currentLeftTabs, right: currentRightTabs } = tabsRef.current;
      if (event === 'change') {
        const targetTab = [...currentLeftTabs, ...currentRightTabs].find((t) => t.path === path);
        if (targetTab) {
          if (savingPaths.current.has(path)) return;
          if (targetTab.isDirty) {
            const confirmed = await window.electron.ipcRenderer.invoke('dialog:confirm', `${targetTab.name} は外部で変更されました。破棄して再読み込みしますか？`);
            if (!confirmed) return;
          }
          try {
            const data = await window.electron.ipcRenderer.invoke('fs:readDocument', path);
            setDocuments((prev) => ({ ...prev, [path]: data }));
            const updateClean = (tabs: Tab[]) => tabs.map((tab) => (tab.path === path ? { ...tab, isDirty: false } : tab));
            setLeftTabs(updateClean);
            setRightTabs(updateClean);
          } catch (err) {
            console.error('Failed to reload file', err);
          }
        }
      } else if (event === 'unlink') {
        clearTimer(path);
        setLeftTabs((prev) => prev.filter((t) => t.path !== path));
        setRightTabs((prev) => prev.filter((t) => t.path !== path));
        setDocuments((prev) => {
          const next = { ...prev };
          delete next[path];
          return next;
        });
      }
    });
    return () => cleanup();
  }, [clearTimer]);

  useEffect(() => {
    if (!isSplit) return;
    if (leftTabs.length === 0 && rightTabs.length > 0) {
      setLeftTabs(rightTabs);
      setLeftActivePath(rightActivePath);
      setRightTabs([]);
      setRightActivePath(null);
      setIsSplit(false);
      setActiveSide('left');
    } else if (rightTabs.length === 0) {
      setIsSplit(false);
      setActiveSide('left');
    }
  }, [isSplit, leftTabs, rightTabs, rightActivePath]);

  return (
    <DocumentContext.Provider
      value={{
        documents,
        leftTabs,
        rightTabs,
        leftActivePath,
        rightActivePath,
        activeSide,
        isSplit,
        activeTabPath,
        openDocument,
        openPanelDocument,
        closeTab,
        switchTab,
        setActiveSide,
        toggleSplit,
        openPreview,
        openDiff,
        openWebBrowser,
        saveDocument,
        renameDocument,
        updateContent,
        updateMetadata,
        markNavigated,
        changeViewType,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
};
