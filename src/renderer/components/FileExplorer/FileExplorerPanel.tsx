import {
  ChevronRight,
  ChevronDown,
  Files,
  Folder,
  FileText,
  FileJson,
  FilePlus,
  FolderPlus,
  BookText,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useGit } from '../../contexts/GitContext';
import { useSettings } from '../../contexts/SettingsContext';
import { Panel } from '../../types/panel';
import './FileExplorerPanel.css';

const BASE_INDENT = 8;
const INDENT_STEP = 16;

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
  language?: string;
  metadata?: Record<string, any>;
}

interface FileExplorerProps {
  onFileSelect: (path: string, data: any) => void;
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
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
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
      // Normalize paths to compare parent directory
      const normalize = (p: string) => p.replace(/\\/g, '/');
      const normalizedPath = normalize(path);
      const normalizedSelf = normalize(file.path);

      const lastSep = normalizedPath.lastIndexOf('/');
      const parent = normalizedPath.substring(0, lastSep);

      if (parent === normalizedSelf) {
        loadDirectory();
      }
    });

    return () => {
      cleanup();
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
        const data = await window.electron.ipcRenderer.invoke(
          'fs:readDocument',
          file.path,
        );
        onFileSelect(file.path, data);
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
        setIsRenaming(false);
        onRefresh();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to rename', err);
      }
    } else if (e.key === 'Escape') {
      setIsRenaming(false);
      setNewName(file.name);
    }
  };

  const handleDelete = useCallback(async () => {
    const confirmed = await window.electron.ipcRenderer.invoke(
      'dialog:confirm',
      `${file.name} を削除しますか？`,
    );
    if (confirmed) {
      try {
        await window.electron.ipcRenderer.invoke('fs:delete', file.path);
        onRefresh();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('Failed to delete', err);
      }
    }
  }, [file.name, file.path, onRefresh]);

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
    const cleanup = window.electron.ipcRenderer.on(
      'file-explorer:action',
      (action: any) => {
        if ((window as any).lastContextPath === file.path) {
          if (action === 'rename') {
            setIsRenaming(true);
          } else if (action === 'delete') {
            handleDelete();
          }
        }
      },
    );
    return () => {
      if (cleanup) cleanup();
    };
  }, [file.path, handleDelete]);

  const handleLocalCreate = (e: React.KeyboardEvent) => {
    handleCreateChild(e, loadDirectory);
  };

  const getFileIcon = (node: FileNode) => {
    if (node.metadata?.icon) {
      const { icon } = node.metadata;
      if (icon.type === 'lucide') {
        const LucideIcon = (LucideIcons as any)[icon.value];
        if (LucideIcon) return <LucideIcon size={16} />;
      }
      if (icon.type === 'local' || icon.type === 'url') {
        const src =
          icon.type === 'local' ? `../../../../${icon.value}` : icon.value;
        return (
          <div className="file-custom-icon">
            <img src={src} alt="" />
          </div>
        );
      }
    }
    if (node.name.endsWith('.json')) return <FileJson size={16} />;
    if (node.language === 'novel') return <BookText size={16} />;
    return <FileText size={16} />;
  };

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', file.path);
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (file.isDirectory) {
      e.preventDefault();
      e.dataTransfer.dropEffect = e.shiftKey ? 'copy' : 'move';
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
    if (!srcPath || srcPath === file.path) return;

    // Check if dropping onto a subfolder of itself
    if (srcPath.startsWith(file.path + '/') || srcPath.startsWith(file.path + '\\')) {
      return;
    }

    try {
      const isCopy = e.shiftKey;
      const fileName = srcPath.split(/[/\\]/).pop();
      const destPath = `${file.path}/${fileName}`;

      if (srcPath === destPath) return;

      if (isCopy) {
        await window.electron.ipcRenderer.invoke('fs:copy', srcPath, destPath);
      } else {
        await window.electron.ipcRenderer.invoke('fs:move', srcPath, destPath);
      }
      onRefresh();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to move/copy file', err);
    }
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
        style={{ paddingLeft: `${BASE_INDENT + level * INDENT_STEP}px` }}
      >
        <span className="chevron">
          {file.isDirectory ? (
            isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />
          ) : null}
        </span>
        <span className="icon">
          {file.isDirectory ? (
            <Folder
              size={16}
              className={isOpen ? 'folder-open' : 'folder-closed'}
            />
          ) : (
            getFileIcon(file)
          )}
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
              setIsRenaming(false);
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
              style={{ paddingLeft: `${BASE_INDENT + (level + 1) * INDENT_STEP}px` }}
              onKeyDown={() => {}}
              onClick={(e) => e.stopPropagation()}
            >
              <span className="chevron" />
              <span className="icon">
                {creatingType === 'file' ? (
                  <FileText size={16} />
                ) : (
                  <Folder size={16} />
                )}
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
  const [newName, setNewName] = useState('');
  const { currentDir } = useGit();

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
      // Normalize paths to compare parent directory
      const normalize = (p: string) => p.replace(/\\/g, '/');
      const normalizedPath = normalize(path);
      const normalizedRoot = normalize(currentDir);

      const lastSep = normalizedPath.lastIndexOf('/');
      const parent = normalizedPath.substring(0, lastSep);

      if (parent === normalizedRoot) {
        refreshRoot();
      }
    });

    return () => {
      cleanup();
    };
  }, [currentDir, refreshRoot]);

  const handleSelect = useCallback((path: string, isDirectory: boolean) => {
    setSelectedPath(path);
    setSelectedIsDir(isDirectory);
  }, []);

  const { settings } = useSettings();
  const defaultExt = settings.editor?.defaultFileExtension || 'md';

  const initiateCreate = (type: 'file' | 'folder') => {
    setCreatingType(type);
    setNewName(type === 'file' ? `untitled.${defaultExt}` : 'untitled');
    if (!selectedPath || !currentDir) {
      setCreatingPath(currentDir);
    } else if (selectedIsDir) {
      setCreatingPath(selectedPath);
    } else {
      // It's a file, use parent
      const lastSep =
        selectedPath.lastIndexOf('\\') !== -1
          ? selectedPath.lastIndexOf('\\')
          : selectedPath.lastIndexOf('/');
      setCreatingPath(selectedPath.substring(0, lastSep));
    }
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
          finalName = `${finalName}.${defaultExt}`;
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

  return (
    <div className="file-explorer" onClick={() => setSelectedPath(null)}>
      <div className="explorer-header" role="presentation" onClick={(e) => e.stopPropagation()}>
        {currentDir && (
          <div className="explorer-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => initiateCreate('file')}
              title="New File"
            >
              <FilePlus size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => initiateCreate('folder')}
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="explorer-content">
        {creatingPath === currentDir && creatingType && (
          <div
            role="button"
            tabIndex={0}
            className="file-item"
            style={{ paddingLeft: `${BASE_INDENT}px` }}
            onKeyDown={() => {}} /* Creation input handles its own keys */
            onClick={(e) => e.stopPropagation()}
          >
            <span className="chevron" />
            <span className="icon">
              {creatingType === 'file' ? (
                <FileText size={16} />
              ) : (
                <Folder size={16} />
              )}
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
            onRefresh={refreshRoot}
            selectedPath={selectedPath}
            onSelect={handleSelect}
            creatingPath={creatingPath}
            creatingType={creatingType}
            newChildName={newName}
            setNewChildName={setNewName}
            handleCreateChild={handleCreate}
            setCreatingPath={setCreatingPath}
          />
        ))}
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
