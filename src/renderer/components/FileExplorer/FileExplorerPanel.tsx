import {
  ChevronRight,
  ChevronDown,
  Files,
  FilePlus,
  FolderPlus,
  X,
} from 'lucide-react';

import React, { useState, useEffect, useCallback } from 'react';
import { useGit } from '../../contexts/GitContext';
import { useDocument } from '../../contexts/DocumentContext';
import { Panel } from '../../types/panel';
import { Tab } from '../TabBar/TabBar';
import './FileExplorerPanel.css';
import FileIcon from '../../utils/FileIcon';
import { DocumentType } from '../../../common/types';

const BASE_INDENT = -8;
const INDENT_STEP = 16;

/** パスを正規化（バックスラッシュ → スラッシュ） */
const normalizePath = (p: string) => p.replace(/\\/g, '/');

/**
 * ドラッグ&ドロップによるファイル移動/コピーを実行する共通処理。
 * - フォルダーを自分の子孫へのドロップは禁止（コピー含む）
 * - 移動の場合: 同一フォルダーへのドロップは無視
 * - コピーの場合: 同一フォルダーへのドロップは main.ts 側で自動リネーム
 */
async function performFileDrop(
  srcPath: string,
  destDir: string,
  isCopy: boolean,
  onRefresh: () => void,
): Promise<void> {
  const normSrc = normalizePath(srcPath);
  const normDest = normalizePath(destDir);

  // srcPath と destDir が同じ（自分自身へのドロップ）は禁止
  if (normSrc === normDest) return;

  // destDir が srcPath の子孫の場合は禁止（フォルダーを自分のサブフォルダーへ移動/コピー防止）
  if (normDest.startsWith(`${normSrc}/`)) return;

  const srcParent = normalizePath(srcPath.replace(/[/\\][^/\\]+$/, ''));

  // 移動の場合: 同一フォルダーへのドロップは無視
  if (!isCopy && srcParent === normDest) return;

  const fileName = srcPath.split(/[/\\]/).pop() ?? '';
  const destPath = `${destDir}/${fileName}`;

  // eslint-disable-next-line no-console
  console.log(
    `[performFileDrop] ${isCopy ? 'copy' : 'move'} src:${srcPath} → dest:${destPath}`,
  );

  try {
    await window.electron.ipcRenderer.invoke(
      isCopy ? 'fs:copy' : 'fs:move',
      srcPath,
      destPath,
    );
    onRefresh();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[performFileDrop] Failed:', err);
  }
}

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
  documentType?: DocumentType;
  metadata?: Record<string, any>;
}

interface FileExplorerProps {
  onFileSelect: (path: string, data: any) => void;
}

function OpenEditorItem({ tab, side, activeTabPath, onFileSelect, closeTab, level = 1 }: { tab: Tab, side: 'left' | 'right', activeTabPath: string | null, onFileSelect: (path: string, data: any) => void, closeTab: (path: string, side?: 'left' | 'right') => void, level?: number }) {
  const fileName = tab.name;
  const isActive = tab.path === activeTabPath;
  return (
    <div
      className={`file-item open-editor-item ${isActive ? 'active' : ''}`}
      onClick={(e) => { e.stopPropagation(); onFileSelect(tab.path, undefined); }}
      style={{ paddingLeft: `${BASE_INDENT + level * INDENT_STEP}px` }}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', tab.path);
        e.dataTransfer.effectAllowed = 'copyMove';
      }}
    >
      <span className="icon">
        <FileIcon name={fileName} isDirectory={false} size={16} />
      </span>
      <span className="name" title={tab.path} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '13px' }}>
        {fileName}
      </span>
      {tab.isDirty && <span className="dirty-dot" style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#fff', marginRight: 4 }} />}
      <button
        type="button"
        className="action-btn editor-close-btn"
        onClick={(e) => { e.stopPropagation(); closeTab(tab.path, side); }}
        title="閉じる"
      >
        <X size={14} />
      </button>
    </div>
  );
}

function FileTreeItem({
  file,
  onFileSelect,
  level = 0,
  onRefresh,
  selectedPath,
  onSelect,
  creatingPath,
  creatingType,
  newChildName,
  setNewChildName,
  handleCreateChild,
  setCreatingPath,
  renamingPath,
  setRenamingPath,
  onRefreshItem,
}: {
  file: FileNode;
  onFileSelect: (path: string, data: any) => void;
  level?: number;
  onRefresh: () => void;
  selectedPath: string | null;
  onSelect: (path: string, isDirectory: boolean) => void;
  creatingPath: string | null;
  creatingType: 'file' | 'folder' | null;
  newChildName: string;
  setNewChildName: (val: string) => void;
  handleCreateChild: (e: React.KeyboardEvent, onDone?: () => void) => void;
  setCreatingPath: (path: string | null) => void;
  renamingPath: string | null;
  setRenamingPath: (path: string | null) => void;
  onRefreshItem: (path: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const isRenaming = renamingPath === file.path;
  const [newName, setNewName] = useState(file.name);
  const [isDragOver, setIsDragOver] = useState(false);

  const loadDirectory = useCallback(async () => {
    try {
      const fileList = await window.electron.ipcRenderer.invoke(
        'fs:readDirectory',
        file.path,
      );
      const sorted = (fileList as FileNode[]).sort((a, b) => {
        if (a.isDirectory === b.isDirectory)
          return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setChildren(sorted);
      setIsLoaded(true);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to load directory', err);
    }
  }, [file.path]);

  // Ensure children are loaded if creating inside
  useEffect(() => {
    if (creatingPath === file.path && !isOpen && file.isDirectory) {
      loadDirectory()
        .then(() => setIsOpen(true))
        // eslint-disable-next-line no-console
        .catch((err) => console.error(err));
    }
  }, [creatingPath, file.path, file.isDirectory, isOpen, loadDirectory]);

  // Listen for file changes in this directory
  useEffect(() => {
    if (!file.isDirectory || !isOpen) return;

    const cleanup = window.electron.fs.onFileChange(({ path }) => {
      const normalize = (p: string) => p.replace(/\\/g, '/');
      const normalizedPath = normalize(path);
      const normalizedSelf = normalize(file.path);

      const fileName = normalizedPath.split('/').pop() ?? '';
      const lastSep = normalizedPath.lastIndexOf('/');
      const parent = normalizedPath.substring(0, lastSep);

      // 直下のファイル・フォルダーが変更された場合、または
      // 自身の .novelaidattributes が変更された場合に再読み込み
      if (
        parent === normalizedSelf ||
        (fileName === '.novelaidattributes' && parent === normalizedSelf)
      ) {
        loadDirectory().catch(() => {});
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [file.isDirectory, file.path, isOpen, loadDirectory]);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(file.path, file.isDirectory);
    if (file.isDirectory) {
      if (!isOpen && (!isLoaded || children.length === 0)) {
        await loadDirectory();
      }
      setIsOpen(!isOpen);
    } else {
      try {
        onFileSelect(file.path, undefined);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to read document', err);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const clickEvent = {
        stopPropagation: () => {},
      } as React.MouseEvent;
      handleToggle(clickEvent as any);
    }
  };

  const handleRename = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newName !== file.name) {
      try {
        const lastSep =
          file.path.lastIndexOf('\\') !== -1
            ? file.path.lastIndexOf('\\')
            : file.path.lastIndexOf('/');
        const parentPath = file.path.substring(0, lastSep);
        const newPath = `${parentPath}/${newName}`;
        await window.electron.ipcRenderer.invoke(
          'fs:rename',
          file.path,
          newPath,
        );
        setRenamingPath(null);
        onRefresh();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to rename', err);
      }
    } else if (e.key === 'Escape') {
      setRenamingPath(null);
      setNewName(file.name);
    }
  };

  const handleContextMenu = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onSelect(file.path, file.isDirectory);
    await window.electron.ipcRenderer.invoke(
      'context-menu:show-file-explorer',
      file.isDirectory,
      file.path,
    );
    // Note: The actual action is handled by the global listener below,
    // but we need a way to know it was *this* item.
    // We'll set a temporary global-ish state via a custom event or just track it.
    (window as any).lastContextPath = file.path;
  };

  useEffect(() => {
    if (isRenaming) {
      setNewName(file.name);
    }
  }, [isRenaming, file.name]);

  const handleLocalCreate = (e: React.KeyboardEvent) => {
    handleCreateChild(e, loadDirectory);
  };


  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'copyMove'; // Shift+ドラッグでコピーカーソルを表示
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (file.isDirectory) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
      setIsDragOver(true);
    }
    e.stopPropagation();
  };

  const handleDragLeave = (e: React.DragEvent) => {
    setIsDragOver(false);
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    if (!file.isDirectory) return;
    e.preventDefault();
    setIsDragOver(false);
    e.stopPropagation();

    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath) return;
    const isCopy = e.ctrlKey;
    // eslint-disable-next-line no-console
    console.log(
      '[handleDrop] srcPath:',
      srcPath,
      'destDir:',
      file.path,
      'isCopy:',
      isCopy,
    );
    await performFileDrop(srcPath, file.path, isCopy, onRefresh);
  };

  return (
    <div className="file-tree-item-container">
      <div
        role="button"
        tabIndex={0}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        onContextMenu={handleContextMenu}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`file-item ${file.isDirectory ? 'directory' : 'file'} ${
          selectedPath === file.path ? 'active' : ''
        } ${file.name.startsWith('.') ? 'hidden-item' : ''} ${
          isDragOver ? 'drag-over' : ''
        }`}
        style={{
          paddingLeft: `${BASE_INDENT + level * INDENT_STEP}px`,
        }}
      >
        <span className="chevron">
          {file.isDirectory && isOpen && <ChevronDown size={14} />}
          {file.isDirectory && !isOpen && <ChevronRight size={14} />}
        </span>
        <span className="icon">
          <FileIcon
            name={file.name}
            path={file.path}
            documentType={file.documentType as DocumentType}
            metadata={file.metadata}
            size={16}
            isDirectory={file.isDirectory}
            isOpen={isOpen}
          />
        </span>
        {isRenaming ? (
          <input
            className="rename-input"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={handleRename}
            onBlur={() => {
              setRenamingPath(null);
              setNewName(file.name);
            }}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="name">{file.name}</span>
        )}
      </div>
      {isOpen && (
        <div className="children-list">
          {creatingPath === file.path && creatingType && (
            <div
              role="button"
              tabIndex={0}
              className="file-item"
              style={{
                paddingLeft: `${BASE_INDENT + (level + 1) * INDENT_STEP}px`,
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.stopPropagation();
                }
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="chevron" />
              <span className="icon">
                <FileIcon
                  name={creatingType === 'file' ? 'untitled' : 'folder'}
                  isDirectory={creatingType === 'folder'}
                  size={16}
                />
              </span>
              <input
                className="rename-input"
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                value={newChildName}
                placeholder={`New ${creatingType}...`}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={handleLocalCreate}
                onBlur={() => setCreatingPath(null)}
                onClick={(e) => e.stopPropagation()}
                onFocus={(e) => e.target.select()}
              />
            </div>
          )}
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              file={child}
              onFileSelect={onFileSelect}
              level={level + 1}
              onRefresh={loadDirectory}
              selectedPath={selectedPath}
              onSelect={onSelect}
              creatingPath={creatingPath}
              creatingType={creatingType}
              newChildName={newChildName}
              setNewChildName={setNewChildName}
              handleCreateChild={handleCreateChild}
              setCreatingPath={setCreatingPath}
              renamingPath={renamingPath}
              setRenamingPath={setRenamingPath}
              onRefreshItem={onRefreshItem}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorerPanel({ onFileSelect }: FileExplorerProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [selectedIsDir, setSelectedIsDir] = useState(false);
  const [creatingPath, setCreatingPath] = useState<string | null>(null);
  const [creatingType, setCreatingType] = useState<'file' | 'folder' | null>(
    null,
  );
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [rootIsExpanded, setRootIsExpanded] = useState(true);
  const [rootIsDragOver, setRootIsDragOver] = useState(false);
  const { currentDir } = useGit();
  const { leftTabs, rightTabs, activeTabPath, closeTab } = useDocument();
  const [openEditorsIsExpanded, setOpenEditorsIsExpanded] = useState(true);
  const [leftEditorsExpanded, setLeftEditorsExpanded] = useState(true);
  const [rightEditorsExpanded, setRightEditorsExpanded] = useState(true);

  const openLeftFiles = React.useMemo(() => {
    return leftTabs.filter((tab) => tab.viewType !== 'preview' && tab.documentType !== 'git-diff' && tab.documentType !== 'browser');
  }, [leftTabs]);

  const openRightFiles = React.useMemo(() => {
    return rightTabs.filter((tab) => tab.viewType !== 'preview' && tab.documentType !== 'git-diff' && tab.documentType !== 'browser');
  }, [rightTabs]);

  const refreshRoot = useCallback(async () => {
    if (!currentDir) {
      setRootFiles([]);
      return;
    }
    try {
      const fileList = await window.electron.ipcRenderer.invoke(
        'fs:readDirectory',
        currentDir,
      );
      const sorted = (fileList as FileNode[]).sort((a, b) => {
        if (a.isDirectory === b.isDirectory)
          return a.name.localeCompare(b.name);
        return a.isDirectory ? -1 : 1;
      });
      setRootFiles(sorted);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [currentDir]);

  useEffect(() => {
    refreshRoot();
  }, [currentDir, refreshRoot]);

  // Listen for file changes in the root directory
  useEffect(() => {
    if (!currentDir) return;

    const cleanup = window.electron.fs.onFileChange(({ path }) => {
      const normalize = (p: string) => p.replace(/\\/g, '/');
      const normalizedPath = normalize(path);
      const normalizedRoot = normalize(currentDir);

      const fileName = normalizedPath.split('/').pop() ?? '';
      const lastSep = normalizedPath.lastIndexOf('/');
      const parent = normalizedPath.substring(0, lastSep);

      // 直下のファイル・フォルダーが変更された場合、または
      // ルートの .novelaidattributes が変更された場合に再読み込み
      if (
        parent === normalizedRoot ||
        (fileName === '.novelaidattributes' && parent === normalizedRoot)
      ) {
        refreshRoot().catch(() => {});
      }
    });

    return () => {
      if (cleanup) cleanup();
    };
  }, [currentDir, refreshRoot]);

  const handleDelete = useCallback(async (path: string) => {
    const fileName = path.split(/[/\\]/).pop();
    const confirmed = await window.electron.ipcRenderer.invoke(
      'dialog:confirm',
      `${fileName} を削除しますか？`,
    );
    if (confirmed) {
      try {
        await window.electron.ipcRenderer.invoke('fs:delete', path);
        refreshRoot();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete', err);
      }
    }
  }, [refreshRoot]);

  useEffect(() => {
    const cleanup = window.electron.ipcRenderer.on(
      'file-explorer:action',
      (action: any) => {
        const path = (window as any).lastContextPath;
        if (!path) return;

        if (action === 'rename') {
          setRenamingPath(path);
        } else if (action === 'delete') {
          handleDelete(path);
        }
      },
    );
    return () => {
      if (cleanup) cleanup();
    };
  }, [handleDelete]);

  const handleSelect = useCallback((path: string, isDirectory: boolean) => {
    setSelectedPath(path);
    setSelectedIsDir(isDirectory);
  }, []);

  const initiateCreate = async (type: 'file' | 'folder') => {
    setCreatingType(type);
    let targetPath = currentDir;
    if (selectedPath && selectedIsDir) {
      targetPath = selectedPath;
    } else if (selectedPath) {
      const lastSep =
        selectedPath.lastIndexOf('\\') !== -1
          ? selectedPath.lastIndexOf('\\')
          : selectedPath.lastIndexOf('/');
      targetPath = selectedPath.substring(0, lastSep);
    }

    if (type === 'file' && targetPath) {
      try {
        await window.electron.ipcRenderer.invoke(
          'fs:createUntitledDocument',
          targetPath,
        );
        refreshRoot();
        return; // Don't set creatingPath/creatingType for files
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to create quick file', err);
      }
    } else {
      setNewName('untitled');
    }

    setCreatingPath(targetPath);
  };

  const handleCreate = async (
    e: React.KeyboardEvent,
    onCreated?: () => void,
  ) => {
    if (e.key === 'Enter' && newName && creatingPath) {
      try {
        let finalName = newName;
        if (
          creatingType === 'file' &&
          !finalName.includes('.') &&
          !finalName.startsWith('.')
        ) {
          const dirType = await window.electron.ipcRenderer.invoke(
            'fs:getDirectoryType',
            creatingPath,
          );
          const ext = dirType === 'markdown' ? 'md' : 'txt';
          finalName = `${finalName}.${ext}`;
        }
        const fullPath = `${creatingPath}/${finalName}`;
        if (creatingType === 'file') {
          await window.electron.ipcRenderer.invoke('fs:createFile', fullPath);
        } else {
          await window.electron.ipcRenderer.invoke(
            'fs:createDirectory',
            fullPath,
          );
        }
        if (onCreated) onCreated();
        setCreatingPath(null);
        setNewName('');
        refreshRoot();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setCreatingPath(null);
      setNewName('');
    }
  };

  // ルートフォルダーへのドラッグハンドラー
  const handleRootDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = e.ctrlKey ? 'copy' : 'move';
    setRootIsDragOver(true);
  };

  const handleRootDragLeave = () => {
    setRootIsDragOver(false);
  };

  const handleRootDrop = async (e: React.DragEvent) => {
    if (!currentDir) return;
    e.preventDefault();
    setRootIsDragOver(false);
    const srcPath = e.dataTransfer.getData('text/plain');
    if (!srcPath) return;
    const isCopy = e.ctrlKey;
    // eslint-disable-next-line no-console
      // eslint-disable-next-line no-console
      console.log(
        '[handleRootDrop] srcPath:',
        srcPath,
        'destDir:',
        currentDir,
        'isCopy:',
        isCopy,
      );
    await performFileDrop(srcPath, currentDir, isCopy, refreshRoot);
  };

  const rootFolderName = currentDir
    ? currentDir.split(/[/\\]/).filter(Boolean).pop() ?? currentDir
    : '';

  return (
    <div className="file-explorer" onClick={() => setSelectedPath(null)}>
      {/* 開いているエディター一覧 */}
      {(openLeftFiles.length > 0 || openRightFiles.length > 0) && (
        <div className="open-editors-section" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '4px', marginBottom: '4px' }}>
          <div
            className="root-folder-header"
            onClick={(e) => {
              e.stopPropagation();
              setOpenEditorsIsExpanded((v) => !v);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setOpenEditorsIsExpanded((v) => !v);
              }
            }}
            tabIndex={0}
            role="button"
          >
            <span className="chevron root-chevron">
              {openEditorsIsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="root-folder-name">開いているファイル</span>
          </div>

          {openEditorsIsExpanded && (
            <div className="open-editors-list" style={{ paddingLeft: '8px' }}>
              {/* Left Pane Files */}
              {openLeftFiles.length > 0 && (
                <>
                  <div
                    className="open-editors-group-title file-item"
                    style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.7, padding: `4px 8px 4px ${BASE_INDENT}px`, textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => { e.stopPropagation(); setLeftEditorsExpanded(v => !v); }}
                  >
                    <span className="chevron root-chevron" style={{ opacity: 1 }}>
                      {leftEditorsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    左エディター
                  </div>
                  {leftEditorsExpanded && openLeftFiles.map(tab => (
                    <OpenEditorItem key={tab.path} tab={tab} side="left" activeTabPath={activeTabPath} closeTab={closeTab} onFileSelect={onFileSelect} />
                  ))}
                </>
              )}

              {/* Right Pane Files */}
              {openRightFiles.length > 0 && (
                <>
                  <div
                    className="open-editors-group-title file-item"
                    style={{ fontSize: '10px', color: 'var(--text-secondary)', opacity: 0.7, padding: `4px 8px 4px ${BASE_INDENT}px`, marginTop: '4px', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={(e) => { e.stopPropagation(); setRightEditorsExpanded(v => !v); }}
                  >
                    <span className="chevron root-chevron" style={{ opacity: 1 }}>
                      {rightEditorsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                    右エディター
                  </div>
                  {rightEditorsExpanded && openRightFiles.map(tab => (
                    <OpenEditorItem key={tab.path} tab={tab} side="right" activeTabPath={activeTabPath} closeTab={closeTab} onFileSelect={onFileSelect} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* ルートフォルダーヘッダー行（VSCode スタイル） */}
      {currentDir && (
        <div
          role="button"
          tabIndex={0}
          className={`root-folder-header ${rootIsDragOver ? 'drag-over' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            setRootIsExpanded((v) => !v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setRootIsExpanded((v) => !v);
            }
          }}
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        >
          <span className="chevron root-chevron">
            {rootIsExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </span>
          <span className="root-folder-name" title={currentDir}>{rootFolderName}</span>
          <span className="root-folder-actions" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="action-btn"
              onClick={() => initiateCreate('file')}
              title="新規ファイル"
            >
              <FilePlus size={14} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => initiateCreate('folder')}
              title="新規フォルダー"
            >
              <FolderPlus size={14} />
            </button>
          </span>
        </div>
      )}
      <div className="explorer-content">
        {rootIsExpanded && (
          <>
            {creatingPath === currentDir && creatingType && (
              <div
                role="button"
                tabIndex={0}
                className="file-item"
                style={{ paddingLeft: `${BASE_INDENT + INDENT_STEP}px` }}
                onKeyDown={() => {}} /* Creation input handles its own keys */
                onClick={(e) => e.stopPropagation()}
              >
                <span className="chevron" />
                <span className="icon">
                  <FileIcon
                    name={creatingType === 'file' ? 'untitled' : 'folder'}
                    isDirectory={creatingType === 'folder'}
                    size={16}
                  />
                </span>
                <input
                  className="rename-input"
                  // eslint-disable-next-line jsx-a11y/no-autofocus
                  autoFocus
                  value={newName}
                  placeholder={`New ${creatingType}...`}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={handleCreate}
                  onBlur={() => setCreatingPath(null)}
                  onClick={(e) => e.stopPropagation()}
                  onFocus={(e) => e.target.select()}
                />
              </div>
            )}
            {rootFiles.map((file) => (
              <FileTreeItem
                key={file.path}
                file={file}
                onFileSelect={onFileSelect}
                level={1}
                onRefresh={refreshRoot}
                selectedPath={selectedPath}
                onSelect={handleSelect}
                creatingPath={creatingPath}
                creatingType={creatingType}
                newChildName={newName}
                setNewChildName={setNewName}
                handleCreateChild={handleCreate}
                setCreatingPath={setCreatingPath}
                renamingPath={renamingPath}
                setRenamingPath={setRenamingPath}
                onRefreshItem={() => refreshRoot()}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

FileTreeItem.defaultProps = {
  level: 0,
};

export const fileExplorerPanelConfig: Panel = {
  id: 'files',
  title: 'エクスプローラー',
  icon: <Files size={24} strokeWidth={1.5} />,
  component: FileExplorerPanel,
  defaultLocation: 'left',
};
