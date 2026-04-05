import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import { Tab } from '../components/TabBar/TabBar';
import { useSettings } from './SettingsContext'
import { NovelaidDocumentType } from '../../novelaid-fs';
import { DocumentViewType, TabItem } from '../../common/types';
import { toDocumentPath, getFilePath } from '../../common/utils/pathUtils';
import { useProject } from './ProjectContext';

export interface DocumentState {
  path: string;
  name: string;
  content: string;
  metadata: Record<string, any>;
  lastSource?: 'user' | 'external' | 'user-left' | 'user-right' | string;
  initialLine?: number;
  initialColumn?: number;
  searchQuery?: string;
  documentType?: NovelaidDocumentType;
  deleted?: boolean;
  isDirty: boolean;
  isPanel?: boolean; // 互換性のために残す

  // 各ペイン・各スロット（メイン/プレビュー）の表示状態。'none'ならタブが表示されない。
  leftMainView: DocumentViewType;
  rightMainView: DocumentViewType;
  leftPreviewView: DocumentViewType;
  rightPreviewView: DocumentViewType;

  // パネル表示状態（サイドバーなど）
  openPanelIds: string[];
}

// TabItem type is now imported from ../../common/types

interface DocumentContextType {
  openDocuments: DocumentState[];
  activeLeftItem: TabItem | null;
  activeRightItem: TabItem | null;
  activeSide: 'left' | 'right';
  isSplit: boolean;
  activeTabItem: TabItem | null; // 以前の activeTabPath に相当
  // 後方互換性またはUI描画用
  leftTabs: Tab[];
  rightTabs: Tab[];

  openDocument: (
    path: string,
    options?: {
      data?: {
        content: string;
        metadata: Record<string, any>;
        documentType?: NovelaidDocumentType;
      };
      side?: 'left' | 'right';
      requestedViewType?: DocumentViewType;
      title?: string;
    },
  ) => Promise<void>;
  openPanelDocument: (
    path: string,
    initialData?: { content: string; metadata: Record<string, any> },
  ) => Promise<void>;
  closeTab: (
    path: string,
    side?: 'left' | 'right',
    viewType?: DocumentViewType,
    reason?: string,
  ) => void;
  switchTab: (side: 'left' | 'right', path: string) => void;
  setActiveSide: (side: 'left' | 'right') => void;
  toggleSplit: () => void;
  openPreview: (path: string) => void;
  openDiff: (path: string, staged: boolean) => void;
  openWebBrowser: (url: string, title: string) => void;
  saveDocument: (path: string) => Promise<void>;
  renameDocument: (oldPath: string, newName: string) => Promise<void>;
  updateContent: (
    path: string,
    side: 'left' | 'right',
    value: string | undefined,
  ) => void;
  updateMetadata: (path: string, metadata: Record<string, any>) => void;
  markNavigated: (path: string) => void;
  changeViewType: (
    side: 'left' | 'right',
    item: TabItem,
    viewType: DocumentViewType,
  ) => void;
  getFileTitle: (path: string) => Promise<string>;
  getAbsolutePath: (path: string) => string;
}

const DocumentContext = createContext<DocumentContextType | undefined>(
  undefined,
);

export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};

export const DocumentProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [openDocuments, setOpenDocuments] = useState<DocumentState[]>([]);
  const [activeLeftItem, setActiveLeftItem] = useState<TabItem | null>(null);
  const [activeRightItem, setActiveRightItem] = useState<TabItem | null>(null);
  const [activeSide, setActiveSide] = useState<'left' | 'right'>('left');
  const [isSplit, setIsSplit] = useState(false);

  const { projectConfig: settings, updateProjectConfig: updateSettings, projectPath } =
    useProject();
  const restoredRef = useRef<string | null>(null);
  const savingPaths = useRef<Set<string>>(new Set());
  const autoSaveTimerRef = useRef<Record<string, any>>({});
  const openDocumentsRef = useRef(openDocuments);

  useEffect(() => {
    openDocumentsRef.current = openDocuments;
  }, [openDocuments]);

  const activeTabItem =
    activeSide === 'left' ? activeLeftItem : activeRightItem;

  const getAbsolutePath = useCallback((path: string) => {
    return getFilePath(toDocumentPath(path));
  }, []);

  const getDocumentByPath = useCallback((path: string) => {
    const absolutePath = getAbsolutePath(path);
    return openDocumentsRef.current.find(d => d.path === absolutePath);
  }, [getAbsolutePath]);

  // Derive left/right tabs from openDocuments
  const leftTabs = useMemo(() => {
    return openDocuments.reduce((acc, doc) => {
      if (doc.leftMainView !== 'none') {
        acc.push({
          path: doc.path,
          name: doc.name,
          isDirty: doc.isDirty,
          viewType: doc.leftMainView,
          documentType: doc.documentType,
        } as Tab);
      }
      if (doc.leftPreviewView !== 'none') {
        acc.push({
          path: `preview://${doc.path}`,
          name: `Preview: ${doc.name}`,
          isDirty: false,
          viewType: 'preview',
          documentType: doc.documentType,
        } as Tab);
      }
      return acc;
    }, [] as Tab[]);
  }, [openDocuments]);

  const rightTabs = useMemo(() => {
    return openDocuments.reduce((acc, doc) => {
      if (doc.rightMainView !== 'none') {
        acc.push({
          path: doc.path,
          name: doc.name,
          isDirty: doc.isDirty,
          viewType: doc.rightMainView,
          documentType: doc.documentType,
        } as Tab);
      }
      if (doc.rightPreviewView !== 'none') {
        acc.push({
          path: `preview://${doc.path}`,
          name: `Preview: ${doc.name}`,
          isDirty: false,
          viewType: 'preview',
          documentType: doc.documentType,
        } as Tab);
      }
      return acc;
    }, [] as Tab[]);
  }, [openDocuments]);

  const clearTimer = useCallback((path: string) => {
    if (autoSaveTimerRef.current[path]) {
      clearTimeout(autoSaveTimerRef.current[path]);
      delete autoSaveTimerRef.current[path];
    }
  }, []);

  const closeTab = useCallback(
    (
      path: string,
      side?: 'left' | 'right',
      viewType?: DocumentViewType,
      reason?: string,
    ) => {
      const docPath = getFilePath(path);
      const normalizedPath = toDocumentPath(docPath);
      clearTimer(normalizedPath);

      setOpenDocuments((prev) => {
        const docIndex = prev.findIndex((d) => d.path === normalizedPath);
        if (docIndex === -1) return prev;

        const doc = prev[docIndex];
        const newDoc = { ...doc };

        if (reason === 'deleted') {
          newDoc.deleted = true;
        }

        const isPreviewClosing = viewType === 'preview';

        // 指定されたサイド（または両方）の表示を消す
        if (!side || side === 'left') {
          if (isPreviewClosing) {
            newDoc.leftPreviewView = 'none';
          } else {
            newDoc.leftMainView = 'none';
            // 連動終了: エディターを閉じたら反対側のプレビューも閉じる
            newDoc.rightPreviewView = 'none';
          }
        }
        if (!side || side === 'right') {
          if (isPreviewClosing) {
            newDoc.rightPreviewView = 'none';
          } else {
            newDoc.rightMainView = 'none';
            // 連動終了: エディターを閉じたら反対側のプレビューも閉じる
            newDoc.leftPreviewView = 'none';
          }
        }

        // 全ての表示が 'none' で、かつパネルでも開かれていないなら削除
        const isActiveInAnyView =
          newDoc.leftMainView !== 'none' ||
          newDoc.rightMainView !== 'none' ||
          newDoc.leftPreviewView !== 'none' ||
          newDoc.rightPreviewView !== 'none' ||
          newDoc.openPanelIds.length > 0;

        if (!isActiveInAnyView) {
          return prev.filter((_, i) => i !== docIndex);
        }

        const newList = [...prev];
        newList[docIndex] = newDoc;
        return newList;
      });

      // アクティブアイテムの調整
      const adjustActiveItem = (
        targetSide: 'left' | 'right',
        closedViewType: DocumentViewType,
      ) => {
        const setActiveItem =
          targetSide === 'left' ? setActiveLeftItem : setActiveRightItem;
        const currentTabs = targetSide === 'left' ? leftTabs : rightTabs;
        const activeItem =
          targetSide === 'left' ? activeLeftItem : activeRightItem;

        if (!activeItem) return;

        // 閉じられたビューが現在のアクティブ項目と一致するか判定
        const isClosedActive =
          activeItem.path === normalizedPath &&
          (closedViewType === 'preview'
            ? activeItem.isPreview
            : !activeItem.isPreview);

        if (isClosedActive) {
          const closedTabPath =
            closedViewType === 'preview'
              ? `preview://${normalizedPath}`
              : normalizedPath;
          const remainingTabs = currentTabs.filter((t) => t.path !== closedTabPath);

          if (remainingTabs.length > 0) {
            const closedTabIndex = currentTabs.findIndex(
              (t) => t.path === closedTabPath,
            );
            const nextIndex = Math.min(closedTabIndex, remainingTabs.length - 1);
            const nextTab = remainingTabs[nextIndex];
            setActiveItem({
              path: getFilePath(nextTab.path),
              isPreview: nextTab.path.startsWith('preview://'),
            });
          } else {
            setActiveItem(null);
          }
        }
      };

      if (!side || side === 'left') {
        adjustActiveItem('left', viewType || 'editor');
        // メインビューを閉じた場合、右側のプレビューも閉じられた可能性があるため調整
        if (viewType !== 'preview') adjustActiveItem('right', 'preview');
      }
      if (!side || side === 'right') {
        adjustActiveItem('right', viewType || 'editor');
        // メインビューを閉じた場合、左側のプレビューも閉じられた可能性があるため調整
        if (viewType !== 'preview') adjustActiveItem('left', 'preview');
      }
    },
    [clearTimer, activeLeftItem, activeRightItem, leftTabs, rightTabs],
  );

  const saveDocument = useCallback(
    async (path: string) => {
      const data = getDocumentByPath(path);
      if (!path || !data) return;

      if (data.deleted) return;

      try {
        const absolutePath = getAbsolutePath(path);
        savingPaths.current.add(absolutePath);
        await window.electron.ipcRenderer.invoke('fs:saveDocument', absolutePath, data);

        setOpenDocuments((prev) =>
          prev.map((doc) =>
            doc.path === path ? { ...doc, isDirty: false } : doc,
          ),
        );

        setTimeout(() => {
          savingPaths.current.delete(path);
        }, 500);

        if (absolutePath.endsWith('kanji-rules.txt')) {
          await window.electron.calibration.reloadRules();
        }
      } catch (err) {
        console.error(err);
        savingPaths.current.delete(getAbsolutePath(path));
      }
    },
    [getAbsolutePath, getDocumentByPath],
  );

  const triggerAutoSave = useCallback(
    (path: string) => {
      if (autoSaveTimerRef.current[path]) {
        clearTimeout(autoSaveTimerRef.current[path]);
      }
      autoSaveTimerRef.current[path] = setTimeout(() => {
        saveDocument(path);
        delete autoSaveTimerRef.current[path];
      }, 3000);
    },
    [saveDocument],
  );

  const openPanelDocument = useCallback(
    async (
      path: string,
      initialData?: { content: string; metadata: Record<string, any> },
    ) => {
      const absolutePath = getAbsolutePath(path);
      const existing = getDocumentByPath(absolutePath);

      if (!existing) {
        try {
          const data = await window.electron.ipcRenderer.invoke(
            'fs:readDocument',
            absolutePath,
          );
          const newDoc: DocumentState = {
            path: absolutePath,
            name: await getFileTitle(absolutePath),
            content: data.content,
            metadata: data.metadata,
            documentType: data.documentType,
            isDirty: false,
            leftMainView: 'none',
            rightMainView: 'none',
            leftPreviewView: 'none',
            rightPreviewView: 'none',
            openPanelIds: ['side-panel'], // 仮のID
          };
          setOpenDocuments((prev) => [...prev, newDoc]);
        } catch (e) {
          if (initialData) {
            const newDoc: DocumentState = {
              path: absolutePath,
              name: await getFileTitle(absolutePath),
              content: initialData.content,
              metadata: initialData.metadata,
              isDirty: false,
              leftMainView: 'none',
              rightMainView: 'none',
              leftPreviewView: 'none',
              rightPreviewView: 'none',
              openPanelIds: ['side-panel'],
            };
            setOpenDocuments((prev) => [...prev, newDoc]);
          }
        }
      } else {
        setOpenDocuments((prev) =>
          prev.map((d) =>
            d.path === absolutePath
              ? {
                  ...d,
                  openPanelIds: d.openPanelIds.includes('side-panel')
                    ? d.openPanelIds
                    : [...d.openPanelIds, 'side-panel'],
                }
              : d,
          ),
        );
      }
    },
    [getAbsolutePath, getDocumentByPath],
  );

  const openDocument = useCallback(
    async (
      path: string,
      options?: {
        data?: {
          content: string;
          metadata: Record<string, any>;
          documentType?: NovelaidDocumentType;
        };
        side?: 'left' | 'right';
        requestedViewType?: DocumentViewType;
        title?: string;
      },
    ) => {
      let normalizedPath = toDocumentPath(path);
      let absolutePath = getFilePath(normalizedPath);
      let currentType: NovelaidDocumentType | undefined = options?.data?.documentType;
      let fileName = options?.title;

      // URIスキームの早期判定
      if (normalizedPath.startsWith('browser://') || normalizedPath.startsWith('http://') || normalizedPath.startsWith('https://')) {
        currentType = 'browser';
        const url = normalizedPath.startsWith('browser://') ? normalizedPath.replace('browser://', '') : normalizedPath;
        normalizedPath = `browser://${url}`;
        absolutePath = normalizedPath; // browserは normalizedPath を absolutePath とする
        fileName = fileName || url;
      } else if (normalizedPath.startsWith('gitDiff://')) {
        currentType = 'gitDiff';
        const parts = normalizedPath.replace('gitDiff://', '').split('/');
        const filePath = parts.slice(1).join('/');
        fileName = fileName || `Diff: ${filePath.split('/').pop() || 'Untitled'} (${parts[0] === 'staged' ? 'Staged' : 'Changes'})`;
        absolutePath = normalizedPath;
      }

      const isVirtual = currentType === 'browser' || currentType === 'gitDiff';
      if (!fileName && !isVirtual) {
        fileName = await getFileTitle(absolutePath);
      }
      fileName = fileName || 'Untitled';

      let targetSide = options?.side || activeSide;
      const requestedIsPreview = options?.requestedViewType === 'preview';

      if (requestedIsPreview && !options?.side) {
        targetSide = 'left'; // preview展開時は元エディターを必ずleftに配置
      }
      //ブラウザは投稿用想定であり、右側にひらく
      if (currentType === 'browser' && !options?.side) {
        targetSide = 'right';
      }
      //現在アクティブなサイドと異なるサイドに開く場合は、スプリット表示にする
      if (targetSide != activeSide) {
        setIsSplit(true);
      }

      let existingDoc = getDocumentByPath(normalizedPath);
      let docToUpdate: DocumentState;

      if (!existingDoc && !isVirtual) {
        try {
          const loadedData = await window.electron.ipcRenderer.invoke(
            'fs:readDocument',
            absolutePath,
          );
          existingDoc = {
            path: absolutePath,
            name: fileName,
            content: loadedData.content,
            metadata: loadedData.metadata,
            documentType: loadedData.documentType || currentType,
            isDirty: false,
            leftMainView: 'none',
            rightMainView: 'none',
            leftPreviewView: 'none',
            rightPreviewView: 'none',
            openPanelIds: [],
          };
        } catch (err) {
          console.error('Failed to load document:', err);
          return;
        }
      } else if (!existingDoc && isVirtual) {
        existingDoc = {
          path: normalizedPath,
          name: fileName,
          content: '',
          metadata: {},
          documentType: currentType,
          isDirty: false,
          leftMainView: 'none',
          rightMainView: 'none',
          leftPreviewView: 'none',
          rightPreviewView: 'none',
          openPanelIds: [],
        };
      }

      if (!existingDoc) return;

      const getInitialViewType = (docType?: NovelaidDocumentType): DocumentViewType => {
        if (docType === 'chat' || docType === 'browser') return 'canvas';
        if (docType === 'image') return 'reader';
        if (options?.requestedViewType && options.requestedViewType !== 'preview') {
          return options.requestedViewType;
        }
        return 'editor';
      };

      const viewTypeToSet = getInitialViewType(existingDoc.documentType);

      docToUpdate = { ...existingDoc };
      if (options?.data) {
        docToUpdate.content = options.data.content;
        docToUpdate.metadata = options.data.metadata;
        if (options.data.documentType) docToUpdate.documentType = options.data.documentType;
      }

      if (requestedIsPreview) {
        if (targetSide === 'left') docToUpdate.leftPreviewView = 'preview';
        else docToUpdate.rightPreviewView = 'preview';
      } else {
        if (targetSide === 'left') docToUpdate.leftMainView = viewTypeToSet;
        else docToUpdate.rightMainView = viewTypeToSet;
      }

      setOpenDocuments((prev) => {
        const index = prev.findIndex((d) => d.path === docToUpdate.path);
        if (index >= 0) {
          const newList = [...prev];
          const existing = newList[index];
          // 明示的に指定されたViewType以外は既存の状態を保持する
          newList[index] = {
            ...docToUpdate,
            leftMainView: docToUpdate.leftMainView !== 'none' ? docToUpdate.leftMainView : existing.leftMainView,
            rightMainView: docToUpdate.rightMainView !== 'none' ? docToUpdate.rightMainView : existing.rightMainView,
            leftPreviewView: docToUpdate.leftPreviewView !== 'none' ? docToUpdate.leftPreviewView : existing.leftPreviewView,
            rightPreviewView: docToUpdate.rightPreviewView !== 'none' ? docToUpdate.rightPreviewView : existing.rightPreviewView,
            openPanelIds: docToUpdate.openPanelIds.length > 0 ? docToUpdate.openPanelIds : existing.openPanelIds,
          };
          return newList;
        }
        return [...prev, docToUpdate];
      });

      const newTabItem: TabItem = { path: docToUpdate.path, isPreview: requestedIsPreview };
      if (targetSide === 'left') {
        setActiveLeftItem(newTabItem);
        setActiveSide('left');
      } else {
        setActiveRightItem(newTabItem);
        setActiveSide('right');
      }

      // requestedViewType === 'preview' の場合は、タブ開設直後にプレビューも展開する (以前の挙動の再現)
      if (requestedIsPreview) {
        // すでに上で設定済み
      }
    },
    [activeSide, getAbsolutePath, getDocumentByPath],
  );

  const switchTab = useCallback(
    (side: 'left' | 'right', path: string) => {
      setActiveSide(side);
      const isPreview = path.startsWith('preview://');
      const docPath = isPreview ? path.replace('preview://', '') : path;
      const item: TabItem = { path: docPath, isPreview };

      if (side === 'left') {
        setActiveLeftItem(item);
      } else {
        setActiveRightItem(item);
      }
    },
    [setActiveLeftItem, setActiveRightItem, setActiveSide],
  );

  const changeViewType = useCallback(
    (side: 'left' | 'right', item: TabItem, viewType: DocumentViewType) => {
      setOpenDocuments((prev) =>
        prev.map((doc) => {
          if (doc.path !== item.path) return doc;
          const newDoc = { ...doc };
          if (item.isPreview) {
            if (side === 'left') newDoc.leftPreviewView = viewType;
            else newDoc.rightPreviewView = viewType;
          } else {
            if (side === 'left') newDoc.leftMainView = viewType;
            else newDoc.rightMainView = viewType;
          }
          return newDoc;
        }),
      );
    },
    [],
  );

  const toggleSplit = useCallback(() => {
    setIsSplit((prev) => {
      const next = !prev;
      if (next) {
        if (!activeRightItem && activeLeftItem) {
          setActiveRightItem(activeLeftItem);
          setOpenDocuments((prevDocs) =>
            prevDocs.map((d) => {
              if (d.path === activeLeftItem.path) {
                return {
                  ...d,
                  rightMainView:
                    d.leftMainView !== 'none' ? d.leftMainView : 'editor',
                  rightPreviewView: activeLeftItem.isPreview
                    ? 'preview'
                    : d.rightPreviewView,
                };
              }
              return d;
            }),
          );
        }
      }
      return next;
    });
  }, [activeLeftItem, activeRightItem]);

  const openPreview = useCallback(
    async (path: string) => {
      const normalizedPath = toDocumentPath(path);
      const targetSide = activeSide === 'left' ? 'right' : 'left';

      setOpenDocuments((prev) =>
        prev.map((doc) => {
          if (doc.path !== normalizedPath) return doc;
          const newDoc = { ...doc };
          if (targetSide === 'left') newDoc.leftPreviewView = 'preview';
          else newDoc.rightPreviewView = 'preview';
          return newDoc;
        }),
      );

      const previewItem = { path: normalizedPath, isPreview: true };
      if (targetSide === 'left') setActiveLeftItem(previewItem);
      else setActiveRightItem(previewItem);

      setIsSplit(true);
    },
    [activeSide],
  );

  const openDiff = useCallback(
    async (path: string, staged: boolean) => {
      await openDocument(`gitDiff://${staged ? 'staged' : 'unstaged'}/${path}`);
    },
    [openDocument],
  );

  const openWebBrowser = useCallback(
    (url: string, title: string) => {
      openDocument(`browser://${url}`, { title });
    },
    [openDocument],
  );

  const renameDocument = useCallback(
    async (oldPath: string, newName: string) => {
      if (!newName) return;
      const fileExt = await window.electron.path.extname(oldPath);
      const dir = await window.electron.path.dirname(oldPath);
      const newPath = await window.electron.path.join(
        dir,
        `${newName}${fileExt}`,
      );

      if (oldPath === newPath) return;
      clearTimer(oldPath);

      try {
        await window.electron.ipcRenderer.invoke('fs:rename', oldPath, newPath);

        setOpenDocuments((prev) =>
          prev.map((doc) =>
            doc.path === oldPath
              ? { ...doc, path: newPath, name: newName }
              : doc,
          ),
        );

        if (activeLeftItem?.path === oldPath) {
          setActiveLeftItem((prev) => (prev ? { ...prev, path: newPath } : null));
        }
        if (activeRightItem?.path === oldPath) {
          setActiveRightItem((prev) => (prev ? { ...prev, path: newPath } : null));
        }
      } catch (error) {
        console.error('Failed to rename file:', error);
      }
    },
    [clearTimer, activeLeftItem, activeRightItem],
  );

  const updateContent = useCallback(
    (path: string, side: 'left' | 'right', value: string | undefined) => {
      const normalizedPath = toDocumentPath(path);
      setOpenDocuments((prev) =>
        prev.map((doc) =>
          doc.path === normalizedPath
            ? {
                ...doc,
                content: value || '',
                lastSource: `user-${side}`,
                isDirty: true,
              }
            : doc,
        ),
      );
      triggerAutoSave(normalizedPath);
    },
    [triggerAutoSave],
  );

  const updateMetadata = useCallback(
    (path: string, metadata: Record<string, any>) => {
      const normalizedPath = toDocumentPath(path);
      setOpenDocuments((prev) =>
        prev.map((doc) =>
          doc.path === normalizedPath
            ? {
                ...doc,
                metadata: { ...doc.metadata, ...metadata },
                isDirty: true,
              }
            : doc,
        ),
      );
      triggerAutoSave(normalizedPath);
    },
    [triggerAutoSave],
  );

  const markNavigated = useCallback((path: string) => {
    const normalizedPath = toDocumentPath(path);
    setOpenDocuments((prev) =>
      prev.map((doc) => {
        if (doc.path !== normalizedPath) return doc;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const {
          initialLine: _,
          initialColumn: __,
          searchQuery: ___,
          ...rest
        } = doc;
        return { ...rest } as DocumentState;
      }),
    );
  }, []);

  // プロジェクトが閉じられた際、または切り替わった際に状態をリセットする
  useEffect(() => {
    if (!projectPath) {
      setOpenDocuments([]);
      setActiveLeftItem(null);
      setActiveRightItem(null);
      setIsSplit(false);
      setActiveSide('left');
      restoredRef.current = null;
    }
  }, [projectPath]);

  // Sync / Restore / Persist
  useEffect(() => {
    if (!projectPath || restoredRef.current === projectPath) return;

    const restore = async () => {
      // 復元前に状態をクリア（プロジェクト切り替え時など）
      setOpenDocuments([]);
      setActiveLeftItem(null);
      setActiveRightItem(null);
      setIsSplit(false);

      if (!settings.lastOpenFiles || !settings.lastOpenFiles.documents) return;

      const {
        documents: savedDocs,
        leftActive,
        rightActive,
        isSplit: savedSplit,
        activeSide: savedSide,
      } = settings.lastOpenFiles;

      if (savedSplit !== undefined) setIsSplit(savedSplit);
      if (savedSide !== undefined) setActiveSide(savedSide);

      // 新しい形式からの復元ロジック
      for (const doc of savedDocs) {
        let absPath = doc.path;
        // URIスキームでない場合はプロジェクトパスと結合して絶対パスにする
        if (!absPath.includes('://') && projectPath) {
          absPath = await window.electron.path.join(projectPath, absPath);
        }

        // 各View設定に従ってドキュメントを開く
        // leftMainView
        if (doc.leftMainView !== 'none') {
          await openDocument(absPath, {
            side: 'left',
            requestedViewType: doc.leftMainView,
          });
        }
        // rightMainView
        if (doc.rightMainView !== 'none') {
          await openDocument(absPath, {
            side: 'right',
            requestedViewType: doc.rightMainView,
          });
        }
        // leftPreviewView
        if (doc.leftPreviewView === 'preview') {
          await openDocument(absPath, {
            side: 'left',
            requestedViewType: 'preview',
          });
        }
        // rightPreviewView
        if (doc.rightPreviewView === 'preview') {
          await openDocument(absPath, {
            side: 'right',
            requestedViewType: 'preview',
          });
        }
      }

      if (leftActive) {
        let absPath = leftActive.path;
        if (!absPath.includes('://') && projectPath) {
          absPath = await window.electron.path.join(projectPath, absPath);
        }
        setActiveLeftItem({ ...leftActive, path: absPath });
      }
      if (rightActive) {
        let absPath = rightActive.path;
        if (!absPath.includes('://') && projectPath) {
          absPath = await window.electron.path.join(projectPath, absPath);
        }
        setActiveRightItem({ ...rightActive, path: absPath });
      }

      // 最後に復元フラグを立てて保存を許可する
      restoredRef.current = projectPath;
    };

    restore();
  }, [projectPath, settings.lastOpenFiles, openDocument]);

  useEffect(() => {
    // プロジェクトパスがない、または復元が完了していない場合は保存しない
    if (!projectPath || restoredRef.current !== projectPath) return;

      const persist = async () => {
        const documentsPromises = openDocuments.map(async (doc) => {
          let relPath = doc.path;
          if (!relPath.includes('://') && projectPath) {
            relPath = await window.electron.path.relative(projectPath, doc.path);
          }
          return {
            path: relPath,
            leftMainView: doc.leftMainView,
            rightMainView: doc.rightMainView,
            leftPreviewView: doc.leftPreviewView,
            rightPreviewView: doc.rightPreviewView,
          };
        });

        const documents = await Promise.all(documentsPromises);

        // アクティブ項目のパスも相対化
        const getRelTabItem = async (item: TabItem | null) => {
          if (!item || !projectPath || item.path.includes('://')) return item;
          return {
            ...item,
            path: await window.electron.path.relative(projectPath, item.path),
          };
        };

        const lastOpenFiles = {
          documents: documents.filter(
            (d) =>
              d.leftMainView !== 'none' ||
              d.rightMainView !== 'none' ||
              d.leftPreviewView !== 'none' ||
              d.rightPreviewView !== 'none'
          ),
          leftActive: await getRelTabItem(activeLeftItem),
          rightActive: await getRelTabItem(activeRightItem),
          activeSide,
          isSplit,
        };

        if (
          JSON.stringify(lastOpenFiles) !== JSON.stringify(settings.lastOpenFiles)
        ) {
          updateSettings({ lastOpenFiles });
        }
      };

      persist();
    }, [
    leftTabs,
    rightTabs,
    activeLeftItem,
    activeRightItem,
    activeSide,
    isSplit,
    projectPath,
    updateSettings,
    settings.lastOpenFiles,
  ]);

  const getFileTitle = useCallback(async (path: string) => {
    if (!path) return '';
    const parsed = await window.electron.path.parse(path);
    return parsed.name;
  }, []);

  // FS Watcher
  useEffect(() => {
    const cleanup = window.electron.fs.onFileChange(async ({ event, path }) => {
      const currentDocs = openDocumentsRef.current;
      const normalizedPath = toDocumentPath(path);

      if (event === 'change') {
        const targetDoc = currentDocs.find((d) => d.path === normalizedPath);
        if (targetDoc) {
          if (savingPaths.current.has(normalizedPath)) return;
          if (targetDoc.isDirty) {
            const confirmed = await window.electron.ipcRenderer.invoke(
              'dialog:confirm',
              `${targetDoc.name} は外部で変更されました。破棄して再読み込みしますか？`,
            );
            if (!confirmed) return;
          }
          try {
            const data = await window.electron.ipcRenderer.invoke(
              'fs:readDocument',
              normalizedPath,
            );
            setOpenDocuments((prev) =>
              prev.map((d) =>
                d.path === normalizedPath
                  ? { ...d, content: data.content, metadata: data.metadata, isDirty: false }
                  : d,
              ),
            );
          } catch (err) {
            console.error('Failed to reload file', err);
          }
        }
      } else if (event === 'unlink') {
        clearTimer(normalizedPath);
        setOpenDocuments((prev) => prev.filter((d) => d.path !== normalizedPath));
      }
    });
    return () => cleanup();
  }, [clearTimer]);

  useEffect(() => {
    if (!isSplit) return;
    if (leftTabs.length === 0 && rightTabs.length > 0) {
      // 全て右にある場合は左に寄せる（簡易的な不整合回避）
      setOpenDocuments((prev) =>
        prev.map((d) => ({
          ...d,
          leftMainView: d.rightMainView,
          leftPreviewView: d.rightPreviewView,
          rightMainView: 'none',
          rightPreviewView: 'none',
        })),
      );
      setActiveLeftItem(activeRightItem);
      setActiveRightItem(null);
      setIsSplit(false);
      setActiveSide('left');
    } else if (rightTabs.length === 0) {
      setIsSplit(false);
      setActiveSide('left');
    }
  }, [isSplit, leftTabs.length, rightTabs.length, activeRightItem]);

  const contextValue = useMemo(
    () => ({
      openDocuments,
      activeLeftItem,
      activeRightItem,
      activeSide,
      isSplit,
      activeTabItem,
      leftTabs,
      rightTabs,
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
      getFileTitle,
      getAbsolutePath,
    }),
    [
      openDocuments,
      activeLeftItem,
      activeRightItem,
      activeSide,
      isSplit,
      activeTabItem,
      leftTabs,
      rightTabs,
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
      getFileTitle,
      getAbsolutePath,
    ],
  );

  return (
    <DocumentContext.Provider value={contextValue}>
      {children}
    </DocumentContext.Provider>
  );
};
