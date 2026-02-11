import {
  ChevronRight,
  ChevronDown,
  Folder,
  FileText,
  FileJson,
  FilePlus,
  FolderPlus,
} from 'lucide-react';
import React, { useState, useEffect, useCallback } from 'react';
import { useGit } from '../../contexts/GitContext';
import './FileExplorerPanel.css';

interface FileNode {
  name: string;
  isDirectory: boolean;
  path: string;
}

interface FileExplorerProps {
  onFileSelect: (path: string, data: any) => void;
  onProjectOpened?: (path: string) => void;
}

function FileTreeItem({
  file,
  onFileSelect,
  level = 0,
  onRefresh,
}: {
  file: FileNode;
  onFileSelect: (path: string, data: any) => void;
  level?: number;
  onRefresh: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [children, setChildren] = useState<FileNode[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [newName, setNewName] = useState(file.name);
  const [creatingChildType, setCreatingChildType] = useState<
    'file' | 'folder' | null
  >(null);
  const [newChildName, setNewChildName] = useState('');

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

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
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
    await window.electron.ipcRenderer.invoke(
      'context-menu:show-file-explorer',
      file.isDirectory,
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

  const handleCreateChild = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newChildName) {
      try {
        const fullPath = `${file.path}/${newChildName}`;
        if (creatingChildType === 'file') {
          await window.electron.ipcRenderer.invoke('fs:createFile', fullPath);
        } else {
          await window.electron.ipcRenderer.invoke(
            'fs:createDirectory',
            fullPath,
          );
        }
        setCreatingChildType(null);
        setNewChildName('');
        await loadDirectory();
        if (!isOpen) setIsOpen(true);
      } catch (err) {
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setCreatingChildType(null);
      setNewChildName('');
    }
  };

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.md')) return <FileText size={16} />;
    if (fileName.endsWith('.json')) return <FileJson size={16} />;
    return <FileText size={16} />;
  };

  return (
    <div className="file-tree-item-container">
      <div
        className={`file-item ${file.isDirectory ? 'directory' : 'file'}`}
        style={{ paddingLeft: `${10 + level * 12}px` }}
        onClick={handleToggle}
        onContextMenu={handleContextMenu}
      >
        {file.isDirectory && (
          <span className="chevron">
            {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
        )}
        <span className="icon">
          {file.isDirectory ? (
            <Folder
              size={16}
              className={isOpen ? 'folder-open' : 'folder-closed'}
            />
          ) : (
            getFileIcon(file.name)
          )}
        </span>
        {isRenaming ? (
          <input
            className="rename-input"
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
          {creatingChildType && (
            <div
              className="file-item"
              style={{ paddingLeft: `${10 + (level + 2) * 12}px` }}
            >
              <span className="icon">
                {creatingChildType === 'file' ? (
                  <FileText size={16} />
                ) : (
                  <Folder size={16} />
                )}
              </span>
              <input
                className="rename-input"
                autoFocus
                value={newChildName}
                placeholder={`New ${creatingChildType}...`}
                onChange={(e) => setNewChildName(e.target.value)}
                onKeyDown={handleCreateChild}
                onBlur={() => {
                  setCreatingChildType(null);
                  setNewChildName('');
                }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}
          {children.map((child) => (
            <FileTreeItem
              key={child.path}
              file={child}
              onFileSelect={onFileSelect}
              level={level + 1}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function FileExplorerPanel({ onFileSelect }: FileExplorerProps) {
  const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
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

  const handleCreate = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && newName && currentDir) {
      try {
        const fullPath = `${currentDir}/${newName}`;
        if (creatingType === 'file') {
          await window.electron.ipcRenderer.invoke('fs:createFile', fullPath);
        } else {
          await window.electron.ipcRenderer.invoke(
            'fs:createDirectory',
            fullPath,
          );
        }
        setCreatingType(null);
        setNewName('');
        refreshRoot();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(err);
      }
    } else if (e.key === 'Escape') {
      setCreatingType(null);
      setNewName('');
    }
  };

  return (
    <div className="file-explorer">
      <div className="explorer-header">
        <span className="explorer-title">エクスプローラー</span>
        {currentDir && (
          <div className="explorer-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => setCreatingType('file')}
              title="New File"
            >
              <FilePlus size={16} />
            </button>
            <button
              type="button"
              className="action-btn"
              onClick={() => setCreatingType('folder')}
              title="New Folder"
            >
              <FolderPlus size={16} />
            </button>
          </div>
        )}
      </div>
      <div className="explorer-content">
        {creatingType && (
          <div className="file-item" style={{ paddingLeft: '10px' }}>
            <span className="icon">
              {creatingType === 'file' ? (
                <FileText size={16} />
              ) : (
                <Folder size={16} />
              )}
            </span>
            <input
              className="rename-input"
              autoFocus
              value={newName}
              placeholder={`New ${creatingType}...`}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={handleCreate}
              onBlur={() => {
                setCreatingType(null);
                setNewName('');
              }}
            />
          </div>
        )}
        {rootFiles.map((file) => (
          <FileTreeItem
            key={file.path}
            file={file}
            onFileSelect={onFileSelect}
            onRefresh={refreshRoot}
          />
        ))}
      </div>
    </div>
  );
}
